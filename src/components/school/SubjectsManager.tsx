import React, { useState, useMemo } from 'react';
import { academicService, type SubjectData, type AssignmentData } from '../../services/academicService';
import {
  Plus, Trash2, BookOpen, Search, Loader2, FilePenLine
} from 'lucide-react';

const CATEGORIES = ['All', 'Core STEM', 'Humanities & Lit', 'Languages', 'Social Sciences'];

interface SubjectsManagerProps {
  schoolId: string;
  academicYear: string;
  subjects: SubjectData[];
  assignments: AssignmentData[];
  actionLoading: boolean;
  setActionLoading: (v: boolean) => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export const SubjectsManager: React.FC<SubjectsManagerProps> = ({
  schoolId, academicYear, subjects, assignments, actionLoading, setActionLoading, showSuccess, showError
}) => {
  const [searchSubjectQuery, setSearchSubjectQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectCategory, setNewSubjectCategory] = useState('Core STEM');
  const [newSubjectCredits, setNewSubjectCredits] = useState('3.0');
  const [newSubjectPassScore, setNewSubjectPassScore] = useState('70');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [editSubjectCategory, setEditSubjectCategory] = useState('Core STEM');
  const [editSubjectCredits, setEditSubjectCredits] = useState('3.0');
  const [editSubjectPassScore, setEditSubjectPassScore] = useState('70');

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchSubjectQuery.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(searchSubjectQuery.toLowerCase()));
      const matchesCat = selectedCategoryFilter === 'All' || s.category === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [subjects, searchSubjectQuery, selectedCategoryFilter]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setActionLoading(true);
    try {
      await academicService.createSubject(newSubjectName, schoolId, {
        code: newSubjectCode,
        category: newSubjectCategory,
        creditHours: Number(newSubjectCredits) || 3.0,
        passScore: Number(newSubjectPassScore) || 70,
        academicYear
      });
      setNewSubjectName('');
      setNewSubjectCode('');
      showSuccess(`Subject "${newSubjectName}" added to curriculum.`);
    } catch (err: any) {
      showError(err.message || 'Failed to create subject.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEditSubject = (subject: SubjectData) => {
    setEditingSubjectId(subject.id);
    setEditSubjectName(subject.name || '');
    setEditSubjectCode(subject.code || '');
    setEditSubjectCategory(subject.category || 'Core STEM');
    setEditSubjectCredits(String(subject.creditHours ?? 3.0));
    setEditSubjectPassScore(String(subject.passScore ?? 70));
  };

  const handleSaveSubjectEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubjectId || !editSubjectName.trim()) return;

    setActionLoading(true);
    try {
      await academicService.updateSubject(schoolId, editingSubjectId, {
        name: editSubjectName,
        code: editSubjectCode,
        category: editSubjectCategory,
        creditHours: Number(editSubjectCredits) || 3.0,
        passScore: Number(editSubjectPassScore) || 70
      });
      showSuccess(`Subject "${editSubjectName}" updated successfully.`);
      setEditingSubjectId(null);
    } catch (err: any) {
      showError(err.message || 'Failed to update subject.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
    if (!window.confirm(`Remove "${subjectName}" from the curriculum? All teaching assignments for this subject will be revoked.`)) return;
    setActionLoading(true);
    try {
      const subjectAssignments = assignments.filter(a => a.subjectId === subjectId);
      await Promise.all(subjectAssignments.map(a => academicService.revokeAssignment(schoolId, a.id)));
      await academicService.deleteSubject(schoolId, subjectId);
      showSuccess(`Subject "${subjectName}" removed.`);
    } catch (err: any) {
      showError(err.message || 'Failed to remove subject.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in duration-300">
      <div className="xl:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" /> New Subject
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Curriculum</span>
        </div>

        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject Name *</label>
            <input type="text" required placeholder="e.g. Advanced Algebra"
              value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Course Code</label>
              <input type="text" placeholder="e.g. MATH-101"
                value={newSubjectCode} onChange={e => setNewSubjectCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
              <select value={newSubjectCategory} onChange={e => setNewSubjectCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                {CATEGORIES.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Credit Hours</label>
              <input type="number" step="0.5" value={newSubjectCredits} onChange={e => setNewSubjectCredits(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Pass Score (%)</label>
              <input type="number" value={newSubjectPassScore} onChange={e => setNewSubjectPassScore(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800" />
            </div>
          </div>

          <button type="submit" disabled={actionLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add to Curriculum'}
          </button>
        </form>
      </div>

      {editingSubjectId && (
        <div className="xl:col-span-4 bg-white p-6 rounded-3xl border border-indigo-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FilePenLine className="w-4 h-4 text-indigo-600" /> Edit Subject
            </h3>
            <button
              type="button"
              onClick={() => setEditingSubjectId(null)}
              className="text-[10px] font-bold text-slate-400 uppercase"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveSubjectEdit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject Name *</label>
              <input
                type="text"
                required
                value={editSubjectName}
                onChange={e => setEditSubjectName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Course Code</label>
                <input
                  type="text"
                  value={editSubjectCode}
                  onChange={e => setEditSubjectCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={editSubjectCategory}
                  onChange={e => setEditSubjectCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Credit Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={editSubjectCredits}
                  onChange={e => setEditSubjectCredits(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Pass Score (%)</label>
                <input
                  type="number"
                  value={editSubjectPassScore}
                  onChange={e => setEditSubjectPassScore(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
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

      <div className="xl:col-span-8 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedCategoryFilter === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="relative w-56">
            <input type="text" placeholder="Filter subjects..." value={searchSubjectQuery}
              onChange={e => setSearchSubjectQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          </div>
        </div>

        {filteredSubjects.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs font-medium italic shadow-sm">
            No curriculum subjects found matching filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubjects.map(s => {
              const assignedTeachers = assignments.filter(a => a.subjectId === s.id);
              return (
                <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between min-h-[180px]">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center shadow-inner">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{s.name}</h4>
                          <p className="text-[10px] text-indigo-600 font-mono font-bold mt-0.5">{s.code || 'COURSE'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                        {s.category || 'General'}
                      </span>
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold">
                        {s.academicYear || academicYear}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{s.creditHours || 3.0} Credits</span>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                      <span>Instructors: {assignedTeachers.length}</span>
                      <span className="text-slate-400">Pass Score: {s.passScore || 70}%</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEditSubject(s)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                        title="Edit subject"
                      >
                        <FilePenLine className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(s.id, s.name)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 shadow-sm transition hover:bg-red-600 hover:text-white hover:border-red-600"
                        title="Delete subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
