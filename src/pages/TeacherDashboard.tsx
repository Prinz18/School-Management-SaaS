// src/pages/TeacherDashboard.tsx
import React from 'react';
import { BookOpen, Users, ClipboardCheck, Settings, Search, Loader2, MessageSquare } from 'lucide-react';
import { DashboardLayout, type TabItem } from '../components/common/DashboardLayout';
import SupportHistory from '../components/common/SupportHistory';
import AddGradeForm from '../components/grade/AddGradeForm';
import TeacherGradeView from '../components/grade/TeacherGradeView';
import AttendanceTaker from '../components/attendance/AttendanceTaker';
import AccountSettings from '../components/user/AccountSettings';
import { academicService, type AssignmentData } from '../services/academicService';
import { userService, type UserData } from '../services/userService';
import { schoolService } from '../services/schoolService';

interface TeacherDashboardProps {
  profile: any;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = React.useState('grades');
  const [assignments, setAssignments] = React.useState<AssignmentData[]>([]);
  const [students, setStudents] = React.useState<UserData[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [academicYear, setAcademicYear] = React.useState('');
  
  const teacherId = profile.id;
  const schoolId = profile.schoolId;

  React.useEffect(() => {
    if (teacherId && schoolId) {
      setLoading(true);
      schoolService.getSchoolBySlug(schoolId).then((school) => {
        setAcademicYear(school?.currentAcademicYear || school?.academicYears?.[0] || '');
      }).catch(() => {});
      const unsubAssignments = academicService.subscribeToTeacherAssignments(teacherId, schoolId, (assignmentList) => {
        setAssignments(assignmentList);
      }, academicYear);

      const unsubUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
        setStudents(userList.filter(u => u.role === 'student' && u.status === 'active'));
        setLoading(false);
      });

      return () => {
        unsubAssignments();
        unsubUsers();
      };
    }
  }, [teacherId, schoolId]);

  const tabs: TabItem[] = [
    { id: 'grades', label: 'Gradebook', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'attendance', label: 'Attendance', icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: 'classes', label: 'My Classes', icon: <Users className="w-5 h-5" /> },
    { id: 'support', label: 'Support', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'grades':
        return {
          title: 'Gradebook Controller',
          subtitle: 'Input student scores and audit historical grade updates.'
        };
      case 'attendance':
        return {
          title: 'Attendance Register',
          subtitle: 'Mark and log daily classroom attendance status.'
        };
      case 'classes':
        return {
          title: 'My Classes',
          subtitle: 'Oversee and communicate with your assigned student rosters.'
        };
      case 'support':
        return {
          title: 'Support History',
          subtitle: 'Review messages you sent to the school and see response updates.'
        };
      case 'settings':
      default:
        return {
          title: 'Portal Settings',
          subtitle: 'Update your instructor profile and system parameters.'
        };
    }
  };

  const header = getHeaderInfo();

  const searchSuggestions = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const items = [
      ...students.map((student) => ({
        id: `student-${student.id}`,
        label: student.name,
        hint: `${student.studentId || 'No student ID'} • ${student.classId || 'No class'}`,
        value: student.name,
        score:
          Number(student.name.toLowerCase().startsWith(query)) * 3 +
          Number((student.studentId || '').toLowerCase().startsWith(query)) * 2 +
          Number(student.name.toLowerCase().includes(query)) +
          Number((student.studentId || '').toLowerCase().includes(query))
      })),
      ...assignments.map((assignment) => ({
        id: `assignment-${assignment.id}`,
        label: `${assignment.className} • ${assignment.subjectName}`,
        hint: assignment.teacherName || 'Class assignment',
        value: assignment.className,
        score:
          Number(assignment.className.toLowerCase().startsWith(query)) * 3 +
          Number(assignment.subjectName.toLowerCase().startsWith(query)) * 3 +
          Number(assignment.className.toLowerCase().includes(query)) +
          Number(assignment.subjectName.toLowerCase().includes(query))
      }))
    ]
      .filter((item) => query.length > 0 && item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    return items.slice(0, 6);
  }, [assignments, searchQuery, students]);

  if (!teacherId || !schoolId) {
    return <div className="p-8 text-center text-red-500 font-bold">Invalid Session: Missing Teacher Credentials</div>;
  }

  const extraHeaderContent = (
    <div className="relative hidden xl:flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl w-72 2xl:w-96 shadow-inner">
      <Search className="w-4 h-4 text-slate-400 shrink-0" />
      <input 
        type="text" 
        placeholder="Search students or records..." 
        className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-full placeholder-slate-400"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
      />

      {searchFocused && searchQuery.trim().length > 0 && searchSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Suggestions
          </div>
          <div className="max-h-72 overflow-auto">
            {searchSuggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSearchQuery(item.value);
                  setSearchFocused(false);
                }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Search className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{item.label}</p>
                  <p className="truncate text-[11px] font-medium text-slate-500">{item.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout
      userName={profile.name}
      userRole="teacher"
      title={header.title}
      subtitle={header.subtitle}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      schoolId={schoolId}
      schoolName={profile.schoolName || null}
      schoolMotto={profile.schoolMotto || null}
      extraHeaderContent={extraHeaderContent}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-emerald-600">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="font-extrabold text-slate-500">Syncing classroom registries...</p>
        </div>
      ) : (
        <>
          {activeTab === 'grades' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <AddGradeForm schoolId={schoolId} teacherId={teacherId} academicYear={academicYear} onGradeAdded={() => {}} />
              </div>
              <div className="lg:col-span-2">
                <TeacherGradeView schoolId={schoolId} teacherId={teacherId} academicYear={academicYear} />
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="max-w-3xl mx-auto">
              <AttendanceTaker schoolId={schoolId} teacherId={teacherId} />
            </div>
          )}

          {activeTab === 'classes' && (
            <div className="space-y-6">
              {assignments.length === 0 ? (
                <div className="bg-white p-12 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 text-center py-20">
                  <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">No Active Assignments</h2>
                  <p className="text-slate-500 font-medium">You have not been assigned to any classrooms or subjects yet by the administrator.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {Object.entries(
                    assignments.reduce((acc, current) => {
                      if (!acc[current.classId]) {
                        acc[current.classId] = {
                          className: current.className,
                          subjects: [],
                        };
                      }
                      if (!acc[current.classId].subjects.includes(current.subjectName)) {
                        acc[current.classId].subjects.push(current.subjectName);
                      }
                      return acc;
                    }, {} as Record<string, { className: string; subjects: string[] }>)
                  ).map(([classId, classData]) => {
                    const classStudents = students.filter(s => s.classId === classId);
                    return (
                      <div key={classId} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
                        <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50/30 border-b border-slate-100 flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-black text-slate-900">{classData.className}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {classData.subjects.map(sub => (
                                <span key={sub} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                                  {sub}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 bg-white text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black shrink-0">
                            {classStudents.length} Students
                          </span>
                        </div>
                        
                        <div className="p-6 flex-1 max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                          {classStudents.length === 0 ? (
                            <p className="text-xs text-slate-400 font-bold italic py-8 text-center">No students assigned to this classroom yet.</p>
                          ) : (
                            classStudents.map(s => (
                              <div key={s.id} className="py-3 flex items-center justify-between hover:bg-slate-50/30 px-2 rounded-lg transition">
                                <span className="text-xs font-bold text-slate-800">{s.name}</span>
                                {s.studentId && <span className="text-[10px] text-slate-400 font-mono font-bold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">{s.studentId}</span>}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'support' && (
            <SupportHistory userId={teacherId} schoolId={schoolId} userName={profile.name} />
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <AccountSettings userId={teacherId} userRole={profile.role} />
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
};

export default TeacherDashboard;
