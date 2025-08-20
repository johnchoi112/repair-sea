// js/importExport.js
import { fetchAllRows, addRowDoc, schemaKeys } from "./data.js";
import { loadScript, yyyymmdd, csvEscape } from "./utils.js";

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
  // 표기 차이 허용
  "수리 담당자": "repairer",
  "수리 요청자": "repairer",
  "연락처": "contact",
  "수리완료일": "completeDate",
  "수리비용": "cost",
  "비고": "note"
};
const KEY_TO_HEADER = Object.fromEntries(Object.entries(HEADER_TO_KEY).map(([k,v]) => [v,k]));

// 안전한 XLSX 로더(로컬 → CDN 폴백)
async function loadXLSX() {
  const CANDIDATES = [
    { type: "umd", url: "./vendor/xlsx.full.min.js" },
    { type: "umd", url: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" }
  ];
  let lastErr = null;
  for (const c of CANDIDATES) {
    try {
      await loadScript(c.url);
      if (window.XLSX?.utils && window.XLSX.writeFile) {
        console.info("[XLSX] 로드 성공:", c.url);
        return window.XLSX;
      }
    } catch (e) {
      lastErr = e;
      console.warn("[XLSX] 로드 실패:", c.url, e);
    }
  }
  throw lastErr || new Error("XLSX 로드 실패");
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
      #btnCsv    { background: linear-gradient(135deg,#2196f3,#1976d2); }
      #btnImport { background: linear-gradient(135deg,#ff9800,#f57c00); }
      #ieHiddenInput { display:none; }
    </style>
    <button class="btn" id="btnExport">엑셀 내보내기</button>
    <button class="btn" id="btnCsv">CSV 내보내기</button>
    <button class="btn" id="btnImport">가져오기</button>
    <input type="file" id="ieHiddenInput" accept=".xlsx,xls,csv" />
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

    const XLSX = await loadXLSX();
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
      const XLSX = await loadXLSX();
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

/* -------------------- 보조 -------------------- */
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
  for (let i = 0; i < line.length; i++) {
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
