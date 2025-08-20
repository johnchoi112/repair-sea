// js/utils.js
/* 공통 DOM/시간/문자열/이벤트 유틸 - UI/기능 불변 보장 */

export const qs = (sel, el = document) => el.querySelector(sel);
export const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export const once = (el, type, handler, options) => {
  const fn = (e) => { el.removeEventListener(type, fn, options); handler(e); };
  el.addEventListener(type, fn, options);
  return fn;
};

export const on = (el, type, handler, options) => {
  el.addEventListener(type, handler, options);
  return () => el.removeEventListener(type, handler, options);
};

export function delegate(root, type, selector, handler, options) {
  return on(root, type, (e) => {
    const m = e.target.closest(selector);
    if (m && root.contains(m)) handler(e, m);
  }, options);
}

export function debounce(fn, wait = 300) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait = 200) {
  let last = 0, timer = null, lastArgs = null;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now; fn(...args);
    } else {
      lastArgs = args;
      clearTimeout(timer);
      timer = setTimeout(() => { last = Date.now(); fn(...lastArgs); }, wait - (now - last));
    }
  };
}

export function yyyymmdd(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UMD 스크립트 로더(타임아웃/에러 포함) */
export function loadScript(src, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("Script load timeout: " + src)), timeoutMs);
  });
}

/** 안전 실행 래퍼(콘솔 로깅) */
export const safeAsync = (fn) => async (...args) => {
  try { return await fn(...args); }
  catch (err) { console.error("[safeAsync]", err); throw err; }
};
