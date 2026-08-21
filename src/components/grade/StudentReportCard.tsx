import React from 'react';
import { gradeService, type GradeData } from '../../services/gradeService';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { GraduationCap, Award, TrendingUp, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dbAdapter } from '../../lib/dbAdapter';

interface StudentReportCardProps {
  studentId: string;
  schoolId: string;
  studentName?: string;
  schoolName?: string;
  classroomName?: string;
  academicYear?: string;
  customConfig?: any;
  previewMode?: boolean;
}

const StudentReportCard: React.FC<StudentReportCardProps> = ({ 
  studentId, 
  schoolId,
  studentName = 'Student',
  schoolName = 'Liberia Schools Portal',
  classroomName = 'General',
  academicYear,
  customConfig,
  previewMode = false
}) => {
  const [grades, setGrades] = React.useState<GradeData[]>([]);
  const [allSchoolGrades, setAllSchoolGrades] = React.useState<GradeData[]>([]);
  const [schoolConfig, setSchoolConfig] = React.useState<any>(null);
  const [schoolDetails, setSchoolDetails] = React.useState<{ name: string; address: string; motto?: string } | null>(null);
  const [teachersMap, setTeachersMap] = React.useState<Record<string, string>>({});
  const [studentsMap, setStudentsMap] = React.useState<Record<string, { classId?: string | null }>>({});
  const [classesMap, setClassesMap] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(!previewMode);

  const activeGrades = grades;
  const activeAllSchoolGrades = allSchoolGrades;
  const activeTeachersMap = teachersMap;
  const resolvedClassroomName = React.useMemo(() => {
    const classId = studentsMap[studentId]?.classId;
    if (classId && classesMap[classId]) return classesMap[classId];
    return classroomName;
  }, [classesMap, classroomName, studentId, studentsMap]);

  React.useEffect(() => {
    // Fetch school config from Realtime Database
    const unsubConfig = dbAdapter.subscribeToPath(`schools/${schoolId}`, (data) => {
      if (data && data.length > 0) {
        const schoolData = data[0];
        setSchoolDetails({
          name: schoolData.name || schoolName,
          address: schoolData.address || 'Liberia',
          motto: schoolData.motto || ''
        });
        if (schoolData.reportConfig) {
          setSchoolConfig(schoolData.reportConfig);
        }
      }
    });

    // Subscribe to student's own grades
    const unsubMyGrades = gradeService.subscribeToStudentGrades(studentId, schoolId, (gradeList) => {
      const filtered = gradeList
        .filter((g: any) => g.schoolId === schoolId)
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setGrades(filtered);
    }, academicYear);

    // Subscribe to all school grades for ranking
    const unsubSchoolGrades = gradeService.subscribeToSchoolGrades(schoolId, (gradeList) => {
      setAllSchoolGrades(gradeList);
      setLoading(false);
    }, academicYear);

    const unsubStudents = userService.subscribeToSchoolUsers(schoolId, (userList) => {
      const nextStudents: Record<string, { classId?: string | null }> = {};
      const nextTeachers: Record<string, string> = {};
      userList.forEach(u => {
        nextStudents[u.id] = { classId: u.classId || null };
        if (u.role === 'teacher') {
          nextTeachers[u.id] = u.name;
        }
      });
      setStudentsMap(nextStudents);
      setTeachersMap(nextTeachers);
    });

    const unsubClasses = academicService.subscribeToSchoolClasses(schoolId, (classList) => {
      const nextClasses: Record<string, string> = {};
      classList.forEach(c => {
        nextClasses[c.id] = c.name;
      });
      setClassesMap(nextClasses);
    });

    return () => {
      unsubConfig();
      unsubMyGrades();
      unsubSchoolGrades();
      unsubStudents();
      unsubClasses();
    };
  }, [studentId, schoolId]);

  const calculatePercentage = (score: number, max: number) => {
    return Math.round((score / max) * 100);
  };

  const getRankData = () => {
    if (activeAllSchoolGrades.length === 0 || activeGrades.length === 0) {
      return { schoolRank: '--', classRank: '--', schoolTotal: 0, classTotal: 0 };
    }

    const studentAverages = activeAllSchoolGrades.reduce((acc, g) => {
      if (!acc[g.studentId]) {
        acc[g.studentId] = { totalPct: 0, count: 0 };
      }
      acc[g.studentId].totalPct += calculatePercentage(g.score, g.maxScore);
      acc[g.studentId].count += 1;
      return acc;
    }, {} as Record<string, { totalPct: number, count: number }>);

    const rankedStudents = Object.entries(studentAverages)
      .map(([id, data]) => ({
        id,
        avg: data.totalPct / data.count
      }))
      .sort((a, b) => b.avg - a.avg);

    const schoolPosition = rankedStudents.findIndex(s => s.id === studentId) + 1;

    const currentStudentClassId = studentsMap[studentId]?.classId || null;
    const classStudentIds = currentStudentClassId
      ? Object.entries(studentsMap)
          .filter(([_, student]) => student.classId === currentStudentClassId)
          .map(([id]) => id)
      : activeAllSchoolGrades
          .filter(g => g.studentId === studentId)
          .length > 0
            ? [studentId]
            : [];

    const classRankedStudents = classStudentIds.length > 0
      ? rankedStudents.filter(s => classStudentIds.includes(s.id))
      : rankedStudents;
    const classPosition = classRankedStudents.findIndex(s => s.id === studentId) + 1;
    const classTotal = classRankedStudents.length;
    const schoolTotal = rankedStudents.length;

    const ordinal = (position: number) => {
      if (position <= 0) return '--';
      const j = position % 10, k = position % 100;
      if (j === 1 && k !== 11) return position + "st";
      if (j === 2 && k !== 12) return position + "nd";
      if (j === 3 && k !== 13) return position + "rd";
      return position + "th";
    };

    const formatRank = (position: number, total: number) => {
      if (position <= 0 || total <= 0) return '--';
      const noun = total === 1 ? 'student' : 'students';
      return `${ordinal(position)} out of ${total} ${noun}`;
    };

    return {
      schoolRank: formatRank(schoolPosition, schoolTotal),
      classRank: formatRank(classPosition, classTotal),
      schoolTotal,
      classTotal
    };
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50';
    if (percentage >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };

  const getLetterGrade = (percentage: number) => {
    const config = customConfig || schoolConfig || {
        gradingScale: [
          { label: 'A+', min: 95, max: 100 },
          { label: 'A', min: 90, max: 94 },
          { label: 'B+', min: 85, max: 89 },
          { label: 'B', min: 80, max: 84 },
          { label: 'C+', min: 75, max: 79 },
          { label: 'C', min: 70, max: 74 },
          { label: 'D', min: 60, max: 69 },
          { label: 'F', min: 0, max: 59 }
        ]
    };

    if (!config.gradingScale) return 'F';
    const tier = config.gradingScale.find((t: any) => percentage >= t.min && percentage <= t.max);
    return tier ? tier.label : 'F';
  };

  // Pivoted lists and helpers inside the main scope
  const getPivotedList = () => {
    interface PivotedSubject {
      subject: string;
      teacher: string;
      scores: Record<string, number>;
    }
    const pivoted: Record<string, PivotedSubject> = {};
    activeGrades.forEach(g => {
      const sub = g.subject.toUpperCase();
      if (!pivoted[sub]) {
        pivoted[sub] = {
          subject: g.subject,
          teacher: activeTeachersMap[g.teacherId] || 'Class Teacher',
          scores: {}
        };
      }
      const term = g.term.toLowerCase();
      const pct = calculatePercentage(g.score, g.maxScore);
      
      if (term.includes('1st period') || term.includes('1st per') || term === 'period 1') {
        pivoted[sub].scores['p1'] = pct;
      } else if (term.includes('2nd period') || term.includes('2nd per') || term === 'period 2') {
        pivoted[sub].scores['p2'] = pct;
      } else if (term.includes('3rd period') || term.includes('3rd per') || term === 'period 3') {
        pivoted[sub].scores['p3'] = pct;
      } else if (term.includes('1st sem exam') || term.includes('1st semester exam') || term.includes('sem 1 exam') || term.includes('exam 1') || term.includes('semester 1 exam')) {
        pivoted[sub].scores['e1'] = pct;
      } else if (term.includes('4th period') || term.includes('4th per') || term === 'period 4') {
        pivoted[sub].scores['p4'] = pct;
      } else if (term.includes('5th period') || term.includes('5th per') || term === 'period 5') {
        pivoted[sub].scores['p5'] = pct;
      } else if (term.includes('6th period') || term.includes('6th per') || term === 'period 6') {
        pivoted[sub].scores['p6'] = pct;
      } else if (term.includes('2nd sem exam') || term.includes('2nd semester exam') || term.includes('sem 2 exam') || term.includes('exam 2') || term.includes('final exam') || term.includes('semester 2 exam')) {
        pivoted[sub].scores['e2'] = pct;
      } else {
        // Legacy mapping fallback
        if (term.includes('term 1') || term.includes('q1') || term.includes('quarter 1')) {
          pivoted[sub].scores['p1'] = pct;
        } else if (term.includes('term 2') || term.includes('q2') || term.includes('quarter 2')) {
          pivoted[sub].scores['p2'] = pct;
        } else if (term.includes('term 3') || term.includes('q3') || term.includes('quarter 3')) {
          pivoted[sub].scores['p3'] = pct;
        } else if (term.includes('final') || term.includes('exam')) {
          pivoted[sub].scores['e1'] = pct;
        } else {
          const keys = ['p1', 'p2', 'p3', 'e1', 'p4', 'p5', 'p6', 'e2'];
          for (const k of keys) {
            if (pivoted[sub].scores[k] === undefined) {
              pivoted[sub].scores[k] = pct;
              break;
            }
          }
        }
      }
    });
    return Object.values(pivoted);
  };

  const getSemAvg = (scores: Record<string, number>, sem: 1 | 2) => {
    const keys = sem === 1 ? ['p1', 'p2', 'p3', 'e1'] : ['p4', 'p5', 'p6', 'e2'];
    const presentScores = keys
      .map(k => scores[k])
      .filter((s): s is number => s !== undefined);
    
    if (presentScores.length === 0) return undefined;
    return Math.round(presentScores.reduce((a, b) => a + b, 0) / presentScores.length);
  };

  const getYearAvg = (scores: Record<string, number>) => {
    const s1 = getSemAvg(scores, 1);
    const s2 = getSemAvg(scores, 2);
    
    const presentAverages = [s1, s2].filter((s): s is number => s !== undefined);
    if (presentAverages.length === 0) return undefined;
    return Math.round(presentAverages.reduce((a, b) => a + b, 0) / presentAverages.length);
  };
  const getImageFormat = (dataUrl: string): 'PNG' | 'JPEG' => {
    const match = /^data:(image\/[^;]+);base64,/i.exec(dataUrl);
    if (!match) return 'PNG';
    const mime = match[1].toLowerCase();
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG';
    return 'PNG';
  };
  const handleDownloadPDF = () => {
    try {
      const rankData = getRankData();
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      const config = customConfig || schoolConfig || {
        officialName: schoolName,
        primaryColor: '#bf212f',
        secondaryColor: '#00205b',
        principalTitle: 'Principal of School',
        teacherTitle: 'Class Teacher / Registrar',
        customFooter: 'The Love of Liberty Brought Us Here',
        showSeal: true,
        showMinistryHeader: true,
        showStudentRank: true,
        showStudentID: true,
        showSummaryBadge: true,
        showSignatures: true,
        showGradingScale: true,
        gradingScale: [
          { label: 'A+', min: 95, max: 100 },
          { label: 'A', min: 90, max: 94 },
          { label: 'B+', min: 85, max: 89 },
          { label: 'B', min: 80, max: 84 },
          { label: 'C+', min: 75, max: 79 },
          { label: 'C', min: 70, max: 74 },
          { label: 'D', min: 60, max: 69 },
          { label: 'F', min: 0, max: 59 }
        ]
      };

      const primaryRGB = hexToRgb(config.primaryColor || '#bf212f');
      const secondaryRGB = hexToRgb(config.secondaryColor || '#00205b');

      const pivotedList = getPivotedList();

      // Template-Specific Backgrounds & Borders
      if (config.templateType === 'minimal') {
          // No border
      } else if (config.templateType === 'modern') {
          doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2], 0.05);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
          doc.setLineWidth(2);
          doc.line(0, 0, pageWidth, 0);
      } else if (config.templateType === 'vibrant') {
          doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
          doc.rect(0, 0, pageWidth, 6, 'F');
          doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
          doc.setLineWidth(0.8);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      } else if (config.templateType === 'playful') {
          // Elegant Heritage Ivory Page & Double Border
          doc.setFillColor(255, 254, 249); // Beautiful Ivory
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          
          doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
          doc.setLineWidth(0.8);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          
          doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
          doc.setLineWidth(0.3);
          doc.rect(7, 7, pageWidth - 14, pageHeight - 14);
      } else if (config.templateType === 'academic_beige') {
          // Soft Yellow Page & Forest Green Border
          doc.setFillColor(255, 253, 246); // Warm beige page fill
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          doc.setDrawColor(12, 74, 62); // Green forest border
          doc.setLineWidth(1.5);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      } else if (config.templateType === 'ph_deped') {
          // Simple single black border
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.5);
          doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
      } else if (config.templateType === 'us_academy') {
          // Soft cyan/teal outline
          doc.setDrawColor(0, 150, 136);
          doc.setLineWidth(1.2);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          doc.setDrawColor(0, 150, 136, 0.2);
          doc.setLineWidth(0.3);
          doc.rect(7, 7, pageWidth - 14, pageHeight - 14);
      } else if (config.templateType === 'official') {
          // Ricks Institute Replica Style: Double Border Frameline
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.8);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          doc.setLineWidth(0.2);
          doc.rect(7, 7, pageWidth - 14, pageHeight - 14);
      } else {
          doc.setDrawColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]); 
          doc.setLineWidth(1);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
          doc.setLineWidth(0.3);
          doc.rect(7, 7, pageWidth - 14, pageHeight - 14);
      }

      let currentY = 15;
      let sections = config.layoutOrder || ['header', 'bio', 'grades', 'custom', 'stats', 'scale', 'signatures', 'footer'];
      if (!sections.includes('bio')) {
        const headerIdx = sections.indexOf('header');
        if (headerIdx !== -1) {
          sections = [...sections.slice(0, headerIdx + 1), 'bio', ...sections.slice(headerIdx + 1)];
        } else {
          sections = ['bio', ...sections];
        }
      }

      sections.forEach((section: string) => {
        if (section === 'header') {
            if (config.templateType === 'official') {
              if (config.logoUrl) {
                try {
                  doc.addImage(config.logoUrl, getImageFormat(config.logoUrl), 15, currentY + 2, 20, 20);
                } catch (e) {
                  console.error("Failed to add custom logo to official template:", e);
                  const initials = (config.officialName || schoolDetails?.name || schoolName)
                    .split(' ')
                    .map((w: string) => w[0])
                    .join('')
                    .substring(0, 3)
                    .toUpperCase();
                  doc.setDrawColor(0, 32, 91);
                  doc.setLineWidth(0.3);
                  doc.circle(25, currentY + 12, 10);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(4.5);
                  doc.setTextColor(0, 32, 91);
                  doc.text(initials, 25, currentY + 9, { align: 'center' });
                  doc.text('ESTD', 25, currentY + 12, { align: 'center' });
                  doc.text('LIBERIA', 25, currentY + 15, { align: 'center' });
                }
              } else if (config.showSeal) {
                // Dynamic Registrar seal stamp (Left)
                const initials = (config.officialName || schoolDetails?.name || schoolName)
                  .split(' ')
                  .map((w: string) => w[0])
                  .join('')
                  .substring(0, 3)
                  .toUpperCase();
                doc.setDrawColor(0, 32, 91);
                doc.setLineWidth(0.3);
                doc.circle(25, currentY + 12, 10);
                doc.setFont('times', 'bold');
                doc.setFontSize(4.5);
                doc.setTextColor(0, 32, 91);
                doc.text(initials, 25, currentY + 9, { align: 'center' });
                doc.text('ESTD', 25, currentY + 12, { align: 'center' });
                doc.text('LIBERIA', 25, currentY + 15, { align: 'center' });
              }

              doc.setFont('times', 'italic');
              doc.setFontSize(8);
              doc.setTextColor(0, 32, 91);
              doc.text('Office of the Registrar', 15, currentY + 26);

              // Gold motto (Right)
              doc.setFont('times', 'italic');
              doc.setTextColor(223, 133, 23);
              doc.setFontSize(7.5);
              doc.text(schoolDetails?.motto || 'Leading the way in Education', pageWidth - 15, currentY + 6, { align: 'right' });

              // Centered Headers (Serif)
              doc.setTextColor(0, 0, 0);
              doc.setFont('times', 'bold');
              doc.setFontSize(15);
              doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), pageWidth / 2, currentY + 14, { align: 'center' });
              doc.setFontSize(10);
              doc.text((schoolDetails?.address || 'LIBERIA').toUpperCase(), pageWidth / 2, currentY + 20, { align: 'center' });
              
              doc.setFontSize(11);
              doc.text('OFFICIAL STUDENT REPORT CARD', pageWidth / 2, currentY + 28, { align: 'center' });
              currentY += 36;
            } else if (config.templateType === 'simple_grid') {
              if (config.logoUrl) {
                try {
                  doc.addImage(config.logoUrl, getImageFormat(config.logoUrl), 15, currentY, 20, 20);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(20);
                  doc.setTextColor(100, 116, 139); // Clean gray-blue
                  doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), 40, currentY + 7);
                  doc.setFontSize(13);
                  doc.setTextColor(148, 163, 184);
                  doc.text("REPORT CARD", 40, currentY + 15);
                  currentY += 24;
                } catch (e) {
                  console.error("Failed to add custom logo to simple_grid:", e);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(26);
                  doc.setTextColor(100, 116, 139); // Clean gray-blue
                  doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), pageWidth / 2, currentY + 12, { align: 'center' });
                  doc.setFontSize(15);
                  doc.setTextColor(148, 163, 184);
                  doc.text("REPORT CARD", pageWidth / 2, currentY + 22, { align: 'center' });
                  currentY += 32;
                }
              } else {
                doc.setFont('times', 'bold');
                doc.setFontSize(26);
                doc.setTextColor(100, 116, 139); // Clean gray-blue
                doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), pageWidth / 2, currentY + 12, { align: 'center' });
                doc.setFontSize(15);
                doc.setTextColor(148, 163, 184);
                doc.text("REPORT CARD", pageWidth / 2, currentY + 22, { align: 'center' });
                currentY += 32;
              }
            } else if (config.templateType === 'academic_beige') {
              if (config.logoUrl) {
                try {
                  doc.addImage(config.logoUrl, getImageFormat(config.logoUrl), 15, currentY, 22, 22);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(20);
                  doc.setTextColor(12, 74, 62); // Forest green
                  doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), 42, currentY + 6);
                  doc.setFontSize(14);
                  doc.setTextColor(12, 74, 62, 0.8);
                  doc.text("REPORT CARD", 42, currentY + 13);
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(9);
                  doc.setTextColor(0, 0, 0);
                  doc.text((schoolDetails?.address || 'LIBERIA').toUpperCase(), 42, currentY + 19);
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(8);
                  doc.text("Official Student Report Card", 42, currentY + 23);
                  currentY += 28;
                } catch (e) {
                  console.error("Failed to add custom logo to academic_beige:", e);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(26);
                  doc.setTextColor(12, 74, 62); // Forest green
                  doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), pageWidth / 2, currentY + 10, { align: 'center' });
                  doc.setFontSize(18);
                  doc.setTextColor(12, 74, 62, 0.8);
                  doc.text("REPORT CARD", pageWidth / 2, currentY + 18, { align: 'center' });
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(10);
                  doc.setTextColor(0, 0, 0);
                  doc.text((schoolDetails?.address || 'LIBERIA').toUpperCase(), pageWidth / 2, currentY + 26, { align: 'center' });
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(8);
                  doc.text("Official Student Report Card", pageWidth / 2, currentY + 31, { align: 'center' });
                  currentY += 38;
                }
              } else {
                doc.setFont('times', 'bold');
                doc.setFontSize(26);
                doc.setTextColor(12, 74, 62); // Forest green
                doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), pageWidth / 2, currentY + 10, { align: 'center' });
                doc.setFontSize(18);
                doc.setTextColor(12, 74, 62, 0.8);
                doc.text("REPORT CARD", pageWidth / 2, currentY + 18, { align: 'center' });
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                doc.text((schoolDetails?.address || 'LIBERIA').toUpperCase(), pageWidth / 2, currentY + 26, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.text("Official Student Report Card", pageWidth / 2, currentY + 31, { align: 'center' });
                currentY += 38;
              }
            } else if (config.templateType === 'ph_deped') {
              if (config.logoUrl) {
                try {
                  doc.addImage(config.logoUrl, getImageFormat(config.logoUrl), 15, currentY, 20, 20);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(14);
                  doc.setTextColor(0, 0, 0);
                  doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), 40, currentY + 5);
                  doc.setFont('times', 'normal');
                  doc.setFontSize(10);
                  doc.text((schoolDetails?.address || 'LIBERIA').toUpperCase(), 40, currentY + 10);
                  doc.setFontSize(11);
                  doc.setFont('times', 'bold');
                  doc.text("Senior High School Report Card", 40, currentY + 16);
                  doc.setFont('times', 'normal');
                  doc.setFontSize(9);
                  doc.text("School Year : 2025 - 2026", 40, currentY + 21);
                  currentY += 26;
                } catch (e) {
                  console.error("Failed to add custom logo to ph_deped:", e);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(16);
                  doc.setTextColor(0, 0, 0);
                  doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), pageWidth / 2, currentY + 6, { align: 'center' });
                  doc.setFont('times', 'normal');
                  doc.setFontSize(11);
                  doc.text((schoolDetails?.address || 'LIBERIA').toUpperCase(), pageWidth / 2, currentY + 12, { align: 'center' });
                  doc.setFontSize(12);
                  doc.setFont('times', 'bold');
                  doc.text("Senior High School Report Card", pageWidth / 2, currentY + 20, { align: 'center' });
                  doc.setFont('times', 'normal');
                  doc.setFontSize(10);
                  doc.text("School Year : 2025 - 2026", pageWidth / 2, currentY + 26, { align: 'center' });
                  currentY += 32;
                }
              } else {
                doc.setFont('times', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(0, 0, 0);
                doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), pageWidth / 2, currentY + 6, { align: 'center' });
                doc.setFont('times', 'normal');
                doc.setFontSize(11);
                doc.text((schoolDetails?.address || 'LIBERIA').toUpperCase(), pageWidth / 2, currentY + 12, { align: 'center' });
                doc.setFontSize(12);
                doc.setFont('times', 'bold');
                doc.text("Senior High School Report Card", pageWidth / 2, currentY + 20, { align: 'center' });
                doc.setFont('times', 'normal');
                doc.setFontSize(10);
                doc.text("School Year : 2025 - 2026", pageWidth / 2, currentY + 26, { align: 'center' });
                currentY += 32;
              }
            } else if (config.templateType === 'us_academy') {
              if (config.logoUrl) {
                try {
                  doc.addImage(config.logoUrl, getImageFormat(config.logoUrl), 15, currentY, 20, 20);
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(16);
                  doc.setTextColor(30, 41, 59);
                  doc.text(config.officialName || schoolDetails?.name || schoolName, 42, currentY + 6);
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(8.5);
                  doc.text(schoolDetails?.address || 'LIBERIA', 42, currentY + 11);
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(10);
                  doc.text("Quarter 4", 42, currentY + 18);
                  currentY += 24;
                } catch (e) {
                  console.error("Failed to add custom logo to us_academy:", e);
                  // standard circular seal
                  doc.setDrawColor(0, 150, 136);
                  doc.setLineWidth(0.8);
                  doc.circle(28, currentY + 12, 10);
                  doc.line(28, currentY + 2, 28, currentY + 22);
                  doc.line(18, currentY + 12, 38, currentY + 12);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(5);
                  doc.setTextColor(0, 150, 136);
                  const initials = (config.officialName || schoolDetails?.name || schoolName)
                     .split(' ')
                     .map((w: string) => w[0])
                     .join('')
                     .substring(0, 3)
                     .toUpperCase();
                  doc.text(initials, 28, currentY + 12, { align: 'center' });
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(16);
                  doc.setTextColor(30, 41, 59);
                  doc.text(config.officialName || schoolDetails?.name || schoolName, 42, currentY + 8);
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(8.5);
                  doc.text(schoolDetails?.address || 'LIBERIA', 42, currentY + 13);
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(10);
                  doc.text("Quarter 4", 42, currentY + 20);
                  currentY += 28;
                }
              } else {
                if (config.showSeal) {
                  const initials = (config.officialName || schoolDetails?.name || schoolName)
                     .split(' ')
                     .map((w: string) => w[0])
                     .join('')
                     .substring(0, 3)
                     .toUpperCase();

                  doc.setDrawColor(0, 150, 136);
                  doc.setLineWidth(0.8);
                  doc.circle(28, currentY + 12, 10);
                  doc.line(28, currentY + 2, 28, currentY + 22);
                  doc.line(18, currentY + 12, 38, currentY + 12);
                  doc.setFont('times', 'bold');
                  doc.setFontSize(5);
                  doc.setTextColor(0, 150, 136);
                  doc.text(initials, 28, currentY + 12, { align: 'center' });
                }

                // School Name and Info (Right / Centered)
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(30, 41, 59);
                doc.text(config.officialName || schoolDetails?.name || schoolName, 42, currentY + 8);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.text(schoolDetails?.address || 'LIBERIA', 42, currentY + 13);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text("Quarter 4", 42, currentY + 20);
                currentY += 28;
              }
            } else if (config.templateType === 'vibrant') {
              doc.setFillColor(primaryRGB[0], primaryRGB[1], primaryRGB[2]);
              doc.rect(15, currentY - 5, pageWidth - 30, 42, 'F');
              
              if (config.logoUrl) {
                try {
                  doc.addImage(config.logoUrl, getImageFormat(config.logoUrl), 20, currentY, 28, 28);
                  doc.setTextColor(255, 255, 255);
                  let textY = currentY + 4;
                  if (config.showMinistryHeader) {
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'bold');
                    doc.text('REPUBLIC OF LIBERIA • MINISTRY OF EDUCATION', 54, textY);
                    textY += 6;
                  }
                  
                  doc.setFontSize(15);
                  doc.setFont('helvetica', 'bold');
                  doc.text((config.officialName || schoolName).toUpperCase(), 54, textY + 4);
                  
                  doc.setFontSize(8);
                  doc.setFont('helvetica', 'normal');
                  doc.text('OFFICIAL STUDENT PROGRESS REPORT CARD', 54, textY + 10);
                  
                  // motto
                  const mottoText = schoolDetails?.motto || config.customFooter || 'Leading the way in Education';
                  doc.setFontSize(7);
                  doc.setFont('helvetica', 'italic');
                  doc.text(`"${mottoText}"`, 54, textY + 14);
                  
                  currentY += 37;
                } catch (e) {
                  console.error("Failed to add custom logo to vibrant header:", e);
                  // fallback to standard centered vibrant header
                  doc.setTextColor(255, 255, 255);
                  let tempY = currentY;
                  if (config.showMinistryHeader) {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.text('REPUBLIC OF LIBERIA • MINISTRY OF EDUCATION', pageWidth / 2, tempY, { align: 'center' });
                    tempY += 6;
                  }
                  doc.setFontSize(18);
                  doc.setFont('helvetica', 'bold');
                  doc.text((config.officialName || schoolName).toUpperCase(), pageWidth / 2, tempY + 6, { align: 'center' });
                  doc.setFontSize(8);
                  doc.setFont('helvetica', 'normal');
                  doc.text('OFFICIAL STUDENT PROGRESS REPORT CARD', pageWidth / 2, tempY + 14, { align: 'center' });
                  currentY += 37;
                }
              } else {
                doc.setTextColor(255, 255, 255);
                if (config.showMinistryHeader) {
                  doc.setFontSize(8);
                  doc.setFont('helvetica', 'bold');
                  doc.text('REPUBLIC OF LIBERIA • MINISTRY OF EDUCATION', pageWidth / 2, currentY, { align: 'center' });
                  currentY += 6;
                }
                
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text((config.officialName || schoolName).toUpperCase(), pageWidth / 2, currentY + 6, { align: 'center' });
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text('OFFICIAL STUDENT PROGRESS REPORT CARD', pageWidth / 2, currentY + 14, { align: 'center' });
                currentY += 25;
              }
            } else {
                if (config.logoUrl) {
                  try {
                    doc.addImage(config.logoUrl, getImageFormat(config.logoUrl), 15, currentY, 24, 24);
                    
                    doc.setTextColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
                    const totalHeaderHeight = config.showMinistryHeader ? 22 : 12;
                    let textY = currentY + ((24 - totalHeaderHeight) / 2) + 2;
                    
                    if (config.showMinistryHeader) {
                      doc.setFontSize(config.templateType === 'playful' ? 9.5 : 10.5);
                      doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                      doc.text('REPUBLIC OF LIBERIA', 44, textY);
                      doc.setFontSize(7);
                      doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
                      doc.text('MINISTRY OF EDUCATION - ACADEMIC DIVISION', 44, textY + 5);
                      textY += 10;
                    }
                    
                    doc.setFontSize(config.templateType === 'modern' ? 15 : 12.5);
                    doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                    doc.text((config.officialName || schoolName).toUpperCase(), 44, textY + 2);
                    
                    doc.setFontSize(8);
                    doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                    doc.text('OFFICIAL STUDENT PROGRESS REPORT CARD', 44, textY + 7);
                    
                    // Motto
                    const mottoText = schoolDetails?.motto || config.customFooter || 'Leading the way in Education';
                    doc.setFontSize(7);
                    doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'italic');
                    doc.text(`"${mottoText}"`, 44, textY + 12);
                    
                    currentY += 28;
                  } catch (e) {
                    console.error("Failed to add custom logo to standard header:", e);
                    // Fallback to centered official circular seal
                    doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
                    doc.setLineWidth(0.5);
                    doc.circle(pageWidth / 2, currentY + 5, 12);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.text('OFFICIAL', pageWidth / 2, currentY + 4, { align: 'center' });
                    doc.text('SEAL', pageWidth / 2, currentY + 8, { align: 'center' });
                    currentY += 25;
                    
                    doc.setTextColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
                    if (config.showMinistryHeader) {
                      doc.setFontSize(config.templateType === 'playful' ? 14 : 16);
                      doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                      doc.text('REPUBLIC OF LIBERIA', pageWidth / 2, currentY, { align: 'center' });
                      doc.setFontSize(9);
                      doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
                      doc.text('MINISTRY OF EDUCATION - ACADEMIC DIVISION', pageWidth / 2, currentY + 10, { align: 'center' });
                      currentY += 15;
                    }
                    
                    doc.setFontSize(config.templateType === 'modern' ? 22 : 14);
                    doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                    doc.text((config.officialName || schoolName).toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
                    
                    doc.setFontSize(9);
                    doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                    doc.text('OFFICIAL STUDENT PROGRESS REPORT CARD', pageWidth / 2, currentY + 8, { align: 'center' });
                    currentY += 20;
                  }
                } else {
                  if (config.showSeal) {
                    doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
                    doc.setLineWidth(0.5);
                    if (config.templateType === 'playful') {
                      doc.setLineWidth(0.8);
                      doc.circle(pageWidth / 2, currentY + 6, 12);
                      doc.setFontSize(8);
                      doc.setFont('times', 'bold');
                      doc.text('HERITAGE', pageWidth / 2, currentY + 5, { align: 'center' });
                      doc.text('⚜', pageWidth / 2, currentY + 10, { align: 'center' });
                    } else {
                      doc.circle(pageWidth / 2, currentY + 5, 12);
                      doc.setFontSize(8);
                      doc.setFont('helvetica', 'bold');
                      doc.text('OFFICIAL', pageWidth / 2, currentY + 4, { align: 'center' });
                      doc.text('SEAL', pageWidth / 2, currentY + 8, { align: 'center' });
                    }
                    currentY += 25;
                  }
                  
                  doc.setTextColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
                  if (config.showMinistryHeader) {
                    doc.setFontSize(config.templateType === 'playful' ? 14 : 16);
                    doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                    doc.text('REPUBLIC OF LIBERIA', pageWidth / 2, currentY, { align: 'center' });
                    doc.setFontSize(9);
                    doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
                    doc.text('MINISTRY OF EDUCATION - ACADEMIC DIVISION', pageWidth / 2, currentY + 10, { align: 'center' });
                    currentY += 15;
                  }
                  
                  doc.setFontSize(config.templateType === 'modern' ? 22 : 14);
                  doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                  doc.text((config.officialName || schoolName).toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
                  
                  doc.setFontSize(9);
                  doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                  doc.text('OFFICIAL STUDENT PROGRESS REPORT CARD', pageWidth / 2, currentY + 8, { align: 'center' });
                  currentY += 20;
                }
            }
        }
        if (section === 'bio') {
           if (config.templateType === 'official') {
             // Ricks Institute serif metadata layout
             doc.setFont('times', 'normal');
             doc.setFontSize(9.5);
             doc.setTextColor(0, 0, 0);
             doc.text(`Name: ${studentName.toUpperCase()}`, 15, currentY);
             doc.text(`Grade / Class: ${classroomName.toUpperCase()}`, 15, currentY + 6);
             
             if (config.showStudentID) {
               doc.text(`Student ID: ${studentId.substring(0, 10).toUpperCase()}`, pageWidth - 15, currentY, { align: 'right' });
             }
              if (config.showStudentRank) {
                doc.text(`Class Rank: ${rankData.classRank.toUpperCase()}`, pageWidth - 15, currentY + 6, { align: 'right' });
              }
             currentY += 14;
             
             // Divider: ACADEMIC RECORDS
             doc.setDrawColor(0, 0, 0);
             doc.setLineWidth(0.8);
             doc.line(15, currentY, pageWidth - 15, currentY);
             doc.setFont('times', 'bold');
             doc.setFontSize(8.5);
             doc.text('ACADEMIC RECORDS', 15, currentY - 2);
             currentY += 6;
             
             doc.setFont('times', 'normal');
             doc.text('Enrolled Date: 2022/2023', 15, currentY);
             currentY += 12;
           } else if (config.templateType === 'ph_deped') {
              // Diaz College metadata
              doc.setFont('times', 'normal');
              doc.setFontSize(9.5);
              doc.setTextColor(0, 0, 0);
              doc.text(`Name: ${studentName.toUpperCase()}`, 15, currentY);
              doc.text(`Grade / Class: ${classroomName.toUpperCase()}`, 15, currentY + 6);
              
              if (config.showStudentID) {
                doc.text(`LRN: LRN-${studentId.substring(0, 7).toUpperCase()}`, pageWidth - 15, currentY, { align: 'right' });
              } else {
                doc.text(`Sex: N/A`, pageWidth - 15, currentY, { align: 'right' });
              }
               if (config.showStudentRank) {
                 doc.text(`Class Rank: ${rankData.classRank.toUpperCase()}`, pageWidth - 15, currentY + 6, { align: 'right' });
              } else {
                doc.text(`Track: ACADEMIC`, pageWidth - 15, currentY + 6, { align: 'right' });
              }
              currentY += 14;
              
              doc.setFont('times', 'bold');
              doc.text("FIRST SEMESTER", 15, currentY);
              currentY += 5;
           } else if (config.templateType === 'academic_beige') {
             // Simple High School 2-column layout
             doc.setFont('helvetica', 'normal');
             doc.setFontSize(9.5);
             doc.setTextColor(30, 41, 59);
             doc.text(`Student Name: ${studentName}`, 20, currentY);
             doc.text(`Grade / Class: ${classroomName}`, 20, currentY + 6);
             
             if (config.showStudentID) {
               doc.text(`Student ID: SHS-${studentId.substring(0, 10).toUpperCase()}`, pageWidth - 20, currentY, { align: 'right' });
             } else {
               doc.text(`Reporting Period: Fall Semester 2025`, pageWidth - 20, currentY, { align: 'right' });
             }
              if (config.showStudentRank) {
                doc.text(`Class Rank: ${rankData.classRank}`, pageWidth - 20, currentY + 6, { align: 'right' });
              } else {
               doc.text(`Reporting Period: Fall Semester 2025`, pageWidth - 20, currentY + 6, { align: 'right' });
             }
             currentY += 16;
           } else if (config.templateType === 'us_academy') {
              // Ash Tree metadata
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              doc.setTextColor(0, 0, 0);
              doc.text("Student:", 15, currentY);
              doc.setFont('helvetica', 'bold');
              doc.text(studentName, 15, currentY + 5);
              doc.setFont('helvetica', 'normal');
              if (config.showStudentID) {
                doc.text(`Student ID: ${studentId.substring(0, 10).toUpperCase()}`, 15, currentY + 10);
              } else {
                doc.text(schoolDetails?.address || "Address: Liberia", 15, currentY + 10);
              }

              doc.text("Grade / Class:", pageWidth / 2 + 20, currentY);
              doc.setFont('helvetica', 'bold');
              doc.text(classroomName, pageWidth / 2 + 20, currentY + 5);
              doc.setFont('helvetica', 'normal');
               if (config.showStudentRank) {
                 doc.text(`Class Rank: ${rankData.classRank}`, pageWidth / 2 + 20, currentY + 10);
              } else {
                doc.text(`Teacher: ${config.teacherTitle || 'Class Teacher'}`, pageWidth / 2 + 20, currentY + 10);
              }
              doc.text("Term: 2025/2026", pageWidth / 2 + 20, currentY + 15);
              currentY += 24;
           } else {
              const customFieldCount = config.customFields?.length || 0;
              const bioHeight = 36 + (Math.ceil(customFieldCount / 2) * 8);
              
              if (config.templateType === 'playful') {
                doc.setFillColor(255, 255, 255);
                doc.rect(15, currentY, pageWidth - 30, bioHeight, 'F');
                doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
                doc.setLineWidth(0.8);
                doc.rect(15, currentY, pageWidth - 30, bioHeight);
              } else {
                doc.setFillColor(248, 250, 252);
                doc.rect(15, currentY, pageWidth - 30, bioHeight, 'F');
                doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
                doc.setLineWidth(0.5);
                doc.line(15, currentY, 15, currentY + bioHeight);
              }

              doc.setTextColor(30, 41, 59);
              doc.setFontSize(9);
              doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
              doc.text('NAME:', 20, currentY + 10);
              doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
              doc.text(studentName.toUpperCase(), 65, currentY + 10);
              
              doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
              doc.text('GRADE / CLASS:', 20, currentY + 17);
              doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
              doc.text(classroomName.toUpperCase(), 65, currentY + 17);
              
              if (config.showStudentID) {
                doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
                doc.text('STUDENT ID:', 20, currentY + 24);
                doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                doc.text(studentId.substring(0, 10).toUpperCase(), 65, currentY + 24);
              }

              if (config.showStudentRank) {
                doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
                doc.text('CLASS RANK:', 20, currentY + 31);
                doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                doc.text(rankData.classRank.toUpperCase(), 65, currentY + 31);
                doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
                doc.text('SCHOOL RANK:', pageWidth / 2 + 20, currentY + 31);
                doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
                doc.text(rankData.schoolRank.toUpperCase(), pageWidth / 2 + 20, currentY + 36);
              }
              
              currentY += bioHeight + 15;
           }
        }

        if (section === 'grades') {
          // 1. Define Column Headers for Liberian 6-Period & 2-Exam High School System
          const tableHeaders = ['SUBJECT', '1st', '2nd', '3rd', 'SEM1 EX', 'SEM1 AV', '4th', '5th', '6th', 'SEM2 EX', 'SEM2 AV', 'YRLY AV', 'GRD'];

          // 2. Map Rows
          const tableRows = pivotedList.map(p => {
            const s1 = getSemAvg(p.scores, 1);
            const s2 = getSemAvg(p.scores, 2);
            const yAvg = getYearAvg(p.scores);
            
            return [
              p.subject.toUpperCase(),
              p.scores['p1'] !== undefined ? p.scores['p1'].toString() : '-',
              p.scores['p2'] !== undefined ? p.scores['p2'].toString() : '-',
              p.scores['p3'] !== undefined ? p.scores['p3'].toString() : '-',
              p.scores['e1'] !== undefined ? p.scores['e1'].toString() : '-',
              s1 !== undefined ? `${s1}%` : '-',
              p.scores['p4'] !== undefined ? p.scores['p4'].toString() : '-',
              p.scores['p5'] !== undefined ? p.scores['p5'].toString() : '-',
              p.scores['p6'] !== undefined ? p.scores['p6'].toString() : '-',
              p.scores['e2'] !== undefined ? p.scores['e2'].toString() : '-',
              s2 !== undefined ? `${s2}%` : '-',
              yAvg !== undefined ? `${yAvg}%` : '-',
              yAvg !== undefined ? getLetterGrade(yAvg) : '-'
            ];
          });

          // Calculate overall averages for each column
          const colSums = { p1: 0, p2: 0, p3: 0, e1: 0, p4: 0, p5: 0, p6: 0, e2: 0 };
          const colCounts = { p1: 0, p2: 0, p3: 0, e1: 0, p4: 0, p5: 0, p6: 0, e2: 0 };

          pivotedList.forEach(p => {
            const keys = ['p1', 'p2', 'p3', 'e1', 'p4', 'p5', 'p6', 'e2'] as const;
            keys.forEach(k => {
              if (p.scores[k] !== undefined) {
                colSums[k] += p.scores[k];
                colCounts[k] += 1;
              }
            });
          });

          const colAvgs = {
            p1: colCounts.p1 > 0 ? Math.round(colSums.p1 / colCounts.p1) : undefined,
            p2: colCounts.p2 > 0 ? Math.round(colSums.p2 / colCounts.p2) : undefined,
            p3: colCounts.p3 > 0 ? Math.round(colSums.p3 / colCounts.p3) : undefined,
            e1: colCounts.e1 > 0 ? Math.round(colSums.e1 / colCounts.e1) : undefined,
            p4: colCounts.p4 > 0 ? Math.round(colSums.p4 / colCounts.p4) : undefined,
            p5: colCounts.p5 > 0 ? Math.round(colSums.p5 / colCounts.p5) : undefined,
            p6: colCounts.p6 > 0 ? Math.round(colSums.p6 / colCounts.p6) : undefined,
            e2: colCounts.e2 > 0 ? Math.round(colSums.e2 / colCounts.e2) : undefined,
          };

          const sem1Scores = [colAvgs.p1, colAvgs.p2, colAvgs.p3, colAvgs.e1].filter((s): s is number => s !== undefined);
          const s1Avg = sem1Scores.length > 0 ? Math.round(sem1Scores.reduce((a, b) => a + b, 0) / sem1Scores.length) : undefined;

          const sem2Scores = [colAvgs.p4, colAvgs.p5, colAvgs.p6, colAvgs.e2].filter((s): s is number => s !== undefined);
          const s2Avg = sem2Scores.length > 0 ? Math.round(sem2Scores.reduce((a, b) => a + b, 0) / sem2Scores.length) : undefined;

          const yAvgScores = [s1Avg, s2Avg].filter((s): s is number => s !== undefined);
          const overallYAvg = yAvgScores.length > 0 ? Math.round(yAvgScores.reduce((a, b) => a + b, 0) / yAvgScores.length) : undefined;

          tableRows.push([
            'CUMULATIVE AVERAGE',
            colAvgs.p1 !== undefined ? colAvgs.p1.toString() : '-',
            colAvgs.p2 !== undefined ? colAvgs.p2.toString() : '-',
            colAvgs.p3 !== undefined ? colAvgs.p3.toString() : '-',
            colAvgs.e1 !== undefined ? colAvgs.e1.toString() : '-',
            s1Avg !== undefined ? `${s1Avg}%` : '-',
            colAvgs.p4 !== undefined ? colAvgs.p4.toString() : '-',
            colAvgs.p5 !== undefined ? colAvgs.p5.toString() : '-',
            colAvgs.p6 !== undefined ? colAvgs.p6.toString() : '-',
            colAvgs.e2 !== undefined ? colAvgs.e2.toString() : '-',
            s2Avg !== undefined ? `${s2Avg}%` : '-',
            overallYAvg !== undefined ? `${overallYAvg}%` : '-',
            overallYAvg !== undefined ? getLetterGrade(overallYAvg) : '-'
          ]);

          // Determine styling variables based on config.templateType
          let headFillColor: [number, number, number] = [30, 41, 59]; // slate
          let headTextColor: [number, number, number] = [255, 255, 255];
          let tableTheme: 'grid' | 'striped' | 'plain' = 'grid';
          let fontType: 'times' | 'helvetica' = 'helvetica';
          let altRowFillColor: [number, number, number] = [248, 250, 252];
          let drawColor: [number, number, number] = [226, 232, 240];
          let borderWidth = 0.3;

          if (config.templateType === 'official') {
            headFillColor = [255, 255, 255];
            headTextColor = [0, 0, 0];
            tableTheme = 'grid';
            fontType = 'times';
            altRowFillColor = [255, 255, 255];
            drawColor = [0, 0, 0];
            borderWidth = 0.5;
          } else if (config.templateType === 'academic_beige') {
            headFillColor = [12, 74, 62]; // Forest Green
            headTextColor = [255, 255, 255];
            tableTheme = 'striped';
            altRowFillColor = [255, 253, 246]; // warm beige
            drawColor = [12, 74, 62];
            borderWidth = 0.2;
          } else if (config.templateType === 'us_academy') {
            headFillColor = [0, 150, 136]; // Teal
            headTextColor = [255, 255, 255];
            tableTheme = 'grid';
            drawColor = [0, 150, 136];
            borderWidth = 0.3;
          } else if (config.templateType === 'simple_grid') {
            headFillColor = [248, 250, 252];
            headTextColor = [71, 85, 105];
            tableTheme = 'grid';
            fontType = 'times';
            drawColor = [200, 200, 200];
            borderWidth = 0.3;
          } else if (config.templateType === 'minimal') {
            headFillColor = [255, 255, 255];
            headTextColor = [30, 41, 59];
            tableTheme = 'plain';
            drawColor = [255, 255, 255];
            borderWidth = 0;
          } else if (config.templateType === 'playful') {
            headFillColor = [30, 41, 59];
            headTextColor = [255, 255, 255];
            tableTheme = 'grid';
            fontType = 'times';
            altRowFillColor = [255, 254, 249];
            drawColor = [212, 163, 89];
            borderWidth = 0.4;
          } else if (config.templateType === 'vibrant') {
            headFillColor = primaryRGB;
            headTextColor = [255, 255, 255];
            tableTheme = 'striped';
            drawColor = secondaryRGB;
            borderWidth = 0.2;
          } else {
            headFillColor = [secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]];
            headTextColor = [255, 255, 255];
            tableTheme = 'striped';
          }

          autoTable(doc, {
            startY: currentY,
            head: [tableHeaders],
            body: tableRows,
            theme: tableTheme,
            headStyles: {
              fillColor: headFillColor,
              textColor: headTextColor,
              font: fontType,
              fontStyle: 'bold',
              fontSize: 7,
              lineWidth: borderWidth,
              lineColor: drawColor,
              halign: 'center',
              valign: 'middle'
            },
            bodyStyles: {
              font: fontType,
              fontSize: 6.5,
              textColor: [30, 41, 59],
              lineWidth: borderWidth,
              lineColor: drawColor
            },
            columnStyles: {
              0: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
              1: { cellWidth: 11, halign: 'center' },
              2: { cellWidth: 11, halign: 'center' },
              3: { cellWidth: 11, halign: 'center' },
              4: { cellWidth: 12, halign: 'center' },
              5: { cellWidth: 12, halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] },
              6: { cellWidth: 11, halign: 'center' },
              7: { cellWidth: 11, halign: 'center' },
              8: { cellWidth: 11, halign: 'center' },
              9: { cellWidth: 12, halign: 'center' },
              10: { cellWidth: 12, halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] },
              11: { cellWidth: 12, halign: 'center', fontStyle: 'bold', fillColor: [230, 230, 230] },
              12: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }
            },
            alternateRowStyles: {
              fillColor: altRowFillColor
            },
            didParseCell: function(data) {
              if (data.row.index === tableRows.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [241, 245, 249];
              }
            }
          });

          currentY = (doc as any).lastAutoTable.finalY + 12;
        }

        if (section === 'custom' && config.customFields && config.templateType !== 'official' && config.templateType !== 'ph_deped' && config.templateType !== 'simple_grid' && config.templateType !== 'academic_beige' && config.templateType !== 'us_academy') {
           doc.setFontSize(8);
           doc.setTextColor(100, 116, 139);
           config.customFields.forEach((field: any) => {
              doc.setFont('helvetica', 'normal');
              doc.text(`${field.label.toUpperCase()}:`, 20, currentY);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 41, 59);
              doc.text(field.value.toUpperCase(), 70, currentY);
              currentY += 7;
           });
           currentY += 10;
        }

        if (section === 'stats' && config.showSummaryBadge && config.templateType !== 'official' && config.templateType !== 'ph_deped' && config.templateType !== 'simple_grid' && config.templateType !== 'academic_beige' && config.templateType !== 'us_academy') {
           const avg = grades.length > 0 
             ? Math.round(grades.reduce((acc, g) => acc + calculatePercentage(g.score, g.maxScore), 0) / grades.length) 
             : 0;
           
           doc.setFillColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2], 0.05);
           doc.rect(15, currentY, pageWidth - 30, 20, 'F');
           if (config.templateType === 'playful') {
             doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
             doc.setLineWidth(0.5);
             doc.rect(15, currentY, pageWidth - 30, 20);
           }
           doc.setTextColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
           doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'bold');
           doc.setFontSize(10);
           doc.text(`CUMULATIVE AVERAGE: ${avg}%`, 25, currentY + 12);
           currentY += 30;
        }

        if (section === 'scale' && config.showGradingScale) {
           if (config.templateType === 'official') {
             doc.setFont('times', 'bold');
             doc.setFontSize(8.5);
             doc.setTextColor(0, 0, 0);
             doc.text('REPORT CARD GUIDE', 15, currentY);
             
             doc.setFont('times', 'normal');
             doc.setFontSize(7.5);
             const scaleText = config.gradingScale?.map((t: any) => `${t.label} = ${t.min}-${t.max}`).join(', ');
             doc.text(scaleText || 'A = 94-100 (Excellent), B = 85-93 (Good), C = 77-83 (Average), D = 70-76 (Poor), F = below 70', 15, currentY + 5);
             
             // Issued date
             const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YY format
             doc.text(`${today}`, pageWidth - 15, currentY, { align: 'right' });
             doc.setFont('times', 'bold');
             doc.text('Date Issue', pageWidth - 15, currentY + 5, { align: 'right' });
             currentY += 16;
           } else if (config.templateType === 'ph_deped') {
             doc.setFont('times', 'bold');
             doc.setFontSize(8.5);
             doc.setTextColor(0, 0, 0);
             doc.text('GRADING SCALE', 15, currentY);
             
             doc.setFont('times', 'normal');
             doc.setFontSize(7.5);
             const scaleText = config.gradingScale?.map((t: any) => `${t.label}: ${t.min}-${t.max}%`).join(' | ');
             doc.text(scaleText || 'A: 95-100 | B: 85-94 | C: 75-84 | D: 60-74 | F: Below 60', 15, currentY + 5);
             currentY += 14;
           } else if (config.templateType === 'academic_beige') {
             doc.setFont('helvetica', 'bold');
             doc.setFontSize(8.5);
             doc.setTextColor(12, 74, 62); // Forest green
             doc.text('GRADING SYSTEM & LEGEND', 20, currentY);
             
             doc.setFont('helvetica', 'normal');
             doc.setFontSize(7.5);
             doc.setTextColor(0, 0, 0);
             const scaleText = config.gradingScale?.map((t: any) => `${t.label}: ${t.min}-${t.max}%`).join('  |  ');
             doc.text(scaleText || '', 20, currentY + 5);
             currentY += 15;
           } else if (config.templateType === 'us_academy') {
             doc.setFont('helvetica', 'bold');
             doc.setFontSize(8);
             doc.setTextColor(0, 150, 136); // Teal
             doc.text('ACADEMIC GRADING KEY', 15, currentY);
             
             doc.setFont('helvetica', 'normal');
             doc.setFontSize(7.5);
             doc.setTextColor(30, 41, 59);
             const scaleText = config.gradingScale?.map((t: any) => `${t.label} (${t.min}-${t.max}%)`).join('   ');
             doc.text(scaleText || '', 15, currentY + 5);
             currentY += 15;
           } else if (config.templateType === 'simple_grid') {
             doc.setFont('times', 'bold');
             doc.setFontSize(8.5);
             doc.setTextColor(100, 116, 139); // Gray-blue
             doc.text('GRADING KEY', 20, currentY);
             
             doc.setFont('times', 'normal');
             doc.setFontSize(7.5);
             doc.setTextColor(71, 85, 105);
             const scaleText = config.gradingScale?.map((t: any) => `${t.label} = ${t.min}-${t.max}%`).join(', ');
             doc.text(scaleText || '', 20, currentY + 5);
             currentY += 15;
           } else {
             doc.setFontSize(7.5);
             doc.setTextColor(100, 116, 139);
             doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
             const scaleText = config.gradingScale?.map((t: any) => `${t.label}: ${t.min}-${t.max}%`).join(' | ');
             doc.text(`GRADING SYSTEM: ${scaleText}`, 20, currentY);
             currentY += 15;
           }
        }

        if (section === 'signatures' && config.showSignatures) {
           if (config.templateType === 'official') {
             // Dynamic Registrar seal stamps (FD circles with text inside)
             doc.setDrawColor(0, 32, 91, 0.1);
             doc.setFillColor(0, 32, 91, 0.05);
             doc.circle(45, currentY + 10, 14, 'FD');
             doc.setFont('times', 'bold');
             doc.setFontSize(5.5);
             doc.setTextColor(0, 32, 91);
             doc.text('Registrar Office', 45, currentY + 8, { align: 'center' });
             doc.text(schoolDetails?.address || 'Liberia', 45, currentY + 12, { align: 'center' });
             
             doc.circle(155, currentY + 10, 14, 'FD');
             doc.text('Principal Office', 155, currentY + 8, { align: 'center' });
             doc.text((config.officialName || schoolDetails?.name || schoolName).toUpperCase(), 155, currentY + 12, { align: 'center' });
             
             doc.setTextColor(0, 0, 0);
             doc.setFont('times', 'normal');
             doc.setFontSize(8.5);
             doc.line(20, currentY + 28, 80, currentY + 28);
             doc.line(130, currentY + 28, 190, currentY + 28);
             doc.text('Registrar', 50, currentY + 33, { align: 'center' });
             doc.text('Principal / Chief Administrative Officer', 160, currentY + 33, { align: 'center' });
             currentY += 38;
           } else if (config.templateType === 'ph_deped') {
             doc.setDrawColor(0, 0, 0);
             doc.setLineWidth(0.3);
             doc.line(20, currentY + 22, 80, currentY + 22);
             doc.line(130, currentY + 22, 190, currentY + 22);
             doc.setFont('times', 'bold');
             doc.setFontSize(8.5);
             doc.setTextColor(0, 0, 0);
             doc.text((config.teacherTitle || 'Adviser').toUpperCase(), 50, currentY + 26, { align: 'center' });
             doc.setFont('times', 'normal');
             doc.text("Class Adviser", 50, currentY + 30, { align: 'center' });

             doc.setFont('times', 'bold');
             doc.text((config.principalTitle || 'SHS Principal').toUpperCase(), 160, currentY + 26, { align: 'center' });
             doc.setFont('times', 'normal');
             doc.text("School Principal", 160, currentY + 30, { align: 'center' });
             currentY += 38;
           } else if (config.templateType === 'us_academy') {
             doc.setDrawColor(0, 0, 0);
             doc.setLineWidth(0.3);
             doc.line(15, currentY + 10, 80, currentY + 10);
             doc.setFont('helvetica', 'bold');
             doc.setFontSize(7.5);
             doc.setTextColor(30, 41, 59);
             doc.text("Homeroom Teacher's Signature:", 15, currentY + 14);
             doc.text("Date:", pageWidth - 90, currentY + 14);
             doc.line(pageWidth - 80, currentY + 10, pageWidth - 15, currentY + 10);

             doc.line(15, currentY + 24, 80, currentY + 24);
             doc.text("Principal's Signature:", 15, currentY + 28);
             doc.text("Date:", pageWidth - 90, currentY + 28);
             doc.line(pageWidth - 80, currentY + 24, pageWidth - 15, currentY + 24);

             doc.line(15, currentY + 38, 80, currentY + 38);
             doc.text("Parent's Signature:", 15, currentY + 42);
             doc.text("Date:", pageWidth - 90, currentY + 42);
             doc.line(pageWidth - 80, currentY + 38, pageWidth - 15, currentY + 38);
             currentY += 50;
           } else {
             if (config.templateType === 'playful') {
               // Registrar and Principal circular stamps for Heritage
               doc.setDrawColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2], 0.1);
               doc.setFillColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2], 0.03);
               doc.circle(45, currentY + 10, 14, 'FD');
               doc.setFont('times', 'bold');
               doc.setFontSize(5.5);
               doc.setTextColor(secondaryRGB[0], secondaryRGB[1], secondaryRGB[2]);
               doc.text('Registrar Office', 45, currentY + 8, { align: 'center' });
               doc.text('Academic Records', 45, currentY + 12, { align: 'center' });
               
               doc.circle(155, currentY + 10, 14, 'FD');
               doc.text('Principal Office', 155, currentY + 8, { align: 'center' });
               doc.text('Heritage Academy', 155, currentY + 12, { align: 'center' });
             }

             doc.setDrawColor(203, 213, 225);
             doc.setLineWidth(0.5);
             doc.line(20, currentY + 28, 80, currentY + 28);
             doc.line(130, currentY + 28, 190, currentY + 28);
             doc.setTextColor(30, 41, 59);
             doc.setFont(config.templateType === 'playful' ? 'times' : 'helvetica', 'normal');
             doc.setFontSize(8);
             doc.text(config.teacherTitle?.toUpperCase() || '', 20, currentY + 33);
             doc.text(config.principalTitle?.toUpperCase() || '', 130, currentY + 33);
             currentY += 38;
           }
        }

        if (section === 'footer' && config.templateType !== 'official' && config.templateType !== 'ph_deped' && config.templateType !== 'simple_grid' && config.templateType !== 'academic_beige' && config.templateType !== 'us_academy') {
           doc.setFontSize(7);
           doc.setTextColor(148, 163, 184);
           doc.text(config.customFooter || '', pageWidth / 2, pageHeight - 15, { align: 'center' });
        }
      });

      // Save PDF
      const fileName = `${studentName.replace(/\s+/g, '_')}_Academic_Report.pdf`;
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Error: " + (error instanceof Error ? error.message : "PDF Generation failed"));
    }
  };

  if (loading && !previewMode && !customConfig) return <div className="text-center py-10 text-slate-500 font-bold">Fetching your results...</div>;

  const config = customConfig || schoolConfig || {
    layoutOrder: ['header', 'bio', 'grades', 'custom', 'stats', 'scale', 'signatures', 'footer']
  };

  let sections = config.layoutOrder || ['header', 'bio', 'grades', 'custom', 'stats', 'scale', 'signatures', 'footer'];
  if (!sections.includes('bio')) {
    const headerIdx = sections.indexOf('header');
    if (headerIdx !== -1) {
      sections = [...sections.slice(0, headerIdx + 1), 'bio', ...sections.slice(headerIdx + 1)];
    } else {
      sections = ['bio', ...sections];
    }
  }

  const rankData = getRankData();

  if (previewMode) {
    const previewRows = getPivotedList().slice(0, 4);
    const previewRanks = getRankData();
    return (
      <div className="w-full max-w-5xl mx-auto rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="School Logo" className="h-16 w-16 shrink-0 rounded-2xl border bg-white object-contain p-1.5" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-slate-50 text-slate-300">
                <FileText className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {config.showMinistryHeader ? 'Republic of Liberia • Ministry of Education' : 'Report Card Preview'}
              </p>
              <h2 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-slate-900">
                {config.officialName || schoolDetails?.name || schoolName}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {schoolDetails?.motto || config.customFooter || 'Leading the way in Education'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Student</p>
                <p className="mt-1 truncate text-sm font-black text-slate-800">{studentName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class</p>
                <p className="mt-1 truncate text-sm font-black text-slate-800">{resolvedClassroomName}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</p>
                <p className="mt-1 text-sm font-black text-indigo-600">{previewRanks.classRank}</p>
              </div>
            </div>

            {activeGrades.length > 0 && (
              <button
                onClick={handleDownloadPDF}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition shadow-lg ${
                  config.templateType === 'vibrant' || config.templateType === 'academic_beige' || config.templateType === 'us_academy'
                    ? 'bg-white text-indigo-950 shadow-indigo-500/10 hover:bg-slate-100'
                    : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800'
                }`}
                type="button"
              >
                <Download className="h-4 w-4" />
                Download Gradesheet
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-4 sm:p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subjects</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{new Set(activeGrades.map(g => g.subject)).size}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Average</p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {activeGrades.length > 0 ? Math.round(activeGrades.reduce((acc, g) => acc + calculatePercentage(g.score, g.maxScore), 0) / activeGrades.length) : 0}%
            </p>
          </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Rank</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{previewRanks.classRank}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">School Rank</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{previewRanks.schoolRank}</p>
            </div>
        </div>

        <div className="border-t border-slate-100 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Recent Marks</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Preview only</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {previewRows.map((p) => {
              const s1 = getSemAvg(p.scores, 1);
              const s2 = getSemAvg(p.scores, 2);
              const year = getYearAvg(p.scores);
              return (
                <div key={p.subject} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject</p>
                      <p className="truncate text-sm font-black uppercase text-slate-800">{p.subject}</p>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${year !== undefined ? getGradeColor(year) : 'text-slate-400 bg-slate-50'}`}>
                      {year !== undefined ? getLetterGrade(year) : '-'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">Sem 1: {s1 !== undefined ? `${s1}%` : '-'}</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">Sem 2: {s2 !== undefined ? `${s2}%` : '-'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {config.showSignatures && (
          <div className="border-t border-slate-100 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex min-h-[120px] flex-col items-center justify-end rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center">
                {config.registrarSignatureUrl ? (
                  <img
                    src={config.registrarSignatureUrl}
                    alt="Registrar Signature"
                    className="mb-2 h-14 max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="mb-2 h-14" aria-hidden="true" />
                )}
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-800">
                    {config.teacherTitle || 'Class Teacher / Registrar'}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Academic Division
                  </p>
                </div>
              </div>

              <div className="flex min-h-[120px] flex-col items-center justify-end rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center">
                {config.principalSignatureUrl ? (
                  <img
                    src={config.principalSignatureUrl}
                    alt="Principal Signature"
                    className="mb-2 h-14 max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="mb-2 h-14" aria-hidden="true" />
                )}
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-800">
                    {config.principalTitle || 'Principal / Administrator'}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Office of the Principal
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section: string) => {
        const isSerif = config.templateType === 'official' || config.templateType === 'ph_deped' || config.templateType === 'playful';

        if (section === 'header') {
          const hasLogo = !!config.logoUrl;
          return (
            <div key="header" className={`py-6 border-b border-slate-100 animate-fade-in flex flex-col md:flex-row items-center md:items-start gap-6 ${hasLogo ? 'text-center md:text-left' : 'text-center justify-center'}`}>
              {hasLogo ? (
                <div className="flex-shrink-0">
                  <img src={config.logoUrl} alt="School Logo" className="w-24 h-24 object-contain rounded-xl border bg-white p-1 shadow-sm" />
                </div>
              ) : config.showSeal ? (
                <div className="flex justify-center mb-2">
                  <div className="w-20 h-20 rounded-full border-4 border-indigo-150 flex items-center justify-center bg-indigo-50 text-indigo-600 font-black text-xs uppercase shadow-sm">
                    {config.templateType === 'playful' ? '⚜' : 'Seal'}
                  </div>
                </div>
              ) : null}
              <div className={`flex-grow space-y-2 ${hasLogo ? '' : 'w-full'}`}>
                {config.showMinistryHeader && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Republic of Liberia &bull; Ministry of Education
                  </p>
                )}
                <h1 className={`text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight uppercase ${isSerif ? 'font-serif' : 'font-sans'}`}>
                  {config.officialName || schoolDetails?.name || schoolName}
                </h1>
                <p className={`text-xs text-slate-500 font-bold italic ${hasLogo ? '' : 'max-w-md mx-auto'}`}>
                  "{schoolDetails?.motto || config.customFooter || 'Leading the way in Education'}"
                </p>
              </div>
            </div>
          );
        }

        if (section === 'bio') return (
          <div key="bio" className={`p-6 border shadow-sm rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in ${
            config.templateType === 'minimal' ? 'rounded-none border-slate-200 shadow-none bg-white' :
            config.templateType === 'playful' ? 'rounded-xl border-double border-4 border-slate-200 bg-[#fffef9]' :
            config.templateType === 'academic_beige' ? 'rounded-xl border-[#0c4a3e]/30 bg-[#fffdf6] border' : 'bg-slate-50/50 border-slate-150/40 bg-slate-50'
          }`}>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Student Name</span>
              <span className="text-sm font-black text-slate-850 uppercase">{studentName}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Grade / Class</span>
              <span className="text-sm font-black text-slate-850 uppercase">{classroomName}</span>
            </div>
            {config.showStudentID && (
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Student ID</span>
                <span className="text-sm font-black text-slate-855 font-mono uppercase">{studentId.substring(0, 10).toUpperCase()}</span>
              </div>
            )}
            {config.showStudentRank && (
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Class Rank</span>
                <span className="text-sm font-black text-indigo-650 uppercase">{rankData.classRank}</span>
                <span className="mt-2 block text-[10px] font-black text-slate-400 uppercase tracking-widest">School Rank</span>
                <span className="text-sm font-black text-indigo-650 uppercase">{rankData.schoolRank}</span>
              </div>
            )}
          </div>
        );

        if (section === 'scale' && config.showGradingScale) return (
          <div key="scale" className={`p-6 border rounded-2xl animate-fade-in ${
            config.templateType === 'minimal' ? 'rounded-none border-slate-200 shadow-none bg-white' :
            config.templateType === 'playful' ? 'rounded-xl border-double border-4 border-slate-200 bg-[#fffef9]' :
            config.templateType === 'academic_beige' ? 'rounded-xl border-[#0c4a3e]/30 bg-[#fffdf6] border' : 'bg-white border-slate-100 shadow-sm'
          }`}>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4">Grading System & Key</h4>
            <div className="flex flex-wrap gap-3">
              {(config.gradingScale || [
                { label: 'A+', min: 95, max: 100 },
                { label: 'A', min: 90, max: 94 },
                { label: 'B+', min: 85, max: 89 },
                { label: 'B', min: 80, max: 84 },
                { label: 'C+', min: 75, max: 79 },
                { label: 'C', min: 70, max: 74 },
                { label: 'D', min: 60, max: 69 },
                { label: 'F', min: 0, max: 59 }
              ]).map((tier: any, idx: number) => (
                <div key={idx} className="px-3 py-1.5 bg-slate-50 border rounded-lg flex items-center gap-1.5 text-xs">
                  <span className="font-black text-slate-700 uppercase">{tier.label}:</span>
                  <span className="font-semibold text-slate-500 font-mono">{tier.min}-{tier.max}%</span>
                </div>
              ))}
            </div>
          </div>
        );

        if (section === 'signatures' && config.showSignatures) return (
          <div key="signatures" className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 animate-fade-in">
            {/* Registrar Signature */}
            <div className="flex flex-col items-center justify-end text-center min-h-[100px] border-t border-slate-200 pt-4">
              {config.registrarSignatureUrl ? (
                <img src={config.registrarSignatureUrl} alt="Registrar Signature" className="h-12 object-contain mb-2 max-w-[150px]" />
              ) : (
                <div className="h-12 mb-2" aria-hidden="true" />
              )}
              <span className="text-xs font-black text-slate-750 uppercase tracking-wider block">
                {config.teacherTitle || 'Class Teacher / Registrar'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Academic Division</span>
            </div>

            {/* Principal Signature */}
            <div className="flex flex-col items-center justify-end text-center min-h-[100px] border-t border-slate-200 pt-4">
              {config.principalSignatureUrl ? (
                <img src={config.principalSignatureUrl} alt="Principal Signature" className="h-12 object-contain mb-2 max-w-[150px]" />
              ) : (
                <div className="h-12 mb-2" aria-hidden="true" />
              )}
              <span className="text-xs font-black text-slate-750 uppercase tracking-wider block">
                {config.principalTitle || 'Principal / Administrator'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Office of the Principal</span>
            </div>
          </div>
        );

        if (section === 'footer') return (
          <div key="footer" className="text-center py-6 border-t border-slate-50 animate-fade-in">
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
              {config.customFooter || 'The Love of Liberty Brought Us Here'}
            </p>
          </div>
        );

        if (section === 'stats' && config.showSummaryBadge) return (
          <div key="stats" className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
            <div className={`p-6 flex items-center gap-4 transition-all duration-300 ${
              config.templateType === 'minimal' ? 'bg-white rounded-none border border-slate-200 shadow-none' :
              config.templateType === 'playful' ? 'bg-amber-50/5 border-double border-4 border-slate-200 rounded-xl shadow-sm' :
              config.templateType === 'vibrant' ? 'bg-white border border-indigo-50 shadow-lg rounded-2xl' : 'bg-white p-6 rounded-2xl shadow-sm border border-slate-100'
            }`}
            style={{
              backgroundColor: config.templateType === 'playful' ? '#fffef9' : '#ffffff'
            }}
            >
              <div className="bg-blue-100 p-3 rounded-xl"><GraduationCap className="text-blue-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Subjects</p>
                <p className="text-2xl font-black">{new Set(activeGrades.map(g => g.subject)).size}</p>
              </div>
            </div>
            <div className={`p-6 flex items-center gap-4 transition-all duration-300 ${
              config.templateType === 'minimal' ? 'bg-white rounded-none border border-slate-200 shadow-none' :
              config.templateType === 'playful' ? 'bg-amber-50/5 border-double border-4 border-slate-200 rounded-xl shadow-sm' :
              config.templateType === 'vibrant' ? 'bg-white border border-indigo-50 shadow-lg rounded-2xl' : 'bg-white p-6 rounded-2xl shadow-sm border border-slate-100'
            }`}
            style={{
              backgroundColor: config.templateType === 'playful' ? '#fffef9' : '#ffffff'
            }}
            >
              <div className="bg-purple-100 p-3 rounded-xl"><Award className="text-purple-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Average</p>
                <p className="text-2xl font-black">
                  {activeGrades.length > 0 
                    ? Math.round(activeGrades.reduce((acc, g) => acc + calculatePercentage(g.score, g.maxScore), 0) / activeGrades.length) 
                    : 0}%
                </p>
              </div>
            </div>
            <div className={`p-6 flex items-center gap-4 transition-all duration-300 ${
              config.templateType === 'minimal' ? 'bg-white rounded-none border border-slate-200 shadow-none' :
              config.templateType === 'playful' ? 'bg-amber-50/5 border-double border-4 border-slate-200 rounded-xl shadow-sm' :
              config.templateType === 'vibrant' ? 'bg-white border border-indigo-50 shadow-lg rounded-2xl' : 'bg-white p-6 rounded-2xl shadow-sm border border-slate-100'
            }`}
            style={{
              backgroundColor: config.templateType === 'playful' ? '#fffef9' : '#ffffff'
            }}
            >
              <div className="bg-emerald-100 p-3 rounded-xl"><TrendingUp className="text-emerald-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Rank</p>
                <p className="text-2xl font-black">{rankData.classRank}</p>
              </div>
            </div>
            <div className={`p-6 flex items-center gap-4 transition-all duration-300 ${
              config.templateType === 'minimal' ? 'bg-white rounded-none border border-slate-200 shadow-none' :
              config.templateType === 'playful' ? 'bg-amber-50/5 border-double border-4 border-slate-200 rounded-xl shadow-sm' :
              config.templateType === 'vibrant' ? 'bg-white border border-indigo-50 shadow-lg rounded-2xl' : 'bg-white p-6 rounded-2xl shadow-sm border border-slate-100'
            }`}
            style={{
              backgroundColor: config.templateType === 'playful' ? '#fffef9' : '#ffffff'
            }}
            >
              <div className="bg-slate-100 p-3 rounded-xl"><Award className="text-slate-600" /></div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">School Rank</p>
                <p className="text-2xl font-black">{rankData.schoolRank}</p>
              </div>
            </div>
          </div>
        );

        if (section === 'grades') return (
          <div key="grades" className={`bg-white shadow-md overflow-hidden animate-fade-in transition-all duration-300 ${
            config.templateType === 'minimal' ? 'border border-slate-200 rounded-none shadow-none' :
            config.templateType === 'playful' ? 'border-double border-4 border-slate-200 rounded-xl' :
            config.templateType === 'academic_beige' ? 'border-2 border-[#0c4a3e] rounded-xl' :
            config.templateType === 'us_academy' ? 'border border-[#009688] rounded-xl' :
            config.templateType === 'ph_deped' ? 'border border-black rounded-none shadow-none' :
            config.templateType === 'simple_grid' ? 'border border-slate-200 rounded-lg shadow-sm' :
            config.templateType === 'vibrant' ? 'border border-indigo-50 shadow-lg rounded-2xl' : 'rounded-2xl border border-slate-100'
          }`}
          style={{
            backgroundColor: config.templateType === 'playful' ? '#fffef9' : 
                            config.templateType === 'academic_beige' ? '#fffdf6' : '#ffffff'
          }}
          >
            <div 
              className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              style={{
                background: config.templateType === 'vibrant' ? `linear-gradient(to right, ${config.secondaryColor}, ${config.primaryColor})` : 
                            config.templateType === 'academic_beige' ? '#0c4a3e' :
                            config.templateType === 'us_academy' ? '#009688' : '',
                borderBottomColor: config.templateType === 'vibrant' ? 'transparent' : ''
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  config.templateType === 'vibrant' ? 'bg-white/20 text-white' : 
                  config.templateType === 'academic_beige' || config.templateType === 'us_academy' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-lg font-black tracking-tight ${
                    config.templateType === 'vibrant' || config.templateType === 'academic_beige' || config.templateType === 'us_academy' ? 'text-white' : 'text-slate-800'
                  } ${config.templateType === 'official' || config.templateType === 'ph_deped' ? 'font-serif' : ''}`}>Academic Performance Report</h3>
                  <p className={`text-xs font-medium ${
                    config.templateType === 'vibrant' || config.templateType === 'academic_beige' || config.templateType === 'us_academy' ? 'text-white/80' : 'text-slate-400'
                  }`}>Official grade sheet for {studentName}</p>
                </div>
              </div>

              {activeGrades.length > 0 && (
                <button
                  onClick={handleDownloadPDF}
                  className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition shadow-lg ${
                    config.templateType === 'vibrant' || config.templateType === 'academic_beige' || config.templateType === 'us_academy' ? 'bg-white text-indigo-950 shadow-indigo-500/10 hover:bg-slate-100' : 'bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-slate-200'
                  }`}
                  style={{
                    borderRadius: config.templateType === 'playful' ? '6px' : ''
                  }}
                >
                  <Download className="w-4 h-4" />
                  Download Gradesheet
                </button>
              )}
            </div>

            {activeGrades.length === 0 ? (
              <div className="py-20 text-center text-slate-400 font-bold">
                No grades have been uploaded for you yet.
              </div>
            ) : (
              (() => {
                const pivotedList = getPivotedList();

                // Compute column-level averages
                const colSums = { p1: 0, p2: 0, p3: 0, e1: 0, p4: 0, p5: 0, p6: 0, e2: 0 };
                const colCounts = { p1: 0, p2: 0, p3: 0, e1: 0, p4: 0, p5: 0, p6: 0, e2: 0 };

                pivotedList.forEach(p => {
                  const keys = ['p1', 'p2', 'p3', 'e1', 'p4', 'p5', 'p6', 'e2'] as const;
                  keys.forEach(k => {
                    if (p.scores[k] !== undefined) {
                      colSums[k] += p.scores[k];
                      colCounts[k] += 1;
                    }
                  });
                });

                const colAvgs = {
                  p1: colCounts.p1 > 0 ? Math.round(colSums.p1 / colCounts.p1) : undefined,
                  p2: colCounts.p2 > 0 ? Math.round(colSums.p2 / colCounts.p2) : undefined,
                  p3: colCounts.p3 > 0 ? Math.round(colSums.p3 / colCounts.p3) : undefined,
                  e1: colCounts.e1 > 0 ? Math.round(colSums.e1 / colCounts.e1) : undefined,
                  p4: colCounts.p4 > 0 ? Math.round(colSums.p4 / colCounts.p4) : undefined,
                  p5: colCounts.p5 > 0 ? Math.round(colSums.p5 / colCounts.p5) : undefined,
                  p6: colCounts.p6 > 0 ? Math.round(colSums.p6 / colCounts.p6) : undefined,
                  e2: colCounts.e2 > 0 ? Math.round(colSums.e2 / colCounts.e2) : undefined,
                };

                const sem1Scores = [colAvgs.p1, colAvgs.p2, colAvgs.p3, colAvgs.e1].filter((s): s is number => s !== undefined);
                const s1Avg = sem1Scores.length > 0 ? Math.round(sem1Scores.reduce((a, b) => a + b, 0) / sem1Scores.length) : undefined;

                const sem2Scores = [colAvgs.p4, colAvgs.p5, colAvgs.p6, colAvgs.e2].filter((s): s is number => s !== undefined);
                const s2Avg = sem2Scores.length > 0 ? Math.round(sem2Scores.reduce((a, b) => a + b, 0) / sem2Scores.length) : undefined;

                const yAvgScores = [s1Avg, s2Avg].filter((s): s is number => s !== undefined);
                const overallYAvg = yAvgScores.length > 0 ? Math.round(yAvgScores.reduce((a, b) => a + b, 0) / yAvgScores.length) : undefined;

                // Determine active template visual configurations for HTML elements
                const isSerif = config.templateType === 'official' || config.templateType === 'ph_deped' || config.templateType === 'playful';
                
                let thStyle: React.CSSProperties = {};
                let thClass = "p-3 font-bold text-center border text-[10px] tracking-wider uppercase ";
                let tdBorderClass = "border border-slate-200";
                let highlightCellClass = "bg-slate-50/80 font-black";
                let altRowBg = "bg-white";
                const defaultRowBg = "bg-white";

                if (config.templateType === 'official' || config.templateType === 'ph_deped') {
                  thClass += "bg-white text-slate-900 ";
                  tdBorderClass = "border border-black";
                  thStyle = { borderColor: '#000000' };
                  highlightCellClass = "bg-slate-100/60 font-black";
                } else if (config.templateType === 'academic_beige') {
                  thClass += "text-white ";
                  thStyle = { backgroundColor: '#0c4a3e', borderColor: '#0c4a3e' };
                  tdBorderClass = "border border-[#0c4a3e]/20";
                  highlightCellClass = "bg-[#0c4a3e]/5 font-black text-[#0c4a3e]";
                  altRowBg = "bg-[#fffdf6]";
                } else if (config.templateType === 'us_academy') {
                  thClass += "text-white ";
                  thStyle = { backgroundColor: '#009688', borderColor: '#009688' };
                  tdBorderClass = "border border-[#009688]/20";
                  highlightCellClass = "bg-[#009688]/5 font-black text-[#009688]";
                  altRowBg = "bg-white";
                } else if (config.templateType === 'simple_grid') {
                  thClass += "bg-slate-100 text-slate-700 ";
                  tdBorderClass = "border border-slate-200";
                  highlightCellClass = "bg-slate-50 font-black text-indigo-700";
                } else if (config.templateType === 'playful') {
                  thClass += "text-white ";
                  thStyle = { backgroundColor: '#1e293b', borderColor: '#d4a359' };
                  tdBorderClass = "border border-[#d4a359]/30";
                  highlightCellClass = "bg-amber-50/20 font-black text-slate-800";
                  altRowBg = "bg-[#fffef9]";
                } else if (config.templateType === 'vibrant') {
                  thClass += "text-white ";
                  thStyle = {
                    background: `linear-gradient(to right, ${config.secondaryColor || '#00205b'}, ${config.primaryColor || '#bf212f'})`,
                    borderColor: config.secondaryColor || '#00205b'
                  };
                  tdBorderClass = "border border-slate-200";
                  highlightCellClass = "bg-indigo-50/20 font-black text-indigo-700";
                  altRowBg = "bg-slate-50/30";
                } else if (config.templateType === 'minimal') {
                  thClass += "bg-white text-slate-700 border-b border-t border-l-0 border-r-0 border-slate-200 ";
                  tdBorderClass = "border-b border-slate-200 p-3";
                  highlightCellClass = "font-black text-slate-800";
                } else {
                  // Default
                  thClass += "text-white ";
                  thStyle = { backgroundColor: config.secondaryColor || '#00205b', borderColor: config.secondaryColor || '#00205b' };
                  tdBorderClass = "border border-slate-200";
                  highlightCellClass = "bg-slate-50 font-black text-indigo-700";
                  altRowBg = "bg-slate-50/30";
                }

                return (
                  <div className="w-full">
                    <div className="space-y-3 p-3 md:hidden">
                      {pivotedList.map((p, idx) => {
                        const s1 = getSemAvg(p.scores, 1);
                        const s2 = getSemAvg(p.scores, 2);
                        const yAvg = getYearAvg(p.scores);
                        const cardBg = idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white';

                        const scoreTiles = [
                          ['1st', p.scores['p1']],
                          ['2nd', p.scores['p2']],
                          ['3rd', p.scores['p3']],
                          ['Sem 1 Ex', p.scores['e1']],
                          ['Sem 1 Av', s1],
                          ['4th', p.scores['p4']],
                          ['5th', p.scores['p5']],
                          ['6th', p.scores['p6']],
                          ['Sem 2 Ex', p.scores['e2']],
                          ['Sem 2 Av', s2],
                          ['Yr Av', yAvg]
                        ] as const;

                        return (
                          <div key={idx} className={`${cardBg} rounded-2xl border ${tdBorderClass} p-4 shadow-sm`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject</p>
                                <h4 className="mt-1 truncate text-sm font-black uppercase text-slate-800">{p.subject}</h4>
                                <p className="mt-1 text-[11px] font-medium text-slate-500">{p.teacher}</p>
                              </div>
                              <span className={`inline-flex shrink-0 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black ${yAvg !== undefined ? getGradeColor(yAvg) : 'text-slate-400 bg-slate-50'}`}>
                                {yAvg !== undefined ? getLetterGrade(yAvg) : '-'}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                              {scoreTiles.map(([label, value]) => (
                                <div key={label} className={`rounded-xl bg-white px-3 py-2 ${tdBorderClass}`}>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                                  <p className="mt-1 text-sm font-black text-slate-800">{value !== undefined ? `${value}%` : '-'}</p>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                              <span className={`rounded-full px-2.5 py-1 ${highlightCellClass} ${s1 !== undefined ? '' : 'text-slate-400 bg-slate-50'}`}>
                                Sem 1: {s1 !== undefined ? `${s1}%` : '-'}
                              </span>
                              <span className={`rounded-full px-2.5 py-1 ${highlightCellClass} ${s2 !== undefined ? '' : 'text-slate-400 bg-slate-50'}`}>
                                Sem 2: {s2 !== undefined ? `${s2}%` : '-'}
                              </span>
                              <span className={`rounded-full px-2.5 py-1 ${highlightCellClass} ${yAvg !== undefined ? '' : 'text-slate-400 bg-slate-50'}`}>
                                Year: {yAvg !== undefined ? `${yAvg}%` : '-'}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cumulative Average</p>
                            <p className="mt-1 text-sm font-black text-slate-800">Class-wide performance snapshot</p>
                          </div>
                          <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black ${overallYAvg !== undefined ? getGradeColor(overallYAvg) : 'text-slate-400 bg-white'}`}>
                            {overallYAvg !== undefined ? getLetterGrade(overallYAvg) : '-'}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold">
                          <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">Sem 1 Av: {s1Avg !== undefined ? `${s1Avg}%` : '-'}</div>
                          <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">Sem 2 Av: {s2Avg !== undefined ? `${s2Avg}%` : '-'}</div>
                          <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">Yr Av: {overallYAvg !== undefined ? `${overallYAvg}%` : '-'}</div>
                          <div className="rounded-xl bg-white px-3 py-2 border border-slate-200">Grade: {overallYAvg !== undefined ? getLetterGrade(overallYAvg) : '-'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:block overflow-x-auto w-full p-2">
                      <table className={`w-full text-left border-collapse min-w-[900px] text-xs font-bold text-slate-700 ${isSerif ? 'font-serif' : 'font-sans'}`}>
                      <thead>
                        <tr className="border-b">
                          <th className={`${thClass} ${tdBorderClass} text-left min-w-[12rem] p-3`} style={thStyle}>Subject</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>1st</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>2nd</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>3rd</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>Sem 1 Ex</th>
                          <th className={`${thClass} ${tdBorderClass} ${config.templateType !== 'minimal' ? 'bg-slate-100/50' : ''}`} style={thStyle}>Sem 1 Av</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>4th</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>5th</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>6th</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>Sem 2 Ex</th>
                          <th className={`${thClass} ${tdBorderClass} ${config.templateType !== 'minimal' ? 'bg-slate-100/50' : ''}`} style={thStyle}>Sem 2 Av</th>
                          <th className={`${thClass} ${tdBorderClass} ${config.templateType !== 'minimal' ? 'bg-slate-200/50' : ''}`} style={thStyle}>Yr Av</th>
                          <th className={`${thClass} ${tdBorderClass}`} style={thStyle}>Grd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pivotedList.map((p, idx) => {
                          const s1 = getSemAvg(p.scores, 1);
                          const s2 = getSemAvg(p.scores, 2);
                          const yAvg = getYearAvg(p.scores);
                          const rowBg = idx % 2 === 1 ? altRowBg : defaultRowBg;

                          return (
                            <tr key={idx} className={`${rowBg} hover:bg-slate-50/50 transition-colors`}>
                              <td className={`${tdBorderClass} p-3 font-black text-slate-800 uppercase min-w-[12rem]`}>{p.subject}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['p1'] !== undefined ? `${p.scores['p1']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['p2'] !== undefined ? `${p.scores['p2']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['p3'] !== undefined ? `${p.scores['p3']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['e1'] !== undefined ? `${p.scores['e1']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono ${highlightCellClass}`}>{s1 !== undefined ? `${s1}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['p4'] !== undefined ? `${p.scores['p4']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['p5'] !== undefined ? `${p.scores['p5']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['p6'] !== undefined ? `${p.scores['p6']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono`}>{p.scores['e2'] !== undefined ? `${p.scores['e2']}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono ${highlightCellClass}`}>{s2 !== undefined ? `${s2}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center font-mono ${highlightCellClass} bg-slate-200/20`}>{yAvg !== undefined ? `${yAvg}%` : '-'}</td>
                              <td className={`${tdBorderClass} p-3 text-center`}>
                                <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-black rounded-lg ${yAvg !== undefined ? getGradeColor(yAvg) : 'text-slate-400 bg-slate-50'}`}>
                                  {yAvg !== undefined ? getLetterGrade(yAvg) : '-'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Cumulative Average Row */}
                        <tr className="bg-slate-100/40 font-black text-slate-900 border-t-2 border-slate-300">
                          <td className={`${tdBorderClass} p-3 uppercase font-black tracking-wider text-slate-800`}>Cumulative Average</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.p1 !== undefined ? `${colAvgs.p1}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.p2 !== undefined ? `${colAvgs.p2}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.p3 !== undefined ? `${colAvgs.p3}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.e1 !== undefined ? `${colAvgs.e1}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono ${highlightCellClass}`}>{s1Avg !== undefined ? `${s1Avg}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.p4 !== undefined ? `${colAvgs.p4}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.p5 !== undefined ? `${colAvgs.p5}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.p6 !== undefined ? `${colAvgs.p6}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono`}>{colAvgs.e2 !== undefined ? `${colAvgs.e2}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono ${highlightCellClass}`}>{s2Avg !== undefined ? `${s2Avg}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center font-mono ${highlightCellClass} bg-slate-200/20`}>{overallYAvg !== undefined ? `${overallYAvg}%` : '-'}</td>
                          <td className={`${tdBorderClass} p-3 text-center`}>
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-black rounded-lg ${overallYAvg !== undefined ? getGradeColor(overallYAvg) : 'text-slate-400 bg-slate-50'}`}>
                              {overallYAvg !== undefined ? getLetterGrade(overallYAvg) : '-'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        );

        if (section === 'custom' && config.customFields && config.customFields.length > 0) return (
          <div key="custom" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {config.customFields.map((f: any, i: number) => (
              <div 
                key={i} 
                className={`bg-white p-6 border shadow-sm transition-all duration-300 ${
                  config.templateType === 'minimal' ? 'rounded-none border-slate-200 shadow-none' :
                  config.templateType === 'playful' ? 'rounded-xl border-double border-4 border-slate-200 bg-amber-50/5' :
                  config.templateType === 'vibrant' ? 'rounded-2xl border-indigo-50 shadow-md' : 'rounded-2xl border-slate-100'
                }`}
                style={{
                  backgroundColor: config.templateType === 'playful' ? '#fffef9' : '#ffffff'
                }}
              >
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{f.label}</span>
                <p className="text-xl font-black text-slate-800">{f.value}</p>
              </div>
            ))}
          </div>
        );

        return null;
      })}
    </div>
  );
};

export default StudentReportCard;
