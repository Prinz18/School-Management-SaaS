// src/services/gradeService.ts
import { dbAdapter } from '../lib/dbAdapter';

export interface GradeData {
  id: string;
  studentId: string;
  teacherId: string;
  schoolId: string;
  subject: string;
  score: number;
  maxScore: number;
  term: string;
  academicYear?: string;
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
    term: string,
    academicYear?: string
  ): Promise<void> => {
    await dbAdapter.pushDoc(`schools/${schoolId}/grades`, {
      studentId,
      teacherId,
      schoolId,
      subject,
      score,
      maxScore,
      term,
      academicYear: academicYear || '',
      createdAt: Date.now()
    });
  },

  /**
   * Subscribes to grades filtered by student ID.
   */
  subscribeToStudentGrades: (studentId: string, schoolId: string, onUpdate: (grades: GradeData[]) => void, academicYear?: string): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/grades`, (list) => {
      const gradeList: GradeData[] = list
        .filter(data => data.studentId === studentId && (!academicYear || !data.academicYear || data.academicYear === academicYear))
        .map(data => ({
          id: data.id,
          studentId: data.studentId || '',
          teacherId: data.teacherId || '',
          schoolId: data.schoolId || schoolId,
          subject: data.subject || '',
          score: data.score || 0,
          maxScore: data.maxScore || 100,
          term: data.term || '',
          academicYear: data.academicYear || '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
        }));
      onUpdate(gradeList);
    });
  },

  /**
   * Subscribes to grades uploaded by a specific teacher.
   */
  subscribeToTeacherGrades: (teacherId: string, schoolId: string, onUpdate: (grades: GradeData[]) => void, academicYear?: string): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/grades`, (list) => {
      const gradeList: GradeData[] = list
        .filter(data => data.teacherId === teacherId && (!academicYear || !data.academicYear || data.academicYear === academicYear))
        .map(data => ({
          id: data.id,
          studentId: data.studentId || '',
          teacherId: data.teacherId || '',
          schoolId: data.schoolId || schoolId,
          subject: data.subject || '',
          score: data.score || 0,
          maxScore: data.maxScore || 100,
          term: data.term || '',
          academicYear: data.academicYear || '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
        }));
      onUpdate(gradeList);
    });
  },

  /**
   * Subscribes to all grades in a school.
   */
  subscribeToSchoolGrades: (schoolId: string, onUpdate: (grades: GradeData[]) => void, academicYear?: string): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/grades`, (list) => {
      const gradeList: GradeData[] = list.map(data => ({
        id: data.id,
        studentId: data.studentId || '',
        teacherId: data.teacherId || '',
        schoolId: data.schoolId || schoolId,
        subject: data.subject || '',
          score: data.score || 0,
        maxScore: data.maxScore || 100,
        term: data.term || '',
        academicYear: data.academicYear || '',
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
      })).filter(data => !academicYear || !data.academicYear || data.academicYear === academicYear);
      onUpdate(gradeList);
    });
  },

  /**
   * Deletes a grade entry by ID.
   */
  deleteGrade: async (schoolId: string, gradeId: string): Promise<void> => {
    await dbAdapter.deleteDoc(`schools/${schoolId}/grades/${gradeId}`);
  },

  /**
   * Updates a grade entry by ID.
   */
  updateGrade: async (schoolId: string, gradeId: string, updates: Partial<GradeData>): Promise<void> => {
    await dbAdapter.updateDoc(`schools/${schoolId}/grades/${gradeId}`, updates);
  }
};
