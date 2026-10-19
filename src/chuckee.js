// The strait between Notbell Labs and Oasis Estates: a footbridge (lamp
// posts all the way, each flying an Oasis Estates banner — the HOA paid for
// the lamps, and would like you to know it), and beside it a two-lane
// highway, with cars on it, actually driving. The highway begins and ends in
// a turnaround loop out over the water, a stride short of either shore:
// there are no roads on any island (BULKO has a sign), and there still
// aren't. In the middle, on an islet the size of a parking lot, the travel
// stop: CHUCKEE'S. A woodchuck in a red cap. The cleanest restrooms on any
// water. A drive-thru window right on the highway.
//
// Local frame: v runs along the strait (Labs → Oasis), u across it (u points
// to the east-ish side, where the highway runs).

import * as THREE from 'three';
import { ISLET_CH, WATER_Y, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching, tone } from './audio.js';
import { buildAnimal } from './animals.js';
import { addIslandInfo, addZonePlace } from './fieldguide.js';
import { glowWindow } from './nightglow.js';
import { ITEMS } from './catalog.js';
import { makeWindow } from './buildings.js';
import { turnToward } from './utils.js';
import { mergeStatic } from './oasis.js';

function mat(color, rough = 0.88) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, seg, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}
function canvasTex(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function sign(lines, { w = 3, h = 0.8, d = 0.08, bg = '#fff7e0', fg = '#b3202c', border = null } = {}) {
  const tex = canvasTex(512, Math.round(512 * (h / w)), (ctx, cw, ch) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = ch * 0.07; ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, cw - ctx.lineWidth, ch - ctx.lineWidth); }
    const L = Array.isArray(lines) ? lines : [lines];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const slot = ch / L.length;
    L.forEach((text, i) => {
      let size = Math.round(slot * (i === 0 ? 0.72 : 0.56));
      do { ctx.font = `bold ${size}px ui-rounded, 'Segoe UI', system-ui, sans-serif`; size -= 2; } while (ctx.measureText(text).width > cw * 0.9 && size > 10);
      ctx.fillStyle = fg;
      ctx.fillText(text, cw / 2, slot * i + slot * 0.54);
    });
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------ the frame ----
const M = ISLET_CH;
const TL = { x: -146, z: -14.5 }; // the Labs' south beach
const TO = { x: -180, z: 24.5 };  // Oasis Estates' north tip
const FL = Math.hypot(TO.x - TL.x, TO.z - TL.z);
const F = { x: (TO.x - TL.x) / FL, z: (TO.z - TL.z) / FL }; // along the strait, Labs → Oasis
const Rt = { x: F.z, z: -F.x };                               // across it
const P = (u, v) => ({ x: M.x + Rt.x * u + F.x * v, z: M.z + Rt.z * u + F.z * v });
const RY = Math.atan2(F.x, F.z); // a thing turned RY faces down the strait toward Oasis
const WALK_U = -2.5, HWY_U = 5.5, LANE = 1.2;
const DECK = 1.2; // the highway's deck top

// march along the walk line from the islet until the ground says "land"
function landAlong(dir) {
  let v = 0;
  while (Math.abs(v) < 40 && terrainHeight(P(WALK_U, v).x, P(WALK_U, v).z) > 0.3) v += dir * 0.25; // off the islet…
  const isletEdge = v - dir * 1.0;
  while (Math.abs(v) < 40 && terrainHeight(P(WALK_U, v).x, P(WALK_U, v).z) <= 0.3) v += dir * 0.25; // …across the water…
  return { isletEdge, shore: v + dir * 1.0 };                                                     // …onto the far shore
}
const NORTH = landAlong(-1), SOUTH = landAlong(1);
export const CHUCKEE_WALK = { labs: NORTH.shore, isletN: NORTH.isletEdge, isletS: SOUTH.isletEdge, oasis: SOUTH.shore };
// the highway's ends: turnaround loops over water, a few strides off each shore
const HWY = { v0: NORTH.shore + 4.5, v1: SOUTH.shore - 5.5 };
// (and pulled back till both loops are clear of any sand — a loop on a beach
// would be a road on an island)
for (const [key, dir] of [['v0', 1], ['v1', -1]]) {
  const clear = (v) => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = M.x + Rt.x * (HWY_U + Math.cos(a) * 3.6) + F.x * (v + Math.sin(a) * 3.6);
      const z = M.z + Rt.z * (HWY_U + Math.cos(a) * 3.6) + F.z * (v + Math.sin(a) * 3.6);
      if (terrainHeight(x, z) > WATER_Y - 0.1) return false;
    }
    return true;
  };
  while (!clear(HWY[key]) && Math.abs(HWY[key]) > 8) HWY[key] += dir * 0.5;
}

