// src/pages/StudentDashboard.tsx
import React from 'react';
import { Award, Calendar, ClipboardCheck, BookOpen, Settings, MessageSquare, Loader2, AlertCircle } from 'lucide-react';
import { DashboardLayout, type TabItem } from '../components/common/DashboardLayout';
import StudentReportCard from '../components/grade/StudentReportCard';
import AttendanceViewer from '../components/attendance/AttendanceViewer';
import AccountSettings from '../components/user/AccountSettings';
import { academicService, type AssignmentData } from '../services/academicService';

interface StudentDashboardProps {
  profile: any;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = React.useState('grades');
  const [classroomName, setClassroomName] = React.useState<string | null>(null);
  const [classAssignments, setClassAssignments] = React.useState<AssignmentData[]>([]);
  const [loadingAcademics, setLoadingAcademics] = React.useState(true);

  const studentId = profile.id;
  const schoolId = profile.schoolId;

  React.useEffect(() => {
    if (schoolId) {
      setLoadingAcademics(true);
      
      const unsubClasses = academicService.subscribeToSchoolClasses(schoolId, (classList) => {
        const myClass = classList.find(c => c.id === profile.classId);
        if (myClass) {
          setClassroomName(myClass.name);
        } else {
          setClassroomName(null);
        }
      });

      const unsubAssignments = academicService.subscribeToSchoolAssignments(schoolId, (assignmentList) => {
        const filtered = assignmentList.filter(a => a.classId === profile.classId);
        setClassAssignments(filtered);
        setLoadingAcademics(false);
      });

      return () => {
        unsubClasses();
        unsubAssignments();
      };
    }
  }, [schoolId, profile.classId]);

  if (!studentId || !schoolId) return <div className="p-8 text-center text-red-500 font-bold">Invalid Session: Missing Student Credentials</div>;

  const tabs: TabItem[] = [
    { id: 'grades', label: 'My Grades', icon: <Award className="w-5 h-5" /> },
    { id: 'attendance', label: 'Attendance', icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: 'curriculum', label: 'Curriculum', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'schedule', label: 'Timetable', icon: <Calendar className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'grades':
        return {
          title: 'Academic Progress',
          subtitle: `Report card and scores log for ${profile.name}`
        };
      case 'attendance':
        return {
          title: 'Attendance Log',
          subtitle: 'Daily log of present, absent, or late marks.'
        };
      case 'curriculum':
        return {
          title: 'Class Curriculum',
          subtitle: `Topics and courses assigned to ${classroomName || 'your roster'}`
        };
      case 'schedule':
        return {
          title: 'Timetable & Calendar',
          subtitle: 'Weekly lecture schedule and time blocks.'
        };
      case 'settings':
      default:
        return {
          title: 'Account Settings',
          subtitle: 'Update your security key and credentials.'
        };
    }
  };

  const header = getHeaderInfo();

  const extraHeaderContent = (
    <button className="relative w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition border border-slate-100">
      <MessageSquare className="w-5 h-5" />
      <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-cyan-500 rounded-full border-2 border-white"></span>
    </button>
  );

  // Combine dynamic classroom indicator with standard school title in header banner
  const dynamicSchoolName = classroomName 
    ? `${profile.schoolName || 'EduCore'} (${classroomName})` 
    : `${profile.schoolName || 'EduCore'} (Roster Pending)`;

  return (
    <DashboardLayout
      userName={profile.name}
      userRole="student"
      title={header.title}
      subtitle={header.subtitle}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      schoolId={schoolId}
      schoolName={dynamicSchoolName}
      schoolMotto={profile.schoolMotto || null}
      extraHeaderContent={extraHeaderContent}
    >
      {loadingAcademics ? (
        <div className="flex flex-col items-center justify-center py-20 text-cyan-600">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="font-extrabold text-slate-500">Syncing academic curriculum...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'grades' && (
            <StudentReportCard 
              studentId={studentId} 
              schoolId={schoolId} 
              studentName={profile.name}
              schoolName={profile.schoolName}
              classroomName={classroomName || undefined}
            />
          )}

          {activeTab === 'attendance' && <AttendanceViewer studentId={studentId} schoolId={schoolId} />}

          
          {activeTab === 'curriculum' && (
            <>
              {!profile.classId ? (
                <div className="bg-white p-12 rounded-[2rem] border border-slate-100 text-center py-20 shadow-sm max-w-xl mx-auto flex flex-col items-center">
                  <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
                  <h3 className="text-lg font-black text-slate-800">Classroom Assignment Pending</h3>
                  <p className="text-slate-400 font-medium text-xs mt-2 leading-relaxed">
                    You have not been assigned to a classroom block yet by your school administrator. Once assigned, your curriculum list and teacher directories will appear here.
                  </p>
                </div>
              ) : classAssignments.length === 0 ? (
                <div className="bg-white p-12 rounded-[2rem] border border-slate-100 text-center py-20 shadow-sm max-w-xl mx-auto flex flex-col items-center">
                  <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-black text-slate-800">No Registered Courses</h3>
                  <p className="text-slate-400 font-medium text-xs mt-2 leading-relaxed">
                    No curriculum subjects have been assigned to your classroom ({classroomName}) yet. Please check back later.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classAssignments.map(a => (
                    <div key={a.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-cyan-200 transition group flex flex-col justify-between">
                      <div>
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition border border-slate-100 group-hover:border-cyan-100 shadow-inner">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <h3 className="font-extrabold text-slate-800 mb-1 text-sm">{a.subjectName}</h3>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-4">Instructor: {a.teacherName}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'schedule' && (
            <div className="bg-white p-12 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center py-20">
              <Calendar className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Class Timetable</h2>
              <p className="text-slate-500 font-medium">Weekly timetables are currently under generation by the node manager.</p>
            </div>
          )}

          {activeTab === 'settings' && <AccountSettings userId={studentId} userRole={profile.role} />}
        </div>
      )}
    </DashboardLayout>
  );
};

export default StudentDashboard;