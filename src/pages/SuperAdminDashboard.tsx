// src/pages/SuperAdminDashboard.tsx
import React from 'react';
import { School as SchoolIcon, Settings, ShieldAlert, Globe, Users, MessageSquare, KeyRound } from 'lucide-react';
import { authService } from '../services/authService';
import { DashboardLayout, type TabItem } from '../components/common/DashboardLayout';
import AddSchoolForm from '../components/school/AddSchoolForm';
import SchoolList from '../components/school/SchoolList';
import AccountSettings from '../components/user/AccountSettings';
import SchoolAdminManager from '../components/user/SchoolAdminManager';
import AddSchoolAdminForm from '../components/user/AddSchoolAdminForm';
import AgentPasswordRecovery from '../components/user/AgentPasswordRecovery';
import FeedbackInbox from '../components/common/FeedbackInbox';
import { feedbackService } from '../services/feedbackService';

const AUTHORIZED_AGENT_EMAIL = 'shermanprinz14@gmail.com';

interface SuperAdminDashboardProps {
  profile: any;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = React.useState('schools');
  const [securityLogs, setSecurityLogs] = React.useState<any[]>([]);
  const [feedbackCount, setFeedbackCount] = React.useState(0);

  const isAuthorizedAgent = profile.email?.toLowerCase() === AUTHORIZED_AGENT_EMAIL.toLowerCase();

  React.useEffect(() => {
    if (activeTab === 'security') {
      const unsubscribe = authService.subscribeToSecurityLogs((logList) => {
        setSecurityLogs(logList);
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  React.useEffect(() => {
    const unsubscribe = feedbackService.subscribeToFeedback((items) => {
      setFeedbackCount(items.filter((item) => item.status === 'new').length);
    });
    return () => unsubscribe();
  }, []);

  const tabs: TabItem[] = [
    { id: 'schools', label: 'Global Schools', icon: <SchoolIcon className="w-5 h-5" /> },
    { id: 'admins', label: 'Admin Access', icon: <Users className="w-5 h-5" /> },
    { 
      id: 'security', 
      label: 'Security Center', 
      icon: (
        <div className="relative">
          <ShieldAlert className="w-5 h-5" />
          {securityLogs.length > 0 && activeTab !== 'security' && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
          )}
        </div>
      ) 
    },
    ...(isAuthorizedAgent ? [
      { id: 'passwords', label: 'Password Recovery', icon: <KeyRound className="w-5 h-5" /> }
    ] : []),
    { 
      id: 'support', 
      label: 'Support Inbox', 
      icon: (
        <div className="relative">
          <MessageSquare className="w-5 h-5" />
          {feedbackCount > 0 && activeTab !== 'support' && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
          )}
        </div>
      ) 
    },
    { id: 'settings', label: 'System Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'schools':
        return {
          title: 'School Management',
          subtitle: 'Oversee all schools in the system.'
        };
      case 'admins':
        return {
          title: 'Admin Access',
          subtitle: 'Assign school administrators to specific schools.'
        };
      case 'security':
        return {
          title: 'Security Firewall',
          subtitle: 'Monitoring unauthorized access attempts and system violations.'
        };
      case 'passwords':
        return {
          title: 'Password Recovery Center',
          subtitle: 'Global credential access for authorized system agents.'
        };
      case 'support':
        return {
          title: 'Support Inbox',
          subtitle: 'Messages from users across the platform.'
        };
      case 'settings':
        default:
        return {
          title: 'System Configuration',
          subtitle: 'Configure global SaaS parameters.'
        };
    }
  };

  const header = getHeaderInfo();

  const extraHeaderContent = (
    <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-xs font-black text-emerald-700 flex items-center gap-2">
      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
      SYSTEM ACTIVE
    </div>
  );

  return (
    <DashboardLayout
      userName={profile.name}
      userRole="superadmin"
      title={header.title}
      subtitle={header.subtitle}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      extraHeaderContent={extraHeaderContent}
    >
      {activeTab === 'schools' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <AddSchoolForm onSchoolAdded={() => {}} />
          </div>
          <div className="lg:col-span-2">
            <SchoolList />
          </div>
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <AddSchoolAdminForm />
          </div>
          <div className="lg:col-span-2">
            <SchoolAdminManager />
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-100 p-5 sm:p-6 rounded-3xl sm:rounded-[2rem] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-8">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-red-900">Intrusion Detection System</h3>
              <p className="text-red-700 text-sm font-medium">The following logs represent blocked attempts to gain Super Admin privileges without a valid system key.</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] sm:min-w-[760px] text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-4 sm:px-8 sm:py-5">Event Status</th>
                  <th className="px-4 py-4 sm:px-8 sm:py-5">Target Identity</th>
                  <th className="px-4 py-4 sm:px-8 sm:py-5">Attempted Key</th>
                  <th className="px-4 py-4 sm:px-8 sm:py-5">Timestamp</th>
                  <th className="px-4 py-4 sm:px-8 sm:py-5 text-right">School Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {securityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-8 py-20 text-center text-slate-400 font-bold italic">No security violations recorded. System is secure.</td>
                  </tr>
                ) : (
                  securityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-4 sm:px-8 sm:py-5">
                        <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200">
                          Blocked Access
                        </span>
                      </td>
                      <td className="px-4 py-4 sm:px-8 sm:py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                            {log.email?.substring(0, 2)}
                          </div>
                          <span className="text-sm font-bold text-slate-700">{log.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 sm:px-8 sm:py-5">
                        <code className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono font-bold text-slate-600">
                          {log.attemptedKey}
                        </code>
                      </td>
                      <td className="px-4 py-4 sm:px-8 sm:py-5 text-sm text-slate-500 font-medium">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 sm:px-8 sm:py-5 text-right">
                        <button className="p-2 text-slate-300 hover:text-blue-500 transition">
                          <Globe className="w-4 h-4" />
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
      )}

      {activeTab === 'passwords' && isAuthorizedAgent && (
        <AgentPasswordRecovery currentUserEmail={profile.email} />
      )}

      {activeTab === 'support' && (
        <FeedbackInbox />
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto">
          <AccountSettings userId={profile.id} userRole={profile.role} />
        </div>
      )}
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
