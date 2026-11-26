// Shared Testlab navigation and theme preference; injected during site assembly.
// Prototype source files remain independent and can run without this script.
(() => {
  const KEY = 'testlab-theme';
  const root = document.documentElement;
  const tray = document.createElement('nav');
  tray.className = 'testlab-floating-controls';
  tray.setAttribute('aria-label', 'Testlab navigation');
  const base = new URL('./', document.currentScript.src);
  const repo = 'https://github.com/teodor-andonov/' + (base.hostname.endsWith('.github.io') ? base.pathname.split('/').filter(Boolean)[0] || '261114_testlab' : '261114_testlab');
  const menu = document.createElement('div');
  menu.className = 'testlab-nav-menu';
  menu.id = 'testlab-nav-menu';
  menu.hidden = true;
  const icon = (name) => '<span aria-hidden="true" class="testlab-nav-icon" style="--testlab-icon:url(' + new URL('icons/lucide/'+name+'.svg', base).href + ')"></span>';
  const home = document.createElement('a'); home.href = base.href; home.className = 'testlab-floating-button testlab-home-button'; home.setAttribute('aria-label','Home'); home.title = 'Home'; home.innerHTML = icon('house');
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'testlab-floating-button testlab-theme-button';
  const github = document.createElement('a'); github.href = repo; github.className = 'testlab-floating-button'; github.target = '_blank'; github.rel = 'noopener noreferrer'; github.title = 'GitHub'; github.setAttribute('aria-label','GitHub'); github.innerHTML = icon('github');
  menu.append(home,toggle,github);
  const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'testlab-nav-dot'; trigger.setAttribute('aria-label','Testlab navigation'); trigger.setAttribute('aria-expanded','false'); trigger.setAttribute('aria-controls',menu.id); trigger.title = 'Testlab navigation';
  const show = open => { menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); };
  trigger.addEventListener('click', () => show(menu.hidden));
  document.addEventListener('pointerdown', event => { if (!tray.contains(event.target)) show(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { show(false); trigger.focus(); } });
  tray.append(menu,trigger); document.body.append(tray);
  const moonIcon = icon('moon'), sunIcon = icon('sun');
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function storedTheme() {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch { return null; }
  }
  function apply(theme, persist = false) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    if (persist) {
      try { localStorage.setItem(KEY, next); } catch {}
    }
    toggle.innerHTML = next === 'dark' ? sunIcon : moonIcon;
    toggle.title = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(next === 'dark'));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).backgroundColor;
    window.dispatchEvent(new CustomEvent('testlab:themechange', { detail: { theme: next } }));
  }

  apply(storedTheme() || (media.matches ? 'dark' : 'light'));
  toggle.addEventListener('click', () => apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
  media.addEventListener?.('change', e => {
    if (!storedTheme()) apply(e.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', e => {
    if (e.key === KEY) apply(storedTheme() || (media.matches ? 'dark' : 'light'));
  });
})();
