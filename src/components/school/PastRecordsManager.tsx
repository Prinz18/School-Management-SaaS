import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  CalendarDays,
  Download,
  FileText,
  FileUp,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  Users
} from 'lucide-react';
import { schoolService, type PastRecordData } from '../../services/schoolService';
import { storageService } from '../../services/storageService';
import { academicService, type ClassData } from '../../services/academicService';
import { userService, type UserData } from '../../services/userService';

interface PastRecordsManagerProps {
  schoolId: string;
  schoolName?: string | null;
}

const MAX_PDF_SIZE = 5 * 1024 * 1024;

const PastRecordsManager: React.FC<PastRecordsManagerProps> = ({ schoolId, schoolName }) => {
  const [records, setRecords] = useState<PastRecordData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [note, setNote] = useState('');
  const [pdfLink, setPdfLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('All');

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);

    const unsubRecords = schoolService.subscribeToPastRecords(schoolId, (nextRecords) => {
      setRecords(nextRecords);
      setLoading(false);
    });

    const unsubClasses = academicService.subscribeToSchoolClasses(schoolId, (nextClasses) => {
      setClasses(nextClasses);
    });

    const unsubStudents = userService.subscribeToSchoolUsers(schoolId, (nextUsers) => {
      setStudents(nextUsers.filter((user) => user.role === 'student'));
    });

    return () => {
      unsubRecords();
      unsubClasses();
      unsubStudents();
    };
  }, [schoolId]);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const academicYears = useMemo(() => {
    const years = new Set<string>();
    records.forEach((record) => {
      if (record.academicYear) years.add(record.academicYear);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesYear = yearFilter === 'All' || (record.academicYear || 'Unspecified') === yearFilter;
      const matchesQuery =
        !q ||
        record.title.toLowerCase().includes(q) ||
        (record.note || '').toLowerCase().includes(q) ||
        (record.academicYear || '').toLowerCase().includes(q) ||
        (record.className || '').toLowerCase().includes(q) ||
        (record.studentName || '').toLowerCase().includes(q) ||
        (record.studentId || '').toLowerCase().includes(q) ||
        (record.fileName || '').toLowerCase().includes(q);
      return matchesYear && matchesQuery;
    });
  }, [records, query, yearFilter]);

  const groupedRecords = useMemo(() => {
    const grouped: Record<
      string,
      Record<
        string,
        Record<
          string,
          PastRecordData[]
        >
      >
    > = {};

    const sorted = [...filteredRecords].sort((a, b) => {
      const yearCompare = (b.academicYear || 'Unspecified').localeCompare(a.academicYear || 'Unspecified');
      if (yearCompare !== 0) return yearCompare;
      const classCompare = (a.className || 'Unassigned').localeCompare(b.className || 'Unassigned');
      if (classCompare !== 0) return classCompare;
      const studentCompare = (a.studentName || 'Unassigned').localeCompare(b.studentName || 'Unassigned');
      if (studentCompare !== 0) return studentCompare;
      return b.uploadedAt - a.uploadedAt;
    });

    for (const record of sorted) {
      const yearKey = record.academicYear || 'Unspecified';
      const classKey = record.className || record.classId || 'Unassigned class';
      const studentKey = record.studentName || record.studentId || 'Unassigned student';

      grouped[yearKey] ||= {};
      grouped[yearKey][classKey] ||= {};
      grouped[yearKey][classKey][studentKey] ||= [];
      grouped[yearKey][classKey][studentKey].push(record);
    }

    return grouped;
  }, [filteredRecords]);

  const totalSizeText = useMemo(() => {
    const totalBytes = records.reduce((sum, record) => sum + (record.size || 0), 0);
    if (!totalBytes) return '0 KB';
    if (totalBytes < 1024 * 1024) return `${Math.max(1, Math.round(totalBytes / 1024))} KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [records]);

  const clearForm = () => {
    setTitle('');
    setAcademicYear('');
    setTerm('');
    setNote('');
    setPdfLink('');
    setSelectedFile(null);
    setStudentSearch('');
    setClassSearch('');
    setSelectedStudentId('');
    setSelectedClassId('');
  };

  const syncSelectedStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = studentById.get(studentId);
    setStudentSearch(student ? formatStudentLabel(student) : '');
    if (student?.classId) {
      setSelectedClassId(student.classId);
      const classInfo = classById.get(student.classId);
      setClassSearch(classInfo ? formatClassLabel(classInfo) : '');
    }
  };

  const syncSelectedClass = (classId: string) => {
    setSelectedClassId(classId);
    const classInfo = classById.get(classId);
    setClassSearch(classInfo ? formatClassLabel(classInfo) : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedTitle = title.trim();
    const trimmedLink = pdfLink.trim();

    if (!trimmedTitle) {
      setError('Add a title for this record.');
      return;
    }

    if (!selectedFile && !trimmedLink) {
      setError('Upload a PDF from the device or paste a PDF link.');
      return;
    }

    setSaving(true);
    try {
      let fileUrl = trimmedLink;
      let filePath = '';
      let fileName = trimmedLink ? 'external-record.pdf' : selectedFile?.name || 'past-record.pdf';
      let mimeType = selectedFile?.type || 'application/pdf';
      let size = selectedFile?.size;

      if (selectedFile) {
        if (!selectedFile.type.includes('pdf') && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
          throw new Error('Please choose a PDF file.');
        }

        if (selectedFile.size > MAX_PDF_SIZE) {
          throw new Error('Please keep the PDF under 5 MB for reliable saving on this plan.');
        }

        filePath = `schools/${schoolId}/past-records/${Date.now()}-${selectedFile.name.replace(/[^a-z0-9_.-]+/gi, '_')}`;
        fileUrl = await storageService.uploadFile(filePath, selectedFile);
        fileName = selectedFile.name;
        mimeType = selectedFile.type || 'application/pdf';
        size = selectedFile.size;
      }

      if (!fileUrl) {
        throw new Error('No PDF link was saved.');
      }

      const chosenStudent = selectedStudentId ? studentById.get(selectedStudentId) : null;
      const chosenClass = selectedClassId ? classById.get(selectedClassId) : null;
      const chosenStudentClass = chosenStudent?.classId ? classById.get(chosenStudent.classId) : null;

      await schoolService.addPastRecord(schoolId, {
        title: trimmedTitle,
        academicYear: academicYear.trim(),
        term: term.trim(),
        classId: chosenClass?.id || selectedClassId || chosenStudent?.classId || '',
        className: chosenClass?.name || classSearch.trim() || chosenStudentClass?.name || '',
        studentId: chosenStudent?.studentId || selectedStudentId || '',
        studentName: chosenStudent?.name || studentSearch.trim() || '',
        note: note.trim(),
        fileName,
        fileUrl,
        filePath,
        mimeType,
        size,
        uploadedBy: ''
      });

      clearForm();
      setSuccess('Past record PDF saved for this school.');
    } catch (err: any) {
      setError(err.message || 'Failed to save the past record PDF.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: PastRecordData) => {
    if (!window.confirm(`Delete "${record.title}" from the archive?`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await schoolService.deletePastRecord(schoolId, record.id);
      setSuccess(`"${record.title}" was removed.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete the archived PDF.');
    } finally {
      setSaving(false);
    }
  };

  const openFile = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const totalRecords = records.length;
  const totalStudents = new Set(records.map((record) => record.studentId).filter(Boolean)).size;
  const totalClasses = new Set(records.map((record) => record.className || record.classId).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-100">
              <Archive className="h-3.5 w-3.5 text-amber-300" />
              Past Records Archive
            </div>
            <h2 className="mt-3 text-2xl font-black">Organized by year, class, and student</h2>
            <p className="mt-2 text-sm text-slate-300">
              Keep older results, report sheets, and PDFs in one structured archive so admins can find any student record quickly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Records" value={totalRecords} />
            <StatCard label="Students" value={totalStudents} />
            <StatCard label="Classes" value={totalClasses} />
            <StatCard label="Archive size" value={totalSizeText} compact={false} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <PlusCircle className="h-4 w-4 text-indigo-600" />
              Add record
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {schoolName || schoolId}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="e.g. 2023 Results Archive"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">Academic year</label>
              <input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                placeholder="e.g. 2023/2024"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">Student</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={studentSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStudentSearch(value);
                    const match = students.find((student) => formatStudentLabel(student).toLowerCase() === value.trim().toLowerCase());
                    if (match) {
                      syncSelectedStudent(match.id);
                    } else {
                      setSelectedStudentId('');
                    }
                  }}
                  list="student-options"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="Search student"
                />
              </div>
              <datalist id="student-options">
                {students.map((student) => (
                  <option key={student.id} value={formatStudentLabel(student)} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-slate-400">Use the search box when there are many students.</p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">Class</label>
              <div className="relative">
                <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={classSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClassSearch(value);
                    const match = classes.find((classItem) => formatClassLabel(classItem).toLowerCase() === value.trim().toLowerCase());
                    if (match) {
                      syncSelectedClass(match.id);
                    } else {
                      setSelectedClassId('');
                    }
                  }}
                  list="class-options"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  placeholder="Search class"
                />
              </div>
              <datalist id="class-options">
                {classes.map((classItem) => (
                  <option key={classItem.id} value={formatClassLabel(classItem)} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-slate-400">Search by class name instead of scrolling a long list.</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-700">Term / session</label>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="e.g. First Term"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-700">Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
              placeholder="Optional description for this PDF"
            />
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <FileUp className="h-4 w-4 text-indigo-600" />
              PDF source
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">Upload from device</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white hover:file:bg-indigo-700"
              />
              <p className="mt-1 text-[11px] text-slate-400">PDF files up to 5 MB.</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-700">Paste PDF link</label>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                <Download className="h-4 w-4 text-slate-400" />
                <input
                  value={pdfLink}
                  onChange={(e) => setPdfLink(e.target.value)}
                  className="w-full border-0 bg-transparent px-0 py-3 text-sm font-semibold text-slate-800 outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Save PDF
          </button>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Archive browser</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">Search and browse records</h3>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400"
                  placeholder="Search records"
                />
              </div>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400"
                >
                  <option value="All">All years</option>
                  {academicYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                  <option value="Unspecified">Unspecified</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip label="All records" active={yearFilter === 'All'} onClick={() => setYearFilter('All')} />
            {academicYears.slice(0, 6).map((year) => (
              <FilterChip key={year} label={year} active={yearFilter === year} onClick={() => setYearFilter(year)} />
            ))}
          </div>

          <div className="mt-5 space-y-6">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
                <Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />
                Loading archive...
              </div>
            ) : Object.keys(groupedRecords).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-slate-500">
                No past record PDFs match the current filters.
              </div>
            ) : (
              Object.entries(groupedRecords).map(([year, classGroups]) => (
                <div key={year} className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-base font-black text-slate-900">{year}</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {Object.values(classGroups).reduce((count, studentGroups) => count + Object.values(studentGroups).reduce((sum, items) => sum + items.length, 0), 0)} records
                    </span>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(classGroups).map(([className, studentGroups]) => (
                      <div key={`${year}-${className}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-slate-400" />
                          <h5 className="text-sm font-black text-slate-900">{className}</h5>
                        </div>

                        <div className="mt-3 space-y-3">
                          {Object.entries(studentGroups).map(([studentName, items]) => (
                            <div key={`${year}-${className}-${studentName}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Users className="h-4 w-4 text-indigo-600" />
                                    <h6 className="text-sm font-black text-slate-900">{studentName}</h6>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                      {items.length} file{items.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                    {items[0].studentId || 'No student ID'} {items[0].term ? `• ${items[0].term}` : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 space-y-3">
                                {items.map((record) => (
                                  <div key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h4 className="text-base font-black text-slate-900">{record.title}</h4>
                                          {record.term && <Tag label={record.term} />}
                                          {record.academicYear && <Tag label={record.academicYear} />}
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">{record.note || 'No note provided.'}</p>
                                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-semibold text-slate-500 sm:grid-cols-2">
                                          <Meta label="File" value={record.fileName} />
                                          <Meta label="Uploaded" value={new Date(record.uploadedAt).toLocaleString()} />
                                          <Meta label="Class" value={record.className || 'Unassigned'} />
                                          <Meta label="Student" value={record.studentName || 'Unassigned'} />
                                        </div>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openFile(record.fileUrl)}
                                          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm hover:bg-slate-50"
                                        >
                                          <Download className="h-4 w-4" />
                                          Open
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDelete(record)}
                                          disabled={saving}
                                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; compact?: boolean }> = ({ label, value, compact = true }) => (
  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100/80">{label}</p>
    <p className={`mt-1 font-black text-white ${compact ? 'text-2xl' : 'text-lg'}`}>{value}</p>
  </div>
);

const FilterChip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition ${
      active
        ? 'border-indigo-600 bg-indigo-600 text-white'
        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
    }`}
  >
    {label}
  </button>
);

const Tag: React.FC<{ label: string }> = ({ label }) => (
  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
    {label}
  </span>
);

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl bg-white p-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-1 break-words text-slate-700">{value}</p>
  </div>
);

const formatStudentLabel = (student: UserData) => {
  const studentId = student.studentId ? ` • ${student.studentId}` : '';
  return `${student.name}${studentId}`;
};

const formatClassLabel = (classItem: ClassData) => {
  const code = classItem.code ? ` • ${classItem.code}` : '';
  return `${classItem.name}${code}`;
};

export default PastRecordsManager;
