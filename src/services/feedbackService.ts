import { auth } from '../lib/firebaseConfig';
import { dbAdapter } from '../lib/dbAdapter';
import { schoolService } from './schoolService';
import { notificationService } from './notificationService';

export interface FeedbackItem {
  id: string;
  path?: string;
  schoolId?: string | null;
  schoolName?: string | null;
  userId?: string | null;
  userName: string;
  userEmail?: string | null;
  userRole: 'superadmin' | 'schooladmin' | 'teacher' | 'student' | 'registrar';
  category: 'bug' | 'request' | 'suggestion' | 'general' | 'complaint';
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  createdAt: number;
  updatedAt?: number;
}

export interface SubmitFeedbackInput {
  schoolId?: string | null;
  schoolName?: string | null;
  userName: string;
  userRole: FeedbackItem['userRole'];
  category: FeedbackItem['category'];
  subject: string;
  message: string;
}

const legacyRootPath = 'feedbackMessages';
const supportPath = (schoolId?: string | null) => (schoolId ? `schools/${schoolId}/supportMessages` : legacyRootPath);

const normalize = (value?: string | null) => (value || '').trim();

const normalizeItem = (collectionPath: string, item: any, fallbackSchoolId?: string | null, fallbackSchoolName?: string | null): FeedbackItem => {
  const id = item.id || collectionPath.split('/').pop() || '';
  const itemPath = id ? `${collectionPath}/${id}` : collectionPath;

  return {
    id,
    path: itemPath,
  schoolId: item.schoolId || fallbackSchoolId || null,
  schoolName: item.schoolName || fallbackSchoolName || null,
  userId: item.userId || null,
  userName: item.userName || 'Unknown user',
  userEmail: item.userEmail || null,
  userRole: item.userRole || 'student',
  category: item.category || 'general',
  subject: item.subject || 'No subject',
  message: item.message || '',
  status: item.status || 'new',
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : undefined
  };
};

export const feedbackService = {
  subscribeToFeedback: (onUpdate: (items: FeedbackItem[]) => void): (() => void) => {
    const collections = new Map<string, FeedbackItem[]>();
    const unsubs = new Map<string, () => void>();

    const emit = () => {
      const merged = Array.from(collections.values()).flat();
      const deduped = new Map<string, FeedbackItem>();
      merged.forEach((item) => {
        deduped.set(item.path || item.id, item);
      });
      onUpdate(Array.from(deduped.values()).sort((a, b) => b.createdAt - a.createdAt));
    };

    const attachPath = (path: string, schoolId?: string | null, schoolName?: string | null) => {
      if (unsubs.has(path)) return;
      const unsub = dbAdapter.subscribeToPath(path, (items) => {
        collections.set(path, items.map((item) => normalizeItem(path, item, schoolId, schoolName)));
        emit();
      });
      unsubs.set(path, unsub);
    };

    attachPath(legacyRootPath, 'global', 'Global');

    const schoolsUnsub = schoolService.subscribeToSchools((schools) => {
      const nextPaths = new Set<string>();
      schools.forEach((school) => {
        const path = supportPath(school.schoolId);
        nextPaths.add(path);
        attachPath(path, school.schoolId, school.name);
      });

      for (const [path, unsub] of unsubs.entries()) {
        if (path === legacyRootPath) continue;
        if (!nextPaths.has(path)) {
          unsub();
          unsubs.delete(path);
          collections.delete(path);
        }
      }

      emit();
    });

    return () => {
      schoolsUnsub();
      for (const unsub of unsubs.values()) unsub();
      unsubs.clear();
      collections.clear();
    };
  },

  submitFeedback: async (input: SubmitFeedbackInput): Promise<string> => {
    const user = auth.currentUser;
    const userName = normalize(input.userName);
    const subject = normalize(input.subject);
    const message = normalize(input.message);

    if (!userName) throw new Error('Your name is required.');
    if (!subject) throw new Error('A subject is required.');
    if (!message) throw new Error('A message is required.');

    const payload = {
      schoolId: input.schoolId || null,
      schoolName: normalize(input.schoolName) || null,
      userId: user?.uid || null,
      userName,
      userEmail: user?.email || null,
      userRole: input.userRole,
      category: input.category,
      subject,
      message,
      status: 'new',
      createdAt: Date.now()
    };

    const recordId = await dbAdapter.pushDoc(supportPath(input.schoolId), payload);

    if (!input.schoolId) {
      await dbAdapter.setDoc(`${legacyRootPath}/${recordId}`, payload);
    }

    return recordId;
  },

  markFeedbackStatus: async (feedbackPathOrId: string, status: FeedbackItem['status']): Promise<void> => {
    const path = feedbackPathOrId.includes('/') ? feedbackPathOrId : `${legacyRootPath}/${feedbackPathOrId}`;
    const existingRes = await dbAdapter.getDoc(path);
    const existing = existingRes.exists ? (existingRes.data as FeedbackItem) : null;

    await dbAdapter.updateDoc(path, {
      status,
      updatedAt: Date.now()
    });

    if (
      status === 'resolved' &&
      existing &&
      existing.userId &&
      existing.userId !== auth.currentUser?.uid &&
      existing.status !== 'resolved'
    ) {
      await notificationService.createNotification({
        userId: existing.userId,
        type: 'support',
        title: 'Your support message was resolved',
        message: `Your ${existing.category} message about "${existing.subject}" has been marked as resolved.`,
        relatedType: 'support-message',
        relatedId: existing.id || path.split('/').pop() || null,
        schoolId: existing.schoolId || null,
        schoolName: existing.schoolName || null
      });
    }
  },

  deleteFeedback: async (feedbackPathOrId: string): Promise<void> => {
    const path = feedbackPathOrId.includes('/') ? feedbackPathOrId : `${legacyRootPath}/${feedbackPathOrId}`;
    await dbAdapter.deleteDoc(path);
  }
};
