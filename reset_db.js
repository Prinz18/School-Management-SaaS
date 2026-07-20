// reset_db.js
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getDatabase, ref, set } = require('firebase/database');
const fs = require('fs');
const path = require('path');

// Load env variables
const envPath = path.resolve(__dirname, '.env.local');
console.log('Loading configuration from:', envPath);

let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  console.error('Failed to read .env.local file. Make sure the path is correct.', err);
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
const db = getDatabase(app);

async function resetDatabase() {
  const tempEmail = `reset-agent-${Date.now()}@educore.io`;
  const tempPassword = `RESET-PASSWORD-2026`;

  try {
    console.log('Authenticating administrative session...');
    const credential = await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
    console.log('Session authenticated. UID:', credential.user.uid);

    console.log('Clearing the entire Realtime Database at the root node...');
    const rootRef = ref(db, '/');
    await set(rootRef, null);
    console.log('Database wiped successfully!');
    
    process.exit(0);
  } catch (err) {
    console.error('Error wiping database:', err);
    process.exit(1);
  }
}

resetDatabase();
