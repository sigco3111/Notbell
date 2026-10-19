// The field guide: P opens the chart of the archipelago (click an island
// to learn about it), C opens Old Tansy's Almanac — every fish, bug, fossil,
// tide pool find, and art print you've ever gotten your paws on.

import { terrainHeight, SITES, ISLAND2, ISLAND3, ISLAND4, TEXAS, VOLCANO, WATER_Y } from './terrain.js';
import { ITEMS } from './catalog.js';
import { state, save } from './state.js';
import * as ui from './ui.js';

// world window the chart covers (the world continues past the left edge;
// the chart does not. ask the Labs about it, they think it's very funny)
const MAP = { x0: -130, x1: 200, z0: -165, z1: 145, scale: 2 }; // (Farther runs off the east edge, like the Labs off the west)

const ISLAND_INFO = [
  {
    key: 'notbell',
    name: '낫벨 섬', x: 0, z: 0, r: 40, icon: '🍃',
    blurb: '고향. 종을 잃고 이름을 남긴 섬. 마을 광장, 랜턴 룸, 박물관, 당신의 오두막, 조수 웅덩이, 부두 — 그리고 옛 빛이 잠든 동굴.',
    folk: '핍 · 루나 · 펀 · 칩 · 클로버 · 비스킷 · 하웰 · 퍼들 · 제독 · 브라인 선장 · 머머 (가끔)',
  },
  {
    key: 'far',
    name: '파 아일', x: ISLAND2.x, z: ISLAND2.z, r: 30, icon: '⛪',
    blurb: '해협 건너 조용한 편 — 인도교나 기차로. 바나비의 식료품점, 공동 정원, 옛 노래꾼의 뼈, 그리고 일부러 종루를 비워 둔 듣는 집.',
    folk: '바나비 · 알더 수사 · 새프런 · 브램블 · 매리골드 · 엠버',
    mystery: '“해협 건너편? 더 조용해. 더 푸르고. 그쪽 교회는 종을 안 울려. 그리고 그들은 그게 좋대.” —카페에서 엿들은 말',
  },
  {
    key: 'north',
    name: '북쪽 섬', x: ISLAND3.x, z: ISLAND3.z, r: 26, icon: '📚',
    blurb: '종신 재직한 이끼. 자연 아치를 지나면 고요한 서고, 진료소(모두 건강해요), 버튼왜건과 스튜 수레, 그리고 정박한 마우스보트.',
    folk: '베스퍼 · 길 박사 · 버터팻 · 터스크 · 크럼 · 아주 독한 개구리 한 마리',
    mystery: '“여기서 북쪽은 끝까지 이끼뿐이야. 도서관을 찾아도 아닌 거야 — 근데 반짝이는 거 있으면 하나 가져다줘.” —핍, 도움 안 되게',
  },
  {
    key: 'texas',
    name: '텍사스', x: TEXAS.x, z: TEXAS.z, r: 12, icon: '🤠',
    blurb: '텍사스. 추가 설명은 제공되지 않으며, 필요하지도 않습니다. 인구: 불개미 하나, 새총 하나, 깡통 하나, 엄마의 전구 줄 하나.',
    folk: '페코스',
    mystery: '아주 작은 섬. 물어보면 브라인 선장은 그저 한참을 숨만 내쉬어요.',
  },
  {
    key: 'volcano',
    name: '화산', x: VOLCANO.x, z: VOLCANO.z, r: 25, icon: '🌋',
    blurb: '이 바다의 모든 섬을 만든 뒤 은퇴하셨어요. 편안하면 연기를 뿜어요. 검은 모래 해변, 양심 바, 일광욕 바위. 노 젓는 배나 브라인의 여객선으로.',
    folk: '신더, 그리고 군도에서 가장 따뜻한 바위들',
    mystery: '“연기 나는 산? 그분이 이걸 다 만드셨어. 가서 존경을 표해. 버튼 열 개, 내가 직접 태워다줄게.” —브라인 선장',
  },
  {
    key: 'bulko',
    name: '불코', x: ISLAND4.x, z: ISLAND4.z, r: 26, icon: '🛒',
    blurb: '남쪽 창고 섬. 대용량 파마산, TV 벽, 영원한 1.5단추 핫도그, 그리고 팔지 않는 풀옵션 랍스터 수조. 차들은 걱정할 필요 없어요.',
    folk: '거스 · 랍스터들 (경영진)',
    mystery: '맑은 날이면 남쪽 수평선에 거대하고 회색인 무언가가 앉아 있어요. 보아하니… 체계적이에요.',
  },
];

// registered by island5.js when its corner of the world loads
export function addIslandInfo(info) {
  const existing = ISLAND_INFO.findIndex((isle) => isle.key && isle.key === info.key);
  if (existing >= 0) ISLAND_INFO[existing] = info;
  else ISLAND_INFO.push(info);
  chartDrawn = false;
}

