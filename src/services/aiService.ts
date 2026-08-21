import { dbAdapter } from '../lib/dbAdapter';
import { userService } from './userService';
import { academicService } from './academicService';
import { gradeService } from './gradeService';
import { attendanceService } from './attendanceService';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";

export interface MessagePart {
  text?: string;
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
}

export interface ChatMessage {
  role: 'user' | 'model' | 'tool';
  parts: MessagePart[];
}

export interface UserContext {
  uid?: string;
  userId?: string;
  role?: string;
  userRole?: string;
  schoolId?: string | null;
}

export interface BrandAssetCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrandAssetExtractionResult {
  found: boolean;
  confidence: number;
  crop?: BrandAssetCropBox;
  notes?: string;
}

function getNormalizedContext(userContext: UserContext) {
  return {
    uid: userContext.uid || userContext.userId || '',
    role: userContext.role || userContext.userRole || 'user',
    schoolId: userContext.schoolId || null
  };
}

function stripCodeFences(text: string) {
  return text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function extractBrandAssetWithGroq(
  imageDataUrl: string,
  assetLabel: 'logo' | 'registrar signature' | 'principal signature'
): Promise<BrandAssetExtractionResult> {
  if (!GROQ_API_KEY) {
    throw new Error("Groq is not configured.");
  }

  const prompt = [
    `Inspect the image and find the ${assetLabel}.`,
    "Return only JSON with this shape:",
    '{"found":boolean,"confidence":number,"crop":{"x":number,"y":number,"width":number,"height":number},"notes":string}',
    "All crop values must be normalized between 0 and 1.",
    "Use the tightest crop that keeps the full asset visible with a small margin.",
    "If the asset is not present or the image is already just the asset, set found to true and crop to cover the visible asset or the full image.",
    "If you cannot confidently identify the asset, set found to false and explain briefly in notes."
  ].join(" ");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq vision request failed with status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Groq vision did not return a usable response.");
  }

  const parsed = JSON.parse(stripCodeFences(text)) as BrandAssetExtractionResult;
  return {
    found: !!parsed.found,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    crop: parsed.crop,
    notes: parsed.notes
  };
}

// ============================================================================
// DATABASE TOOL EXECUTIONS (REALTIME DB / SPARK FREE TIER ADAPTER)
// ============================================================================

async function handleQueryCollection(
  userContextInput: UserContext,
  collectionName: string,
  field?: string,
  value?: any
) {
  const userContext = getNormalizedContext(userContextInput);

  if (collectionName === 'schools') {
    if (userContext.role !== 'superadmin') {
      if (!userContext.schoolId) {
        throw new Error("Access denied: No school context associated with your account.");
      }
      if (field === 'schoolId' && value !== userContext.schoolId) {
        throw new Error("Access denied: You are not authorized to query other school contexts.");
      }
      const res = await dbAdapter.getDoc(`schools/${userContext.schoolId}`);
      if (!res.exists) return [];
      return [{ id: userContext.schoolId, ...res.data }];
    }

    return await new Promise<any[]>(resolve => {
      const unsub = dbAdapter.subscribeToPath('schools', (list) => {
        unsub();
        let filtered = list;
        if (field && value !== undefined) {
          const key = field as string;
          filtered = list.filter(item => item[key] === value);
        }
        resolve(filtered);
      });
    });
  }

  let targetSchoolId = userContext.role === 'superadmin' ? null : userContext.schoolId;
  
  if (userContext.role === 'superadmin' && field === 'schoolId' && value) {
    targetSchoolId = value;
    field = undefined;
    value = undefined;
  }

  if (userContext.role !== 'superadmin') {
    if (field === 'schoolId' && value !== userContext.schoolId) {
      throw new Error("Access denied: You are not authorized to query other school contexts.");
    }
  }

  if (targetSchoolId) {
    if (userContext.role === 'student') {
      if (collectionName === 'grades' || collectionName === 'attendance') {
        field = 'studentId';
        value = userContext.uid;
      } else if (collectionName === 'users') {
        field = 'id';
        value = userContext.uid;
      } else if (collectionName !== 'classes' && collectionName !== 'subjects') {
        throw new Error("Access denied: Students are not authorized to query this collection.");
      }
    }

    return await new Promise<any[]>(resolve => {
      const unsub = dbAdapter.subscribeToPath(`schools/${targetSchoolId}/${collectionName}`, (list) => {
        unsub();
        let filtered = list;
        if (field && value !== undefined) {
          const key = field as string;
          filtered = list.filter(item => item[key] === value);
        }
        resolve(filtered);
      });
    });
  }

  if (userContext.role !== 'superadmin') {
    throw new Error("Access denied: Scoped queries must run inside your school node.");
  }

  return await new Promise<any[]>(resolve => {
    const unsub = dbAdapter.subscribeToPath(collectionName, (list) => {
      unsub();
      let filtered = list;
      if (field && value !== undefined) {
        filtered = list.filter(item => item[field] === value);
      }
      resolve(filtered);
    });
  });
}

