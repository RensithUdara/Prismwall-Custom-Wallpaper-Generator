import { drawPattern, drawClockOverlay, exportWallpaper, PALETTES, PATTERNS, PATTERN_LABELS, DESKTOP_W, DESKTOP_H, MOBILE_W, MOBILE_H } from './engine.js';

const MAX_SEED = 999999;
const MAX_HISTORY = 40;
const RECENT_KEY = 'prismwall-recent-designs';
const FAVORITES_KEY = 'prismwall-favorite-designs';
const THUMB_W = 150;
const THUMB_H = 94;

const params = new URLSearchParams(window.location.search);
let currentPattern = clampInt(params.get('pattern'), 0, PATTERNS.length - 1, 0);
let currentPalette = clampInt(params.get('palette'), 0, PALETTES.length - 1, 0);
let seed = clampInt(params.get('seed'), 0, MAX_SEED, Math.random() * 10000 | 0);
let inverted = params.get('mode') === 'light';
let includeClock = params.get('clock') === '1';
let statusTimer = null;
let undoStack = [];
let redoStack = [];

const previewDesktop = document.getElementById('previewDesktop');
const previewMobile = document.getElementById('previewMobile');
const grid = document.getElementById('styleGrid');
const row = document.getElementById('paletteRow');
const recentGrid = document.getElementById('recentGrid');
const favoriteGrid = document.getElementById('favoriteGrid');
const seedInput = document.getElementById('seedInput');
const includeClockInput = document.getElementById('includeClock');
const customWidthInput = document.getElementById('customWidth');
const customHeightInput = document.getElementById('customHeight');
const selectedPattern = document.getElementById('selectedPattern');
const selectedPalette = document.getElementById('selectedPalette');
const summaryPattern = document.getElementById('summaryPattern');
const summaryPalette = document.getElementById('summaryPalette');
const summarySeed = document.getElementById('summarySeed');
const statusLine = document.getElementById('statusLine');

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function randomSeed() {
  return Math.random() * MAX_SEED | 0;
}

function currentState() {
  return { pattern: currentPattern, palette: currentPalette, seed, inverted, includeClock };
}

function stateKey(state) {
  return `${state.pattern}:${state.palette}:${state.seed}:${state.inverted ? 1 : 0}:${state.includeClock ? 1 : 0}`;
}

function designName(state = currentState()) {
  const mode = state.inverted ? 'Light' : 'Dark';
  return `${PATTERN_LABELS[state.pattern]} ${PALETTES[state.palette].name} ${mode}`;
}

function setStatus(message) {
  statusLine.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusLine.textContent = '';
  }, 2400);
}

