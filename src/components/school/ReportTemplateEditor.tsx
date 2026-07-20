// src/components/school/ReportTemplateEditor.tsx
import React, { useState, useEffect } from 'react';
import { schoolService, type SchoolData, type ReportConfig, type GradingTier, type CustomField } from '../../services/schoolService';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import StudentReportCard from '../grade/StudentReportCard';
import { Check, Loader2, Palette, Type, Shield, FileText, Plus, X, ListOrdered, Trash2, Layout, Layers } from 'lucide-react';

import { db } from '../../lib/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { storageService } from '../../services/storageService';

interface ReportTemplateEditorProps {
  schoolId: string; // This is the schoolId slug
}

export const ReportTemplateEditor: React.FC<ReportTemplateEditorProps> = ({ schoolId }) => {
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [config, setConfig] = useState<ReportConfig>({
    officialName: '',
    primaryColor: '#bf212f',
    secondaryColor: '#00205b',
    principalTitle: 'Principal of School',
    teacherTitle: 'Class Teacher / Registrar',
    customFooter: 'The Love of Liberty Brought Us Here',
    showSeal: true,
    showMinistryHeader: true,
    showStudentRank: true,
    showStudentID: true,
    showSummaryBadge: true,
    showSignatures: true,
    showGradingScale: true,
    gradingScale: [
      { label: 'A+', min: 95, max: 100 },
      { label: 'A', min: 90, max: 94 },
      { label: 'B+', min: 85, max: 89 },
      { label: 'B', min: 80, max: 84 },
      { label: 'C+', min: 75, max: 79 },
      { label: 'C', min: 70, max: 74 },
      { label: 'D', min: 60, max: 69 },
      { label: 'F', min: 0, max: 59 }
    ],
    templateType: 'official',
    customFields: [
      { label: 'Conduct', value: 'Excellent' },
      { label: 'Academic Year', value: '2025/2026' }
    ],
    layoutOrder: ['header', 'bio', 'grades', 'custom', 'stats', 'scale', 'signatures', 'footer']
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  const [students, setStudents] = useState<any[]>([]);
  const [previewStudent, setPreviewStudent] = useState<any | null>(null);
  const [classesMap, setClassesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch school students
    const unsubscribeUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
      const activeStudents = userList.filter((u: any) => u.role === 'student' && u.status === 'active');
      setStudents(activeStudents);
      if (activeStudents.length > 0 && !previewStudent) {
        // Pick a random student initially
        const randomIdx = Math.floor(Math.random() * activeStudents.length);
        setPreviewStudent(activeStudents[randomIdx]);
      }
    });

    const unsubscribeClasses = academicService.subscribeToSchoolClasses(schoolId, (classList) => {
      const cmap: Record<string, string> = {};
      classList.forEach(c => {
        cmap[c.id] = c.name;
      });
      setClassesMap(cmap);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeClasses();
    };
  }, [schoolId, previewStudent]);

  const selectRandomStudent = () => {
    if (students.length > 0) {
      const randomIdx = Math.floor(Math.random() * students.length);
      setPreviewStudent(students[randomIdx]);
    }
  };

  useEffect(() => {
    // Targeted query for ONLY this school's data
    const schoolsRef = collection(db, 'schools');
    const schoolQuery = query(schoolsRef, where('schoolId', '==', schoolId));
    
    const unsubscribe = onSnapshot(schoolQuery, (snapshot) => {
      if (!snapshot.empty) {
        const schoolDoc = snapshot.docs[0];
        const schoolData = { id: schoolDoc.id, ...schoolDoc.data() } as SchoolData;
        setSchool(schoolData);
        
        if (schoolData.reportConfig) {
          setConfig(prev => ({
            ...prev,
            ...schoolData.reportConfig
          }));
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to school in ReportTemplateEditor:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  const handleAddTier = () => {
    const newTier: GradingTier = { label: 'New', min: 0, max: 0 };
    setConfig({
      ...config,
      gradingScale: [...(config.gradingScale || []), newTier]
    });
  };

  const handleRemoveTier = (index: number) => {
    const newScale = [...(config.gradingScale || [])];
    newScale.splice(index, 1);
    setConfig({ ...config, gradingScale: newScale });
  };

  const handleUpdateTier = (index: number, field: keyof GradingTier, value: string | number) => {
    const newScale = [...(config.gradingScale || [])];
    newScale[index] = { ...newScale[index], [field]: value };
    setConfig({ ...config, gradingScale: newScale });
  };

  const applyPreset = (type: 'standard' | 'high') => {
    if (!window.confirm("This will overwrite your current grading scale. Continue?")) return;

    if (type === 'standard') {
      setConfig({
        ...config,
        gradingScale: [
          { label: 'A+', min: 90, max: 100 },
          { label: 'A', min: 80, max: 89 },
          { label: 'B', min: 70, max: 79 },
          { label: 'C', min: 60, max: 69 },
          { label: 'D', min: 50, max: 59 },
          { label: 'F', min: 0, max: 49 }
        ]
      });
    } else {
      setConfig({
        ...config,
        gradingScale: [
          { label: 'A+', min: 95, max: 100 },
          { label: 'A', min: 90, max: 94 },
          { label: 'B+', min: 85, max: 89 },
          { label: 'B', min: 80, max: 84 },
          { label: 'C+', min: 75, max: 79 },
          { label: 'C', min: 70, max: 74 },
          { label: 'D', min: 60, max: 69 },
          { label: 'F', min: 0, max: 59 }
        ]
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'logoUrl' | 'registrarSignatureUrl' | 'principalSignatureUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        alert("File is too large. Please upload an image smaller than 200KB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setConfig(prev => ({
            ...prev,
            [key]: reader.result
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (key: 'logoUrl' | 'registrarSignatureUrl' | 'principalSignatureUrl') => {
    setConfig(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setSaving(true);
    setSuccess(false);
    try {
      const updatedConfig = { ...config };
      
      // Upload Logo to Storage if it's base64
      if (config.logoUrl && config.logoUrl.startsWith('data:')) {
        const extMatch = config.logoUrl.match(/data:image\/(.*?);/);
        const ext = extMatch ? extMatch[1] : 'png';
        updatedConfig.logoUrl = await storageService.uploadBase64Image(
          `schools/${schoolId}/logo_${Date.now()}.${ext}`,
          config.logoUrl
        );
      }
      
      // Upload Registrar Signature to Storage if it's base64
      if (config.registrarSignatureUrl && config.registrarSignatureUrl.startsWith('data:')) {
        const extMatch = config.registrarSignatureUrl.match(/data:image\/(.*?);/);
        const ext = extMatch ? extMatch[1] : 'png';
        updatedConfig.registrarSignatureUrl = await storageService.uploadBase64Image(
          `schools/${schoolId}/registrar_signature_${Date.now()}.${ext}`,
          config.registrarSignatureUrl
        );
      }
      
      // Upload Principal Signature to Storage if it's base64
      if (config.principalSignatureUrl && config.principalSignatureUrl.startsWith('data:')) {
        const extMatch = config.principalSignatureUrl.match(/data:image\/(.*?);/);
        const ext = extMatch ? extMatch[1] : 'png';
        updatedConfig.principalSignatureUrl = await storageService.uploadBase64Image(
          `schools/${schoolId}/principal_signature_${Date.now()}.${ext}`,
          config.principalSignatureUrl
        );
      }
      
      await schoolService.updateReportConfig(school.id, updatedConfig);
      setConfig(updatedConfig);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save report card template config:", err);
      alert("Failed to save template configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomField = () => {
    const newField: CustomField = { label: 'New Field', value: 'Value' };
    setConfig({
      ...config,
      customFields: [...(config.customFields || []), newField]
    });
  };

  const handleRemoveCustomField = (index: number) => {
    const newFields = [...(config.customFields || [])];
    newFields.splice(index, 1);
    setConfig({ ...config, customFields: newFields });
  };

  const handleUpdateCustomField = (index: number, field: keyof CustomField, value: string) => {
    const newFields = [...(config.customFields || [])];
    newFields[index] = { ...newFields[index], [field]: value };
    setConfig({ ...config, customFields: newFields });
  };

  if (loading) return <div className="p-10 text-center text-slate-400 font-bold">Loading template settings...</div>;
  if (!school) return <div className="p-10 text-center text-red-500 font-bold">School not found.</div>;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Report Card Styler</h3>
              <p className="text-xs text-slate-400 font-medium">Customize your school's digital grade sheet branding.</p>
            </div>
          </div>
          
          {success && (
            <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 animate-bounce">
              <Check className="w-3 h-3" /> Changes Saved
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Identity & Text - Left Column */}
          <div className="lg:col-span-4 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Type className="w-4 h-4 text-slate-400" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Header</h4>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Official School Name</label>
                  <input 
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800"
                    value={config.officialName || ''}
                    onChange={e => setConfig({...config, officialName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Principal's Title</label>
                  <input 
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800"
                    value={config.principalTitle || ''}
                    onChange={e => setConfig({...config, principalTitle: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Teacher's Title</label>
                  <input 
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800"
                    value={config.teacherTitle || ''}
                    onChange={e => setConfig({...config, teacherTitle: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Footer Motto</label>
                  <textarea 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800 min-h-[80px]"
                    value={config.customFooter || ''}
                    onChange={e => setConfig({...config, customFooter: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Branding & Assets */}
            <div className="space-y-6 pt-6 border-t border-slate-100">
               <div className="flex items-center gap-2">
                 <Shield className="w-4 h-4 text-slate-400" />
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo & Signatures</h4>
               </div>

               <div className="space-y-4">
                 {/* Logo Upload */}
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Custom School Logo</label>
                   {config.logoUrl ? (
                     <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                       <img src={config.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg border bg-white" />
                       <span className="text-[10px] text-slate-500 font-bold flex-1 truncate">custom_logo.png</span>
                       <button
                         type="button"
                         onClick={() => handleRemoveImage('logoUrl')}
                         className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   ) : (
                     <div className="flex items-center justify-center border border-dashed border-slate-350 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition relative">
                       <input 
                         type="file" 
                         accept="image/*"
                         onChange={e => handleImageUpload(e, 'logoUrl')}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                       />
                       <span className="text-xs font-black text-blue-600 uppercase tracking-wide flex items-center gap-1.5">
                         <Plus className="w-3.5 h-3.5" /> Upload Logo
                       </span>
                     </div>
                   )}
                 </div>

                 {/* Registrar Signature */}
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Registrar Signature</label>
                   {config.registrarSignatureUrl ? (
                     <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                       <img src={config.registrarSignatureUrl} alt="Registrar Signature" className="w-16 h-8 object-contain rounded border bg-white" />
                       <span className="text-[10px] text-slate-500 font-bold flex-1 truncate">registrar_sign.png</span>
                       <button
                         type="button"
                         onClick={() => handleRemoveImage('registrarSignatureUrl')}
                         className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   ) : (
                     <div className="flex items-center justify-center border border-dashed border-slate-350 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition relative">
                       <input 
                         type="file" 
                         accept="image/*"
                         onChange={e => handleImageUpload(e, 'registrarSignatureUrl')}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                       />
                       <span className="text-xs font-black text-blue-600 uppercase tracking-wide flex items-center gap-1.5">
                         <Plus className="w-3.5 h-3.5" /> Upload Signature
                       </span>
                     </div>
                   )}
                 </div>

                 {/* Principal Signature */}
                 <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Principal Signature</label>
                   {config.principalSignatureUrl ? (
                     <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                       <img src={config.principalSignatureUrl} alt="Principal Signature" className="w-16 h-8 object-contain rounded border bg-white" />
                       <span className="text-[10px] text-slate-500 font-bold flex-1 truncate">principal_sign.png</span>
                       <button
                         type="button"
                         onClick={() => handleRemoveImage('principalSignatureUrl')}
                         className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   ) : (
                     <div className="flex items-center justify-center border border-dashed border-slate-350 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition relative">
                       <input 
                         type="file" 
                         accept="image/*"
                         onChange={e => handleImageUpload(e, 'principalSignatureUrl')}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                       />
                       <span className="text-xs font-black text-blue-600 uppercase tracking-wide flex items-center gap-1.5">
                         <Plus className="w-3.5 h-3.5" /> Upload Signature
                       </span>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          </div>

          {/* Visual Theme & Scale - Middle Column */}
          <div className="lg:col-span-4 space-y-10">
            {/* Style Gallery */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Layout className="w-4 h-4 text-slate-400" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout Style</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-3 animate-fade-in">
                {[
                  { id: 'official', label: 'Official', desc: 'Formal Heritage' },
                  { id: 'modern', label: 'Modern', desc: 'Sleek & Clean' },
                  { id: 'minimal', label: 'Minimal', desc: 'No-frills Data' },
                  { id: 'vibrant', label: 'Vibrant', desc: 'Bold Colors' },
                  { id: 'playful', label: 'Playful', desc: 'Classic Ivory' },
                  { id: 'simple_grid', label: 'Simple Grid', desc: 'Modern Period Grid' },
                  { id: 'academic_beige', label: 'Academic Beige', desc: 'Semester Comments' },
                  { id: 'ph_deped', label: 'DepEd PH', desc: 'Categorized Subjects' },
                  { id: 'us_academy', label: 'US Academy', desc: 'Attendance & Quarters' }
                ].map(style => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setConfig({...config, templateType: style.id as any})}
                    className={`flex flex-col items-start gap-1 p-4 rounded-2xl border-2 transition-all ${
                      config.templateType === style.id 
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md ring-4 ring-blue-500/10' 
                        : 'border-slate-100 hover:border-slate-300 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-tight">{style.label}</span>
                    <span className="text-[8px] font-bold opacity-60">{style.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-6 pt-6 border-t border-slate-100">
               <div className="flex items-center gap-2">
                 <Palette className="w-4 h-4 text-slate-400" />
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Theme Palette</h4>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Primary</label>
                    <input type="color" className="w-full h-10 rounded-xl cursor-pointer" value={config.primaryColor || '#bf212f'} onChange={e => setConfig({...config, primaryColor: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Secondary</label>
                    <input type="color" className="w-full h-10 rounded-xl cursor-pointer" value={config.secondaryColor || '#00205b'} onChange={e => setConfig({...config, secondaryColor: e.target.value})} />
                  </div>
               </div>
            </div>

            {/* Custom Extra Fields */}
            <div className="space-y-6 pt-6 border-t border-slate-100">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custom Sections</h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[9px] font-black uppercase"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
               </div>
               
               <div className="space-y-3">
                 {(config.customFields || []).map((f, i) => (
                   <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 relative group">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveCustomField(i)}
                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <input 
                        className="w-full bg-transparent border-none text-[10px] font-black uppercase text-slate-400 focus:ring-0 p-0"
                        value={f.label}
                        onChange={e => handleUpdateCustomField(i, 'label', e.target.value)}
                        placeholder="e.g. Conduct"
                      />
                      <input 
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                        value={f.value}
                        onChange={e => handleUpdateCustomField(i, 'value', e.target.value)}
                        placeholder="e.g. Excellent"
                      />
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Controls & Preview - Right Column */}
          <div className="lg:col-span-4 space-y-8">
             <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visibility Toggles</h4>
                </div>
                
                <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {[
                    { id: 'showMinistryHeader', label: 'Ministry Info' },
                    { id: 'showSeal', label: 'Official Seal' },
                    { id: 'showStudentRank', label: 'Academic Rank' },
                    { id: 'showStudentID', label: 'National ID' },
                    { id: 'showSummaryBadge', label: 'Stats Badge' },
                    { id: 'showSignatures', label: 'Signatures' },
                    { id: 'showGradingScale', label: 'Grading Key' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-black text-slate-700 uppercase tracking-tight">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => setConfig({...config, [item.id]: !((config as unknown as Record<string, boolean>)[item.id])})}
                        className={`w-8 h-4 rounded-full transition-colors relative ${((config as unknown as Record<string, boolean>)[item.id]) ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${((config as unknown as Record<string, boolean>)[item.id]) ? 'left-4' : 'left-0.5'}`}></div>
                      </button>
                    </div>
                  ))}
                </div>
             </div>

             {/* Scale Settings */}
             <div className="pt-6 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Academic Grading Scale</h4>
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => applyPreset('standard')} className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase">Standard</button>
                <button type="button" onClick={() => applyPreset('high')} className="flex-1 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-black uppercase">Elite</button>
                <button type="button" onClick={handleAddTier} className="px-3 bg-blue-600 text-white rounded-lg"><Plus className="w-4 h-4"/></button>
              </div>

              <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 max-h-[160px] overflow-y-auto custom-scrollbar">
                {(config.gradingScale || []).map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm group">
                    <input 
                      type="text"
                      className="w-10 p-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-black uppercase text-center focus:ring-0 outline-none"
                      value={tier.label}
                      onChange={e => handleUpdateTier(idx, 'label', e.target.value)}
                    />
                    <div className="flex-1 flex items-center gap-1">
                      <input 
                        type="number"
                        className="w-10 p-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-center focus:ring-0 outline-none"
                        value={tier.min}
                        onChange={e => handleUpdateTier(idx, 'min', parseInt(e.target.value) || 0)}
                      />
                      <span className="text-[8px] text-slate-300">-</span>
                      <input 
                        type="number"
                        className="w-10 p-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-center focus:ring-0 outline-none"
                        value={tier.max}
                        onChange={e => handleUpdateTier(idx, 'max', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <button type="button" onClick={() => handleRemoveTier(idx)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Button */}
            <div className="pt-6 border-t border-slate-100">
               <button 
                 type="button" 
                 onClick={() => setIsPreviewExpanded(true)}
                 className="w-full flex items-center justify-center gap-2 py-4 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-600 rounded-2xl text-xs font-black uppercase tracking-wider transition"
               >
                 <FileText className="w-4 h-4" /> Live Designer Preview
               </button>
            </div>
          </div>

          <div className="lg:col-span-12 pt-8 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply School Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Live Preview Modal */}
      {isPreviewExpanded && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-scale-in">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-slate-800 text-sm uppercase tracking-wider block">Live Template Designer Preview</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Form Settings State</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsPreviewExpanded(false)}
                className="p-3 hover:bg-red-50 hover:text-red-600 rounded-2xl text-slate-400 transition-all border border-transparent hover:border-red-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body - Interactive Workspace */}
            <div className="p-3 sm:p-8 space-y-6 max-h-[70vh] sm:max-h-[78vh] overflow-y-auto custom-scrollbar bg-slate-100/50">
              {previewStudent ? (
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-md">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                        Previewing Student: {previewStudent.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-bold mt-1">
                        Student ID: {previewStudent.studentId || previewStudent.id} | Class: {previewStudent.classId ? classesMap[previewStudent.classId] || 'General' : 'General'}
                      </p>
                    </div>
                    {students.length > 1 && (
                      <button
                        type="button"
                        onClick={selectRandomStudent}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-black uppercase tracking-wider transition active:scale-95"
                      >
                        Pick Another Student
                      </button>
                    )}
                  </div>
                  
                  <StudentReportCard 
                    studentId={previewStudent.id} 
                    schoolId={schoolId} 
                    studentName={previewStudent.name}
                    classroomName={previewStudent.classId ? classesMap[previewStudent.classId] || 'General' : 'General'}
                    customConfig={config}
                  />
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-md text-slate-400 font-bold">
                  No active students enrolled in this school to preview. Please register students first.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportTemplateEditor;