async function handleGetDocument(
  userContextInput: UserContext,
  collectionName: string,
  documentId: string
) {
  const userContext = getNormalizedContext(userContextInput);

  if (collectionName === 'schools') {
    if (userContext.role !== 'superadmin' && documentId !== userContext.schoolId) {
      throw new Error("Access denied: You can only view your own school's information.");
    }
    const res = await dbAdapter.getDoc(`schools/${documentId}`);
    if (!res.exists) {
      throw new Error("School document not found.");
    }
    return { id: documentId, ...res.data };
  }

  let targetSchoolId = userContext.role === 'superadmin' ? null : userContext.schoolId;
  
  if (!targetSchoolId) {
    if (userContext.role !== 'superadmin') {
      throw new Error("Access denied: No school context associated with your account.");
    }
    const globalRes = await dbAdapter.getDoc(`${collectionName}/${documentId}`);
    if (!globalRes.exists) {
      throw new Error("Document not found globally.");
    }
    const globalData = globalRes.data;
    if (globalData.schoolId) {
      targetSchoolId = globalData.schoolId;
    } else {
      return { id: documentId, ...globalData };
    }
  }

  if (!targetSchoolId) {
    throw new Error("Error: School context could not be resolved.");
  }

  if (userContext.role !== 'superadmin' && targetSchoolId !== userContext.schoolId) {
    throw new Error("Access denied: You are not authorized to view documents belonging to another school.");
  }

  const res = await dbAdapter.getDoc(`schools/${targetSchoolId}/${collectionName}/${documentId}`);
  if (!res.exists) {
    throw new Error("Document not found inside school node.");
  }
  const data = res.data;

  if (userContext.role === 'student') {
    if (collectionName === 'users' && documentId !== userContext.uid) {
      throw new Error("Access denied: You can only view your own profile.");
    }
    if (collectionName === 'grades' && data.studentId !== userContext.uid) {
      throw new Error("Access denied: You can only view your own grade sheets.");
    }
    if (collectionName === 'attendance' && data.studentId !== userContext.uid) {
      throw new Error("Access denied: You can only view your own attendance logs.");
    }
  }

  return { id: documentId, ...data };
}

async function handleAddDocument(
  userContextInput: UserContext,
  collectionName: string,
  dataJson: string
) {
  const userContext = getNormalizedContext(userContextInput);
  const data = JSON.parse(dataJson);

  if (userContext.role === 'student') {
    throw new Error("Access denied: Students cannot write data.");
  }

  if (collectionName === 'schools') {
    if (userContext.role !== 'superadmin') {
      throw new Error("Access denied: Only system super-administrators can register school nodes.");
    }
    const slug = data.schoolId || data.id || data.name.toLowerCase().trim().replace(/\s+/g, '-');
    const payload = {
      id: slug,
      schoolId: slug,
      createdAt: Date.now(),
      ...data
    };
    await dbAdapter.setDoc(`schools/${slug}`, payload);
    return { id: slug, message: "School node created successfully.", data: payload };
  }

  const targetSchoolId = userContext.role === 'superadmin' ? data.schoolId : userContext.schoolId;
  if (!targetSchoolId) {
    throw new Error("Error: School context could not be resolved.");
  }

  if (userContext.role !== 'superadmin') {
    if (data.schoolId && data.schoolId !== userContext.schoolId) {
      throw new Error("Access denied: You are not authorized to write documents for another school context.");
    }
  }

  data.schoolId = targetSchoolId;
  data.createdAt = Date.now();

  if (userContext.role === 'teacher') {
    const allowed = ['assignments', 'grades', 'attendance', 'classes'];
    if (!allowed.includes(collectionName)) {
      throw new Error("Access denied: Teachers can only write assignments, grades, attendance, and classes.");
    }
    data.teacherId = userContext.uid;
  }

  const docId = await dbAdapter.pushDoc(`schools/${targetSchoolId}/${collectionName}`, data);

  if (collectionName === 'users') {
    await dbAdapter.setDoc(`users/${docId}`, {
      id: docId,
      name: data.name,
      email: data.email,
      role: data.role,
      schoolId: targetSchoolId,
      status: data.status || 'active',
      createdAt: Date.now()
    });
  }

  return { id: docId, message: "Document successfully created.", data };
}