function pushUndo() {
  undoStack.push(currentState());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

function setState(next, options = {}) {
  if (options.history) pushUndo();
  currentPattern = clampInt(next.pattern, 0, PATTERNS.length - 1, currentPattern);
  currentPalette = clampInt(next.palette, 0, PALETTES.length - 1, currentPalette);
  seed = clampInt(next.seed, 0, MAX_SEED, seed);
  inverted = Boolean(next.inverted);
  includeClock = Boolean(next.includeClock);
  render();
  if (options.remember !== false) rememberCurrent();
}

function updateUrl() {
  const next = new URL(window.location.href);
  next.searchParams.set('pattern', currentPattern);
  next.searchParams.set('palette', currentPalette);
  next.searchParams.set('seed', seed);
  next.searchParams.set('mode', inverted ? 'light' : 'dark');
  next.searchParams.set('clock', includeClock ? '1' : '0');
  window.history.replaceState(null, '', next);
}

function getDesignUrl() {
  const next = new URL(window.location.href);
  next.searchParams.set('pattern', currentPattern);
  next.searchParams.set('palette', currentPalette);
  next.searchParams.set('seed', seed);
  next.searchParams.set('mode', inverted ? 'light' : 'dark');
  next.searchParams.set('clock', includeClock ? '1' : '0');
  return next.href;
}

function syncControls() {
  grid.querySelectorAll('.style-btn').forEach((button, index) => {
    button.classList.toggle('active', index === currentPattern);
  });
  row.querySelectorAll('.palette-swatch').forEach((button, index) => {
    button.classList.toggle('active', index === currentPalette);
  });
  document.getElementById('btnDark').classList.toggle('active', !inverted);
  document.getElementById('btnLight').classList.toggle('active', inverted);
  document.getElementById('btnUndo').disabled = undoStack.length === 0;
  document.getElementById('btnRedo').disabled = redoStack.length === 0;
  seedInput.value = seed;
  includeClockInput.checked = includeClock;
  selectedPattern.textContent = PATTERN_LABELS[currentPattern];
  selectedPalette.textContent = PALETTES[currentPalette].name;
  summaryPattern.textContent = PATTERN_LABELS[currentPattern];
  summaryPalette.textContent = PALETTES[currentPalette].name;
  summarySeed.textContent = seed;
}

function drawPreview(ctx, w, h, type) {
  drawPattern(ctx, w, h, currentPattern, currentPalette, seed, inverted);
  drawClockOverlay(ctx, w, h, type, currentPalette, inverted);
}

function render() {
  drawPreview(previewDesktop.getContext('2d'), 640, 360, 'desktop');
  drawPreview(previewMobile.getContext('2d'), 145, 314, 'mobile');
  syncControls();
  updateUrl();
}

function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function writeSaved(key, items, limit = 6) {
  localStorage.setItem(key, JSON.stringify(items.slice(0, limit)));
}

function rememberCurrent() {
  const state = currentState();
  const items = readSaved(RECENT_KEY).filter(item => stateKey(item) !== stateKey(state));
  items.unshift(state);
  writeSaved(RECENT_KEY, items, 6);
  renderRecent();
}

function renderSavedGrid(container, items, emptyText) {
  container.innerHTML = '';
  if (items.length === 0) {
    const note = document.createElement('div');
    note.className = 'empty-note';
    note.textContent = emptyText;
    container.appendChild(note);
    return;
  }

  items.forEach(item => {
    const button = document.createElement('button');
    button.className = container === favoriteGrid ? 'favorite-card' : 'recent-card';
    button.title = designName(item);
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    drawPattern(canvas.getContext('2d'), THUMB_W, THUMB_H, item.pattern, item.palette, item.seed, item.inverted);
    button.appendChild(canvas);
    button.addEventListener('click', () => {
      setState(item, { history: true, remember: container !== favoriteGrid });
      setStatus(container === favoriteGrid ? 'Favorite restored' : 'Recent design restored');
    });
    container.appendChild(button);
  });
}

function renderRecent() {
  renderSavedGrid(recentGrid, readSaved(RECENT_KEY), 'Shuffle or save a design to fill this strip.');
}

function renderFavorites() {
  renderSavedGrid(favoriteGrid, readSaved(FAVORITES_KEY), 'Saved designs appear here.');
}

function saveFavorite() {
  const state = currentState();
  const items = readSaved(FAVORITES_KEY).filter(item => stateKey(item) !== stateKey(state));
  items.unshift(state);
  writeSaved(FAVORITES_KEY, items, 9);
  renderFavorites();
  setStatus('Favorite saved');
}

function canvasBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function saveRenderedWallpaper(w, h, filename, type = 'desktop') {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawPattern(ctx, w, h, currentPattern, currentPalette, seed, inverted);
  if (includeClock) drawClockOverlay(ctx, w, h, type, currentPalette, inverted);

  if (window.__TAURI__) {
    const blob = await canvasBlob(canvas);
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));
    await window.__TAURI__.core.invoke('save_wallpaper', { bytes, filename });
    return;
  }

  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

PATTERNS.forEach((_, i) => {
  const btn = document.createElement('button');
  btn.className = 'style-btn';
  btn.title = PATTERN_LABELS[i];
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 75;
  btn.appendChild(c);
  grid.appendChild(btn);
  drawPattern(c.getContext('2d'), 120, 75, i, 0, 42, false);
  btn.addEventListener('click', () => {
    setState({ ...currentState(), pattern: i }, { history: true });
  });
});

PALETTES.forEach((pal, i) => {
  const swatch = document.createElement('button');
  swatch.className = 'palette-swatch';
  swatch.title = pal.name;
  swatch.style.background = `linear-gradient(135deg, ${pal.colors[1]}, ${pal.colors[Math.floor(pal.colors.length / 2)]}, ${pal.colors[pal.colors.length - 2]})`;
  row.appendChild(swatch);
  swatch.addEventListener('click', () => {
    setState({ ...currentState(), palette: i }, { history: true });
  });
});

document.getElementById('btnDark').addEventListener('click', () => {
  setState({ ...currentState(), inverted: false }, { history: true });
});

document.getElementById('btnLight').addEventListener('click', () => {
  setState({ ...currentState(), inverted: true }, { history: true });
});

document.getElementById('btnUndo').addEventListener('click', () => {
  if (undoStack.length === 0) return;
  redoStack.push(currentState());
  const previous = undoStack.pop();
  setState(previous, { remember: false });
  setStatus('Undo');
});

