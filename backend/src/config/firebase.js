const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

let firebaseApp = null;
let messaging = null;

try {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
    messaging = admin.messaging();
  }
} catch (error) {
  console.warn('Firebase initialization skipped:', error.message);
}

module.exports = {
  firebaseApp,
  messaging
};
