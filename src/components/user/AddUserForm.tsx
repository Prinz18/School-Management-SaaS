// src/components/user/AddUserForm.tsx
import React, { useState } from 'react';
import { userService } from '../../services/userService';
import { UserPlus, Loader2, ShieldCheck } from 'lucide-react';

interface AddUserFormProps {
  schoolId: string;
  onUserAdded: () => void;
}

const AddUserForm: React.FC<AddUserFormProps> = ({ schoolId, onUserAdded }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [role, setRole] = useState<'schooladmin' | 'teacher' | 'student' | 'registrar'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { defaultPassword } = await userService.provisionUserAccount(
        name,
        email,
        role,
        schoolId,
        role === 'student' ? studentId : undefined
      );
      
      setSuccess(`User created! Default Password: ${defaultPassword}`);
      setName('');
      setEmail('');
      setStudentId('');
      setRole('student');
      onUserAdded();
    } catch (err: any) {
      console.error("Member creation error:", err);
      setError(err.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-purple-700">
        <UserPlus className="w-5 h-5" />
        Add New Member
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
          <input
            type="text"
            required
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-slate-700 transition"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
          <select
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-slate-700 transition"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="registrar">Registrar</option>
            <option value="schooladmin">Assistant Admin</option>
          </select>
        </div>

        {role === 'student' && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Student ID</label>
            <input
              type="text"
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-slate-700 transition"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. 2024-001"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
            Email Address {role === 'student' && '(Optional)'}
          </label>
          <input
            type="email"
            required={role !== 'student'}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-slate-700 transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
          />
        </div>

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded">{error}</p>}
        {success && (
          <div className="text-xs text-emerald-700 font-bold bg-emerald-50 p-3 rounded flex items-start gap-2 border border-emerald-100">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-100"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register & Create Login'}
        </button>
      </form>
    </div>
  );
};

export default AddUserForm;
