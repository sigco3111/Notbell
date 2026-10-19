// The strait between the islands, and the two ways across it: a gently
// arched plank bridge you can walk, and beside it a rail bridge with a
// little red train that shuttles back and forth all day, whistling.

import * as THREE from 'three';
import { terrainHeight, ISLAND2, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { defineLine, createRailway, marchToWater } from './railway.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

// ------------------------------------------------------------ the line ----
// march along the strait to find the two shores
const dir = new THREE.Vector2(ISLAND2.x, ISLAND2.z).normalize();

function findShore(fromT, step) {
  // walk along the center line until we leave land
  let t = fromT;
  for (let i = 0; i < 400; i++) {
    if (terrainHeight(dir.x * (t + step), dir.y * (t + step)) < 0.15) break;
    t += step;
  }
  return t;
}

const dist2 = Math.hypot(ISLAND2.x, ISLAND2.z);
const tA = findShore(24, 0.5);            // island 1 shore (outbound)
const tB = findShore(dist2 - 14, -0.5);   // far isle shore (walking back)
const A = { x: dir.x * tA, z: dir.y * tA };
const B = { x: dir.x * tB, z: dir.y * tB };
const hA = terrainHeight(A.x, A.z);
const hB = terrainHeight(B.x, B.z);
const LEN = Math.hypot(B.x - A.x, B.z - A.z);
const along = { x: (B.x - A.x) / LEN, z: (B.z - A.z) / LEN };
const perp = { x: -along.z, z: along.x }; // rail bridge sits this way

const DECK_HALF_W = 1.7;
const RAIL_OFFSET = 6;

function pointAt(t, offset = 0) {
  return {
    x: A.x + along.x * t * LEN + perp.x * offset,
    z: A.z + along.z * t * LEN + perp.z * offset,
  };
}

function deckY(t) {
  return hA + (hB - hA) * t + Math.sin(t * Math.PI) * 2.0 + 0.55;
}

// walkable corridor test + height, consumed by zones.js
export function contains(x, z) {
  const dx = x - A.x, dz = z - A.z;
  const t = (dx * along.x + dz * along.z) / LEN;
  if (t < -0.02 || t > 1.02) return false;
  const off = dx * perp.x + dz * perp.z;
  return Math.abs(off) < DECK_HALF_W - 0.25;
}

export function deckHeight(x, z) {
  const t = Math.max(0, Math.min(1, ((x - A.x) * along.x + (z - A.z) * along.z) / LEN));
  return deckY(t);
}

zones.addCrossing({ contains, height: deckHeight });

// the rail line runs parallel, RAIL_OFFSET off to one side; its platforms go
// on the side away from the footbridge so the two never crowd each other
const RAIL_A = marchToWater(pointAt(-12 / LEN, RAIL_OFFSET), pointAt(1, RAIL_OFFSET), 2);
const RAIL_B = marchToWater(pointAt(1 + 12 / LEN, RAIL_OFFSET), pointAt(0, RAIL_OFFSET), 2);
// keep the footbridge's feet clear of cottages and trees planted later
zones.addKeepout(A.x - along.x * 3, A.z - along.z * 3, 5);
zones.addKeepout(B.x + along.x * 3, B.z + along.z * 3, 5);
// platform side: whichever is AWAY from the footbridge (railway.js measures
// "across" as (cos h, -sin h) of the rail heading)
const railH = Math.atan2(RAIL_B.x - RAIL_A.x, RAIL_B.z - RAIL_A.z);
const awaySide = Math.sign(Math.cos(railH) * perp.x - Math.sin(railH) * perp.z) || 1;
const RAIL_LINE = defineLine({
  points: [RAIL_A, RAIL_B],
  sides: [awaySide, awaySide],
  stops: [
    { name: '낫벨', toward: { x: 0, z: 0 } },
    { name: '파 아일', toward: { x: ISLAND2.x, z: ISLAND2.z } },
  ],
});

// ------------------------------------------------------------- meshes ----

export function createBridge(player, animals = []) {
  const group = new THREE.Group();
  const updates = [];

  // planks, railings, pilings
  const nPlanks = Math.ceil(LEN / 1.1);
  const plankDepth = LEN / nPlanks + 0.16;
  for (let i = 0; i <= nPlanks; i++) {
    const t = i / nPlanks;
    const p = pointAt(t);
    const plank = box(DECK_HALF_W * 2 + 0.3, 0.18, plankDepth, i % 7 === 3 ? 0x96703f : 0xa97c50);
    plank.position.set(p.x, deckY(t), p.z);
    plank.rotation.y = Math.atan2(along.x, along.z);
    plank.receiveShadow = true;
    group.add(plank);
  }
  for (let i = 0; i <= nPlanks; i += 3) {
    const t = i / nPlanks;
    for (const side of [-1, 1]) {
      const p = pointAt(t, side * DECK_HALF_W);
      const post = box(0.14, 1.0, 0.14, 0x8a5a3a);
      post.position.set(p.x, deckY(t) + 0.55, p.z);
      group.add(post);
    }
    if (t > 0.05 && t < 0.95 && i % 6 === 0) {
      const p = pointAt(t);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, deckY(t) - WATER_Y + 2.4, 6), mat(0x6b4a2e));
      pile.position.set(p.x, (deckY(t) + WATER_Y - 2.4) / 2, p.z);
      group.add(pile);
    }
  }
  for (const side of [-1, 1]) {
    // handrails as long thin boxes laid along the arc in segments
    for (let i = 0; i < nPlanks; i += 3) {
      const t0 = i / nPlanks, t1 = Math.min(1, (i + 3) / nPlanks);
      const p0 = pointAt(t0, side * DECK_HALF_W);
      const p1 = pointAt(t1, side * DECK_HALF_W);
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const rail = box(0.1, 0.1, len + 0.35, 0x96703f);
      rail.position.set((p0.x + p1.x) / 2, (deckY(t0) + deckY(t1)) / 2 + 1.05, (p0.z + p1.z) / 2);
      rail.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      rail.rotation.x = Math.atan2(deckY(t0) - deckY(t1), len);
      group.add(rail);
    }
  }

  // villagers may walk it too (zones routes: Notbell ⇄ Far Isle on foot)
  zones.addLink({
    a: 'notbell', b: 'far', kind: 'walk',
    path: [
      { x: A.x - along.x * 3, z: A.z - along.z * 3 }, { x: A.x, z: A.z },
      { x: B.x, z: B.z }, { x: B.x + along.x * 3, z: B.z + along.z * 3 },
    ],
  });

  // ---------------------------------------------------- the strait line ----
  // the little red train runs beside the footbridge, built from the railway
  // kit like every line in the archipelago (see railway.js)
  const rail = createRailway(RAIL_LINE, {
    player, animals, name: '기차',
    colors: { loco: 0xb0453a, cab: 0x8a3a30, cars: [0xd9a440, 0x4f8f6a], roof: 0xc97b63 },
    dwell: 20, whistle: [620, 830],
    text: {
      board: '모두 탑승하세요. 창가 자리에서 보는 해협 — 이보다 좋을 수 없어요.',
      wait: '승강장이 희미하게 웅웅거려요. 금방 올 거예요.',
      queued: '레일이 포근하게 달각거려요. 뭔가 오고 있는 걸 아는 레일들의 방식대로요.',
      kept: '기차는 당신이 기다린 걸 기억해요. 모두 탑승하세요.',
      arrive: ['다시 집. 기차는 아무 말 없이, 다정하게요.', '파 아일! 기차가 조용히 뿌듯해 보여요.'],
    },
  });
  group.add(rail.group);

  function update(dt, t) {
    rail.update(dt, t);
    for (const u of updates) u(dt, t);
  }

  return { group, update, debug: rail.debug };
}
