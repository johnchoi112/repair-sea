// js/importExport.js
import { fetchAllRows, addRowDoc, schemaKeys } from "./data.js";

/** 한국어 헤더 ↔ 필드 키 매핑 */
const HEADER_TO_KEY = {
  "접수일자": "receiptDate",
  "발송일자": "shipDate",
  "거래처": "company",
  "품번": "partNo",
  "품명": "partName",
  "규격": "spec",
  "증상": "symptom",
  "진단 결과": "diagnosis",
  "상태": "status",
  // 둘 다 허용(화면 표기가 '수리 담당자' 또는 '수리 요청자'인 경우 모두 대응)
  "수리 담당자": "repairer",
  "수리 요청자": "repairer",
  "연락처": "contact",
  "수리완료일": "completeDate",
  "수리비용": "cost",
  "비고": "note"
};
const KEY_TO_HEADER = Object.fromEntries(Object.entries(HEADER_TO_KEY).map(([k,v]) => [v,k]));

/* ------------------------------------------------------------------
   안전한 XLSX 로더
   - 1) ESM (jsDelivr +esm) → 2) ESM (unpkg) → 3) UMD(jsDelivr) →
     4) UMD(unpkg) → 5) UMD(cdnjs: 0.18.5) 순서로 시도
   ------------------------------------------------------------------ */
async function loadXLSX() {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  if (!window.XLSX) throw new Error("XLSX 로드 실패");
  return window.XLSX;
};

  let lastErr = null;
  for (const cand of CANDIDATES) {
    try {
      if (cand.type === "esm") {
        // ESM: 동적 import
        const m = await import(/* @vite-ignore */ cand.url);
        const mod = m?.default || m;
        if (mod?.utils && mod?.writeFile) {
          console.info("[XLSX] ESM 로드 성공:", cand.url);
          return mod;
        }
      } else {
        // UMD: <script> 주입
        await loadScript(cand.url);
        if (window.XLSX?.utils && window.XLSX?.writeFile) {
          console.info("[XLSX] UMD 로드 성공:", cand.url);
          return window.XLSX;
        }
      }
    } catch (e) {
      lastErr = e;
      console.warn(`[XLSX] 로드 실패: ${cand.url}`, e);
      continue;
    }
  }
  throw lastErr || new Error("XLSX 로드 실패");
}

function loadScript(src, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = (ev) => reject(ev);
    document.head.appendChild(s);
    // 타임아웃 보호
    setTimeout(() => reject(new Error("Script load timeout: " + src)), timeoutMs);
  });
}

/* -------------------- UI 주입 (FAB) -------------------- */
export function injectImportExportUI() {
  if (document.getElementById("ieFab")) return;
  const fab = document.createElement("div");
  fab.id = "ieFab";
  fab.innerHTML = `
    <style>
      #ieFab { position: fixed; right: 18px; bottom: 18px; z-index: 1000; }
      #ieFab .btn { border:0; border-radius:28px; padding:12px 16px; color:#fff; font-weight:800; cursor:pointer;
                    box-shadow: 0 6px 18px rgba(0,0,0,.18); margin-left:8px; }
      #btnExport { background: linear-gradient(135deg,#4caf50,#2e8b57); }
      #btnImport { background: linear-gradient(135deg,#ff9800,#f57c00); }
      #btnCsv    { background: linear-gradient(135deg,#2196f3,#1976d2); }
      #ieHiddenInput { display:none; }
    </style>
    <button class="btn" id="btnExport">엑셀 내보내기</button>
    <button class="btn" id="btnCsv">CSV 내보내기</button>
    <button class="btn" id="btnImport">가져오기</button>
    <input type="file" id="ieHiddenInput" accept=".xlsx,.xls,.csv" />
  `;
  document.body.appendChild(fab);

  document.getElementById("btnExport").addEventListener("click", exportXLSX);
  document.getElementById("btnCsv").addEventListener("click", exportCSV);
  document.getElementById("btnImport").addEventListener("click", () =>
    document.getElementById("ieHiddenInput").click()
  );
  document.getElementById("ieHiddenInput").addEventListener("change", handleImportFile);
}

/* -------------------- 내보내기: XLSX -------------------- */
async function exportXLSX() {
  try {
    const rows = await fetchAllRows();
    const data = [schemaKeys.map(k => KEY_TO_HEADER[k] || k)];
    rows.forEach(r => data.push(schemaKeys.map(k => r[k] ?? "")));

    const XLSX = await loadXLSX(); // ✅ 견고한 로더
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "SEA");
    XLSX.writeFile(wb, `SEA_export_${yyyymmdd()}.xlsx`);
  } catch (err) {
    console.error("엑셀 내보내기 실패:", err);
    alert("엑셀 내보내기 중 오류가 발생했습니다. (자세한 내용은 콘솔 참조)");
  }
}

/* -------------------- 내보내기: CSV -------------------- */
async function exportCSV() {
  const rows = await fetchAllRows();
  const headers = schemaKeys.map(k => KEY_TO_HEADER[k] || k);
  const body = rows.map(r => schemaKeys.map(k => csvEscape(r[k] ?? "")));
  const csv = [headers.map(csvEscape).join(","), ...body.map(a => a.join(","))].join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `SEA_export_${yyyymmdd()}.csv`);
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}

/* -------------------- 가져오기: CSV/XLSX -------------------- */
async function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const name = file.name.toLowerCase();

  try {
    let rows;
    if (name.endsWith(".csv")) {
      rows = await parseCSV(file);
    } else {
      const XLSX = await loadXLSX(); // ✅ 동일 로더 사용
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    }

    const normalized = rows.map(r => mapToSchema(r));
    for (const rec of normalized) await addRowDoc(rec);

    alert(`가져오기 완료: ${normalized.length}건 추가`);
  } catch (err) {
    console.error("가져오기 실패:", err);
    alert("가져오기 중 오류가 발생했습니다. (자세한 내용은 콘솔 참조)");
  } finally {
    e.target.value = "";
  }
}

/* -------------------- 보조 함수들 -------------------- */
async function parseCSV(file) {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = cells[i] ?? "");
    return obj;
  });
}
function splitCsvLine(line) {
  const res = []; let cur = ""; let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { res.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  res.push(cur);
  return res;
}
function mapToSchema(record) {
  const out = {};
  Object.entries(record).forEach(([h, v]) => {
    const key = HEADER_TO_KEY[h.trim()];
    if (key) out[key] = v ?? "";
  });
  schemaKeys.forEach(k => { if (record[k] != null) out[k] = record[k]; });
  return out;
}
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function yyyymmdd(d = new Date()){
  const p = n => n.toString().padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

