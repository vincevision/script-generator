// Runs synchronously in <head>: flag JS + low-power mode before first paint,
// so the loader shows immediately and no-JS visitors still get content.
(function () {
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  if (reduced || conn.saveData === true || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4)) {
    root.classList.add('lite');
  }
  try { if (sessionStorage.getItem('epic-intro') === '1') root.classList.add('seen-intro'); } catch (e) {}
})();
