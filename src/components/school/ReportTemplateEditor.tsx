// src/components/school/ReportTemplateEditor.tsx
import React, { useState, useEffect } from 'react';
import { schoolService, type SchoolData, type ReportConfig, type GradingTier } from '../../services/schoolService';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import StudentReportCard from '../grade/StudentReportCard';
import { Camera, Check, Cloud, FileSignature, ImageUp, Link, ListOrdered, Loader2, Palette, Plus, Trash2, Layout, Layers, Type, Upload, X } from 'lucide-react';
import { dbAdapter } from '../../lib/dbAdapter';
import { extractBrandAssetWithGroq, type BrandAssetCropBox } from '../../services/aiService';

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
    templateType: 'official',
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
    customFields: [
      { label: 'Conduct', value: 'Excellent' },
      { label: 'Academic Year', value: '2025/2026' }
    ]
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'design' | 'branding' | 'structure' | 'grading' | 'custom'>('design');
  const [students, setStudents] = useState<any[]>([]);
  const [previewStudent, setPreviewStudent] = useState<any>(null);
  const [previewClass, setPreviewClass] = useState<string>('General');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<'logo' | 'registrarSignature' | 'principalSignature' | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    const unsubscribeUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
      const activeStudents = userList.filter(u => u.role === 'student' && u.status === 'active');
      setStudents(activeStudents);
      if (activeStudents.length > 0 && !previewStudent) {
        setPreviewStudent(activeStudents[0]);
      }
    });

    const unsubscribeClasses = academicService.subscribeToSchoolClasses(schoolId, (classList) => {
      if (classList.length > 0) {
        setPreviewClass(classList[0].name);
      }
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
    const fetchSchoolData = async () => {
      try {
        const res = await dbAdapter.getDoc(`schools/${schoolId}`);
        if (res.exists) {
          const schoolData = { id: schoolId, ...res.data } as SchoolData;
          setSchool(schoolData);
          if (schoolData.reportConfig) {
            setConfig(prev => ({ ...prev, ...schoolData.reportConfig }));
          }
        }
      } catch (err) {
        console.error("Error fetching school in ReportTemplateEditor:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolData();
  }, [schoolId]);

  const handleAddTier = () => {
    setConfig(prev => ({
      ...prev,
      gradingScale: [...(prev.gradingScale || []), { label: 'New', min: 0, max: 0 }]
    }));
  };

  const handleRemoveTier = (index: number) => {
    setConfig(prev => ({
      ...prev,
      gradingScale: (prev.gradingScale || []).filter((_, idx) => idx !== index)
    }));
  };

  const handleTierChange = (index: number, field: keyof GradingTier, val: any) => {
    setConfig(prev => {
      const scale = [...(prev.gradingScale || [])];
      scale[index] = { ...scale[index], [field]: field === 'label' ? val : Number(val) };
      return { ...prev, gradingScale: scale };
    });
  };

  const handleAssetUpload = async (
    asset: 'logo' | 'registrarSignature' | 'principalSignature',
    file?: File
  ) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 300 * 1024) {
      alert('Please select an image smaller than 300 KB.');
      return;
    }

    const configKey = asset === 'logo'
      ? 'logoUrl'
      : asset === 'registrarSignature'
        ? 'registrarSignatureUrl'
        : 'principalSignatureUrl';

    setUploadingAsset(asset);
    const previousConfig = config;
    try {
      const dataUrl = await fileToDataUrl(file);
      const extracted = await tryExtractBrandAsset(
        dataUrl,
        asset === 'logo'
          ? 'logo'
          : asset === 'registrarSignature'
            ? 'registrar signature'
            : 'principal signature'
      );
      const nextConfig = { ...config, [configKey]: extracted };
      setConfig(nextConfig);
      await schoolService.updateReportConfig(schoolId, nextConfig);
      setCleanupStatus('Image optimized and saved.');
    } catch (err) {
      setConfig(previousConfig);
      alert(`Failed to upload ${asset === 'logo' ? 'the school logo' : 'the signature'}: ${(err as Error).message}`);
    } finally {
      setUploadingAsset(null);
    }
  };

  const removeAsset = async (asset: 'logo' | 'registrarSignature' | 'principalSignature') => {
    const configKey = asset === 'logo'
      ? 'logoUrl'
      : asset === 'registrarSignature'
        ? 'registrarSignatureUrl'
        : 'principalSignatureUrl';
    const nextConfig = { ...config, [configKey]: undefined };
    const previousConfig = config;
    setConfig(nextConfig);
    try {
      await schoolService.updateReportConfig(schoolId, nextConfig);
      setCleanupStatus('Image removed from the school record.');
    } catch (err) {
      setConfig(previousConfig);
      alert(`Failed to remove ${asset === 'logo' ? 'the school logo' : 'the signature'}: ${(err as Error).message}`);
    }
  };

  const clearAllAssets = async () => {
    const nextConfig = {
      ...config,
      logoUrl: undefined,
      registrarSignatureUrl: undefined,
      principalSignatureUrl: undefined
    };
    const previousConfig = config;
    setConfig(nextConfig);
    try {
      await schoolService.updateReportConfig(schoolId, nextConfig);
      setCleanupStatus('All branding images were removed from the school record.');
    } catch (err) {
      setConfig(previousConfig);
      alert(`Failed to remove the branding images: ${(err as Error).message}`);
    }
  };

  const handleUrlUpload = async (asset: 'logo' | 'registrarSignature' | 'principalSignature', rawUrl: string) => {
    try {
      const url = new URL(rawUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an http or https image link.');
      const response = await fetch(toGoogleDriveDownloadUrl(url.toString()));
      if (!response.ok) throw new Error('The image could not be downloaded. Check that the link is public.');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('The link does not point to an image.');
      await handleAssetUpload(asset, new File([blob], `external-${asset}.${imageExtension(blob.type)}`, { type: blob.type }));
    } catch (err) {
      alert(`Could not use this image link: ${(err as Error).message}`);
    }
  };

  const handleGoogleDriveUpload = async (asset: 'logo' | 'registrarSignature' | 'principalSignature') => {
    try {
      const file = await pickGoogleDriveImage();
      if (file) await handleAssetUpload(asset, file);
    } catch (err) {
      alert(`Could not open Google Drive: ${(err as Error).message}`);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await schoolService.updateReportConfig(schoolId, config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to save template configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 font-medium">
        <Loader2 className="animate-spin w-6 h-6 mr-2" /> Loading Template Designer...
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" /> Official Report Card Designer
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Customize official academic transcripts, seals, signatures, and grading criteria for {school?.name || 'School'}.
          </p>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" /> Saved!
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Editor Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex border-b border-slate-200 bg-slate-50/50 p-2 gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('design')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'design' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layout className="w-3.5 h-3.5" /> Presets
              </button>
              <button
                onClick={() => setActiveTab('branding')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'branding' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Type className="w-3.5 h-3.5" /> Colors & Names
              </button>
              <button
                onClick={() => setActiveTab('structure')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'structure' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Structure
              </button>
              <button
                onClick={() => setActiveTab('grading')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeTab === 'grading' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" /> Scale
              </button>
            </div>

            <div className="p-6 space-y-6">
              {activeTab === 'design' && (
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Report Card Layout Template
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'official', name: 'Liberian Official', desc: 'Standard Ministry Layout' },
                      { id: 'modern', name: 'Modern Minimal', desc: 'Sleek Corporate Cards' },
                      { id: 'academic_beige', name: 'Academic Beige', desc: 'Traditional Parchment' },
                      { id: 'us_academy', name: 'US Academy', desc: 'Semester High School Style' }
                    ].map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => setConfig(prev => ({ ...prev, templateType: tmpl.id as any }))}
                        className={`p-4 rounded-xl border text-left transition ${
                          config.templateType === tmpl.id
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <div className="font-bold text-sm">{tmpl.name}</div>
                        <div className="text-[11px] text-slate-500 mt-1">{tmpl.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'branding' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Official Header Name</label>
                    <input
                      type="text"
                      value={config.officialName || ''}
                      onChange={e => setConfig(prev => ({ ...prev, officialName: e.target.value }))}
                      placeholder={school?.name}
                      className="w-full px-3 py-2 border rounded-xl text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Primary Color</label>
                      <input
                        type="color"
                        value={config.primaryColor || '#bf212f'}
                        onChange={e => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-full h-10 rounded-xl cursor-pointer p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Secondary Color</label>
                      <input
                        type="color"
                        value={config.secondaryColor || '#00205b'}
                        onChange={e => setConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-full h-10 rounded-xl cursor-pointer p-1"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-5 space-y-4">
                    {cleanupStatus && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
                        {cleanupStatus}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Report Card Assets</p>
                        <p className="text-xs text-slate-500 mt-1">Upload a school logo and the signatures that should appear on official report cards.</p>
                      </div>
                      {(config.logoUrl || config.registrarSignatureUrl || config.principalSignatureUrl) && (
                        <button
                          type="button"
                          onClick={clearAllAssets}
                          className="rounded-xl border border-red-200 bg-white px-3 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-50 hover:border-red-300"
                        >
                          Remove all images
                        </button>
                      )}
                    </div>

                    <AssetUploader
                      label="School logo"
                      description="Used in the report card header"
                      value={config.logoUrl}
                      uploading={uploadingAsset === 'logo'}
                      icon={<ImageUp className="w-4 h-4" />}
                      onUpload={file => handleAssetUpload('logo', file)}
                      onUrlUpload={url => handleUrlUpload('logo', url)}
                      onGoogleDrive={() => handleGoogleDriveUpload('logo')}
                      onRemove={() => removeAsset('logo')}
                    />
                    <AssetUploader
                      label="Registrar signature"
                      description="Appears above the registrar title"
                      value={config.registrarSignatureUrl}
                      uploading={uploadingAsset === 'registrarSignature'}
                      icon={<FileSignature className="w-4 h-4" />}
                      onUpload={file => handleAssetUpload('registrarSignature', file)}
                      onUrlUpload={url => handleUrlUpload('registrarSignature', url)}
                      onGoogleDrive={() => handleGoogleDriveUpload('registrarSignature')}
                      onRemove={() => removeAsset('registrarSignature')}
                    />
                    <AssetUploader
                      label="Principal signature"
                      description="Appears above the principal title"
                      value={config.principalSignatureUrl}
                      uploading={uploadingAsset === 'principalSignature'}
                      icon={<FileSignature className="w-4 h-4" />}
                      onUpload={file => handleAssetUpload('principalSignature', file)}
                      onUrlUpload={url => handleUrlUpload('principalSignature', url)}
                      onGoogleDrive={() => handleGoogleDriveUpload('principalSignature')}
                      onRemove={() => removeAsset('principalSignature')}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'structure' && (
                <div className="space-y-3 text-sm">
                  {[
                    { key: 'showSeal', label: 'Show Official Ministry Seal' },
                    { key: 'showMinistryHeader', label: 'Show Ministry Header Line' },
                    { key: 'showStudentRank', label: 'Show Class Position / Rank' },
                    { key: 'showGradingScale', label: 'Show Grading Key Legend' },
                    { key: 'showSignatures', label: 'Show Principal Signatures' }
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!(config as any)[item.key]}
                        onChange={e => setConfig(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-slate-700 font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {activeTab === 'grading' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">Grading Scale Tiers</span>
                    <button onClick={handleAddTier} className="text-indigo-600 hover:text-indigo-700 font-bold text-xs flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Tier
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(config.gradingScale || []).map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tier.label}
                          onChange={e => handleTierChange(idx, 'label', e.target.value)}
                          className="w-16 px-2 py-1 border rounded text-xs text-center font-bold"
                        />
                        <input
                          type="number"
                          value={tier.min}
                          onChange={e => handleTierChange(idx, 'min', e.target.value)}
                          className="w-16 px-2 py-1 border rounded text-xs text-center"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                          type="number"
                          value={tier.max}
                          onChange={e => handleTierChange(idx, 'max', e.target.value)}
                          className="w-16 px-2 py-1 border rounded text-xs text-center"
                        />
                        <button onClick={() => handleRemoveTier(idx)} className="text-slate-400 hover:text-red-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-7 lg:sticky lg:top-6 lg:self-start">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setPreviewExpanded(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setPreviewExpanded(true);
              }
            }}
            className="group block w-full cursor-pointer text-left overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl ring-1 ring-slate-200/60 transition hover:shadow-[0_24px_70px_rgba(15,23,42,0.16)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100/80 bg-white/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Live Preview</span>
                <p className="mt-1 text-sm font-semibold text-slate-600">Click to enlarge the report-card canvas</p>
              </div>
            <div className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-700 transition group-hover:bg-indigo-100">
              Click to Enlarge
            </div>
          </div>
          <div className="overflow-x-auto touch-pan-x bg-slate-50/50 p-3 sm:p-4 [scrollbar-width:thin]">
              {previewStudent ? (
                <div className="pointer-events-none flex origin-top justify-center scale-[0.66] sm:scale-[0.72] lg:scale-[0.58] xl:scale-[0.64] min-w-[640px] sm:min-w-0">
                  <StudentReportCard
                    studentId={previewStudent.id}
                    schoolId={schoolId}
                    studentName={previewStudent.name}
                    schoolName={config.officialName || school?.name || 'School Portal'}
                    classroomName={previewClass}
                    customConfig={config}
                    previewMode
                  />
                </div>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-slate-700">No student available</p>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Add a student to this school to preview the gradesheet with real data.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {previewExpanded && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 lg:p-6 overflow-y-auto" onClick={() => setPreviewExpanded(false)}>
          <div
            className="mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Live Preview</span>
                <p className="mt-1 text-sm font-semibold text-slate-600">Expanded view</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={selectRandomStudent}
                  disabled={students.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-700 transition hover:bg-indigo-100"
                >
                  Shuffle Student
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewExpanded(false)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[calc(100dvh-8rem)] overflow-auto bg-slate-50/50 p-4 sm:p-6">
              {previewStudent ? (
                <div className="flex justify-center">
                  <StudentReportCard
                    studentId={previewStudent.id}
                    schoolId={schoolId}
                    studentName={previewStudent.name}
                    schoolName={config.officialName || school?.name || 'School Portal'}
                    classroomName={previewClass}
                    customConfig={config}
                    previewMode
                  />
                </div>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-slate-700">No student available</p>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Add a student to this school to preview the gradesheet with real data.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AssetUploaderProps {
  label: string;
  description: string;
  value?: string;
  uploading: boolean;
  icon: React.ReactNode;
  onUpload: (file?: File) => void;
  onUrlUpload: (url: string) => void;
  onGoogleDrive: () => void;
  onRemove: () => void;
}

const AssetUploader: React.FC<AssetUploaderProps> = ({
  label,
  description,
  value,
  uploading,
  icon,
  onUpload,
  onUrlUpload,
  onGoogleDrive,
  onRemove
}) => {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState('');

  const submitUrl = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    onUrlUpload(trimmedUrl);
    setUrl('');
    setShowUrlInput(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-400">
          {value ? <img src={value} alt={`${label} preview`} className="h-full w-full object-contain p-1.5" /> : icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            {value && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Ready</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
          <p className="mt-2 text-[11px] text-slate-400">Images are saved in the school record.</p>
        </div>
        {value && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Delete ${label} from the school record`}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50">
          <Upload className="h-3.5 w-3.5" />
          Device
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            className="sr-only"
            onChange={event => {
              onUpload(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50">
          <Camera className="h-3.5 w-3.5" />
          Camera
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            capture="environment"
            disabled={uploading}
            className="sr-only"
            onChange={event => {
              onUpload(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <button
          type="button"
          disabled={uploading}
          onClick={onGoogleDrive}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
        >
          <Cloud className="h-3.5 w-3.5" />
          Drive
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => setShowUrlInput(current => !current)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
        >
          <Link className="h-3.5 w-3.5" />
          Link
        </button>
      </div>

        {showUrlInput && (
        <form onSubmit={event => { event.preventDefault(); submitUrl(); }} className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder="Paste a public image or Drive link"
            type="url"
            required
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
          />
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">
            Use
          </button>
        </form>
      )}
    </div>
  );
};

const imageExtension = (type: string) => type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';

const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      resolve(reader.result);
      return;
    }
    reject(new Error('Could not read the image file.'));
  };
  reader.onerror = () => reject(new Error('Could not read the image file.'));
  reader.readAsDataURL(file);
});

const tryExtractBrandAsset = async (
  sourceDataUrl: string,
  assetLabel: 'logo' | 'registrar signature' | 'principal signature'
) => {
  try {
    const result = await extractBrandAssetWithGroq(sourceDataUrl, assetLabel);
    if (!result.found || !result.crop || result.confidence < 0.45) {
      return await autoTrimDataUrl(sourceDataUrl);
    }
    return await removeBackground(await cropDataUrl(sourceDataUrl, result.crop));
  } catch (err) {
    console.warn('Groq extraction failed, using local auto-trim.', err);
    return await autoTrimDataUrl(sourceDataUrl);
  }
};

const cropDataUrl = (sourceDataUrl: string, crop: BrandAssetCropBox): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      const x = clamp(Math.floor(crop.x * sourceWidth), 0, sourceWidth - 1);
      const y = clamp(Math.floor(crop.y * sourceHeight), 0, sourceHeight - 1);
      const width = clamp(Math.ceil(crop.width * sourceWidth), 1, sourceWidth - x);
      const height = clamp(Math.ceil(crop.height * sourceHeight), 1, sourceHeight - y);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not crop the image.'));
        return;
      }
      context.drawImage(image, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Could not load the image for cropping.'));
    image.src = sourceDataUrl;
  });
};

const autoTrimDataUrl = (sourceDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not analyze the image.'));
        return;
      }

      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, width, height);
      const backgroundLum = estimateBackgroundLuminance(data, width, height);

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          const lum = luminance(r, g, b);
          const inkStrength = backgroundLum - lum;
          const hasInk = a > 8 && inkStrength > 18;

          if (hasInk) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX < 0 || maxY < 0) {
        resolve(sourceDataUrl);
        return;
      }

      const padX = Math.max(8, Math.round(width * 0.04));
      const padY = Math.max(8, Math.round(height * 0.04));
      const cropX = clamp(minX - padX, 0, width - 1);
      const cropY = clamp(minY - padY, 0, height - 1);
      const cropWidth = clamp(maxX - minX + 1 + padX * 2, 1, width - cropX);
      const cropHeight = clamp(maxY - minY + 1 + padY * 2, 1, height - cropY);

      const output = document.createElement('canvas');
      output.width = cropWidth;
      output.height = cropHeight;
      const outputContext = output.getContext('2d');
      if (!outputContext) {
        reject(new Error('Could not trim the image.'));
        return;
      }
      outputContext.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(remapPaperBackgroundToTransparency(output));
    };
    image.onerror = () => reject(new Error('Could not load the image for trimming.'));
    image.src = sourceDataUrl;
  });
};

