import React, { useState, useMemo } from 'react';
import { academicService, type ClassData, type AssignmentData } from '../../services/academicService';
import type { UserData } from '../../services/userService';
import {
  Plus, Trash2, Users, Search, UserPlus, UserMinus, Loader2, FilePenLine
} from 'lucide-react';

interface ClassroomsManagerProps {
  schoolId: string;
  academicYear: string;
  classes: ClassData[];
  activeStudents: UserData[];
  unassignedStudents: UserData[];
  activeTeachers: UserData[];
  assignments: AssignmentData[];
  actionLoading: boolean;
  setActionLoading: (v: boolean) => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export const ClassroomsManager: React.FC<ClassroomsManagerProps> = ({
  schoolId, academicYear, classes, activeStudents, unassignedStudents, activeTeachers,
  assignments, actionLoading, setActionLoading, showSuccess, showError
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    classes.length > 0 ? classes[0].id : null
  );
  const [searchClassQuery, setSearchClassQuery] = useState('');
  const [searchRosterQuery, setSearchRosterQuery] = useState('');
  const [searchUnassignedQuery, setSearchUnassignedQuery] = useState('');

  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('Senior High');
  const [newClassRoom, setNewClassRoom] = useState('');
  const [newClassCapacity, setNewClassCapacity] = useState('40');
  const [newClassAdvisorId, setNewClassAdvisorId] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  const [editClassCode, setEditClassCode] = useState('');
  const [editClassGrade, setEditClassGrade] = useState('Senior High');
  const [editClassRoom, setEditClassRoom] = useState('');
  const [editClassCapacity, setEditClassCapacity] = useState('40');
  const [editClassAdvisorId, setEditClassAdvisorId] = useState('');

  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassId) return [];
    return activeStudents.filter(s => s.classId === selectedClassId && (
      s.name.toLowerCase().includes(searchRosterQuery.toLowerCase()) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchRosterQuery.toLowerCase()))
    ));
  }, [activeStudents, selectedClassId, searchRosterQuery]);

  const filteredUnassigned = useMemo(() => {
    return unassignedStudents.filter(s =>
      s.name.toLowerCase().includes(searchUnassignedQuery.toLowerCase()) ||
      (s.studentId && s.studentId.toLowerCase().includes(searchUnassignedQuery.toLowerCase()))
    );
  }, [unassignedStudents, searchUnassignedQuery]);

  const filteredClasses = useMemo(() => {
    return classes.filter(c =>
      c.name.toLowerCase().includes(searchClassQuery.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(searchClassQuery.toLowerCase())) ||
      (c.gradeLevel && c.gradeLevel.toLowerCase().includes(searchClassQuery.toLowerCase()))
    );
  }, [classes, searchClassQuery]);

  const selectedClassDetails = classes.find(c => c.id === selectedClassId);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setActionLoading(true);
    try {
      const advisor = activeTeachers.find(t => t.id === newClassAdvisorId);
      await academicService.createClass(newClassName, schoolId, {
        code: newClassCode,
        gradeLevel: newClassGrade,
        roomNumber: newClassRoom,
        capacity: Number(newClassCapacity) || 40,
        advisorId: newClassAdvisorId || undefined,
        advisorName: advisor ? advisor.name : undefined,
        academicYear
      });

      setNewClassName('');
      setNewClassCode('');
      setNewClassRoom('');
      setNewClassAdvisorId('');
      showSuccess(`Classroom "${newClassName}" registered successfully.`);
    } catch (err: any) {
      showError(err.message || 'Failed to create classroom.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEditClass = (classItem: ClassData) => {
    setEditingClassId(classItem.id);
    setEditClassName(classItem.name || '');
    setEditClassCode(classItem.code || '');
    setEditClassGrade(classItem.gradeLevel || 'Senior High');
    setEditClassRoom(classItem.roomNumber || '');
    setEditClassCapacity(String(classItem.capacity || 40));
    setEditClassAdvisorId(classItem.advisorId || '');
  };

  const handleSaveClassEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClassId || !editClassName.trim()) return;

    setActionLoading(true);
    try {
      const advisor = activeTeachers.find(t => t.id === editClassAdvisorId);
      await academicService.updateClass(schoolId, editingClassId, {
        name: editClassName,
        code: editClassCode,
        gradeLevel: editClassGrade,
        roomNumber: editClassRoom,
        capacity: Number(editClassCapacity) || 40,
        advisorId: editClassAdvisorId || null,
        advisorName: advisor ? advisor.name : null
      });
      showSuccess(`Classroom "${editClassName}" updated successfully.`);
      setEditingClassId(null);
    } catch (err: any) {
      showError(err.message || 'Failed to update classroom.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClass = async (classId: string, className: string) => {
    if (!window.confirm(`Delete classroom "${className}"? Students will be unassigned but not deleted.`)) return;
    setActionLoading(true);
    try {
      const batchUnassign = activeStudents
        .filter(s => s.classId === classId)
        .map(s => academicService.assignStudentToClass(s.id, null));

      await Promise.all(batchUnassign);
      const classAssignments = assignments.filter(a => a.classId === classId);
      await Promise.all(classAssignments.map(a => academicService.revokeAssignment(schoolId, a.id)));

      await academicService.deleteClass(schoolId, classId);

      if (selectedClassId === classId) {
        setSelectedClassId(classes.find(c => c.id !== classId)?.id || null);
      }

      showSuccess(`Classroom "${className}" deleted.`);
    } catch (err: any) {
      showError(err.message || 'Failed to delete classroom.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddStudentToClass = async (studentId: string) => {
    if (!selectedClassId) return;
    setActionLoading(true);
    try {
      await academicService.assignStudentToClass(studentId, selectedClassId);
      showSuccess('Student enrolled into class roster.');
    } catch {
      showError('Failed to assign student.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveStudentFromClass = async (studentId: string) => {
    setActionLoading(true);
    try {
      await academicService.assignStudentToClass(studentId, null);
      showSuccess('Student unenrolled from classroom roster.');
    } catch {
      showError('Failed to remove student.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300">
      <div className="xl:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" /> Create Classroom
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">New School Group</span>
          </div>

          <form onSubmit={handleCreateClass} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Classroom Name *</label>
              <input
                type="text" required placeholder="e.g. Grade 10-Alpha"
                value={newClassName} onChange={e => setNewClassName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Class Code</label>
                <input type="text" placeholder="e.g. 10-A"
                  value={newClassCode} onChange={e => setNewClassCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Grade Level</label>
                <select value={newClassGrade} onChange={e => setNewClassGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                  <option value="Senior High">Senior High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Room #</label>
                <input type="text" placeholder="e.g. Room 204"
                  value={newClassRoom} onChange={e => setNewClassRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Capacity</label>
                <input type="number" value={newClassCapacity} onChange={e => setNewClassCapacity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Class Advisor / Main Teacher</label>
              <select value={newClassAdvisorId} onChange={e => setNewClassAdvisorId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                <option value="">-- Optional Advisor --</option>
                {activeTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={actionLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Classroom'}
            </button>
          </form>
        </div>

        {editingClassId && (
          <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FilePenLine className="w-4 h-4 text-indigo-600" /> Edit Classroom
              </h3>
              <button
                type="button"
                onClick={() => setEditingClassId(null)}
                className="text-[10px] font-bold text-slate-400 uppercase"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveClassEdit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Classroom Name *</label>
                <input
                  type="text"
                  required
                  value={editClassName}
                  onChange={e => setEditClassName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Class Code</label>
                  <input
                    type="text"
                    value={editClassCode}
                    onChange={e => setEditClassCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Grade Level</label>
                  <select
                    value={editClassGrade}
                    onChange={e => setEditClassGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                    <option value="Senior High">Senior High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Room #</label>
                  <input
                    type="text"
                    value={editClassRoom}
                    onChange={e => setEditClassRoom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={editClassCapacity}
                    onChange={e => setEditClassCapacity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Class Advisor / Main Teacher</label>
                <select
                  value={editClassAdvisorId}
                  onChange={e => setEditClassAdvisorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">-- Optional Advisor --</option>
                  {activeTeachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Classrooms ({filteredClasses.length})</span>
            <div className="relative w-40">
              <input type="text" placeholder="Search..." value={searchClassQuery}
                onChange={e => setSearchClassQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium italic border border-dashed rounded-2xl">
              No classrooms match query.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredClasses.map(c => {
                const isSelected = selectedClassId === c.id;
                const enrolledCount = activeStudents.filter(s => s.classId === c.id).length;
                const maxCap = c.capacity || 40;
                const capPercent = Math.min(100, Math.round((enrolledCount / maxCap) * 100));

                return (
                  <div key={c.id} onClick={() => setSelectedClassId(c.id)}
                    className={`p-4 rounded-2xl border transition cursor-pointer relative group ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-50/90 to-violet-50/90 border-indigo-300 text-slate-900 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {c.code || c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-900">{c.name}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                            {c.gradeLevel || 'General'}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">
                            {c.academicYear || academicYear}
                          </span>
                          {c.roomNumber && (
                            <span className="text-[10px] text-slate-400 font-medium">{c.roomNumber}</span>
                          )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleStartEditClass(c); }}
                          className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit classroom"
                        >
                          <FilePenLine className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id, c.name); }}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete classroom"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Enrolled: {enrolledCount} / {maxCap}</span>
                        <span>{capPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${capPercent >= 90 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                          style={{ width: `${capPercent}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="xl:col-span-8">
        {selectedClassId && selectedClassDetails ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[650px]">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{selectedClassDetails.name} Roster</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Advisor: <strong className="text-indigo-600">{selectedClassDetails.advisorName || 'Not Assigned'}</strong>
                  </p>
                </div>
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 w-max">
                  {studentsInSelectedClass.length} Enrolled
                </span>
              </div>

              <div className="p-4 border-b border-slate-100 bg-white">
                <div className="relative">
                  <input type="text" placeholder="Filter enrolled students by name or ID..."
                    value={searchRosterQuery} onChange={e => setSearchRosterQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                {studentsInSelectedClass.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-medium italic">
                    No students currently enrolled in {selectedClassDetails.name}. Pick students from the panel on the right.
                  </div>
                ) : (
                  studentsInSelectedClass.map(s => (
                    <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 rounded-2xl transition group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-900">{s.name}</h5>
                          <p className="text-[10px] text-indigo-600 font-mono font-medium">{s.studentId || 'NO-ID'}</p>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveStudentFromClass(s.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-xl text-[10px] font-bold transition border border-slate-200 hover:border-red-200">
                        <UserMinus className="w-3.5 h-3.5" />
                        Unenroll
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[650px]">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h4 className="font-extrabold text-sm text-slate-900">Enroll Students</h4>
                <p className="text-xs text-slate-500 mt-0.5">Unassigned students in school ({unassignedStudents.length})</p>
              </div>

              <div className="p-4 border-b border-slate-100 bg-white">
                <div className="relative">
                  <input type="text" placeholder="Search unassigned students..."
                    value={searchUnassignedQuery} onChange={e => setSearchUnassignedQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                {filteredUnassigned.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs font-medium italic">
                    All active students are assigned to classrooms!
                  </div>
                ) : (
                  filteredUnassigned.map(s => (
                    <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 rounded-2xl transition">
                      <div>
                        <h5 className="font-bold text-xs text-slate-900">{s.name}</h5>
                        <p className="text-[10px] text-slate-400 font-mono">{s.studentId || 'NO-ID'}</p>
                      </div>
                      <button onClick={() => handleAddStudentToClass(s.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-[10px] font-bold transition border border-indigo-100">
                        <UserPlus className="w-3.5 h-3.5" />
                        Enroll
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
            <Users className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-800 text-base">Select a Classroom</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Choose a classroom from the left side list or create a new classroom to manage student rosters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