// ------------------------------------------------------- charting ----
// Islands start as grey rumors on the chart; setting foot on one inks it in.

function isleAt(x, z) {
  let best = null, bestD = 1e9;
  for (const isle of ISLAND_INFO) {
    const d = Math.hypot(isle.x - x, isle.z - z);
    if (d < isle.r + 10 && d < bestD) { best = isle; bestD = d; }
  }
  return best;
}

function charted(isle) {
  return !isle.key || !!state.visited[isle.key];
}

// The label the HUD wears — derived from (zone, x, z). Interiors and the moon
// get their own name; out on the island it's the nearest charted shore; open
// water (and anywhere unnamed) is just the archipelago.
const ZONE_PLACES = {
  shop: '🪙 핍의 잡동사니',
  cafe: '☕ 랜턴 룸',
  museum: '🏛️ 낫벨 박물관',
  home: '🏡 우리 오두막',
  cave: '✨ 반딧불 동굴',
  library: '📚 조용한 서고',
  clinic: '🩹 길 박사의 진료소',
  grocery: '🥬 바나비의 식료품점',
  church: '🕯️ 듣는 집',
  manor: '🎩 몰드카이 저택',
  manor_up: '🎩 몰드카이 저택',
  cellar: '🔦 저택 지하실',
  milkroom: '❄️ 우유 냉각실',
  bulko: '🛒 불코',
  labs: '🚀 낫벨 연구소',
  moon: '🌙 달',
  post: '📮 낫벨 우체국',
  kirk: '🐟 대구 성당',
  general: '🥫 파더 제너럴',
};

// rooms built at runtime (the tents and RVs at Farther) name themselves
export function addZonePlace(zone, name) {
  ZONE_PLACES[zone] = name;
}

// whole worlds with neighborhoods of their own (the Dropped Crown) name
// where you are within them
const PLACE_NAMERS = {};
export function addPlaceNamer(zone, fn) {
  PLACE_NAMERS[zone] = fn;
}

export function placeName(zone, x, z) {
  if (PLACE_NAMERS[zone]) return PLACE_NAMERS[zone](x, z);
  if (ZONE_PLACES[zone]) return ZONE_PLACES[zone];
  if (zone.startsWith('house_')) {
    const who = zone.slice(6).replace(/\b\w/g, (c) => c.toUpperCase());
    return `🏠 ${who}’s House`;
  }
  if (zone === 'island') {
    const isle = isleAt(x, z);
    if (isle) return `${isle.icon} ${isle.name}`;
  }
  return '🍃 Notbell Archipelago';
}

// called from the main loop every couple of seconds while outdoors
export function markVisited(player, zone) {
  if (zone !== 'island') return;
  const p = player.group.position;
  for (const isle of ISLAND_INFO) {
    if (!isle.key || state.visited[isle.key]) continue;
    if (Math.hypot(isle.x - p.x, isle.z - p.z) < isle.r) {
      state.visited[isle.key] = true;
      save();
      chartDrawn = false; // the ink is wet; redraw next time
      ui.toast(`지도에 추가: <b>${isle.icon} ${isle.name}</b>. 늙은 탠지의 해도가 조금 채워졌어요.`, '🗺️');
    }
  }
}

// faded ink for unexplored shores
const fogCache = new Map();

function fogColor(hex) {
  if (!fogCache.has(hex)) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c, t) => Math.round(c + (t - c) * 0.68);
    const r = mix((n >> 16) & 255, 0x9c), g = mix((n >> 8) & 255, 0xb0), b = mix(n & 255, 0xb6);
    fogCache.set(hex, `rgb(${r},${g},${b})`);
  }
  return fogCache.get(hex);
}

// ------------------------------------------------------------- the DOM ----

const mapModal = document.createElement('div');
mapModal.id = 'fieldguide-map';
mapModal.className = 'panel';
mapModal.style.display = 'none';
document.body.appendChild(mapModal);

const pedia = document.createElement('div');
pedia.id = 'critterpedia';
pedia.className = 'panel';
pedia.style.display = 'none';
document.body.appendChild(pedia);

const style = document.createElement('style');
style.textContent = `
  #fieldguide-map, #critterpedia {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 8; padding: 18px;
  }
  #fieldguide-map { display: flex; gap: 16px; }
  #fieldguide-map canvas { border-radius: 14px; cursor: pointer; box-shadow: inset 0 0 0 3px var(--edge-2); }
  #fieldguide-map .info { width: 240px; padding-top: 6px; }
  #fieldguide-map .info h3 { margin: 4px 36px 8px 0; }
  #fieldguide-map .info .folk { margin-top: 12px; font-size: 12.5px; opacity: 0.75; }
  #fieldguide-map .legend { margin-top: 12px; font-size: 12px; opacity: 0.7; display: flex; gap: 12px; flex-wrap: wrap; }
  #critterpedia { width: min(660px, calc(100vw - 28px)); max-height: 84vh; overflow-y: auto; }
  #critterpedia .tiles { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); }
  @media (max-width: 700px) {
    #fieldguide-map { flex-direction: column; width: calc(100vw - 28px); max-height: 86vh; overflow-y: auto; }
    #fieldguide-map .info { width: auto; }
  }
  .fg-hint { text-align: center; opacity: 0.55; font-size: 12px; margin-top: 10px; }
`;
document.head.appendChild(style);

