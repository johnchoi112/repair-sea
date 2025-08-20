// js/main.js
import { auth, signInAnonymously, onAuthStateChanged } from "./firebase.js";
import { addRowDoc, deleteRows, subscribeRealtime } from "./data.js";
import { renderNewRow, updateRow, removeRow, selectedRowIds, wireCheckAll, exposeFilter } from "./ui.js";
import { injectImportExportUI } from "./importExport.js";

/* ========== 모달 제어(인라인 스크립트 제거로 사라진 부분 복구) ========== */
function getEl(id) { return document.getElementById(id); }
const modal = () => getEl("registerModal");
const mOk = () => getEl("mOk");
const mCancel = () => getEl("mCancel");
const btnOpen = () => getEl("btnOpen");

function openModal() {
const md = modal();
if (!md) return;
md.style.display = "block";
md.setAttribute("aria-hidden", "false");   // ✅ 접근성: 표시 시 false
document.body.style.overflow = "hidden";

// 입력 초기화
["mReceipt","mCompany","mPartNo","mPartName","mSpec","mSymptom","mRepairer","mContact","mNote"]
.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

// 기본 접수일자 = 오늘
const today = new Date();
const p = n => String(n).padStart(2,"0");
const dstr = `${today.getFullYear()}-${p(today.getMonth()+1)}-${p(today.getDate())}`;
const rcv = document.getElementById("mReceipt");
if (rcv) rcv.value = dstr;

// 포커스 모달로 이동(접근성)
const mc = md.querySelector(".modal-content");
mc && mc.focus();
}

function closeModal() {
  const md = modal();
  if (!md) return;
  md.setAttribute("aria-hidden", "true");    // ✅ 접근성: 숨김 시 true
  md.style.display = "none";
  document.body.style.overflow = "";
}

function wireModal() {
  // 열기
  btnOpen()?.addEventListener("click", openModal);
  // 확인
  mOk()?.addEventListener("click", async () => {
    const pre = {
      receipt: getEl("mReceipt")?.value || "",
      company: getEl("mCompany")?.value || "",
      partNo: getEl("mPartNo")?.value || "",
      partName: getEl("mPartName")?.value || "",
      spec: getEl("mSpec")?.value || "",
      symptom: getEl("mSymptom")?.value || "",
      repairer: getEl("mRepairer")?.value || "",
      contact: getEl("mContact")?.value || "",
      note: getEl("mNote")?.value || ""
    };
    await addRowDoc(pre);
    closeModal();
  });
  // 취소
  mCancel()?.addEventListener("click", closeModal);
  // 배경 클릭으로 닫기
  modal()?.addEventListener("click", (e) => { if (e.target === modal()) closeModal(); });
  // ESC로 닫기
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

/* ========== 앱 시작 ========== */
async function start() {
  wireCheckAll();
  exposeFilter();
  injectImportExportUI(); // 엑셀/CSV 가져오기·내보내기 버튼 주입
  bindTopButtons();
  wireModal();            // ✅ 모달 이벤트 바인딩 추가

  await signInAnonymously(auth);
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    // 실시간 구독
    subscribeRealtime({
      onAdd: renderNewRow,
      onModify: updateRow,
      onRemove: removeRow
    });
  });
}

// DOM 로드 후 시작
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