async function handleUpdateDocument(
  userContextInput: UserContext,
  collectionName: string,
  documentId: string,
  dataJson: string
) {
  const userContext = getNormalizedContext(userContextInput);
  const data = JSON.parse(dataJson);

  if (userContext.role === 'student') {
    throw new Error("Access denied: Students cannot write data.");
  }

  if (collectionName === 'schools') {
    if (userContext.role !== 'superadmin' && documentId !== userContext.schoolId) {
      throw new Error("Access denied: You are not authorized to update other school configurations.");
    }
    await dbAdapter.updateDoc(`schools/${documentId}`, data);
    return { id: documentId, message: "School configuration updated." };
  }

  let targetSchoolId = userContext.role === 'superadmin' ? data.schoolId : userContext.schoolId;
  if (!targetSchoolId) {
    const pointerRes = await dbAdapter.getDoc(`users/${documentId}`);
    if (pointerRes.exists) {
      targetSchoolId = pointerRes.data.schoolId;
    }
  }

  if (!targetSchoolId) {
    throw new Error("Error: Could not resolve school context for updates.");
  }

  if (userContext.role !== 'superadmin' && targetSchoolId !== userContext.schoolId) {
    throw new Error("Access denied: You are not authorized to update documents belonging to another school.");
  }

  if (userContext.role !== 'superadmin' && data.schoolId && data.schoolId !== userContext.schoolId) {
    throw new Error("Access denied: You cannot reassign documents to another school context.");
  }

  delete data.id;
  delete data.schoolId;
  delete data.createdAt;

  data.updatedAt = Date.now();
  await dbAdapter.updateDoc(`schools/${targetSchoolId}/${collectionName}/${documentId}`, data);

  if (collectionName === 'users') {
    const globalUpdates: any = {};
    if (data.name) globalUpdates.name = data.name;
    if (data.email) globalUpdates.email = data.email;
    if (data.role) globalUpdates.role = data.role;
    if (data.status) globalUpdates.status = data.status;
    if (Object.keys(globalUpdates).length > 0) {
      await dbAdapter.updateDoc(`users/${documentId}`, globalUpdates);
    }
  }

  return { id: documentId, message: "Document successfully updated." };
}

async function handleDeleteDocument(
  userContextInput: UserContext,
  collectionName: string,
  documentId: string
) {
  const userContext = getNormalizedContext(userContextInput);

  if (userContext.role === 'student') {
    throw new Error("Access denied: Students cannot delete data.");
  }

  if (collectionName === 'schools') {
    if (userContext.role !== 'superadmin') {
      throw new Error("Access denied: Only system super-administrators can delete school nodes.");
    }
    await dbAdapter.deleteDoc(`schools/${documentId}`);
    return { id: documentId, message: "School node completely removed." };
  }

  let targetSchoolId = userContext.role === 'superadmin' ? null : userContext.schoolId;
  if (!targetSchoolId) {
    const pointerRes = await dbAdapter.getDoc(`users/${documentId}`);
    if (pointerRes.exists) {
      targetSchoolId = pointerRes.data.schoolId;
    }
  }

  if (!targetSchoolId) {
    throw new Error("Error: Could not resolve school context for deletion.");
  }

  if (userContext.role !== 'superadmin' && targetSchoolId !== userContext.schoolId) {
    throw new Error("Access denied: You are not authorized to delete documents belonging to another school.");
  }

  await dbAdapter.deleteDoc(`schools/${targetSchoolId}/${collectionName}/${documentId}`);

  if (collectionName === 'users') {
    await dbAdapter.deleteDoc(`users/${documentId}`);
  }

  return { id: documentId, message: "Document successfully deleted." };
}

// ============================================================================
// SPECIFIC AGENTIC TOOL HANDLERS
// ============================================================================

