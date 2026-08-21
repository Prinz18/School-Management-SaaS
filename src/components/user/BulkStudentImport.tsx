import React, { useMemo, useState } from 'react';
import type { ClassData } from '../../services/academicService';
import { userService } from '../../services/userService';
import { Download, Loader2, Table2, TriangleAlert, Upload, Users } from 'lucide-react';

interface BulkStudentImportProps {
  schoolId: string;
  classes?: ClassData[];
}

type BulkRow = {
  fullName: string;
  email?: string;
  studentId?: string;
  classId?: string;
  className?: string;
  dob?: string;
  gender?: string;
  address?: string;
  guardianName?: string;
  guardianContact?: string;
  previousSchool?: string;
  notes?: string;
};

const REQUIRED_HEADERS = ['fullName'];

const BulkStudentImport: React.FC<BulkStudentImportProps> = ({ schoolId, classes = [] }) => {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ created: number; failed: number; skipped: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const classLookup = useMemo(() => {
    const byId = new Map<string, ClassData>();
    const byName = new Map<string, ClassData>();
    classes.forEach((c) => {
      byId.set(c.id, c);
      byName.set(c.name.toLowerCase(), c);
    });
    return { byId, byName };
  }, [classes]);

  const resolveClass = (classId?: string, className?: string) => {
    const id = classId?.trim();
    const name = className?.trim().toLowerCase();
    if (id && classLookup.byId.has(id)) return classLookup.byId.get(id) || null;
    if (name && classLookup.byName.has(name)) return classLookup.byName.get(name) || null;
    return null;
  };

  const downloadTemplate = () => {
    const template = [
      'fullName,email,studentId,className,dob,gender,address,guardianName,guardianContact,previousSchool,notes',
      'John Doe,john@example.com,2024-001,Grade 10-Alpha,2008-01-01,Male,"District 1, Monrovia",Jane Doe,0770000000,Primary School,Transferred from another school'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string): BulkRow[] => {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length === 0) return [];

    const headers = splitCsvLine(lines[0]).map((header) => header.trim());
    const headerIndex = new Map(headers.map((header, index) => [header.toLowerCase(), index]));

    for (const required of REQUIRED_HEADERS) {
      if (!headerIndex.has(required.toLowerCase())) {
        throw new Error(`Missing required column: ${required}`);
      }
    }

    return lines.slice(1).map((line) => {
      const cells = splitCsvLine(line);
      const get = (key: string) => {
        const index = headerIndex.get(key.toLowerCase());
        if (index === undefined) return '';
        return (cells[index] || '').trim();
      };

      return {
        fullName: get('fullName'),
        email: get('email'),
        studentId: get('studentId'),
        classId: get('classId'),
        className: get('className'),
        dob: get('dob'),
        gender: get('gender'),
        address: get('address'),
        guardianName: get('guardianName'),
        guardianContact: get('guardianContact'),
        previousSchool: get('previousSchool'),
        notes: get('notes')
      };
    });
  };

  const handleFile = async (file?: File | null) => {
    setSummary(null);
    setStatus(null);
    setParseErrors([]);
    setRows([]);
    setFileName('');

    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseErrors(['Please choose a CSV file.']);
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      setRows(parsed);
      setFileName(file.name);
      setStatus(`Loaded ${parsed.length} row${parsed.length === 1 ? '' : 's'} from ${file.name}.`);
    } catch (err: any) {
      setParseErrors([err.message || 'Could not read the CSV file.']);
    }
  };

  const importRows = async () => {
    if (rows.length === 0) return;

    setImporting(true);
    setSummary(null);
    setStatus(null);

    let created = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const name = row.fullName.trim();
      if (!name) {
        skipped++;
        continue;
      }

      try {
        const classInfo = resolveClass(row.classId, row.className);
        const email = row.email?.trim() || '';
        const studentId = row.studentId?.trim() || undefined;

        const { uid } = await userService.provisionUserAccount(name, email, 'student', schoolId, studentId);

        await userService.updateProfileDetails(uid, {
          dob: row.dob?.trim() || '',
          gender: row.gender?.trim() || '',
          address: row.address?.trim() || '',
          guardianName: row.guardianName?.trim() || '',
          guardianContact: row.guardianContact?.trim() || '',
          classId: classInfo?.id || row.classId?.trim() || null
        });

        created++;
      } catch (err: any) {
        failed++;
        errors.push(`Row ${index + 2}: ${row.fullName || 'Unnamed row'} — ${err.message || 'Import failed'}`);
      }
    }

    setSummary({ created, failed, skipped });
    setParseErrors(errors.slice(0, 10));
    setStatus(`Import finished: ${created} created, ${failed} failed, ${skipped} skipped.`);
    setImporting(false);
  };

  const previewRows = rows.slice(0, 5);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bulk student import</p>
          <h3 className="mt-1 text-lg font-black text-slate-900">Upload many students at once</h3>
          <p className="mt-1 text-sm text-slate-500">
            Use a CSV file to create student accounts in this school.
          </p>
        </div>
        <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
          <Users className="h-5 w-5" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100"
        >
          <Download className="h-4 w-4" />
          Download template
        </button>
        <span className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
          Required: fullName
        </span>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
        <label className="mb-2 block text-[11px] font-bold text-slate-700">Upload CSV file</label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white hover:file:bg-indigo-700"
        />
        <p className="mt-2 text-[11px] text-slate-400">
          Optional columns: email, studentId, className, dob, gender, address, guardianName, guardianContact, previousSchool, notes.
        </p>
      </div>

      {fileName && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Loaded file: {fileName}
        </div>
      )}

      {status && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
          {status}
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="mb-2 flex items-center gap-2 font-black">
            <TriangleAlert className="h-4 w-4" />
            Import warnings
          </div>
          <ul className="space-y-1 text-xs font-semibold">
            {parseErrors.map((err, index) => (
              <li key={`${err}-${index}`}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Created" value={summary.created} tone="emerald" />
          <SummaryCard label="Failed" value={summary.failed} tone="rose" />
          <SummaryCard label="Skipped" value={summary.skipped} tone="slate" />
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Table2 className="h-4 w-4 text-indigo-600" />
            Preview first rows
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {previewRows.map((row, index) => (
                  <tr key={`${row.fullName}-${index}`} className="align-top">
                    <td className="px-4 py-3 font-bold text-slate-800">{row.fullName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.studentId || 'Auto-generate'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.className || row.classId || 'Not set'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.email || 'No email'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={importRows}
        disabled={importing || rows.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Import students
      </button>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number; tone: 'emerald' | 'rose' | 'slate' }> = ({ label, value, tone }) => {
  const toneMap = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700'
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
};

const splitCsvLine = (line: string) => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
};

export default BulkStudentImport;
