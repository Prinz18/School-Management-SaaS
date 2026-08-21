// src/services/academicService.ts
import { dbAdapter } from '../lib/dbAdapter';

export interface ClassData {
  id: string;
  name: string;
  code?: string;
  gradeLevel?: string;
  roomNumber?: string;
  capacity?: number;
  advisorId?: string | null;
  advisorName?: string | null;
  academicYear?: string;
  schoolId: string;
  createdAt: number;
}

export interface SubjectData {
  id: string;
  name: string;
  code?: string;
  category?: string;
  creditHours?: number;
  passScore?: number;
  academicYear?: string;
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
  term?: string;
  schedulePeriod?: string;
  academicYear?: string;
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
  createClass: async (
    name: string,
    schoolId: string,
    extra?: {
      code?: string;
      gradeLevel?: string;
      roomNumber?: string;
      capacity?: number;
      advisorId?: string;
      advisorName?: string;
      academicYear?: string;
    }
  ): Promise<void> => {
    await dbAdapter.pushDoc(`schools/${schoolId}/classes`, {
      name: name.trim(),
      code: extra?.code?.trim() || '',
      gradeLevel: extra?.gradeLevel || 'General',
      roomNumber: extra?.roomNumber?.trim() || '',
      capacity: extra?.capacity || 40,
      advisorId: extra?.advisorId || null,
      advisorName: extra?.advisorName || null,
      academicYear: extra?.academicYear || '',
      schoolId,
      createdAt: Date.now()
    });
  },

  /**
   * Deletes a classroom from a school's subcollection.
   */
  deleteClass: async (schoolId: string, classId: string): Promise<void> => {
    await dbAdapter.deleteDoc(`schools/${schoolId}/classes/${classId}`);
  },

  /**
   * Updates an existing classroom inside a school's subcollection.
   */
  updateClass: async (
    schoolId: string,
    classId: string,
    updates: Partial<Pick<ClassData, 'name' | 'code' | 'gradeLevel' | 'roomNumber' | 'capacity' | 'advisorId' | 'advisorName'>>
  ): Promise<void> => {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.code !== undefined) payload.code = updates.code.trim();
    if (updates.gradeLevel !== undefined) payload.gradeLevel = updates.gradeLevel;
    if (updates.roomNumber !== undefined) payload.roomNumber = updates.roomNumber.trim();
    if (updates.capacity !== undefined) payload.capacity = updates.capacity;
    if (updates.advisorId !== undefined) payload.advisorId = updates.advisorId;
    if (updates.advisorName !== undefined) payload.advisorName = updates.advisorName;

