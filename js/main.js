// js/main.js
import { auth, signInAnonymously, onAuthStateChanged } from "./firebase.js";
import { addRowDoc, deleteRows, subscribeRealtime } from "./data.js";
import {
  renderNewRow, updateRow, removeRow,
  selectedRowIds, setupUI, createImportExportFab
} from "./ui.js";

// 데스크톱에서만 Import/Export 기능 로드
function isPhone() {
  const coarse = matchMedia("(pointer: coarse)").matches;
  const minSide = Math.min(window.screen.width, window.screen.height);
  return coarse && minSide <= 820;
}
async function maybeMountImportExportUI() {
  if (isPhone()) return;
  try {
    const mod = await import("./importExport.js");
    // UI는 ui.js에서 생성, 기능만 주입
    createImportExportFab(mod.exportXLSX, mod.handleImportFile);
  } catch (err) {
    console.warn("[importExport] 로딩 실패:", err);
  }
}

/* 상단 버튼 */
function bindTopButtons() {
  const btnAdd = document.getElementById("btnAdd");
  const btnDelete = document.getElementById("btnDelete");
  btnAdd?.addEventListener("click", () => addRowDoc({}));
  btnDelete?.addEventListener("click", async () => {
    const ids = selectedRowIds();
    if (!ids.length) return alert("삭제할 행을 선택하세요.");
    if (!confirm(`${ids.length}개 행을 삭제할까요?`)) return;
    await deleteRows(ids);
  });
}

async function start() {
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
