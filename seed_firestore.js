// seed_firestore.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '.env.local');
console.log('Loading configuration from:', envPath);

let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  console.error('Failed to read .env.local file.', err);
  process.exit(1);
}

const config = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*VITE_FIREBASE_([A-Z_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (match) {
    const key = match[1].toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    config[key] = match[2];
  }
});

console.log('Firebase Configuration loaded.');

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

async function seedFirestore() {
  const tempEmail = `temp-admin-${Date.now()}@educore.io`;
  const tempPassword = `TEMP-ADMIN-PASSWORD-2026`;

  try {
    console.log(`1. Creating temporary administrator Auth account: ${tempEmail}...`);
    const credential = await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
    const uid = credential.user.uid;
    console.log(`Auth account created successfully. UID: ${uid}`);

    console.log(`2. Creating superadmin user profile in Firestore...`);
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      id: uid,
      name: "Temporary Setup Agent",
      email: tempEmail,
      role: "superadmin",
      schoolId: "system-global",
      status: "active",
      createdAt: new Date().toISOString()
    });
    console.log(`Superadmin user profile written successfully!`);

    // Wait a brief moment to ensure Firestore indexes/caches have caught up
    console.log("Waiting 2 seconds for security rule context to propagate...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`3. Seeding "dragons" school node into Firestore...`);
    const slug = 'dragons';
    const name = 'Dragon Academy';
    const schoolRef = doc(db, 'schools', slug);

    const schoolData = {
      id: slug,
      schoolId: slug,
      name,
      address: '123 Fire Street, Monrovia, Liberia',
      motto: 'Strength through Knowledge',
      createdAt: new Date().getTime(),
      status: 'active',
      reportConfig: {
        officialName: name,
        primaryColor: '#bf212f',
        secondaryColor: '#00205b',
        principalTitle: 'Principal of School',
        teacherTitle: 'Class Teacher / Registrar',
        customFooter: 'The Love of Liberty Brought Us Here',
        templateType: 'official',
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
        customFields: [
          { label: 'Conduct', value: 'Excellent' },
          { label: 'Academic Year', value: '2025/2026' }
        ]
      }
    };

    await setDoc(schoolRef, schoolData);
    console.log('School node seeded successfully!');

    console.log(`4. Cleaning up temporary superadmin user profile from Firestore...`);
    await deleteDoc(userRef);
    console.log('Profile cleaned up successfully.');

    console.log(`5. Deleting temporary Auth user account...`);
    await deleteUser(credential.user);
    console.log('Auth user cleaned up successfully.');

    console.log('Database cleared and seeded with a pretty structured school node!');
    process.exit(0);
  } catch (err) {
    console.error('Error during setup operation:', err);
    process.exit(1);
  }
}

seedFirestore();