// -------------------------------------------------------------- the map ----

let mapCanvas = null;
let chartDrawn = false;
let showIsleNow = null; // the open map's info panel (a click on the chart writes there)

function worldToMap(x, z) {
  return [(x - MAP.x0) * MAP.scale, (z - MAP.z0) * MAP.scale];
}

function drawChart(ctx, w, h) {
  // the sea, then every island the volcano ever made
  ctx.fillStyle = '#7ec3e8';
  ctx.fillRect(0, 0, w, h);
  const step = 1.4;
  for (let z = MAP.z0; z < MAP.z1; z += step) {
    for (let x = MAP.x0; x < MAP.x1; x += step) {
      const hgt = terrainHeight(x, z);
      if (hgt <= WATER_Y) continue;
      let c;
      if (hgt < 0.42) c = '#ecdfa8';
      else if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r + 3) {
        c = hgt > 9 ? '#6e5048' : '#55504c';
      } else if (Math.hypot(x - ISLAND4.x, z - ISLAND4.z) < 14) c = '#595a5e';
      else if (Math.hypot(x - ISLAND3.x, z - ISLAND3.z) < ISLAND3.r + 6) c = '#4f8a52';
      else c = hgt > 4 ? '#4f9a44' : '#6ec45a';
      const owner = isleAt(x, z);
      if (owner && !charted(owner)) c = fogColor(c);
      ctx.fillStyle = c;
      const [px, pz] = worldToMap(x, z);
      ctx.fillRect(px, pz, step * MAP.scale + 0.5, step * MAP.scale + 0.5);
    }
  }
  // island names (uncharted shores keep their secrets)
  ctx.font = '700 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const isle of ISLAND_INFO) {
    const [px, pz] = worldToMap(isle.x, isle.z);
    ctx.fillStyle = charted(isle) ? 'rgba(255,250,240,0.85)' : 'rgba(255,250,240,0.6)';
    ctx.fillText(charted(isle) ? isle.icon + ' ' + isle.name : '❓ ???', px, pz - 6);
  }
  // small site marks on the home island
  ctx.font = '11px sans-serif';
  const marks = [
    [SITES.village, '🏘️'], [SITES.cave, '✨'], [SITES.pools, '🦀'],
    [SITES.home, '🏠'], [SITES.dock, '⚓'],
  ];
  for (const [site, icon] of marks) {
    const [px, pz] = worldToMap(site.x, site.z);
    ctx.fillText(icon, px, pz + 4);
  }
}

