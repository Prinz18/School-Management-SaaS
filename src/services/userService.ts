// src/services/userService.ts
import { app } from '../lib/firebaseConfig';
import { dbAdapter } from '../lib/dbAdapter';
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
  passportPhotoPath?: string | null;
}

export const userService = {
  /**
   * Subscribes to all active users with role 'schooladmin' across the platform.
   */
  subscribeToSchoolAdmins: (onUpdate: (admins: UserData[]) => void): (() => void) => {
    return dbAdapter.subscribeToPath('users', (users) => {
      const adminList = users
        .filter(u => u.role === 'schooladmin' && u.status !== 'inactive')
        .map(u => u as UserData);
      onUpdate(adminList);
    });
  },

  /**
   * Subscribes to all users belonging to a specific school ID.
   */
  subscribeToSchoolUsers: (schoolId: string, onUpdate: (users: UserData[]) => void): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/users`, (users) => {
      onUpdate(users as UserData[]);
    });
  },

  /**
   * Subscribes to all users across all schools. Each user is tagged with their schoolId and schoolName.
   * Used by the Agent (superadmin) password recovery panel.
   */
  subscribeToAllSchoolUsers: (onUpdate: (users: (UserData & { schoolName?: string })[]) => void): (() => void) => {
    let allUsers: (UserData & { schoolName?: string })[] = [];
    const schoolUnsubMap = new Map<string, () => void>();
    let schoolsUnsub: (() => void) | null = null;

    const notifyUpdate = () => {
      onUpdate([...allUsers]);
    };

    schoolsUnsub = dbAdapter.subscribeToPath('schools', (schools) => {
      const currentSchoolIds = new Set(schools.map(s => s.schoolId || s.id));

      // Remove listeners for deleted schools
      schoolUnsubMap.forEach((unsub, schoolId) => {
        if (!currentSchoolIds.has(schoolId)) {
          unsub();
          schoolUnsubMap.delete(schoolId);
          allUsers = allUsers.filter(u => u.schoolId !== schoolId);
        }
      });

      // Add listeners for new schools
      schools.forEach((school) => {
        const schoolId = school.schoolId || school.id;
        if (!schoolUnsubMap.has(schoolId)) {
          const unsub = dbAdapter.subscribeToPath(`schools/${schoolId}/users`, (users) => {
            // Remove old users from this school
            allUsers = allUsers.filter(u => u.schoolId !== schoolId);
            // Add updated users from this school
            const schoolUsers = (users as UserData[]).map(u => ({
              ...u,
              schoolId,
              schoolName: school.name || schoolId
            }));
            allUsers = [...allUsers, ...schoolUsers];
            notifyUpdate();
          });
          schoolUnsubMap.set(schoolId, unsub);
        }
      });

      notifyUpdate();
    });

    return () => {
      if (schoolsUnsub) schoolsUnsub();
      schoolUnsubMap.forEach(unsub => unsub());
      schoolUnsubMap.clear();
    };
  },

  /**
   * Generates the next sequential student ID for a given school ID (e.g., dragons-0001, dragons-0002).
   */
  getNextStudentId: async (schoolId: string): Promise<string> => {
    const schoolUsers = await dbAdapter.getDocsByQuery(`schools/${schoolId}/users`, 'role', 'student');
    
    let maxNum = 0;
    const prefix = `${schoolId.toLowerCase()}-`;
    
    schoolUsers.forEach(u => {
      const sId = u.studentId;
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

    const firstName = name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
    const defaultPassword = customPassword || `${schoolId.toUpperCase()}-${firstName}`;

    const secondaryAppName = `UserCreation-${Date.now()}`;
    const secondaryApp = initializeApp(app.options, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      let isMainAdmin = false;
      if (role === 'schooladmin') {
        const existingUsers = await dbAdapter.getDocsByQuery(`schools/${schoolId}/users`, 'role', 'schooladmin');
        const hasActiveAdmin = existingUsers.some(u => u.status === 'active');
        isMainAdmin = !hasActiveAdmin;
      }

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, defaultPassword);
      const uid = userCredential.user.uid;

      const profileData: any = {
        id: uid,
        name,
        email: finalEmail,
        role,
        schoolId,
        status: 'active',
        createdAt: Date.now(),
      };

      if (role === 'student') {
        profileData.studentId = finalStudentId || null;
      }
      
      if (role === 'schooladmin') {
        profileData.isMainAdmin = isMainAdmin;
      }
      
      profileData.tempPassword = defaultPassword;
      profileData.password = defaultPassword;
      profileData.requirePasswordChange = true;

      // Save to global pointer doc
      await dbAdapter.setDoc(`users/${uid}`, {
        id: uid,
        name,
        email: finalEmail,
        role,
        schoolId,
        status: 'active',
        createdAt: Date.now()
      });

      // Save to school node subcollection
      await dbAdapter.setDoc(`schools/${schoolId}/users/${uid}`, profileData);

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

    if (newStatus) {
      const existingUsers = await dbAdapter.getDocsByQuery(`schools/${schoolId}/users`, 'role', 'schooladmin');
      for (const u of existingUsers) {
        if (u.isMainAdmin && u.id !== adminId) {
          await dbAdapter.updateDoc(`schools/${schoolId}/users/${u.id}`, { isMainAdmin: false });
          await dbAdapter.updateDoc(`users/${u.id}`, { isMainAdmin: false });
        }
      }
    }

    await dbAdapter.updateDoc(`users/${adminId}`, { isMainAdmin: newStatus });
    await dbAdapter.updateDoc(`schools/${schoolId}/users/${adminId}`, { isMainAdmin: newStatus });
  },

  /**
   * Assigns a school administrator to a school node.
   */
  assignSchoolNode: async (adminId: string, targetSchoolId: string): Promise<void> => {
    const globalRes = await dbAdapter.getDoc(`users/${adminId}`);
    if (!globalRes.exists) {
      console.warn(`User node ${adminId} does not exist globally.`);
      return;
    }
    const currentData = globalRes.data;
    const oldSchoolId = currentData?.schoolId;

    const existingAdmins = await dbAdapter.getDocsByQuery(`schools/${targetSchoolId}/users`, 'role', 'schooladmin');
    const hasMainAdmin = existingAdmins.some(u => u.isMainAdmin === true && u.status === 'active');

    const updates: any = { schoolId: targetSchoolId, isMainAdmin: !hasMainAdmin };

    await dbAdapter.updateDoc(`users/${adminId}`, updates);

    if (oldSchoolId) {
      await dbAdapter.deleteDoc(`schools/${oldSchoolId}/users/${adminId}`);
    }

    const newProfile = { ...(currentData || {}), ...updates };
    await dbAdapter.setDoc(`schools/${targetSchoolId}/users/${adminId}`, newProfile);
  },

  /**
   * Terminates access for a school admin/user.
   */
  terminateAccess: async (userId: string): Promise<void> => {
    const globalRes = await dbAdapter.getDoc(`users/${userId}`);
    if (!globalRes.exists) return;
    const userData = globalRes.data;

    const updates = { 
      status: 'inactive',
      schoolId: null,
      isMainAdmin: false
    };

    await dbAdapter.updateDoc(`users/${userId}`, updates);

    if (userData && userData.schoolId) {
      await dbAdapter.updateDoc(`schools/${userData.schoolId}/users/${userId}`, updates);
    }
  },

  updateProfileDetails: async (userId: string, updates: Partial<UserData>): Promise<void> => {
    const finalUpdates = { ...updates };
    
    if (updates.passportPhoto && updates.passportPhoto.startsWith('data:')) {
      try {
        const extMatch = updates.passportPhoto.match(/data:image\/(.*?);/);
        const ext = extMatch ? extMatch[1] : 'png';
        const photoPath = `users/${userId}/passport_${Date.now()}.${ext}`;
        
        finalUpdates.passportPhoto = await storageService.uploadBase64Image(photoPath, updates.passportPhoto);
        finalUpdates.passportPhotoPath = photoPath;
      } catch (err) {
        console.warn("Skipped storing passport photo to storage, falling back to database storage:", err);
      }
    }
    
    const globalRes = await dbAdapter.getDoc(`users/${userId}`);
    if (globalRes.exists) {
      await dbAdapter.updateDoc(`users/${userId}`, finalUpdates);
      const userData = globalRes.data;
      if (userData && userData.schoolId) {
        const schoolRes = await dbAdapter.getDoc(`schools/${userData.schoolId}/users/${userId}`);
        if (schoolRes.exists) {
          await dbAdapter.updateDoc(`schools/${userData.schoolId}/users/${userId}`, finalUpdates);
        } else {
          await dbAdapter.setDoc(`schools/${userData.schoolId}/users/${userId}`, { ...userData, ...finalUpdates });
        }
      }
    }
  },

  deletePassportPhoto: async (userId: string): Promise<void> => {
    const globalRes = await dbAdapter.getDoc(`users/${userId}`);
    if (!globalRes.exists) return;

    const userData = globalRes.data as UserData;
    const photoPath = userData.passportPhotoPath || null;

    if (photoPath) {
      await storageService.deleteFile(photoPath);
    }

    const updates = {
      passportPhoto: null,
      passportPhotoPath: null
    };

    await dbAdapter.updateDoc(`users/${userId}`, updates);

    if (userData.schoolId) {
      const schoolRes = await dbAdapter.getDoc(`schools/${userData.schoolId}/users/${userId}`);
      if (schoolRes.exists) {
        await dbAdapter.updateDoc(`schools/${userData.schoolId}/users/${userId}`, updates);
      }
    }
  },

  /**
   * Retrieves profile details for a specific user ID.
   */
  getUserProfile: async (userId: string): Promise<UserData | null> => {
    try {
      const globalRes = await dbAdapter.getDoc(`users/${userId}`);
      if (globalRes.exists) {
        const userData = globalRes.data as UserData;
        if (userData.schoolId && userData.schoolId !== 'system-global') {
          const schoolRes = await dbAdapter.getDoc(`schools/${userData.schoolId}/users/${userId}`);
          if (schoolRes.exists) {
            return schoolRes.data as UserData;
          }
        }
        return userData;
      }
      return null;
    } catch (err) {
      console.error("Error fetching user profile:", err);
      return null;
    }
  },

  /**
   * Permanently deletes a user profile.
   */
  deleteUserProfile: async (userId: string): Promise<void> => {
    const globalRes = await dbAdapter.getDoc(`users/${userId}`);
    const userData = globalRes.exists ? globalRes.data : null;

    await dbAdapter.deleteDoc(`users/${userId}`);

    if (userData && userData.schoolId) {
      await dbAdapter.deleteDoc(`schools/${userData.schoolId}/users/${userId}`);
    }
  }
};
