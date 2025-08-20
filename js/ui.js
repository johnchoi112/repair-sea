// js/ui.js
import { schemaKeys, updateField, updateFields, uploadRowPhoto } from "./data.js";
import { debounce } from "./utils.js";

const tbody = () => document.getElementById("tableBody");
const checkAll = () => document.getElementById("checkAll");

// 내부 컬럼 키 배열 (행 렌더링용)
const COL_KEYS = ["_check", ...schemaKeys];
// 0:체크, 1:접수일자, 2:발송일자, 3:거래처, 4:품번, 5:품명, 6:규격,
// 7:증상(hidden), 8:진단 결과(hidden), 9:상태, 10:수리요청자, 11:연락처,
// 12:수리완료일, 13:수리비용, 14:비고

/* ======== 정렬 컬럼 (1-based, nth-child 기준) ======== */
const COL_RECEIPT = 2; // 접수일자
const COL_SHIP = 3;    // 발송일자
const COL_COMPLETE = 13; // 수리완료일

let activeSort = { col: null, dir: "asc" }; // dir: 'asc'|'desc'

/* -------------------- 1) 표 행 템플릿 -------------------- */
export function createRowHTML() {
  // 본문 편집 금지(상세창 유도). 증상/진단은 CSS로 숨김
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
  `;
}

/* -------------------- 2) 렌더/적용 -------------------- */
export function renderNewRow(doc) {
  const tr = document.createElement("tr");
  tr.dataset.id = doc.id;
  tr.innerHTML = createRowHTML();
  tr.dataset.photoUrl = doc.photoUrl || ""; // 썸네일 초기값 보관
  applyDataToRow(tr, doc);

  // 원래 순서 복원용 인덱스 보관
  if (!tr.dataset.initialIndex) {
    tr.dataset.initialIndex = String(tbody().querySelectorAll("tr:not(.expand-row)").length);
  }

  tbody().appendChild(tr);
  attachRowListeners(tr);
  maybeResort(); // 정렬 활성 시 새 행도 즉시 반영
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
}

export function updateRow(doc) {
  const tr = tbody().querySelector(`tr[data-id="${doc.id}"]`);
  if (!tr) return;
  applyDataToRow(tr, doc);

  // 상세영역 열려있다면 내부도 동기화
  const ex = tr.nextElementSibling;
  if (ex && ex.classList.contains("expand-row")) {
    const sInput = ex.querySelector(".detail-symptom");
    const dInput = ex.querySelector(".detail-diagnosis");
    if (sInput && doc.symptom != null) sInput.value = doc.symptom || "";
    if (dInput && doc.diagnosis != null) dInput.value = doc.diagnosis || "";

    const img = ex.querySelector(".thumb") || ex.querySelector(".photo-preview");
    if (img) {
      const url = doc.photoUrl || "";
      if (url) { img.src = url; img.style.display = "block"; }
      else { img.removeAttribute("src"); img.style.display = "none"; }
    }
  }
  maybeResort();
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

export function wireCheckAll() {
  checkAll()?.addEventListener("change", () => {
    document.querySelectorAll(".rowCheck").forEach(cb => cb.checked = checkAll().checked);
  });
}

/* -------------------- 3) 상세영역(아코디언) -------------------- */
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
      img.src = url; // 실제 업로드 URL 반영
    } catch (err) {
      alert("사진 업로드 실패. 다시 시도해 주세요.");
      console.error(err);
    } finally {
      URL.revokeObjectURL(localUrl);
      e.target.value = "";
    }
  });

  injectOnceStyles(); // 스타일 1회 주입
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
      await updateFields(tr.dataset.id, { symptom: sym, diagnosis: dia });
      if (tr.cells[7]) tr.cells[7].innerText = sym;
      if (tr.cells[8]) tr.cells[8].innerText = dia;
    }
    ex.style.display = "none";
  }
  if (openTr === tr) openTr = null;
}

async function closeAnyOpen(eTarget) {
  if (!openTr) return;
  const ex = openTr.nextElementSibling;
  if (ex && ex.contains(eTarget)) return; // 상세 내부 클릭은 무시
  await closeExpand(openTr, { save: true });
}

/* -------------------- 4) 이벤트 바인딩(저장만 담당) -------------------- */
export function attachRowListeners(tr) {
  // 입력/셀렉트 변경 → 필드 업데이트 (예외 4컬럼만 해당)
  const handler = debounce(async (target) => {
    const key = target.dataset.key;
    if (!key) return;
    const id = tr.dataset.id;
    const value = (target.tagName === "INPUT" || target.tagName === "SELECT") ? target.value : target.innerText;
    await updateField(id, key, value);
  }, 300);

  tr.querySelectorAll("input[data-key], select[data-key]").forEach(el => {
    el.addEventListener("change", e => handler(e.target));
  });
}

/* 테이블 밖 클릭 시 열림 닫기 + 저장 */
document.addEventListener("click", async (e) => {
  const mainTable = document.getElementById("mainTable");
  if (mainTable && mainTable.contains(e.target)) return; // 내부 클릭은 델리게이션에서 처리
  await closeAnyOpen(e.target);
});

/* -------------------- 5) 필터 유틸 -------------------- */
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

/* -------------------- 6) 정렬 바 주입 -------------------- */
(function injectSortBar() {
  const table = document.getElementById("mainTable");
  if (!table || document.getElementById("sortBar")) return;

  const bar = document.createElement("div");
  bar.id = "sortBar";
  bar.innerHTML = `
    <style>
      #sortBar { display:flex; justify-content:flex-end; align-items:center; gap:10px; margin:10px 6px 6px; }
      #sortBar .select { display:flex; align-items:center; gap:6px; background:#ffffff; border:1px solid #d7ddea; border-radius:20px; padding:6px 10px; box-shadow:0 2px 10px rgba(0,0,0,.04); }
      #sortBar label { font-weight:700; color:#4a4f63; font-size:.9rem; }
      #sortBar select { border:0; background:transparent; padding:4px 4px; font-weight:700; color:#1b4ae8; outline:none; }
      #sortBar .chip-area { display:flex; align-items:center; gap:6px; margin-right:auto; }
      #sortBar .chip { display:none; align-items:center; gap:6px; padding:6px 10px; border-radius:18px;
                       background:linear-gradient(135deg,#e3f2fd,#e8eaf6); color:#0d47a1; font-weight:800; border:1px solid #cbd5ff; }
      #sortBar .chip .x { cursor:pointer; width:18px; height:18px; border-radius:50%; background:#0d47a1; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; }
      #sortBar .reset { border:0; background:#eef2ff; color:#334155; font-weight:800; border-radius:20px; padding:8px 12px; cursor:pointer; }
      #sortBar .reset:hover { background:#e0e7ff; }
      @media (max-width:980px){ #sortBar { flex-wrap:wrap; justify-content:flex-start; } .chip-area{margin-right:0;} }
    </style>

    <div class="chip-area">
      <div id="sortChip" class="chip" aria-live="polite"></div>
    </div>

    <div class="select">
      <label for="selReceipt">접수일자</label>
      <select id="selReceipt" aria-label="접수일자 정렬">
        <option value="none">기본순</option>
        <option value="asc">오름차순 ↑</option>
        <option value="desc">내림차순 ↓</option>
      </select>
    </div>

    <div class="select">
      <label for="selShip">발송일자</label>
      <select id="selShip" aria-label="발송일자 정렬">
        <option value="none">기본순</option>
        <option value="asc">오름차순 ↑</option>
        <option value="desc">내림차순 ↓</option>
      </select>
    </div>

    <div class="select">
      <label for="selComplete">수리완료일</label>
      <select id="selComplete" aria-label="수리완료일 정렬">
        <option value="none">기본순</option>
        <option value="asc">오름차순 ↑</option>
        <option value="desc">내림차순 ↓</option>
      </select>
    </div>

    <button id="btnSortReset" class="reset" type="button">정렬 해제</button>
  `;

  // 테이블 바로 앞에 삽입 (오른쪽 정렬)
  table.parentNode.insertBefore(bar, table);

  // 이벤트: 셀렉트 변경 → 단일 정렬(하나 선택 시 나머지는 기본순으로 되돌림)
  const selReceipt = bar.querySelector("#selReceipt");
  const selShip = bar.querySelector("#selShip");
  const selComplete = bar.querySelector("#selComplete");
  const btnReset = bar.querySelector("#btnSortReset");

  function resetOthers(except) {
    [selReceipt, selShip, selComplete].forEach(sel => { if (sel !== except) sel.value = "none"; });
  }

  selReceipt.addEventListener("change", () => {
    resetOthers(selReceipt);
    applySort(selReceipt.value === "none" ? null : { col: COL_RECEIPT, dir: selReceipt.value });
  });

  selShip.addEventListener("change", () => {
    resetOthers(selShip);
    applySort(selShip.value === "none" ? null : { col: COL_SHIP, dir: selShip.value });
  });

  selComplete.addEventListener("change", () => {
    resetOthers(selComplete);
    applySort(selComplete.value === "none" ? null : { col: COL_COMPLETE, dir: selComplete.value });
  });

  btnReset.addEventListener("click", () => {
    [selReceipt, selShip, selComplete].forEach(sel => sel.value = "none");
    applySort(null);
  });
})();

/* -------------------- 7) 정렬 핵심 로직 -------------------- */
function parseDateFromCell(tr, nthChild) {
  const cell = tr.cells[nthChild - 1];
  if (!cell) return NaN;
  const input = cell.querySelector("input[type='date']");
  const value = (input?.value || cell.innerText || "").trim();

  // 'YYYY-MM-DD'만 유효. 그 외(예: '연도-월-일' 플레이스홀더)는 무시
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;

  const ts = Date.parse(value + "T00:00:00");
  return Number.isNaN(ts) ? NaN : ts;
}

function sortByDateColumn(nthChild, dir = "asc") {
  const rows = Array.from(tbody().querySelectorAll("tr")).filter(tr => !tr.classList.contains("expand-row"));
  rows.forEach((tr, i) => { if (!tr.dataset.initialIndex) tr.dataset.initialIndex = String(i); });

  const items = rows.map(tr => {
    const ts = parseDateFromCell(tr, nthChild);
    const ex = tr.nextElementSibling && tr.nextElementSibling.classList.contains("expand-row")
      ? tr.nextElementSibling : null;
    return {
      tr, ex,
      ts: Number.isNaN(ts) ? Infinity : ts, // 빈 값은 항상 맨 뒤
      idx: Number(tr.dataset.initialIndex || "0")
    };
  });

  const mult = dir === "desc" ? -1 : 1;
  items.sort((a, b) => {
    const aInf = a.ts === Infinity, bInf = b.ts === Infinity;
    if (aInf && !bInf) return 1;
    if (!aInf && bInf) return -1;
    if (aInf && bInf) return a.idx - b.idx; // 둘 다 빈 값 → 원래 순서
    if (a.ts === b.ts) return a.idx - b.idx; // 안정 정렬
    return (a.ts - b.ts) * mult;
  });

  const frag = document.createDocumentFragment();
  items.forEach(({ tr, ex }) => {
    frag.appendChild(tr);
    if (ex) frag.appendChild(ex);
  });
  tbody().appendChild(frag);
}

function resetSortToInitial() {
  const rows = Array.from(tbody().querySelectorAll("tr")).filter(tr => !tr.classList.contains("expand-row"));
  rows.sort((a, b) => Number(a.dataset.initialIndex || "0") - Number(b.dataset.initialIndex || "0"));
  const frag = document.createDocumentFragment();
  rows.forEach(tr => {
    frag.appendChild(tr);
    const ex = tr.nextElementSibling && tr.nextElementSibling.classList.contains("expand-row")
      ? tr.nextElementSibling : null;
    if (ex) frag.appendChild(ex);
  });
  tbody().appendChild(frag);
}

function applySort(state /* {col, dir} | null */) {
  activeSort = state ? { ...state } : { col: null, dir: "asc" };
  updateSortChip();
  if (!state) resetSortToInitial();
  else sortByDateColumn(state.col, state.dir);
}

function maybeResort() {
  if (!activeSort.col) return;
  // 현재 상태 유지 재적용
  sortByDateColumn(activeSort.col, activeSort.dir);
}

/* -------------------- 8) 활성 정렬 태그(chip) -------------------- */
function updateSortChip() {
  const chip = document.getElementById("sortChip");
  if (!chip) return;

  if (!activeSort.col) {
    chip.style.display = "none";
    chip.textContent = "";
    chip.onclick = null;
    return;
  }

  const colName = activeSort.col === COL_RECEIPT ? "접수일자"
                  : activeSort.col === COL_SHIP ? "발송일자"
                  : "수리완료일";
  const arrow = activeSort.dir === "asc" ? "↑" : "↓";
  chip.innerHTML = `${colName} ${arrow} <span class="x" role="button" aria-label="정렬 해제">×</span>`;
  chip.style.display = "inline-flex";
  chip.querySelector(".x").onclick = () => {
    // chip 클릭으로 정렬 해제
    const bar = document.getElementById("sortBar");
    if (bar) {
      bar.querySelector("#selReceipt").value = "none";
      bar.querySelector("#selShip").value = "none";
      bar.querySelector("#selComplete").value = "none";
    }
    applySort(null);
  };
}

/* -------------------- 9) 스타일 1회 주입 -------------------- */
let _styleInjected = false;
function injectOnceStyles() {
  if (_styleInjected) return;
  _styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    /* [증상], [진단 결과] 컬럼 숨김(헤더/바디) */
    #mainTable th:nth-child(8), #mainTable td:nth-child(8),
    #mainTable th:nth-child(9), #mainTable td:nth-child(9) { display: none !important; }

    /* 상세 박스(아코디언) 스타일 */
    .expand-row > td { padding: 12px 16px; background: #f8faff; border-top: 1px solid #e3eaf5; }
    .detail-wrap { min-height: 200px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: start; }
    .detail-cell { background: #ffffff; border: 1px solid #e3eaf5; border-radius: 8px; padding: 10px; }
    .detail-label { display:block; font-weight:700; margin-bottom:6px; }
    .detail-text { width:100%; min-height:160px; resize:vertical; border:1px solid #ddd; border-radius:6px; padding:8px; font-size:.95rem; color:#000; }

    /* 사진 썸네일 영역 */
    .photo-box { position: relative; width: 100%; height: 180px; border: 1px dashed #c7d2fe; border-radius: 8px; background: #f9fbff;
                 overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .thumb-wrap { width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; }
    .thumb { display:block; width:100%; height:100%; object-fit: cover; border-radius:6px; }
    .photo-preview { max-width:100%; max-height:100%; object-fit:contain; }
    .photo-btn { position: absolute; bottom: 10px; right: 10px; border:0; border-radius:6px; padding:8px 12px; font-weight:700; color:#fff;
                 background: linear-gradient(135deg,#2196F3,#1976D2); cursor:pointer; box-shadow: 0 4px 12px rgba(0,0,0,.15); }

    /* 본문 클릭/편집 차단 (상세열기 유도) */
    #mainTable tbody tr:not(.expand-row) td { cursor: pointer; user-select: none; }
    #mainTable tbody tr:not(.expand-row) td:first-child { cursor: default; user-select: auto; }

    /* 기본적으로 본문 내 폼요소 비활성화 */
    #mainTable tbody tr:not(.expand-row) input,
    #mainTable tbody tr:not(.expand-row) select,
    #mainTable tbody tr:not(.expand-row) textarea,
    #mainTable tbody tr:not(.expand-row) [contenteditable] { pointer-events: none !important; }

    /* 체크박스만 항상 허용 */
    #mainTable tbody tr:not(.expand-row) input.rowCheck { pointer-events: auto !important; }

    /* 예외 컬럼(2:접수일자, 3:발송일자, 10:상태, 13:수리완료일)만 폼 조작 허용 */
    #mainTable tbody tr:not(.expand-row) td:nth-child(2) input,
    #mainTable tbody tr:not(.expand-row) td:nth-child(3) input,
    #mainTable tbody tr:not(.expand-row) td:nth-child(10) select,
    #mainTable tbody tr:not(.expand-row) td:nth-child(13) input { pointer-events: auto !important; }

    /* 예외 컬럼은 상세열기 커서 제거 */
    #mainTable tbody tr:not(.expand-row) td:nth-child(2),
    #mainTable tbody tr:not(.expand-row) td:nth-child(3),
    #mainTable tbody tr:not(.expand-row) td:nth-child(10),
    #mainTable tbody tr:not(.expand-row) td:nth-child(13) { cursor: default; }

    /* 체크박스 사용성 향상 */
    #mainTable th:first-child, #mainTable td:first-child { width: 56px; min-width: 56px; }
    #mainTable input.rowCheck, #checkAll { width: 20px; height: 20px; transform: scale(1.4); transform-origin: center; cursor: pointer; }
    #mainTable input.rowCheck { margin: 6px; }
  `;
  document.head.appendChild(style);
}

/* -------------------- 10) 테이블 전역 클릭 델리게이션 -------------------- */
(function installRowOpenDelegation() {
  const table = document.getElementById("mainTable");
  if (!table) return;

  // 예외 컬럼(0-based): 0=체크박스, 1=접수일자, 2=발송일자, 9=상태, 12=수리완료일
  const NON_TOGGLE_CELLS = new Set([0, 1, 2, 9, 12]);

  table.addEventListener("click", async (e) => {
    // 상세행 내부 클릭은 무시
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
