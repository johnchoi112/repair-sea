// js/main.js
import { auth, signInAnonymously, onAuthStateChanged } from "./firebase.js";
import { addRowDoc, deleteRows, subscribeRealtime } from "./data.js";
import { renderNewRow, updateRow, removeRow, selectedRowIds, wireCheckAll, exposeFilter } from "./ui.js";
// ⚠️ 주의: importExport.js는 정적 import하지 않습니다(모바일 미로딩을 위해).

/* ========== 유틸 ========== */
function getEl(id) { return document.getElementById(id); }
const modal   = () => getEl("registerModal");
const mOk     = () => getEl("mOk");
const mCancel = () => getEl("mCancel");
const btnOpen = () => getEl("btnOpen");

/* ========== 모달 ========== */
function openModal() {
  const md = modal();
  if (!md) return;
  md.style.display = "block";
  md.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  // 입력 초기화
  ["mReceipt","mCompany","mPartNo","mPartName","mSpec","mSymptom","mRepairer","mContact","mNote"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  // 기본 접수일자 = 오늘
  const today = new Date();
  const p = n => String(n).padStart(2, "0");
  const dstr = `${today.getFullYear()}-${p(today.getMonth()+1)}-${p(today.getDate())}`;
  const rcv = document.getElementById("mReceipt");
  if (rcv) rcv.value = dstr;

  const mc = md.querySelector(".modal-content");
  mc && mc.focus();
}

function closeModal() {
  const md = modal();
  if (!md) return;
  md.setAttribute("aria-hidden", "true");
  md.style.display = "none";
  document.body.style.overflow = "";
}

function wireModal() {
  btnOpen()?.addEventListener("click", openModal);
  mOk()?.addEventListener("click", async () => {
    const pre = {
      receipt:  getEl("mReceipt")?.value || "",
      company:  getEl("mCompany")?.value || "",
      partNo:   getEl("mPartNo")?.value || "",
      partName: getEl("mPartName")?.value || "",
      spec:     getEl("mSpec")?.value || "",
      symptom:  getEl("mSymptom")?.value || "",
      repairer: getEl("mRepairer")?.value || "",
      contact:  getEl("mContact")?.value || "",
      note:     getEl("mNote")?.value || ""
    };
    await addRowDoc(pre);
    closeModal();
  });
  mCancel()?.addEventListener("click", closeModal);
  modal()?.addEventListener("click", (e) => { if (e.target === modal()) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
}

/* ========== 상단 버튼 ========== */
function bindTopButtons() {
  const btnAdd = getEl("btnAdd");
  const btnDelete = getEl("btnDelete");
  btnAdd?.addEventListener("click", () => addRowDoc({}));
  btnDelete?.addEventListener("click", async () => {
    const ids = selectedRowIds();
    if (ids.length === 0) return alert("삭제할 행을 선택하세요.");
    if (!confirm(`${ids.length}개 행을 삭제할까요?`)) return;
    await deleteRows(ids);
  });
}

/* ========== 환경 판별 (모바일이면 FAB 미로딩) ========== */
function isPhone() {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const minSide = Math.min(window.screen.width, window.screen.height);
  return coarse && minSide <= 820; // 대부분의 스마트폰 커버
}

async function maybeMountImportExportUI() {
  if (isPhone()) return; // 📱 모바일은 아예 로딩하지 않음
  try {
    const mod = await import("./importExport.js"); // 데스크톱/태블릿에서만 로드
    if (typeof mod.injectImportExportUI === "function") {
      mod.injectImportExportUI(); // 엑셀/CSV/가져오기 FAB 주입
    }
  } catch (err) {
    console.warn("[importExport] 로딩 실패:", err);
  }
}

/* ========== 앱 시작 ========== */
async function start() {
  wireCheckAll();
  exposeFilter();

  // 데스크톱/태블릿이면 FAB 표시
  await maybeMountImportExportUI();

  bindTopButtons();
  wireModal();

  await signInAnonymously(auth);
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    subscribeRealtime({
      onAdd: renderNewRow,
      onModify: updateRow,
      onRemove: removeRow,
    });
  });
}

/* ========== 부트스트랩 ========== */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
