// src/components/attendance/AttendanceTaker.tsx
import React from 'react';
import { attendanceService } from '../../services/attendanceService';
import { userService } from '../../services/userService';
import { academicService, type AssignmentData } from '../../services/academicService';
import { ClipboardCheck, Loader2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  classId: string | null;
}

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceTakerProps {
  schoolId: string;
  teacherId: string;
}

const AttendanceTaker: React.FC<AttendanceTakerProps> = ({ schoolId, teacherId }) => {
  const [assignments, setAssignments] = React.useState<AssignmentData[]>([]);
  const [allStudents, setAllStudents] = React.useState<Student[]>([]);
  
  const [selectedClass, setSelectedClass] = React.useState('');
  const [attendance, setAttendance] = React.useState<Record<string, AttendanceStatus>>({});
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = React.useState(false);
  const [fetchingData, setFetchingData] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Subscribe to assignments and users
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
          classId: u.classId || null
        }));
      setAllStudents(studentList);
      setFetchingData(false);
    });

    return () => {
      unsubAssignments();
      unsubUsers();
    };
  }, [teacherId, schoolId]);

  // Derived unique classes
  const uniqueClasses = React.useMemo(() => {
    const classMap: Record<string, string> = {};
    assignments.forEach(a => {
      classMap[a.classId] = a.className;
    });
    return Object.entries(classMap).map(([id, name]) => ({ id, name }));
  }, [assignments]);

  // Students in selected class
  const classStudents = React.useMemo(() => {
    if (!selectedClass) return [];
    return allStudents.filter(s => s.classId === selectedClass);
  }, [selectedClass, allStudents]);

  // Default attendance map to 'present' when class changes
  React.useEffect(() => {
    if (selectedClass && classStudents.length > 0) {
      const initialAttendance: Record<string, AttendanceStatus> = {};
      classStudents.forEach(student => {
        initialAttendance[student.id] = 'present';
      });
      setAttendance(initialAttendance);
    } else {
      setAttendance({});
    }
  }, [selectedClass, classStudents]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };
  
  const handleSubmit = async () => {
    if (!selectedClass) {
      setError("Please select a classroom first.");
      return;
    }
    if (classStudents.length === 0) {
      setError("This classroom has no students to mark attendance for.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      await attendanceService.submitAttendanceBatch(attendance, schoolId, teacherId, date);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-500 mb-2" />
        <p className="text-slate-500 text-xs font-bold">Syncing attendance rosters...</p>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center py-8">
        <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider"> Roster Unassigned</h3>
        <p className="text-xs text-slate-400 font-medium mt-2 leading-relaxed">
          You cannot mark attendance because you are not currently assigned to teach any classrooms. Please contact your system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <h3 className="text-sm font-black mb-4 flex items-center gap-2 text-cyan-600 uppercase tracking-wide">
        <ClipboardCheck className="w-4 h-4" />
        Mark Classroom Attendance
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Classroom</label>
          <select
            required
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-bold text-slate-700"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Choose Class --</option>
            {uniqueClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Date</label>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-xs font-bold text-slate-700"
          />
        </div>
      </div>

      {selectedClass ? (
        <div className="space-y-2 mt-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-3">Enrolled Students ({classStudents.length})</p>
          {classStudents.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold italic py-8 text-center bg-slate-50/50 rounded-xl">No students assigned to this classroom roster.</p>
          ) : (
            classStudents.map(student => (
              <div key={student.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/50 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition">
                <p className="font-extrabold text-xs text-slate-800">{student.name}</p>
                <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-inner">
                  <button 
                    onClick={() => handleStatusChange(student.id, 'present')} 
                    className={`px-3 py-1 text-[10px] font-black rounded-lg flex items-center gap-1 transition ${
                      attendance[student.id] === 'present' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-250 shadow-sm' 
                        : 'hover:bg-emerald-50 text-slate-400 border border-transparent'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" /> PRES
                  </button>
                  <button 
                    onClick={() => handleStatusChange(student.id, 'absent')} 
                    className={`px-3 py-1 text-[10px] font-black rounded-lg flex items-center gap-1 transition ${
                      attendance[student.id] === 'absent' 
                        ? 'bg-red-100 text-red-800 border border-red-250 shadow-sm' 
                        : 'hover:bg-red-50 text-slate-400 border border-transparent'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 shrink-0" /> ABS
                  </button>
                  <button 
                    onClick={() => handleStatusChange(student.id, 'late')} 
                    className={`px-3 py-1 text-[10px] font-black rounded-lg flex items-center gap-1 transition ${
                      attendance[student.id] === 'late' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-250 shadow-sm' 
                        : 'hover:bg-amber-50 text-slate-400 border border-transparent'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" /> LATE
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-100 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center py-16">
          <ClipboardCheck className="w-10 h-10 text-slate-300 mb-2" />
          <h4 className="font-black text-slate-700 text-xs uppercase tracking-wider">No Classroom Selected</h4>
          <p className="text-xs text-slate-400 font-medium mt-1">Please select an assigned classroom block above to take attendance.</p>
        </div>
      )}
      
      {error && <p className="mt-4 text-xs text-red-650 font-bold bg-red-50 p-2.5 rounded-xl border border-red-100">{error}</p>}
      {success && (
        <p className="mt-4 text-xs text-emerald-650 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> Attendance log submitted successfully!
        </p>
      )}

      {selectedClass && classStudents.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6 bg-cyan-600 hover:bg-cyan-700 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-100"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Attendance Register'}
        </button>
      )}
    </div>
  );
};

export default AttendanceTaker;