// importExport.js
// 데스크톱/태블릿에서만 주입되는 가져오기/내보내기 FAB UI.
// 안전영역(safe-area-inset-bottom) 반영.

export function initImportExportUI() {
  // 이미 한 번 붙였으면 재주입 금지
  if (document.getElementById('ieFab')) return;

  const style = document.createElement('style');
  style.textContent = `
  #ieFab { position: fixed; right: 18px; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); z-index: 1000; }
  #ieFab .fab { width: 56px; height: 56px; border-radius: 999px; background: linear-gradient(135deg,#667eea,#764ba2); color:#fff; border:none; box-shadow: 0 10px 24px rgba(102,126,234,.35); cursor:pointer; }
  #ieFab .menu { position:absolute; right: 0; bottom: 66px; display:none; flex-direction:column; gap:8px; }
  #ieFab.open .menu { display:flex; }
  #ieFab .menu button { min-height: 40px; padding: 8px 12px; border-radius: 10px; border:1px solid #1f2937; background:#0b1220; color:#e5e7eb; text-align:left; white-space:nowrap; }
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'ieFab';
  wrap.innerHTML = `
    <div class="menu" role="menu" aria-label="가져오기/내보내기">
      <button type="button" data-act="export-xlsx">엑셀 내보내기</button>
      <button type="button" data-act="export-csv">CSV 내보내기</button>
      <button type="button" data-act="import-file">가져오기</button>
    </div>
    <button class="fab" aria-label="가져오기/내보내기 열기" title="가져오기/내보내기">⇧</button>
  `;
  document.body.appendChild(wrap);

  const fab = wrap.querySelector('.fab');
  fab.addEventListener('click', () => wrap.classList.toggle('open'));

  // 아래 이벤트들은 기존 로직과 쉽게 연결되도록 CustomEvent로만 송출합니다.
  // (데스크톱에서 main.js 혹은 기존 import/export 로직이 이 이벤트를 수신하도록 연결해 두세요.)
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    document.dispatchEvent(new CustomEvent('ie:action', { detail: { act } }));
    wrap.classList.remove('open');
  });
}

// 자동 주입이 필요하면 아래 줄을 유지하세요. (동적 import 시에도 한번만 실행)
if (typeof window !== 'undefined') {
  // 환경에 따라 자동 주입을 원치 않으면 주석 처리
  initImportExportUI();
}
