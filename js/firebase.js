// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/** 👉 여기는 ‘프로젝트 설정의 firebaseConfig’로 교체하세요 */
export const firebaseConfig = {
  apiKey: "AIzaSyDu8Vndai1pzgxehi-JC2RKaGyOJpiJJXo",
  authDomain: "searepair-a8528.firebaseapp.com",
  projectId: "searepair-a8528",
  storageBucket: "searepair-a8528.firebasestorage.app",
  messagingSenderId: "274727078627",
  appId: "1:274727078627:web:6f857f5e3ce6f1ab1613d6"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
enableIndexedDbPersistence(db).catch(() => {});

export {
  // re-export for convenience
  serverTimestamp, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, signInAnonymously, onAuthStateChanged
};