function renderMap(player) {
  const w = (MAP.x1 - MAP.x0) * MAP.scale;
  const h = (MAP.z1 - MAP.z0) * MAP.scale;
  if (!mapCanvas) {
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = w;
    mapCanvas.height = h;
    // fixed size on desks, shrink-to-fit on phones (aspect rides along)
    mapCanvas.style.width = `min(${Math.round(w * 0.78)}px, 86vw)`;
    mapCanvas.style.height = 'auto';
    mapCanvas.style.aspectRatio = `${w} / ${h}`;
    mapCanvas.addEventListener('click', (e) => {
      const rect = mapCanvas.getBoundingClientRect();
      const wx = ((e.clientX - rect.left) / rect.width) * (MAP.x1 - MAP.x0) + MAP.x0;
      const wz = ((e.clientY - rect.top) / rect.height) * (MAP.z1 - MAP.z0) + MAP.z0;
      let best = null, bestD = 1e9;
      for (const isle of ISLAND_INFO) {
        const d = Math.hypot(isle.x - wx, isle.z - wz);
        if (d < isle.r + 10 && d < bestD) { best = isle; bestD = d; }
      }
      // (the panel is rebuilt every time the map opens; clicks used to keep
      // writing to the first one, long gone, so nothing seemed to happen)
      if (best) showIsleNow?.(best);
    });
  }
  mapModal.innerHTML = '';
  const closeMap = document.createElement('button');
  closeMap.className = 'closex';
  closeMap.textContent = '✕';
  closeMap.addEventListener('click', closeAll);
  mapModal.appendChild(closeMap);
  mapModal.appendChild(mapCanvas);
  const info = document.createElement('div');
  info.className = 'info';
  info.innerHTML = `<h3>🗺️ The Notbell Archipelago</h3>
    <div>Every island the volcano raised, back when she worked. You live on Notbell Isle, the big one in the middle.</div>
    <div class="folk">Click an island for the gossip.</div>
    <div class="legend"><span>🔴 you</span><span>❓ not yet visited</span></div>
    <div class="fg-hint">P 또는 Esc로 닫기</div>`;
  mapModal.appendChild(info);

  const ctx = mapCanvas.getContext('2d');
  if (!chartDrawn) {
    drawChart(ctx, w, h);
    chartDrawn = true;
    mapCanvas._chart = ctx.getImageData(0, 0, w, h);
  } else {
    ctx.putImageData(mapCanvas._chart, 0, 0);
  }
  // you are here
  const [px, pz] = worldToMap(player.group.position.x, player.group.position.z);
  ctx.fillStyle = '#e8431f';
  ctx.beginPath();
  ctx.arc(px, pz, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fffaf0';
  ctx.lineWidth = 2;
  ctx.stroke();

  showIsleNow = showIsle;
  function showIsle(isle) {
    if (!charted(isle)) {
      info.innerHTML = `<h3>❓ ???</h3>
        <div>${isle.mystery || '해도의 이 부분은 얼룩뿐이에요. 얼룩이 확신에 차 있어요.'}</div>
        <div class="folk"><b>이 근처:</b> 아직 만난 사람이 없어요.</div>
        <div class="fg-hint">직접 상륙하면 해도에 기록돼요</div>`;
      return;
    }
    info.innerHTML = `<h3>${isle.icon} ${isle.name}</h3>
      <div>${isle.blurb}</div>
      <div class="folk"><b>이 근처:</b> ${isle.folk}</div>
      <div class="fg-hint">P 또는 Esc로 닫기</div>`;
  }
}

// ------------------------------------------------------- the critterpedia ----

const SECTIONS = [
  ['fish', '🎣 물고기'],
  ['bug', '🦋 곤충'],
  ['fossil', '🦴 화석'],
  ['pool', '🦀 조수 웅덩이'],
  ['meteor', '☄️ 하늘에서 온 것'],
  ['art', '🖼️ 미술 소장품'],
];

function renderPedia() {
  let html = '<button class="closex" aria-label="닫기">✕</button>' +
    '<h3>📖 늙은 탠지의 도감</h3>' +
    '<div class="sub">등대지기가 바다와 하늘에서 건진 모든 걸 기록했어요. 도감은 두 번째 필적으로 계속 이어져요. 당신의 글씨로요.</div>';
  for (const [kind, title] of SECTIONS) {
    const entries = Object.entries(ITEMS).filter(([, it]) => it.kind === kind);
    const seenCount = entries.filter(([id]) => state.seen[id]).length;
    html += `<h4>${title}<span class="count">${seenCount} / ${entries.length}</span></h4>` +
      `<div class="bar"><i style="width:${Math.round(100 * seenCount / Math.max(1, entries.length))}%"></i></div><div class="tiles">`;
    for (const [id, it] of entries) {
      const n = state.seen[id] || 0;
      const donated = state.donations.includes(id);
      html += n > 0
        ? `<div class="tile${donated ? ' donated' : ''}" title="${it.name}${it.blurb ? ' — ' + it.blurb.replace(/"/g, '&quot;') : ''}">` +
          `<span class="e">${it.emoji}</span><span class="n">${it.name}</span>${n > 1 ? `<span class="c">${n}</span>` : ''}</div>`
        : `<div class="tile unseen"><span class="e">${it.emoji}</span><span class="n">?????</span></div>`;
    }
    html += '</div>';
  }
  html += '<div class="fg-hint">🏛️ = 박물관 기증 · C 또는 Esc로 닫기</div>';
  pedia.innerHTML = html;
  pedia.querySelector('.closex').addEventListener('click', closeAll);
}

function closeAll() {
  mapModal.style.display = 'none';
  pedia.style.display = 'none';
  ui.setVeil(false);
}

// ---------------------------------------------------------------- keys ----

export function initFieldGuide(player) {
  addEventListener('keydown', (e) => {
    if (ui.isBusy()) return;
    if (e.code === 'KeyP') {
      if (mapModal.style.display === 'none') {
        pedia.style.display = 'none';
        renderMap(player);
        mapModal.style.display = 'flex';
        ui.setVeil(true, closeAll);
      } else closeAll();
    } else if (e.code === 'KeyC') {
      if (pedia.style.display === 'none') {
        mapModal.style.display = 'none';
        renderPedia();
        pedia.style.display = 'block';
        ui.setVeil(true, closeAll);
      } else closeAll();
    } else if (e.code === 'Escape' && (mapModal.style.display !== 'none' || pedia.style.display !== 'none')) {
      closeAll();
    }
  });
}
