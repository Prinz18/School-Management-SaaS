// src/services/attendanceService.ts
import { dbAdapter } from '../lib/dbAdapter';

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
    const promises = Object.entries(attendanceMap).map(([studentId, status]) => {
      return dbAdapter.pushDoc(`schools/${schoolId}/attendance`, {
        studentId,
        schoolId,
        teacherId,
        status,
        date,
        createdAt: Date.now()
      });
    });

    await Promise.all(promises);
  },

  /**
   * Subscribes to attendance records filtered by student ID.
   */
  subscribeToStudentAttendance: (
    studentId: string,
    schoolId: string,
    onUpdate: (records: AttendanceRecord[]) => void
  ): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/attendance`, (list) => {
      const recordList: AttendanceRecord[] = list
        .filter(data => data.studentId === studentId)
        .map(data => ({
          id: data.id,
          studentId: data.studentId || '',
          schoolId: data.schoolId || schoolId,
          teacherId: data.teacherId || '',
          status: data.status || 'present',
          date: data.date || '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
        }));
      recordList.sort((a, b) => b.date.localeCompare(a.date));
      onUpdate(recordList);
    });
  },

  /**
   * Subscribes to attendance records filtered by school and date.
   */
  subscribeToSchoolAttendanceByDate: (
    schoolId: string,
    date: string,
    onUpdate: (records: AttendanceRecord[]) => void
  ): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/attendance`, (list) => {
      const recordList: AttendanceRecord[] = list
        .filter(data => data.date === date)
        .map(data => ({
          id: data.id,
          studentId: data.studentId || '',
          schoolId: data.schoolId || schoolId,
          teacherId: data.teacherId || '',
          status: data.status || 'present',
          date: data.date || '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
        }));
      onUpdate(recordList);
    });
  }
};
