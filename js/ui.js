// js/ui.js
import { schemaKeys, updateField, updateFields, uploadRowPhoto, addRowDoc } from "./data.js";
import { debounce } from "./utils.js";

const tbody = () => document.getElementById("tableBody");
const checkAll = () => document.getElementById("checkAll");

/* ================== 컬럼/템플릿 ================== */
export const COL_KEYS = ["_check", ...schemaKeys];

/** 실행 1회 스타일 주입 + 숨김 규칙 */
let _styleInjected = false;
function injectOnceStyles() {
  if (_styleInjected) return;
  _styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    /* 기존 숨김: [증상], [진단 결과] */
    #mainTable th:nth-child(8), #mainTable td:nth-child(8),
    #mainTable th:nth-child(9), #mainTable td:nth-child(9) { display: none !important; }

    /* 새 숨김: [특채] - data-key/col 기반으로도 보장 */
    #mainTable th[data-col="special"],
    #mainTable td[data-key="special"] { display: none !important; }

    .expand-row > td { padding: 12px 16px; background: #f8faff; border-top: 1px solid #e3eaf5; }
    .detail-wrap { min-height: 200px; }
    /* ✅ 자동 맞춤(균등 분할) 4칸 */
    .detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: start; }
    .detail-cell { background: #ffffff; border: 1px solid #e3eaf5; border-radius: 8px; padding: 10px; }
    .detail-label { display:block; font-weight:700; margin-bottom:6px; }
    .detail-text { width:100%; min-height:160px; resize:vertical; border:1px solid #ddd; border-radius:6px; padding:8px; font-size:.95rem; color:#000; }

    .photo-box { position: relative; width: 100%; height: 180px; border: 1px dashed #c7d2fe; border-radius: 8px; background: #f9fbff;
                 overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .thumb-wrap { width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; }
    .thumb { display:block; width:100%; height:100%; object-fit: cover; border-radius:6px; }
    .photo-preview { max-width:100%; max-height:100%; object-fit:contain; }
    .photo-btn { position: absolute; bottom: 10px; right: 10px; border:0; border-radius:6px; padding:8px 12px; font-weight:700; color:#fff;
                 background: linear-gradient(135deg,#2196F3,#1976D2); cursor:pointer; box-shadow: 0 4px 12px rgba(0,0,0,.15); }

    /* 클릭/편집 가이드 (기존 유지) */
    #mainTable tbody tr:not(.expand-row) td { cursor: pointer; user-select: none; }
    #mainTable tbody tr:not(.expand-row) td:first-child { cursor: default; user-select: auto; }
    #mainTable tbody tr:not(.expand-row) input,
    #mainTable tbody tr:not(.expand-row) select,
    #mainTable tbody tr:not(.expand-row) textarea,
    #mainTable tbody tr:not(.expand-row) [contenteditable] { pointer-events: none !important; }

    /* 체크박스/날짜/상태/완료일은 직접 조작 가능(기존 유지) */
    #mainTable tbody tr:not(.expand-row) .rowCheck { pointer-events: auto !important; }
    #mainTable tbody tr:not(.expand-row) td:nth-child(2) input,
    #mainTable tbody tr:not(.expand-row) td:nth-child(3) input,
    #mainTable tbody tr:not(.expand-row) td:nth-child(10) select,
    #mainTable tbody tr:not(.expand-row) td:nth-child(13) input { pointer-events: auto !important; }
    #mainTable tbody tr:not(.expand-row) td:nth-child(2),
    #mainTable tbody tr:not(.expand-row) td:nth-child(3),
    #mainTable tbody tr:not(.expand-row) td:nth-child(10),
    #mainTable tbody tr:not(.expand-row) td:nth-child(13) { cursor: default; }
  `;
  document.head.appendChild(style);
}

/** 헤더에 [특채] 숨김 열 보장(HTML 수정 없이 런타임 주입) */
function ensureHiddenSpecialHeader() {
  const headRow = document.querySelector("#mainTable thead tr");
  if (!headRow || headRow.querySelector('th[data-col="special"]')) return;
  const th = document.createElement("th");
  th.setAttribute("data-col", "special");
  th.textContent = "특채";
  headRow.appendChild(th);
}

/** 본문 행 템플릿 (마지막에 숨김 [특채] 셀 포함) */
export function createRowHTML() {
  return `
    <td><input type="checkbox" class="rowCheck" /></td>
    <td><input type="date" data-key="receiptDate"/></td>
    <td><input type="date" data-key="shipDate"/></td>
    <td data-key="company"></td>
    <td data-key="partNo"></td>
    <td data-key="partName"></td>
    <td data-key="spec"></td>
    <td data-key="symptom"></td>
    <td data-key="diagnosis"></td>
    <td>
      <select data-key="status">
        <option value="">선택</option>
        <option value="접수완료">접수완료</option>
        <option value="수리중">수리 중</option>
        <option value="무상수리완료">무상수리완료</option>
        <option value="유상수리완료">유상수리완료</option>
      </select>
    </td>
    <td data-key="repairer"></td>
    <td data-key="contact"></td>
    <td><input type="date" data-key="completeDate"/></td>
    <td data-key="cost"></td>
    <td data-key="note"></td>
    <!-- ✅ 숨김 특채 셀(값 저장/내보내기용) -->
    <td data-key="special"></td>
  `;
}

/* ================== 렌더/적용 ================== */
export function renderNewRow(doc) {
  const tr = document.createElement("tr");
  tr.dataset.id = doc.id;
  tr.innerHTML = createRowHTML();
  tr.dataset.photoUrl = doc.photoUrl || "";
  applyDataToRow(tr, doc);
  tbody().appendChild(tr);
  attachRowListeners(tr);
  wireStatusForRow(tr);
  captureOriginalOrder(tr);
}

export function applyDataToRow(tr, data) {
  Array.from(tr.cells).forEach((cell, idx) => {
    const key = COL_KEYS[idx];
    if (key === "_check") return;
    const input = cell.querySelector("input");
    const sel = cell.querySelector("select");
    const v = (data[key] ?? "").toString();
    if (input) input.value = v;
    else if (sel) sel.value = v;
    else cell.innerText = v;
  });
  tr.dataset.photoUrl = (data.photoUrl ?? "");
  wireStatusForRow(tr);
}

export function updateRow(doc) {
  const tr = tbody().querySelector(`tr[data-id="${doc.id}"]`);
  if (!tr) return;
  applyDataToRow(tr, doc);

  // 상세가 열려있다면 textarea들도 동기화
  const ex = tr.nextElementSibling;
  if (ex && ex.classList.contains("expand-row")) {
    const sInput = ex.querySelector(".detail-symptom");
    const dInput = ex.querySelector(".detail-diagnosis");
    const pInput = ex.querySelector(".detail-special"); // ✅
    if (sInput && doc.symptom != null) sInput.value = doc.symptom || "";
    if (dInput && doc.diagnosis != null) dInput.value = doc.diagnosis || "";
    if (pInput && doc.special  != null) pInput.value = doc.special  || "";

    const img = ex.querySelector(".thumb") || ex.querySelector(".photo-preview");
    if (img) {
      const url = doc.photoUrl || "";
      if (url) { img.src = url; img.style.display = "block"; }
      else { img.removeAttribute("src"); img.style.display = "none"; }
    }
  }
}

export function removeRow(id) {
  const tr = tbody().querySelector(`tr[data-id="${id}"]`);
  if (!tr) return;
  const ex = tr.nextElementSibling;
  if (ex && ex.classList.contains("expand-row")) ex.remove();
  tr.remove();
}

export function selectedRowIds() {
  return Array.from(tbody().querySelectorAll("tr"))
    .filter(tr => tr.querySelector(".rowCheck")?.checked)
    .map(tr => tr.dataset.id);
}

/* ================== 체크박스 전체선택 ================== */
export function wireCheckAll() {
  checkAll()?.addEventListener("change", () => {
    document.querySelectorAll(".rowCheck").forEach(cb => cb.checked = checkAll().checked);
  });
}

/* ================== 상세(아코디언) ================== */
let openTr = null;

function getColspan() {
  const head = document.querySelector("#mainTable thead tr");
  return head ? head.cells.length : COL_KEYS.length;
}

function buildExpandRow(tr) {
  const id = tr.dataset.id;
  const ex = document.createElement("tr");
  ex.className = "expand-row";
  const td = document.createElement("td");
  td.colSpan = getColspan();
  td.innerHTML = `
    <div class="detail-wrap">
      <div class="detail-grid">
        <!-- 사진 -->
        <div class="detail-cell">
          <span class="detail-label">사진</span>
          <div class="photo-box">
            <div class="thumb-wrap">
              <img class="thumb" style="display:${tr.dataset.photoUrl ? "block" : "none"}" src="${tr.dataset.photoUrl || ""}" alt="photo" />
            </div>
            <button class="photo-btn" type="button">업로드</button>
            <input type="file" class="photo-file" accept="image/*" style="display:none" />
          </div>
        </div>
        <!-- 증상 -->
        <div class="detail-cell">
          <label class="detail-label" for="sym-${id}">증상</label>
          <textarea id="sym-${id}" class="detail-text detail-symptom">${tr.cells[7]?.innerText || ""}</textarea>
        </div>
        <!-- 진단 결과 -->
        <div class="detail-cell">
          <label class="detail-label" for="dia-${id}">진단 결과</label>
          <textarea id="dia-${id}" class="detail-text detail-diagnosis">${tr.cells[8]?.innerText || ""}</textarea>
        </div>
        <!-- ✅ 특채 -->
        <div class="detail-cell">
          <label class="detail-label" for="sp-${id}">특채</label>
          <textarea id="sp-${id}" class="detail-text detail-special">${(tr.querySelector('td[data-key="special"]')?.innerText) || ""}</textarea>
        </div>
      </div>
    </div>
  `;
  ex.appendChild(td);

  // 사진 업로드
  const btn = td.querySelector(".photo-btn");
  const file = td.querySelector(".photo-file");
  const img = td.querySelector(".thumb");
  btn.addEventListener("click", () => file.click());
  file.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const localUrl = URL.createObjectURL(f);
    img.src = localUrl; img.style.display = "block";
    try {
      const url = await uploadRowPhoto(id, f);
      img.src = url;
    } catch (err) {
      alert("사진 업로드 실패. 다시 시도해 주세요.");
      console.error(err);
    } finally {
      URL.revokeObjectURL(localUrl);
      e.target.value = "";
    }
  });

  injectOnceStyles();
  return ex;
}

function openExpand(tr) {
  const next = tr.nextElementSibling;
  if (next && next.classList.contains("expand-row")) next.style.display = "table-row";
  else tr.insertAdjacentElement("afterend", buildExpandRow(tr));
  openTr = tr;
}

async function closeExpand(tr, { save = true } = {}) {
  const ex = tr.nextElementSibling;
  if (ex && ex.classList.contains("expand-row")) {
    if (save) {
      const sym = ex.querySelector(".detail-symptom")?.value || "";
      const dia = ex.querySelector(".detail-diagnosis")?.value || "";
      const spc = ex.querySelector(".detail-special")?.value || "";
      await updateFields(tr.dataset.id, { symptom: sym, diagnosis: dia, special: spc }); // ✅
      if (tr.cells[7])  tr.cells[7].innerText = sym;
      if (tr.cells[8])  tr.cells[8].innerText = dia;
      const spCell = tr.querySelector('td[data-key="special"]');
      if (spCell) spCell.innerText = spc;
    }
    ex.style.display = "none";
  }
  if (openTr === tr) openTr = null;
}

/* 테이블 클릭(상세 열고/닫기) - 기존 충돌 없이 유지 */
(function installRowOpenDelegation() {
  const table = document.getElementById("mainTable");
  if (!table) return;

  const NON_TOGGLE_CELLS = new Set([0, 1, 2, 9, 12]); // 체크박스/접수/발송/상태/완료일

  table.addEventListener("click", async (e) => {
    const expand = e.target.closest("tr.expand-row");
    if (expand) return;

    const tr = e.target.closest("#mainTable tbody tr");
    if (!tr) return;

    const td = e.target.closest("td");
    const cellIdx = td ? Array.from(tr.cells).indexOf(td) : -1;
    if (cellIdx >= 0 && NON_TOGGLE_CELLS.has(cellIdx)) return;

    if (openTr && openTr !== tr) {
      await closeExpand(openTr, { save: true });
    }
    const isOpen = tr.nextElementSibling?.classList.contains("expand-row") &&
                   tr.nextElementSibling?.style.display !== "none";
    if (isOpen) await closeExpand(tr, { save: true });
    else openExpand(tr);
  });
})();

/* ================== 상태 색상 클래스(기존 유지) ================== */
const STATUS_CLASS = {
  "접수완료": "row-status-received",
  "수리 중":  "row-status-repairing",
  "수리중":   "row-status-repairing",
  "무상수리완료": "row-status-free",
  "유상수리완료": "row-status-paid"
};
const STATUS_ALL = Object.values(STATUS_CLASS);
function applyStatusClass(row, value) {
  row.classList.remove(...STATUS_ALL);
  const cls = STATUS_CLASS[(value || "").trim()];
  if (cls) row.classList.add(cls);
}
function wireStatusForRow(row) {
  const sel = row && row.querySelector('select[data-key="status"]');
  if (!sel || sel._statusWired) return;
  sel._statusWired = true;
  applyStatusClass(row, sel.value);
  sel.addEventListener("change", () => applyStatusClass(row, sel.value));
}

/* ================== 정렬/필터/모달 등 기존 보일러 유지 ================== */
const sortStates = { receiptDate: 1, shipDate: 1, completeDate: 1 }; // 1:ASC, -1:DESC
let sortedActive = false;
const originalOrder = []; // [{tr, ex}]
const idSet = new Set();

function captureOriginalOrder(tr) {
  if (!tr || tr.classList.contains("expand-row")) return;
  const id = tr.dataset?.id;
  if (!id || idSet.has(id)) return;
  idSet.add(id);
  const ex = tr.nextElementSibling?.classList.contains("expand-row") ? tr.nextElementSibling : null;
  originalOrder.push({ tr, ex });
}
function observeForOrder() {
  const tb = tbody();
  if (!tb) return;
  tb.querySelectorAll("tr").forEach(captureOriginalOrder);
  new MutationObserver(muts => {
    if (sortedActive) return;
    muts.forEach(m => {
      m.addedNodes.forEach(n => { if (n.nodeType===1 && n.tagName==='TR') captureOriginalOrder(n); });
      m.removedNodes.forEach(n => {
        if (n.nodeType===1 && n.tagName==='TR'){
          const idx = originalOrder.findIndex(x => x.tr === n);
          if (idx >= 0){ originalOrder.splice(idx,1); idSet.delete(n.dataset?.id); }
        }
      });
    });
  }).observe(tb, { childList: true });
}
function resetSortLabels() {
  const tools = document.getElementById("sortTools");
  tools?.querySelectorAll("button.chip").forEach(b => {
    if (b.dataset.field) b.textContent = (b.textContent.replace(/[↑↓]/g,'').trim()) + '↑↓';
    b.classList.remove("active");
  });
}
function getDateValue(tr, field) {
  const input = tr.querySelector(`input[data-key="${field}"]`);
  return input?.value || "";
}
function applySort(field) {
  const tools = document.getElementById("sortTools");
  const tb = tbody();
  if (!tools || !tb) return;

  const order = sortStates[field] = -sortStates[field];
  const rows = Array.from(tb.querySelectorAll("tr")).filter(tr => !tr.classList.contains("expand-row"));

  resetSortLabels();
  const btn = tools.querySelector(`button[data-field="${field}"]`);
  if (btn) {
    const base = btn.textContent.replace(/[↑↓]/g,'').trim();
    btn.textContent = base + (order > 0 ? "↑" : "↓");
    btn.classList.add("active");
  }

  rows.sort((a,b) => order * getDateValue(a, field).localeCompare(getDateValue(b, field)));
  rows.forEach(tr => {
    const ex = tr.nextElementSibling?.classList.contains("expand-row") ? tr.nextElementSibling : null;
    tb.appendChild(tr); if (ex) tb.appendChild(ex);
  });
  sortedActive = true;
}
function resetSort() {
  const tb = tbody(); if (!tb) return;
  originalOrder.forEach(({ tr, ex }) => {
    if (document.body.contains(tr)) tb.appendChild(tr);
    if (ex && document.body.contains(ex)) tb.appendChild(ex);
  });
  resetSortLabels(); sortedActive = false;
}
export function exposeFilter() {
  window.filterTable = (colIndex, term) => {
    const rows = tbody().querySelectorAll("tr");
    const q = (term || "").toLowerCase();
    rows.forEach(r => {
      if (r.classList.contains("expand-row")) return;
      const cell = r.cells[colIndex];
      const text = cell ? (cell.innerText || cell.textContent || "").toLowerCase() : "";
      r.style.display = text.indexOf(q) > -1 ? "" : "none";
      const ex = r.nextElementSibling;
      if (ex && ex.classList.contains("expand-row")) ex.style.display = r.style.display;
    });
  };
}
function wireSortTools() {
  observeForOrder();
  const tools = document.getElementById("sortTools");
  if (!tools) return;
  tools.addEventListener("click", (e) => {
    const btn = e.target.closest("button.chip"); if (!btn) return;
    if (btn.hasAttribute("data-reset")) return resetSort();
    const field = btn.getAttribute("data-field"); if (field) applySort(field);
  });
}

/* 모달: 기존 입력값을 기반으로 새 행 생성 */
function openModal() {
  const md = document.getElementById("registerModal");
  if (!md) return;
  md.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  document.getElementById("mOk")?.addEventListener("click", async () => {
    const pre = {
      receipt:  document.getElementById("mReceipt")?.value || "",
      company:  document.getElementById("mCompany")?.value || "",
      partNo:   document.getElementById("mPartNo")?.value || "",
      partName: document.getElementById("mPartName")?.value || "",
      spec:     document.getElementById("mSpec")?.value || "",
      symptom:  document.getElementById("mSymptom")?.value || "",
      repairer: document.getElementById("mRepairer")?.value || "",
      contact:  document.getElementById("mContact")?.value || "",
      note:     document.getElementById("mNote")?.value || ""
    };
    await addRowDoc(pre);
    closeModal();
  }, { once: true });
}
function closeModal() {
  const md = document.getElementById("registerModal");
  if (!md) return;
  md.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
function wireModal() {
  document.getElementById("btnOpen")?.addEventListener("click", openModal);
  document.getElementById("mCancel")?.addEventListener("click", closeModal);
  const md = document.getElementById("registerModal");
  md?.addEventListener("click", (e) => { if (e.target === md) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
}

/* ================== Import/Export FAB (기존 유지) ================== */
export function createImportExportFab(exportXLSX, handleImportFile) {
  if (document.getElementById("ieFab")) return;

  const fab = document.createElement("div");
  fab.id = "ieFab";
  fab.innerHTML = `
    <style>
      #ieFab { position: fixed; right: 18px; bottom: 18px; z-index: 1000; display:flex; gap:8px; }
      #ieFab .btn { border:0; border-radius:28px; padding:12px 16px; color:#fff; font-weight:800; cursor:pointer;
                    box-shadow: 0 6px 18px rgba(0,0,0,.18); }
      #btnExport { background: linear-gradient(135deg,#4caf50,#2e8b57); }
      #btnImport { background: linear-gradient(135deg,#ff9800,#f57c00); }
      #ieHiddenInput { display:none; }
    </style>
    <button class="btn" id="btnExport">엑셀 내보내기</button>
    <button class="btn" id="btnImport">가져오기</button>
    <input type="file" id="ieHiddenInput" accept=".xlsx,xls,csv" />
  `;
  document.body.appendChild(fab);

  document.getElementById("btnExport").addEventListener("click", () => exportXLSX());
  document.getElementById("btnImport").addEventListener("click", () =>
    document.getElementById("ieHiddenInput").click()
  );
  document.getElementById("ieHiddenInput").addEventListener("change", handleImportFile);
}

/* ================== 초기화 합본 ================== */
export function setupUI() {
  injectOnceStyles();
  ensureHiddenSpecialHeader(); // ✅ 헤더에 숨김 [특채] 보장

  wireCheckAll();
  exposeFilter();
  wireSortTools();
  wireModal();

  tbody()?.querySelectorAll("tr").forEach(wireStatusForRow);
  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && n.tagName === "TR") wireStatusForRow(n);
    }));
  }).observe(tbody(), { childList: true });

  // 테이블 밖 클릭 시 열림 닫기 + 저장
  document.addEventListener("click", async (e) => {
    if (!openTr) return;
    const mainTable = document.getElementById("mainTable");
    if (mainTable && mainTable.contains(e.target)) return;
    await closeExpand(openTr, { save: true });
  });
}
