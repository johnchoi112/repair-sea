// js/ui.js
import { schemaKeys, updateField } from "./data.js";

const tbody = () => document.getElementById("tableBody");
const checkAll = () => document.getElementById("checkAll");

const COL_KEYS = ["_check", ...schemaKeys];

export function createRowHTML() {
  return `
    <td><input type="checkbox" class="rowCheck" /></td>
    <td><input type="date" data-key="receiptDate"/></td>
    <td><input type="date" data-key="shipDate"/></td>
    <td contenteditable="true" data-key="company"></td>
    <td contenteditable="true" data-key="partNo"></td>
    <td contenteditable="true" data-key="partName"></td>
    <td contenteditable="true" data-key="spec"></td>
    <td contenteditable="true" data-key="symptom"></td>
    <td contenteditable="true" data-key="diagnosis"></td>
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

export function renderNewRow(doc) {
  const tr = document.createElement("tr");
  tr.dataset.id = doc.id;
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
}

export function updateRow(doc) {
  const tr = tbody().querySelector(`tr[data-id="${doc.id}"]`);
  if (tr) applyDataToRow(tr, doc);
}

export function removeRow(id) {
  const tr = tbody().querySelector(`tr[data-id="${id}"]`);
  if (tr) tr.remove();
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

export function attachRowListeners(tr) {
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

export function exposeFilter() {
  window.filterTable = (colIndex, term) => {
    const rows = tbody().querySelectorAll("tr");
    const q = (term || "").toLowerCase();
    rows.forEach(r => {
      const cell = r.cells[colIndex];
      const text = cell ? (cell.innerText || cell.textContent || "").toLowerCase() : "";
      r.style.display = text.indexOf(q) > -1 ? "" : "none";
    });
  };
}

function debounce(fn, ms = 400) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