document.getElementById('btnRedo').addEventListener('click', () => {
  if (redoStack.length === 0) return;
  undoStack.push(currentState());
  const next = redoStack.pop();
  setState(next, { remember: false });
  setStatus('Redo');
});

document.getElementById('btnFavorite').addEventListener('click', saveFavorite);

document.getElementById('btnUseSeed').addEventListener('click', () => {
  setState({ ...currentState(), seed: clampInt(seedInput.value, 0, MAX_SEED, seed) }, { history: true });
  setStatus('Seed applied');
});

seedInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') document.getElementById('btnUseSeed').click();
});

includeClockInput.addEventListener('change', () => {
  setState({ ...currentState(), includeClock: includeClockInput.checked }, { history: true });
  setStatus(includeClock ? 'Clock will export' : 'Clean export selected');
});

document.getElementById('btnShuffle').addEventListener('click', () => {
  setState({ ...currentState(), seed: randomSeed() }, { history: true });
  setStatus('Seed shuffled');
});

document.getElementById('btnSurprise').addEventListener('click', () => {
  setState({
    pattern: Math.random() * PATTERNS.length | 0,
    palette: Math.random() * PALETTES.length | 0,
    seed: randomSeed(),
    inverted: Math.random() > 0.5,
    includeClock,
  }, { history: true });
  setStatus('New design generated');
});

document.getElementById('btnCopyLink').addEventListener('click', async () => {
  const link = getDesignUrl();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(link);
    } else {
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setStatus('Design link copied');
  } catch {
    setStatus('Copy failed, URL updated');
  }
});

document.getElementById('btnDesktop').addEventListener('click', () => {
  saveRenderedWallpaper(DESKTOP_W, DESKTOP_H, `prismwall-${seed}-desktop-4k.png`, 'desktop');
});

document.getElementById('btnMobile').addEventListener('click', () => {
  saveRenderedWallpaper(MOBILE_W, MOBILE_H, `prismwall-${seed}-iphone.png`, 'mobile');
});

document.getElementById('btnBoth').addEventListener('click', () => {
  saveRenderedWallpaper(DESKTOP_W, DESKTOP_H, `prismwall-${seed}-desktop-4k.png`, 'desktop');
  setTimeout(() => {
    saveRenderedWallpaper(MOBILE_W, MOBILE_H, `prismwall-${seed}-iphone.png`, 'mobile');
  }, 250);
  setStatus('Desktop and iPhone exports started');
});

document.getElementById('btnCustom').addEventListener('click', () => {
  const w = clampInt(customWidthInput.value, 320, 7680, 1920);
  const h = clampInt(customHeightInput.value, 320, 7680, 1080);
  customWidthInput.value = w;
  customHeightInput.value = h;
  saveRenderedWallpaper(w, h, `prismwall-${seed}-${w}x${h}.png`, w >= h ? 'desktop' : 'mobile');
  setStatus(`Custom ${w} x ${h} export started`);
});

document.getElementById('btnApply').addEventListener('click', async () => {
  try {
    if (!window.__TAURI__) {
      alert('This feature is available only in the desktop app.');
      return;
    }
    const btn = document.getElementById('btnApply');
    btn.textContent = 'Applying...';
    btn.disabled = true;

    const c = document.createElement('canvas');
    c.width = DESKTOP_W;
    c.height = DESKTOP_H;
    const ctx = c.getContext('2d');
    drawPattern(ctx, DESKTOP_W, DESKTOP_H, currentPattern, currentPalette, seed, inverted);
    if (includeClock) drawClockOverlay(ctx, DESKTOP_W, DESKTOP_H, 'desktop', currentPalette, inverted);
    const blob = await canvasBlob(c);
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));
    await window.__TAURI__.core.invoke('set_wallpaper', {
      bytes,
      filename: `prismwall-custom-${seed}.png`,
    });

    await new Promise(r => setTimeout(r, 5000));
    btn.textContent = 'Applied!';
    setTimeout(() => {
      btn.textContent = 'Set Wallpaper';
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    alert('Error: ' + err);
    const btn = document.getElementById('btnApply');
    btn.textContent = 'Set Wallpaper';
    btn.disabled = false;
  }
});

document.addEventListener('keydown', event => {
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT') return;
  if (event.key.toLowerCase() === 'r') document.getElementById('btnShuffle').click();
  if (event.key.toLowerCase() === 's') document.getElementById('btnSurprise').click();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') document.getElementById('btnUndo').click();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') document.getElementById('btnRedo').click();
});

renderRecent();
renderFavorites();
render();
rememberCurrent();