const removeBackground = (sourceDataUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not prepare the image.'));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(remapPaperBackgroundToTransparency(canvas));
    };
    image.onerror = () => reject(new Error('Could not load the image for cleanup.'));
    image.src = sourceDataUrl;
  });
};

const remapPaperBackgroundToTransparency = (canvas: HTMLCanvasElement): string => {
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas.toDataURL('image/png');
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const backgroundLum = estimateBackgroundLuminance(pixels, canvas.width, canvas.height);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    const lum = luminance(r, g, b);
    const inkStrength = backgroundLum - lum;

    if (a === 0 || inkStrength < 10) {
      pixels[i + 3] = 0;
      continue;
    }

    const alpha = clamp(Math.round((inkStrength - 8) * 16), 0, 255);
    pixels[i + 3] = Math.max(0, Math.min(a, alpha));
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

const estimateBackgroundLuminance = (data: Uint8ClampedArray, width: number, height: number) => {
  const sampleSize = Math.max(1, Math.min(24, Math.floor(Math.min(width, height) / 12)));
  const samples: number[] = [];
  const sampleCorner = (startX: number, startY: number) => {
    for (let y = startY; y < Math.min(height, startY + sampleSize); y++) {
      for (let x = startX; x < Math.min(width, startX + sampleSize); x++) {
        const index = (y * width + x) * 4;
        samples.push(luminance(data[index], data[index + 1], data[index + 2]));
      }
    }
  };

  sampleCorner(0, 0);
  sampleCorner(Math.max(0, width - sampleSize), 0);
  sampleCorner(0, Math.max(0, height - sampleSize));
  sampleCorner(Math.max(0, width - sampleSize), Math.max(0, height - sampleSize));

  if (samples.length === 0) return 255;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length * 0.75)];
};

