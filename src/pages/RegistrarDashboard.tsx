// src/pages/RegistrarDashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Users, 
  Settings, 
  UploadCloud, 
  CheckCircle, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  Printer, 
  Search, 
  Building2, 
  Sparkles, 
  Camera,
  Loader2,
  FileText,
  BadgeAlert,
  ArrowRight,
  RefreshCw,
  Eye,
  FilePenLine,
  X,
  Save,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { DashboardLayout, type TabItem } from '../components/common/DashboardLayout';
import SupportHistory from '../components/common/SupportHistory';
import AccountSettings from '../components/user/AccountSettings';
import StudentRegistrationManager from '../components/school/StudentRegistrationManager';
import { academicService, type ClassData } from '../services/academicService';
import { userService, type UserData } from '../services/userService';
import { storageService } from '../services/storageService';

interface RegistrarDashboardProps {
  profile: any;
}

export const RegistrarDashboard: React.FC<RegistrarDashboardProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState('register');
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Registration form state
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [address, setAddress] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [passportPhoto, setPassportPhoto] = useState<string | null>(null);
  
  // Edit Profile form state
  const [editingStudent, setEditingStudent] = useState<UserData | null>(null);
  const [editName, setEditName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('Male');
  const [editAddress, setEditAddress] = useState('');
  const [editGuardianName, setEditGuardianName] = useState('');
  const [editGuardianContact, setEditGuardianContact] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editPassportPhoto, setEditPassportPhoto] = useState<string | null>(null);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // UI states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [deletingEditPhoto, setDeletingEditPhoto] = useState(false);
  const [provisionStep, setProvisionStep] = useState(0);
  const [provisionedCredentials, setProvisionedCredentials] = useState<{
    uid: string;
    email: string;
    studentId: string;
    tempPassword: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  
  // Search & Filter in Directory
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [viewingStudentDetail, setViewingStudentDetail] = useState<UserData | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const schoolId = profile.schoolId;

  // Realtime updates
  useEffect(() => {
    if (schoolId) {
      setLoading(true);
      
      const unsubClasses = academicService.subscribeToSchoolClasses(schoolId, (classList) => {
        setClasses(classList);
        if (classList.length > 0 && !selectedClassId) {
          setSelectedClassId(classList[0].id);
        }
      });

      const unsubUsers = userService.subscribeToSchoolUsers(schoolId, (userList) => {
        const studentList = userList.filter(u => u.role === 'student' && u.status === 'active');
        setStudents(studentList);
        setLoading(false);
      });

      return () => {
        unsubClasses();
        unsubUsers();
      };
    }
  }, [schoolId]);

  // Handle auto-generating Student ID sequentially based on school context
  const generateStudentId = async () => {
    if (!schoolId) return;
    try {
      const nextId = await userService.getNextStudentId(schoolId);
      setStudentId(nextId);
    } catch (err: any) {
      console.error("Error auto-generating sequential ID:", err);
      const rand = Math.floor(1000 + Math.random() * 9000);
      setStudentId(`${schoolId}-${rand}`);
    }
  };

  // Automatically pre-populate studentId on mount or when students list changes
  useEffect(() => {
    if (schoolId && (!studentId || studentId.startsWith('STU-') || studentId === '')) {
      userService.getNextStudentId(schoolId)
        .then(nextId => {
          setStudentId(nextId);
        })
        .catch(err => {
          console.error("Failed to pre-populate student ID:", err);
        });
    }
  }, [schoolId, students, studentId]);

  // Image compressor & converter to Base64 (Enroll Form)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Please select an image file.");
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      const compressedBase64 = await compressImageFile(file);
      setPassportPhoto(compressedBase64);
    } catch (err: any) {
      setError(err.message || "Failed to process photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Image compressor & converter to Base64 (Edit Form)
  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditError("Please select an image file.");
      return;
    }

    setUploadingEditPhoto(true);
    setEditError(null);

    try {
      const compressedBase64 = await compressImageFile(file);
      setEditPassportPhoto(compressedBase64);
    } catch (err: any) {
      setEditError(err.message || "Failed to process photo.");
    } finally {
      setUploadingEditPhoto(false);
    }
  };

  // Standard Image Compression Helper
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  };

  // Initialize Edit states
  const handleStartEdit = (student: UserData) => {
    setEditingStudent(student);
    setEditName(student.name);
    setEditDob(student.dob || '');
    setEditGender(student.gender || 'Male');
    setEditAddress(student.address || '');
    setEditGuardianName(student.guardianName || '');
    setEditGuardianContact(student.guardianContact || '');
    setEditClassId(student.classId || '');
    setEditStudentId(student.studentId || '');
    setEditPassportPhoto(student.passportPhoto || null);
    setEditError(null);
  };

  // Submit Edit updates
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    if (!editName) {
      setEditError("Full Name is required.");
      return;
    }
    if (!editClassId) {
      setEditError("Please select a class assignment.");
      return;
    }
    if (!editStudentId) {
      setEditError("Student ID is required.");
      return;
    }

    setUpdatingStudent(true);
    setEditError(null);

    try {
      await userService.updateProfileDetails(editingStudent.id, {
        name: editName,
        studentId: editStudentId,
        dob: editDob,
        gender: editGender,
        address: editAddress,
        guardianName: editGuardianName,
        guardianContact: editGuardianContact,
        classId: editClassId,
        passportPhoto: editPassportPhoto
      });
      setEditingStudent(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to update profile.");
    } finally {
      setUpdatingStudent(false);
    }
  };

  const handleDeleteEditPhoto = async () => {
    if (!editingStudent) return;
    if (!window.confirm(`Delete the passport photo for ${editingStudent.name}?`)) return;

    setDeletingEditPhoto(true);
    setEditError(null);

    try {
      await userService.deletePassportPhoto(editingStudent.id);
      setEditPassportPhoto(null);
      setEditingStudent((current) => current ? { ...current, passportPhoto: null, passportPhotoPath: null } : current);
    } catch (err: any) {
      setEditError(err.message || 'Failed to delete passport photo.');
    } finally {
      setDeletingEditPhoto(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError("Please enter or generate a Student ID.");
      return;
    }
    if (!name) {
      setError("Full Name is required.");
      return;
    }
    if (!selectedClassId) {
      setError("Please select a class assignment.");
      return;
    }

    setError(null);
    setProvisioning(true);
    setProvisionStep(1); // "Initializing Student Profile..."

    try {
      // Step 1: Simulated system sync
      await new Promise((r) => setTimeout(r, 800));
      setProvisionStep(2); // "Provisioning Student Credentials..."

      const generatedEmail = `${studentId.toLowerCase()}@${schoolId}.school`;

      // Provision Auth Account
      const { uid, defaultPassword } = await userService.provisionUserAccount(
        name,
        "", // Send empty string so it maps studentId to email
        'student',
        schoolId,
        studentId
      );

      setProvisionStep(3); // "Indexing Biodata & Storing Passport Photo..."
      await new Promise((r) => setTimeout(r, 600));

      // Save additional BioData details to user profile
      await userService.updateProfileDetails(uid, {
        dob,
        gender,
        address,
        guardianName,
        guardianContact,
        passportPhoto: passportPhoto || null,
        classId: selectedClassId
      });

      setProvisionStep(4); // "Profile Verified!"
      await new Promise((r) => setTimeout(r, 500));

      setProvisionedCredentials({
        uid,
        email: generatedEmail,
        studentId,
        tempPassword: defaultPassword
      });

      // Clear form
      setName('');
      setDob('');
      setGender('Male');
      setAddress('');
      setGuardianName('');
      setGuardianContact('');
      setStudentId('');
      setPassportPhoto(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Account provisioning failed.");
    } finally {
      setProvisioning(false);
      setProvisionStep(0);
    }
  };

  const tabs: TabItem[] = [
    { id: 'register', label: 'Student Enrollment', icon: <UserPlus className="w-5 h-5" /> },
    { id: 'intake', label: 'Student Intake', icon: <Users className="w-5 h-5" /> },
    { id: 'directory', label: 'Student Directory', icon: <Users className="w-5 h-5" /> },
    { id: 'support', label: 'Support', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'settings', label: 'Portal Settings', icon: <Settings className="w-5 h-5" /> }
  ];

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'register':
        return {
          title: 'Registrar Console',
          subtitle: 'Provision a student ledger account, document bio-data, and capture passport credentials.'
        };
      case 'intake':
        return {
          title: 'Student Intake',
          subtitle: 'Generate secure student registration links and approve submitted forms into active student accounts.'
        };
      case 'directory':
        return {
          title: 'Ledger Registry',
          subtitle: 'Search and inspect registered student profiles and academic classifications.'
        };
      case 'support':
        return {
          title: 'Support History',
          subtitle: 'Review your support messages and the replies that were sent back.'
        };
      case 'settings':
      default:
        return {
          title: 'Portal Settings',
          subtitle: 'Update your administrative security password and profile preferences.'
        };
    }
  };

  const header = getHeaderInfo();

  // Print credential slip helper
  const handlePrintSlip = () => {
    window.print();
  };

  // Filtered student list
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesClass = !classFilter || student.classId === classFilter;
    
    return matchesSearch && matchesClass;
  });

  const studentSearchSuggestions = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return filteredStudents.slice(0, 6).map((student) => ({
        id: student.id,
        label: student.name,
        hint: student.studentId || student.email || 'Student record',
        value: student.name
      }));
    }

    const base = students
      .map((student) => ({
        id: student.id,
        label: student.name,
        hint: student.studentId || student.email || 'Student record',
        value: student.name,
        score:
          Number(student.name.toLowerCase().startsWith(query)) * 3 +
          Number((student.studentId || '').toLowerCase().startsWith(query)) * 2 +
          Number((student.email || '').toLowerCase().startsWith(query)) * 2 +
          Number(student.name.toLowerCase().includes(query)) +
          Number((student.studentId || '').toLowerCase().includes(query)) +
          Number((student.email || '').toLowerCase().includes(query))
      }))
      .filter((item) => item.score > 0);

    base.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    return base.slice(0, 6);
  }, [students, filteredStudents, searchQuery]);

  return (
    <DashboardLayout
      userName={profile.name}
      userRole="registrar"
      title={header.title}
      subtitle={header.subtitle}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
      schoolId={schoolId}
      schoolName={profile.schoolName || null}
      schoolMotto={profile.schoolMotto || null}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-amber-600">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-amber-500" />
          <p className="font-extrabold text-slate-500">Synchronizing database registries...</p>
        </div>
      ) : (
        <>
          {activeTab === 'register' && (
            <div className="space-y-8">
              {/* Stats Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Enrolled</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-0.5">{students.length}</h3>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Grades</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-0.5">{classes.length}</h3>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">System Status</p>
                    <h3 className="text-sm font-black text-emerald-600 mt-1 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-lg">Operational</h3>
                  </div>
                </div>
              </div>

              {/* Show Success State after Enrollment */}
              {provisionedCredentials && (
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-1 rounded-[2.5rem] shadow-2xl animate-fade-in relative print:hidden">
                  <div className="bg-white p-8 md:p-10 rounded-[2.4rem]">
                    <div className="flex justify-between items-start gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 animate-bounce" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-900">Student Account Provisioned</h3>
                          <p className="text-slate-500 text-sm font-medium">Digital registry successfully authorized and compiled.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setProvisionedCredentials(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase transition"
                      >
                        Enroll Another Student
                      </button>
                    </div>

                    {/* Voucher Slip Container for Print */}
                    <div id="credential-slip" className="border-2 border-dashed border-slate-200 p-6 rounded-3xl bg-slate-50 relative max-w-xl mx-auto">
                      <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Official Voucher
                      </div>
                      
                      <div className="text-center pb-6 border-b border-dashed border-slate-200">
                        <h4 className="font-black text-lg text-slate-950 uppercase tracking-tight">
                          {profile.schoolName || "Liberia Educational Institution"}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Student Registry Credential Pass</p>
                      </div>

                      <div className="py-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Student ID</span>
                            <p className="font-extrabold text-sm text-slate-800 font-mono">{provisionedCredentials.studentId}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Access Username / Email</span>
                            <p className="font-extrabold text-sm text-slate-800 font-mono">{provisionedCredentials.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div>
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Temporary Password</span>
                            <p className="font-black text-sm text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl inline-block font-mono tracking-wider">
                              {provisionedCredentials.tempPassword}
                            </p>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Password Restriction</span>
                            <p className="text-xs font-bold text-slate-600 mt-1">Required to change password on first authenticate.</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center text-[10px] font-medium text-slate-400">
                        <span>Registry ID: {provisionedCredentials.uid}</span>
                        <span>Date Issued: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4 mt-6">
                      <button
                        onClick={handlePrintSlip}
                        className="flex items-center gap-2 px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg shadow-slate-200"
                      >
                        <Printer className="w-4 h-4" /> Print Credential Voucher
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Enrollment Form and Photo Upload Area */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Right/Sidebar Photo Card */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Photo Upload Container */}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <h3 className="text-base font-black text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <Camera className="w-5 h-5 text-amber-500" />
                      Passport Photo
                    </h3>

                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden"
                    >
                      {passportPhoto ? (
                        <>
                          <img 
                            src={passportPhoto} 
                            alt="Student Passport" 
                            className="absolute inset-0 w-full h-full object-cover rounded-2xl" 
                          />
                          <div className="absolute inset-0 bg-slate-950/40 hover:bg-slate-950/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                            <span className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                              <RefreshCw className="w-4 h-4" /> Replace Photo
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <UploadCloud className="w-12 h-12 text-slate-300 mb-3 animate-pulse" />
                          <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-1">Upload Passport Photo</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Supports PNG, JPG, JPEG</p>
                          {uploadingPhoto && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handlePhotoUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />

                    <p className="text-[10px] text-slate-400 font-medium italic mt-3 leading-relaxed text-center">
                      Required for digital identity card verification and administrative enrollment rosters.
                    </p>
                  </div>

                  {/* Operational Ledger Note */}
                  <div className="bg-slate-900 p-6 rounded-[2rem] text-white relative overflow-hidden shadow-xl">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_40%)]"></div>
                    <h3 className="text-base font-black uppercase tracking-wider mb-2 flex items-center gap-2 text-amber-400">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      Ledger Architecture
                    </h3>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      Every newly enrolled student is provisioned with a secure digital profile. This maps their attendance registries, quarterly grade transcripts, and class standings onto a tamper-resistant educational profile.
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t border-white/5 pt-4">
                      <Building2 className="w-4 h-4 text-amber-500" />
                      Security Level: Encrypted Profile
                    </div>
                  </div>
                </div>

                {/* Left Form Card */}
                <div className="lg:col-span-2">
                  <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-500" />
                      Student Profile Form
                    </h3>

                    {error && (
                      <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs font-black uppercase tracking-wider mb-6 border border-red-100 flex items-center gap-2">
                        <BadgeAlert className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-6">
                      {/* Step 1: Student ID & Classroom Assignment */}
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">1. Institutional Alignment</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Student ID Assignment</label>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                required
                                placeholder="STU-2026-1001"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={generateStudentId}
                                className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase border border-slate-200 transition shrink-0 flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Generate
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Class/Grade Assignment</label>
                            <select
                              required
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                              value={selectedClassId}
                              onChange={(e) => setSelectedClassId(e.target.value)}
                            >
                              {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                              ))}
                              {classes.length === 0 && (
                                <option value="">No classes available - create one in Admin portal</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Biodata Details */}
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">2. Bio-Data Details</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                required
                                placeholder="Full Name"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                              />
                              <User className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date of Birth</label>
                              <div className="relative">
                                <input 
                                  type="date" 
                                  required
                                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                  value={dob}
                                  onChange={(e) => setDob(e.target.value)}
                                />
                                <Calendar className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Gender</label>
                              <select
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Residential Address</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              required
                              placeholder="Residential Address"
                              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                            />
                            <MapPin className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Guardian Details */}
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">3. Guardian / Next of Kin Contacts</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Primary Guardian Full Name</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                required
                                placeholder="Guardian Full Name"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={guardianName}
                                onChange={(e) => setGuardianName(e.target.value)}
                              />
                              <User className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Guardian Contact Phone</label>
                            <div className="relative">
                              <input 
                                type="tel" 
                                required
                                placeholder="e.g. +231-XXXX-XXXX"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={guardianContact}
                                onChange={(e) => setGuardianContact(e.target.value)}
                              />
                              <Phone className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Submit Trigger & Provision State */}
                      <div className="pt-4">
                        {provisioning ? (
                          <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4 flex flex-col items-center justify-center animate-pulse">
                            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                            <div className="text-center">
                              <p className="text-xs font-black uppercase tracking-widest text-amber-400">
                                {provisionStep === 1 && "Initializing Student Profile..."}
                                {provisionStep === 2 && "Provisioning Secure Authentication..."}
                                {provisionStep === 3 && "Archiving Biodata Registry..."}
                                {provisionStep === 4 && "Encrypting Ledger Profiles..."}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Please stand by. Writing data coordinates to global cloud rules.</p>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="submit"
                            className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-100 hover:shadow-2xl transition-all flex items-center justify-center gap-2 group"
                          >
                            Compile Profile & Enroll Student <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'intake' && (
            <StudentRegistrationManager
              schoolId={schoolId}
              schoolName={profile.schoolName || null}
              schoolMotto={profile.schoolMotto || null}
            />
          )}

          {activeTab === 'directory' && (
            <div className="space-y-6">
              {/* Directory Filter Panel */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl w-full sm:w-80 md:w-96 shadow-inner">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Search by student name or ID..." 
                    className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-full placeholder-slate-400" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                  />

                  {searchFocused && searchQuery.trim().length > 0 && studentSearchSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Suggestions
                      </div>
                      <div className="max-h-72 overflow-auto">
                        {studentSearchSuggestions.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSearchQuery(item.value);
                              setSearchFocused(false);
                            }}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                              <User className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">{item.label}</p>
                              <p className="truncate text-[11px] font-medium text-slate-500">{item.hint}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select
                    className="w-full sm:w-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                  >
                    <option value="">All Classrooms</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Detail view overlay card */}
              {viewingStudentDetail && (
                <div 
                  className="bg-slate-900/50 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4"
                  onClick={() => setViewingStudentDetail(null)}
                >
                  <div 
                    className="bg-white p-8 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative overflow-hidden animate-slide-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={() => setViewingStudentDetail(null)}
                      className="absolute top-6 right-6 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    
                    <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-5 h-5 text-amber-500" />
                      Detailed Student Profile
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div className="md:col-span-1 flex flex-col items-center">
                        <div className="w-32 h-32 rounded-3xl bg-slate-100 border border-slate-200 overflow-hidden shadow-md flex items-center justify-center relative">
                          {viewingStudentDetail.passportPhoto ? (
                            <img src={storageService.getThumbnailUrl(viewingStudentDetail.passportPhoto, '500x500')} alt="Passport" className="w-full h-full object-cover" />
                          ) : (
                            <Camera className="w-8 h-8 text-slate-300 animate-pulse" />
                          )}
                        </div>
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-wider mt-3.5">
                          {classes.find(c => c.id === viewingStudentDetail.classId)?.name || 'Unassigned Grade'}
                        </span>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Full Name</p>
                          <h4 className="text-lg font-black text-slate-900">{viewingStudentDetail.name}</h4>
                        </div>
                        
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Student ID</p>
                            <p className="text-xs font-bold text-slate-700 font-mono">{viewingStudentDetail.studentId || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Authentication Email</p>
                            <p className="text-xs font-bold text-slate-700 font-mono">{viewingStudentDetail.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date of Birth</p>
                            <p className="text-xs font-bold text-slate-700">{viewingStudentDetail.dob || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Gender</p>
                            <p className="text-xs font-bold text-slate-700">{viewingStudentDetail.gender || 'N/A'}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Residential Address</p>
                          <p className="text-xs font-bold text-slate-700">{viewingStudentDetail.address || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3 mb-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Guardian Identity & Emergency</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Guardian Full Name</span>
                          <span className="text-xs font-bold text-slate-800">{viewingStudentDetail.guardianName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase block">Guardian Contact Phone</span>
                          <span className="text-xs font-bold text-slate-800">{viewingStudentDetail.guardianContact || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {viewingStudentDetail.password && (
                      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl mb-6 flex justify-between items-center gap-4">
                        <div>
                          <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block mb-0.5">Administrative Password Recovery</span>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hand this secure credential passcode to the student for immediate portal recovery.</p>
                        </div>
                        <span className="font-mono text-xs font-black text-amber-800 bg-white border border-amber-200 px-3.5 py-2 rounded-xl shadow-sm shrink-0">
                          {viewingStudentDetail.password}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setViewingStudentDetail(null)}
                        className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition"
                      >
                        Close Profile
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Student Modal Overlay */}
              {editingStudent && (
                <div 
                  className="bg-slate-900/50 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
                  onClick={() => setEditingStudent(null)}
                >
                  <div 
                    className="bg-white p-8 rounded-[2.5rem] w-full max-w-3xl shadow-2xl relative overflow-hidden animate-slide-in my-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={() => setEditingStudent(null)}
                      className="absolute top-6 right-6 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <h3 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-wider flex items-center gap-2">
                      <FilePenLine className="w-5 h-5 text-amber-500" />
                      Edit Student Profile
                    </h3>

                    {editError && (
                      <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs font-black uppercase tracking-wider mb-6 border border-red-100 flex items-center gap-2">
                        <BadgeAlert className="w-5 h-5 shrink-0" />
                        <span>{editError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveEdit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Edit Passport Photo block */}
                        <div className="md:col-span-1 space-y-4 flex flex-col items-center">
                          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 self-start">Passport Photo</span>
                          <div 
                            onClick={() => editFileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center w-full h-[180px] relative overflow-hidden"
                          >
                            {editPassportPhoto ? (
                              <>
                                <img 
                                  src={editPassportPhoto} 
                                  alt="Student Passport" 
                                  className="absolute inset-0 w-full h-full object-cover rounded-2xl" 
                                />
                                <div className="absolute inset-0 bg-slate-950/40 hover:bg-slate-950/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                                  <span className="text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                    <RefreshCw className="w-3.5 h-3.5" /> Replace Photo
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center">
                                <UploadCloud className="w-10 h-10 text-slate-300 mb-2" />
                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Upload Photo</p>
                              </div>
                            )}

                            {uploadingEditPhoto && (
                              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                              </div>
                            )}
                          </div>

                          {editPassportPhoto && (
                            <button
                              type="button"
                              onClick={handleDeleteEditPhoto}
                              disabled={deletingEditPhoto}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingEditPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              Delete Photo
                            </button>
                          )}
                          
                          <input 
                            type="file" 
                            ref={editFileInputRef} 
                            onChange={handleEditPhotoUpload} 
                            accept="image/*" 
                            className="hidden" 
                          />
                        </div>

                        {/* Edit Biodata details */}
                        <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Student ID</label>
                              <input 
                                type="text" 
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={editStudentId}
                                onChange={(e) => setEditStudentId(e.target.value)}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Grade Level</label>
                              <select
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={editClassId}
                                onChange={(e) => setEditClassId(e.target.value)}
                              >
                                <option value="">-- Select Class --</option>
                                {classes.map(cls => (
                                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                            <input 
                              type="text" 
                              required
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date of Birth</label>
                              <input 
                                type="date" 
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={editDob}
                                onChange={(e) => setEditDob(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Gender</label>
                              <select
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                                value={editGender}
                                onChange={(e) => setEditGender(e.target.value)}
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Residential Address</label>
                          <input 
                            type="text" 
                            required
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Guardian Name</label>
                          <input 
                            type="text" 
                            required
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                            value={editGuardianName}
                            onChange={(e) => setEditGuardianName(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Guardian Phone</label>
                          <input 
                            type="tel" 
                            required
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-xs font-bold text-slate-700 transition"
                            value={editGuardianContact}
                            onChange={(e) => setEditGuardianContact(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingStudent(null)}
                          className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updatingStudent}
                          className="px-8 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-amber-100 flex items-center gap-2"
                        >
                          {updatingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Profile</>}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Student Cards Directory */}
              {filteredStudents.length === 0 ? (
                <div className="bg-white p-12 rounded-[2rem] shadow-sm border border-slate-100 text-center py-20">
                  <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">No Students Found</h2>
                  <p className="text-slate-500 font-medium">Verify your query terms or select alternative classroom classifications.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStudents.map(student => {
                    const matchedClass = classes.find(c => c.id === student.classId);
                    return (
                      <div 
                        key={student.id} 
                        className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
                      >
                        <div className="flex gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {student.passportPhoto ? (
                              <img src={storageService.getThumbnailUrl(student.passportPhoto, '200x200')} alt="Passport" className="w-full h-full object-cover" />
                            ) : (
                              <Camera className="w-6 h-6 text-slate-300" />
                            )}
                          </div>
                          
                          <div className="min-w-0">
                            <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">
                              {matchedClass ? matchedClass.name : 'No Class'}
                            </span>
                            <h4 className="font-extrabold text-slate-950 truncate mt-1 text-sm">{student.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{student.studentId || 'No ID'}</p>
                          </div>
                        </div>

                        <div className="border-t border-slate-50 pt-4 flex justify-between items-center">
                          <div className="min-w-0 text-left">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Guardian</span>
                            <span className="text-xs font-bold text-slate-700 truncate block">{student.guardianName || 'N/A'}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewingStudentDetail(student)}
                              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition flex items-center justify-center shrink-0"
                              title="View Profile Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStartEdit(student)}
                              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition flex items-center justify-center shrink-0"
                              title="Edit Student Profile"
                            >
                              <FilePenLine className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'support' && (
            <SupportHistory userId={profile.id || ''} schoolId={schoolId} userName={profile.name} />
          )}

          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto">
              <AccountSettings userId={profile.id} userRole={profile.role} />
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
};

export default RegistrarDashboard;
