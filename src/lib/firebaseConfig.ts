import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyForLocalDevelopment123456",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-school-saas.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://smart-school-saas.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-school-saas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-school-saas.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:demo1234567890"
};

// Check if any env variables are missing and log a helpful dev warning
const missingEnvKeys = Object.entries({
  API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID
}).filter(([_, value]) => !value);

if (missingEnvKeys.length > 0) {
  console.warn(`[Firebase] Running with fallback config. Missing env vars: ${missingEnvKeys.map(([k]) => `VITE_FIREBASE_${k}`).join(', ')}`);
}

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { app, auth, db, rtdb, storage, functions };
