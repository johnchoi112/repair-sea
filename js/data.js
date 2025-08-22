// js/data.js
import {
  db, auth, serverTimestamp,
  collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs,
  signInAnonymously
} from "./firebase.js";
import { setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { app } from "./firebase.js";

const COL = "seaRows";
const colRef = collection(db, COL);

/** 테이블/엑셀 공통 스키마 순서 */
export const schemaKeys = [
  "receiptDate","shipDate","company","partNo","partName","spec",
  "symptom","diagnosis","status","repairer","contact",
  "completeDate","cost","note",
  // ✅ 특채(추가)
  "special"
];

/* ------------ 인증 보장 ------------ */
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

/* update 실패 시 setDoc merge로 재시도 */
async function safeMergeUpdate(docId, data) {
  const refDoc = doc(db, COL, docId);
  try {
    await updateDoc(refDoc, data);
  } catch (err) {
    console.warn("[safeMergeUpdate] updateDoc 실패 → setDoc(merge) 재시도:", err);
    await setDoc(refDoc, data, { merge: true });
  }
}

/* ------------ CRUD ------------ */
export async function addRowDoc(prefill = {}) {
  await ensureAuth();
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
    // ✅ 새 필드 기본값
    special: prefill.special || "",
    // 메타
    photoUrl: prefill.photoUrl || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    authorUid: auth.currentUser?.uid || null
  };
  await addDoc(colRef, base);
}

export async function updateField(id, key, value) {
  await ensureAuth();
  await safeMergeUpdate(id, { [key]: value, updatedAt: serverTimestamp() });
}

export async function updateFields(id, obj = {}) {
  await ensureAuth();
  await safeMergeUpdate(id, { ...obj, updatedAt: serverTimestamp() });
}

export async function deleteRows(ids = []) {
  await ensureAuth();
  await Promise.all(ids.map(id => deleteDoc(doc(db, COL, id))));
}

/* ------------ 실시간 구독 / 조회 ------------ */
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

/* ================== 사진 업로드(<=1MB 트랜스폼) ================== */
/**
 * 이미지 파일을 캔버스로 재인코딩하며 1MB 이하로 압축한다.
 * - 우선 jpeg(webp 미사용)로 0.92 품질부터 시작
 * - 용량이 크면 품질을 낮추고(최소 0.5), 그래도 크면 해상도 0.85배씩 축소
 */
async function compressToUnder1MB(file, maxBytes = 1_000_000) {
  if (!(file instanceof Blob)) throw new Error("compressToUnder1MB: invalid file");
  if (file.size <= maxBytes) return { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase() };

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });

  let w = img.naturalWidth || img.width || 0;
  let h = img.naturalHeight || img.height || 0;
  if (!w || !h) throw new Error("이미지 크기를 가져올 수 없습니다.");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  let quality = 0.92;
  let blob;

  for (let step = 0; step < 10; step++) {
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    blob = await new Promise(resolve => canvas.toBlob(b => resolve(b), "image/jpeg", quality));
    if (!blob) throw new Error("이미지 인코딩 실패");

    if (blob.size <= maxBytes) break;

    // 1) 품질 조정  2) 여전히 크면 해상도 축소
    if (quality > 0.5) quality -= 0.1;
    else { w *= 0.85; h *= 0.85; }
  }

  URL.revokeObjectURL(img.src);
  return { blob, ext: "jpg" };
}

/**
 * 사진 업로드: 로컬에서 1MB 이하로 압축 후 Storage에 업로드하고, photoUrl을 업데이트
 */
export async function uploadRowPhoto(id, file) {
  if (!id || !file) throw new Error("uploadRowPhoto: invalid args");
  await ensureAuth();

  const storage = getStorage(app);
  // 1MB 이하로 트랜스폼
  const { blob, ext } = await compressToUnder1MB(file, 1_000_000);

  const safeExt = ["jpg","jpeg","png","webp","gif","avif"].includes(ext) ? ext : "jpg";
  const path = `seaRows/${id}/photo_${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);

  const snap = await uploadBytes(storageRef, blob, {
    contentType: `image/${safeExt === "jpg" ? "jpeg" : safeExt}`
  });
  const url = await getDownloadURL(snap.ref);

  await safeMergeUpdate(id, { photoUrl: url, updatedAt: serverTimestamp() });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("photo:uploaded", { detail: { id, url } }));
  }
  return url;
}

/**
 * 사진 삭제: Storage의 파일을 삭제하고 문서 photoUrl을 공란으로 업데이트
 * @param {string} id  문서 ID
 * @param {string} url 삭제할 파일의 다운로드 URL(없으면 즉시 문서만 비움)
 */
export async function deleteRowPhoto(id, url) {
  await ensureAuth();
  try {
    if (url) {
      const storage = getStorage(app);
      const fileRef = ref(storage, url); // https URL로도 ref 생성 가능
      await deleteObject(fileRef);
    }
  } catch (err) {
    console.warn("[deleteRowPhoto] Storage 파일 삭제 실패(무시 가능):", err);
  } finally {
    await safeMergeUpdate(id, { photoUrl: "", updatedAt: serverTimestamp() });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("photo:deleted", { detail: { id } }));
    }
  }
}
