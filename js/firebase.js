// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ⚠️ storageBucket을 반드시 appspot.com으로!
export const firebaseConfig = {
  apiKey: "당신의_API_KEY",
  authDomain: "searepair-a8528.firebaseapp.com",
  projectId: "searepair-a8528",
  storageBucket: "searepair-a8528.appspot.com",   // ✅ 교정
  messagingSenderId: "당신의_SENDER_ID",
  appId: "당신의_APP_ID"
};

export const app = initializeApp(firebaseConfig);

// Firestore / Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
signInAnonymously(auth).catch(console.error);

// Storage (버킷을 명시적으로 지정하여 오타 여지 제거)
export const storage = getStorage(app, "gs://searepair-a8528.appspot.com");

// 다른 모듈에서 편하게 쓰도록 내보내기
export {
  serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
};
