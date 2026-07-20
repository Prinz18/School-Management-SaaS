// src/pages/TeacherDashboard.tsx
import React from 'react';
import { BookOpen, Users, ClipboardCheck, Settings, Search, Loader2, Brain } from 'lucide-react';
import { DashboardLayout, type TabItem } from '../components/common/DashboardLayout';
import AddGradeForm from '../components/grade/AddGradeForm';
import TeacherGradeView from '../components/grade/TeacherGradeView';
import AttendanceTaker from '../components/attendance/AttendanceTaker';
import AccountSettings from '../components/user/AccountSettings';
import { PredictiveAnalytics } from '../components/analytics/PredictiveAnalytics';
import { AIGradingAssistant } from '../components/grade/AIGradingAssistant';
import { academicService, type AssignmentData } from '../services/academicService';
import { userService, type UserData } from '../services/userService';

interface TeacherDashboardProps {
  profile: any;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = React.useState('grades');
  const [aiSubTab, setAiSubTab] = React.useState<'ml' | 'grading'>('ml');
  const [assignments, setAssignments] = React.useState<AssignmentData[]>([]);
  const [students, setStudents] = React.useState<UserData[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const teacherId = profile.id;
  const schoolId = profile.schoolId;

  React.useEffect(() => {
    if (teacherId && schoolId) {
      setLoading(true);
      const unsubAssignments = academicService.subscribeToTeacherAssignments(teacherId, schoolId, (assignmentList) => {
        setAssignments(assignmentList);
      });

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

  if (!teacherId || !schoolId) return <div className="p-8 text-center text-red-500 font-bold">Invalid Session: Missing Teacher Credentials</div>;

  const tabs: TabItem[] = [
    { id: 'grades', label: 'Gradebook', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'attendance', label: 'Attendance', icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: 'classes', label: 'My Classes', icon: <Users className="w-5 h-5" /> },
    { id: 'analytics', label: 'AI Insights', icon: <Brain className="w-5 h-5" /> },
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
      case 'analytics':
        return {
          title: 'AI Predictive Engine',
          subtitle: 'Review machine learning projections of student failure and performance trends.'
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

  const extraHeaderContent = (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl w-72 lg:w-96 shadow-inner">
      <Search className="w-4 h-4 text-slate-400 shrink-0" />
      <input 
        type="text" 
        placeholder="Search students or records..." 
        className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-full placeholder-slate-400" 
      />
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
                <AddGradeForm schoolId={schoolId} teacherId={teacherId} onGradeAdded={() => {}} />
              </div>
              <div className="lg:col-span-2">
                <TeacherGradeView schoolId={schoolId} teacherId={teacherId} />
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

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="flex bg-slate-100 p-1 rounded-2xl max-w-md shadow-inner border border-slate-200/50">
                <button
                  onClick={() => setAiSubTab('ml')}
                  className={`flex-1 py-3 text-center rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-200 ${
                    aiSubTab === 'ml' 
                      ? 'bg-white text-indigo-600 shadow-md shadow-slate-200/30' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                  }`}
                >
                  Predictive Insights
                </button>
                <button
                  onClick={() => setAiSubTab('grading')}
                  className={`flex-1 py-3 text-center rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-200 ${
                    aiSubTab === 'grading' 
                      ? 'bg-white text-indigo-600 shadow-md shadow-slate-200/30' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                  }`}
                >
                  AI Grading Copilot
                </button>
              </div>

              {aiSubTab === 'ml' ? (
                <PredictiveAnalytics schoolId={schoolId} students={students} />
              ) : (
                <AIGradingAssistant schoolId={schoolId} teacherId={teacherId} />
              )}
            </div>
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