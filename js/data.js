// js/data.js
import {
  db, auth, serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
} from "./firebase.js";

// ✅ Firebase Storage는 이 파일에서 직접 임포트 (firebase.js는 그대로)
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

/** 신규 행 추가 (모달 값 프리필 반영) */
export async function addRowDoc(prefill = {}) {
  const base = {
    receiptDate: prefill.receipt || "",
    shipDate: "",
    company: prefill.company || "",
    partNo: prefill.partNo || "",
    partName: prefill.partName || "",
    spec: prefill.spec || "",
    symptom: prefill.symptom || "",   // ✅ 모달의 증상 값 반영
    diagnosis: "",
    status: "",
    repairer: prefill.repairer || "",
    contact: prefill.contact || "",
    completeDate: "",
    cost: "",
    note: prefill.note || "",
    // 추가 메타
    photoUrl: prefill.photoUrl || "", // ✅ 사진 URL 필드(표에는 숨김, 상세영역에서 사용)
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    authorUid: (auth.currentUser && auth.currentUser.uid) || null
  };
  await addDoc(colRef, base);
}

/** 단일 필드 수정 */
export async function updateField(id, key, value) {
  await updateDoc(doc(db, COL, id), { [key]: value, updatedAt: serverTimestamp() });
}

/** 여러 필드 동시 수정 (상세영역 닫힐 때 일괄 저장) */
export async function updateFields(id, obj = {}) {
  if (!id || !obj || typeof obj !== "object") return;
  await updateDoc(doc(db, COL, id), { ...obj, updatedAt: serverTimestamp() });
}

export async function deleteRows(ids = []) {
  await Promise.all(ids.map(id => deleteDoc(doc(db, COL, id))));
}

/** 실시간 구독 */
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

/** 모든 행 가져오기 (엑셀/CSV 내보내기용) */
export async function fetchAllRows() {
  const qy = query(colRef, orderBy("createdAt", "asc"));
  const ss = await getDocs(qy);
  return ss.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =======================
 *   Firebase Storage 사진 업로드
 * ======================= */
/**
 * 지정 문서에 사진 파일 업로드 후 photoUrl 업데이트
 * @param {string} id - 문서 ID
 * @param {File} file - 이미지 파일
 * @returns {Promise<string>} - 다운로드 URL
 */
export async function uploadRowPhoto(id, file) {
  if (!id || !file) throw new Error("uploadRowPhoto: invalid args");
  const storage = getStorage(app);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg","jpeg","png","webp","gif","avif"].includes(ext) ? ext : "jpg";
  const path = `seaRows/${id}/photo_${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  // 업로드
  const snap = await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`
  });

  // URL
  const url = await getDownloadURL(snap.ref);

  // 문서 업데이트
  await updateDoc(doc(db, COL, id), {
    photoUrl: url,
    updatedAt: serverTimestamp()
  });

  return url;
}
