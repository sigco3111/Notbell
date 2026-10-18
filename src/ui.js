// All the 2D cozy bits: dialogue box with typewriter text and choices,
// the interaction prompt, toasts, the pockets panel, HUD, and the black
// fade used when stepping through doors.
//
// Everything is plain DOM laid over the canvas; styles live in index.html.

import { state } from './state.js';
import { ITEMS } from './catalog.js';
import { blip } from './audio.js';

function el(tag, id, parent = document.body) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  parent.appendChild(e);
  return e;
}

const hud = el('div', 'hud');
const promptChip = el('div', 'prompt');
const toasts = el('div', 'toasts');
const dialog = el('div', 'dialog');
const nameTag = el('div', 'dialog-name', dialog);
const dialogText = el('div', 'dialog-text', dialog);
const dialogMore = el('div', 'dialog-more', dialog);
const choicesBox = el('div', 'choices');
const pockets = el('div', 'pockets');
pockets.className = 'panel';
const fadeEl = el('div', 'fade');
const veilEl = el('div', 'veil');

// the veil behind modal panels (map, almanac, settings): one click closes
// whatever's open
let veilClose = null;
export function setVeil(on, onClose = null) {
  veilEl.classList.toggle('on', on);
  veilClose = on ? onClose : null;
}
veilEl.addEventListener('click', () => { const f = veilClose; setVeil(false); f?.(); });

// ------------------------------------------------------------- toolbar ----
// one row of buttons for everyone (a column under your right thumb on
// touch). Each speaks fluent keyboard, so nothing downstream had to learn
// about buttons; the key badge teaches the shortcut on desktop.
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const toolbar = el('div', 'toolbar');
function keyTap(code) {
  dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
}
for (const [icon, code, name, badge] of [
  ['🗺️', 'KeyP', '지도', 'P'], ['🎒', 'KeyI', '주머니', 'I'], ['📖', 'KeyC', '도감', 'C'],
  ['🎩', 'KeyH', '모자', 'H'], ['⚙️', null, '설정', null],
]) {
  const b = el('button', null, toolbar);
  b.className = 'tool';
  b.title = name + (badge ? ` (${badge})` : '');
  b.innerHTML = icon + (badge ? `<span class="key">${badge}</span>` : '');
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (busy) return;
    if (code) keyTap(code);
    else dispatchEvent(new CustomEvent('notbell-settings'));
  });
}

// the controls legend: open for a newcomer's first minute, then a pill
const help = document.getElementById('help');
if (help) {
  const seenHelp = (() => { try { return localStorage.getItem('notbell-seen-help'); } catch { return '1'; } })();
  if (!seenHelp) {
    help.classList.add('open');
    setTimeout(() => {
      help.classList.remove('open');
      try { localStorage.setItem('notbell-seen-help', '1'); } catch { /* private window */ }
    }, 75000);
  }
  help.addEventListener('click', () => help.classList.toggle('open'));
}

dialog.style.display = 'none';
choicesBox.style.display = 'none';
pockets.style.display = 'none';
promptChip.style.display = 'none';
dialogMore.textContent = '▾';

// ------------------------------------------------------------- dialogue ----

let busy = false;          // dialogue open → world input frozen
let closedAt = -1e9;       // when the last dialogue closed (for key debounce)

export function justClosed() {
  return performance.now() - closedAt < 250;
}
let typing = false;
let typeTimer = 0;
let advanceFn = null;      // what E/Space/click should do right now
let chooseFn = null;       // resolves the current choice menu
let choiceEls = [];
let choiceIdx = 0;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function talking(on) {
  document.body.classList.toggle('talking', on);
}

export function isBusy() {
  return busy;
}