async function handleProvisionUser(
  userContextInput: UserContext,
  name: string,
  email: string | undefined,
  role: string,
  schoolId: string,
  studentIdInput?: string,
  customPassword?: string
) {
  const userContext = getNormalizedContext(userContextInput);
  const allowedRoles = ['superadmin', 'schooladmin', 'registrar'];
  if (!allowedRoles.includes(userContext.role)) {
    throw new Error(`Access denied: Users with role '${userContext.role}' are not authorized to enroll or provision users.`);
  }

  const targetSchoolId = userContext.role === 'superadmin' ? schoolId : userContext.schoolId;
  if (!targetSchoolId) {
    throw new Error("School context is required to provision a user.");
  }

  if (userContext.role !== 'superadmin' && targetSchoolId !== userContext.schoolId) {
    throw new Error("Access denied: You are not authorized to enroll users for another school.");
  }

  if (role !== 'schooladmin' && role !== 'teacher' && role !== 'student' && role !== 'registrar') {
    throw new Error(`Invalid role for provisioning: ${role}`);
  }

  const result = await userService.provisionUserAccount(
    name,
    email || "",
    role,
    targetSchoolId,
    studentIdInput,
    customPassword
  );

  return {
    success: true,
    message: `User '${name}' enrolled successfully as '${role}' in school '${targetSchoolId}'.`,
    uid: result.uid,
    defaultPassword: result.defaultPassword,
    schoolId: targetSchoolId
  };
}

async function handleRemoveStudent(
  userContextInput: UserContext,
  studentIdOrUid: string
) {
  const userContext = getNormalizedContext(userContextInput);
  const allowedRoles = ['superadmin', 'schooladmin', 'registrar'];
  if (!allowedRoles.includes(userContext.role)) {
    throw new Error(`Access denied: Users with role '${userContext.role}' are not authorized to remove students.`);
  }

  const targetSchoolId = userContext.schoolId;
  if (userContext.role !== 'superadmin' && !targetSchoolId) {
    throw new Error("No school context associated with your account.");
  }

  let studentDoc: any = null;
  let uid = studentIdOrUid;

  if (userContext.role === 'superadmin') {
    const globalRes = await dbAdapter.getDoc(`users/${studentIdOrUid}`);
    if (globalRes.exists) {
      studentDoc = globalRes.data;
    }
  } else if (targetSchoolId) {
    const schoolRes = await dbAdapter.getDoc(`schools/${targetSchoolId}/users/${studentIdOrUid}`);
    if (schoolRes.exists) {
      studentDoc = schoolRes.data;
    }
  }

  if (!studentDoc && targetSchoolId) {
    const schoolUsers = await dbAdapter.getDocsByQuery(`schools/${targetSchoolId}/users`, 'studentId', studentIdOrUid);
    if (schoolUsers.length > 0) {
      uid = schoolUsers[0].id;
      studentDoc = schoolUsers[0];
    }
  }

  if (!studentDoc) {
    throw new Error(`Student not found with identifier '${studentIdOrUid}'.`);
  }

  if (studentDoc.role !== 'student') {
    throw new Error(`Target user is a '${studentDoc.role}', not a student. This tool can only remove students.`);
  }

  const schoolIdOfStudent = studentDoc.schoolId;
  if (userContext.role !== 'superadmin' && schoolIdOfStudent !== targetSchoolId) {
    throw new Error("Access denied: You are not authorized to remove students from another school.");
  }

  await userService.deleteUserProfile(uid);

  return {
    success: true,
    message: `Student '${studentDoc.name}' (${studentDoc.studentId || uid}) has been successfully deleted and removed from the system.`,
    uid,
    name: studentDoc.name
  };
}

async function handleAssignStudentToClass(
  userContextInput: UserContext,
  studentId: string,
  classId: string | null
) {
  const userContext = getNormalizedContext(userContextInput);
  const allowedRoles = ['superadmin', 'schooladmin', 'registrar', 'teacher'];
  if (!allowedRoles.includes(userContext.role)) {
    throw new Error(`Access denied: Users with role '${userContext.role}' cannot assign students to classes.`);
  }

  if (userContext.role !== 'superadmin') {
    const studentProfile = await userService.getUserProfile(studentId);
    if (!studentProfile || studentProfile.schoolId !== userContext.schoolId) {
      throw new Error("Access denied: Student does not exist or is not part of your school.");
    }
  }

  await academicService.assignStudentToClass(studentId, classId);

  return {
    success: true,
    message: `Student '${studentId}' successfully assigned to class '${classId || 'unassigned'}'.`
  };
}

