// js/ui.js
import { schemaKeys, updateField, updateFields, uploadRowPhoto } from "./data.js";

const tbody = () => document.getElementById("tableBody");
const checkAll = () => document.getElementById("checkAll");

// 내부 컬럼 키 배열 (행 렌더링용)
const COL_KEYS = ["_check", ...schemaKeys];

// -------------------- 1) 표 행 템플릿 --------------------
export function createRowHTML() {
  // 구조 유지, "증상(8), 진단 결과(9)"는 CSS로 숨김 처리
  return `
    <td><input type="checkbox" class="rowCheck" /></td>
    <td><input type="date" data-key="receiptDate"/></td>
    <td><input type="date" data-key="shipDate"/></td>
    <td contenteditable="true" data-key="company"></td>
    <td contenteditable="true" data-key="partNo"></td>
    <td contenteditable="true" data-key="partName"></td>
    <td contenteditable="true" data-key="spec"></td>
    <td contenteditable="true" data-key="symptom"></td>     <!-- 숨김 대상 -->
    <td contenteditable="true" data-key="diagnosis"></td>   <!-- 숨김 대상 -->
    <td>
      <select data-key="status">
        <option value="">선택</option>
        <option value="접수완료">접수완료</option>
        <option value="수리중">수리 중</option>
        <option value="무상수리완료">무상수리완료</option>
        <option value="유상수리완료">유상수리완료</option>
      </select>
    </td>
    <td contenteditable="true" data-key="repairer"></td>
    <td contenteditable="true" data-key="contact"></td>
    <td><input type="date" data-key="completeDate"/></td>
    <td contenteditable="true" data-key="cost"></td>
    <td contenteditable="true" data-key="note"></td>
  `;
}

// -------------------- 2) 렌더/적용 --------------------
export function renderNewRow(doc) {
  const tr = document.createElement("tr");
  tr.dataset.id = doc.id;
  if (doc.photoUrl) tr.dataset.photoUrl = doc.photoUrl; // 상세영역 초기 이미지용
  tr.innerHTML = createRowHTML();
  applyDataToRow(tr, doc);
  tbody().appendChild(tr);

  attachRowListeners(tr);
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

  // 상세영역용 이미지 URL 동기화
  if (data.photoUrl) tr.dataset.photoUrl = data.photoUrl;
}

export function updateRow(doc) {
  const tr = tbody().querySelector(`tr[data-id="${doc.id}"]`);
  if (tr) {
    applyDataToRow(tr, doc);

    // 상세영역이 열려 있다면, 박스도 동기화
    const ex = tr.nextElementSibling;
    if (ex && ex.classList.contains("expand-row")) {
      const sInput = ex.querySelector(".detail-symptom");
      const dInput = ex.querySelector(".detail-diagnosis");
      if (sInput && doc.symptom != null) sInput.value = doc.symptom || "";
      if (dInput && doc.diagnosis != null) dInput.value = doc.diagnosis || "";
      const img = ex.querySelector(".photo-preview");
      if (img && doc.photoUrl) img.src = doc.photoUrl;
    }
  }
}

