// src/components/user/AccountSettings.tsx
import React from 'react';
import { auth } from '../../lib/firebaseConfig';
import { deleteUser, signOut, updatePassword } from 'firebase/auth';
import { userService, type UserData } from '../../services/userService';
import { useNavigate } from 'react-router-dom';
import { Trash2, Loader2, AlertTriangle, ShieldOff, Key, Eye, EyeOff, Save, UserCheck } from 'lucide-react';

interface AccountSettingsProps {
  userId: string;
  userRole?: string;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ userId, userRole }) => {
  const [loading, setLoading] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [showPass, setShowPass] = React.useState(false);
  const [passMessage, setPassMessage] = React.useState<{type: 'success' | 'error', text: string} | null>(null);
  const navigate = useNavigate();

  const [schoolId, setSchoolId] = React.useState<string | null>(null);
  const [students, setStudents] = React.useState<UserData[]>([]);
  const [selectedStudentId, setSelectedStudentId] = React.useState('');

  // Load schoolId based on userId
  React.useEffect(() => {
    const fetchSchoolId = async () => {
      const profile = await userService.getUserProfile(userId);
      if (profile) {
        setSchoolId(profile.schoolId);
      }
    };
    fetchSchoolId();
  }, [userId]);

  // Subscribe to students in the school
  React.useEffect(() => {
    if (schoolId && (userRole === 'schooladmin' || userRole === 'registrar')) {
      const unsubscribe = userService.subscribeToSchoolUsers(schoolId, (userList) => {
        setStudents(
          userList
            .filter(u => u.role === 'student' && u.status === 'active')
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      });
      return () => unsubscribe();
    }
  }, [schoolId, userRole]);

  const isSchoolAdmin = userRole === 'schooladmin' || userRole === 'superadmin';

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPassMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setLoading(true);
    setPassMessage(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user found.");
      
      await updatePassword(user, newPassword);
      await userService.updateProfileDetails(userId, { password: newPassword });
      setPassMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.code === 'auth/requires-recent-login') {
        setPassMessage({ type: 'error', text: 'Please log out and log back in to change your password for security reasons.' });
      } else {
        setPassMessage({ type: 'error', text: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      // 1. Remove from Realtime Database
      await userService.deleteUserProfile(userId);
      
      // 2. Delete from Firebase Authentication
      await deleteUser(user);
      
      // 3. Sign out and redirect
      await signOut(auth);
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      if (error.code === 'auth/requires-recent-login') {
        alert("For security reasons, please log out and log back in before deleting your account.");
      } else {
        alert("Failed to delete account: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
          <ShieldOff className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900">Privacy & Data</h3>
          <p className="text-slate-500 text-sm font-medium">Manage your personal information and account status.</p>
        </div>
      </div>

      {/* Security Section */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Key className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Update Security Credentials</h4>
        </div>
        
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">New Password</label>
            <div className="relative max-w-sm">
              <input
                type={showPass ? "text" : "password"}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition pr-12"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {passMessage && (
            <div className={`p-4 rounded-2xl text-xs font-bold max-w-sm flex items-center gap-2 ${
              passMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {passMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !newPassword}
            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-100"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save New Password</>}
          </button>
        </form>
      </div>

      {/* Student Password Recovery Section (Visible to Admins & Registrars) */}
      {(userRole === 'schooladmin' || userRole === 'registrar') && (
        <div className="mt-12 pt-12 border-t border-slate-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Student Password Recovery</h3>
              <p className="text-slate-500 text-sm font-medium">Retrieve secure student passcode credentials instantly.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Select Student</label>
              <select
                className="w-full max-w-md px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-slate-700 transition"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">-- Choose Student --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.studentId || 'No ID'})</option>
                ))}
              </select>
            </div>

            {selectedStudentId && (
              (() => {
                const sel = students.find(s => s.id === selectedStudentId);
                if (!sel) return null;
                return (
                  <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl space-y-4 max-w-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between border-b border-amber-100/50 pb-3">
                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Student Name</span>
                      <span className="text-xs font-black text-slate-800">{sel.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-amber-100/50 pb-3">
                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Access Username / Email</span>
                      <span className="text-xs font-bold text-slate-700 font-mono">{sel.email}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <div>
                        <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block mb-0.5">Active Security Passcode</span>
                        <p className="text-[9px] text-slate-400 font-medium">Hand this code directly to the student for immediate access.</p>
                      </div>
                      <span className="font-mono text-xs font-black text-amber-800 bg-white border border-amber-200 px-3.5 py-2 rounded-xl shadow-sm">
                        {sel.password || sel.tempPassword || 'No passcode recorded'}
                      </span>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {isSchoolAdmin && (
        <>
          <div className="p-6 bg-red-50 border border-red-100 rounded-2xl mb-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-900 mb-1 text-sm">Danger Zone: Permanent Account Deletion</h4>
                <p className="text-red-700 text-xs leading-relaxed font-medium">
                  Deleting your account will permanently remove your personal profile and system access. 
                  <span className="block mt-2 font-black">Note: All schools and school administrators you have added will remain active in the system.</span>
                </p>
              </div>
            </div>
          </div>

          {!showConfirm ? (
            <button 
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-50 transition shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Request Account Deletion
            </button>
          ) : (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Are you absolutely sure?</p>
              <div className="flex gap-3">
                <button 
                  disabled={loading}
                  onClick={handleDeleteAccount}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition shadow-lg shadow-red-200"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Delete Everything"}
                </button>
                <button 
                  disabled={loading}
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AccountSettings;
