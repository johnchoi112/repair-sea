// js/main.js
import { auth, signInAnonymously, onAuthStateChanged } from "./firebase.js";
import { addRowDoc, deleteRows, subscribeRealtime } from "./data.js";
import { renderNewRow, updateRow, removeRow, selectedRowIds, setupUI } from "./ui.js";
// importExport.js는 데스크톱만 지연 로드

function getEl(id) { return document.getElementById(id); }

/* 상단 버튼 */
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

/* 모바일 여부(가져오기/내보내기 UI 차단) */
function isPhone() {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const minSide = Math.min(window.screen.width, window.screen.height);
  return coarse && minSide <= 820;
}
async function maybeMountImportExportUI() {
  if (isPhone()) return;
  try {
    const mod = await import("./importExport.js");
    if (typeof mod.injectImportExportUI === "function") mod.injectImportExportUI();
  } catch (err) {
    console.warn("[importExport] 로딩 실패:", err);
  }
}

/* 앱 시작 */
async function start() {
  // 모든 UI 초기화는 ui.js에서
  setupUI();
  await maybeMountImportExportUI();

  bindTopButtons();

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

/* 부트스트랩 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