// onDone: waits for a confirming press (next page / close).
// onComplete: fires the moment the text finishes typing (used for choices).
function typeText(text, voice, { onDone = null, onComplete = null } = {}) {
  typing = true;
  dialogText.textContent = '';
  dialogMore.style.visibility = 'hidden';
  let i = 0;
  clearInterval(typeTimer);

  const finish = () => {
    clearInterval(typeTimer);
    dialogText.textContent = text;
    typing = false;
    if (onComplete) {
      advanceFn = null;
      onComplete();
    } else {
      dialogMore.style.visibility = 'visible';
      advanceFn = onDone;
    }
  };

  typeTimer = setInterval(() => {
    i++;
    dialogText.textContent = text.slice(0, i);
    const ch = text[i - 1];
    if (i % 2 === 0 && ch && /\S/.test(ch)) blip(voice);
    if (i >= text.length) finish();
  }, 24);
  advanceFn = finish; // a press mid-typing skips to the end
}

// say('hi') · say(['page1', 'page2'], {speaker, voice}) — resolves on close.
export function say(pages, { speaker = '', voice = 520 } = {}) {
  const list = (Array.isArray(pages) ? pages : [pages])
    .map((p) => (typeof p === 'string' ? { text: p, speaker, voice } : { speaker, voice, ...p }));
  return new Promise((resolve) => {
    busy = true;
    talking(true);
    dialog.style.display = 'block';
    promptChip.style.display = 'none';
    let idx = 0;
    const showPage = () => {
      const page = list[idx];
      nameTag.textContent = page.speaker;
      nameTag.style.display = page.speaker ? 'block' : 'none';
      typeText(page.text, page.voice, { onDone: () => {
        idx++;
        if (idx < list.length) showPage();
        else {
          dialog.style.display = 'none';
          busy = false;
          talking(false);
          advanceFn = null;
          closedAt = performance.now();
          resolve();
        }
      } });
    };
    showPage();
  });
}

// ask('text?', [{label, value, disabled, hint}], opts) → chosen value.
// The dialogue box stays open; choices appear once the text finishes typing.
export function ask(text, choices, { speaker = '', voice = 520 } = {}) {
  return new Promise((resolve) => {
    busy = true;
    talking(true);
    dialog.style.display = 'block';
    promptChip.style.display = 'none';
    nameTag.textContent = speaker;
    nameTag.style.display = speaker ? 'block' : 'none';
    typeText(text, voice, { onComplete: () => {
      showChoices(choices, (value) => {
        dialog.style.display = 'none';
        busy = false;
        talking(false);
        closedAt = performance.now();
        resolve(value);
      });
    } });
  });
}

// input('What do the islanders call you?', {placeholder, max, long}) →
// the typed string (or '' if left blank). An in-game box, not the browser's.
export function input(text, { speaker = '', voice = 520, placeholder = '', max = 16, long = false, value = '' } = {}) {
  return new Promise((resolve) => {
    busy = true;
    talking(true);
    dialog.style.display = 'block';
    promptChip.style.display = 'none';
    nameTag.textContent = speaker;
    nameTag.style.display = speaker ? 'block' : 'none';
    typeText(text, voice, { onComplete: () => {
      const field = el(long ? 'textarea' : 'input', null, dialog);
      field.placeholder = placeholder;
      if (!long) field.maxLength = max;
      field.value = value;
      const ok = el('button', null, dialog);
      ok.className = 'ok';
      ok.textContent = '확인';
      const clear = el('div', null, dialog);
      clear.style.clear = 'both';
      const done = () => {
        const v = field.value.trim();
        field.remove(); ok.remove(); clear.remove();
        dialog.style.display = 'none';
        busy = false;
        talking(false);
        closedAt = performance.now();
        resolve(long ? v : v.slice(0, max));
      };
      ok.addEventListener('click', (e) => { e.stopPropagation(); done(); });
      field.addEventListener('click', (e) => e.stopPropagation());
      field.addEventListener('keydown', (e) => {
        e.stopPropagation(); // typing is typing — not walking, not hats
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); }
      });
      advanceFn = null;
      setTimeout(() => field.focus(), 30);
    } });
  });
}

