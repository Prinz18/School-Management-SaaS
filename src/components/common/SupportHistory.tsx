import React, { useMemo, useState } from 'react';
import { feedbackService, type FeedbackItem } from '../../services/feedbackService';
import { notificationService, type NotificationItem } from '../../services/notificationService';
import { CheckCircle2, Loader2, Mail, MessageSquare, Clock3, Trash2 } from 'lucide-react';

interface SupportHistoryProps {
  userId: string;
  schoolId?: string | null;
  userName?: string | null;
}

const STATUS_STYLES: Record<FeedbackItem['status'], string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  read: 'bg-amber-100 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const SupportHistory: React.FC<SupportHistoryProps> = ({ userId, schoolId }) => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let alive = true;
    const unsubscribeMessages = feedbackService.subscribeToFeedback((nextItems) => {
      if (!alive) return;
      const mine = nextItems.filter((item) => {
        if (item.userId !== userId) return false;
        if (schoolId && item.schoolId && item.schoolId !== schoolId) return false;
        return true;
      });
      setItems(mine);
      setLoading(false);
    });

    const unsubscribeNotifications = notificationService.subscribeToUserNotifications(userId, (nextItems) => {
      if (!alive) return;
      setNotifications(nextItems);
    });

    return () => {
      alive = false;
      unsubscribeMessages();
      unsubscribeNotifications();
    };
  }, [schoolId, userId]);

  const notificationByRelatedId = useMemo(() => {
    const map = new Map<string, NotificationItem>();
    notifications.forEach((notification) => {
      if (notification.relatedId) {
        map.set(notification.relatedId, notification);
      }
    });
    return map;
  }, [notifications]);

  const counts = useMemo(() => ({
    total: items.length,
    unresolved: items.filter((item) => item.status !== 'resolved').length,
    resolved: items.filter((item) => item.status === 'resolved').length,
    unread: notifications.filter((item) => !item.readAt).length
  }), [items, notifications]);

  const handleDelete = async (item: FeedbackItem) => {
    const path = item.path || item.id;
    if (!path) return;

    if (!window.confirm('Delete this support message? This cannot be undone.')) return;

    const relatedNotification = item.id ? notificationByRelatedId.get(item.id) : undefined;

    await feedbackService.deleteFeedback(path);

    if (relatedNotification) {
      await notificationService.deleteNotification(userId, relatedNotification.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Support history</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Your messages</h2>
            <p className="mt-2 text-sm text-slate-500">
              See every support message you sent, whether it is unread, read, or resolved.
            </p>
          </div>
          <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[36rem]">
            <StatCard label="Total" value={counts.total} />
            <StatCard label="Unread" value={counts.unread} />
            <StatCard label="Open" value={counts.unresolved} />
            <StatCard label="Resolved" value={counts.resolved} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500">
            <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
            Loading your support history...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            No support messages yet.
          </div>
        ) : (
          items.map((item) => {
            const relatedNotification = item.id ? notificationByRelatedId.get(item.id) : undefined;
            const isUnread = !relatedNotification?.readAt;
            return (
              <div
                key={item.path || item.id}
                className={`rounded-3xl border p-5 shadow-sm ${
                  item.status === 'resolved'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-slate-900">{item.subject}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[item.status]}`}>
                        {item.status}
                      </span>
                      {relatedNotification && (
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isUnread ? 'border-indigo-200 bg-indigo-100 text-indigo-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                          {isUnread ? 'Reply unread' : 'Reply read'}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                      <Meta label="Status" value={item.status} />
                      <Meta label="School" value={item.schoolName || item.schoolId || 'Global'} />
                      <Meta label="Sent" value={new Date(item.createdAt).toLocaleString()} />
                      <Meta label="Updated" value={item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Not updated'} />
                    </div>

                    <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                      {item.message}
                    </div>

                    {item.status === 'resolved' && (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        <div className="flex items-center gap-2 font-black">
                          <CheckCircle2 className="h-4 w-4" />
                          Resolved
                        </div>
                        <p className="mt-1 text-emerald-700">
                          The school marked this message as resolved. {relatedNotification ? 'You have a notification for this update.' : ''}
                        </p>
                      </div>
                    )}

                    {relatedNotification && (
                      <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                        <div className="flex items-center gap-2 font-black">
                          <Mail className="h-4 w-4" />
                          Notification
                        </div>
                        <p className="mt-1 text-indigo-700">{relatedNotification.title}</p>
                        <p className="mt-1 text-indigo-700">{relatedNotification.message}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600">
                      <Clock3 className="h-4 w-4" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="min-w-[6.5rem] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center sm:px-4">
    <p className="break-words text-[10px] font-black uppercase leading-tight tracking-widest text-slate-400">
      {label}
    </p>
    <p className="mt-1 break-words text-2xl font-black leading-none text-slate-900">
      {value}
    </p>
  </div>
);

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-white p-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 break-words text-slate-700">{value}</p>
  </div>
);

export default SupportHistory;
