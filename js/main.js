// main.js
// - 모바일(핸드폰)에서는 가져오기/내보내기 모듈 로딩 안 함
// - 실시간 구독/추가/수정/삭제는 data.js를 통해 수행
// - UI 연결은 ui.js가 담당

import { initUI } from './ui.js';
import { subscribeRealtime, addRowDoc, updateField, deleteRowDoc, uploadRowPhoto } from './data.js';

// ---------- 환경 판별 ----------
function isPhone() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const minSide = Math.min(window.screen.width, window.screen.height);
  return coarse && minSide <= 820;
}

// ---------- 앱 시작 ----------
document.addEventListener('DOMContentLoaded', async () => {
  // 데스크톱/태블릿에서만 가져오기/내보내기 UI 로딩
  if (!isPhone()) {
    try {
      const mod = await import('./importExport.js');
      if (typeof mod.initImportExportUI === 'function') mod.initImportExportUI();
    } catch (e) {
      console.warn('importExport 모듈 로딩 실패:', e);
    }
  }

  // UI 초기화
  const ui = initUI({
    onUpdate: (id, field, value) => updateField(id, field, value),
    onDelete: (id) => deleteRowDoc(id),
    onUploadPhoto: (id, file) => uploadRowPhoto(id, file),
    onToggleExpand: (id, opened) => { /* 분석/로그 등 필요 시 사용 */ },
    getFilter: () => document.getElementById('filterInput')?.value || ''
  });

  // 실시간 구독 → 렌더
  subscribeRealtime((rows) => {
    ui.renderRows(
      rows.map(r => ({
        id: r.id,
        name: r.name ?? '',
        phone: r.phone ?? '',
        status: r.status ?? '',
        createdAt: r.createdAt ?? r.created_at ?? r._createdAt ?? null,
        photoUrl: r.photoUrl ?? '',
        symptoms: r.symptoms ?? '',
        diagnosis: r.diagnosis ?? ''
      }))
    );
  });

  // 신규 접수 모달 열기/닫기/제출
  const dlg = document.getElementById('registerModal');
  const btnAdd = document.getElementById('btnAdd');
  const btnCancel = document.getElementById('btnCancel');
  const form = document.getElementById('registerForm');

  btnAdd?.addEventListener('click', () => dlg.showModal());
  btnCancel?.addEventListener('click', () => dlg.close());
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const doc = {
      name: fd.get('name')?.toString().trim(),
      phone: fd.get('phone')?.toString().trim(),
      status: fd.get('status')?.toString() || '접수',
      createdAt: new Date().toISOString()
    };
    await addRowDoc(doc);
    form.reset();
    dlg.close();
  });
});
