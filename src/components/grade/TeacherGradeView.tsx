// src/components/grade/TeacherGradeView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { gradeService, type GradeData } from '../../services/gradeService';
import { userService, type UserData } from '../../services/userService';
import { academicService, type AssignmentData } from '../../services/academicService';
import { 
  Trash2, 
  FilePenLine, 
  X as CloseIcon, 
  Save, 
  Loader2, 
  Plus, 
  Award,
  BookOpen,
  Filter
} from 'lucide-react';

interface TeacherGradeViewProps {
  schoolId: string;
  teacherId: string;
}

const PERIODS = [
  { id: '1st Period', label: 'P1', sem: 1 },
  { id: '2nd Period', label: 'P2', sem: 1 },
  { id: '3rd Period', label: 'P3', sem: 1 },
  { id: '1st Semester Exam', label: 'Exam 1', sem: 1 },
  { id: '4th Period', label: 'P4', sem: 2 },
  { id: '5th Period', label: 'P5', sem: 2 },
  { id: '6th Period', label: 'P6', sem: 2 },
  { id: '2nd Semester Exam', label: 'Exam 2', sem: 2 }
] as const;

export const TeacherGradeView: React.FC<TeacherGradeViewProps> = ({ schoolId, teacherId }) => {
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [allGrades, setAllGrades] = useState<GradeData[]>([]);
  const [students, setStudents] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Dropdown Selections
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Editing State Modal
  const [activeCell, setActiveCell] = useState<{
    studentId: string;
    studentName: string;
    term: string;
    gradeId?: string;
    score: string;
    maxScore: string;
  } | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);

  // Subscriptions
  useEffect(() => {
    if (teacherId && schoolId) {
      setLoading(true);

      const unsubAssignments = academicService.subscribeToTeacherAssignments(teacherId, schoolId, (assignmentList) => {
        setAssignments(assignmentList);
        if (assignmentList.length > 0) {
          // Preselect first assignment
          setSelectedClass(assignmentList[0].classId);
          setSelectedSubject(assignmentList[0].subjectName);
        }
      });

      const unsubGrades = gradeService.subscribeToTeacherGrades(teacherId, schoolId, (gradeList) => {
        setAllGrades(gradeList);
      });

      const unsubUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
        setStudents(userList.filter(u => u.role === 'student' && u.status === 'active'));
        setLoading(false);
      });

      return () => {
        unsubAssignments();
        unsubGrades();
        unsubUsers();
      };
    }
  }, [teacherId, schoolId]);

  // Handle unique classes and matching subjects
  const uniqueClasses = useMemo(() => {
    const classMap: Record<string, string> = {};
    assignments.forEach(a => {
      classMap[a.classId] = a.className;
    });
    return Object.entries(classMap).map(([id, name]) => ({ id, name }));
  }, [assignments]);

  const subjectsForSelectedClass = useMemo(() => {
    if (!selectedClass) return [];
    return Array.from(new Set(
      assignments
        .filter(a => a.classId === selectedClass)
        .map(a => a.subjectName)
    ));
  }, [selectedClass, assignments]);

  // Adjust subject when class selection changes
  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = e.target.value;
    setSelectedClass(classId);
    
    const matches = assignments.filter(a => a.classId === classId);
    if (matches.length > 0) {
      setSelectedSubject(matches[0].subjectName);
    } else {
      setSelectedSubject('');
    }
  };

  // Filter students in active class
  const studentsInClass = useMemo(() => {
    if (!selectedClass) return [];
    return students
      .filter(s => s.classId === selectedClass)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedClass, students]);

  // Organize grades: studentId -> term -> gradeObject
  const gradeMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, GradeData>> = {};
    
    // Filter grades for the selected subject
    const filtered = allGrades.filter(g => g.subject === selectedSubject);
    
    filtered.forEach(grade => {
      if (!matrix[grade.studentId]) {
        matrix[grade.studentId] = {};
      }
      matrix[grade.studentId][grade.term] = grade;
    });
    
    return matrix;
  }, [allGrades, selectedSubject]);

  // Calculate Averages
  const getSemAvg = (studentId: string, semester: 1 | 2) => {
    const studentGrades = gradeMatrix[studentId];
    if (!studentGrades) return null;

    const semPeriods = PERIODS.filter(p => p.sem === semester).map(p => p.id);
    let sum = 0;
    let count = 0;

    semPeriods.forEach(termId => {
      const entry = studentGrades[termId];
      if (entry) {
        const percentage = (entry.score / entry.maxScore) * 100;
        sum += percentage;
        count++;
      }
    });

    return count > 0 ? Math.round(sum / count) : null;
  };

  const getFinalAvg = (studentId: string) => {
    const sem1 = getSemAvg(studentId, 1);
    const sem2 = getSemAvg(studentId, 2);

    if (sem1 !== null && sem2 !== null) {
      return Math.round((sem1 + sem2) / 2);
    }
    if (sem1 !== null) return sem1;
    if (sem2 !== null) return sem2;
    return null;
  };

  // Cell Click Handler
  const handleCellClick = (studentId: string, studentName: string, term: string) => {
    const existing = gradeMatrix[studentId]?.[term];
    setActiveCell({
      studentId,
      studentName,
      term,
      gradeId: existing?.id,
      score: existing ? String(existing.score) : '',
      maxScore: existing ? String(existing.maxScore) : '100'
    });
  };

  // Submit Score Update/Entry
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCell) return;

    const numScore = Number(activeCell.score);
    const numMax = Number(activeCell.maxScore);

    if (isNaN(numScore) || isNaN(numMax)) {
      alert("Please enter valid numerical scores.");
      return;
    }

    setSavingGrade(true);
    try {
      if (activeCell.gradeId) {
        // Update existing record
        await gradeService.updateGrade(schoolId, activeCell.gradeId, {
          score: numScore,
          maxScore: numMax
        });
      } else {
        // Upload new record
        await gradeService.uploadGrade(
          activeCell.studentId,
          teacherId,
          schoolId,
          selectedSubject,
          numScore,
          numMax,
          activeCell.term
        );
      }
      setActiveCell(null);
    } catch (err) {
      console.error("Error saving grade entry:", err);
      alert("Failed to submit score record.");
    } finally {
      setSavingGrade(false);
    }
  };

  // Delete Score Record
  const handleDeleteGrade = async () => {
    if (!activeCell?.gradeId) return;

    if (window.confirm("Are you sure you want to delete this grade record?")) {
      setSavingGrade(true);
      try {
        await gradeService.deleteGrade(schoolId, activeCell.gradeId);
        setActiveCell(null);
      } catch (err) {
        console.error("Error deleting grade entry:", err);
        alert("Failed to remove score record.");
      } finally {
        setSavingGrade(false);
      }
    }
  };

  if (loading) return <div className="text-center py-10 font-bold text-slate-500">Loading ledger data...</div>;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
      {/* Filtering Header Panel */}
      <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Gradebook Ledger Matrix</h3>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedClass}
              onChange={handleClassChange}
              className="border-none bg-transparent font-bold text-xs text-slate-700 outline-none cursor-pointer"
            >
              <option value="">-- Classroom --</option>
              {uniqueClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="border-none bg-transparent font-bold text-xs text-slate-700 outline-none cursor-pointer"
              disabled={!selectedClass}
            >
              <option value="">-- Subject --</option>
              {subjectsForSelectedClass.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Roster Ledger Matrix Sheet */}
      {!selectedClass || !selectedSubject ? (
        <div className="p-16 text-center text-slate-400 italic font-bold">
          Please select a classroom and subject from your assignments to begin auditing student grades.
        </div>
      ) : studentsInClass.length === 0 ? (
        <div className="p-16 text-center text-slate-400 italic font-bold">
          No students are currently enrolled in the selected classroom.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/30 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Student Name</th>
                {PERIODS.map(p => (
                  <th key={p.id} className="px-4 py-4 text-center border-r border-slate-50" title={p.id}>{p.label}</th>
                ))}
                <th className="px-4 py-4 text-center bg-indigo-50/30 text-indigo-700 border-r border-indigo-100 font-extrabold">Sem 1</th>
                <th className="px-4 py-4 text-center bg-emerald-50/30 text-emerald-700 border-r border-emerald-100 font-extrabold">Sem 2</th>
                <th className="px-5 py-4 text-center bg-amber-50 text-amber-800 font-black">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              {studentsInClass.map(student => {
                const s1 = getSemAvg(student.id, 1);
                const s2 = getSemAvg(student.id, 2);
                const finalScore = getFinalAvg(student.id);

                return (
                  <tr key={student.id} className="hover:bg-slate-50/20 transition group">
                    {/* Student Column */}
                    <td className="px-6 py-3.5 sticky left-0 bg-white group-hover:bg-slate-50/20 z-10 border-r border-slate-100 font-extrabold text-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div>
                        <p>{student.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono font-medium mt-0.5">{student.studentId || 'No ID'}</p>
                      </div>
                    </td>

                    {/* Period Cells */}
                    {PERIODS.map(p => {
                      const entry = gradeMatrix[student.id]?.[p.id];
                      return (
                        <td 
                          key={p.id} 
                          onClick={() => handleCellClick(student.id, student.name, p.id)}
                          className="px-2 py-3.5 text-center border-r border-slate-50 cursor-pointer hover:bg-indigo-50/30 transition-colors group/cell"
                        >
                          {entry ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="text-slate-800 font-extrabold">{entry.score}</span>
                              <span className="text-[10px] text-slate-400 font-normal">/{entry.maxScore}</span>
                              <FilePenLine className="w-3 h-3 text-slate-300 opacity-0 group-cell-hover:opacity-100 transition-opacity ml-0.5 shrink-0" />
                            </div>
                          ) : (
                            <span className="text-slate-300 hover:text-indigo-500 font-medium text-xs flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5 text-slate-200 group-cell-hover:text-indigo-400" />
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Semester 1 Avg */}
                    <td className="px-4 py-3.5 text-center bg-indigo-50/10 text-indigo-600 border-r border-indigo-50 font-black">
                      {s1 !== null ? `${s1}%` : <span className="text-slate-300">-</span>}
                    </td>

                    {/* Semester 2 Avg */}
                    <td className="px-4 py-3.5 text-center bg-emerald-50/10 text-emerald-600 border-r border-emerald-50 font-black">
                      {s2 !== null ? `${s2}%` : <span className="text-slate-300">-</span>}
                    </td>

                    {/* Final Avg */}
                    <td className="px-5 py-3.5 text-center bg-amber-50/30 text-amber-700 font-black text-sm">
                      {finalScore !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{finalScore}%</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grade Entry Popover Modal */}
      {activeCell && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-wide">Enter Grade Coordinates</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{activeCell.term}</p>
              </div>
              <button 
                onClick={() => setActiveCell(null)} 
                className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 mb-5">
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Student</span>
                <span className="text-xs font-extrabold text-slate-800">{activeCell.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Subject</span>
                <span className="text-xs font-extrabold text-slate-800">{selectedSubject}</span>
              </div>
            </div>
            
            <form onSubmit={handleSaveGrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Obtained Score</label>
                  <input 
                    type="number" 
                    value={activeCell.score} 
                    onChange={(e) => setActiveCell({...activeCell, score: e.target.value})}
                    placeholder="0"
                    min="0"
                    max={activeCell.maxScore || "100"}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Maximum Score</label>
                  <input 
                    type="number" 
                    value={activeCell.maxScore} 
                    onChange={(e) => setActiveCell({...activeCell, maxScore: e.target.value})}
                    placeholder="100"
                    min="1"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {activeCell.gradeId && (
                  <button
                    type="button"
                    onClick={handleDeleteGrade}
                    disabled={savingGrade}
                    className="flex items-center justify-center p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-100 transition"
                    title="Remove grade record"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button 
                  type="submit" 
                  disabled={savingGrade}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition"
                >
                  {savingGrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Score</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherGradeView;