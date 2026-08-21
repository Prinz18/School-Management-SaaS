import { auth } from '../lib/firebaseConfig';
import { dbAdapter } from '../lib/dbAdapter';

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'support' | 'system' | 'school' | 'grade' | 'attendance';
  title: string;
  message: string;
  relatedType?: string | null;
  relatedId?: string | null;
  schoolId?: string | null;
  schoolName?: string | null;
  createdAt: number;
  readAt?: number | null;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationItem['type'];
  title: string;
  message: string;
  relatedType?: string | null;
  relatedId?: string | null;
  schoolId?: string | null;
  schoolName?: string | null;
}

const normalize = (value?: string | null) => (value || '').trim();
const buildNotificationsPath = (userId: string) => `users/${userId}/notifications`;

const normalizeNotification = (item: any): NotificationItem => ({
  id: item.id || '',
  userId: item.userId || '',
  type: item.type || 'system',
  title: item.title || 'Notification',
  message: item.message || '',
  relatedType: item.relatedType || null,
  relatedId: item.relatedId || null,
  schoolId: item.schoolId || null,
  schoolName: item.schoolName || null,
  createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
  readAt: typeof item.readAt === 'number' ? item.readAt : null
});

export const notificationService = {
  subscribeToUserNotifications: (userId: string, onUpdate: (items: NotificationItem[]) => void): (() => void) => {
    if (!userId) return () => {};

    return dbAdapter.subscribeToPath(buildNotificationsPath(userId), (items) => {
      onUpdate(
        items
          .map(normalizeNotification)
          .filter((item) => item.userId === userId || !item.userId)
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    });
  },

  createNotification: async (input: CreateNotificationInput): Promise<string> => {
    const userId = normalize(input.userId);
    const title = normalize(input.title);
    const message = normalize(input.message);

    if (!userId) throw new Error('A target user is required.');
    if (!title) throw new Error('A notification title is required.');
    if (!message) throw new Error('A notification message is required.');

    const payload = {
      userId,
      type: input.type,
      title,
      message,
      relatedType: input.relatedType || null,
      relatedId: input.relatedId || null,
      schoolId: input.schoolId || null,
      schoolName: input.schoolName || null,
      createdAt: Date.now(),
      readAt: null
    };

    return dbAdapter.pushDoc(buildNotificationsPath(userId), payload);
  },

  markNotificationRead: async (userId: string, notificationId: string): Promise<void> => {
    if (!userId || !notificationId) return;
    await dbAdapter.updateDoc(`${buildNotificationsPath(userId)}/${notificationId}`, {
      readAt: Date.now()
    });
  },

  markNotificationUnread: async (userId: string, notificationId: string): Promise<void> => {
    if (!userId || !notificationId) return;
    await dbAdapter.updateDoc(`${buildNotificationsPath(userId)}/${notificationId}`, {
      readAt: null
    });
  },

  deleteNotification: async (userId: string, notificationId: string): Promise<void> => {
    if (!userId || !notificationId) return;
    await dbAdapter.deleteDoc(`${buildNotificationsPath(userId)}/${notificationId}`);
  },

  markAllRead: async (userId: string): Promise<void> => {
    if (!userId) return;
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid !== userId) return;

    const notificationsRes = await dbAdapter.getDoc(buildNotificationsPath(userId));
    if (!notificationsRes.exists || !notificationsRes.data) return;

    const entries = Object.entries(notificationsRes.data as Record<string, any>);
    await Promise.all(
      entries.map(([notificationId, notification]) => {
        if (notification && typeof notification.readAt !== 'number') {
          return dbAdapter.updateDoc(`${buildNotificationsPath(userId)}/${notificationId}`, {
            readAt: Date.now()
          });
        }
        return Promise.resolve();
      })
    );
  }
};