// reserve the walks and the store before anyone plants a thing there, and
// tell the villagers they can walk it
for (let v = NORTH.shore; v <= SOUTH.shore; v += 2) { const p = P(WALK_U, v); zones.addKeepout(p.x, p.z, 1.6); }
zones.addLink({ a: 'labs', b: 'chuckee', kind: 'walk', path: [P(WALK_U, NORTH.shore - 2), P(WALK_U, NORTH.shore), P(WALK_U, NORTH.isletEdge), P(WALK_U, -1)] });
zones.addLink({ a: 'chuckee', b: 'oasis', kind: 'walk', path: [P(WALK_U, 1), P(WALK_U, SOUTH.isletEdge), P(WALK_U, SOUTH.shore), P(WALK_U, SOUTH.shore + 3)] });

const IN_STORE = { x: -300, z: 1840 };

const CHUCKEE_LINES = [
  '처키스에 어서 오세요! 모든 물 위에서 가장 큰 휴게소! 모든 물 위에서 유일한 휴게소이기도 해요. 그래도 1등이에요!',
  '화장실은 저쪽이에요. 모든 물 위에서 가장 깨끗해요. 사람들이 울어요. 기쁨의 눈물이에요. 제가 직접 청소해요, 매시간 정각에.',
  '브리스킷은 뜨겁고, 퍼지는 갓 만들었고, 처키 너겟은 바로 그 너겟이에요. 우드척이 나무를 얼마나 척척할까? 몇 년째 아무도 안 물어봐요. 그리워요.',
  '연구소에서 차 타고 오고, 오아시스에서도 차 타고 와요. 어디서 오냐고요? 순환로요. 어디로 가냐고요? 여기요. 그게 고속도로 전부예요. 아주 좋은 고속도로예요.',
];

