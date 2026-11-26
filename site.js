
const themeToggle = document.getElementById('themeToggle');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
const savedTheme = () => {
  try { const value = localStorage.getItem('testlab-theme'); return value === 'light' || value === 'dark' ? value : null; }
  catch { return null; }
};
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  themeToggle.querySelector('span').textContent = theme === 'dark' ? '☀' : '☾';
  if (themeColorMeta) themeColorMeta.content = theme === 'dark' ? '#141715' : '#f8f8f6';
}
setTheme(savedTheme() || (themeMedia.matches ? 'dark' : 'light'));
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('testlab-theme', next); } catch { /* preference is optional */ }
  setTheme(next);
});
themeMedia.addEventListener?.('change', e => { if (!savedTheme()) setTheme(e.matches ? 'dark' : 'light'); });

const list = document.getElementById('prototypeList');
const count = document.getElementById('projectCount');
const search = document.getElementById('filterInput');
const empty = document.getElementById('emptyNotice');
const repoLink = document.getElementById('repoLink');

// On GitHub Pages, the first URL segment is the project repository name.
// This keeps the source link correct across a repository rename.
if (location.hostname.endsWith('.github.io')) {
  const name = location.pathname.split('/').filter(Boolean)[0];
  if (name) repoLink.href = `https://github.com/teodor-andonov/${encodeURIComponent(name)}`;
}

let projects = [];
const PIN_KEY = 'testlab-pinned-prototypes';
let pinned = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
  if (Array.isArray(stored)) pinned = new Set(stored.filter(value => typeof value === 'string'));
} catch {}
function togglePin(folder) {
  if (pinned.has(folder)) pinned.delete(folder); else pinned.add(folder);
  try { localStorage.setItem(PIN_KEY, JSON.stringify([...pinned])); } catch {}
  render();
  [...list.querySelectorAll('.pin-button')].find(button => button.dataset.folder === folder)?.focus({preventScroll:true});
}
window.addEventListener('storage', event => {
  if (event.key !== PIN_KEY) return;
  try {
    const stored = JSON.parse(event.newValue || '[]');
    pinned = new Set(Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : []);
    render();
  } catch {}
});
const dateLabel = input => {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(String(input));
  if (!match) return String(input);
  return `${match[3]}.${match[2]}.20${match[1]}`;
};
const timestampLabel = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
};
function projectCard(project) {
  const card = document.createElement('a');
  card.className = 'project-card';
  card.href = `./${encodeURIComponent(project.folder)}/${project.commit ? "?v=" + encodeURIComponent(project.commit.slice(0,7)) : ""}`;
  const header = document.createElement('div');
  header.className = 'card-head';
  const number = document.createElement('span');
  number.className = 'card-number';
  number.textContent = dateLabel(project.date);
  const status = document.createElement('span');
  status.className = 'status';
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  status.append(dot, document.createTextNode((project.status || 'Prototype').toUpperCase()));
  header.append(number, status);
  const symbol = document.createElement('div');
  symbol.className = 'card-symbol'; symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = project.monogram || (project.title || '?').slice(0, 2).toUpperCase();
  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';
  const category = document.createElement('div');
  category.className = 'card-category';
  category.textContent = [project.category, ...(project.tags || []).slice(0, 1)].filter(Boolean).join(' · ');
  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';
  const title = document.createElement('h3'); title.textContent = project.title;
  const arrow = document.createElement('span'); arrow.className = 'visit-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
  titleRow.append(title, arrow);
  const summary = document.createElement('p'); summary.textContent = project.description || '';
  const facts = document.createElement('dl');
  facts.className = 'card-facts';
  for (const [label, value] of [
    ['Created', timestampLabel(project.createdAt)],
    ['Updated', timestampLabel(project.updatedAt)],
    ['Version', project.version ? 'v' + project.version : '—']
  ]) {
    const item = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    if (label !== 'Version') detail.title = project[label === 'Created' ? 'createdAt' : 'updatedAt'] || 'Not available';
    item.append(term, detail);
    facts.append(item);
  }
  bottom.append(category, titleRow, summary, facts);
  card.append(header, symbol, bottom);
  const tile = document.createElement('div');
  tile.className = 'project-tile';
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'pin-button';
  pin.dataset.folder = project.folder;
  const isPinned = pinned.has(project.folder);
  pin.setAttribute('aria-pressed', String(isPinned));
  pin.setAttribute('aria-label', (isPinned ? 'Unpin ' : 'Pin ') + project.title);
  pin.title = isPinned ? 'Unpin prototype' : 'Pin prototype';
  pin.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-3 1-4 4v4l-2 2-7-7 2-2h4l4-4 1-3Z"/><path d="m8.5 15.5-5 5"/></svg>';
  pin.addEventListener('click', () => togglePin(project.folder));
  tile.append(card, pin);
  return tile;
}
function render() {
  const needle = search.value.trim().toLocaleLowerCase();
  const displayed = projects.filter(project => [project.title, project.description, project.folder, project.category, project.status, ...(project.tags || [])].some(value => String(value || '').toLocaleLowerCase().includes(needle)));
  displayed.sort((a,b) => Number(pinned.has(b.folder)) - Number(pinned.has(a.folder))
    || String(b.date).localeCompare(String(a.date))
    || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    || a.folder.localeCompare(b.folder));
  list.replaceChildren(...displayed.map(projectCard));
  count.textContent = String(projects.length).padStart(2, '0');
  empty.hidden = displayed.length !== 0;
}
search.addEventListener('input', render);
fetch('./catalog.json', { cache: 'no-cache' })
  .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then(data => { projects = Array.isArray(data.projects) ? data.projects : []; render(); })
  .catch(() => {
    // Keep the static first-prototype link usable if the generated catalog is unavailable.
    count.textContent = '01';
    empty.hidden = true;
    search.disabled = true;
    search.placeholder = 'Search unavailable in source preview';
  });

// Install the root gallery as its own PWA; each dated prototype remains independent.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
      console.warn('Testlab offline shell could not be registered:', error);
    });
  });
}

const installButton = document.getElementById('installButton');
let pendingInstall = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pendingInstall = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!pendingInstall) return;
  const install = pendingInstall;
  pendingInstall = null;
  installButton.hidden = true;
  await install.prompt();
});
window.addEventListener('appinstalled', () => {
  pendingInstall = null;
  installButton.hidden = true;
});
