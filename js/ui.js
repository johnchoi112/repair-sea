// ui.js
// UI 렌더링/상호작용 전담. 데이터 I/O는 main.js에서 콜백으로 주입.
// 모바일 우선: pointer 이벤트 사용, 사진 입력에 capture="environment" 적용.

export function initUI({ onUpdate, onDelete, onUploadPhoto, onToggleExpand, getFilter }) {
  const table = document.getElementById('mainTable');
  const tbody = document.getElementById('tbody');
  const filterInput = document.getElementById('filterInput');

  // ---------- 필터 ----------
  filterInput?.addEventListener('input', () => {
    const q = (filterInput.value || '').trim().toLowerCase();
    for (const tr of tbody.querySelectorAll('tr[data-id]')) {
      const hay = tr.dataset.hay || '';
      tr.style.display = hay.includes(q) ? '' : 'none';
      const expand = tr.nextElementSibling;
      if (expand && expand.classList.contains('expand')) {
        expand.style.display = tr.style.display;
      }
    }
  });

  // ---------- 행 토글/버튼/입력 위임 ----------
  table.addEventListener('pointerup', (e) => {
    const openBtn = e.target.closest('[data-action="toggle"]');
    if (openBtn) {
      const tr = openBtn.closest('tr[data-id]');
      if (tr) toggleExpandRow(tr.dataset.id);
      e.preventDefault();
      return;
    }

    const delBtn = e.target.closest('[data-action="delete"]');
    if (delBtn) {
      const tr = delBtn.closest('tr[data-id]');
      if (tr && confirm('이 행을 삭제할까요?')) onDelete?.(tr.dataset.id);
      e.preventDefault();
      return;
    }
  }, true);

  // 입력 변경 → 디바운스 업데이트
  let tId = null;
  tbody.addEventListener('change', (e) => {
    const el = e.target;
    const tr = el.closest('tr[data-id]') || el.closest('.expand')?.previousElementSibling;
    if (!tr) return;
    const id = tr.dataset.id;
    const field = el.name;
    if (!field) return;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    window.clearTimeout(tId);
    tId = setTimeout(() => onUpdate?.(id, field, value), 120);
  });

  // 사진 업로드 (카메라 바로 열기)
  tbody.addEventListener('change', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.type !== 'file' || input.classList.contains('photo-input') === false) return;
    const tr = input.closest('.expand')?.previousElementSibling;
    if (!tr) return;
    const id = tr.dataset.id;
    const file = input.files?.[0];
    if (!file) return;
    onUploadPhoto?.(id, file);
  });

  // ---------- 공개 API ----------
  return { renderRows, upsertRow, removeRow };

  // ---------- 내부 구현 ----------
  function renderRows(rows) {
    // rows: [{id, name, phone, status, createdAt, photoUrl, symptoms, diagnosis}]
    tbody.innerHTML = '';
    rows.forEach(r => upsertRow(r));
    filterInput?.dispatchEvent(new Event('input'));
  }

  function upsertRow(row) {
    let tr = tbody.querySelector(`tr[data-id="${row.id}"]`);
    let exp = tr?.nextElementSibling;
    const exists = !!tr;

    const hay = [
      row.status ?? '', row.name ?? '', row.phone ?? '',
      row.symptoms ?? '', row.diagnosis ?? ''
    ].join(' ').toLowerCase();

    const statusBadge = badgeFor(row.status);

    const mainHTML = `
      <td>${statusBadge}</td>
      <td><input name="name" value="${esc(row.name)}" placeholder="이름" /></td>
      <td><input name="phone" value="${esc(row.phone)}" placeholder="연락처" inputmode="tel" /></td>
      <td>${fmtDate(row.createdAt)}</td>
      <td>
        ${row.photoUrl ? `<img src="${esc(row.photoUrl)}" alt="사진" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #1f2937" />` : `<span style="color:#94a3b8">없음</span>`}
      </td>
      <td>
        <button class="btn" data-action="toggle" aria-expanded="false">상세</button>
      </td>`;

    const expandHTML = `
      <td colspan="6">
        <div class="expand-inner">
          <label>증상<br/>
            <textarea name="symptoms" rows="3" placeholder="증상 입력...">${esc(row.symptoms)}</textarea>
          </label>
          <label>진단<br/>
            <textarea name="diagnosis" rows="3" placeholder="진단 입력...">${esc(row.diagnosis)}</textarea>
          </label>
          <div>
            <div style="margin-bottom:8px">사진</div>
            <button class="btn" type="button" onclick="this.nextElementSibling.click()">사진 추가</button>
            <input class="photo-input" type="file" accept="image/*" capture="environment" hidden />
          </div>
          <div style="align-self:end;justify-self:end">
            <button class="btn" data-action="delete" style="background:#3f1d1d;border-color:#6b1f1f;color:#fca5a5">삭제</button>
          </div>
        </div>
      </td>`;

    if (!exists) {
      tr = document.createElement('tr');
      tr.dataset.id = row.id;
      tr.dataset.hay = hay;
      tr.innerHTML = mainHTML;

      exp = document.createElement('tr');
      exp.className = 'expand';
      exp.style.display = 'none';
      exp.innerHTML = expandHTML;

      tbody.appendChild(tr);
      tbody.appendChild(exp);
    } else {
      tr.dataset.hay = hay;
      tr.innerHTML = mainHTML;
      exp.innerHTML = expandHTML;
    }
  }

  function removeRow(id) {
    const tr = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
    const exp = tr.nextElementSibling;
    tr.remove();
    if (exp && exp.classList.contains('expand')) exp.remove();
  }

  function toggleExpandRow(id) {
    const tr = tbody.querySelector(`tr[data-id="${id}"]`);
    if (!tr) return;
    const exp = tr.nextElementSibling;
    if (!exp || !exp.classList.contains('expand')) return;
    const btn = tr.querySelector('[data-action="toggle"]');
    const willOpen = exp.style.display === 'none';
    exp.style.display = willOpen ? '' : 'none';
    btn?.setAttribute('aria-expanded', String(willOpen));
    onToggleExpand?.(id, willOpen);
  }

  function badgeFor(status = '') {
    const map = {
      '접수':   { bg:'#1e3a8a33', fg:'#93c5fd', bd:'#1e3a8a' },
      '진행중': { bg:'#f59e0b33', fg:'#fde68a', bd:'#b45309' },
      '완료':   { bg:'#05966933', fg:'#a7f3d0', bd:'#065f46' },
    };
    const m = map[status] ?? { bg:'#33415566', fg:'#e2e8f0', bd:'#334155' };
    return `<span style="display:inline-block;padding:.35em .6em;border-radius:999px;background:${m.bg};color:${m.fg};border:1px solid ${m.bd};">${esc(status||'미정')}</span>`;
  }

  function esc(s) { return (s ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtDate(x) {
    if (!x) return '<span style="color:#94a3b8">-</span>';
    const d = x instanceof Date ? x : new Date(x);
    if (isNaN(+d)) return '<span style="color:#94a3b8">-</span>';
    const p = (n)=> String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }
}
