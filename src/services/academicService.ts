// src/services/academicService.ts
import { db } from '../lib/firebaseConfig';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

export interface ClassData {
  id: string;
  name: string;
  schoolId: string;
  createdAt: number;
}

export interface SubjectData {
  id: string;
  name: string;
  schoolId: string;
  createdAt: number;
}

export interface AssignmentData {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  schoolId: string;
  createdAt: number;
}

export const academicService = {
  // ==========================================
  // CLASSROOM SERVICES (CLASSES)
  // ==========================================

  /**
   * Creates a new classroom inside a school's subcollection.
   */
  createClass: async (name: string, schoolId: string): Promise<void> => {
    const classesRef = collection(db, 'schools', schoolId, 'classes');
    await addDoc(classesRef, {
      name: name.trim(),
      schoolId,
      createdAt: serverTimestamp()
    });
  },

  /**
   * Deletes a classroom from a school's subcollection.
   */
  deleteClass: async (schoolId: string, classId: string): Promise<void> => {
    const classRef = doc(db, 'schools', schoolId, 'classes', classId);
    await deleteDoc(classRef);
  },

  /**
   * Real-time subscription to a school's classrooms.
   */
  subscribeToSchoolClasses: (schoolId: string, onUpdate: (classes: ClassData[]) => void): (() => void) => {
    const classesRef = collection(db, 'schools', schoolId, 'classes');

    return onSnapshot(classesRef, (snapshot) => {
      const classList: ClassData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        classList.push({
          id: docSnap.id,
          name: data.name || '',
          schoolId: data.schoolId || '',
          createdAt: createdAt || 0
        });
      });
      classList.sort((a, b) => a.name.localeCompare(b.name));
      onUpdate(classList);
    }, (error) => {
      console.error("Error subscribing to classes:", error);
      onUpdate([]);
    });
  },

  /**
   * Assigns a student to a classroom, updating both global and local nodes.
   */
  assignStudentToClass: async (studentId: string, classId: string | null): Promise<void> => {
    const userRef = doc(db, 'users', studentId);
    const snap = await getDoc(userRef);
    const userData = snap.exists() ? snap.data() : null;

    await updateDoc(userRef, { classId });

    if (userData && userData.schoolId) {
      const schoolUserRef = doc(db, 'schools', userData.schoolId, 'users', studentId);
      await updateDoc(schoolUserRef, { classId });
    }
  },

  // ==========================================
  // SUBJECT SERVICES
  // ==========================================

  /**
   * Creates a new curriculum subject inside a school's subcollection.
   */
  createSubject: async (name: string, schoolId: string): Promise<void> => {
    const subjectsRef = collection(db, 'schools', schoolId, 'subjects');
    await addDoc(subjectsRef, {
      name: name.trim(),
      schoolId,
      createdAt: serverTimestamp()
    });
  },

  /**
   * Deletes a curriculum subject from a school's subcollection.
   */
  deleteSubject: async (schoolId: string, subjectId: string): Promise<void> => {
    const subjectRef = doc(db, 'schools', schoolId, 'subjects', subjectId);
    await deleteDoc(subjectRef);
  },

  /**
   * Real-time subscription to school-wide subjects.
   */
  subscribeToSchoolSubjects: (schoolId: string, onUpdate: (subjects: SubjectData[]) => void): (() => void) => {
    const subjectsRef = collection(db, 'schools', schoolId, 'subjects');

    return onSnapshot(subjectsRef, (snapshot) => {
      const subjectList: SubjectData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        subjectList.push({
          id: docSnap.id,
          name: data.name || '',
          schoolId: data.schoolId || '',
          createdAt: createdAt || 0
        });
      });
      subjectList.sort((a, b) => a.name.localeCompare(b.name));
      onUpdate(subjectList);
    }, (error) => {
      console.error("Error subscribing to subjects:", error);
      onUpdate([]);
    });
  },

  // ==========================================
  // TEACHER ASSIGNMENTS SERVICES
  // ==========================================

  /**
   * Assigns a teacher to teach a specific subject in a specific classroom.
   */
  assignTeacher: async (
    teacherId: string,
    teacherName: string,
    classId: string,
    className: string,
    subjectId: string,
    subjectName: string,
    schoolId: string
  ): Promise<void> => {
    const assignmentsRef = collection(db, 'schools', schoolId, 'assignments');
    await addDoc(assignmentsRef, {
      teacherId,
      teacherName,
      classId,
      className,
      subjectId,
      subjectName,
      schoolId,
      createdAt: serverTimestamp()
    });
  },

  /**
   * Revokes an existing teacher assignment.
   */
  revokeAssignment: async (schoolId: string, assignmentId: string): Promise<void> => {
    const assignmentRef = doc(db, 'schools', schoolId, 'assignments', assignmentId);
    await deleteDoc(assignmentRef);
  },

  /**
   * Real-time subscription to school-wide teacher assignments.
   */
  subscribeToSchoolAssignments: (schoolId: string, onUpdate: (assignments: AssignmentData[]) => void): (() => void) => {
    const assignmentsRef = collection(db, 'schools', schoolId, 'assignments');

    return onSnapshot(assignmentsRef, (snapshot) => {
      const assignmentList: AssignmentData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        assignmentList.push({
          id: docSnap.id,
          teacherId: data.teacherId || '',
          teacherName: data.teacherName || '',
          classId: data.classId || '',
          className: data.className || '',
          subjectId: data.subjectId || '',
          subjectName: data.subjectName || '',
          schoolId: data.schoolId || '',
          createdAt: createdAt || 0
        });
      });
      assignmentList.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(assignmentList);
    }, (error) => {
      console.error("Error subscribing to assignments:", error);
      onUpdate([]);
    });
  },

  /**
   * Real-time subscription to a specific teacher's assignments.
   */
  subscribeToTeacherAssignments: (teacherId: string, schoolId: string, onUpdate: (assignments: AssignmentData[]) => void): (() => void) => {
    const assignmentsRef = collection(db, 'schools', schoolId, 'assignments');
    const assignmentsQuery = query(assignmentsRef, where('teacherId', '==', teacherId));

    return onSnapshot(assignmentsQuery, (snapshot) => {
      const assignmentList: AssignmentData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        assignmentList.push({
          id: docSnap.id,
          teacherId: data.teacherId || '',
          teacherName: data.teacherName || '',
          classId: data.classId || '',
          className: data.className || '',
          subjectId: data.subjectId || '',
          subjectName: data.subjectName || '',
          schoolId: data.schoolId || '',
          createdAt: createdAt || 0
        });
      });
      assignmentList.sort((a, b) => a.className.localeCompare(b.className));
      onUpdate(assignmentList);
    }, (error) => {
      console.error("Error subscribing to teacher assignments:", error);
      onUpdate([]);
    });
  }
};
