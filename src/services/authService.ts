// src/services/authService.ts
import { auth } from '../lib/firebaseConfig';
import { dbAdapter } from '../lib/dbAdapter';
import { signOut as firebaseSignOut } from 'firebase/auth';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'schooladmin' | 'teacher' | 'student' | 'registrar';
  schoolId: string | null;
  status: 'active' | 'inactive';
  createdAt: any;
  [key: string]: any;
}

export const authService = {
  /**
   * Retrieves the currently authenticated Firebase user.
   */
  getCurrentUser: () => {
    return auth.currentUser;
  },

  /**
   * Performs sign out via Firebase Authentication.
   */
  signOut: async (): Promise<void> => {
    await firebaseSignOut(auth);
  },

  /**
   * Retrieves the database profile details for a given UID.
   */
  getUserProfile: async (uid: string): Promise<UserProfile | null> => {
    try {
      const res = await dbAdapter.getDoc(`users/${uid}`);
      if (res.exists) {
        return res.data as UserProfile;
      }
      return null;
    } catch (err) {
      console.error("Error in getUserProfile:", err);
      return null;
    }
  },

  /**
   * Logs a security event into database.
   */
  logSecurityEvent: async (event: string, email: string, attemptedKey: string): Promise<void> => {
    try {
      await dbAdapter.pushDoc('security_logs', {
        event,
        email,
        attemptedKey,
        timestamp: Date.now(),
        status: 'BLOCKED'
      });
    } catch (err) {
      console.error("Error in logSecurityEvent:", err);
    }
  },

  /**
   * Verifies if a school exists by its schoolId/code.
   */
  verifySchoolExists: async (schoolId: string): Promise<boolean> => {
    try {
      const schoolRes = await dbAdapter.getDoc(`schools/${schoolId}`);
      return schoolRes.exists;
    } catch (err) {
      console.error("Error in verifySchoolExists:", err);
      return false;
    }
  },

  /**
   * Creates a user profile record.
   */
  createUserProfile: async (uid: string, profile: Partial<UserProfile>): Promise<void> => {
    await dbAdapter.setDoc(`users/${uid}`, {
      ...profile,
      createdAt: Date.now()
    });
  },

  /**
   * Subscribes to recent security logs (capped at 20 entries).
   */
  subscribeToSecurityLogs: (onUpdate: (logs: any[]) => void): (() => void) => {
    return dbAdapter.subscribeToPath('security_logs', (list) => {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(list.slice(0, 20));
    });
  }
};
