import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB49y4XGysQt90W3bZajC6IPgICrHEed9E",
    authDomain: "eaglelifting-2cdab.firebaseapp.com",
    projectId: "eaglelifting-2cdab",
    storageBucket: "eaglelifting-2cdab.firebasestorage.app",
    messagingSenderId: "266085421722",
    appId: "1:266085421722:web:aa3f04cd54f5161f658523",
    measurementId: "G-N9QFEELGHR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);