async function handleAssignTeacher(
  userContextInput: UserContext,
  teacherId: string,
  teacherName: string,
  classId: string,
  className: string,
  subjectId: string,
  subjectName: string,
  schoolId: string
) {
  const userContext = getNormalizedContext(userContextInput);
  const allowedRoles = ['superadmin', 'schooladmin', 'teacher'];
  if (!allowedRoles.includes(userContext.role)) {
    throw new Error(`Access denied: Users with role '${userContext.role}' cannot assign teachers.`);
  }

  const targetSchoolId = userContext.role === 'superadmin' ? schoolId : userContext.schoolId;
  if (!targetSchoolId) {
    throw new Error("School context is required to assign a teacher.");
  }

  if (userContext.role !== 'superadmin' && targetSchoolId !== userContext.schoolId) {
    throw new Error("Access denied: You are not authorized to assign teachers for another school.");
  }

  await academicService.assignTeacher(
    teacherId,
    teacherName,
    classId,
    className,
    subjectId,
    subjectName,
    targetSchoolId
  );

  return {
    success: true,
    message: `Teacher ${teacherName} (${teacherId}) successfully assigned to teach ${subjectName} in class ${className}.`
  };
}

async function handleUploadGrade(
  userContextInput: UserContext,
  studentId: string,
  teacherId: string | undefined,
  schoolId: string | undefined,
  subject: string,
  score: number,
  maxScore: number,
  term: string
) {
  const userContext = getNormalizedContext(userContextInput);
  const allowedRoles = ['superadmin', 'schooladmin', 'teacher'];
  if (!allowedRoles.includes(userContext.role)) {
    throw new Error(`Access denied: Users with role '${userContext.role}' cannot upload grades.`);
  }

  const targetSchoolId = userContext.role === 'superadmin' ? schoolId : userContext.schoolId;
  if (!targetSchoolId) {
    throw new Error("School context is required to upload a grade.");
  }

  if (userContext.role !== 'superadmin' && targetSchoolId !== userContext.schoolId) {
    throw new Error("Access denied: You are not authorized to upload grades for another school.");
  }

  const targetTeacherId = userContext.role === 'teacher' ? userContext.uid : (teacherId || userContext.uid || 'system');

  await gradeService.uploadGrade(
    studentId,
    targetTeacherId,
    targetSchoolId,
    subject,
    score,
    maxScore,
    term
  );

  return {
    success: true,
    message: `Grade of ${score}/${maxScore} uploaded successfully for student ${studentId} in subject ${subject} for ${term}.`
  };
}

async function handleSubmitAttendanceBatch(
  userContextInput: UserContext,
  attendanceJson: string,
  schoolId: string | undefined,
  teacherId: string | undefined,
  date: string
) {
  const userContext = getNormalizedContext(userContextInput);
  const allowedRoles = ['superadmin', 'schooladmin', 'teacher'];
  if (!allowedRoles.includes(userContext.role)) {
    throw new Error(`Access denied: Users with role '${userContext.role}' cannot submit attendance.`);
  }

  const targetSchoolId = userContext.role === 'superadmin' ? schoolId : userContext.schoolId;
  if (!targetSchoolId) {
    throw new Error("School context is required to submit attendance.");
  }

  if (userContext.role !== 'superadmin' && targetSchoolId !== userContext.schoolId) {
    throw new Error("Access denied: You are not authorized to submit attendance for another school.");
  }

  const targetTeacherId = userContext.role === 'teacher' ? userContext.uid : (teacherId || userContext.uid || 'system');

  const attendanceMap = JSON.parse(attendanceJson);

  await attendanceService.submitAttendanceBatch(
    attendanceMap,
    targetSchoolId,
    targetTeacherId,
    date
  );

  return {
    success: true,
    message: `Attendance batch of ${Object.keys(attendanceMap).length} records successfully submitted for date ${date}.`
  };
}

export async function executeTool(name: string, args: any, userContext: UserContext): Promise<any> {
  switch (name) {
    case "queryCollection":
      return await handleQueryCollection(userContext, args.collectionName, args.field, args.value);
    case "getDocument":
      return await handleGetDocument(userContext, args.collectionName, args.documentId);
    case "addDocument":
      return await handleAddDocument(userContext, args.collectionName, args.dataJson);
    case "updateDocument":
      return await handleUpdateDocument(userContext, args.collectionName, args.documentId, args.dataJson);
    case "deleteDocument":
      return await handleDeleteDocument(userContext, args.collectionName, args.documentId);
    case "provisionUser":
      return await handleProvisionUser(userContext, args.name, args.email, args.role, args.schoolId, args.studentIdInput, args.customPassword);
    case "removeStudent":
      return await handleRemoveStudent(userContext, args.studentId);
    case "assignStudentToClass":
      return await handleAssignStudentToClass(userContext, args.studentId, args.classId);
    case "assignTeacher":
      return await handleAssignTeacher(userContext, args.teacherId, args.teacherName, args.classId, args.className, args.subjectId, args.subjectName, args.schoolId);
    case "uploadGrade":
      return await handleUploadGrade(userContext, args.studentId, args.teacherId, args.schoolId, args.subject, args.score, args.maxScore, args.term);
    case "submitAttendanceBatch":
      return await handleSubmitAttendanceBatch(userContext, args.attendanceJson, args.schoolId, args.teacherId, args.date);
    default:
      throw new Error(`Unknown database action requested: ${name}`);
  }
}

