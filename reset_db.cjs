// reset_db.cjs
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getDatabase, ref, set, remove } = require('firebase/database');
const fs = require('fs');
const path = require('path');

let envPath = path.resolve(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve(__dirname, '.env');
}

console.log('Loading Firebase configuration from:', envPath);

let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  console.warn('No env file found.');
}

const keyMap = {
  API_KEY: 'apiKey',
  AUTH_DOMAIN: 'authDomain',
  DATABASE_URL: 'databaseURL',
  PROJECT_ID: 'projectId',
  STORAGE_BUCKET: 'storageBucket',
  MESSAGING_SENDER_ID: 'messagingSenderId',
  APP_ID: 'appId'
};

const config = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*VITE_FIREBASE_([A-Z_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (match) {
    const envKey = match[1];
    const targetKey = keyMap[envKey] || envKey.toLowerCase();
    config[targetKey] = match[2];
  }
});

console.log('Firebase Configuration loaded for project:', config.projectId);
console.log('Database URL:', config.databaseURL);

const app = initializeApp(config);
const auth = getAuth(app);
const db = getDatabase(app);

async function resetDatabase() {
  const tempEmail = `reset-agent-${Date.now()}@educore.io`;
  const tempPassword = `RESET-PASSWORD-2026`;

  try {
    console.log('Authenticating administrative session...');
    const credential = await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
    const uid = credential.user.uid;
    console.log('Session authenticated. UID:', uid);

    console.log('Granting temporary superadmin role to reset user profile...');
    await set(ref(db, `users/${uid}`), {
      id: uid,
      name: "System Reset Agent",
      email: tempEmail,
      role: "superadmin",
      schoolId: "system-global",
      status: "active",
      createdAt: Date.now()
    });

    console.log('Wiping Realtime Database top-level nodes...');
    const nodesToClear = ['schools', 'grades', 'attendance', 'classes', 'subjects', 'assignments', 'security_logs'];
    for (const nodeName of nodesToClear) {
      console.log(`Clearing /${nodeName}...`);
      await remove(ref(db, nodeName)).catch(e => console.warn(`Notice on clearing ${nodeName}:`, e.message));
    }

    console.log('Clearing users collection except system admin...');
    await set(ref(db, 'users'), {
      [uid]: {
        id: uid,
        name: "System Reset Agent",
        email: tempEmail,
        role: "superadmin",
        schoolId: "system-global",
        status: "active",
        createdAt: Date.now()
      }
    });

    console.log('✅ Realtime Database reset successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error wiping database:', err.message);
    process.exit(1);
  }
}

resetDatabase();
