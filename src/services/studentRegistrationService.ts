import { auth } from '../lib/firebaseConfig';
import { dbAdapter } from '../lib/dbAdapter';
import type { ClassData } from './academicService';
import { userService } from './userService';

export interface RegistrationInvite {
  id: string;
  token: string;
  schoolId: string;
  schoolName?: string;
  schoolMotto?: string;
  label: string;
  note?: string;
  status: 'active' | 'revoked';
  createdAt: number;
  createdBy?: string | null;
  expiresAt?: number | null;
  maxUses?: number | null;
  uses?: number;
}

export interface RegistrationRequest {
  id: string;
  schoolId: string;
  inviteToken: string;
  inviteLabel?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  reviewedAt?: number | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  approvedStudentUid?: string | null;
  approvedStudentId?: string | null;
  temporaryPassword?: string | null;
  classId?: string | null;
  className?: string | null;
  fullName: string;
  email?: string;
  dob?: string;
  gender?: string;
  address?: string;
  guardianName?: string;
  guardianContact?: string;
  previousSchool?: string;
  notes?: string;
}

export interface PublicRegistrationPayload {
  fullName: string;
  email?: string;
  dob?: string;
  gender?: string;
  address?: string;
  guardianName?: string;
  guardianContact?: string;
  previousSchool?: string;
  notes?: string;
}

export interface CreateInviteInput {
  label?: string;
  note?: string;
  expiresInDays?: number | null;
  maxUses?: number | null;
  schoolName?: string | null;
  schoolMotto?: string | null;
}

const tokenAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const generateToken = (length = 32) => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => tokenAlphabet[byte % tokenAlphabet.length]).join('');
  }

  let token = '';
  for (let i = 0; i < length; i++) {
    token += tokenAlphabet[Math.floor(Math.random() * tokenAlphabet.length)];
  }
  return token;
};

const createUniqueInviteToken = async (schoolId: string, maxAttempts = 10): Promise<string> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const token = generateToken(32);
    const existing = await dbAdapter.getDoc(`${buildInvitePath(schoolId)}/${token}`);
    if (!existing.exists) {
      return token;
    }
  }

  throw new Error('Unable to generate a unique registration link. Please try again.');
};

const isExpiredInvite = (invite?: Partial<RegistrationInvite> | null) => {
  if (!invite?.expiresAt) return false;
  return invite.expiresAt <= Date.now();
};

const buildRequestPath = (schoolId: string) => `schools/${schoolId}/registrationRequests`;
const buildInvitePath = (schoolId: string) => `schools/${schoolId}/registrationInvites`;

const normalizeString = (value?: string | null) => (value || '').trim();

export const buildRegistrationUrl = (schoolId: string, token: string) => {
  if (typeof window === 'undefined') {
    return `/register/${encodeURIComponent(schoolId)}/${encodeURIComponent(token)}`;
  }

  return `${window.location.origin}/register/${encodeURIComponent(schoolId)}/${encodeURIComponent(token)}`;
};

