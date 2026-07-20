// src/components/grade/AddGradeForm.tsx
import React from 'react';
import { gradeService } from '../../services/gradeService';
import { userService } from '../../services/userService';
import { academicService, type AssignmentData } from '../../services/academicService';
import { FilePlus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  studentId?: string;
  classId: string | null;
}

interface AddGradeFormProps {
  schoolId: string;
  teacherId: string;
  onGradeAdded: () => void;
}

const AddGradeForm: React.FC<AddGradeFormProps> = ({ schoolId, teacherId, onGradeAdded }) => {
  const [assignments, setAssignments] = React.useState<AssignmentData[]>([]);
  const [students, setStudents] = React.useState<Student[]>([]);
  
  const [selectedClass, setSelectedClass] = React.useState('');
  const [selectedStudent, setSelectedStudent] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [score, setScore] = React.useState('');
  const [maxScore, setMaxScore] = React.useState('100');
  const [term, setTerm] = React.useState('1st Period');
  
  const [loading, setLoading] = React.useState(false);
  const [fetchingData, setFetchingData] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    const unsubAssignments = academicService.subscribeToTeacherAssignments(teacherId, schoolId, (assignmentList) => {
      setAssignments(assignmentList);
    });

    const unsubUsers = userService.subscribeToSchoolUsers(schoolId, (users) => {
      const studentList = users
        .filter((u) => u.role === 'student' && u.status === 'active')
        .map((u) => ({
          id: u.id,
          name: u.name,
          studentId: u.studentId || undefined,
          classId: u.classId || null
        }));
      setStudents(studentList);
      setFetchingData(false);
    });

    return () => {
      unsubAssignments();
      unsubUsers();
    };
  }, [teacherId, schoolId]);

  // Reset selected student and subject when class selection changes
  React.useEffect(() => {
    setSelectedStudent('');
    setSubject('');
  }, [selectedClass]);

  // Derived helper list of unique classrooms assigned to teacher
  const uniqueClasses = React.useMemo(() => {
    const classMap: Record<string, string> = {};
    assignments.forEach(a => {
      classMap[a.classId] = a.className;
    });
    return Object.entries(classMap).map(([id, name]) => ({ id, name }));
  }, [assignments]);

  // Subjects taught in the selected classroom
  const subjectsForSelectedClass = React.useMemo(() => {
    if (!selectedClass) return [];
    return assignments
      .filter(a => a.classId === selectedClass)
      .map(a => a.subjectName);
  }, [selectedClass, assignments]);

  // Students enrolled in selected classroom
  const studentsInSelectedClass = React.useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => s.classId === selectedClass);
  }, [selectedClass, students]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!selectedClass) throw new Error("Please select a classroom.");
      if (!selectedStudent) throw new Error("Please select a student.");
      if (!subject) throw new Error("Please select a subject.");

      await gradeService.uploadGrade(
        selectedStudent,
        teacherId,
        schoolId,
        subject,
        Number(score),
        Number(maxScore),
        term
      );
      
      setScore('');
      setSuccess(true);
      onGradeAdded();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
        <p className="text-slate-500 text-xs font-bold">Syncing gradebook options...</p>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center py-8">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider"> Roster Unassigned</h3>
        <p className="text-xs text-slate-400 font-medium mt-2 leading-relaxed">
          You cannot upload grades because you are not currently assigned to teach any subjects. Please contact your system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-indigo-600 uppercase tracking-wide">
        <FilePlus className="w-4 h-4" />
        Upload New Grade
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Class Selection */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Classroom</label>
          <select
            required
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Choose Class --</option>
            {uniqueClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Subject Selection */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
          <select
            required
            disabled={!selectedClass}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700 disabled:opacity-50"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">-- Choose Subject --</option>
            {subjectsForSelectedClass.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        {/* Student Selection */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Student</label>
          <select
            required
            disabled={!selectedClass}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700 disabled:opacity-50"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">-- Choose Student --</option>
            {studentsInSelectedClass.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.studentId ? `(${s.studentId})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Term and Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Term / Semester</label>
            <select
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            >
              <option value="1st Period">1st Period</option>
              <option value="2nd Period">2nd Period</option>
              <option value="3rd Period">3rd Period</option>
              <option value="1st Semester Exam">1st Semester Exam</option>
              <option value="4th Period">4th Period</option>
              <option value="5th Period">5th Period</option>
              <option value="6th Period">6th Period</option>
              <option value="2nd Semester Exam">2nd Semester Exam</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Obtained</label>
              <input
                type="number"
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-750 placeholder-slate-400"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Max Score</label>
              <input
                type="number"
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-750 placeholder-slate-400"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-650 font-bold bg-red-50 p-2.5 rounded-xl border border-red-100">{error}</p>}
        {success && (
          <p className="text-xs text-green-650 font-bold bg-green-50 p-2.5 rounded-xl border border-green-100 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" /> Grade recorded successfully!
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !selectedClass || !selectedStudent || !subject}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Score'}
        </button>
      </form>
    </div>
  );
};

export default AddGradeForm;