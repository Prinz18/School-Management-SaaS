import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { academicService, type ClassData, type SubjectData, type AssignmentData } from '../../services/academicService';
import { userService, type UserData } from '../../services/userService';
import { schoolService, type SchoolData } from '../../services/schoolService';
import {
  Briefcase, BookOpen, Users, Sparkles, Loader2, Info, Palette, CalendarDays, Plus, Check
} from 'lucide-react';
import { ReportTemplateEditor } from './ReportTemplateEditor';
import { ClassroomsManager } from './ClassroomsManager';
import { SubjectsManager } from './SubjectsManager';
import { AssignmentsManager } from './AssignmentsManager';
import { Toast } from '../common/Toast';

interface AcademicsManagerProps {
  schoolId: string;
}

export const AcademicsManager: React.FC<AcademicsManagerProps> = ({ schoolId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'classes' | 'subjects' | 'assignments' | 'template'>('classes');

  const [school, setSchool] = useState<SchoolData | null>(null);
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string>('');
  const [newAcademicYear, setNewAcademicYear] = useState('');
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubSchools = schoolService.subscribeToSchools((schoolList) => {
      const foundSchool = schoolList.find(s => s.schoolId === schoolId) || null;
      setSchool(foundSchool);
      const years = foundSchool?.academicYears?.length ? foundSchool.academicYears : [];
      const resolvedCurrent = foundSchool?.currentAcademicYear || years[0] || '';
      setAcademicYears(years);
      setCurrentAcademicYear(resolvedCurrent);
      if (!newAcademicYear && resolvedCurrent) {
        setNewAcademicYear(resolvedCurrent);
      }
    });

    const unsubClasses = academicService.subscribeToSchoolClasses(schoolId, setClasses, currentAcademicYear);
    const unsubSubjects = academicService.subscribeToSchoolSubjects(schoolId, setSubjects, currentAcademicYear);
    const unsubAssignments = academicService.subscribeToSchoolAssignments(schoolId, setAssignments, currentAcademicYear);
    const unsubUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
      setAllUsers(userList);
      setLoading(false);
    });

    return () => {
      unsubSchools();
      unsubClasses();
      unsubSubjects();
      unsubAssignments();
      unsubUsers();
    };
  }, [schoolId, currentAcademicYear]);

  const activeTeachers = useMemo(
    () => allUsers.filter(u => u.role === 'teacher' && u.status === 'active'),
    [allUsers]
  );
  const activeStudents = useMemo(
    () => allUsers.filter(u => u.role === 'student' && u.status === 'active'),
    [allUsers]
  );
  const unassignedStudents = useMemo(
    () => activeStudents.filter(s => !s.classId),
    [activeStudents]
  );

  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  }, []);

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4500);
  }, []);

  const handleAddAcademicYear = async () => {
    const trimmed = newAcademicYear.trim();
    if (!trimmed) return;
    if (academicYears.includes(trimmed)) {
      showError('That academic year already exists.');
      return;
    }

    const nextYears = [...academicYears, trimmed].sort();
    setActionLoading(true);
    try {
      await schoolService.updateAcademicYears(schoolId, nextYears, currentAcademicYear || trimmed);
      setAcademicYears(nextYears);
      setNewAcademicYear('');
      showSuccess(`Academic year "${trimmed}" added.`);
    } catch (err: any) {
      showError(err.message || 'Failed to add academic year.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateAcademicYear = async (year: string) => {
    setActionLoading(true);
    try {
      await schoolService.setCurrentAcademicYear(schoolId, year);
      setCurrentAcademicYear(year);
      showSuccess(`Active academic year switched to ${year}.`);
    } catch (err: any) {
      showError(err.message || 'Failed to switch academic year.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!window.confirm("Seed default Liberian Curriculum (Mathematics, English, Physics, Chemistry, Biology, Social Studies) and standard Grade 10-12 Classrooms?")) return;
    setSeeding(true);
    try {
      await academicService.createClass("Grade 10-Alpha", schoolId, { code: "10-A", gradeLevel: "Senior High", roomNumber: "Room 101", capacity: 40, academicYear: currentAcademicYear });
      await academicService.createClass("Grade 11-Science", schoolId, { code: "11-SCI", gradeLevel: "Senior High", roomNumber: "Lab 2", capacity: 35, academicYear: currentAcademicYear });
      await academicService.createClass("Grade 12-Senior", schoolId, { code: "12-SR", gradeLevel: "Senior High", roomNumber: "Room 304", capacity: 40, academicYear: currentAcademicYear });
      await academicService.createSubject("Mathematics & Algebra", schoolId, { code: "MATH-101", category: "Core STEM", creditHours: 4.0, passScore: 70, academicYear: currentAcademicYear });
      await academicService.createSubject("English Language & Lit", schoolId, { code: "ENG-101", category: "Humanities & Lit", creditHours: 4.0, passScore: 70, academicYear: currentAcademicYear });
      await academicService.createSubject("General Physics", schoolId, { code: "PHYS-201", category: "Core STEM", creditHours: 3.5, passScore: 70, academicYear: currentAcademicYear });
      await academicService.createSubject("Chemistry & Lab", schoolId, { code: "CHEM-201", category: "Core STEM", creditHours: 3.5, passScore: 70, academicYear: currentAcademicYear });
      await academicService.createSubject("African & World History", schoolId, { code: "HIST-101", category: "Social Sciences", creditHours: 3.0, passScore: 65, academicYear: currentAcademicYear });
      showSuccess("Default Curriculum & Classrooms seeded successfully!");
    } catch (err: any) {
      showError("Seeding failed: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-indigo-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
        <p className="font-bold text-slate-500 text-sm">Syncing Academic Management Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <Toast message={successMessage} type="success" onDismiss={() => setSuccessMessage(null)} />
      <Toast message={errorMessage} type="error" onDismiss={() => setErrorMessage(null)} />

      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl text-white shadow-2xl border border-white/10">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold border border-indigo-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Academic Operations
              </span>
              <span className="text-xs text-slate-400 font-medium">School ID: {schoolId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Academic Control Hub
            </h1>
            <p className="text-sm text-slate-300/80 max-w-2xl leading-relaxed">
              Manage classroom rosters, curriculum subjects, teacher load allocations, and official report card layouts for your institution.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
              <div className="text-xl font-black text-white">{classes.length}</div>
              <div className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Classes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
              <div className="text-xl font-black text-white">{subjects.length}</div>
              <div className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Subjects</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
              <div className="text-xl font-black text-white">{assignments.length}</div>
              <div className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Assignments</div>
            </div>

            {classes.length === 0 && (
              <button onClick={handleSeedDefaults} disabled={seeding}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-lg transition flex items-center gap-2 border border-amber-300/30">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Seed Default Curriculum
              </button>
            )}
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-black">
              <CalendarDays className="w-4 h-4 text-indigo-600" />
              Academic Years
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Set the active year for {school?.name || 'this school'}. New classes, subjects, assignments, and grades will use it.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newAcademicYear}
              onChange={(e) => setNewAcademicYear(e.target.value)}
              placeholder="e.g. 2026/2027"
              className="w-full sm:w-48 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddAcademicYear}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Year
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {academicYears.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No academic years saved yet.</span>
          ) : academicYears.map((year) => {
            const active = year === currentAcademicYear;
            return (
              <button
                key={year}
                type="button"
                onClick={() => handleActivateAcademicYear(year)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {active ? <Check className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
                {year}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-bold text-slate-500">
          Active academic year: <span className="text-slate-900">{currentAcademicYear || 'Not set'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex gap-1.5 overflow-x-auto p-1">
          {[
            { id: 'classes', label: 'Classrooms', icon: Users, count: classes.length },
            { id: 'subjects', label: 'Curriculum Subjects', icon: BookOpen, count: subjects.length },
            { id: 'assignments', label: 'Teacher Load', icon: Briefcase, count: assignments.length },
            { id: 'template', label: 'Report Designer', icon: Palette, count: null },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {unassignedStudents.length > 0 && activeSubTab === 'classes' && (
          <div className="px-4 py-2 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 flex items-center gap-2 mr-2">
            <Info className="w-4 h-4 text-amber-600" />
            <span>{unassignedStudents.length} students waiting for classroom enrollment</span>
          </div>
        )}
      </div>

      {activeSubTab === 'classes' && (
        <ClassroomsManager
          schoolId={schoolId}
          academicYear={currentAcademicYear}
          classes={classes}
          activeStudents={activeStudents}
          unassignedStudents={unassignedStudents}
          activeTeachers={activeTeachers}
          assignments={assignments}
          actionLoading={actionLoading}
          setActionLoading={setActionLoading}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {activeSubTab === 'subjects' && (
        <SubjectsManager
          schoolId={schoolId}
          academicYear={currentAcademicYear}
          subjects={subjects}
          assignments={assignments}
          actionLoading={actionLoading}
          setActionLoading={setActionLoading}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {activeSubTab === 'assignments' && (
        <AssignmentsManager
          schoolId={schoolId}
          academicYear={currentAcademicYear}
          classes={classes}
          subjects={subjects}
          activeTeachers={activeTeachers}
          assignments={assignments}
          actionLoading={actionLoading}
          setActionLoading={setActionLoading}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {activeSubTab === 'template' && (
        <ReportTemplateEditor schoolId={schoolId} />
      )}
    </div>
  );
};

export default AcademicsManager;
