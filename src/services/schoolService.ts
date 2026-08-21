// src/services/schoolService.ts
import { dbAdapter } from '../lib/dbAdapter';

export interface GradingTier {
  label: string;
  min: number;
  max: number;
}

export interface CustomField {
  label: string;
  value: string;
}

export interface ReportConfig {
  officialName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  principalTitle?: string;
  teacherTitle?: string;
  customFooter?: string;
  templateType?: 'official' | 'modern' | 'minimal' | 'vibrant' | 'playful' | 'simple_grid' | 'academic_beige' | 'ph_deped' | 'us_academy';
  showSeal?: boolean;
  showMinistryHeader?: boolean;
  showStudentRank?: boolean;
  showStudentID?: boolean;
  showSummaryBadge?: boolean;
  showSignatures?: boolean;
  showGradingScale?: boolean;
  gradingScale?: GradingTier[];
  customFields?: CustomField[];
  layoutOrder?: string[];
  logoUrl?: string;
  registrarSignatureUrl?: string;
  principalSignatureUrl?: string;
}

export interface SchoolData {
  id: string;
  name: string;
  address: string;
  schoolId: string;
  motto?: string;
  createdAt: number;
  status: 'active' | 'inactive';
  academicYears?: string[];
  currentAcademicYear?: string;
  reportConfig?: ReportConfig;
}

export interface PastRecordData {
  id: string;
  title: string;
  academicYear?: string;
  classId?: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  term?: string;
  note?: string;
  fileName: string;
  fileUrl: string;
  filePath?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: number;
  uploadedBy?: string;
}

const getDefaultAcademicYear = () => {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
};

