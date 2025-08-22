// js/importExport.js
import { fetchAllRows, addRowDoc, schemaKeys } from "./data.js";
import { loadScript, yyyymmdd } from "./utils.js";

/** 한국어 헤더 ↔ 필드 키 매핑 */
const HEADER_TO_KEY = {
  "접수일자": "receiptDate",
  "발송일자": "shipDate",
  "거래처":   "company",
  "품번":     "partNo",
  "품명":     "partName",
  "규격":     "spec",
  "증상":     "symptom",
  "진단 결과": "diagnosis",
  "상태":     "status",
  "수리 담당자": "repairer",
  "수리 요청자": "repairer",
  "연락처":   "contact",
  "수리완료일": "completeDate",
  "수리비용": "cost",
  "비고":     "note",
  // ✅ 새 필드
  "특채":     "special"
};
const KEY_TO_HEADER = Object.fromEntries(Object.entries(HEADER_TO_KEY).map(([k,v]) => [v,k]));

// 안전한 XLSX 로더
async function loadXLSX() {
  const CANDIDATES = [
    { type: "umd", url: "./vendor/xlsx.full.min.js" },
    { type: "umd", url: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" }
  ];
  let lastErr = null;
  for (const c of CANDIDATES) {
    try {
      await loadScript(c.url);
      if (window.XLSX?.utils && window.XLSX.writeFile) return window.XLSX;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("XLSX 로드 실패");
}

/* -------------------- 내보내기: XLSX -------------------- */
export async function exportXLSX() {
  try {
    const rows = await fetchAllRows();

    // 헤더는 schemaKeys 순서로, 한글 헤더 매핑 적용
    const data = [schemaKeys.map(k => KEY_TO_HEADER[k] || k)];
    rows.forEach(r => data.push(schemaKeys.map(k => r[k] ?? "")));

    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // (선택) 보기 좋게: 간단한 컬럼 폭 추정 자동맞춤
    const colWidths = data[0].map((_, idx) => {
      const maxLen = data.reduce((m, row) => Math.max(m, String(row[idx] ?? "").length), 0);
      return { wch: Math.min(40, Math.max(8, maxLen + 2)) };
    });
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "SEA");
    XLSX.writeFile(wb, `SEA_export_${yyyymmdd()}.xlsx`);
  } catch (err) {
    console.error("엑셀 내보내기 실패:", err);
    alert("엑셀 내보내기 중 오류가 발생했습니다. (자세한 내용은 콘솔 참조)");
  }
}

/* -------------------- 가져오기: CSV/XLSX -------------------- */
export async function handleImportFile(e) {
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

/* -------------------- CSV 파싱(가져오기용) -------------------- */
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
  // 혹시 원본에 스키마 키로 된 컬럼명이 그대로 들어오면 보존
  schemaKeys.forEach(k => { if (record[k] != null) out[k] = record[k]; });
  return out;
}
