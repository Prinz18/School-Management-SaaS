/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Initialize the admin SDK
admin.initializeApp();

// Admin initialized successfully.

/**
 * Sets a custom user claim (role) for a given user.
 * This function can only be called by an authenticated user who is already a 'superadmin'.
 */
export const setUserRole = onCall(async (request) => {
  // 1. Authentication & Authorization Check
  if (!request.auth) {
    logger.error("setUserRole", "Request is not authenticated.");
    throw new HttpsError("unauthenticated", "You must be logged in to call this function.");
  }

  // Check if the caller is a superadmin
  if (request.auth.token.role !== 'superadmin') {
    logger.error("setUserRole", `Caller ${request.auth.uid} is not a superadmin.`);
    throw new HttpsError("permission-denied", "You do not have permission to set user roles.");
  }

  // 2. Input Validation
  const { email, role } = request.data;
  if (typeof email !== 'string' || typeof role !== 'string') {
    throw new HttpsError("invalid-argument", "The function must be called with 'email' and 'role' arguments.");
  }

  try {
    // 3. Get the user by email
    const user = await admin.auth().getUserByEmail(email);

    // 4. Set the custom claim
    await admin.auth().setCustomUserClaims(user.uid, { role: role });

    // 5. Log and return success
    logger.info(`Successfully set role '${role}' for user ${email} (${user.uid})`);
    return {
      message: `Success! ${email} has been made a ${role}.`,
    };
  } catch (error) {
    logger.error("setUserRole", "Error setting user role:", error);
    throw new HttpsError("internal", "An error occurred while setting the user role.");
  }
});

/**
 * Registers a new school administrator.
 * Creates an Auth user and a record in Cloud Firestore.
 */
export const registerSchoolAdmin = onCall(async (request) => {
  // 1. Authorization Check (Only SuperAdmins)
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  
  // Verify the caller is a superadmin
  const callerUid = request.auth.uid;
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  const callerData = callerDoc.data();
  
  if (!callerDoc.exists || !callerData || callerData.role !== 'superadmin') {
    throw new HttpsError("permission-denied", "Only Super Admins can register new administrators.");
  }

  // 2. Input Validation
  const { email, password, name, schoolId } = request.data;
  if (!email || !password || !name) {
    throw new HttpsError("invalid-argument", "Email, password, and name are required.");
  }

  try {
    // 3. Create Firebase Auth User
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // 4. Set Custom Claims (Role)
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'schooladmin' });

    // 5. Create Database Profile
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      name,
      email: email.toLowerCase(),
      role: 'schooladmin',
      schoolId: schoolId || null,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Successfully registered school admin: ${email} (${userRecord.uid})`);
    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    logger.error("registerSchoolAdmin", error);
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError("already-exists", "The email address is already in use.");
    }
    throw new HttpsError("internal", error.message || "Failed to register administrator.");
  }
});
