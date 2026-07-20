// src/pages/SchoolAdminDashboard.tsx
import React from 'react';
import { Users, GraduationCap, Settings } from 'lucide-react';
import { DashboardLayout, type TabItem } from '../components/common/DashboardLayout';
import AddUserForm from '../components/user/AddUserForm';
import UserList from '../components/user/UserList';
import AccountSettings from '../components/user/AccountSettings';
import AcademicsManager from '../components/school/AcademicsManager';
import { userService } from '../services/userService';

interface SchoolAdminDashboardProps {
  profile: any;
}

const SchoolAdminDashboard: React.FC<SchoolAdminDashboardProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = React.useState('members');
  const [users, setUsers] = React.useState<any[]>([]);
  
  const schoolId = profile.schoolId;

  React.useEffect(() => {
    if (schoolId) {
      const unsubscribe = userService.subscribeToSchoolUsers(schoolId, (userList) => {
        setUsers(userList);
      });
      return () => unsubscribe();
    }
  }, [schoolId]);

  if (!schoolId) return <div className="p-8 text-center text-red-500 font-bold">Invalid Session: Missing School Assignment</div>;

  const tabs: TabItem[] = [
    { id: 'members', label: 'All Members', icon: <Users className="w-5 h-5" /> },
    { id: 'academics', label: 'Academics', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'members':
        return {
          title: 'User Management',
          subtitle: `Manage school administrator, teacher, and student nodes.`
        };
      case 'academics':
        return {
          title: 'Academic Controls',
          subtitle: 'Curriculum development and classroom assignment configurations.'
        };
      case 'settings':
      default:
        return {
          title: 'School Settings',
          subtitle: 'Configure school profile and account details.'
        };
    }
  };

  const header = getHeaderInfo();

  const totalMembers = users.length;
  const activeStudents = users.filter(u => u.role === 'student' && u.status === 'active').length;
  const activeTeachers = users.filter(u => u.role === 'teacher' && u.status === 'active').length;

  return (
    <DashboardLayout
      userName={profile.name}
      userRole="schooladmin"
      title={header.title}
      subtitle={header.subtitle}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      schoolId={schoolId}
      schoolName={profile.schoolName || null}
      schoolMotto={profile.schoolMotto || null}
    >
      {activeTab === 'members' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-1">
            <AddUserForm schoolId={schoolId} onUserAdded={() => {}} />
            
            {/* Statistics Cards */}
            <div className="mt-6 space-y-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Total Members</p>
                <div className="text-2xl font-black text-slate-800">{totalMembers}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Active Students</p>
                <div className="text-2xl font-black text-cyan-600">{activeStudents}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Active Instructors</p>
                <div className="text-2xl font-black text-emerald-600">{activeTeachers}</div>
              </div>
            </div>
          </div>
          <div className="xl:col-span-3">
            <UserList schoolId={schoolId} currentUserProfile={profile} />
          </div>
        </div>
      )}

      {activeTab === 'academics' && (
        <AcademicsManager schoolId={schoolId} />
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto">
          <AccountSettings userId={profile.id || ''} userRole={profile.role} />
        </div>
      )}
    </DashboardLayout>
  );
};

export default SchoolAdminDashboard;