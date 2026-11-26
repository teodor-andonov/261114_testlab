/* Quiet PWA registration. A waiting worker takes over after all older app windows close. */
(() => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const script = document.currentScript;
  const base = new URL('./', script.src);
  const start = async () => {
    try {
      const registration = await navigator.serviceWorker.register(new URL('sw.js', base), {
        scope: base.href, updateViaCache: 'none', type: script.dataset.workerType || 'classic'
      });
      const check = () => registration.update().catch(() => {});
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
      void check();
    } catch (error) { console.warn('Offline registration unavailable:', error); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else void start();
})();
