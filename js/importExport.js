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
  "수리 요청자": "repairer",
  "연락처": "contact",
  "수리완료일": "completeDate",
  "수리비용": "cost",
  "비고": "note"
};
const KEY_TO_HEADER = Object.fromEntries(Object.entries(HEADER_TO_KEY).map(([k,v]) => [v,k]));

/* -------------------- 공용: 안전한 XLSX 로더 -------------------- */
/* 1) ESM 모듈 시도 → 2) 실패 시 UMD(전역 XLSX) 로 폴백 */
async function loadXLSX() {
  // ESM 빌드 (권장)
  const ESM = "https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.mjs";
  // UMD 빌드 (전역 XLSX 노출)
  const UMD = "https://cdn.jsdelivr.net/npm/xlsx@0.20.0/dist/xlsx.full.min.js";

  try {
    const mod = await import(ESM);
    // 일부 CDN은 default 없이 네임스페이스로만 노출될 수 있음
    return mod.default || mod;
  } catch (e) {
    console.warn("[XLSX] ESM 로드 실패, UMD로 폴백합니다.", e);
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = UMD;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
    if (!window.XLSX) throw new Error("XLSX UMD 로드 실패");
    return window.XLSX;
  }
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

    const XLSX = await loadXLSX(); // ✅ 안전한 로더 사용
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
    e.target.value = ""; // 파일 입력 초기화
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
  // 이미 영문 키로 온 값도 반영
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
