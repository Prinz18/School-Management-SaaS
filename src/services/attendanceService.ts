// src/services/attendanceService.ts
import { db } from '../lib/firebaseConfig';
import { 
  collection, 
  doc, 
  writeBatch, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  schoolId: string;
  teacherId: string;
  status: 'present' | 'absent' | 'late';
  date: string;
  createdAt: number;
}

export const attendanceService = {
  /**
   * Submits attendance records for a batch of students inside a school subcollection.
   */
  submitAttendanceBatch: async (
    attendanceMap: Record<string, 'present' | 'absent' | 'late'>,
    schoolId: string,
    teacherId: string,
    date: string
  ): Promise<void> => {
    const batch = writeBatch(db);
    const attendanceCollection = collection(db, 'schools', schoolId, 'attendance');
    
    Object.entries(attendanceMap).forEach(([studentId, status]) => {
      const docRef = doc(attendanceCollection);
      batch.set(docRef, {
        studentId,
        schoolId,
        teacherId,
        status,
        date, 
        createdAt: serverTimestamp(),
      });
    });
    
    await batch.commit();
  },

  /**
   * Subscribes to attendance records filtered by student ID.
   */
  subscribeToStudentAttendance: (
    studentId: string,
    schoolId: string,
    onUpdate: (records: AttendanceRecord[]) => void
  ): (() => void) => {
    const attendanceRef = collection(db, 'schools', schoolId, 'attendance');
    const attendanceQuery = query(attendanceRef, where('studentId', '==', studentId));
    
    return onSnapshot(attendanceQuery, (snapshot) => {
      const recordList: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        recordList.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          schoolId: data.schoolId || '',
          teacherId: data.teacherId || '',
          status: data.status || 'present',
          date: data.date || '',
          createdAt: createdAt || 0
        });
      });
      recordList.sort((a, b) => b.date.localeCompare(a.date));
      onUpdate(recordList);
    }, (error) => {
      console.warn("Error subscribing to student attendance:", error);
      onUpdate([]);
    });
  },

  /**
   * Subscribes to attendance records filtered by school and optional date.
   */
  subscribeToSchoolAttendanceByDate: (
    schoolId: string,
    date: string,
    onUpdate: (records: AttendanceRecord[]) => void
  ): (() => void) => {
    const attendanceRef = collection(db, 'schools', schoolId, 'attendance');
    const attendanceQuery = query(attendanceRef, where('date', '==', date));
    
    return onSnapshot(attendanceQuery, (snapshot) => {
      const recordList: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        recordList.push({
          id: docSnap.id,
          studentId: data.studentId || '',
          schoolId: data.schoolId || '',
          teacherId: data.teacherId || '',
          status: data.status || 'present',
          date: data.date || '',
          createdAt: createdAt || 0
        });
      });
      onUpdate(recordList);
    }, (error) => {
      console.warn("Error subscribing to school attendance by date:", error);
      onUpdate([]);
    });
  }
};
