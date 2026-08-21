import React from 'react';
import { CheckCircle2, Copy, ExternalLink, Loader2, Plus, RefreshCw, Shield, Trash2, Users, Mail, Phone, CalendarDays } from 'lucide-react';
import { academicService, type ClassData } from '../../services/academicService';
import { buildRegistrationUrl, studentRegistrationService, type RegistrationInvite, type RegistrationRequest } from '../../services/studentRegistrationService';

interface StudentRegistrationManagerProps {
  schoolId: string;
  schoolName?: string | null;
  schoolMotto?: string | null;
}

const StudentRegistrationManager: React.FC<StudentRegistrationManagerProps> = ({ schoolId, schoolName, schoolMotto }) => {
  const [invites, setInvites] = React.useState<RegistrationInvite[]>([]);
  const [requests, setRequests] = React.useState<RegistrationRequest[]>([]);
  const [classes, setClasses] = React.useState<ClassData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creatingInvite, setCreatingInvite] = React.useState(false);
  const [processingRequestId, setProcessingRequestId] = React.useState<string | null>(null);
  const [copiedToken, setCopiedToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [selectedClassByRequest, setSelectedClassByRequest] = React.useState<Record<string, string>>({});

  const [inviteForm, setInviteForm] = React.useState({
    label: 'Student Registration',
    note: '',
    expiresInDays: ''
  });

  React.useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    const unsubInvites = studentRegistrationService.subscribeToInvites(schoolId, setInvites);
    const unsubRequests = studentRegistrationService.subscribeToRequests(schoolId, setRequests);
    const unsubClasses = academicService.subscribeToSchoolClasses(schoolId, setClasses);
    setLoading(false);

    return () => {
      unsubInvites();
      unsubRequests();
      unsubClasses();
    };
  }, [schoolId]);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingInvite(true);
    setError(null);
    setSuccess(null);

    try {
      const invite = await studentRegistrationService.createInvite(schoolId, {
        label: inviteForm.label,
        note: inviteForm.note,
        expiresInDays: inviteForm.expiresInDays ? Number(inviteForm.expiresInDays) : null,
        schoolName: schoolName || schoolId,
        schoolMotto: schoolMotto || ''
      });

      setSuccess(`Registration link created for ${invite.label}.`);
      setInviteForm({
        label: 'Student Registration',
        note: '',
        expiresInDays: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create registration link.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyLink = async (invite: RegistrationInvite) => {
    const url = buildRegistrationUrl(schoolId, invite.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(invite.token);
      setTimeout(() => setCopiedToken((current) => (current === invite.token ? null : current)), 1800);
    } catch {
      window.prompt('Copy the registration link:', url);
    }
  };

  const openLink = (invite: RegistrationInvite) => {
    window.open(buildRegistrationUrl(schoolId, invite.token), '_blank', 'noopener,noreferrer');
  };

  const revokeInvite = async (invite: RegistrationInvite) => {
    if (!window.confirm(`Revoke the registration link "${invite.label}"? Students will no longer be able to use it.`)) {
      return;
    }

    setProcessingRequestId(invite.token);
    setError(null);
    try {
      await studentRegistrationService.revokeInvite(schoolId, invite.token);
      setSuccess(`Registration link "${invite.label}" revoked.`);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke the registration link.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const approveRequest = async (request: RegistrationRequest) => {
    setProcessingRequestId(request.id);
    setError(null);
    setSuccess(null);

    try {
      const classId = selectedClassByRequest[request.id] || '';
      const classInfo = classes.find((c) => c.id === classId) || null;
      const result = await studentRegistrationService.approveRequest(schoolId, request, classInfo);
      setSuccess(`Approved ${request.fullName}. Student account created with ID ${result.studentId}.`);
      setSelectedClassByRequest((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to approve registration.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const rejectRequest = async (request: RegistrationRequest) => {
    if (!window.confirm(`Reject registration for ${request.fullName}?`)) {
      return;
    }

    setProcessingRequestId(request.id);
    setError(null);
    try {
      await studentRegistrationService.rejectRequest(schoolId, request.id, 'Rejected by school staff');
      setSuccess(`Rejected registration for ${request.fullName}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to reject registration.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const activeInvites = invites.filter((invite) => invite.status === 'active');
  const pendingRequests = requests.filter((request) => request.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public registration links</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">Create a secure student intake link</h3>
              <p className="mt-1 text-sm text-slate-500">Share this with students so they can submit their information for this school.</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Shield className="h-5 w-5" />
            </div>
          </div>

          <form onSubmit={createInvite} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Link label</label>
              <input
                value={inviteForm.label}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, label: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="Student Registration"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Note for students</label>
              <textarea
                value={inviteForm.note}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, note: e.target.value }))}
                className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="Optional instructions shown on the form"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Expires in days</label>
              <input
                type="number"
                min="1"
                value={inviteForm.expiresInDays}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, expiresInDays: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="Leave blank for manual revoke"
              />
            </div>
            <button
              type="submit"
              disabled={creatingInvite}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create invite
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="mr-2 inline-block h-4 w-4" />
              {success}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending registrations</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">Review incoming student applications</h3>
              <p className="mt-1 text-sm text-slate-500">Approve to create the student account or reject if the data is incorrect.</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Active links" value={activeInvites.length} />
            <StatCard label="Pending requests" value={pendingRequests.length} />
            <StatCard label="Total requests" value={requests.length} />
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
                <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
                Loading registrations...
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
                No pending registrations yet.
              </div>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black text-slate-900">{request.fullName}</h4>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {request.inviteLabel || 'Registration'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <Meta icon={<Mail className="h-4 w-4" />} value={request.email || 'No email provided'} />
                        <Meta icon={<Phone className="h-4 w-4" />} value={request.guardianContact || 'No guardian contact'} />
                        <Meta icon={<CalendarDays className="h-4 w-4" />} value={request.dob || 'No DOB provided'} />
                        <Meta icon={<Users className="h-4 w-4" />} value={request.previousSchool || 'No previous school'} />
                      </div>
                      {request.notes && (
                        <p className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-600">{request.notes}</p>
                      )}
                    </div>

                    <div className="w-full max-w-sm shrink-0 space-y-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Assign class before approval</label>
                        <select
                          value={selectedClassByRequest[request.id] || ''}
                          onChange={(e) => setSelectedClassByRequest((current) => ({ ...current, [request.id]: e.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400"
                        >
                          <option value="">No class yet</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => approveRequest(request)}
                        disabled={processingRequestId === request.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {processingRequestId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() => rejectRequest(request)}
                        disabled={processingRequestId === request.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black uppercase tracking-widest text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active registration links</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Shareable URLs</h3>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {activeInvites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-slate-500 xl:col-span-2">
              No active registration links yet.
            </div>
          ) : activeInvites.map((invite) => {
            const url = buildRegistrationUrl(schoolId, invite.token);
            return (
              <div key={invite.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h4 className="truncate text-base font-black text-slate-900">{invite.label}</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500">{url}</p>
                    {invite.note && <p className="mt-3 text-sm text-slate-600">{invite.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(invite)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedToken === invite.token ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openLink(invite)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-slate-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <span>Status: {invite.status}</span>
                  <button
                    type="button"
                    onClick={() => revokeInvite(invite)}
                    disabled={processingRequestId === invite.token}
                    className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Revoke
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
  </div>
);

const Meta: React.FC<{ icon: React.ReactNode; value: string }> = ({ icon, value }) => (
  <div className="flex items-start gap-2 rounded-2xl bg-white p-3">
    <div className="mt-0.5 text-slate-400">{icon}</div>
    <span className="min-w-0 break-words">{value}</span>
  </div>
);

export default StudentRegistrationManager;