export const studentRegistrationService = {
  subscribeToInvites: (schoolId: string, onUpdate: (invites: RegistrationInvite[]) => void): (() => void) => {
    return dbAdapter.subscribeToPath(buildInvitePath(schoolId), (list) => {
      const inviteList = list
        .map((item) => ({
          id: item.id,
          token: item.token || item.id,
          schoolId: item.schoolId || schoolId,
          schoolName: item.schoolName || '',
          schoolMotto: item.schoolMotto || '',
          label: item.label || 'Student Registration',
          note: item.note || '',
          status: item.status === 'revoked' ? 'revoked' : 'active',
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          createdBy: item.createdBy || null,
          expiresAt: typeof item.expiresAt === 'number' ? item.expiresAt : null,
          maxUses: typeof item.maxUses === 'number' ? item.maxUses : null,
          uses: typeof item.uses === 'number' ? item.uses : 0
        } as RegistrationInvite))
        .sort((a, b) => b.createdAt - a.createdAt);

      onUpdate(inviteList);
    });
  },

  subscribeToRequests: (schoolId: string, onUpdate: (requests: RegistrationRequest[]) => void): (() => void) => {
    return dbAdapter.subscribeToPath(buildRequestPath(schoolId), (list) => {
      const requestList = list
        .map((item) => ({
          id: item.id,
          schoolId: item.schoolId || schoolId,
          inviteToken: item.inviteToken || '',
          inviteLabel: item.inviteLabel || '',
          status: (item.status || 'pending') as RegistrationRequest['status'],
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          reviewedAt: typeof item.reviewedAt === 'number' ? item.reviewedAt : null,
          reviewedBy: item.reviewedBy || null,
          rejectionReason: item.rejectionReason || null,
          approvedStudentUid: item.approvedStudentUid || null,
          approvedStudentId: item.approvedStudentId || null,
          temporaryPassword: item.temporaryPassword || null,
          classId: item.classId || null,
          className: item.className || null,
          fullName: item.fullName || '',
          email: item.email || '',
          dob: item.dob || '',
          gender: item.gender || '',
          address: item.address || '',
          guardianName: item.guardianName || '',
          guardianContact: item.guardianContact || '',
          previousSchool: item.previousSchool || '',
          notes: item.notes || ''
        } as RegistrationRequest))
        .sort((a, b) => b.createdAt - a.createdAt);

      onUpdate(requestList);
    });
  },

  createInvite: async (schoolId: string, input: CreateInviteInput): Promise<RegistrationInvite> => {
    const token = await createUniqueInviteToken(schoolId);
    const now = Date.now();
    const createdBy = auth.currentUser?.uid || null;
    const expiresAt = input.expiresInDays && input.expiresInDays > 0
      ? now + input.expiresInDays * 24 * 60 * 60 * 1000
      : null;

    const invite: RegistrationInvite = {
      id: token,
      token,
      schoolId,
      schoolName: normalizeString(input.schoolName),
      schoolMotto: normalizeString(input.schoolMotto),
      label: normalizeString(input.label) || 'Student Registration',
      note: normalizeString(input.note),
      status: 'active',
      createdAt: now,
      createdBy,
      expiresAt,
      maxUses: typeof input.maxUses === 'number' && input.maxUses > 0 ? input.maxUses : null,
      uses: 0
    };

    await dbAdapter.setDoc(`${buildInvitePath(schoolId)}/${token}`, invite);
    return invite;
  },

  revokeInvite: async (schoolId: string, token: string): Promise<void> => {
    await dbAdapter.updateDoc(`${buildInvitePath(schoolId)}/${token}`, {
      status: 'revoked'
    });
  },

  getInvite: async (schoolId: string, token: string): Promise<RegistrationInvite | null> => {
    const res = await dbAdapter.getDoc(`${buildInvitePath(schoolId)}/${token}`);
    if (!res.exists) return null;
    const data = res.data || {};
    const invite: RegistrationInvite = {
      id: data.id || token,
      token: data.token || token,
      schoolId: data.schoolId || schoolId,
      schoolName: data.schoolName || '',
      schoolMotto: data.schoolMotto || '',
      label: data.label || 'Student Registration',
      note: data.note || '',
      status: data.status === 'revoked' ? 'revoked' : 'active',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      createdBy: data.createdBy || null,
      expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
      maxUses: typeof data.maxUses === 'number' ? data.maxUses : null,
      uses: typeof data.uses === 'number' ? data.uses : 0
    };
    return invite;
  },

  submitRegistrationRequest: async (
    schoolId: string,
    token: string,
    payload: PublicRegistrationPayload
  ): Promise<string> => {
    const invite = await studentRegistrationService.getInvite(schoolId, token);
    if (!invite) {
      throw new Error('This registration link is invalid.');
    }
    if (invite.status !== 'active') {
      throw new Error('This registration link has been revoked.');
    }
    if (isExpiredInvite(invite)) {
      throw new Error('This registration link has expired.');
    }
    const fullName = normalizeString(payload.fullName);
    if (!fullName) {
      throw new Error('Student name is required.');
    }

    const requestId = await dbAdapter.pushDoc(buildRequestPath(schoolId), {
      schoolId,
      inviteToken: token,
      inviteLabel: invite.label,
      status: 'pending',
      createdAt: Date.now(),
      fullName,
      email: normalizeString(payload.email),
      dob: normalizeString(payload.dob),
      gender: normalizeString(payload.gender),
      address: normalizeString(payload.address),
      guardianName: normalizeString(payload.guardianName),
      guardianContact: normalizeString(payload.guardianContact),
      previousSchool: normalizeString(payload.previousSchool),
      notes: normalizeString(payload.notes)
    });

    return requestId;
  },

  rejectRequest: async (schoolId: string, requestId: string, reason?: string): Promise<void> => {
    await dbAdapter.updateDoc(`${buildRequestPath(schoolId)}/${requestId}`, {
      status: 'rejected',
      reviewedAt: Date.now(),
      rejectionReason: normalizeString(reason) || 'Registration rejected'
    });
  },

  approveRequest: async (
    schoolId: string,
    request: RegistrationRequest,
    classInfo?: Pick<ClassData, 'id' | 'name'> | null
  ): Promise<{ uid: string; studentId: string; defaultPassword: string }> => {
    const studentId = normalizeString(request.approvedStudentId) || await userService.getNextStudentId(schoolId);
    const { uid, defaultPassword } = await userService.provisionUserAccount(
      request.fullName,
      request.email || '',
      'student',
      schoolId,
      studentId
    );

    await userService.updateProfileDetails(uid, {
      dob: request.dob || '',
      gender: request.gender || '',
      address: request.address || '',
      guardianName: request.guardianName || '',
      guardianContact: request.guardianContact || '',
      classId: classInfo?.id || request.classId || null
    });

    await dbAdapter.updateDoc(`${buildRequestPath(schoolId)}/${request.id}`, {
      status: 'approved',
      reviewedAt: Date.now(),
      reviewedBy: auth.currentUser?.uid || null,
      approvedStudentUid: uid,
      approvedStudentId: studentId,
      temporaryPassword: defaultPassword,
      classId: classInfo?.id || request.classId || null,
      className: classInfo?.name || request.className || null
    });

    return { uid, studentId, defaultPassword };
  }
};