function showChoices(choices, done) {
  choicesBox.innerHTML = '';
  choiceEls = [];
  choiceIdx = 0;
  choices.forEach((c, i) => {
    const b = el('button', null, choicesBox);
    b.className = 'choice' + (c.disabled ? ' disabled' : '');
    b.innerHTML = `<span class="num">${i < 9 ? i + 1 : ''}</span><span class="label">${escapeHtml(c.label)}</span>` +
      (c.hint ? `<span class="hint">${escapeHtml(c.hint)}</span>` : '');
    if (!c.disabled) {
      b.addEventListener('click', () => pickChoice(i));
      b.addEventListener('pointerenter', () => { choiceIdx = i; updateChoiceFocus(); });
    }
    choiceEls.push(b);
  });
  // focus first enabled choice
  choiceIdx = choices.findIndex((c) => !c.disabled);
  if (choiceIdx < 0) choiceIdx = 0;
  updateChoiceFocus();
  choicesBox.style.display = 'flex';
  // stack just above the dialogue box, however tall it grew
  const r = dialog.getBoundingClientRect();
  choicesBox.style.bottom = `${Math.round(innerHeight - r.top + 14)}px`;
  chooseFn = (i) => {
    if (choices[i]?.disabled) return;
    choicesBox.style.display = 'none';
    chooseFn = null;
    done(choices[i].value);
  };

  function pickChoice(i) {
    chooseFn?.(i);
  }
}

function updateChoiceFocus() {
  choiceEls.forEach((b, i) => b.classList.toggle('focused', i === choiceIdx));
}

function moveChoice(dir) {
  if (!choiceEls.length) return;
  for (let step = 0; step < choiceEls.length; step++) {
    choiceIdx = (choiceIdx + dir + choiceEls.length) % choiceEls.length;
    if (!choiceEls[choiceIdx].classList.contains('disabled')) break;
  }
  updateChoiceFocus();
}

// Dialogue input. interact.js checks isBusy() first, so no double-handling.
addEventListener('keydown', (e) => {
  if (!busy) {
    if (e.code === 'KeyI') togglePockets();
    else if (e.code === 'Escape') pockets.style.display = 'none';
    return;
  }
  if (chooseFn) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') moveChoice(-1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') moveChoice(1);
    else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') chooseFn(choiceIdx);
    else if (/^Digit[1-9]$/.test(e.code)) chooseFn(Number(e.code[5]) - 1);
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
    advanceFn?.();
    if (e.code === 'Space') e.preventDefault();
  }
});

dialog.addEventListener('click', () => advanceFn?.());

// --------------------------------------------------------------- prompt ----

promptChip.addEventListener('pointerdown', (e) => { e.preventDefault(); keyTap('KeyE'); });

export function prompt(text) {
  if (!text || busy) {
    promptChip.style.display = 'none';
  } else {
    promptChip.innerHTML = `<b>${isTouch ? '터치' : 'E'}</b> ${escapeHtml(text)}`;
    promptChip.style.display = 'block';
  }
}

// ---------------------------------------------------------------- toast ----

export function toast(text, emoji = '') {
  const t = el('div', null, toasts);
  t.className = 'toast';
  t.innerHTML = `${emoji ? emoji + ' ' : ''}${text}`;
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3400);
}

export function foundItem(id) {
  const it = ITEMS[id];
  if (!it) return;
  toast(`You got a <b>${escapeHtml(it.name)}</b>! <i>${escapeHtml(it.blurb)}</i>`, it.emoji);
}

// ------------------------------------------------------------------ HUD ----

export function updateHUD() {
  const tools = Object.entries(state.tools)
    .filter(([t, owned]) => owned && ITEMS[t]) // (an unknown tool in an old save used to stop the boot)
    .map(([t]) => ITEMS[t].emoji)
    .join(' ');
  hud.innerHTML =
    `<span class="chip">🔘 ${state.buttons}</span>` +
    (tools ? `<span class="chip">${tools}</span>` : '');
}

