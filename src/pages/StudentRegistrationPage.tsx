import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Shield, School2, ArrowLeft, Lock } from 'lucide-react';
import { studentRegistrationService, type RegistrationInvite } from '../services/studentRegistrationService';

const StudentRegistrationPage: React.FC = () => {
  const { schoolId = '', token = '' } = useParams();
  const [invite, setInvite] = React.useState<RegistrationInvite | null>(null);
  const [loadingInvite, setLoadingInvite] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    fullName: '',
    email: '',
    dob: '',
    gender: '',
    address: '',
    guardianName: '',
    guardianContact: '',
    previousSchool: '',
    notes: ''
  });

  React.useEffect(() => {
    let mounted = true;

    const loadInvite = async () => {
      if (!schoolId || !token) {
        setError('This registration link is incomplete.');
        setLoadingInvite(false);
        return;
      }

      try {
        const inviteData = await studentRegistrationService.getInvite(schoolId, token);
        if (!mounted) return;

        if (!inviteData) {
          setError('This registration link could not be found.');
          setInvite(null);
        } else {
          setInvite(inviteData);
          if (inviteData.status !== 'active') {
            setError('This registration link is no longer active.');
          }
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || 'Unable to load the registration form.');
      } finally {
        if (mounted) setLoadingInvite(false);
      }
    };

    loadInvite();

    return () => {
      mounted = false;
    };
  }, [schoolId, token]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!invite) {
        throw new Error('Registration is not available for this school.');
      }

      await studentRegistrationService.submitRegistrationRequest(schoolId, token, {
        ...form,
        fullName: form.fullName.trim()
      });

      setSuccess('Your registration has been submitted. The school will review it and finish your enrollment.');
      setForm({
        fullName: '',
        email: '',
        dob: '',
        gender: '',
        address: '',
        guardianName: '',
        guardianContact: '',
        previousSchool: '',
        notes: ''
      });
    } catch (err: any) {
      setError(err.message || 'Unable to submit the form.');
    } finally {
      setSubmitting(false);
    }
  };

  const isExpired = invite?.expiresAt ? invite.expiresAt <= Date.now() : false;
  const isInactive = invite?.status !== 'active';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back Home
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-emerald-700">
            <Shield className="h-4 w-4" />
            Secure school registration
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-100">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <School2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Student enrollment portal
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {invite?.schoolName || schoolId || 'School Registration'}
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Fill in your information for review by the school registrar.
                </p>
              </div>
            </div>

            {loadingInvite ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading registration form...
              </div>
            ) : error && !invite ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : (
              <>
                {invite?.note && (
                  <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                    {invite.note}
                  </div>
                )}

                {(isInactive || isExpired) && (
                  <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    This registration link is {isExpired ? 'expired' : 'inactive'}.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Full name" required>
                      <input
                        value={form.fullName}
                        onChange={(e) => handleChange('fullName', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                        placeholder="Enter full name"
                        required
                      />
                    </Field>

                    <Field label="Email address">
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                        placeholder="Optional, used for login if provided"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Date of birth">
                      <input
                        type="date"
                        value={form.dob}
                        onChange={(e) => handleChange('dob', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                      />
                    </Field>

                    <Field label="Gender">
                      <select
                        value={form.gender}
                        onChange={(e) => handleChange('gender', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </Field>

                    <Field label="Previous school">
                      <input
                        value={form.previousSchool}
                        onChange={(e) => handleChange('previousSchool', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                        placeholder="Optional"
                      />
                    </Field>
                  </div>

                  <Field label="Home address">
                    <textarea
                      value={form.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                      placeholder="Street, town, city"
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Guardian name">
                      <input
                        value={form.guardianName}
                        onChange={(e) => handleChange('guardianName', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                        placeholder="Optional"
                      />
                    </Field>

                    <Field label="Guardian contact">
                      <input
                        value={form.guardianContact}
                        onChange={(e) => handleChange('guardianContact', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                        placeholder="Optional"
                      />
                    </Field>
                  </div>

                  <Field label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                      className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white"
                      placeholder="Anything the school should know"
                    />
                  </Field>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="mr-2 inline-block h-4 w-4" />
                      {success}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || isInactive || isExpired}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Submit registration
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security notes</p>
              <ul className="mt-4 space-y-3 text-sm font-medium text-slate-600">
                <li>• This link is school-specific and only works for the school that issued it.</li>
                <li>• Only the school’s staff can review submitted data.</li>
                <li>• Do not share the link publicly if you want tighter control over admissions.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-2xl shadow-slate-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">What happens next</p>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <div className="rounded-2xl bg-white/5 p-4">
                  1. The school receives your submission.
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  2. A registrar or administrator reviews and approves it.
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  3. Your student account is created and placed in the school.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}{required ? ' *' : ''}
    </span>
    {children}
  </label>
);

export default StudentRegistrationPage;
