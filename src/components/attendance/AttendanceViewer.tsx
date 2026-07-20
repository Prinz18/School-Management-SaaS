// src/components/attendance/AttendanceViewer.tsx
import React from 'react';
import { attendanceService } from '../../services/attendanceService';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  status: 'present' | 'absent' | 'late';
  date: string;
}

interface AttendanceViewerProps {
  studentId: string;
  schoolId: string;
}

const AttendanceViewer: React.FC<AttendanceViewerProps> = ({ studentId, schoolId }) => {
  const [records, setRecords] = React.useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = attendanceService.subscribeToStudentAttendance(studentId, schoolId, (recordList) => {
      setRecords(recordList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentId, schoolId]);
  
  const getStatusInfo = (status: AttendanceRecord['status']) => {
    switch(status) {
      case 'present': return { icon: <CheckCircle className="text-green-500" />, text: "Present", style: "bg-green-50 text-green-700" };
      case 'absent': return { icon: <XCircle className="text-red-500" />, text: "Absent", style: "bg-red-50 text-red-700" };
      case 'late': return { icon: <Clock className="text-amber-500" />, text: "Late", style: "bg-amber-50 text-amber-700" };
      default: return { icon: null, text: "N/A", style: "" };
    }
  };

  if (loading) return <div className="text-center py-10">Loading attendance history...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="p-6 border-b border-slate-50">
        <h3 className="text-lg font-bold text-slate-800">My Attendance Log</h3>
      </div>

      <div className="divide-y divide-slate-50">
        {records.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            No attendance records found.
          </div>
        ) : (
          records.map(record => {
            const { icon, text, style } = getStatusInfo(record.status);
            return (
              <div key={record.id} className="p-6 flex items-center justify-between gap-4">
                <p className="font-bold text-slate-700">
                  {new Date(record.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full font-bold text-sm ${style}`}>
                  {icon}
                  {text}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AttendanceViewer;