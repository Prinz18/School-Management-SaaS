// src/components/grade/AIGradingAssistant.tsx
import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../lib/dbAdapter';
import { storageService } from '../../services/storageService';
import { userService, type UserData } from '../../services/userService';
import { academicService, type AssignmentData } from '../../services/academicService';
import { 
  Brain, 
  Sparkles, 
  Upload, 
  FileCheck, 
  Loader2, 
  Award, 
  AlertCircle,
  Clock
} from 'lucide-react';

interface AIGradingAssistantProps {
  schoolId: string;
  teacherId: string;
}

export const AIGradingAssistant: React.FC<AIGradingAssistantProps> = ({ schoolId, teacherId }) => {
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [students, setStudents] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [selectedAssignmentName, setSelectedAssignmentName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImageFilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Result State
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (teacherId && schoolId) {
      setLoading(true);
      const unsubAssignments = academicService.subscribeToTeacherAssignments(teacherId, schoolId, (list) => {
        setAssignments(list);
      });

      const unsubUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
        setStudents(userList.filter(u => u.role === 'student' && u.status === 'active'));
        setLoading(false);
      });

      return () => {
        unsubAssignments();
        unsubUsers();
      };
    }
  }, [teacherId, schoolId]);

  // Handle image select
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Get active subjects & assignments for the selected class
  const classAssignments = assignments.filter(a => a.classId === selectedClassId);
  const classStudents = students.filter(s => s.classId === selectedClassId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !selectedSubjectName || !selectedStudentId) {
      setErrorMsg("Please select Class, Subject, and Student.");
      return;
    }
    if (!studentAnswer.trim() && !imageFile) {
      setErrorMsg("Please provide student's written response or upload a handwritten image scan.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setAiFeedback(null);
    setAiStatus('queued');

    try {
      const selStudent = students.find(s => s.id === selectedStudentId);
      const studentName = selStudent ? selStudent.name : "Unknown Student";
      const studentIdCode = selStudent ? (selStudent.studentId || '') : "";

      let attachmentUrl = "";
      if (imageFile) {
        const storagePath = `schools/${schoolId}/users/${selectedStudentId}/grading_${Date.now()}_${imageFile.name}`;
        attachmentUrl = await storageService.uploadFile(storagePath, imageFile);
      }

      const taskId = await dbAdapter.pushDoc(`schools/${schoolId}/ai_grading`, {
        className: assignments.find(a => a.classId === selectedClassId)?.className || "Classroom",
        subjectName: selectedSubjectName,
        assignmentName: selectedAssignmentName || "Term Assignment",
        studentId: selectedStudentId,
        studentName,
        studentIdCode,
        studentAnswer: studentAnswer.trim(),
        attachmentUrl: attachmentUrl || null,
        status: {
          state: 'PROCESSING',
          updateTime: new Date().toISOString()
        },
        createdAt: new Date().toISOString()
      });

      setCurrentTaskId(taskId);

      const unsub = dbAdapter.subscribeToPath(`schools/${schoolId}/ai_grading/${taskId}`, (list) => {
        const data = list && list.length > 0 ? list[0] : null;
        if (data) {
          if (data.feedback) {
            setAiFeedback(data.feedback);
            setAiStatus('completed');
            setSubmitting(false);
            unsub();
          } else if (data.status && data.status.state === 'ERROR') {
            setErrorMsg(data.status.error || "The AI Assistant encountered an error during inference.");
            setAiStatus('failed');
            setSubmitting(false);
            unsub();
          } else if (data.status && data.status.state === 'PROCESSING') {
            setAiStatus('processing');
          }
        }
      });

    } catch (err: any) {
      console.error("AI submission failed:", err);
      setErrorMsg(err.message || "Failed to submit task.");
      setAiStatus('failed');
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStudentAnswer('');
    setImageFile(null);
    setImageFilePreview(null);
    setAiFeedback(null);
    setAiStatus('idle');
    setCurrentTaskId(null);
    setErrorMsg(null);
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-center justify-center py-24 text-indigo-600">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-extrabold text-slate-500 uppercase tracking-widest text-xs">Syncing grading registries...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm relative">
            <Brain className="w-6 h-6 animate-pulse" />
            <Sparkles className="w-3.5 h-3.5 text-amber-500 absolute -top-1.5 -right-1.5 animate-bounce" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">AI Grading & Feedback Copilot</h3>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mt-0.5">Powered by Multimodal Gemini API Extension</p>
          </div>
        </div>
        {aiStatus !== 'idle' && (
          <button 
            onClick={handleReset}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-wider rounded-xl transition"
          >
            Grade New Paper
          </button>
        )}
      </div>

      {aiStatus === 'idle' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Panel: selections */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Classroom</label>
                <select
                  required
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedSubjectName('');
                    setSelectedAssignmentName('');
                    setSelectedStudentId('');
                  }}
                >
                  <option value="">-- Select Class --</option>
                  {assignments.reduce((acc, curr) => {
                    if (!acc.some(a => a.classId === curr.classId)) {
                      acc.push(curr);
                    }
                    return acc;
                  }, [] as AssignmentData[]).map(a => (
                    <option key={a.classId} value={a.classId}>{a.className}</option>
                  ))}
                </select>
              </div>

              {selectedClassId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Subject</label>
                    <select
                      required
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      value={selectedSubjectName}
                      onChange={(e) => {
                        setSelectedSubjectName(e.target.value);
                        setSelectedAssignmentName('');
                      }}
                    >
                      <option value="">-- Subject --</option>
                      {Array.from(new Set(classAssignments.map(a => a.subjectName))).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Student</label>
                    <select
                      required
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                    >
                      <option value="">-- Student --</option>
                      {classStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.studentId || 'No ID'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedSubjectName && (
                <div className="animate-in fade-in duration-200">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Assignment / Task Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Midterm Algebra Essay, Quiz 3 Homework"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition placeholder-slate-400"
                    value={selectedAssignmentName}
                    onChange={(e) => setSelectedAssignmentName(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Right Panel: Upload and inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Handwritten Homework Scan (Multimodal)</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-2xl p-6 transition flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden h-[180px]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  />
                  {imagePreview ? (
                    <div className="absolute inset-0 bg-white flex items-center justify-center p-2">
                      <img src={imagePreview} alt="Homework Scan Preview" className="max-h-full max-w-full rounded-lg object-contain" />
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageFile(null);
                          setImageFilePreview(null);
                        }} 
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full text-xs font-bold shadow"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400 mb-2 animate-pulse" />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Upload Student Script File</span>
                      <span className="text-[10px] text-slate-400 font-semibold mt-1">Accepts PNG, JPEG, PDF Scans</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Student's Typed Submission or Notes</label>
            <textarea
              rows={4}
              placeholder="Type or paste the student's submission text here. Alternatively, leave blank if you have uploaded a handwritten homework scan above."
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-xs text-slate-700 transition leading-relaxed placeholder-slate-400"
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
            />
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3.5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Brain className="w-5 h-5" />
                Submit to Gemini Grading Engine
              </>
            )}
          </button>
        </form>
      ) : (
        /* Results / Live Feedback Stream Panel */
        <div className="space-y-6 animate-fade-in">
          {/* Status Indicator */}
          <div className="p-5 rounded-2xl border flex items-center justify-between gap-4 bg-gradient-to-r from-slate-55 to-slate-50/50">
            <div className="flex items-center gap-3">
              {aiStatus === 'queued' && (
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
              )}
              {aiStatus === 'processing' && (
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
              {aiStatus === 'completed' && (
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <FileCheck className="w-5 h-5" />
                </div>
              )}
              {aiStatus === 'failed' && (
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}

              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                  {aiStatus === 'queued' && 'Queued in Firestore Trigger...'}
                  {aiStatus === 'processing' && 'Gemini Extension running Multimodal Task...'}
                  {aiStatus === 'completed' && 'Analysis & Evaluation Synthesized'}
                  {aiStatus === 'failed' && 'Grading Task Interrupted'}
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">
                  ID: {currentTaskId || "Loading..."}
                </p>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              aiStatus === 'queued' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
              aiStatus === 'processing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
              aiStatus === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {aiStatus}
            </span>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* AI Output Result Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Original Submission Details */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Submission Blueprint</h4>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">STUDENT PROFILE</span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {students.find(s => s.id === selectedStudentId)?.name || "Target Student"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">CLASS & SUBJECT</span>
                    <span className="text-xs font-extrabold text-slate-800">
                      {assignments.find(a => a.classId === selectedClassId)?.className || ""} • {selectedSubjectName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">TASK DESCRIPTION</span>
                    <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">{selectedAssignmentName}</span>
                  </div>
                </div>
              </div>

              {/* Scan Upload display */}
              {imagePreview && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Multimodal Upload</h4>
                  <img src={imagePreview} alt="Attached Scan" className="w-full h-auto rounded-lg border border-slate-100 shadow-sm" />
                </div>
              )}
            </div>

            {/* Right Column: AI Output */}
            <div className="lg:col-span-2">
              {aiStatus === 'completed' && aiFeedback ? (
                <div className="bg-gradient-to-br from-indigo-50/20 to-teal-50/10 border border-slate-150 p-6 rounded-3xl space-y-6 shadow-inner min-h-[300px]">
                  <div className="flex items-center gap-2 border-b border-indigo-100 pb-3">
                    <Award className="w-5 h-5 text-indigo-600 shrink-0" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Gemini Evaluation Report</h4>
                  </div>
                  
                  {/* Styled Markdown content */}
                  <div className="text-slate-700 text-xs font-medium leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
                    {aiFeedback}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 p-12 rounded-[2rem] text-center flex flex-col items-center justify-center text-slate-300 min-h-[300px] bg-slate-50/50">
                  <Brain className="w-12 h-12 text-slate-300 animate-pulse mb-3" />
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    {aiStatus === 'queued' && 'Waiting for Firestore collection trigger to dispatch query...'}
                    {aiStatus === 'processing' && 'Inference running. Reading student file & calculating score weights...'}
                    {aiStatus === 'failed' && 'Error resolving. Please verify your Google AI API key is configured correctly.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