export function removeRow(id) {
  const tr = tbody().querySelector(`tr[data-id="${id}"]`);
  if (tr) {
    const ex = tr.nextElementSibling;
    if (ex && ex.classList.contains("expand-row")) ex.remove();
    tr.remove();
  }
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

// -------------------- 3) 상세영역(아코디언) --------------------
let openTr = null;

function getColspan() {
  // thead의 실제 컬럼 수(숨겨진 th도 포함)
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
          <div class="photo-box">
            <img class="photo-preview" alt="사진 미리보기" />
            <input class="photo-input" type="file" accept="image/*" hidden />
            <button type="button" class="photo-btn">사진추가</button>
          </div>
        </div>
        <!-- 증상 -->
        <div class="detail-cell">
          <label class="detail-label">증상</label>
          <textarea class="detail-text detail-symptom" placeholder="증상을 입력하세요"></textarea>
        </div>
        <!-- 진단 결과 -->
        <div class="detail-cell">
          <label class="detail-label">진단 결과</label>
          <textarea class="detail-text detail-diagnosis" placeholder="진단 결과를 입력하세요"></textarea>
        </div>
      </div>
    </div>
  `;
  ex.appendChild(td);

  // 초기 데이터 주입
  const sym = tr.cells[7]?.innerText || ""; // 숨김 셀(증상)
  const dia = tr.cells[8]?.innerText || ""; // 숨김 셀(진단 결과)
  td.querySelector(".detail-symptom").value = sym;
  td.querySelector(".detail-diagnosis").value = dia;

  const img = td.querySelector(".photo-preview");
  const url = tr.dataset.photoUrl || "";
  if (url) img.src = url;
  else img.style.display = "none";

  // 사진 버튼
  const btn = td.querySelector(".photo-btn");
  const fileInput = td.querySelector(".photo-input");
  btn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // 업로드 → URL → Firestore 저장
      const url = await uploadRowPhoto(id, file);
      tr.dataset.photoUrl = url;
      img.src = url;
      img.style.display = "block";
    } catch (err) {
      console.error("사진 업로드 실패:", err);
      alert("사진 업로드 중 오류가 발생했습니다.");
    } finally {
      e.target.value = "";
    }
  });

  // 스타일 (폰트 컬러는 건드리지 않음)
  injectOnceStyles();

  return ex;
}

function openExpand(tr) {
  const next = tr.nextElementSibling;
  if (next && next.classList.contains("expand-row")) {
    next.style.display = "table-row";
  } else {
    const ex = buildExpandRow(tr);
    tr.insertAdjacentElement("afterend", ex);
  }
  openTr = tr;
}

async function closeExpand(tr, { save = true } = {}) {
  const ex = tr.nextElementSibling;
  if (ex && ex.classList.contains("expand-row")) {
    if (save) {
      // 입력값 저장
      const sym = ex.querySelector(".detail-symptom")?.value || "";
      const dia = ex.querySelector(".detail-diagnosis")?.value || "";
      // Firestore 동시 업데이트
      await updateFields(tr.dataset.id, { symptom: sym, diagnosis: dia });
      // 숨김 셀에도 반영(필터/동기화를 위해)
      if (tr.cells[7]) tr.cells[7].innerText = sym;
      if (tr.cells[8]) tr.cells[8].innerText = dia;
    }
    ex.style.display = "none";
  }
  if (openTr === tr) openTr = null;
}

async function closeAnyOpen(eTarget) {
  if (!openTr) return;
  // 상세박스 내부 클릭이면 닫지 않음
  const ex = openTr.nextElementSibling;
  if (ex && ex.contains(eTarget)) return;
  await closeExpand(openTr, { save: true });
}

// -------------------- 4) 이벤트 바인딩 --------------------
export function attachRowListeners(tr) {
  // (저장만 담당) 입력/셀렉트 변경 → 필드 업데이트
  const handler = debounce(async (target) => {
    const key = target.dataset.key;
    if (!key) return;
    const id = tr.dataset.id;
    const value = target.tagName === "INPUT" || target.tagName === "SELECT"
      ? target.value : target.innerText;
    await updateField(id, key, value);
  }, 300);

  tr.querySelectorAll("input[data-key], select[data-key]").forEach(el => {
    el.addEventListener("change", e => handler(e.target));
  });
  tr.querySelectorAll("[contenteditable][data-key]").forEach(el => {
    el.addEventListener("blur", e => handler(e.target));
  });
}

// 바깥 클릭 시 열림 닫기 + 저장
document.addEventListener("click", async (e) => {
  // 테이블 내부에서의 클릭은 행 토글 델리게이션에서 처리
  const mainTable = document.getElementById("mainTable");
  if (mainTable && mainTable.contains(e.target)) return;
  await closeAnyOpen(e.target);
});

// -------------------- 5) 필터 유틸 --------------------
export function exposeFilter() {
  window.filterTable = (colIndex, term) => {
    const rows = tbody().querySelectorAll("tr");
    const q = (term || "").toLowerCase();
    rows.forEach(r => {
      // 상세행은 필터 대상 제외
      if (r.classList.contains("expand-row")) return;
      const cell = r.cells[colIndex];
      const text = cell ? (cell.innerText || cell.textContent || "").toLowerCase() : "";
      r.style.display = text.indexOf(q) > -1 ? "" : "none";
      // 접힌 상세행도 같이 제어
      const ex = r.nextElementSibling;
      if (ex && ex.classList.contains("expand-row")) {
        ex.style.display = r.style.display;
      }
    });
  };
}

// -------------------- 6) 스타일: 컬럼 숨김 + 본문 차단 + 예외컬럼 허용 --------------------
let _styleInjected = false;
function injectOnceStyles() {
  if (_styleInjected) return;
  _styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    /* [증상], [진단 결과] 컬럼 숨김(헤더/바디) */
    #mainTable th:nth-child(8), #mainTable td:nth-child(8),
    #mainTable th:nth-child(9), #mainTable td:nth-child(9) {
      display: none !important;
    }

    /* 상세 박스(아코디언) 스타일 */
    .expand-row > td { padding: 12px 16px; background: #f8faff; border-top: 1px solid #e3eaf5; }
    .detail-wrap { min-height: 200px; }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      align-items: start;
    }
    .detail-cell { background: #ffffff; border: 1px solid #e3eaf5; border-radius: 8px; padding: 10px; }
    .detail-label { display:block; font-weight: 700; margin-bottom: 6px; }
    .detail-text {
      width: 100%;
      min-height: 160px;
      resize: vertical;
      border: 1px solid #ddd; border-radius: 6px; padding: 8px;
      font-size: .95rem; color: #000;
    }
    .photo-box { position: relative; width: 100%; height: 180px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px dashed #c7d2fe; border-radius:8px; background:#f9fbff; }
    .photo-preview { max-width: 100%; max-height: 100%; object-fit: contain; }
    .photo-btn {
      position: absolute; bottom: 10px; right: 10px;
      border:0; border-radius:6px; padding:8px 12px; font-weight:700; color:#fff;
      background: linear-gradient(135deg,#2196F3,#1976D2); cursor:pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,.15);
    }

    /* =========================
     * 본문 입력/클릭 차단 (상세창 유도)
     * ========================= */
    /* 기본적으로 본문 내 입력/셀렉트/텍스트/컨텐츠에디트 비활성화 */
    #mainTable tbody tr:not(.expand-row) input,
    #mainTable tbody tr:not(.expand-row) select,
    #mainTable tbody tr:not(.expand-row) textarea,
    #mainTable tbody tr:not(.expand-row) [contenteditable] {
      pointer-events: none !important;
    }
    /* 체크박스만 항상 허용 */
    #mainTable tbody tr:not(.expand-row) input.rowCheck {
      pointer-events: auto !important;
    }

    /* 셀 전체는 클릭 타깃(상세열기)로 사용 */
    #mainTable tbody tr:not(.expand-row) td { cursor: pointer; user-select: none; }
    #mainTable tbody tr:not(.expand-row) td:first-child { cursor: default; user-select: auto; }

    /* =========================
     * 예외 컬럼: 본문에서 직접 조작 허용
     * 2: 접수일자, 3: 발송일자, 10: 상태, 13: 수리완료일
     * ========================= */
    #mainTable tbody tr:not(.expand-row) td:nth-child(2) input,
    #mainTable tbody tr:not(.expand-row) td:nth-child(3) input,
    #mainTable tbody tr:not(.expand-row) td:nth-child(10) select,
    #mainTable tbody tr:not(.expand-row) td:nth-child(13) input {
      pointer-events: auto !important;
    }
    /* 예외 컬럼은 상세열기 커서 제거 */
    #mainTable tbody tr:not(.expand-row) td:nth-child(2),
    #mainTable tbody tr:not(.expand-row) td:nth-child(3),
    #mainTable tbody tr:not(.expand-row) td:nth-child(10),
    #mainTable tbody tr:not(.expand-row) td:nth-child(13) {
      cursor: default;
    }

    /* 체크박스 사용성 향상(그대로 유지) */
    #mainTable th:first-child, #mainTable td:first-child { width: 56px; min-width: 56px; }
    #mainTable input.rowCheck, #checkAll {
      width: 20px; height: 20px; transform: scale(1.4); transform-origin: center; cursor: pointer;
    }
    #mainTable input.rowCheck { margin: 6px; }
  `;
  document.head.appendChild(style);
}
// 최초 1회 즉시 삽입
injectOnceStyles();

// -------------------- 7) 디바운스 --------------------
function debounce(fn, ms = 400) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// -------------------- 8) 테이블 전역 클릭 델리게이션(캡처 단계) --------------------
function installRowOpenDelegation() {
  const table = document.getElementById("mainTable");
  if (!table) return;

  // 예외 컬럼(0-based cellIndex)
  const NON_TOGGLE_CELLS = new Set([0, 1, 2, 9, 12]); 
  // 0: 체크박스, 1: 접수일자, 2: 발송일자, 9: 상태, 12: 수리완료일

  table.addEventListener("click", async (e) => {
    // 상세행 내부 클릭은 무시
    const expand = e.target.closest("tr.expand-row");
    if (expand) return;

    // 본문 tr 찾기
    const tr = e.target.closest("#mainTable tbody tr");
    if (!tr) return;

    const td = e.target.closest("td");
    const cellIdx = td ? td.cellIndex : -1;

    // 예외 칸(체크박스/날짜/상태)은 토글하지 않음
    if (NON_TOGGLE_CELLS.has(cellIdx)) return;

    // 다른 행이 열려 있으면 먼저 저장 후 닫기
    await closeAnyOpen(e.target);

    // 해당 행 토글
    if (openTr === tr) {
      await closeExpand(tr, { save: true });
    } else {
      openExpand(tr);
    }
  }, true); // ← 캡처 단계
}

// 문서 준비 후 1회 설치
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installRowOpenDelegation);
} else {
  installRowOpenDelegation();
}
