// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged      // ⬅️ onAuthStateChanged 함께 export
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// 콘솔의 "웹 앱 구성" 기준 + 올바른 버킷명(appspot.com)
export const firebaseConfig = {
  apiKey: "AIzaSyDu8Vndai1pzgxehi-JC2RKaGyOJpiJJXo",
  authDomain: "searepair-a8528.firebaseapp.com",
  projectId: "searepair-a8528",
  storageBucket: "searepair-a8528.firebasestorage.app",
  messagingSenderId: "274727078627",
  appId: "1:274727078627:web:6f857f5e3ce6f1ab1613d6"
};

export const app = initializeApp(firebaseConfig);

// Firestore / Auth / Storage
export const db = getFirestore(app);
export const auth = getAuth(app);

// 필요 시 Storage를 직접 쓰려면 다음 export도 사용 가능
export const storage = getStorage(app, "gs://searepair-a8528.appspot.com");

// 다른 모듈에서 바로 쓸 수 있도록 재수출
export {
  // Firestore 유틸
  serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs,
  // Auth 유틸 (main.js에서 import)
  signInAnonymously, onAuthStateChanged
};

