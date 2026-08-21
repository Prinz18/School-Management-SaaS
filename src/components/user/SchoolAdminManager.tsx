// src/components/user/SchoolAdminManager.tsx
import React, { useEffect, useRef, useState } from 'react';
import { userService, type UserData } from '../../services/userService';
import { schoolService, type SchoolData } from '../../services/schoolService';
import { Shield, Loader2, Star, UserX } from 'lucide-react';

const SchoolAdminManager: React.FC = () => {
  const [admins, setAdmins] = useState<UserData[]>([]);
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const lastStableAdminsRef = useRef<UserData[]>([]);
  const updatingRef = useRef<string | null>(null);

  useEffect(() => {
    updatingRef.current = updating;
  }, [updating]);

  useEffect(() => {
    // Subscribe to active school admins
    const unsubscribeUsers = userService.subscribeToSchoolAdmins((adminList) => {
      if (adminList.length > 0) {
        lastStableAdminsRef.current = adminList;
        setAdmins(adminList);
      } else if (updatingRef.current) {
        // Preserve the previous list during live updates so the UI doesn't blink empty.
        setAdmins(lastStableAdminsRef.current);
      } else {
        lastStableAdminsRef.current = [];
        setAdmins([]);
      }
      setLoading(false);
    });

    // Subscribe to registered schools
    const unsubscribeSchools = schoolService.subscribeToSchools((schoolList) => {
      setSchools(schoolList);
    });

    // Fail open if the realtime listener is delayed or blocked.
    const loadingFallback = window.setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      window.clearTimeout(loadingFallback);
      unsubscribeUsers();
      unsubscribeSchools();
    };
  }, []);

  const handleStatusChange = async (userId: string, name: string) => {
    if (window.confirm(`Are you sure you want to terminate access for ${name}? This will revoke their administrative privileges.`)) {
      setUpdating(userId);
      try {
        await userService.terminateAccess(userId);
      } catch (error) {
        console.error("Error terminating admin:", error);
        alert("Failed to terminate administrator access.");
      } finally {
        setUpdating(null);
      }
    }
  };

  const handleToggleMainAdmin = async (admin: UserData) => {
    if (!admin.schoolId) {
      alert("Please assign this administrator to a school first.");
      return;
    }

    const newStatus = !!admin.isMainAdmin;
    const action = newStatus ? "revoke" : "promote";
    
    if (window.confirm(`Are you sure you want to ${action} ${admin.name} ${newStatus ? 'from' : 'to'} Main Administrator?`)) {
      setUpdating(admin.id);
      try {
        await userService.toggleMainAdmin(admin.id, admin.schoolId, newStatus);
      } catch (error) {
        console.error(`Error ${action}ing admin:`, error);
        alert(`Failed to ${action} administrator.`);
      } finally {
        setUpdating(null);
      }
    }
  };

  const handleAssignSchool = async (adminId: string, newSchoolId: string) => {
    setUpdating(adminId);
    try {
      await userService.assignSchoolNode(adminId, newSchoolId);
    } catch (error) {
      console.error("Error assigning school:", error);
      alert("Failed to assign school.");
    } finally {
      setUpdating(null);
    }
  };

  const getSchoolName = (schoolId: string | null) => {
    if (!schoolId) return 'Not Assigned';
    const school = schools.find(s => s.schoolId === schoolId);
    return school ? school.name : 'Unknown School';
  };

  if (loading) return (
    <div className="flex justify-center items-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      <div className="p-5 sm:p-8 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
        <div className="min-w-0">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">School Administrator List</h3>
          <p className="text-slate-500 font-medium text-sm mt-1">Assign and manage access for school administrators.</p>
        </div>
        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
          <Shield className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      <div className="block md:hidden divide-y divide-slate-100">
        {admins.length === 0 ? (
          <div className="px-5 py-16 text-center text-slate-400 font-bold italic">
            No school administrators detected in the system.
          </div>
        ) : (
          admins.map((admin) => (
            <div key={admin.id} className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black shrink-0">
                  {admin.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span className="break-words">{admin.name}</span>
                    {admin.isMainAdmin && (
                      <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-black uppercase">
                        <Star className="w-2.5 h-2.5 fill-amber-500" />
                        Main Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-500 break-words">{admin.email}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className={`text-sm font-bold ${admin.schoolId ? 'text-blue-600' : 'text-amber-500 animate-pulse'}`}>
                  {getSchoolName(admin.schoolId)}
                </span>
                {admin.schoolId && (
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                    ID: {admin.schoolId}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                  value={admin.schoolId || ''}
                  onChange={(e) => handleAssignSchool(admin.id, e.target.value)}
                  disabled={updating === admin.id}
                >
                  <option value="" disabled>Select School</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.schoolId}>
                      {school.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleToggleMainAdmin(admin)}
                  disabled={updating === admin.id || !admin.schoolId}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition disabled:opacity-50 shadow-sm border text-sm font-black uppercase tracking-widest ${
                    admin.isMainAdmin
                      ? 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-600 hover:text-white'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                  }`}
                >
                  <Star className={`w-4 h-4 ${admin.isMainAdmin ? 'fill-current' : ''}`} />
                  <span>{admin.isMainAdmin ? 'Revoke Main' : 'Promote to Main'}</span>
                </button>

                <button
                  onClick={() => handleStatusChange(admin.id, admin.name)}
                  disabled={updating === admin.id}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition disabled:opacity-50 shadow-sm border border-red-100 text-sm font-black uppercase tracking-widest"
                >
                  {updating === admin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  <span>Terminate</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="px-8 py-5">Administrator</th>
              <th className="px-8 py-5">Assigned School</th>
              <th className="px-8 py-5 text-right">Access Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {admins.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-8 py-20 text-center text-slate-400 font-bold italic">
                  No school administrators detected in the system.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50/30 transition group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                        {admin.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          {admin.name}
                          {admin.isMainAdmin && (
                            <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-black uppercase">
                              <Star className="w-2.5 h-2.5 fill-amber-500" />
                              Main Admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-slate-500">{admin.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${admin.schoolId ? 'text-blue-600' : 'text-amber-500 animate-pulse'}`}>
                        {getSchoolName(admin.schoolId)}
                      </span>
                      {admin.schoolId && (
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                          ID: {admin.schoolId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <select
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                        value={admin.schoolId || ''}
                        onChange={(e) => handleAssignSchool(admin.id, e.target.value)}
                        disabled={updating === admin.id}
                      >
                        <option value="" disabled>Select School</option>
                        {schools.map((school) => (
                          <option key={school.id} value={school.schoolId}>
                            {school.name}
                          </option>
                        ))}
                      </select>

                      <button 
                        onClick={() => handleToggleMainAdmin(admin)}
                        disabled={updating === admin.id || !admin.schoolId}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition disabled:opacity-50 shadow-sm border text-sm font-black uppercase tracking-widest ${
                          admin.isMainAdmin 
                            ? 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-600 hover:text-white' 
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600'
                        }`}
                        title={admin.isMainAdmin ? "Revoke Main Admin" : "Promote to Main Admin"}
                      >
                        <Star className={`w-4 h-4 ${admin.isMainAdmin ? 'fill-current' : ''}`} />
                        <span>{admin.isMainAdmin ? 'Revoke Main' : 'Promote to Main'}</span>
                      </button>
                      
                      <button 
                        onClick={() => handleStatusChange(admin.id, admin.name)}
                        disabled={updating === admin.id}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition disabled:opacity-50 shadow-sm border border-red-100 text-sm font-black uppercase tracking-widest"
                        title="Terminate Access"
                      >
                        {updating === admin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                        <span>Terminate</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SchoolAdminManager;