export function createChuckee(player) {
  const group = new THREE.Group();
  const outdoor = [], inStore = [];
  const at = (u, v, y = 0) => { const p = P(u, v); return new THREE.Vector3(p.x, y, p.z); };
  function put(obj, u, v, y, ry = RY) {
    const p = P(u, v);
    obj.position.set(p.x, y, p.z);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  }
  // a rectangle in the frame, as a blocker / sea wall / surface
  const rectContains = (u0, u1, v0, v1) => (x, z) => {
    const dx = x - M.x, dz = z - M.z;
    const u = dx * Rt.x + dz * Rt.z, v = dx * F.x + dz * F.z;
    return u >= u0 && u <= u1 && v >= v0 && v <= v1;
  };
  const blockRect = (u0, u1, v0, v1) => {
    const c = P((u0 + u1) / 2, (v0 + v1) / 2);
    zones.addBlockerBox(c.x, c.z, u1 - u0, v1 - v0, RY);
  };

  addIslandInfo({
    key: 'chuckee',
    name: '처키스', x: M.x, z: M.z, r: 12, icon: '🦫',
    blurb: '연구소와 오아시스 에스테이츠 사이 해협의 휴게소. 브리스킷, 퍼지, 처키 너겟, 그리고 물 위 어디보다 깨끗한 화장실. 한쪽엔 인도교, 다른 쪽엔 고속도로.',
    folk: '처키(우드척, 빨간 모자)',
    mystery: '“해협에 고속도로가 생겼어. 차가 있어. 달려. 어딘가로. 어디냐고 물었지. 우드척이 ‘여기’래.” —브라인 선장',
  });

  // ================================================== the footbridge ----
  function span(v0, v1) {
    const L = v1 - v0, n = Math.ceil(Math.abs(L) / 0.5);
    const pa = P(WALK_U, v0), pb = P(WALK_U, v1);
    const hA = Math.max(terrainHeight(pa.x, pa.z), 0.2) + 0.05, hB = Math.max(terrainHeight(pb.x, pb.z), 0.2) + 0.05;
    const deck = (v) => { const t = Math.max(0, Math.min(1, (v - v0) / L)); return hA + (hB - hA) * t + Math.sin(t * Math.PI) * 0.7; }; // (flush with the shore at each end)
    for (let k = 0; k < n; k++) {
      const v = v0 + (L * (k + 0.5)) / n, p = P(WALK_U, v);
      const pl = box(1.8, 0.1, Math.abs(L / n) * 0.92, k % 2 ? 0xb8a888 : 0xa89878);
      pl.position.set(p.x, Math.max(deck(v), terrainHeight(p.x, p.z) + 0.05), p.z);
      pl.rotation.y = RY;
      group.add(pl);
    }
    for (const su of [-0.95, 0.95]) {
      for (let k = 0; k <= Math.ceil(Math.abs(L) / 3); k++) {
        const v = v0 + (L * k) / Math.ceil(Math.abs(L) / 3), p = P(WALK_U + su, v);
        const post = cyl(0.06, 0.07, deck(v) + 2.15, 6, 0xe8e0d0); // from under the water up to the rail
        post.position.set(p.x, (deck(v) + 0.95 - 1.2) / 2, p.z);
        group.add(post);
      }
      const mid = P(WALK_U + su, (v0 + v1) / 2);
      const rail = box(0.07, 0.07, Math.abs(L), 0xe8e0d0);
      rail.position.set(mid.x, 1.95, mid.z);
      rail.rotation.y = RY;
      group.add(rail);
    }
    const vmin = Math.min(v0, v1), vmax = Math.max(v0, v1);
    const inside = rectContains(WALK_U - 0.78, WALK_U + 0.78, vmin - 0.3, vmax + 0.3);
    zones.addCrossing({
      contains: inside,
      height: (x, z) => {
        const dx = x - M.x, dz = z - M.z, v = dx * F.x + dz * F.z;
        return Math.max(deck(Math.max(vmin, Math.min(vmax, v))) + 0.05, terrainHeight(x, z));
      },
    });
    zones.addSeaWall({ contains: rectContains(WALK_U - 1.3, WALK_U + 1.3, vmin, vmax) });
  }
  span(NORTH.shore, NORTH.isletEdge);
  span(SOUTH.isletEdge, SOUTH.shore);

  // lamp posts, each flying an Oasis Estates banner (the HOA paid for them)
  const bannerTex = canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2f5f50';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8c86a';
    ctx.fillRect(0, h - 20, w, 20);
    // the palm, the sun, the name
    ctx.fillStyle = '#f2cf5b';
    ctx.beginPath(); ctx.arc(w / 2, 70, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8f7352'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(w / 2, 140); ctx.quadraticCurveTo(w / 2 + 6, 100, w / 2 - 2, 64); ctx.stroke();
    ctx.fillStyle = '#4fae52';
    for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(w / 2 - 2, 64); ctx.rotate(-1.4 + k * 0.7); ctx.beginPath(); ctx.ellipse(22, 0, 24, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#f4efe2';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px ui-rounded, system-ui, sans-serif';
    ctx.fillText('OASIS', w / 2, 180);
    ctx.fillText('ESTATES', w / 2, 206);
    ctx.font = 'bold 13px ui-rounded, system-ui, sans-serif';
    ctx.fillText('계획 커뮤니티', w / 2, 228);
  });
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, flatShading: true, roughness: 0.9, side: THREE.DoubleSide });
  function lamp(u, v, y0) {
    const g = new THREE.Group();
    const post = cyl(0.06, 0.08, 3.0, 6, 0x2a2a2e);
    post.position.y = 1.5;
    const arm = box(0.7, 0.06, 0.06, 0x2a2a2e);
    arm.position.set(0.3, 2.95, 0);
    const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0xfff3d0, 0.4));
    globe.position.set(0.6, 2.75, 0);
    glowWindow(globe, { max: 0.75 });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), bannerMat); // (one double-sided banner, beside the post, not through it)
    banner.position.set(0, 2.1, 0.33);
    banner.rotation.y = Math.PI / 2;
    g.add(post, arm, globe, banner);
    g.traverse((o) => { if (o.isMesh && o !== globe) o.castShadow = true; });
    const p = P(u, v);
    g.position.set(p.x, y0, p.z);
    g.rotation.y = RY + Math.PI / 2; // the arm reaches over the walk
    group.add(g);
    return g;
  }
  for (const [a, b] of [[NORTH.shore, NORTH.isletEdge], [SOUTH.isletEdge, SOUTH.shore]]) {
    const n = Math.max(2, Math.round(Math.abs(b - a) / 5));
    for (let k = 0; k <= n; k++) {
      const v = a + ((b - a) * k) / n;
      const p = P(WALK_U - 1.05, v);
      lamp(WALK_U - 1.05, v, Math.max(terrainHeight(p.x, p.z), 0.9));
    }
  }

  // ===================================================== the highway ----
  {
    const deckMat = mat(0x5d5e63, 0.95);
    const L = HWY.v1 - HWY.v0, n = Math.ceil(L / 4);
    for (let k = 0; k < n; k++) {
      const v = HWY.v0 + (L * (k + 0.5)) / n, p = P(HWY_U, v);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, L / n + 0.02), deckMat);
      seg.position.set(p.x, DECK - 0.15, p.z);
      seg.rotation.y = RY;
      seg.receiveShadow = seg.castShadow = true;
      group.add(seg);
      if (terrainHeight(p.x, p.z) < 0.5) {
        for (const su of [-1.8, 1.8]) {
          const q = P(HWY_U + su, v);
          const pier = cyl(0.25, 0.3, DECK - 0.3 + 1.6, 6, 0xb8b4a8); // (its top stays under the deck)
          pier.position.set(q.x, (DECK - 0.3 - 1.6) / 2, q.z);
          group.add(pier);
        }
      }
      // the dashes down the middle, and the white edge lines
      const dash = box(0.14, 0.02, 1.4, 0xf2cf5b);
      dash.position.set(p.x, DECK + 0.01, p.z);
      dash.rotation.y = RY;
      dash.castShadow = false;
      group.add(dash);
    }
    for (const su of [-2.4, 2.4]) {
      const mid = P(HWY_U + su, (HWY.v0 + HWY.v1) / 2);
      const rail = box(0.1, 0.35, L, 0xd8d8d0);
      rail.position.set(mid.x, DECK + 0.3, mid.z);
      rail.rotation.y = RY;
      group.add(rail);
    }
    // the turnaround loops at either end: round decks out over the water
    for (const v of [HWY.v0, HWY.v1]) {
      const p = P(HWY_U, v);
      const loop = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.3, 18), deckMat);
      loop.position.set(p.x, DECK - 0.15, p.z);
      loop.castShadow = loop.receiveShadow = true;
      group.add(loop);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.12, 4, 24), mat(0xd8d8d0));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, DECK + 0.2, p.z);
      group.add(ring);
      const pier = cyl(0.6, 0.7, DECK - 0.3 + 1.6, 8, 0xb8b4a8);
      pier.position.set(p.x, (DECK - 0.3 - 1.6) / 2, p.z);
      group.add(pier);
      const end = sign(['고속도로 끝', '어떤 섬에도 도로는 없습니다'], { w: 2.2, h: 0.6, bg: '#ffffff', fg: '#2a2a2e', border: '#d8342c' });
      const q = P(HWY_U, v + (v < 0 ? -3.3 : 3.3));
      end.position.set(q.x, DECK + 1.1, q.z);
      end.rotation.y = RY + (v < 0 ? Math.PI : 0);
      group.add(end);
      zones.addSeaWall({ contains: (x, z) => Math.hypot(x - p.x, z - p.z) < 3.7 });
    }
    // nobody walks (or swims) onto a road with cars on it
    zones.addSeaWall({ contains: rectContains(HWY_U - 2.6, HWY_U + 2.6, HWY.v0, HWY.v1) });
    blockRect(HWY_U - 2.6, HWY_U + 2.6, NORTH.isletEdge - 1, SOUTH.isletEdge + 1);
    // a green highway sign, for the joy of it
    const gs = sign(['처키스 — 이번 출구', '연구소 ↑  ·  오아시스 ↓'], { w: 3, h: 1.0, bg: '#2f7a4f', fg: '#ffffff', border: '#ffffff' });
    const gp = P(HWY_U + 3.2, NORTH.isletEdge - 6);
    gs.position.set(gp.x, DECK + 2.6, gp.z);
    gs.rotation.y = RY + Math.PI;
    group.add(gs);
    const gpost = cyl(0.08, 0.08, DECK + 3, 5, 0x9aa0a6);
    gpost.position.set(gp.x, (DECK + 3) / 2 - 0.5, gp.z);
    group.add(gpost);
  }

  // ------------------------------------------------------------- cars ----
  // one loop: down the west lane (past the drive-thru window), round the
  // Oasis loop, up the east lane, round the Labs loop. They keep their
  // distance, they wait for the car ahead, and half of them stop at the
  // window. Nobody has seen them park. They are never parked.
  {
    const path = [];
    const west = HWY_U - LANE, east = HWY_U + LANE;
    for (let v = HWY.v0; v <= HWY.v1; v += 1) path.push({ u: west, v });
    for (let k = 1; k < 12; k++) { const a = Math.PI - (k / 12) * Math.PI; path.push({ u: HWY_U + Math.cos(a) * LANE * 1.6, v: HWY.v1 + Math.sin(a) * LANE * 1.6 }); }
    for (let v = HWY.v1; v >= HWY.v0; v -= 1) path.push({ u: east, v });
    for (let k = 1; k < 12; k++) { const a = -(k / 12) * Math.PI; path.push({ u: HWY_U + Math.cos(a) * LANE * 1.6, v: HWY.v0 + Math.sin(a) * LANE * 1.6 }); }
    const pts = path.map((q) => P(q.u, q.v));
    const segL = pts.map((p, i) => { const n = pts[(i + 1) % pts.length]; return Math.hypot(n.x - p.x, n.z - p.z); });
    const total = segL.reduce((a, b) => a + b, 0);
    const windowD = (() => { let d = 0; for (let i = 0; i < path.length; i++) { if (path[i].u === west && path[i].v >= 0) return d; d += segL[i]; } return 0; })();
    const sample = (d) => {
      d = ((d % total) + total) % total;
      let i = 0;
      while (d > segL[i]) { d -= segL[i]; i = (i + 1) % pts.length; }
      const a = pts[i], b = pts[(i + 1) % pts.length], t = d / segL[i];
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, ry: Math.atan2(b.x - a.x, b.z - a.z) };
    };
    const COLORS = [0xd8342c, 0x3a7dd8, 0xf2cf5b, 0xe8e4dc, 0x2f5f50, 0x9aa0a6];
    const cars = COLORS.map((color, k) => {
      const g = new THREE.Group();
      const body = box(1.7, 0.6, 3.1, color);
      body.position.y = 0.55;
      const cab = box(1.5, 0.55, 1.6, color);
      cab.position.set(0, 1.1, -0.2);
      const glass = box(1.52, 0.35, 0.9, 0xbfe6f2);
      glass.position.set(0, 1.15, 0.35);
      g.add(body, cab, glass);
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 8), mat(0x2e2a26));
        w.rotation.z = Math.PI / 2;
        w.position.set(sx * 0.85, 0.28, sz * 1.0);
        g.add(w);
      }
      const lights = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.05), mat(0xfff3c0, 0.4));
      lights.position.set(0, 0.65, 1.56);
      glowWindow(lights, { max: 0.9 });
      g.add(lights);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.userData.dynamic = true;
      group.add(g);
      return { g, d: (k / COLORS.length) * total, stop: 0, stops: k % 2 === 0, served: false, speed: 0 };
    });
    let honkT = 0;
    outdoor.push((dt, t, pp) => {
      honkT -= dt;
      const ahead = (c) => {
        let best = Infinity;
        for (const o of cars) if (o !== c) { const gap = ((o.d - c.d) % total + total) % total; if (gap > 0 && gap < best) best = gap; }
        return best;
      };
      for (const c of cars) {
        let want = 5.5;
        if (c.stop > 0) { c.stop -= dt; want = 0; }
        else {
          const gap = ahead(c);
          if (gap < 5) want = 0;
          else if (gap < 9) want = Math.min(want, (gap - 5) * 1.4);
          // the drive-thru: every other car pulls up to the window
          const toWin = ((windowD - c.d) % total + total) % total;
          if (c.stops && !c.served && toWin < 6) want = Math.min(want, toWin * 1.2);
          if (c.stops && !c.served && toWin < 0.3) { c.stop = 3 + (c.g.id % 3); c.served = true; }
          if (toWin > total / 2) c.served = false;
          // someone on the road (the islet stretch)? everybody waits
          const p = sample(c.d + 2.2);
          if (Math.hypot(pp.x - p.x, pp.z - p.z) < 1.6) {
            want = 0;
            if (honkT <= 0) { honkT = 6; tone(392, { dur: 0.18, type: 'square', vol: 0.02 }); tone(330, { time: 0.2, dur: 0.22, type: 'square', vol: 0.02 }); }
          }
        }
        c.speed += (want - c.speed) * Math.min(1, dt * 2);
        c.d = (c.d + c.speed * dt) % total;
        const p = sample(c.d);
        c.g.position.set(p.x, DECK, p.z);
        c.g.rotation.y = turnToward(c.g.rotation.y, p.ry, dt, 8);
      }
    });
    register({
      getPos: () => at(2.2, 4.4), r: 2.0, // (at the store's south corner, where you can see the window)
      label: '드라이브스루 구경하기',
      use: () => ui.say([
        '차 한 대가 창구에 멈춰요. 창에서 발이 나와요. 발에 봉지가 들어가요. 차는 순환로를 돌아 다시 와요. 1분 뒤에 돌아와요. 언제나 1분 뒤에요.',
        '운전자를 본 사람은 없어요. 차들은 따뜻해요. 걱정할 필요 없어요.',
      ]),
    });
  }

  // ===================================================== Chuckee's ----
  {
    const SU = 1.0, SW = 3.6, SD = 7.0; // the store: between the walk and the highway
    const g = new THREE.Group();
    const plinth = box(SW + 0.3, 0.6, SD + 0.3, 0x8a8478);
    plinth.position.y = 0.6;
    const body = box(SW, 2.8, SD, 0xf4e8c8);
    body.position.y = 2.3;
    const band = box(SW + 0.05, 0.5, SD + 0.05, 0xd8342c);
    band.position.y = 3.4;
    const roof = box(SW + 0.6, 0.25, SD + 0.6, 0x8a5a3a);
    roof.position.y = 3.8;
    g.add(plinth, body, band, roof);
    // the front (toward the walk): glass doors, round windows
    const door = box(0.12, 1.9, 1.6, 0xbfe6f2);
    door.position.set(-SW / 2 - 0.02, 1.85, 0);
    glowWindow(door);
    g.add(door);
    for (const sv of [-2.2, 2.2]) {
      const w = makeWindow(0.42);
      w.rotation.y = -Math.PI / 2;
      w.position.set(-SW / 2 - 0.02, 2.2, sv);
      g.add(w);
    }
    // the drive-thru window (toward the highway) and its awning
    const dtw = box(0.1, 0.8, 1.2, 0xbfe6f2);
    dtw.position.set(SW / 2 + 0.02, 2.0, 0.6);
    glowWindow(dtw);
    const aw = box(0.9, 0.08, 1.6, 0xd8342c);
    aw.position.set(SW / 2 + 0.45, 2.6, 0.6);
    aw.rotation.z = -0.3;
    g.add(dtw, aw);
    const dts = sign('DRIVE-THRU', { w: 1.6, h: 0.4, bg: '#d8342c', fg: '#fff7e0' });
    dts.rotation.y = Math.PI / 2;
    dts.position.set(SW / 2 + 0.06, 3.0, 0.6);
    g.add(dts);
    const front = sign(['처키스', '휴게소 · 브리스킷 · 퍼지 · 화장실'], { w: 5.2, h: 0.8, bg: '#f2cf5b', fg: '#b3202c', border: '#b3202c' });
    front.rotation.y = -Math.PI / 2;
    front.position.set(-SW / 2 - 0.08, 3.2, 0); // (under the roof's overhang, clear of the door)
    g.add(front);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, SU, 0, 0, RY);
    blockRect(SU - SW / 2 - 0.15, SU + SW / 2 + 0.15, -SD / 2 - 0.15, SD / 2 + 0.15);
    // the pole sign: the woodchuck in the red cap, up where both islands can see it
    const faceTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f2cf5b'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 124, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b3202c'; ctx.lineWidth = 10; ctx.stroke();
      ctx.fillStyle = '#8a5a3a'; ctx.beginPath(); ctx.arc(w / 2, 140, 70, 0, Math.PI * 2); ctx.fill(); // the face
      ctx.fillStyle = '#d8b88a'; ctx.beginPath(); ctx.ellipse(w / 2, 168, 38, 28, 0, 0, Math.PI * 2); ctx.fill(); // muzzle
      ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2 - 12, 182, 11, 18); ctx.fillRect(w / 2 + 1, 182, 11, 18);    // the teeth
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(w / 2 - 26, 128, 8, 0, Math.PI * 2); ctx.arc(w / 2 + 26, 128, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2, 156, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8342c'; ctx.beginPath(); ctx.ellipse(w / 2, 82, 72, 30, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(w / 2 - 20, 78, 100, 12); // the cap
    });
    const pole = cyl(0.18, 0.22, 7.5, 7, 0x9aa0a6);
    const pp = P(SU - 1.6, -4.6);
    pole.position.set(pp.x, 0.9 + 3.75, pp.z);
    group.add(pole);
    for (const side of [0, Math.PI]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 }));
      face.position.set(pp.x, 8.0, pp.z);
      face.rotation.y = RY + Math.PI / 2 + side;
      face.translateZ(0.06);
      group.add(face);
    }
    const disc = cyl(1.65, 1.65, 0.1, 20, 0xb3202c);
    disc.rotation.z = Math.PI / 2;
    disc.rotation.y = RY;
    disc.position.set(pp.x, 8.0, pp.z);
    group.add(disc);
    zones.addBlocker(pp.x, pp.z, 0.3);
    // three pumps, out front, on the walk side, where no car can reach them.
    // "PUMP 1 OF 3." nobody has pumped anything. they are very clean.
    for (let k = 0; k < 3; k++) {
      const pu = box(0.5, 1.3, 0.35, 0xd8342c);
      const q = P(WALK_U + 0.1, -3.5 + k * 1.2);
      pu.position.set(q.x - Rt.x * 1.1, 0.9 + 0.65, q.z - Rt.z * 1.1);
      pu.rotation.y = RY;
      group.add(pu);
      zones.addBlocker(pu.position.x, pu.position.z, 0.35);
    }
    register({
      getPos: () => at(WALK_U - 0.3, -2.3), r: 1.4,
      label: '주유기 구경하기',
      use: () => ui.say('반짝이는 주유기 세 대, 3대 중 1번, 3대 중 2번, 3대 중 3번. 인도교 쪽에 있어요. 어떤 차도 닿을 수 없어요. 각각에 스티커: “모든 물 위에서 가장 깨끗한 주유기.” 맞아요. 닿은 적이 없거든요.'),
    });
    // the door
    const doorOut = P(SU - SW / 2 - 1.3, 0);
    const exitSpot = { x: doorOut.x, z: doorOut.z, rotY: RY - Math.PI / 2 };
    zones.setDoor('chuckee', { x: doorOut.x, z: doorOut.z });
    register({ getPos: () => at(SU - SW / 2 - 0.7, 0), r: 1.6, label: '처키스에 들어가기', use: () => zones.go('chuckee') });

    // ---- inside: jerky wall, nugget aisle, brisket counter, fudge, the restrooms
    const B = IN_STORE;
    const start = group.children.length;
    const fl = box(18, 0.4, 12, 0xe8e0cc);
    fl.position.set(B.x, -0.2, B.z);
    group.add(fl);
    for (const [ww, dd, x, z] of [[18, 0.3, B.x, B.z - 6], [0.3, 12, B.x - 9, B.z], [0.3, 12, B.x + 9, B.z]]) {
      const wl = box(ww, 3.8, dd, 0xf4e8c8);
      wl.position.set(x, 1.9, z);
      group.add(wl);
    }
    const band2 = box(18, 0.4, 0.32, 0xd8342c);
    band2.position.set(B.x, 3.2, B.z - 5.9);
    group.add(band2);
    const blockers = [];
    const X = (l) => B.x + l, Z = (l) => B.z + l;
    // the jerky wall (the back wall, all of it)
    for (let k = 0; k < 24; k++) {
      const j = box(0.5, 0.7, 0.08, [0x8a4a2a, 0x6a3a1a, 0xa85a2a][k % 3]);
      j.position.set(X(-7.5 + (k % 12) * 1.1), 1.2 + Math.floor(k / 12) * 0.9, Z(-5.8));
      group.add(j);
    }
    const jw = sign('육포의 벽', { w: 6, h: 0.6, d: 0.05, bg: '#fff7e0', fg: '#8a4a2a' });
    jw.position.set(X(-1.5), 3.0, Z(-5.75));
    group.add(jw);
    // an aisle of Chuckee Nuggets (bags, bags, bags)
    for (const lz of [-2.2, 0.8]) {
      const shelf = box(6, 1.4, 0.8, 0xd8c8a8);
      shelf.position.set(X(-3), 0.7, Z(lz));
      group.add(shelf);
      for (let k = 0; k < 10; k++) {
        const bag = box(0.4, 0.5, 0.25, k % 2 ? 0xf2cf5b : 0xd8342c);
        bag.position.set(X(-5.6 + k * 0.58), 1.65, Z(lz));
        group.add(bag);
      }
      blockers.push({ x: X(-3), z: Z(lz), w: 6, d: 0.8 });
    }
    // the brisket counter, and Chuckee behind it
    const counter = box(4.5, 1.0, 1.0, 0x8a5a3a);
    counter.position.set(X(5), 0.5, Z(-2.8));
    const top = box(4.6, 0.08, 1.1, 0xfff7e0);
    top.position.set(X(5), 1.04, Z(-2.8));
    const board = box(1.0, 0.1, 0.6, 0x6a4a2a);
    board.position.set(X(5), 1.12, Z(-2.8));
    const brisket = box(0.6, 0.18, 0.35, 0x5a2a1a);
    brisket.position.set(X(5), 1.25, Z(-2.8));
    group.add(counter, top, board, brisket);
    blockers.push({ x: X(5), z: Z(-2.8), w: 4.5, d: 1.0 });
    blockers.push({ x: X(5.6), z: Z(-4.4), w: 5.8, d: 2.2 }); // behind the counter is Chuckee's side
    const chuckee = buildAnimal('groundhog', { body: 0x8a5a3a, head: 0x8a5a3a });
    const cap = new THREE.Group();
    const crown = cyl(0.36, 0.32, 0.18, 9, 0xd8342c);
    crown.position.y = 0.06;
    const brim = box(0.42, 0.04, 0.26, 0xd8342c);
    brim.position.set(0, -0.02, 0.36);
    cap.add(crown, brim);
    cap.position.y = 0.33;
    chuckee.userData.parts.head.add(cap);
    chuckee.position.set(X(5), 0, Z(-4.1));
    chuckee.userData.fidget = true;
    group.add(chuckee);
    inStore.push((dt, t, pp) => {
      const d = Math.hypot(pp.x - chuckee.position.x, pp.z - chuckee.position.z);
      chuckee.rotation.y = turnToward(chuckee.rotation.y, d < 6 ? Math.atan2(pp.x - chuckee.position.x, pp.z - chuckee.position.z) : 0, dt, 3);
    });
    // the fudge case
    const fudge = box(2.2, 1.0, 0.8, 0xbfe6f2);
    fudge.material = new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.6, roughness: 0.2 });
    fudge.position.set(X(5.5), 0.5, Z(1.8));
    group.add(fudge);
    for (let k = 0; k < 6; k++) {
      const f = box(0.28, 0.15, 0.28, [0x4a2a1a, 0xe8d8b8, 0x8a4a2a][k % 3]);
      f.position.set(X(4.7 + (k % 3) * 0.55), 0.85, Z(1.6 + Math.floor(k / 3) * 0.35));
      group.add(f);
    }
    blockers.push({ x: X(5.5), z: Z(1.8), w: 2.2, d: 0.8 });
    // the restrooms. legendary.
    const rr = box(1.4, 2.2, 0.12, 0x3a7dd8);
    rr.position.set(X(-8.9), 1.1, Z(3));
    rr.rotation.y = Math.PI / 2;
    group.add(rr);
    const rrs = sign(['화장실', '모든 물 위에서 가장 깨끗함'], { w: 1.8, h: 0.6, d: 0.04, bg: '#ffffff', fg: '#3a7dd8' });
    rrs.position.set(X(-8.8), 2.6, Z(3));
    rrs.rotation.y = Math.PI / 2;
    group.add(rrs);
    const root = collectInteriorRoot(group, start);
    root.userData.noMerge = true;
    zones.registerInterior('chuckee', {
      root, floorY: 0,
      bounds: { x0: B.x - 8.5, x1: B.x + 8.5, z0: B.z - 5.5, z1: B.z + 5.9 },
      blockers,
      spawn: { x: B.x, z: B.z + 5.3, rotY: Math.PI },
      lighting: { bg: 0x3a3228, fog: 0x3a3228, fogNear: 25, fogFar: 64, hemiSky: 0xfff8e8, hemiGround: 0x9a8a6a, hemiIntensity: 2.0, sunIntensity: 0 },
    });
    addZonePlace('chuckee', '🦫 처키스');
    register({ pos: new THREE.Vector3(B.x, 0, B.z + 5.7), r: 1.5, zone: 'chuckee', label: '밖으로 나가기', use: () => zones.leaveTo(exitSpot) });
    const goods = [
      { id: 'chuckee_nuggets', price: 6, say: '처키 너겟! 달콤 바삭한 콘퍼프 모양 기쁨. 봉지에 몇 개인지 아무도 몰라요. 세어 봤는데, 매번 달라요.' },
      { id: 'brisket_sandwich', price: 12, say: '차돌박이 다져서 번에, 피클과 함께. 어제 물 빠질 때부터 훈연했어요. 천만에요.' },
      { id: 'chuckee_fudge', price: 8, say: '퍼지! 록키 로드에는 진짜 돌이 들어 있어요. 농담이에요. 거의 농담이에요.' },
      { id: 'chuckee_plush', price: 20, say: '작은 나! 작은 모자 쓴! 꾹 눌러 보세요. … 아무 일도 없어요. 눌러 주면 그냥 좋아요.' },
    ];
    register({
      getPos: () => chuckee.position, r: 2.6, zone: 'chuckee', label: '처키와 대화하기',
      use: async () => {
        const c = await ui.ask(CHUCKEE_LINES[Math.floor(Math.random() * CHUCKEE_LINES.length)], [
          ...goods.map((g, k) => ({ label: `${ITEMS[g.id].emoji} ${ITEMS[g.id].name}`, value: String(k), hint: `${g.price}🔘`, disabled: S.state.buttons < g.price })),
          { label: '그냥 지나가는 길이에요', value: null },
        ], { speaker: '처키', voice: 330 });
        if (c === null || c === undefined) return;
        const g = goods[Number(c)];
        S.spend(g.price);
        S.addItem(g.id);
        kaching();
        ui.updateHUD();
        ui.toast(`<b>${ITEMS[g.id].name}</b>을(를) 받았어요.`, ITEMS[g.id].emoji);
        await ui.say(g.say, { speaker: '처키', voice: 330 });
      },
    });
    register({
      pos: new THREE.Vector3(X(-8.2), 0, Z(3)), r: 1.5, zone: 'chuckee', label: '화장실 다녀오기',
      use: async () => {
        await ui.fadeSwap(() => {});
        await ui.say(['본 적 없이 깨끗한 화장실이에요. 깨끗함이라는 개념보다 깨끗해요. 작은 액자 상장: “모든 물 위에서 가장 깨끗함 — 처키 수여.”', '손을 씻었어요. 비누에서 브리스킷 냄새가 희미하게 나요. 묻지 않기로 했어요.']);
      },
    });
    register({
      pos: new THREE.Vector3(X(-1.5), 0, Z(-4.6)), r: 2.0, zone: 'chuckee', label: '육포 벽 감상하기',
      use: () => ui.say('소고기, 칠면조, “바다,” 크랜베리 글레이즈(크랜에서, 인도교로, 고속도로로, 우드척이 직송), 그리고 “처키 스페셜”이라고만 적힌 한 가지 맛. 카운터의 처키: “묻지 마세요. 좋아할 거예요.”'),
    });
  }

  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'island') {
      if (Math.hypot(playerPos.x - M.x, playerPos.z - M.z) > 110) return;
      for (const f of outdoor) f(dt, t, playerPos);
    } else if (zone === 'chuckee') {
      for (const f of inStore) f(dt, t, playerPos);
    }
  }
  mergeStatic(group);
  return { group, update };
}