// ============================================================================
// GEMINI TOOL DECLARATIONS
// ============================================================================

const toolDeclarations = [
  {
    name: "queryCollection",
    description: "Query documents inside a Firestore school node subcollection (options: 'users', 'schools', 'classes', 'subjects', 'assignments', 'grades', 'attendance').",
    parameters: {
      type: "OBJECT",
      properties: {
        collectionName: { 
          type: "STRING", 
          description: "Subcollection to query. Allowed values: 'users', 'schools', 'classes', 'subjects', 'assignments', 'grades', 'attendance'." 
        },
        field: { 
          type: "STRING", 
          description: "Optional field to filter by (e.g., 'role', 'classId')." 
        },
        value: { 
          type: "STRING", 
          description: "Optional exact value to match." 
        }
      },
      required: ["collectionName"]
    }
  },
  {
    name: "getDocument",
    description: "Retrieve a specific document inside a school's subcollection by its unique document ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        collectionName: { type: "STRING" },
        documentId: { type: "STRING" }
      },
      required: ["collectionName", "documentId"]
    }
  },
  {
    name: "addDocument",
    description: "Create a new document inside a school's subcollection. Ideal for submissions, grades, or assigning teachers.",
    parameters: {
      type: "OBJECT",
      properties: {
        collectionName: { type: "STRING" },
        dataJson: { 
          type: "STRING", 
          description: "JSON string of properties. Exclude auto-generated ID or createdAt." 
        }
      },
      required: ["collectionName", "dataJson"]
    }
  },
  {
    name: "updateDocument",
    description: "Update fields on an existing document in a school subcollection.",
    parameters: {
      type: "OBJECT",
      properties: {
        collectionName: { type: "STRING" },
        documentId: { type: "STRING" },
        dataJson: { type: "STRING", description: "JSON string containing updated attributes." }
      },
      required: ["collectionName", "documentId", "dataJson"]
    }
  },
  {
    name: "deleteDocument",
    description: "Delete an existing document inside a school subcollection.",
    parameters: {
      type: "OBJECT",
      properties: {
        collectionName: { type: "STRING" },
        documentId: { type: "STRING" }
      },
      required: ["collectionName", "documentId"]
    }
  },
  {
    name: "provisionUser",
    description: "Enroll or provision a new user account (student, teacher, schooladmin, registrar) with full authentication and school-isolated profile setup.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Full name of the user to enroll." },
        email: { type: "STRING", description: "Email address. If a student email is empty, it will be auto-generated from studentIdInput as STUID@schoolId.school." },
        role: { type: "STRING", description: "Target role. Must be 'student', 'teacher', 'schooladmin', or 'registrar'." },
        schoolId: { type: "STRING", description: "ID of the school to register the user under. Ignored for schooladmin/registrar if they are limited to their own school node." },
        studentIdInput: { type: "STRING", description: "Required for students. E.g., STU-2026-004." },
        customPassword: { type: "STRING", description: "Optional custom password. If omitted, a secure default password will be generated." }
      },
      required: ["name", "role"]
    }
  },
  {
    name: "assignStudentToClass",
    description: "Assign an existing student to a specific classroom or classroom node.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentId: { type: "STRING", description: "The unique Firestore user ID (uid) of the student." },
        classId: { type: "STRING", description: "The Firestore ID of the class to assign the student to. Pass empty string or null to unassign." }
      },
      required: ["studentId", "classId"]
    }
  },
  {
    name: "assignTeacher",
    description: "Assign a teacher to teach a curriculum subject in a specific classroom.",
    parameters: {
      type: "OBJECT",
      properties: {
        teacherId: { type: "STRING", description: "The unique Firestore user ID (uid) of the teacher." },
        teacherName: { type: "STRING", description: "Full name of the teacher." },
        classId: { type: "STRING", description: "Firestore class ID." },
        className: { type: "STRING", description: "Friendly name of the classroom." },
        subjectId: { type: "STRING", description: "Firestore subject ID." },
        subjectName: { type: "STRING", description: "Friendly name of the subject." },
        schoolId: { type: "STRING", description: "School ID. Defaults to current admin's school." }
      },
      required: ["teacherId", "teacherName", "classId", "className", "subjectId", "subjectName"]
    }
  },
  {
    name: "uploadGrade",
    description: "Record a student's grade/score for a subject.",
    parameters: {
      type: "OBJECT",
      properties: {
        studentId: { type: "STRING", description: "Unique Firestore user ID of the student." },
        teacherId: { type: "STRING", description: "Unique Firestore user ID of the teacher. Optional for teachers (auto-set to current user)." },
        schoolId: { type: "STRING", description: "School ID. Defaults to current user's school." },
        subject: { type: "STRING", description: "The name of the subject (e.g. 'Mathematics', 'Chemistry')." },
        score: { type: "NUMBER", description: "The numerical score earned." },
        maxScore: { type: "NUMBER", description: "The maximum achievable score (e.g., 100)." },
        term: { type: "STRING", description: "The term/period (e.g., '1st Period', '2nd Period', 'Final Exams')." }
      },
      required: ["studentId", "subject", "score", "maxScore", "term"]
    }
  },
  {
    name: "submitAttendanceBatch",
    description: "Submit or register attendance statuses for a list of students on a specific date.",
    parameters: {
      type: "OBJECT",
      properties: {
        attendanceJson: { type: "STRING", description: "JSON string representing a key-value mapping of student ID to status. E.g., '{\"STU123\":\"present\",\"STU124\":\"absent\"}'" },
        schoolId: { type: "STRING", description: "School ID. Defaults to current user's school." },
        teacherId: { type: "STRING", description: "The unique user ID of the teacher. Optional for teachers (auto-set)." },
        date: { type: "STRING", description: "Target date in YYYY-MM-DD format (e.g. '2026-06-07')." }
      },
      required: ["attendanceJson", "date"]
    }
  },
  {
    name: "removeStudent",
    description: "Permanently delete and remove a student profile from the school roster and global directories. Accepts either their unique Firestore UID or custom sequential Student ID (e.g. dragons-0001).",
    parameters: {
      type: "OBJECT",
      properties: {
        studentId: { type: "STRING", description: "The Firestore UID or sequential Student ID (e.g., dragons-0001) of the student to remove." }
      },
      required: ["studentId"]
    }
  }
];

