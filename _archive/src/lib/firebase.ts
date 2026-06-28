import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA6o_GUXJM9gXRMagBLMSuqLbUFLDAH39w",
  authDomain: "gen-lang-client-0144814356.firebaseapp.com",
  projectId: "gen-lang-client-0144814356",
  storageBucket: "gen-lang-client-0144814356.firebasestorage.app",
  messagingSenderId: "762990677270",
  appId: "1:762990677270:web:2e2b09eb0c871daf1d5437"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add scope for Google APIs
googleProvider.addScope("https://www.googleapis.com/auth/gmail.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/calendar");

// Initialize Firestore with the specific database ID from the config
export const db = getFirestore(app, "ai-studio-0e625a14-b1ac-4ee9-a947-782072cf06bc");
