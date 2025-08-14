// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  // ✅ 최신 Firestore 초기화 & 로컬 캐시
  initializeFirestore, persistentLocalCache,
  // 나머지 유틸들 (data.js 등에서 사용)
  serverTimestamp, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/** 👉 Firebase 콘솔의 구성값을 그대로 사용 */
export const firebaseConfig = {
  apiKey: "AIzaSyDu8Vndai1pzgxehi-JC2RKaGyOJpiJJXo",
  authDomain: "searepair-a8528.firebaseapp.com",
  projectId: "searepair-a8528",
  storageBucket: "searepair-a8528.firebasestorage.app",
  messagingSenderId: "274727078627",
  appId: "1:274727078627:web:6f857f5e3ce6f1ab1613d6"
};

export const app = initializeApp(firebaseConfig);

// ✅ getFirestore 대신 최신 방식 사용 (경고 없음)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export const auth = getAuth(app);

// 다른 모듈에서 편하게 쓰도록 재수출
export {
  serverTimestamp, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, signInAnonymously, onAuthStateChanged
};
