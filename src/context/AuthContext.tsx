// src/context/AuthContext.tsx
import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { auth } from '../lib/firebaseConfig';
import type { User } from 'firebase/auth';
import { Loading } from '../components/common/Loading';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    console.log("AuthProvider initializing...");
    let isMounted = true;

    // Safety timeout: Ensure the screen never hangs indefinitely on "Authenticating..."
    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn("Auth listener timed out. Proceeding to unauthenticated state.");
        setLoading(false);
      }
    }, 3500);

    const unsubscribe = auth.onAuthStateChanged(user => {
      console.log("Auth State Changed:", user ? `Logged in as ${user.email}` : "Logged out");
      if (isMounted) {
        clearTimeout(safetyTimer);
        setCurrentUser(user);
        setLoading(false);
      }
    }, error => {
      console.error("Auth state change error:", error);
      if (isMounted) {
        clearTimeout(safetyTimer);
        setLoading(false); // Ensure loading stops even on error
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    loading,
  };

  if (loading) {
    return <Loading fullScreen message="Authenticating..." />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
