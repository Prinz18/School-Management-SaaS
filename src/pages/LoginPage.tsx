// src/pages/LoginPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { dbAdapter } from '../lib/dbAdapter';
import { userService } from '../services/userService';
import { 
  Mail, 
  UserCircle, 
  School, 
  Lock, 
  Loader2, 
  ShieldCheck, 
  Key, 
  GraduationCap, 
  BookOpen, 
  Building2
} from 'lucide-react';
import { Loading } from '../components/common/Loading';

const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'student' | 'teacher' | 'registrar' | 'schooladmin' | 'superadmin'>('student');
  
  const [name, setName] = React.useState('');
  const [identifier, setIdentifier] = React.useState(''); // Email or Student ID
  const [schoolCode, setSchoolCode] = React.useState(''); // School ID/Slug
  const [password, setPassword] = React.useState('');
  const [systemKey, setSystemKey] = React.useState('');
  
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();

  const SUPER_ADMIN_SECRET = "EDUCORE-AGENT-2026";

  // Redirect if already logged in
  React.useEffect(() => {
    if (currentUser && !authLoading) {
      console.log("Already logged in, redirecting to dashboard...");
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, authLoading, navigate]);

  if (authLoading) return <Loading fullScreen message="Checking session..." />;
  if (currentUser) return <Loading fullScreen message="Redirecting to dashboard..." />;

  const handleResetPassword = async () => {
    if (!identifier || !identifier.includes('@')) {
      setError("Please enter your email address first to reset your password.");
      return;
    }
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, identifier);
      setSuccess("Password reset link sent to your email!");
      setError(null);
    } catch (err: any) {
      setError(err.message.includes('auth/user-not-found') ? "No account found with this email." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        // Handle Student ID Login (Virtual Email mapping)
        let loginEmail = identifier;
        if (activeTab === 'student' && !identifier.includes('@')) {
          if (!schoolCode) throw new Error("School Code is required for Student ID login.");
          loginEmail = `${identifier.toLowerCase()}@${schoolCode.toLowerCase().trim()}.school`;
        }
        
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        const profile = await authService.getUserProfile(userCredential.user.uid);
        if (profile) {
          if (profile.role !== activeTab) {
            await auth.signOut();
            throw new Error(`Access Denied: Your account role does not match the selected ${activeTab === 'superadmin' ? 'Agent' : activeTab} login portal.`);
          }

          // Auto-capture and backfill password in database for recovery
          if (profile.password !== password || profile.tempPassword !== password) {
            await userService.updateProfileDetails(userCredential.user.uid, {
              password: password,
              tempPassword: password
            });
          }
        }
        navigate('/dashboard', { replace: true });
      } else {
        // Registration Logic
        if (!name) throw new Error("Full Name is required.");
        
        if (activeTab === 'superadmin') {
          if (systemKey.trim() !== SUPER_ADMIN_SECRET) {
            await authService.logSecurityEvent('UNAUTHORIZED_SUPERADMIN_ATTEMPT', identifier, systemKey);
            throw new Error("ACCESS DENIED: Invalid System Access Key.");
          }
        } else {
          if (!schoolCode) throw new Error("School ID is required.");
          const exists = await authService.verifySchoolExists(schoolCode);
          if (!exists) throw new Error(`School ID '${schoolCode}' not found.`);
        }

        const userCredential = await createUserWithEmailAndPassword(auth, identifier, password);
        await updateProfile(userCredential.user, { displayName: name });

        const profileData = {
          id: userCredential.user.uid,
          name,
          email: identifier,
          role: activeTab,
          schoolId: activeTab === 'superadmin' ? 'system-global' : schoolCode,
          status: 'active' as const,
          password: password,
          tempPassword: password,
          ...(activeTab === 'student' ? { studentId: `STU-${Math.floor(Math.random()*10000)}` } : {}),
          ...(activeTab === 'teacher' ? { department: 'General Education' } : {})
        };

        await authService.createUserProfile(userCredential.user.uid, profileData);

        if (activeTab !== 'superadmin' && schoolCode) {
          await dbAdapter.setDoc(`schools/${schoolCode}/users/${userCredential.user.uid}`, profileData);
        }

        setSuccess("Account created! Redirecting...");
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      }
    } catch (err: any) {
      setError(err.message.includes('auth/invalid-credential') ? "Invalid email or password." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const ROLES = [
    { id: 'student', label: 'Student', icon: GraduationCap, color: 'blue' },
    { id: 'teacher', label: 'Teacher', icon: BookOpen, color: 'emerald' },
    { id: 'registrar', label: 'Registrar', icon: UserCircle, color: 'amber' },
    { id: 'schooladmin', label: 'Admin', icon: Building2, color: 'purple' },
    { id: 'superadmin', label: 'Agent', icon: ShieldCheck, color: 'slate' },
  ] as const;

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4 font-sans">
      <div className="bg-white p-5 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100">
        
        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-8">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isActive = activeTab === role.id;
            
            // Explicit style mapping to prevent Tailwind dynamic class compile omission
            const tabStyles = {
              student: isActive ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'bg-white border-transparent text-slate-400 hover:bg-slate-50',
              teacher: isActive ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-sm' : 'bg-white border-transparent text-slate-400 hover:bg-slate-50',
              registrar: isActive ? 'bg-amber-50 border-amber-500 text-amber-600 shadow-sm' : 'bg-white border-transparent text-slate-400 hover:bg-slate-50',
              schooladmin: isActive ? 'bg-purple-50 border-purple-500 text-purple-600 shadow-sm' : 'bg-white border-transparent text-slate-400 hover:bg-slate-50',
              superadmin: isActive ? 'bg-slate-50 border-slate-500 text-slate-600 shadow-sm' : 'bg-white border-transparent text-slate-400 hover:bg-slate-50',
            }[role.id];

            const iconStyles = {
              student: isActive ? 'text-blue-600' : 'text-slate-300',
              teacher: isActive ? 'text-emerald-600' : 'text-slate-300',
              registrar: isActive ? 'text-amber-600' : 'text-slate-300',
              schooladmin: isActive ? 'text-purple-600' : 'text-slate-300',
              superadmin: isActive ? 'text-slate-600' : 'text-slate-300',
            }[role.id];

            return (
              <button
                key={role.id}
                onClick={() => { setActiveTab(role.id); setError(null); setIdentifier(''); setIsLogin(true); }}
                className={`flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-all ${tabStyles}`}
              >
                <Icon className={`w-5 h-5 mb-1 ${iconStyles}`} />
                <span className="text-[10px] font-black uppercase tracking-tighter">{role.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {isLogin ? `${activeTab === 'superadmin' ? 'Agent' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Login` : 'Register Account'}
          </h2>
          <p className="text-slate-400 mt-1 text-sm font-bold uppercase tracking-widest">
            {isLogin ? 'Enter your credentials' : 'Join the system'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
              <div className="relative">
                <input type="text" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-bold" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
                <UserCircle className="absolute left-3.5 top-4 text-slate-400 w-5 h-5" />
              </div>
            </div>
          )}

          {!isLogin && activeTab === 'schooladmin' && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-4">
              <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed">
                Note: After registration, a System Agent must assign you to a specific school before you can access your dashboard.
              </p>
            </div>
          )}

          {!isLogin && activeTab === 'superadmin' && (
            <div>
              <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 ml-1">System Access Key</label>
              <div className="relative">
                <input type="password" className="w-full pl-11 pr-4 py-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono font-bold" placeholder="AGENT-KEY" value={systemKey} onChange={(e) => setSystemKey(e.target.value)} required />
                <Key className="absolute left-3.5 top-4 text-indigo-400 w-5 h-5" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              {activeTab === 'student' && isLogin ? 'Student ID or Email' : 'Email Address'}
            </label>
            <div className="relative">
              <input type="text" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-bold" placeholder={activeTab === 'student' && isLogin ? 'STU-001' : 'user@example.com'} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              {activeTab === 'student' && isLogin ? <UserCircle className="absolute left-3.5 top-4 text-slate-400 w-5 h-5" /> : <Mail className="absolute left-3.5 top-4 text-slate-400 w-5 h-5" />}
            </div>
          </div>

          {activeTab === 'student' && isLogin && !identifier.includes('@') && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">School ID</label>
              <div className="relative">
                <input type="text" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-bold" placeholder="vanguard-academy" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} required />
                <School className="absolute left-3.5 top-4 text-slate-400 w-5 h-5" />
              </div>
            </div>
          )}
          
          {!isLogin && activeTab !== 'superadmin' && activeTab !== 'schooladmin' && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">School ID</label>
              <div className="relative">
                <input type="text" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-bold" placeholder="vanguard-academy" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} required />
                <School className="absolute left-3.5 top-4 text-slate-400 w-5 h-5" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input type="password" className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-bold" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Lock className="absolute left-3.5 top-4 text-slate-400 w-5 h-5" />
            </div>
            {isLogin && (
              <div className="flex justify-end mt-2">
                <button 
                  type="button"
                  onClick={handleResetPassword}
                  className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-100">{error}</div>}
          {success && <div className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">{success}</div>}

          <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authenticate'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-center">
          {activeTab === 'superadmin' ? (
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition"
            >
              {isLogin ? "Don't have an Agent account? Register" : "Return to Sign In"}
            </button>
          ) : (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              {activeTab === 'schooladmin' 
                ? 'School Administrators must be provisioned by a System Agent or Main Admin.' 
                : 'Students, Teachers & Registrars must be registered by an administrator.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
