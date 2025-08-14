// js/main.js
import { auth, signInAnonymously, onAuthStateChanged } from "./firebase.js";
import { addRowDoc, deleteRows, subscribeRealtime } from "./data.js";
import { renderNewRow, updateRow, removeRow, selectedRowIds, wireCheckAll, exposeFilter } from "./ui.js";
import { injectImportExportUI } from "./importExport.js";

function bindButtons() {
  const btnAdd = document.getElementById("btnAdd");
  const btnDelete = document.getElementById("btnDelete");
  const btnOpen = document.getElementById("btnOpen"); // 기존 등록 모달(이미 HTML에 있음)

  btnAdd?.addEventListener("click", () => addRowDoc({}));
  btnDelete?.addEventListener("click", async () => {
    const ids = selectedRowIds();
    if (ids.length === 0) return alert("삭제할 행을 선택하세요.");
    if (!confirm(`${ids.length}개 행을 삭제할까요?`)) return;
    await deleteRows(ids);
  });
  // btnOpen은 기존 모달 로직을 그대로 사용 (HTML에 이미 연결)
}

async function start() {
  wireCheckAll();
  exposeFilter();
  injectImportExportUI();     // 👉 엑셀/CSV 가져오기·내보내기 버튼 + 파일 입력 자동 주입
  bindButtons();

  await signInAnonymously(auth);
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    // 실시간 구독 시작
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