export const schoolService = {
  /**
   * Registers a new school node in Realtime Database.
   */
  registerSchool: async (name: string, schoolIdSlug: string, address: string, motto?: string): Promise<void> => {
    const slug = schoolIdSlug.toLowerCase().trim().replace(/\s+/g, '-');
    await dbAdapter.setDoc(`schools/${slug}`, {
      id: slug,
      schoolId: slug,
      name,
      address,
      motto: motto || "",
      createdAt: Date.now(),
      status: 'active',
      reportConfig: {
        officialName: name,
        primaryColor: '#bf212f',
        secondaryColor: '#00205b',
        principalTitle: 'Principal of School',
        teacherTitle: 'Class Teacher / Registrar',
        customFooter: 'The Love of Liberty Brought Us Here',
        templateType: 'official',
        showSeal: true,
        showMinistryHeader: true,
        showStudentRank: true,
        showStudentID: true,
        showSummaryBadge: true,
        showSignatures: true,
        showGradingScale: true,
        gradingScale: [
          { label: 'A+', min: 95, max: 100 },
          { label: 'A', min: 90, max: 94 },
          { label: 'B+', min: 85, max: 89 },
          { label: 'B', min: 80, max: 84 },
          { label: 'C+', min: 75, max: 79 },
          { label: 'C', min: 70, max: 74 },
          { label: 'D', min: 60, max: 69 },
          { label: 'F', min: 0, max: 59 }
        ],
        customFields: [
          { label: 'Conduct', value: 'Excellent' },
          { label: 'Academic Year', value: getDefaultAcademicYear() }
        ]
      },
      academicYears: [getDefaultAcademicYear()],
      currentAcademicYear: getDefaultAcademicYear()
    });
  },

  /**
   * Updates a school's report configuration.
   */
  updateReportConfig: async (schoolKey: string, config: ReportConfig): Promise<void> => {
    const normalizedConfig = JSON.parse(JSON.stringify(config || {})) as ReportConfig;
    await dbAdapter.setDoc(`schools/${schoolKey}/reportConfig`, normalizedConfig);
  },

  updateAcademicYears: async (schoolKey: string, academicYears: string[], currentAcademicYear?: string): Promise<void> => {
    await dbAdapter.updateDoc(`schools/${schoolKey}`, {
      academicYears,
      currentAcademicYear: currentAcademicYear || academicYears[0] || getDefaultAcademicYear()
    });
  },

  setCurrentAcademicYear: async (schoolKey: string, currentAcademicYear: string): Promise<void> => {
    await dbAdapter.updateDoc(`schools/${schoolKey}`, { currentAcademicYear });
  },

  subscribeToPastRecords: (schoolKey: string, onUpdate: (records: PastRecordData[]) => void): (() => void) => {
    return dbAdapter.subscribeToPath(`schools/${schoolKey}/pastRecords`, (records) => {
      const normalized = records.map((record) => ({
        id: record.id || '',
        title: record.title || 'Past Record',
        academicYear: record.academicYear || '',
        classId: record.classId || '',
        className: record.className || '',
        studentId: record.studentId || '',
        studentName: record.studentName || '',
        term: record.term || '',
        note: record.note || '',
        fileName: record.fileName || 'past-record.pdf',
        fileUrl: record.fileUrl || '',
        filePath: record.filePath || '',
        mimeType: record.mimeType || 'application/pdf',
        size: typeof record.size === 'number' ? record.size : undefined,
        uploadedAt: typeof record.uploadedAt === 'number' ? record.uploadedAt : Date.now(),
        uploadedBy: record.uploadedBy || ''
      })) as PastRecordData[];

      normalized.sort((a, b) => b.uploadedAt - a.uploadedAt);
      onUpdate(normalized);
    });
  },

  addPastRecord: async (schoolKey: string, record: Omit<PastRecordData, 'id' | 'uploadedAt'>): Promise<string> => {
    return dbAdapter.pushDoc(`schools/${schoolKey}/pastRecords`, {
      ...record,
      uploadedAt: Date.now()
    });
  },

  deletePastRecord: async (schoolKey: string, recordId: string): Promise<void> => {
    const res = await dbAdapter.getDoc(`schools/${schoolKey}/pastRecords/${recordId}`);
    if (res.exists) {
      const record = res.data || {};
      if (record.filePath) {
        // Keep file cleanup best-effort so Spark-plan/local-cache uploads do not block record removal.
        try {
          const { storageService } = await import('./storageService');
          await storageService.deleteFile(record.filePath);
        } catch {}
      }
    }

    await dbAdapter.deleteDoc(`schools/${schoolKey}/pastRecords/${recordId}`);
  },

  /**
   * Deletes a school node.
   */
  deleteSchool: async (schoolKey: string): Promise<void> => {
    await dbAdapter.deleteDoc(`schools/${schoolKey}`);
  },

  /**
   * Real-time listener for the schools list.
   */
  subscribeToSchools: (onUpdate: (schools: SchoolData[]) => void): (() => void) => {
    return dbAdapter.subscribeToPath('schools', (dataList) => {
      const schoolList: SchoolData[] = dataList.map(data => ({
        id: data.id || data.schoolId || '',
        name: data.name || '',
        address: data.address || '',
        schoolId: data.schoolId || data.id || '',
        motto: data.motto || '',
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        status: data.status || 'active',
        academicYears: Array.isArray(data.academicYears) ? data.academicYears : undefined,
        currentAcademicYear: data.currentAcademicYear || undefined,
        reportConfig: data.reportConfig
      }));
      schoolList.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(schoolList);
    });
  },

  /**
   * Retrieves school details by its schoolId slug.
   */
  getSchoolBySlug: async (schoolIdSlug: string): Promise<SchoolData | null> => {
    try {
      const res = await dbAdapter.getDoc(`schools/${schoolIdSlug}`);
      if (res.exists) {
        const data = res.data;
        return {
          id: data.id || schoolIdSlug,
          name: data.name || '',
          address: data.address || '',
          schoolId: data.schoolId || schoolIdSlug,
          motto: data.motto || '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          status: data.status || 'active',
          academicYears: Array.isArray(data.academicYears) ? data.academicYears : undefined,
          currentAcademicYear: data.currentAcademicYear || undefined,
          reportConfig: data.reportConfig
        };
      }
      return null;
    } catch (err) {
      console.error("Error in getSchoolBySlug:", err);
      return null;
    }
  }
};