// ============================================================================
// GLOBAL CHAT INVOCATION MAIN EXECUTOR (DUAL ENGINE: GROQ & GEMINI)
// ============================================================================

// Recursively sanitizes JSON Schema parameter types to lowercase for OpenAI/Groq compliance
function sanitizeSchemaForOpenAI(schema: any): any {
  if (!schema) return schema;
  const newSchema = { ...schema };
  if (typeof newSchema.type === 'string') {
    newSchema.type = newSchema.type.toLowerCase();
  }
  if (newSchema.properties) {
    const newProps: any = {};
    for (const [key, prop] of Object.entries(newSchema.properties)) {
      newProps[key] = sanitizeSchemaForOpenAI(prop);
    }
    newSchema.properties = newProps;
  }
  if (newSchema.items) {
    newSchema.items = sanitizeSchemaForOpenAI(newSchema.items);
  }
  return newSchema;
}

export async function askGemini(
  prompt: string, 
  systemInstruction?: string, 
  conversationHistory: ChatMessage[] = [],
  userContext?: UserContext
): Promise<string | { pendingToolCall: any }> {
  // --------------------------------------------------------------------------
  // ENGINE A: GROQ (LLAMA-3.3-70B)
  // --------------------------------------------------------------------------
  if (GROQ_API_KEY) {
    console.log("Routing copilot prompt to Groq (Llama-3.3-70B)...");
    const groqMessages: any[] = [];
    
    if (systemInstruction) {
      groqMessages.push({ role: "system", content: systemInstruction });
    }
    
    // Map custom ChatMessage format to OpenAI Chat Completions standard
    conversationHistory.forEach((msg, idx) => {
      if (msg.role === 'user') {
        groqMessages.push({ role: "user", content: msg.parts[0]?.text || "" });
      } else if (msg.role === 'model') {
        const p = msg.parts[0];
        if (p?.functionCall) {
          groqMessages.push({
            role: "assistant",
            content: null,
            tool_calls: [{
              id: `call_${idx}`,
              type: "function",
              function: {
                name: p.functionCall.name,
                arguments: JSON.stringify(p.functionCall.args)
              }
            }]
          });
        } else {
          groqMessages.push({ role: "assistant", content: p?.text || "" });
        }
      } else if (msg.role === 'tool') {
        const p = msg.parts[0];
        groqMessages.push({
          role: "tool",
          tool_call_id: `call_${idx - 1}`,
          name: p?.functionResponse?.name || "",
          content: JSON.stringify(p?.functionResponse?.response || {})
        });
      }
    });
    
    // Append the active prompt
    groqMessages.push({ role: "user", content: prompt });

    let loopCount = 0;
    const maxLoops = 5;

    while (loopCount < maxLoops) {
      const payload: any = {
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        temperature: 0.1
      };

      if (userContext) {
        payload.tools = toolDeclarations.map(tool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: sanitizeSchemaForOpenAI(tool.parameters)
          }
        }));
        payload.tool_choice = "auto";
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API returned status ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message;
      if (!assistantMessage) {
        throw new Error("Invalid response schema from Groq API.");
      }

      // Record assistant action to request log
      groqMessages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return assistantMessage.content || "";
      }

      const mutations = ['addDocument', 'updateDocument', 'deleteDocument', 'provisionUser', 'assignStudentToClass', 'assignTeacher', 'uploadGrade', 'submitAttendanceBatch', 'removeStudent'];
      const firstMutation = toolCalls.find((tc: any) => mutations.includes(tc.function.name));

      if (firstMutation) {
        return {
          pendingToolCall: {
            id: firstMutation.id,
            name: firstMutation.function.name,
            args: JSON.parse(firstMutation.function.arguments),
            engine: 'groq'
          }
        };
      }

      // Process and execute tool requests in parallel/sequence
      for (const toolCall of toolCalls) {
        const { name, arguments: argsString } = toolCall.function;
        const args = JSON.parse(argsString);
        let toolResult;

        try {
          if (!userContext) {
            throw new Error("Access denied: Authenticated user context required.");
          }

          toolResult = await executeTool(name, args, userContext);
        } catch (err: any) {
          toolResult = { error: err.message || "Operation failed." };
        }

        // Add execution outcomes to tool feed
        groqMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name,
          content: JSON.stringify({ output: toolResult })
        });
      }

      loopCount++;
    }

    throw new Error("Groq database processing loop exceeded maximum boundaries.");
  }

  // --------------------------------------------------------------------------
  // ENGINE B: GEMINI (GEMINI-2.0-FLASH) FALLBACK
  // --------------------------------------------------------------------------
  if (!GEMINI_API_KEY) {
    throw new Error("Neither Groq nor Gemini API keys are configured in environment variables.");
  }

  console.log("Routing copilot prompt to Gemini fallback...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const contents = [
    ...conversationHistory.map(msg => ({
      role: msg.role === 'tool' ? 'user' : msg.role,
      parts: msg.parts.map(p => {
        if (p.functionCall) {
          return { functionCall: p.functionCall };
        }
        if (p.functionResponse) {
          return { functionResponse: p.functionResponse };
        }
        return { text: p.text };
      })
    })),
    {
      role: 'user',
      parts: [{ text: prompt }]
    }
  ];

  const body: any = {
    contents
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  if (userContext) {
    body.tools = [
      {
        functionDeclarations: toolDeclarations
      }
    ];
  }

  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount < maxLoops) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const modelContent = candidate?.content;
    const parts = modelContent?.parts;
    
    const functionCall = parts?.[0]?.functionCall;

    if (!functionCall) {
      const textReply = parts?.[0]?.text;
      if (!textReply) {
        throw new Error("Invalid or empty response structure from Gemini API.");
      }
      return textReply;
    }

    const { name, args } = functionCall;
    const mutations = ['addDocument', 'updateDocument', 'deleteDocument', 'provisionUser', 'assignStudentToClass', 'assignTeacher', 'uploadGrade', 'submitAttendanceBatch', 'removeStudent'];

    if (mutations.includes(name)) {
      return {
        pendingToolCall: {
          id: `gemini_call_${loopCount}_${Date.now()}`,
          name,
          args,
          engine: 'gemini'
        }
      };
    }
    let toolResult;

    try {
      if (!userContext) {
        throw new Error("Access denied: You must be authenticated to trigger database actions.");
      }

      toolResult = await executeTool(name, args, userContext);
    } catch (err: any) {
      toolResult = { error: err.message || "Operation failed on DB." };
    }

    body.contents.push({
      role: 'model',
      parts: [
        {
          functionCall: {
            name,
            args
          }
        }
      ]
    });

    body.contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name,
            response: { output: toolResult }
          }
        }
      ]
    });

    loopCount++;
  }

  throw new Error("Agentic database processing loop exceeded maximum boundaries.");
}
