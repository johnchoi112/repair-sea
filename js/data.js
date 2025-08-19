// js/data.js
import {
  db, auth, serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
} from "./firebase.js";

// ⬇️ Firestore의 setDoc 은 여기서 직접 임포트(버전 고정)
//   (firebase.js를 수정하지 않아도 동작)
import { setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

/** 내부 헬퍼: 안전 업데이트 (update 실패 시 setDoc merge 재시도) */
async function safeMergeUpdate(docId, data) {
  const ref = doc(db, COL, docId);
  try {
    await updateDoc(ref, data);
  } catch (err) {
    console.warn("[safeMergeUpdate] updateDoc 실패 → setDoc merge 재시도:", err);
    await setDoc(ref, data, { merge: true });
  }
}

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
    // 메타
    photoUrl: prefill.photoUrl || "", // ✅ 상세 썸네일용
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    authorUid: (auth.currentUser && auth.currentUser.uid) || null
  };
  await addDoc(colRef, base);
}

/** 단일 필드 수정 */
export async function updateField(id, key, value) {
  try {
    await safeMergeUpdate(id, { [key]: value, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error("[updateField] 실패:", id, key, err);
    throw err;
  }
}

/** 여러 필드 동시 수정 (상세영역 닫힐 때 일괄 저장) */
export async function updateFields(id, obj = {}) {
  if (!id || !obj || typeof obj !== "object") return;
  try {
    await safeMergeUpdate(id, { ...obj, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error("[updateFields] 실패:", id, err);
    throw err;
  }
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
 *   Firebase Storage 사진 업로드 (보강판)
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

  // 1) 업로드
  const snap = await uploadBytes(storageRef, file, {
    contentType: file.type || `image/${safeExt}`
  });

  // 2) 다운로드 URL
  const url = await getDownloadURL(snap.ref);

  // 3) Firestore에 photoUrl 저장 (update 실패 시 merge setDoc)
  await safeMergeUpdate(id, { photoUrl: url, updatedAt: serverTimestamp() });

  console.log("[uploadRowPhoto] saved photoUrl:", url);

  // (선택) UI에 즉시 알림 → tr.dataset.photoUrl 등 동기화 보조
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("photo:uploaded", { detail: { id, url } }));
  }
  return url;
}
