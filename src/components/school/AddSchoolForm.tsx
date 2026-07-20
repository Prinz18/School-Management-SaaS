// src/components/school/AddSchoolForm.tsx
import React from 'react';
import { schoolService } from '../../services/schoolService';
import { PlusCircle, Loader2 } from 'lucide-react';

interface AddSchoolFormProps {
  onSchoolAdded: () => void;
}

const AddSchoolForm: React.FC<AddSchoolFormProps> = ({ onSchoolAdded }) => {
  const [name, setName] = React.useState('');
  const [motto, setMotto] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [schoolId, setSchoolId] = React.useState(''); // Unique slug/ID for the school
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await schoolService.registerSchool(name, schoolId, address, motto);
      
      setName('');
      setMotto('');
      setAddress('');
      setSchoolId('');
      onSchoolAdded();
    } catch (err: any) {
      setError(err.message || "Failed to register school.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
      <h3 className="text-lg font-black mb-6 flex items-center gap-3 text-slate-900">
        <PlusCircle className="w-5 h-5 text-blue-600" />
        Register New School
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">School Name</label>
          <input
            type="text"
            required
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Westside High School"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">School Motto</label>
          <input
            type="text"
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            placeholder="e.g. Knowledge is Power"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Unique School ID (Abbreviation)</label>
          <input
            type="text"
            required
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            placeholder="e.g. westside-high"
          />
          <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">This acts as the unique identifier for school logins and data isolation.</p>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Address / Location</label>
          <textarea
            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 transition"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Education St, Monrovia, Liberia"
          />
        </div>

        {error && <p className="text-xs text-red-600 font-bold bg-red-50 p-2.5 rounded-xl">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'REGISTER SCHOOL'}
        </button>
      </form>
    </div>
  );
};

export default AddSchoolForm;