// src/components/user/AddSchoolAdminForm.tsx
import React, { useState } from 'react';
import { userService } from '../../services/userService';
import { schoolService, type SchoolData } from '../../services/schoolService';
import { UserPlus, Loader2, Shield, Eye, EyeOff } from 'lucide-react';

const AddSchoolAdminForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    const unsubscribe = schoolService.subscribeToSchools((schoolList) => {
      setSchools(schoolList);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await userService.provisionUserAccount(
        name,
        email,
        'schooladmin',
        selectedSchoolId,
        undefined,
        password
      );
      
      setName('');
      setEmail('');
      setPassword('');
      setSelectedSchoolId('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to register administrator.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Provision Admin</h3>
          <p className="text-slate-500 font-medium text-sm">Create a new school administrator account (Spark Plan optimized).</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Full Name</label>
          <input
            type="text"
            required
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alexander Pierce"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Email Identity</label>
          <input
            type="email"
            required
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@school.edu"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Secure Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Initial School Assignment</label>
          <select
            required
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition"
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
          >
            <option value="" disabled>Select a School</option>
            {schools.map((school) => (
              <option key={school.id} value={school.schoolId}>
                {school.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-sm font-bold flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Administrator provisioned successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-slate-200"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <Shield className="w-5 h-5" />
              PROVISION ACCOUNT
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AddSchoolAdminForm;
