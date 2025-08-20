// importExport.js
// 데스크톱/태블릿에서만 main.js가 동적 import하여 주입.
// - FAB 위치에 safe-area-inset-bottom 반영
// - 엑셀/CSV 내보내기, CSV/XLSX 가져오기 기본 구현 포함
//   · 내보내기: 현재 테이블(#mainTable) 기준으로 생성(데이터 계층이 없어도 동작)
//   · 가져오기: data.js의 addRowDoc를 동적 import하여 DB에 반영(가능할 때)
//      - 헤더는 name, phone, status, createdAt, symptoms, diagnosis, photoUrl 등을 인식

export function initImportExportUI() {
  if (document.getElementById('ieFab')) return;

  injectStyles();
  const wrap = document.createElement('div');
  wrap.id = 'ieFab';
  wrap.innerHTML = `
    <div class="menu" role="menu" aria-label="가져오기/내보내기">
      <button type="button" data-act="export-xlsx">엑셀 내보내기</button>
      <button type="button" data-act="export-csv">CSV 내보내기</button>
      <button type="button" data-act="import-file">가져오기</button>
    </div>
    <button class="fab" aria-label="가져오기/내보내기 열기" title="가져오기/내보내기">⇧</button>
    <input id="ieFile" type="file" accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv" hidden />
  `;
  document.body.appendChild(wrap);

  const fab = wrap.querySelector('.fab');
  const menu = wrap.querySelector('.menu');
  const fileInput = wrap.querySelector('#ieFile');

  fab.addEventListener('click', () => wrap.classList.toggle('open'));
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target)) wrap.classList.remove('open');
  });

  // 메뉴 액션
  wrap.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    wrap.classList.remove('open');

    try {
      if (act === 'export-xlsx') await exportXLSXFromTable();
      if (act === 'export-csv')  await exportCSVFromTable();
      if (act === 'import-file') fileInput.click();
    } catch (err) {
      console.error('[importExport]', err);
      alert('작업 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  });

  // 가져오기 핸들링
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const rows = /\.xlsx$/i.test(file.name) ? await parseXLSX(file) : await parseCSV(file);
      const normalized = normalizeRows(rows);
      const { addRowDoc } = await import('./data.js');
      for (const r of normalized) {
        await addRowDoc({
          name: r.name ?? '',
          phone: r.phone ?? '',
          status: r.status ?? '접수',
          createdAt: r.createdAt ?? new Date().toISOString(),
          symptoms: r.symptoms ?? '',
          diagnosis: r.diagnosis ?? '',
          photoUrl: r.photoUrl ?? ''
        });
      }
      alert(`가져오기 완료: ${normalized.length}건`);
    } catch (err) {
      console.error('가져오기 실패:', err);
      alert('가져오기 중 오류가 발생했습니다. CSV 혹은 XLSX 형식과 헤더를 확인하세요.');
    } finally {
      fileInput.value = '';
    }
  });
}

/* -------------------- 스타일 주입 -------------------- */
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
  #ieFab { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); z-index: 1000; }
  #ieFab .fab { width: 56px; height: 56px; border-radius: 999px; background: linear-gradient(135deg,#667eea,#764ba2); color:#fff; border:none; box-shadow: 0 10px 24px rgba(102,126,234,.35); cursor:pointer; }
  #ieFab .menu { position:absolute; right: 0; bottom: 66px; display:none; flex-direction:column; gap:8px; }
  #ieFab.open .menu { display:flex; }
  #ieFab .menu button { min-height: 40px; padding: 8px 12px; border-radius: 10px; border:1px solid #1f2937; background:#0b1220; color:#e5e7eb; text-align:left; white-space:nowrap; }
  `;
  document.head.appendChild(style);
}

/* -------------------- 내보내기: 테이블 기반 -------------------- */
async function exportCSVFromTable() {
  const { headers, data } = readTable();
  const csv = [csvRow(headers), ...data.map(csvRow)].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `SEA_export_${yyyymmdd()}.csv`);
}

async function exportXLSXFromTable() {
  const { headers, data } = readTable();
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  XLSX.utils.book_append_sheet(wb, ws, 'SEA');
  const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `SEA_export_${yyyymmdd()}.xlsx`);
}

/* -------------------- 가져오기: CSV/XLSX -------------------- */
async function parseCSV(file) {
  const text = await file.text();
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = cells[i] ?? '');
    return obj;
  });
  return rows;
}
async function parseXLSX(file) {
  const XLSX = await loadXLSX();
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws); // [{col:val},...]
}
function normalizeRows(rows) {
  const keys = {
    name: ['이름','name'],
    phone: ['연락처','phone','tel','전화'],
    status: ['상태','status'],
    createdAt: ['접수일','createdAt','created_at','date'],
    symptoms: ['증상','symptoms'],
    diagnosis: ['진단','diagnosis'],
    photoUrl: ['사진','photo','photoUrl','image','img']
  };
  const norm = (obj, want) => {
    for (const k of keys[want]) {
      if (obj[k] != null && obj[k] !== '') return String(obj[k]).trim();
    }
    return '';
  };
  return rows.map(r => ({
    name: norm(r,'name'),
    phone: norm(r,'phone'),
    status: norm(r,'status'),
    createdAt: norm(r,'createdAt'),
    symptoms: norm(r,'symptoms'),
    diagnosis: norm(r,'diagnosis'),
    photoUrl: norm(r,'photoUrl')
  }));
}

/* -------------------- 유틸 -------------------- */
function readTable() {
  const table = document.getElementById('mainTable');
  const headers = Array.from(table.tHead?.rows?.[0]?.cells ?? []).map(c => c.textContent.trim());
  const data = Array.from(table.tBodies?.[0]?.rows ?? [])
    .filter((tr) => tr.matches('tr[data-id]')) // 확장행 제외
    .map(tr => Array.from(tr.cells).map((td, idx) => {
      if (idx === 1 || idx === 2) {
        const input = td.querySelector('input');
        return input ? input.value : td.textContent.trim();
      }
      if (idx === 4) {
        const img = td.querySelector('img');
        return img ? img.src : '';
      }
      return td.textContent.trim();
    }));
  return { headers, data };
}
function csvRow(arr) {
  return arr.map(csvEscape).join(',');
}
function csvEscape(v = '') {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function splitCsvLine(line) {
  const out = [];
  let cur = ''; let quoted = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { quoted = false; continue; }
      cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; continue; }
      if (ch === '"') { quoted = true; continue; }
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
function yyyymmdd(d = new Date()) {
  const p = (n)=> String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
}
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
}
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