    await dbAdapter.updateDoc(`schools/${schoolId}/classes/${classId}`, payload);
  },

  /**
   * Real-time subscription to a school's classrooms.
   */
  subscribeToSchoolClasses: (schoolId: string, onUpdate: (classes: ClassData[]) => void, academicYear?: string): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/classes`, (list) => {
      const classList: ClassData[] = list.map(data => ({
        id: data.id,
        name: data.name || '',
        code: data.code || '',
        gradeLevel: data.gradeLevel || 'General',
        roomNumber: data.roomNumber || '',
        capacity: data.capacity || 40,
        advisorId: data.advisorId || null,
        advisorName: data.advisorName || null,
        academicYear: data.academicYear || '',
        schoolId: data.schoolId || schoolId,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
      })).filter(data => !academicYear || !data.academicYear || data.academicYear === academicYear);
      classList.sort((a, b) => a.name.localeCompare(b.name));
      onUpdate(classList);
    });
  },

  /**
   * Assigns a student to a classroom.
   */
  assignStudentToClass: async (studentId: string, classId: string | null): Promise<void> => {
    const globalRes = await dbAdapter.getDoc(`users/${studentId}`);
    const userData = globalRes.exists ? globalRes.data : null;

    await dbAdapter.updateDoc(`users/${studentId}`, { classId });

    if (userData && userData.schoolId) {
      await dbAdapter.updateDoc(`schools/${userData.schoolId}/users/${studentId}`, { classId });
    }
  },

  // ==========================================
  // SUBJECT SERVICES
  // ==========================================

  /**
   * Creates a new curriculum subject inside a school's subcollection.
   */
  createSubject: async (
    name: string,
    schoolId: string,
    extra?: {
      code?: string;
      category?: string;
      creditHours?: number;
      passScore?: number;
      academicYear?: string;
    }
  ): Promise<void> => {
    await dbAdapter.pushDoc(`schools/${schoolId}/subjects`, {
      name: name.trim(),
      code: extra?.code?.trim() || '',
      category: extra?.category || 'Core STEM',
      creditHours: extra?.creditHours || 3.0,
      passScore: extra?.passScore || 70,
      academicYear: extra?.academicYear || '',
      schoolId,
      createdAt: Date.now()
    });
  },

  /**
   * Deletes a curriculum subject from a school's subcollection.
   */
  deleteSubject: async (schoolId: string, subjectId: string): Promise<void> => {
    await dbAdapter.deleteDoc(`schools/${schoolId}/subjects/${subjectId}`);
  },

  /**
   * Updates an existing curriculum subject inside a school's subcollection.
   */
  updateSubject: async (
    schoolId: string,
    subjectId: string,
    updates: Partial<Pick<SubjectData, 'name' | 'code' | 'category' | 'creditHours' | 'passScore'>>
  ): Promise<void> => {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.code !== undefined) payload.code = updates.code.trim();
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.creditHours !== undefined) payload.creditHours = updates.creditHours;
    if (updates.passScore !== undefined) payload.passScore = updates.passScore;

    await dbAdapter.updateDoc(`schools/${schoolId}/subjects/${subjectId}`, payload);
  },

  /**
   * Real-time subscription to school-wide subjects.
   */
  subscribeToSchoolSubjects: (schoolId: string, onUpdate: (subjects: SubjectData[]) => void, academicYear?: string): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/subjects`, (list) => {
      const subjectList: SubjectData[] = list.map(data => ({
        id: data.id,
        name: data.name || '',
        code: data.code || '',
        category: data.category || 'Core STEM',
        creditHours: typeof data.creditHours === 'number' ? data.creditHours : 3.0,
        passScore: typeof data.passScore === 'number' ? data.passScore : 70,
        academicYear: data.academicYear || '',
        schoolId: data.schoolId || schoolId,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
      })).filter(data => !academicYear || !data.academicYear || data.academicYear === academicYear);
      subjectList.sort((a, b) => a.name.localeCompare(b.name));
      onUpdate(subjectList);
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
    schoolId: string,
    extra?: {
      term?: string;
      schedulePeriod?: string;
      academicYear?: string;
    }
  ): Promise<void> => {
    await dbAdapter.pushDoc(`schools/${schoolId}/assignments`, {
      teacherId,
      teacherName,
      classId,
      className,
      subjectId,
      subjectName,
      term: extra?.term || '2025/2026 Academic Year',
      schedulePeriod: extra?.schedulePeriod || 'Mon - Fri',
      academicYear: extra?.academicYear || '',
      schoolId,
      createdAt: Date.now()
    });
  },

  /**
   * Revokes an existing teacher assignment.
   */
  revokeAssignment: async (schoolId: string, assignmentId: string): Promise<void> => {
    await dbAdapter.deleteDoc(`schools/${schoolId}/assignments/${assignmentId}`);
  },

  /**
   * Real-time subscription to school-wide teacher assignments.
   */
  subscribeToSchoolAssignments: (schoolId: string, onUpdate: (assignments: AssignmentData[]) => void, academicYear?: string): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/assignments`, (list) => {
      const assignmentList: AssignmentData[] = list.map(data => ({
        id: data.id,
        teacherId: data.teacherId || '',
        teacherName: data.teacherName || '',
        classId: data.classId || '',
        className: data.className || '',
        subjectId: data.subjectId || '',
        subjectName: data.subjectName || '',
        term: data.term || '2025/2026 Academic Year',
        schedulePeriod: data.schedulePeriod || 'Mon - Fri',
        academicYear: data.academicYear || '',
        schoolId: data.schoolId || schoolId,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
      })).filter(data => !academicYear || !data.academicYear || data.academicYear === academicYear);
      assignmentList.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(assignmentList);
    });
  },

  /**
   * Real-time subscription to a specific teacher's assignments.
   */
  subscribeToTeacherAssignments: (teacherId: string, schoolId: string, onUpdate: (assignments: AssignmentData[]) => void, academicYear?: string): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolId}/assignments`, (list) => {
      const assignmentList: AssignmentData[] = list
        .filter(data => data.teacherId === teacherId)
        .map(data => ({
          id: data.id,
          teacherId: data.teacherId || '',
          teacherName: data.teacherName || '',
          classId: data.classId || '',
          className: data.className || '',
          subjectId: data.subjectId || '',
          subjectName: data.subjectName || '',
          term: data.term || '2025/2026 Academic Year',
          schedulePeriod: data.schedulePeriod || 'Mon - Fri',
          academicYear: data.academicYear || '',
          schoolId: data.schoolId || schoolId,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now()
        }))
        .filter(data => !academicYear || !data.academicYear || data.academicYear === academicYear);
      assignmentList.sort((a, b) => (a.className || '').localeCompare(b.className || ''));
      onUpdate(assignmentList);
    });
  }
};