// -------------------------------------------------------------- pockets ----

export function togglePockets() {
  if (pockets.style.display === 'none') {
    renderPockets();
    pockets.style.display = 'block';
  } else {
    pockets.style.display = 'none';
  }
}

const POCKET_GROUPS = [
  ['🐟 물고기', ['fish']], ['🦋 곤충', ['bug']], ['🦴 화석', ['fossil']], ['🦀 조수 웅덩이', ['tidepool', 'pool']],
  ['🐚 조개·별·운석', ['shell', 'star', 'meteor']], ['🍊 과일·농작물', ['fruit', 'produce']], ['🖼️ 미술품', ['art']],
  ['🎩 모자', ['hat']], ['🧰 도구', ['gear', 'tool', 'seed']],
];
function renderPockets() {
  const owned = Object.entries(state.inv)
    .map(([id, n]) => ({ id, it: ITEMS[id], n }))
    .filter(({ it, n }) => it && n > 0);
  const tile = ({ it, n }) =>
    `<div class="tile" title="${escapeHtml(it.name)}${it.blurb ? ' — ' + escapeHtml(it.blurb) : ''}">` +
    `<span class="e">${it.emoji}</span><span class="n">${escapeHtml(it.name)}</span>` +
    (n > 1 ? `<span class="c">${n}</span>` : '') + '</div>';
  const used = new Set();
  let body = '';
  for (const [title, kinds] of POCKET_GROUPS) {
    const list = owned.filter((o) => kinds.includes(o.it.kind));
    if (!list.length) continue;
    list.forEach((o) => used.add(o.id));
    body += `<h4>${title}<span class="count">${list.reduce((a, o) => a + o.n, 0)}</span></h4><div class="tiles">${list.map(tile).join('')}</div>`;
  }
  const rest = owned.filter((o) => !used.has(o.id));
  if (rest.length) body += `<h4>✨ 기념품<span class="count">${rest.reduce((a, o) => a + o.n, 0)}</span></h4><div class="tiles">${rest.map(tile).join('')}</div>`;
  const worth = owned.reduce((a, o) => a + (o.it.price > 0 && o.it.kind !== 'gear' ? o.it.price * o.n : 0), 0);
  const donated = state.donations.length;
  const owner = state.name ? `${escapeHtml(state.name)}의 ` : '';
  pockets.innerHTML =
    `<button class="closex" aria-label="닫기">✕</button>` +
    `<h3>🎒 ${owner}주머니</h3>` +
    (body || `<div class="sub">텅 비었어요. 섬에는 온갖 것이 가득한데…</div>`) +
    `<div class="total"><span>🔘 버튼 ${state.buttons}개</span>` +
    (worth ? `<span class="dim">주머니 가치 ~${worth}🔘</span>` : '') + `</div>` +
    (donated ? `<div class="sub" style="margin-top:6px">🏛️ 박물관에 ${donated}점 기증함</div>` : '') +
    `<div class="foot">${isTouch ? '🎒를 눌러 닫기' : 'I 또는 Esc로 닫기'}</div>`;
  pockets.querySelector('.closex').addEventListener('click', () => {
    pockets.style.display = 'none';
  });
}

// ----------------------------------------------------------------- fade ----

// Fade to black, run fn (teleport, lighting swap), fade back in.
export function fadeSwap(fn) {
  return new Promise((resolve, reject) => {
    fadeEl.classList.add('on');
    setTimeout(async () => {
      try {
        await fn?.();
        fadeEl.classList.remove('on');
        setTimeout(resolve, 350);
      } catch (err) {
        fadeEl.classList.remove('on');
        setTimeout(() => reject(err), 350);
      }
    }, 380);
  });
}

document.addEventListener('notbell-mute', (e) => {
  toast(e.detail ? '소리 꺼짐.' : '소리 켜짐.', e.detail ? '🔇' : '🔔');
});
