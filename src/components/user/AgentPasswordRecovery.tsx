// src/components/user/AgentPasswordRecovery.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { userService, type UserData } from '../../services/userService';
import { KeyRound, Search, Loader2, Shield, GraduationCap, Briefcase, Hash, UserCheck } from 'lucide-react';

type UserWithSchool = UserData & { schoolName?: string };

interface AgentPasswordRecoveryProps {
  currentUserEmail: string;
}

const AUTHORIZED_EMAIL = 'shermanprinz14@gmail.com';

const AgentPasswordRecovery: React.FC<AgentPasswordRecoveryProps> = ({ currentUserEmail }) => {
  const [users, setUsers] = useState<UserWithSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'registrar' | 'schooladmin'>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

  const isAuthorized = currentUserEmail.toLowerCase() === AUTHORIZED_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isAuthorized) return;

    const unsubscribe = userService.subscribeToAllSchoolUsers((allUsers) => {
      setUsers(allUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthorized]);

  const schools = useMemo(() => {
    const schoolMap = new Map<string, string>();
    users.forEach(u => {
      if (u.schoolId && u.schoolName) {
        schoolMap.set(u.schoolId, u.schoolName);
      }
    });
    return Array.from(schoolMap.entries()).map(([id, name]) => ({ id, name }));
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;

    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    if (schoolFilter !== 'all') {
      result = result.filter(u => u.schoolId === schoolFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.studentId?.toLowerCase().includes(query) ||
        u.id?.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users, searchQuery, roleFilter, schoolFilter]);

  const counts = useMemo(() => ({
    all: users.length,
    student: users.filter(u => u.role === 'student').length,
    teacher: users.filter(u => u.role === 'teacher').length,
    registrar: users.filter(u => u.role === 'registrar').length,
    schooladmin: users.filter(u => u.role === 'schooladmin').length,
  }), [users]);

  const toggleReveal = (userId: string) => {
    setRevealedPasswords(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'student': return <GraduationCap className="w-4 h-4" />;
      case 'teacher': return <Briefcase className="w-4 h-4" />;
      case 'schooladmin': return <Shield className="w-4 h-4" />;
      case 'registrar': return <UserCheck className="w-4 h-4" />;
      default: return <Hash className="w-4 h-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'student': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'teacher': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'schooladmin': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'registrar': return 'bg-purple-50 text-purple-600 border-purple-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getPasswordForUser = (user: UserWithSchool): { password: string; isDefault: boolean } | null => {
    if (user.password || user.tempPassword) {
      return { password: user.password || user.tempPassword || '', isDefault: false };
    }
    if (user.schoolId && user.name) {
      const firstName = user.name.split(' ')[0].replace(/[^a-zA-Z]/g, '');
      const reconstructed = `${user.schoolId.toUpperCase()}-${firstName}`;
      return { password: reconstructed, isDefault: true };
    }
    return null;
  };

  if (!isAuthorized) {
    return (
      <div className="bg-red-50 border border-red-100 p-8 rounded-3xl text-center">
        <KeyRound className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <h3 className="text-lg font-black text-red-900">Access Restricted</h3>
        <p className="text-red-600 text-sm font-medium mt-1">This panel is only accessible to authorized system agents.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-100 p-5 sm:p-6 rounded-3xl sm:rounded-[2rem] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
          <KeyRound className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-amber-900">Global Password Recovery</h3>
          <p className="text-amber-700 text-sm font-medium">View and recover stored credentials for all users across all registered schools.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-5 sm:p-8 bg-slate-50 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">User Credentials Directory</h3>
              <p className="text-slate-500 font-medium text-sm mt-1">{filteredUsers.length} of {users.length} users displayed</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition"
            >
              <option value="all">All Roles ({counts.all})</option>
              <option value="student">Students ({counts.student})</option>
              <option value="teacher">Teachers ({counts.teacher})</option>
              <option value="registrar">Registrars ({counts.registrar})</option>
              <option value="schooladmin">Admins ({counts.schooladmin})</option>
            </select>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition"
            >
              <option value="all">All Schools</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="block md:hidden divide-y divide-slate-100 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {filteredUsers.length === 0 ? (
            <div className="px-5 py-16 text-center text-slate-400 font-bold italic">
              No users found matching your search criteria.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black shrink-0 text-sm">
                    {(user.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900">{user.name || 'Unknown'}</div>
                    <div className="text-xs font-medium text-slate-500 break-all">{user.email}</div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${getRoleBadgeColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                      {user.schoolName && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200">
                          {user.schoolName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {(() => {
                  const pwData = getPasswordForUser(user);
                  if (pwData) {
                    return (
                      <div className={`border p-3 rounded-xl flex items-center justify-between gap-2 ${pwData.isDefault ? 'bg-amber-50 border-amber-100' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="min-w-0">
                          <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest block">Password {pwData.isDefault && '(Default Pattern)'}</span>
                          {revealedPasswords.has(user.id) ? (
                            <span className="font-mono text-xs font-black text-amber-800 break-all">
                              {pwData.password}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-amber-400">{'•'.repeat(12)}</span>
                          )}
                        </div>
                        <button
                          onClick={() => toggleReveal(user.id)}
                          className="shrink-0 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-[10px] font-black uppercase transition"
                        >
                          {revealedPasswords.has(user.id) ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                      <span className="text-[10px] font-bold text-slate-400 italic">No password available</span>
                    </div>
                  );
                })()}
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar">
          <table className="w-full min-w-[900px] text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50/95 backdrop-blur border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-5">User Identity</th>
                <th className="px-8 py-5">Role</th>
                <th className="px-8 py-5">School</th>
                <th className="px-8 py-5">Stored Password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold italic">
                    No users found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-amber-50/30 transition group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm">
                          {(user.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{user.name || 'Unknown'}</div>
                          <div className="text-xs font-medium text-slate-500">{user.email}</div>
                          {user.studentId && (
                            <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">ID: {user.studentId}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getRoleBadgeColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm font-bold text-slate-700">{user.schoolName || 'N/A'}</div>
                      {user.schoolId && (
                        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">{user.schoolId}</div>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      {(() => {
                        const pwData = getPasswordForUser(user);
                        if (pwData) {
                          return (
                            <div className={`border px-4 py-2.5 rounded-xl flex items-center gap-3 max-w-xs ${pwData.isDefault ? 'bg-amber-50 border-amber-100' : 'bg-amber-50 border-amber-100'}`}>
                              <div className="min-w-0 flex-1">
                                {revealedPasswords.has(user.id) ? (
                                  <span className="font-mono text-xs font-black text-amber-800 break-all block">
                                    {pwData.password}
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-amber-400 tracking-wider">{'•'.repeat(12)}</span>
                                )}
                                {pwData.isDefault && revealedPasswords.has(user.id) && (
                                  <span className="text-[8px] font-bold text-amber-500 mt-0.5 block">Default pattern - may have been changed</span>
                                )}
                              </div>
                              <button
                                onClick={() => toggleReveal(user.id)}
                                className="shrink-0 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-[10px] font-black uppercase transition"
                              >
                                {revealedPasswords.has(user.id) ? 'Hide' : 'Show'}
                              </button>
                            </div>
                          );
                        }
                        return (
                          <span className="text-[10px] font-bold text-slate-400 italic">No password available</span>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgentPasswordRecovery;
