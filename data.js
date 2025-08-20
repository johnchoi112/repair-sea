// js/data.js
import {
  db, auth, serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs,
  // ✅ firebase.js에서 export한 익명 로그인
  signInAnonymously
} from "./firebase.js";

// Firestore setDoc (merge용)
import { setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Storage SDK
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { app } from "./firebase.js";

const COL = "seaRows";
const colRef = collection(db, COL);

export const schemaKeys = [
  "receiptDate","shipDate","company","partNo","partName","spec",
  "symptom","diagnosis","status","repairer","contact",
  "completeDate","cost","note"
];

/* ---------------------------
 * 공통: 쓰기 전에 인증 보장
 * --------------------------- */
async function ensureAuth() {
  try {
    if (!auth.currentUser) {
      const cred = await signInAnonymously(auth);
      console.log("[auth] signed in anonymously:", cred.user?.uid);
    }
    return auth.currentUser?.uid || null;
  } catch (err) {
    console.error("[ensureAuth] anonymous sign-in failed:", err);
    throw err;
  }
}

/* ---------------------------
 * 안전 업데이트 (update 실패 시 setDoc merge)
 * --------------------------- */
async function safeMergeUpdate(docId, data) {
  const refDoc = doc(db, COL, docId);
  try {
    await updateDoc(refDoc, data);
  } catch (err) {
    console.warn("[safeMergeUpdate] updateDoc 실패 → setDoc(merge) 재시도:", err);
    await setDoc(refDoc, data, { merge: true });
  }
}

/* ---------------------------
 * CRUD
 * --------------------------- */
export async function addRowDoc(prefill = {}) {
  await ensureAuth(); // ✅ 인증 보장

  const base = {
    receiptDate: prefill.receipt || "",
    shipDate: "",
    company: prefill.company || "",
    partNo: prefill.partNo || "",
    partName: prefill.partName || "",
    spec: prefill.spec || "",
    symptom: prefill.symptom || "",
    diagnosis: "",
    status: "",
    repairer: prefill.repairer || "",
    contact: prefill.contact || "",
    completeDate: "",
    cost: "",
    note: prefill.note || "",
    // 메타
    photoUrl: prefill.photoUrl || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    authorUid: auth.currentUser?.uid || null
  };
  await addDoc(colRef, base);
}

export async function updateField(id, key, value) {
  await ensureAuth(); // ✅ 인증 보장
  try {
    await safeMergeUpdate(id, { [key]: value, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error("[updateField] 실패:", id, key, err);
    throw err;
  }
}

export async function updateFields(id, obj = {}) {
  await ensureAuth(); // ✅ 인증 보장
  if (!id || !obj || typeof obj !== "object") return;
  try {
    await safeMergeUpdate(id, { ...obj, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error("[updateFields] 실패:", id, err);
    throw err;
  }
}

export async function deleteRows(ids = []) {
  await ensureAuth(); // ✅ 인증 보장
  await Promise.all(ids.map(id => deleteDoc(doc(db, COL, id))));
}

/* ---------------------------
 * 실시간 구독 / 전체 조회
 * --------------------------- */
export function subscribeRealtime(handlers) {
  const qy = query(colRef, orderBy("createdAt", "asc"));
  return onSnapshot(qy, snap => {
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id;
      const data = { id, ...ch.doc.data() };
      if (ch.type === "added") handlers.onAdd?.(data);
      else if (ch.type === "modified") handlers.onModify?.(data);
      else if (ch.type === "removed") handlers.onRemove?.(id);
    });
  });
}

export async function fetchAllRows() {
  const qy = query(colRef, orderBy("createdAt", "asc"));
  const ss = await getDocs(qy);
  return ss.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ---------------------------
 * Storage 사진 업로드 (보강판)
 * --------------------------- */
/**
 * 지정 문서에 사진 파일 업로드 후 photoUrl 업데이트
 * @param {string} id - 문서 ID
 * @param {File} file - 이미지 파일
 * @returns {Promise<string>} - 다운로드 URL
 */
export async function uploadRowPhoto(id, file) {
  if (!id || !file) throw new Error("uploadRowPhoto: invalid args");

  // ✅ 업로드 전에 인증 필수 (Storage 규칙 allow write: if request.auth != null;)
  await ensureAuth();

  const storage = getStorage(app); // 기본 버킷(firebasestorage.app) 사용
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg","jpeg","png","webp","gif","avif"].includes(ext) ? ext : "jpg";
  const path = `seaRows/${id}/photo_${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  // 1) 업로드
  const snap = await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`
  });

  // 2) 다운로드 URL
  const url = await getDownloadURL(snap.ref);

  // 3) Firestore에 photoUrl 저장 (update 실패 시 setDoc merge)
  await safeMergeUpdate(id, { photoUrl: url, updatedAt: serverTimestamp() });

  console.log("[uploadRowPhoto] saved photoUrl:", url);

  // (선택) UI 동기화를 위한 이벤트
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("photo:uploaded", { detail: { id, url } }));
  }
  return url;
}
