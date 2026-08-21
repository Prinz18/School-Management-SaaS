import React, { useMemo, useState } from 'react';
import { feedbackService, type FeedbackItem } from '../../services/feedbackService';
import { Loader2, Mail, Search, Trash2, CheckCircle2, Filter } from 'lucide-react';

const CATEGORY_LABELS: Record<FeedbackItem['category'], string> = {
  bug: 'Bug report',
  request: 'Feature request',
  suggestion: 'Suggestion',
  general: 'General',
  complaint: 'Complaint'
};

const STATUS_LABELS: Record<FeedbackItem['status'], string> = {
  new: 'Unread',
  read: 'In Review',
  resolved: 'Resolved'
};

const STATUS_STYLES: Record<FeedbackItem['status'], string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  read: 'bg-amber-100 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const FeedbackInbox: React.FC = () => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackItem['status']>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    const unsubscribe = feedbackService.subscribeToFeedback((nextItems) => {
      if (!alive) return;
      setItems(nextItems);
      setLoading(false);
    });

    const timeout = window.setTimeout(() => {
      if (!alive) return;
      setLoading(false);
    }, 4000);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesQuery =
        !q ||
        item.subject.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        item.userName.toLowerCase().includes(q) ||
        (item.schoolName || '').toLowerCase().includes(q) ||
        (item.schoolId || '').toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [items, query, statusFilter]);

  const counts = useMemo(() => ({
    total: items.length,
    open: items.filter((item) => item.status === 'new' || item.status === 'read').length,
    unread: items.filter((item) => item.status === 'new').length,
    inReview: items.filter((item) => item.status === 'read').length,
    resolved: items.filter((item) => item.status === 'resolved').length
  }), [items]);

  const handleStatusChange = async (path: string, status: FeedbackItem['status']) => {
    setSavingId(path);
    try {
      await feedbackService.markFeedbackStatus(path, status);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (path: string) => {
    if (!window.confirm('Delete this support message permanently?')) return;
    setSavingId(path);
    try {
      await feedbackService.deleteFeedback(path);
    } finally {
      setSavingId(null);
    }
  };

  const getItemKey = (item: FeedbackItem) => item.path || item.id;

  const toggleReadState = async (item: FeedbackItem) => {
    const path = getItemKey(item);
    const nextStatus: FeedbackItem['status'] = item.status === 'new' ? 'read' : 'new';
    setSavingId(path);
    try {
      await feedbackService.markFeedbackStatus(path, nextStatus);
    } finally {
      setSavingId(null);
    }
  };

  const getPreviewText = (message: string, length = 180) => {
    const clean = message.trim().replace(/\s+/g, ' ');
    if (clean.length <= length) return clean;
    return `${clean.slice(0, length).trimEnd()}…`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Support inbox</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Messages from users</h2>
            <p className="mt-2 text-sm text-slate-500">
              Every user can send a support message from their dashboard. Use this inbox to review open messages, resolve them, or delete them.
            </p>
          </div>

          <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[36rem]">
            <StatCard label="Total" value={counts.total} />
            <StatCard label="Unread" value={counts.unread} />
            <StatCard label="In Review" value={counts.inReview} />
            <StatCard label="Resolved" value={counts.resolved} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400"
              placeholder="Search messages"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip label="All" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            <Chip label="Unread" active={statusFilter === 'new'} onClick={() => setStatusFilter('new')} />
            <Chip label="In Review" active={statusFilter === 'read'} onClick={() => setStatusFilter('read')} />
            <Chip label="Resolved" active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')} />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-500">
              <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
                Loading messages...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-500">
              No support messages found.
            </div>
          ) : (
            filteredItems.map((item) => {
              const key = getItemKey(item);
              const isExpanded = expandedItemId === key;
              const showPreview = item.status === 'new' && !isExpanded;

              return (
              <div key={key} className={`overflow-hidden rounded-3xl border p-4 sm:p-5 ${item.status === 'new' ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 max-w-full break-words text-base font-black text-slate-900">{item.subject}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${STATUS_STYLES[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                      {item.status === 'new' && (
                        <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                          Preview
                        </span>
                      )}
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                      <Meta label="From" value={item.userName} />
                      <Meta label="Email" value={item.userEmail || 'No email'} />
                      <Meta label="Role" value={item.userRole} />
                      <Meta label="School" value={item.schoolName || item.schoolId || 'Global'} />
                      <Meta label="UID" value={item.userId || 'Unknown'} />
                      <Meta label="Time" value={new Date(item.createdAt).toLocaleString()} />
                    </div>

                    <div
                      className={`mt-3 overflow-hidden rounded-2xl p-4 text-sm leading-relaxed ${
                        item.status === 'new' ? 'border border-indigo-100 bg-white text-slate-700' : 'bg-white text-slate-700'
                      }`}
                    >
                      {showPreview ? getPreviewText(item.message) : item.message}
                      {item.status === 'new' && item.message.trim().length > 180 && (
                        <button
                          type="button"
                          onClick={() => setExpandedItemId(isExpanded ? null : key)}
                          className="mt-3 inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100"
                        >
                          {isExpanded ? 'Collapse preview' : 'Open preview'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => toggleReadState(item)}
                      disabled={savingId === key}
                      className={`inline-flex min-w-fit whitespace-nowrap items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-60 ${
                        item.status === 'new'
                          ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      {item.status === 'new' ? 'Mark in review' : 'Mark unread'}
                    </button>
                    {item.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(key, 'resolved')}
                        disabled={savingId === key}
                        className="inline-flex min-w-fit whitespace-nowrap items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Resolve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(key)}
                      disabled={savingId === key}
                      className="inline-flex min-w-fit whitespace-nowrap items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-red-600 hover:bg-red-50 disabled:opacity-60"
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

const Chip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition ${
      active
        ? 'border-indigo-600 bg-indigo-600 text-white'
        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
    }`}
  >
    <Filter className="h-3.5 w-3.5" />
    {label}
  </button>
);

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0 rounded-2xl bg-white p-3">
    <p className="break-words text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 break-words text-slate-700">{value}</p>
  </div>
);

export default FeedbackInbox;
