import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// This configuration is designed to read the Firebase keys from Vercel's 
// Environment Variables (which use the REACT_APP_ prefix).
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Firestore services
export const auth = getAuth(app);
export const db = getFirestore(app);

// NOTE: The previous hardcoded error check that incorrectly referenced "Netlify" 
// has been removed, as the keys are now correctly set in Vercel.
