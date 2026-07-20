// src/services/userService.ts
import { db, app } from '../lib/firebaseConfig';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { storageService } from './storageService';

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'schooladmin' | 'teacher' | 'student' | 'registrar';
  schoolId: string | null;
  status: 'active' | 'inactive';
  createdAt: any;
  studentId?: string | null;
  isMainAdmin?: boolean;
  tempPassword?: string;
  password?: string;
  requirePasswordChange?: boolean;
  department?: string;
  classId?: string | null;
  dob?: string;
  gender?: string;
  address?: string;
  guardianName?: string;
  guardianContact?: string;
  passportPhoto?: string | null;
}

export const userService = {
  /**
   * Subscribes to all active users with role 'schooladmin' across the platform.
   */
  subscribeToSchoolAdmins: (onUpdate: (admins: UserData[]) => void): (() => void) => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'schooladmin'));

    return onSnapshot(q, (snapshot) => {
      const adminList: UserData[] = [];
      snapshot.forEach(docSnap => {
        const admin = docSnap.data() as UserData;
        if (admin.status !== 'inactive') {
          adminList.push({ ...admin, id: docSnap.id });
        }
      });
      onUpdate(adminList);
    }, (error) => {
      console.error("Error in subscribeToSchoolAdmins:", error);
      onUpdate([]);
    });
  },

  /**
   * Subscribes to all users belonging to a specific school ID.
   */
  subscribeToSchoolUsers: (schoolId: string, onUpdate: (users: UserData[]) => void): (() => void) => {
    const usersRef = collection(db, 'schools', schoolId, 'users');

    return onSnapshot(usersRef, (snapshot) => {
      const userList: UserData[] = [];
      snapshot.forEach(docSnap => {
        userList.push({ ...docSnap.data() as UserData, id: docSnap.id });
      });
      onUpdate(userList);
    }, (error) => {
      console.error("Error in subscribeToSchoolUsers:", error);
      onUpdate([]);
    });
  },

  /**
   * Generates the next sequential student ID for a given school ID (e.g., dragons-0001, dragons-0002).
   */
  getNextStudentId: async (schoolId: string): Promise<string> => {
    const usersRef = collection(db, 'schools', schoolId, 'users');
    const q = query(usersRef, where('role', '==', 'student'));
    const snapshot = await getDocs(q);
    
    let maxNum = 0;
    const prefix = `${schoolId.toLowerCase()}-`;
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const sId = data.studentId;
      if (sId && typeof sId === 'string') {
        const sIdLower = sId.toLowerCase();
        if (sIdLower.startsWith(prefix)) {
          const numPart = sIdLower.substring(prefix.length);
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    
    const nextNum = maxNum + 1;
    const paddedNum = String(nextNum).padStart(4, '0');
    return `${schoolId}-${paddedNum}`;
  },

  /**
   * Provision a new user account (student, teacher, or assistant admin) using a secondary Firebase app container.
   */
  provisionUserAccount: async (
    name: string,
    email: string,
    role: 'schooladmin' | 'teacher' | 'student' | 'registrar',
    schoolId: string,
    studentIdInput?: string,
    customPassword?: string
  ): Promise<{ uid: string; defaultPassword: string }> => {
    // 1. Determine final studentId and email
    let finalStudentId = studentIdInput?.trim() || "";
    if (role === 'student') {
      if (!finalStudentId || finalStudentId.startsWith('STU-') || !finalStudentId.includes('-')) {
        finalStudentId = await userService.getNextStudentId(schoolId);
      }
    }

    let finalEmail = email.toLowerCase().trim();
    if (role === 'student' && !finalEmail) {
      finalEmail = `${finalStudentId.toLowerCase()}@${schoolId}.school`;
    }
    if (!finalEmail) throw new Error("Email is required.");

    // 2. Generate/Determine Password
    const firstName = name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
    const defaultPassword = customPassword || `${schoolId.toUpperCase()}-${firstName}`;

    // 3. Initialize Secondary Firebase App instance
    const secondaryAppName = `UserCreation-${Date.now()}`;
    const secondaryApp = initializeApp(app.options, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // For schooladmins, determine if they are the main admin of the school
      let isMainAdmin = false;
      if (role === 'schooladmin') {
        const usersRef = collection(db, 'schools', schoolId, 'users');
        const snapshot = await getDocs(usersRef);
        
        let hasExistingActiveAdmin = false;
        snapshot.forEach(docSnap => {
          const u = docSnap.data();
          if (u.role === 'schooladmin' && u.status === 'active') {
            hasExistingActiveAdmin = true;
          }
        });
        isMainAdmin = !hasExistingActiveAdmin;
      }

      // 4. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, defaultPassword);
      const uid = userCredential.user.uid;

      // 5. Construct profile data
      const profileData: any = {
        id: uid,
        name,
        email: finalEmail,
        role,
        schoolId,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      if (role === 'student') {
        profileData.studentId = finalStudentId || null;
      }
      
      if (role === 'schooladmin') {
        profileData.isMainAdmin = isMainAdmin;
      } else {
        // Teachers / Students / Registrars get tempPassword for enrollment handoff
        profileData.tempPassword = defaultPassword;
        profileData.password = defaultPassword;
        profileData.requirePasswordChange = true;
      }

      // Save to global pointer doc
      const globalRef = doc(db, 'users', uid);
      await setDoc(globalRef, {
        id: uid,
        name,
        email: finalEmail,
        role,
        schoolId,
        status: 'active',
        createdAt: serverTimestamp()
      });

      // Save to school node subcollection
      const schoolUserRef = doc(db, 'schools', schoolId, 'users', uid);
      await setDoc(schoolUserRef, profileData);

      // 6. Cleanup secondary auth & app
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      return { uid, defaultPassword };
    } catch (err: any) {
      await deleteApp(secondaryApp).catch(() => {});
      throw err;
    }
  },

  /**
   * Promotes or revokes an administrator's "Main Admin" ownership badge.
   */
  toggleMainAdmin: async (adminId: string, schoolId: string, currentMainStatus: boolean): Promise<void> => {
    const newStatus = !currentMainStatus;

    // If promoting, we must unset any existing main admin for this school
    if (newStatus) {
      const usersRef = collection(db, 'schools', schoolId, 'users');
      const snapshot = await getDocs(usersRef);
      
      const promises: Promise<void>[] = [];
      snapshot.forEach(docSnap => {
        const u = docSnap.data();
        if (u.isMainAdmin && docSnap.id !== adminId) {
          promises.push(updateDoc(doc(db, 'schools', schoolId, 'users', docSnap.id), { isMainAdmin: false }));
          
          const globalRef = doc(db, 'users', docSnap.id);
          promises.push(
            getDoc(globalRef).then(async (snap) => {
              if (snap.exists()) {
                await updateDoc(globalRef, { isMainAdmin: false });
              }
            })
          );
        }
      });
      
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    }

    // Set the new status for the target admin
    const globalAdminRef = doc(db, 'users', adminId);
    const globalAdminSnap = await getDoc(globalAdminRef);
    if (globalAdminSnap.exists()) {
      await updateDoc(globalAdminRef, { isMainAdmin: newStatus });
    }

    const schoolAdminRef = doc(db, 'schools', schoolId, 'users', adminId);
    const schoolAdminSnap = await getDoc(schoolAdminRef);
    if (schoolAdminSnap.exists()) {
      await updateDoc(schoolAdminRef, { isMainAdmin: newStatus });
    } else if (globalAdminSnap.exists()) {
      const globalAdminData = globalAdminSnap.data();
      await setDoc(schoolAdminRef, { ...globalAdminData, isMainAdmin: newStatus });
    }
  },

  /**
   * Assigns a school administrator to a school node in Firestore.
   */
  assignSchoolNode: async (adminId: string, targetSchoolId: string): Promise<void> => {
    const userRef = doc(db, 'users', adminId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      console.warn(`User document with ID ${adminId} does not exist globally.`);
      return;
    }
    const currentData = snap.data();
    const oldSchoolId = currentData?.schoolId;

    const usersRef = collection(db, 'schools', targetSchoolId, 'users');
    const snapshot = await getDocs(usersRef);
    
    let hasMainAdmin = false;
    snapshot.forEach(docSnap => {
      const u = docSnap.data();
      if (u.isMainAdmin === true && u.status === 'active') {
        hasMainAdmin = true;
      }
    });

    const updates: any = { schoolId: targetSchoolId };
    if (!hasMainAdmin) {
      updates.isMainAdmin = true;
    } else {
      updates.isMainAdmin = false;
    }

    // Update global pointer
    await updateDoc(userRef, updates);

    // Delete old school document if it existed
    if (oldSchoolId) {
      await deleteDoc(doc(db, 'schools', oldSchoolId, 'users', adminId));
    }

    // Save full document to new school subcollection
    const newProfile = { ...(currentData || {}), ...updates };
    await setDoc(doc(db, 'schools', targetSchoolId, 'users', adminId), newProfile);
  },

  /**
   * Terminates access for a school admin/user, updating their status.
   */
  terminateAccess: async (userId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      console.warn(`User document with ID ${userId} does not exist globally.`);
      return;
    }
    const userData = snap.data();

    const updates = { 
      status: 'inactive',
      schoolId: null,
      isMainAdmin: false
    };

    await updateDoc(userRef, updates);

    if (userData && userData.schoolId) {
      const schoolUserRef = doc(db, 'schools', userData.schoolId, 'users', userId);
      const schoolSnap = await getDoc(schoolUserRef);
      if (schoolSnap.exists()) {
        await updateDoc(schoolUserRef, updates);
      }
    }
  },

  updateProfileDetails: async (userId: string, updates: Partial<UserData>): Promise<void> => {
    const finalUpdates = { ...updates };
    
    // Intercept and upload base64 passportPhoto to Firebase Storage
    if (updates.passportPhoto && updates.passportPhoto.startsWith('data:')) {
      try {
        const extMatch = updates.passportPhoto.match(/data:image\/(.*?);/);
        const ext = extMatch ? extMatch[1] : 'png';
        
        finalUpdates.passportPhoto = await storageService.uploadBase64Image(
          `users/${userId}/passport_${Date.now()}.${ext}`,
          updates.passportPhoto
        );
      } catch (err) {
        console.warn("Skipped storing passport photo to storage, falling back to database storage:", err);
      }
    }
    
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, finalUpdates);
      const userData = snap.data();
      if (userData && userData.schoolId) {
        const schoolUserRef = doc(db, 'schools', userData.schoolId, 'users', userId);
        const schoolSnap = await getDoc(schoolUserRef);
        if (schoolSnap.exists()) {
          await updateDoc(schoolUserRef, finalUpdates);
        } else {
          await setDoc(schoolUserRef, { ...userData, ...finalUpdates });
        }
      }
    } else {
      console.warn(`User document with ID ${userId} does not exist globally.`);
    }
  },

  /**
   * Retrieves profile details for a specific user ID from Firestore.
   */
  getUserProfile: async (userId: string): Promise<UserData | null> => {
    try {
      const userRef = doc(db, 'users', userId);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.data() as UserData;
        if (userData.schoolId && userData.schoolId !== 'system-global') {
          const schoolUserRef = doc(db, 'schools', userData.schoolId, 'users', userId);
          const schoolSnap = await getDoc(schoolUserRef);
          if (schoolSnap.exists()) {
            return schoolSnap.data() as UserData;
          }
        }
        return userData;
      }
      return null;
    } catch (err) {
      console.error("Error fetching user profile from Firestore:", err);
      return null;
    }
  },

  /**
   * Permanently deletes a user's database profile from Firestore.
   */
  deleteUserProfile: async (userId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    const userData = snap.exists() ? snap.data() : null;

    await deleteDoc(userRef);

    if (userData && userData.schoolId) {
      const schoolUserRef = doc(db, 'schools', userData.schoolId, 'users', userId);
      await deleteDoc(schoolUserRef);
    }
  }
};
