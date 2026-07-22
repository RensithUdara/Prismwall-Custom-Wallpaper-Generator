import { drawPattern, drawClockOverlay, exportWallpaper, PALETTES, PATTERNS, PATTERN_LABELS, DESKTOP_W, DESKTOP_H, MOBILE_W, MOBILE_H } from './engine.js';

const MAX_SEED = 999999;
const RECENT_KEY = 'prismwall-recent-designs';
const THUMB_W = 150;
const THUMB_H = 94;

const params = new URLSearchParams(window.location.search);
let currentPattern = clampInt(params.get('pattern'), 0, PATTERNS.length - 1, 0);
let currentPalette = clampInt(params.get('palette'), 0, PALETTES.length - 1, 0);
let seed = clampInt(params.get('seed'), 0, MAX_SEED, Math.random() * 10000 | 0);
let inverted = params.get('mode') === 'light';
let statusTimer = null;

const previewDesktop = document.getElementById('previewDesktop');
const previewMobile = document.getElementById('previewMobile');
const grid = document.getElementById('styleGrid');
const row = document.getElementById('paletteRow');
const recentGrid = document.getElementById('recentGrid');
const seedInput = document.getElementById('seedInput');
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
  return {
    pattern: currentPattern,
    palette: currentPalette,
    seed,
    inverted,
  };
}

function stateKey(state) {
  return `${state.pattern}:${state.palette}:${state.seed}:${state.inverted ? 1 : 0}`;
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
  }, 2200);
}

function updateUrl() {
  const next = new URL(window.location.href);
  next.searchParams.set('pattern', currentPattern);
  next.searchParams.set('palette', currentPalette);
  next.searchParams.set('seed', seed);
  next.searchParams.set('mode', inverted ? 'light' : 'dark');
  window.history.replaceState(null, '', next);
}

function getDesignUrl() {
  const next = new URL(window.location.href);
  next.searchParams.set('pattern', currentPattern);
  next.searchParams.set('palette', currentPalette);
  next.searchParams.set('seed', seed);
  next.searchParams.set('mode', inverted ? 'light' : 'dark');
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
  seedInput.value = seed;
  selectedPattern.textContent = PATTERN_LABELS[currentPattern];
  selectedPalette.textContent = PALETTES[currentPalette].name;
  summaryPattern.textContent = PATTERN_LABELS[currentPattern];
  summaryPalette.textContent = PALETTES[currentPalette].name;
  summarySeed.textContent = seed;
}

function render() {
  const dCtx = previewDesktop.getContext('2d');
  const mCtx = previewMobile.getContext('2d');
  drawPattern(dCtx, 640, 360, currentPattern, currentPalette, seed, inverted);
  drawPattern(mCtx, 145, 314, currentPattern, currentPalette, seed, inverted);
  drawClockOverlay(dCtx, 640, 360, 'desktop', currentPalette, inverted);
  drawClockOverlay(mCtx, 145, 314, 'mobile', currentPalette, inverted);
  syncControls();
  updateUrl();
}

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeRecent(items) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 6)));
}

function rememberCurrent() {
  const state = currentState();
  const items = readRecent().filter(item => stateKey(item) !== stateKey(state));
  items.unshift(state);
  writeRecent(items);
  renderRecent();
}

function applyState(state, remember = true) {
  currentPattern = clampInt(state.pattern, 0, PATTERNS.length - 1, 0);
  currentPalette = clampInt(state.palette, 0, PALETTES.length - 1, 0);
  seed = clampInt(state.seed, 0, MAX_SEED, randomSeed());
  inverted = Boolean(state.inverted);
  render();
  if (remember) rememberCurrent();
}

function renderRecent() {
  const items = readRecent();
  recentGrid.innerHTML = '';
  items.forEach(item => {
    const button = document.createElement('button');
    button.className = 'recent-card';
    button.title = designName(item);
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    drawPattern(canvas.getContext('2d'), THUMB_W, THUMB_H, item.pattern, item.palette, item.seed, item.inverted);
    button.appendChild(canvas);
    button.addEventListener('click', () => {
      applyState(item, false);
      setStatus('Recent design restored');
    });
    recentGrid.appendChild(button);
  });
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
    currentPattern = i;
    render();
    rememberCurrent();
  });
});

PALETTES.forEach((pal, i) => {
  const swatch = document.createElement('button');
  swatch.className = 'palette-swatch';
  swatch.title = pal.name;
  swatch.style.background = `linear-gradient(135deg, ${pal.colors[1]}, ${pal.colors[Math.floor(pal.colors.length / 2)]}, ${pal.colors[pal.colors.length - 2]})`;
  row.appendChild(swatch);
  swatch.addEventListener('click', () => {
    currentPalette = i;
    render();
    rememberCurrent();
  });
});

document.getElementById('btnDark').addEventListener('click', () => {
  inverted = false;
  render();
  rememberCurrent();
});

document.getElementById('btnLight').addEventListener('click', () => {
  inverted = true;
  render();
  rememberCurrent();
});

document.getElementById('btnUseSeed').addEventListener('click', () => {
  seed = clampInt(seedInput.value, 0, MAX_SEED, seed);
  render();
  rememberCurrent();
  setStatus('Seed applied');
});

seedInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') document.getElementById('btnUseSeed').click();
});

document.getElementById('btnShuffle').addEventListener('click', () => {
  seed = randomSeed();
  render();
  rememberCurrent();
  setStatus('Seed shuffled');
});

document.getElementById('btnSurprise').addEventListener('click', () => {
  currentPattern = Math.random() * PATTERNS.length | 0;
  currentPalette = Math.random() * PALETTES.length | 0;
  seed = randomSeed();
  inverted = Math.random() > 0.5;
  render();
  rememberCurrent();
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
    seedInput.value = seed;
    setStatus('Copy failed, URL updated');
  }
});

document.getElementById('btnDesktop').addEventListener('click', () => {
  exportWallpaper(DESKTOP_W, DESKTOP_H, currentPattern, currentPalette, seed, inverted, `prismwall-${seed}-desktop-4k.png`);
});

document.getElementById('btnMobile').addEventListener('click', () => {
  exportWallpaper(MOBILE_W, MOBILE_H, currentPattern, currentPalette, seed, inverted, `prismwall-${seed}-iphone.png`);
});

document.getElementById('btnBoth').addEventListener('click', () => {
  exportWallpaper(DESKTOP_W, DESKTOP_H, currentPattern, currentPalette, seed, inverted, `prismwall-${seed}-desktop-4k.png`);
  setTimeout(() => {
    exportWallpaper(MOBILE_W, MOBILE_H, currentPattern, currentPalette, seed, inverted, `prismwall-${seed}-iphone.png`);
  }, 250);
  setStatus('Desktop and iPhone exports started');
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
    drawPattern(c.getContext('2d'), DESKTOP_W, DESKTOP_H, currentPattern, currentPalette, seed, inverted);
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
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

renderRecent();
render();
rememberCurrent();