const luminance = (r: number, g: number, b: number) => (0.2126 * r) + (0.7152 * g) + (0.0722 * b);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toGoogleDriveDownloadUrl = (url: string) => {
  const match = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return match ? `https://drive.usercontent.google.com/download?id=${match[1]}&export=download&confirm=t` : url;
};

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
  if (existing) {
    if ((window as any)[src.includes('api.js') ? 'gapi' : 'google']) resolve();
    else existing.addEventListener('load', () => resolve(), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('Google Drive could not be loaded.'));
  document.head.appendChild(script);
});

const pickGoogleDriveImage = async (): Promise<File | null> => {
  const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;
  if (!clientId || !apiKey) {
    throw new Error('Google Drive is not configured. Paste a public Google Drive link with the Link option, or add VITE_GOOGLE_DRIVE_CLIENT_ID and VITE_GOOGLE_DRIVE_API_KEY.');
  }

  await Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client')
  ]);

  const google = (window as any).google;
  const gapi = (window as any).gapi;
  await new Promise<void>(resolve => gapi.load('picker', { callback: resolve }));

  return new Promise<File | null>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }
        const picker = new google.picker.PickerBuilder()
          .addView(new google.picker.DocsView().setMimeTypes('image/png,image/jpeg,image/webp'))
          .setOAuthToken(tokenResponse.access_token)
          .setDeveloperKey(apiKey)
          .setCallback(async (data: any) => {
            if (data.action === google.picker.Action.CANCEL) resolve(null);
            if (data.action !== google.picker.Action.PICKED) return;
            try {
              const selected = data.docs[0];
              const response = await fetch(`https://www.googleapis.com/drive/v3/files/${selected.id}?alt=media`, {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              });
              if (!response.ok) throw new Error('The selected Drive file could not be downloaded.');
              const blob = await response.blob();
              if (!blob.type.startsWith('image/')) throw new Error('Select an image file from Google Drive.');
              resolve(new File([blob], selected.name || `drive-image.${imageExtension(blob.type)}`, { type: blob.type }));
            } catch (error) {
              reject(error);
            }
          })
          .build();
        picker.setVisible(true);
      }
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

