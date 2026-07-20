// src/services/authService.ts
import { auth, db } from '../lib/firebaseConfig';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  onSnapshot 
} from 'firebase/firestore';

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
   * Retrieves the database profile details for a given UID from Firestore.
   */
  getUserProfile: async (uid: string): Promise<UserProfile | null> => {
    try {
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as UserProfile;
      }
      return null;
    } catch (err) {
      console.error("Error in getUserProfile:", err);
      return null;
    }
  },

  /**
   * Logs a security event into Firestore.
   */
  logSecurityEvent: async (event: string, email: string, attemptedKey: string): Promise<void> => {
    try {
      const logsRef = collection(db, 'security_logs');
      await addDoc(logsRef, {
        event,
        email,
        attemptedKey,
        timestamp: serverTimestamp(),
        status: 'BLOCKED'
      });
    } catch (err) {
      console.error("Error in logSecurityEvent:", err);
    }
  },

  /**
   * Verifies if a school exists by its schoolId/code in Firestore.
   */
  verifySchoolExists: async (schoolId: string): Promise<boolean> => {
    try {
      const schoolsRef = collection(db, 'schools');
      const q = query(schoolsRef, where('schoolId', '==', schoolId));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (err) {
      console.error("Error in verifySchoolExists:", err);
      return false;
    }
  },

  /**
   * Creates a user profile record in Firestore.
   */
  createUserProfile: async (uid: string, profile: Partial<UserProfile>): Promise<void> => {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, {
      ...profile,
      createdAt: serverTimestamp()
    });
  },

  /**
   * Subscribes to recent security logs in Firestore (capped at 20 entries).
   */
  subscribeToSecurityLogs: (onUpdate: (logs: any[]) => void): (() => void) => {
    const logsRef = collection(db, 'security_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(20));
    
    return onSnapshot(q, (snapshot) => {
      const logList: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Convert Firestore Timestamp to millis if exists
        const timestamp = data.timestamp?.toMillis ? data.timestamp.toMillis() : data.timestamp;
        logList.push({ 
          id: docSnap.id, 
          ...data,
          timestamp 
        });
      });
      onUpdate(logList);
    }, (error) => {
      console.error("Error in subscribeToSecurityLogs:", error);
      onUpdate([]);
    });
  }
};
