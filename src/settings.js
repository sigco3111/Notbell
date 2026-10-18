// Settings: a quiet panel behind the title chip (or the ⚙ button on touch).
// Display name, a sound toggle, and a clock nudge for travelers — all
// optional, none of it required to play.

import { state, save } from './state.js';
import * as ui from './ui.js';
import { isMuted } from './audio.js';

export function initSettings() {
  window.__notbellTz = state.tz || 0;

  const panel = document.createElement('div');
  panel.id = 'settings';
  panel.className = 'panel';
  panel.style.display = 'none';
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #settings {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(440px, calc(100vw - 28px)); max-height: 86vh; overflow-y: auto;
      z-index: 9; padding: 20px 22px;
    }
    #settings .row { display: flex; gap: 8px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
    #settings input, #settings select {
      font: inherit; color: inherit; background: #fff;
      border: 3px solid var(--edge); border-radius: 12px; padding: 7px 11px; flex: 1; min-width: 120px; outline: none;
    }
    #settings input:focus, #settings select:focus { border-color: var(--accent); }
    #settings button:not(.closex) {
      font: inherit; background: var(--gold); color: var(--gold-ink); border: none;
      border-radius: 12px; padding: 8px 15px; cursor: pointer; font-weight: 800;
    }
    #settings button.soft { background: var(--edge-2); color: var(--ink); }
    #settings .keys { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; }
    #settings kbd {
      font-family: inherit; font-size: 11px; font-weight: 800; background: var(--gold); color: var(--gold-ink);
      border-radius: 5px; padding: 1px 6px;
    }
  `;
  document.head.appendChild(style);

  let open = false;

  function render() {
    panel.innerHTML = `
      <button class="closex" aria-label="닫기">✕</button>
      <h3>⚙️ 설정</h3>
      <div class="sub">여기 있는 건 전부 선택 사항이에요. 섬은 어느 쪽이든 상관없어 해요.</div>

      <h4>당신</h4>
      <div class="row">
        <input id="set-name" maxlength="16" placeholder="표시 이름" value="${ui.escapeHtml(state.name || '')}">
        <button id="set-name-go">바꾸기</button>
      </div>

      <h4>소리</h4>
      <div class="row">
        <button id="set-sound" class="soft">${isMuted() ? '🔇 소리가 꺼져 있어요 — 켜기' : '🔔 소리가 켜져 있어요 — 끄기'}</button>
      </div>

      <h4>시계</h4>
      <div class="row">
        <select id="set-tz">
          ${[...Array(25)].map((_, i) => {
            const v = i - 12;
            const label = v === 0 ? '기기 시계 (권장)' : `${v > 0 ? '+' : ''}${v}시간 조정`;
            return `<option value="${v}" ${v === (state.tz || 0) ? 'selected' : ''}>${label}</option>`;
          }).join('')}
      </select>
      </div>
      <div class="sub">낮과 밤, 날씨 시간표가 이 시계를 따라가요.</div>

      <h4>조작법</h4>
      <div class="keys">
        <span><kbd>WASD</kbd></span><span>걷기 — 빠르게 두 번(또는 Shift 유지) 달리기</span>
        <span><kbd>drag</kbd></span><span>카메라 돌리기 · 스크롤/핀치로 확대</span>
        <span><kbd>E</kbd></span><span>말 걸기 · 사용 · 줍기 (또는 안내 누르기)</span>
        <span><kbd>P</kbd></span><span>지도</span>
        <span><kbd>I</kbd></span><span>주머니</span>
        <span><kbd>C</kbd></span><span>늙은 탠지의 도감</span>
        <span><kbd>H</kbd></span><span>모자 바꿔 쓰기</span>
        <span><kbd>O</kbd></span><span>친구 섬 방문 (또는 초대)</span>
        <span><kbd>M</kbd></span><span>소리 켜기 / 끄기</span>
      </div>
      <div class="foot">Esc로 닫기</div>
    `;

    panel.querySelector('.closex').onclick = hide;
    panel.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    panel.querySelector('#set-name-go').onclick = () => {
      const v = panel.querySelector('#set-name').value.trim().slice(0, 16);
      if (!v) return;
      state.name = v;
      save();
      ui.updateHUD();
      ui.toast(`이제 섬 사람들이 당신을 <b>${ui.escapeHtml(v)}</b>(이)라고 불러요.`, '✨');
    };
    panel.querySelector('#set-sound').onclick = () => {
      // M is the mute key; settings speaks fluent keyboard, like everything
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
      render();
    };
    panel.querySelector('#set-tz').onchange = (e) => {
      state.tz = parseInt(e.target.value, 10) || 0;
      window.__notbellTz = state.tz;
      save();
      ui.toast(state.tz === 0 ? '섬이 다시 당신의 시계를 따라요.' : `섬 시계를 ${state.tz > 0 ? '+' : ''}${state.tz}시간 조정했어요.`, '🕰️');
    };
  }

  function show() {
    if (ui.isBusy()) return;
    render();
    panel.style.display = 'block';
    open = true;
    ui.setVeil(true, hide);
  }

  function hide() {
    panel.style.display = 'none';
    open = false;
    ui.setVeil(false);
  }

  document.getElementById('title')?.addEventListener('click', () => (open ? hide() : show()));
  addEventListener('notbell-settings', () => (open ? hide() : show()));
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) hide();
  });
}
