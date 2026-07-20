import React, { useEffect, useState, useMemo } from 'react';
import { userService, type UserData } from '../../services/userService';
import { academicService } from '../../services/academicService';
import { Shield, GraduationCap, Briefcase, Hash, UserX, Star, Trash2, FileText, X, UserCheck } from 'lucide-react';
import StudentReportCard from '../grade/StudentReportCard';

interface UserListProps {
  schoolId: string;
  currentUserProfile: any;
}

const UserList: React.FC<UserListProps> = ({ schoolId, currentUserProfile }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<UserData | null>(null);
  const [classesMap, setClassesMap] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'schooladmin' | 'teacher' | 'registrar' | 'student'>('all');

  const counts = useMemo(() => {
    return {
      all: users.length,
      schooladmin: users.filter(u => u.role === 'schooladmin').length,
      teacher: users.filter(u => u.role === 'teacher').length,
      registrar: users.filter(u => u.role === 'registrar').length,
      student: users.filter(u => u.role === 'student').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (activeCategory !== 'all') {
      result = users.filter(u => u.role === activeCategory);
    }
    if (activeCategory === 'student' && selectedClassId) {
      result = result.filter(u => u.classId === selectedClassId);
    }
    return result;
  }, [users, activeCategory, selectedClassId]);

  useEffect(() => {
    const unsubscribeUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
      const activeSortedList = userList
        .filter((user: any) => user.status !== 'inactive')
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setUsers(activeSortedList);
      setLoading(false);
    });

    const unsubscribeClasses = academicService.subscribeToSchoolClasses(schoolId, (classList) => {
      setClasses(classList.map(c => ({ id: c.id, name: c.name })));
      const cmap: Record<string, string> = {};
      classList.forEach(c => {
        cmap[c.id] = c.name;
      });
      setClassesMap(cmap);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeClasses();
    };
  }, [schoolId]);

  const handleStatusChange = async (userId: string, currentStatus: string) => {
    const targetUser = users.find(u => u.id === userId);
    
    // Safety check: Don't allow removing Main Admin
    if (targetUser?.isMainAdmin) {
      alert("Main Administrators cannot be deactivated.");
      return;
    }

    // Permission check: Only Main Admin can remove other admins
    if (targetUser?.role === 'schooladmin' && !currentUserProfile.isMainAdmin) {
      alert("Only the Main Administrator can deactivate other admin accounts.");
      return;
    }

    // Multi-tenant check: Verify target user belongs to same school as current admin
    if (currentUserProfile.role !== 'superadmin' && targetUser?.schoolId !== currentUserProfile.schoolId) {
      alert("Unauthorized: You do not have permission to manage users from other schools.");
      return;
    }

    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    if (window.confirm(`Are you sure you want to mark ${targetUser?.name} as ${newStatus}?`)) {
      try {
        await userService.updateProfileDetails(userId, { status: newStatus });
      } catch (error) {
        console.error("Error updating user status:", error);
        alert("Failed to update user status.");
      }
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (currentUserProfile.role !== 'superadmin' && targetUser?.schoolId !== currentUserProfile.schoolId) {
      alert("Unauthorized: You do not have permission to manage users from other schools.");
      return;
    }

    if (window.confirm(`Are you sure you want to PERMANENTLY delete ${name}? This action will remove all profile data and cannot be undone.`)) {
      try {
        await userService.deleteUserProfile(userId);
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Failed to delete user account.");
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'schooladmin': return <Shield className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'teacher': return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'registrar': return <UserCheck className="w-4 h-4 text-amber-500" />;
      default: return <GraduationCap className="w-4 h-4 text-green-500" />;
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-500 font-bold">Loading members...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Active School Members</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Manage and organize administrative, instructional, and enrollment accounts.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {activeCategory === 'student' && classes.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-xl shadow-sm">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="border-none bg-transparent font-black text-[10px] uppercase text-slate-500 outline-none cursor-pointer tracking-wider"
              >
                <option value="">All Classrooms</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All', count: counts.all, color: 'indigo' },
              { id: 'schooladmin', label: 'Admins', count: counts.schooladmin, color: 'red' },
              { id: 'teacher', label: 'Teachers', count: counts.teacher, color: 'blue' },
              { id: 'registrar', label: 'Registrars', count: counts.registrar, color: 'amber' },
              { id: 'student', label: 'Students', count: counts.student, color: 'emerald' }
            ].map(tab => {
              const isActive = activeCategory === tab.id;
              const activeColorClasses: Record<string, string> = {
                indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm',
                red: 'bg-red-50 text-red-600 border-red-200 shadow-sm',
                blue: 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm',
                amber: 'bg-amber-50 text-amber-600 border-amber-200 shadow-sm',
                emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm',
              };
              const activeBadgeClasses: Record<string, string> = {
                indigo: 'bg-indigo-100',
                red: 'bg-red-100',
                blue: 'bg-blue-100',
                amber: 'bg-amber-100',
                emerald: 'bg-emerald-100',
              };
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveCategory(tab.id as any);
                    setSelectedClassId(''); // Reset class filter when changing tabs
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition border ${
                    isActive 
                      ? activeColorClasses[tab.color]
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.label} <span className={`ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                    isActive ? activeBadgeClasses[tab.color] : 'bg-slate-100 text-slate-500'
                  }`}>{tab.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/20 text-[10px] uppercase text-slate-400 font-black tracking-widest border-b border-slate-100">
              <th className="px-6 py-4">Member</th>
              <th className="px-6 py-4">Identifier</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold italic bg-white">
                  No active members found in this category.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                // Determine if deactivation is allowed for this row
                const isTargetMainAdmin = user.isMainAdmin;
                const isTargetAdmin = user.role === 'schooladmin';
                const isSelf = user.id === currentUserProfile.id;
                
                const isCurrentUserAdmin = currentUserProfile.role === 'schooladmin' || currentUserProfile.role === 'superadmin';
                const canManage = isCurrentUserAdmin && !isTargetMainAdmin && !isSelf && (
                  !isTargetAdmin || currentUserProfile.isMainAdmin
                );

                return (
                  <tr key={user.id} className="hover:bg-slate-50/30 transition group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm uppercase">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            {user.name}
                            {isTargetMainAdmin && (
                              <span title="Main Administrator">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              </span>
                            )}
                          </div>
                          {isSelf && <div className="text-[9px] text-blue-600 font-black tracking-wider uppercase">YOU</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {user.role === 'student' && user.studentId ? (
                        <div className="flex items-center gap-1.5 text-indigo-600 font-mono font-bold">
                          <Hash className="w-3.5 h-3.5 text-indigo-400" />
                          {user.studentId}
                        </div>
                      ) : (
                        <div className="text-slate-500 font-medium truncate max-w-[180px]">{user.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold capitalize text-slate-600">
                        {getRoleIcon(user.role)}
                        {user.role === 'schooladmin' ? 'Admin' : user.role}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        user.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                     <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2 items-center">
                         {user.role === 'student' && (
                           <button 
                             onClick={() => setSelectedStudent(user)}
                             className="p-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition flex items-center justify-center shadow-sm border border-blue-100"
                             title="View & Download Gradesheet"
                           >
                             <FileText className="w-4 h-4" />
                           </button>
                         )}
                         {canManage ? (
                           <>
                             <button 
                               onClick={() => handleStatusChange(user.id, user.status)}
                               className="p-1.5 rounded-xl bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-amber-50 hover:text-amber-600 transition"
                               title={user.status === 'active' ? 'Deactivate User' : 'Reactivate User'}
                             >
                               <UserX className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => handleDelete(user.id, user.name)}
                               className="p-1.5 rounded-xl bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition"
                               title="PERMANENTLY Delete Account"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </>
                         ) : (
                           user.role !== 'student' && (
                             <div className="text-[10px] text-slate-300 font-bold italic">
                               {isTargetMainAdmin ? 'Main Admin (Protected)' : (isSelf ? 'Self (Protected)' : 'Restricted')}
                             </div>
                           )
                         )}
                       </div>
                     </td>
                   </tr>
                 );
               })
             )}
           </tbody>
         </table>
       </div>

       {/* Student Gradesheet Preview Modal for Admins */}
       {selectedStudent && (
         <div 
           className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
           onClick={() => setSelectedStudent(null)}
         >
           <div 
             className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-in relative"
             onClick={(e) => e.stopPropagation()}
           >
             {/* Modal Header */}
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                   <GraduationCap className="w-5 h-5" />
                 </div>
                 <div>
                   <span className="font-black text-slate-800 text-sm uppercase tracking-wider block">Student Gradesheet Preview</span>
                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Administrator Access Mode</span>
                 </div>
               </div>
               <button 
                 type="button" 
                 onClick={() => setSelectedStudent(null)}
                 className="p-2.5 hover:bg-red-50 hover:text-red-600 rounded-xl text-slate-400 transition-all border border-transparent hover:border-red-100"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>
             
             {/* Modal Body */}
             <div className="p-3 sm:p-6 max-h-[70vh] sm:max-h-[78vh] overflow-y-auto custom-scrollbar bg-slate-50 space-y-4">
               {selectedStudent.password && (
                 <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between gap-4">
                   <div>
                     <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block mb-0.5">Administrative Password Recovery</span>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Secure credential passcode generated for institutional access recovery.</p>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="font-mono text-xs font-black text-amber-800 bg-white border border-amber-200 px-3.5 py-2 rounded-xl shadow-sm">
                       {selectedStudent.password}
                     </span>
                   </div>
                 </div>
               )}

               <StudentReportCard 
                 studentId={selectedStudent.id} 
                 schoolId={schoolId} 
                 studentName={selectedStudent.name}
                 classroomName={selectedStudent.classId ? classesMap[selectedStudent.classId] || 'General' : 'General'}
               />
             </div>
           </div>
         </div>
       )}
     </div>
   );
 };

export default UserList;
