import React, { useState, useMemo } from 'react';
import { academicService, type ClassData, type SubjectData, type AssignmentData } from '../../services/academicService';
import type { UserData } from '../../services/userService';
import {
  GraduationCap, Search, UserMinus, Loader2
} from 'lucide-react';

interface AssignmentsManagerProps {
  schoolId: string;
  academicYear: string;
  classes: ClassData[];
  subjects: SubjectData[];
  activeTeachers: UserData[];
  assignments: AssignmentData[];
  actionLoading: boolean;
  setActionLoading: (v: boolean) => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export const AssignmentsManager: React.FC<AssignmentsManagerProps> = ({
  schoolId, academicYear, classes, subjects, activeTeachers, assignments,
  actionLoading, setActionLoading, showSuccess, showError
}) => {
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignTerm, setAssignTerm] = useState('');
  const [searchAssignmentQuery, setSearchAssignmentQuery] = useState('');

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a =>
      a.teacherName.toLowerCase().includes(searchAssignmentQuery.toLowerCase()) ||
      a.className.toLowerCase().includes(searchAssignmentQuery.toLowerCase()) ||
      a.subjectName.toLowerCase().includes(searchAssignmentQuery.toLowerCase())
    );
  }, [assignments, searchAssignmentQuery]);

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTeacherId || !assignClassId || !assignSubjectId) {
      showError('Please fill out all assignment fields.');
      return;
    }

    const teacher = activeTeachers.find(t => t.id === assignTeacherId);
    const classroom = classes.find(c => c.id === assignClassId);
    const subject = subjects.find(s => s.id === assignSubjectId);

    if (!teacher || !classroom || !subject) {
      showError('Invalid selection references.');
      return;
    }

    const duplicate = assignments.some(
      a => a.teacherId === assignTeacherId && a.classId === assignClassId && a.subjectId === assignSubjectId && (a.academicYear || academicYear) === academicYear
    );

    if (duplicate) {
      showError(`${teacher.name} is already assigned to teach ${subject.name} to ${classroom.name}.`);
      return;
    }

    setActionLoading(true);
    try {
      await academicService.assignTeacher(
        assignTeacherId, teacher.name, assignClassId, classroom.name,
        assignSubjectId, subject.name, schoolId, { term: assignTerm || academicYear, academicYear }
      );

      setAssignTeacherId('');
      setAssignClassId('');
      setAssignSubjectId('');
      showSuccess(`Assigned ${teacher.name} to teach ${subject.name} for ${classroom.name}.`);
    } catch (err: any) {
      showError(err.message || 'Failed to create assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAssignment = async (assignmentId: string, teacherName: string, subjectName: string, className: string) => {
    if (!window.confirm(`Revoke teaching assignment for ${teacherName} (${subjectName} in ${className})?`)) return;
    setActionLoading(true);
    try {
      await academicService.revokeAssignment(schoolId, assignmentId);
      showSuccess('Teaching assignment revoked.');
    } catch {
      showError('Failed to revoke teaching assignment.');
    } finally {
      setActionLoading(false);
    }
  };

  const missingPrereqs = activeTeachers.length === 0 || classes.length === 0 || subjects.length === 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300">
      <div className="xl:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" /> Assign Instructor
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Workload</span>
        </div>

        {missingPrereqs ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-medium leading-relaxed">
            Prerequisites required before assigning teachers:
            <ul className="list-disc pl-4 mt-2 space-y-1 font-bold">
              <li>Active Teachers ({activeTeachers.length})</li>
              <li>Registered Classrooms ({classes.length})</li>
              <li>Curriculum Subjects ({subjects.length})</li>
            </ul>
          </div>
        ) : (
          <form onSubmit={handleAssignTeacher} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Instructor *</label>
              <select required value={assignTeacherId} onChange={e => setAssignTeacherId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                <option value="">-- Choose Instructor --</option>
                {activeTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Classroom *</label>
              <select required value={assignClassId} onChange={e => setAssignClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                <option value="">-- Choose Classroom --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Subject *</label>
              <select required value={assignSubjectId} onChange={e => setAssignSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                <option value="">-- Choose Subject --</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Academic Term</label>
              <input type="text" value={assignTerm} onChange={e => setAssignTerm(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800" />
            </div>

            <button type="submit" disabled={actionLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Teaching Load'}
            </button>
          </form>
        )}
      </div>

      <div className="xl:col-span-8 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Active Teacher Allocations</h4>
              <p className="text-xs text-slate-500 mt-0.5">Total teaching assignments ({filteredAssignments.length})</p>
            </div>
            <div className="relative w-56">
              <input type="text" placeholder="Search assignments..." value={searchAssignmentQuery}
                onChange={e => setSearchAssignmentQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs" />
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase text-slate-400 font-extrabold tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4">Instructor</th>
                  <th className="px-6 py-4">Classroom</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Term</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                      No teaching allocations found matching search.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                            {a.teacherName.charAt(0)}
                          </div>
                          <span className="font-extrabold text-slate-900">{a.teacherName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs">{a.className}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">{a.subjectName}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        <div className="flex flex-col gap-1">
                          <span>{a.term || academicYear || 'Academic Year'}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">{a.academicYear || academicYear}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRevokeAssignment(a.id, a.teacherName, a.subjectName, a.className)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title="Revoke Assignment">
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
