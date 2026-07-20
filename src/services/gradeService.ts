// src/services/gradeService.ts
import { db } from '../lib/firebaseConfig';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

export interface GradeData {
  id: string;
  studentId: string;
  teacherId: string;
  schoolId: string;
  subject: string;
  score: number;
  maxScore: number;
  term: string;
  createdAt: number;
}

export const gradeService = {
  /**
   * Submits a grade for a student.
   */
  uploadGrade: async (
    studentId: string,
    teacherId: string,
    schoolId: string,
    subject: string,
    score: number,
    maxScore: number,
    term: string
  ): Promise<void> => {
    const gradesRef = collection(db, 'schools', schoolId, 'grades');
    await addDoc(gradesRef, {
      studentId,
      teacherId,
      schoolId,
      subject,
      score,
      maxScore,
      term,
      createdAt: serverTimestamp()
    });
  },

  /**
   * Subscribes to grades filtered by student ID.
   */
  subscribeToStudentGrades: (studentId: string, schoolId: string, onUpdate: (grades: GradeData[]) => void): (() => void) => {
    const gradesRef = collection(db, 'schools', schoolId, 'grades');
    const gradesQuery = query(gradesRef, where('studentId', '==', studentId));

    return onSnapshot(gradesQuery, (snapshot) => {
      const gradeList: GradeData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        gradeList.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          teacherId: data.teacherId || '',
          schoolId: data.schoolId || '',
          subject: data.subject || '',
          score: data.score || 0,
          maxScore: data.maxScore || 100,
          term: data.term || '',
          createdAt: createdAt || 0
        });
      });
      onUpdate(gradeList);
    }, (error) => {
      console.error("Error subscribing to student grades:", error);
      onUpdate([]);
    });
  },

  /**
   * Subscribes to grades uploaded by a specific teacher.
   */
  subscribeToTeacherGrades: (teacherId: string, schoolId: string, onUpdate: (grades: GradeData[]) => void): (() => void) => {
    const gradesRef = collection(db, 'schools', schoolId, 'grades');
    const gradesQuery = query(gradesRef, where('teacherId', '==', teacherId));

    return onSnapshot(gradesQuery, (snapshot) => {
      const gradeList: GradeData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        gradeList.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          teacherId: data.teacherId || '',
          schoolId: data.schoolId || '',
          subject: data.subject || '',
          score: data.score || 0,
          maxScore: data.maxScore || 100,
          term: data.term || '',
          createdAt: createdAt || 0
        });
      });
      onUpdate(gradeList);
    }, (error) => {
      console.error("Error subscribing to teacher grades:", error);
      onUpdate([]);
    });
  },

  /**
   * Subscribes to all grades in a school. Useful for ranking.
   */
  subscribeToSchoolGrades: (schoolId: string, onUpdate: (grades: GradeData[]) => void): (() => void) => {
    const gradesRef = collection(db, 'schools', schoolId, 'grades');

    return onSnapshot(gradesRef, (snapshot) => {
      const gradeList: GradeData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        gradeList.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          teacherId: data.teacherId || '',
          schoolId: data.schoolId || '',
          subject: data.subject || '',
          score: data.score || 0,
          maxScore: data.maxScore || 100,
          term: data.term || '',
          createdAt: createdAt || 0
        });
      });
      onUpdate(gradeList);
    }, (error) => {
      console.error("Error subscribing to school grades:", error);
      onUpdate([]);
    });
  },

  /**
   * Deletes a grade entry by ID.
   */
  deleteGrade: async (schoolId: string, gradeId: string): Promise<void> => {
    const gradeRef = doc(db, 'schools', schoolId, 'grades', gradeId);
    await deleteDoc(gradeRef);
  },

  /**
   * Updates a grade entry by ID.
   */
  updateGrade: async (schoolId: string, gradeId: string, updates: Partial<GradeData>): Promise<void> => {
    const gradeRef = doc(db, 'schools', schoolId, 'grades', gradeId);
    await updateDoc(gradeRef, updates);
  }
};
