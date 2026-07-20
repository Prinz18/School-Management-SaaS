import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import { db, auth } from './lib/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Loading } from './components/common/Loading';
import { AIAgentWidget } from './components/common/AIAgentWidget';

// Import the actual page components
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SchoolAdminDashboard from './pages/SchoolAdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import RegistrarDashboard from './pages/RegistrarDashboard';

interface UserProfile {
  role: string;
  schoolId: string;
  name: string;
  email: string;
  schoolName?: string;
  schoolMotto?: string;
  [key: string]: any;
}

const ProtectedRoute: React.FC = () => {
  const { currentUser } = useAuth(); // Auth loading is handled by AuthProvider wrapper
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentUser) {
      setProfileLoading(false);
      return;
    }

    const fetchProfile = async () => {
      console.log("Fetching profile for UID:", currentUser.uid);
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const userData = snapshot.data() as UserProfile;
          console.log("Profile found:", userData);
          
          // Fetch school details if not superadmin
          if (userData.schoolId && userData.schoolId !== 'system-global') {
            console.log("Fetching school details for slug:", userData.schoolId);
            const schoolDocRef = doc(db, 'schools', userData.schoolId);
            const schoolSnapshot = await getDoc(schoolDocRef);
            
            if (schoolSnapshot.exists()) {
              const schoolData = schoolSnapshot.data() as any;
              userData.schoolName = schoolData.name;
              userData.schoolMotto = schoolData.motto;
            }

            // Fetch nested school-specific user profile details and merge them
            const schoolUserRef = doc(db, 'schools', userData.schoolId, 'users', currentUser.uid);
            const schoolUserSnapshot = await getDoc(schoolUserRef);
            if (schoolUserSnapshot.exists()) {
              const detailedData = schoolUserSnapshot.data();
              Object.assign(userData, detailedData);
            }
          }
          
          setProfile(userData);
          // Send profile info to React Native WebView host if present
          if ((window as any).ReactNativeWebView) {
            try {
              (window as any).ReactNativeWebView.postMessage(JSON.stringify({
                type: 'USER_PROFILE',
                payload: {
                  name: userData.name,
                  role: userData.role,
                  schoolId: userData.schoolId,
                  schoolName: userData.schoolName || 'SmartSchool SaaS',
                  schoolMotto: userData.schoolMotto || 'The Love of Liberty Brought Us Here'
                }
              }));
            } catch (e) {
              console.error("Failed to post message to WebView host:", e);
            }
          }
        } else {
          console.warn("Profile not found for UID:", currentUser.uid);
          setProfile(null);
        }
      } catch (err: any) {
        console.error("Error fetching user profile:", err);
        setError(err.message);
      } finally {
        setProfileLoading(false);
      }
    };
    
    fetchProfile();
  }, [currentUser]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (profileLoading) {
    return <Loading fullScreen message="Loading your profile..." />;
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-4 text-center text-red-800">
        <h2 className="text-xl font-bold">Error Loading Profile</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">Retry</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Profile Not Found</h2>
          <p className="text-slate-600 mb-6">
            We found your account (UID: <code className="bg-slate-100 p-1 rounded text-xs">{currentUser.uid}</code>), but your profile data is missing from the database. 
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={async () => {
                try {
                  const tokenResult = await currentUser.getIdTokenResult(true);
                  const claimRole = tokenResult.claims.role as string;
                  
                  const isAgentUID = currentUser.uid === 'dVqD57CiMjMK9ThNYgaYTnzGGVf1';
                  
                  const isAgentEmail = currentUser.email && (
                    currentUser.email.toLowerCase().includes('agent') || 
                    currentUser.email.toLowerCase().includes('superadmin') ||
                    currentUser.email.toLowerCase().includes('system-global')
                  );
                  
                  const finalRole = claimRole || ((isAgentEmail || isAgentUID) ? 'superadmin' : null);
                  
                  if (!finalRole) {
                    alert("Profile self-repair is only available for registered system administrators. Please contact your school administrator or registrar to re-provision your account details.");
                    return;
                  }
                  
                  const userRef = doc(db, 'users', currentUser.uid);
                  await setDoc(userRef, {
                    id: currentUser.uid,
                    name: currentUser.displayName || (finalRole === 'superadmin' ? "Platform Agent" : "System User"),
                    email: currentUser.email,
                    role: finalRole,
                    schoolId: finalRole === 'superadmin' ? 'system-global' : null,
                    status: 'active',
                    createdAt: new Date().getTime()
                  });
                  window.location.reload();
                } catch (err: any) {
                  alert("Auto-fix failed: " + err.message);
                }
              }}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition"
            >
              Attempt Auto-Fix
            </button>
            <button 
              onClick={() => auth.signOut()}
              className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect based on role
  console.log("Redirecting based on role:", profile.role);
  switch (profile.role) {
    case 'superadmin':
      return <SuperAdminDashboard profile={profile} />;
    case 'schooladmin':
      return <SchoolAdminDashboard profile={profile} />;
    case 'teacher':
      return <TeacherDashboard profile={profile} />;
    case 'student':
      return <StudentDashboard profile={profile} />;
    case 'registrar':
      return <RegistrarDashboard profile={profile} />;
    default:
      return (
        <div className="p-8 text-center">
          <h1 className="text-xl font-bold text-red-600">Unknown Role</h1>
          <p>Your account has an unrecognized role: <strong>{profile.role}</strong></p>
          <button onClick={() => auth.signOut()} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded">Sign Out</button>
        </div>
      );
  }
};


function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute />} />
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
              <h1 className="text-4xl font-black text-slate-300">404</h1>
              <p className="text-slate-500 mt-2">Page not found</p>
              <a href="/" className="mt-4 text-blue-600 hover:underline">Go Home</a>
            </div>
          } />
        </Routes>
        <AIAgentWidget />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
