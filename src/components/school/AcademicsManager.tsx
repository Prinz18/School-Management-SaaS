// src/components/school/AcademicsManager.tsx
import React, { useState, useEffect } from 'react';
import { academicService, type ClassData, type SubjectData, type AssignmentData } from '../../services/academicService';
import { userService, type UserData } from '../../services/userService';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  GraduationCap, 
  BookOpen, 
  UserPlus, 
  UserMinus, 
  Users, 
  Check, 
  AlertCircle,
  Loader2,
  Palette
} from 'lucide-react';
import ReportTemplateEditor from './ReportTemplateEditor';

interface AcademicsManagerProps {
  schoolId: string;
}

export const AcademicsManager: React.FC<AcademicsManagerProps> = ({ schoolId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'classes' | 'subjects' | 'assignments' | 'template'>('classes');
  
  // Data lists
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Selection / Form States
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  
  // Assignment Form State
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  
  // Modal / Toast Notification State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Subscriptions
  useEffect(() => {
    setLoading(true);
    
    const unsubClasses = academicService.subscribeToSchoolClasses(schoolId, (classList) => {
      setClasses(classList);
      if (classList.length > 0 && !selectedClassId) {
        setSelectedClassId(classList[0].id);
      }
    });

    const unsubSubjects = academicService.subscribeToSchoolSubjects(schoolId, (subjectList) => {
      setSubjects(subjectList);
    });

    const unsubAssignments = academicService.subscribeToSchoolAssignments(schoolId, (assignmentList) => {
      setAssignments(assignmentList);
    });

    const unsubUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
      setAllUsers(userList);
      setLoading(false);
    });

    return () => {
      unsubClasses();
      unsubSubjects();
      unsubAssignments();
      unsubUsers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // Derived states
  const activeTeachers = allUsers.filter(u => u.role === 'teacher' && u.status === 'active');
  const activeStudents = allUsers.filter(u => u.role === 'student' && u.status === 'active');
  
  // Get students in selected classroom
  const studentsInSelectedClass = activeStudents.filter(s => s.classId === selectedClassId);
  
  // Get students with no classroom assigned
  const unassignedStudents = activeStudents.filter(s => !s.classId);

  const selectedClassDetails = classes.find(c => c.id === selectedClassId);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4500);
  };

  // handlers
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setActionLoading(true);
    try {
      await academicService.createClass(newClassName, schoolId);
      setNewClassName('');
      showSuccess(`Classroom "${newClassName}" registered successfully.`);
    } catch (err: any) {
      showError(err.message || 'Failed to create classroom.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClass = async (classId: string, className: string) => {
    if (window.confirm(`Are you sure you want to delete classroom "${className}"? This does NOT delete students, but will remove their class assignment.`)) {
      setActionLoading(true);
      try {
        // Unassign all students in this class first
        const batchUnassign = activeStudents
          .filter(s => s.classId === classId)
          .map(s => academicService.assignStudentToClass(s.id, null));
        
        await Promise.all(batchUnassign);
        
        // Remove class assignments
        const classAssignments = assignments.filter(a => a.classId === classId);
        await Promise.all(classAssignments.map(a => academicService.revokeAssignment(schoolId, a.id)));
        
        // Delete the class itself
        await academicService.deleteClass(schoolId, classId);
        
        if (selectedClassId === classId) {
          setSelectedClassId(classes.find(c => c.id !== classId)?.id || null);
        }
        
        showSuccess(`Classroom "${className}" deleted successfully.`);
      } catch (err: any) {
        showError(err.message || 'Failed to delete classroom.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setActionLoading(true);
    try {
      await academicService.createSubject(newSubjectName, schoolId);
      setNewSubjectName('');
      showSuccess(`Subject "${newSubjectName}" added to curriculum.`);
    } catch (err: any) {
      showError(err.message || 'Failed to create subject.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (window.confirm(`Are you sure you want to remove "${subjectName}" from the curriculum? This will delete all teacher assignments for this subject.`)) {
      setActionLoading(true);
      try {
        const subjectAssignments = assignments.filter(a => a.subjectId === subjectId);
        await Promise.all(subjectAssignments.map(a => academicService.revokeAssignment(schoolId, a.id)));
        
        await academicService.deleteSubject(schoolId, subjectId);
        showSuccess(`Subject "${subjectName}" removed.`);
      } catch (err: any) {
        showError(err.message || 'Failed to remove subject.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleAddStudentToClass = async (studentId: string) => {
    if (!selectedClassId) return;
    setActionLoading(true);
    try {
      await academicService.assignStudentToClass(studentId, selectedClassId);
      showSuccess('Student added to roster.');
    } catch (err) {
      console.error(err);
      showError('Failed to assign student.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveStudentFromClass = async (studentId: string) => {
    setActionLoading(true);
    try {
      await academicService.assignStudentToClass(studentId, null);
      showSuccess('Student removed from classroom roster.');
    } catch (err) {
      console.error(err);
      showError('Failed to remove student.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTeacherId || !assignClassId || !assignSubjectId) {
      showError('Please fill out all fields to create an assignment.');
      return;
    }

    const teacher = activeTeachers.find(t => t.id === assignTeacherId);
    const classroom = classes.find(c => c.id === assignClassId);
    const subject = subjects.find(s => s.id === assignSubjectId);

    if (!teacher || !classroom || !subject) {
      showError('Invalid references. Please try again.');
      return;
    }

    // Check for duplicate assignments
    const duplicate = assignments.some(
      a => a.teacherId === assignTeacherId && a.classId === assignClassId && a.subjectId === assignSubjectId
    );

    if (duplicate) {
      showError(`${teacher.name} is already assigned to teach ${subject.name} to ${classroom.name}.`);
      return;
    }

    setActionLoading(true);
    try {
      await academicService.assignTeacher(
        assignTeacherId,
        teacher.name,
        assignClassId,
        classroom.name,
        assignSubjectId,
        subject.name,
        schoolId
      );
      
      setAssignTeacherId('');
      setAssignClassId('');
      setAssignSubjectId('');
      showSuccess(`Assigned ${teacher.name} to teach ${subject.name} for ${classroom.name}.`);
    } catch (err: any) {
      showError(err.message || 'Failed to create assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAssignment = async (assignmentId: string, teacherName: string, subjectName: string, className: string) => {
    if (window.confirm(`Revoke teaching assignment for ${teacherName} (${subjectName} in ${className})?`)) {
      setActionLoading(true);
      try {
        await academicService.revokeAssignment(schoolId, assignmentId);
        showSuccess('Teaching assignment revoked.');
      } catch (err) {
        console.error(err);
        showError('Failed to revoke teaching assignment.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-extrabold text-slate-500">Syncing academic databases...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Toast Alert Popups */}
      {successMessage && (
        <div className="fixed top-24 right-10 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl shadow-xl shadow-emerald-500/20 z-50 flex items-center gap-3 border border-emerald-400 animate-slide-in">
          <Check className="w-4 h-4 bg-white/20 p-0.5 rounded-full" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-24 right-10 bg-red-500 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl shadow-xl shadow-red-500/20 z-50 flex items-center gap-3 border border-red-400 animate-slide-in">
          <AlertCircle className="w-4 h-4 bg-white/20 p-0.5 rounded-full" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Sub Tabs Toggle */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-max border border-slate-200">
        <button
          onClick={() => setActiveSubTab('classes')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeSubTab === 'classes'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Classrooms
        </button>
        <button
          onClick={() => setActiveSubTab('subjects')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeSubTab === 'subjects'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Curriculum
        </button>
        <button
          onClick={() => setActiveSubTab('assignments')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeSubTab === 'assignments'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Teacher Assignments
        </button>
        <button
          onClick={() => setActiveSubTab('template')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeSubTab === 'template'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Palette className="w-4 h-4" />
          Report Template
        </button>
      </div>

      {/* ========================================================
          SUBTAB: CLASSROOMS MANAGER
         ======================================================== */}
      {activeSubTab === 'classes' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Class List & Form */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Plus className="w-4 h-4 text-indigo-600 animate-pulse" /> Create Classroom
              </h3>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grade 10-A"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700 placeholder-slate-400"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Class'}
                </button>
              </form>
            </div>

            {/* School Classes list */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Active Classrooms ({classes.length})</p>
              {classes.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-slate-100 text-center text-xs font-bold text-slate-400 italic">No classrooms registered.</div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {classes.map(c => {
                    const isSelected = selectedClassId === c.id;
                    const studentCount = activeStudents.filter(s => s.classId === c.id).length;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedClassId(c.id)}
                        className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                          isSelected 
                            ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200 text-indigo-900 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-xs">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{studentCount} Students</p>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(c.id, c.name);
                          }}
                          className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Classroom Roster & Enrollment */}
          <div className="xl:col-span-3">
            {selectedClassId && selectedClassDetails ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Roster list */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">Classroom Roster</h4>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Assigned students in {selectedClassDetails.name}</p>
                    </div>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black border border-indigo-100">{studentsInSelectedClass.length} Enrolled</span>
                  </div>
                  
                  <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px] flex-1">
                    {studentsInSelectedClass.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-xs font-bold italic py-24">
                        This classroom has no students assigned yet. Use the panel on the right to enroll students.
                      </div>
                    ) : (
                      studentsInSelectedClass.map(s => (
                        <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-extrabold text-xs text-slate-800">{s.name}</p>
                              {s.studentId && <p className="text-[10px] text-indigo-600 font-mono font-bold mt-0.5">{s.studentId}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveStudentFromClass(s.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition opacity-0 group-hover:opacity-100 border border-slate-100 hover:border-red-100"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Unenroll
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Unassigned Students panel */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-black text-slate-800 text-sm">Enroll Students</h4>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Select from unassigned school members</p>
                  </div>
                  
                  <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px] flex-1">
                    {unassignedStudents.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-xs font-bold italic py-24">
                        All active students have been assigned to classrooms.
                      </div>
                    ) : (
                      unassignedStudents.map(s => (
                        <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                          <div className="flex-1 pr-3">
                            <p className="font-extrabold text-xs text-slate-800 truncate">{s.name}</p>
                            {s.studentId && <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{s.studentId}</p>}
                          </div>
                          <button
                            onClick={() => handleAddStudentToClass(s.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition border border-indigo-100 hover:border-transparent shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                <Users className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="font-black text-slate-700 text-sm">No Classroom Selected</h4>
                <p className="text-xs text-slate-400 font-medium mt-1">Please register or select a classroom from the left side panel to manage student rosters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUBTAB: CURRICULUM SUBJECTS
         ======================================================== */}
      {activeSubTab === 'subjects' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 animate-fade-in">
          {/* Add Subject Card */}
          <div className="xl:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide">
                <Plus className="w-4 h-4 text-indigo-600" /> New Subject
              </h3>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mathematics, Physics..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700 placeholder-slate-400"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Subject'}
                </button>
              </form>
            </div>
          </div>

          {/* Subjects Grid */}
          <div className="xl:col-span-3">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Active School Curriculum ({subjects.length})</p>
              {subjects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-xs font-bold italic py-20 shadow-sm">
                  Curriculum database is empty. Register your first subject using the panel on the left.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map(s => {
                    const assignedTeachersCount = assignments.filter(a => a.subjectId === s.id).length;
                    return (
                      <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-indigo-100 transition shadow-sm hover:shadow-md flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">{s.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{assignedTeachersCount} Assigned Instructors</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSubject(s.id, s.name)}
                          className="p-2 bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition opacity-0 group-hover:opacity-100 border border-slate-100 hover:border-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUBTAB: TEACHER ASSIGNMENTS
         ======================================================== */}
      {activeSubTab === 'assignments' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 animate-fade-in">
          {/* Assignment Creation Form */}
          <div className="xl:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide">
                <GraduationCap className="w-4 h-4 text-indigo-600" /> Assign Teacher
              </h3>
              
              {activeTeachers.length === 0 || classes.length === 0 || subjects.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-bold leading-relaxed">
                  Prerequisites missing. Ensure you have created:
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>At least one Active Teacher</li>
                    <li>At least one Classroom</li>
                    <li>At least one curriculum Subject</li>
                  </ul>
                </div>
              ) : (
                <form onSubmit={handleAssignTeacher} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Instructor</label>
                    <select
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700"
                      value={assignTeacherId}
                      onChange={(e) => setAssignTeacherId(e.target.value)}
                    >
                      <option value="">-- Choose Teacher --</option>
                      {activeTeachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Classroom</label>
                    <select
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700"
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                    >
                      <option value="">-- Choose Classroom --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Subject</label>
                    <select
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700"
                      value={assignSubjectId}
                      onChange={(e) => setAssignSubjectId(e.target.value)}
                    >
                      <option value="">-- Choose Subject --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Assignment'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Assignments list table */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                <h4 className="font-black text-slate-800 text-sm">Active Teacher Assignments ({assignments.length})</h4>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/20 text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4">Instructor</th>
                      <th className="px-6 py-4">Classroom</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold italic bg-white">
                          No active teaching assignments found in this node.
                        </td>
                      </tr>
                    ) : (
                      assignments.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/30 transition group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                                {a.teacherName.charAt(0)}
                              </div>
                              <span className="font-extrabold text-slate-900">{a.teacherName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">{a.className}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg">{a.subjectName}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleRevokeAssignment(a.id, a.teacherName, a.subjectName, a.className)}
                              className="p-1.5 rounded-xl bg-slate-50 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 border border-slate-100 hover:border-red-100 transition"
                              title="Revoke Assignment"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'template' && (
        <ReportTemplateEditor schoolId={schoolId} />
      )}
    </div>
  );
};
export default AcademicsManager;
