// src/services/schoolService.ts
import { db } from '../lib/firebaseConfig';
import { 
  collection, 
  setDoc,
  deleteDoc, 
  doc, 
  getDoc,
  updateDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

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
  reportConfig?: ReportConfig;
}

export const schoolService = {
  /**
   * Registers a new school node.
   */
  registerSchool: async (name: string, schoolIdSlug: string, address: string, motto?: string): Promise<void> => {
    const slug = schoolIdSlug.toLowerCase().trim().replace(/\s+/g, '-');
    const docRef = doc(db, 'schools', slug);
    await setDoc(docRef, {
      id: slug,
      schoolId: slug,
      name,
      address,
      motto: motto || "",
      createdAt: serverTimestamp(),
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
          { label: 'Academic Year', value: '2025/2026' }
        ]
      }
    });
  },

  /**
   * Updates a school's report configuration.
   */
  updateReportConfig: async (schoolKey: string, config: ReportConfig): Promise<void> => {
    const docRef = doc(db, 'schools', schoolKey);
    await updateDoc(docRef, { reportConfig: config });
  },

  /**
   * Deletes a school node.
   */
  deleteSchool: async (schoolKey: string): Promise<void> => {
    const docRef = doc(db, 'schools', schoolKey);
    await deleteDoc(docRef);
  },

  /**
   * Real-time listener for the schools list.
   */
  subscribeToSchools: (onUpdate: (schools: SchoolData[]) => void): (() => void) => {
    const schoolsRef = collection(db, 'schools');
    
    return onSnapshot(schoolsRef, (snapshot) => {
      const schoolList: SchoolData[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        schoolList.push({
          id: docSnap.id,
          name: data.name || '',
          address: data.address || '',
          schoolId: data.schoolId || '',
          motto: data.motto || '',
          createdAt: createdAt || 0,
          status: data.status || 'active',
          reportConfig: data.reportConfig
        });
      });
      schoolList.sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(schoolList);
    }, (error) => {
      console.error("Error subscribing to schools:", error);
      onUpdate([]);
    });
  },

  /**
   * Retrieves a school details by its schoolId slug.
   */
  getSchoolBySlug: async (schoolIdSlug: string): Promise<SchoolData | null> => {
    try {
      const docRef = doc(db, 'schools', schoolIdSlug);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt;
        return {
          id: snap.id,
          name: data.name || '',
          address: data.address || '',
          schoolId: data.schoolId || '',
          motto: data.motto || '',
          createdAt: createdAt || 0,
          status: data.status || 'active',
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
