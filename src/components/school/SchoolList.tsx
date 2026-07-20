// src/components/school/SchoolList.tsx
import React from 'react';
import { schoolService, type SchoolData } from '../../services/schoolService';
import { School, MapPin, Calendar, X } from 'lucide-react';

const SchoolList: React.FC = () => {
  const [schools, setSchools] = React.useState<SchoolData[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = schoolService.subscribeToSchools((schoolList) => {
      setSchools(schoolList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (schoolId: string, schoolName: string) => {
    if (window.confirm(`Are you sure you want to permanently delete ${schoolName}? This action cannot be undone.`)) {
      try {
        await schoolService.deleteSchool(schoolId);
        // The subscription will automatically update the UI.
      } catch (error) {
        console.error("Error deleting school:", error);
        alert("Failed to delete school.");
      }
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-500 font-bold">Loading schools...</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-black text-slate-800 mb-4">Registered Schools ({schools.length})</h3>
      
      {schools.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] py-16 text-center">
          <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No schools registered yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {schools.map((school) => (
            <div key={school.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition group">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 text-lg leading-tight">{school.name}</h4>
                  <p className="text-xs text-blue-600 font-mono font-bold mt-1">ID: {school.schoolId}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    school.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {school.status}
                  </span>
                  <button 
                    onClick={() => handleDelete(school.id, school.name)}
                    className="p-1.5 rounded-xl bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white"
                    title={`Delete ${school.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{school.address || 'No address provided'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{school.createdAt ? new Date(school.createdAt).toLocaleDateString() : 'Recently added'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchoolList;