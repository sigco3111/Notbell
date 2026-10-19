// The Labs' grounds — what the Labs do outdoors when they aren't launching
// things. A wildflower meadow in the middle of the isle, worked by a
// butterfly and a bee who take it very seriously; a gift kiosk (merch!); a
// baby rover behind it with bangs, "vaping" water vapor, who would like
// you to know it isn't a phase; blueberry bushes wherever blueberries felt
// like it; and, off the south shore, a beach: rovers on towels, sandcastles,
// a ball that never quite gets dropped, and one mole on his break.
// Plus picnic tables — the Labs (and BULKO) love a picnic table.
//
// Placement is deterministic without touching the seeded PRNG (a small
// hash), so adding this never reshuffles anything placed after it.

import * as THREE from 'three';
import { SITES, ISLAND6, ISLAND6_BEACH, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';
import { buildAnimal, animateGait } from './animals.js';
import { buildRover } from './island6.js';
import { kaching, jingle, tone } from './audio.js';
import { turnToward, smoothstep } from './utils.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
const hash = (i, k = 0) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function sign(text, w, h, bg = '#f3efe2', fg = '#2e3e6b') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const c = cv.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let size = cv.height * 0.6;
  do { c.font = `800 ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`; size -= 2; } while (c.measureText(text).width > cv.width * 0.9 && size > 10);
  c.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

export function createLabsGrounds() {
  const group = new THREE.Group();
  group.name = 'labsgrounds';
  const updates = [];

  // somewhere open near (x, z): dry, clear of everything, within reach
  function openSpot(x, z, clear = 1.5, maxR = 8) {
    for (let r = 0; r <= maxR; r += 0.75) {
      for (let k = 0; k < (r ? 12 : 1); k++) {
        const a = (k / 12) * Math.PI * 2 + r;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (terrainHeight(px, pz) > 0.35 && !zones.nearAnything(px, pz, clear)) return { x: px, z: pz, y: terrainHeight(px, pz) };
      }
    }
    return null;
  }

  // =================================================== the picnic tables ----
  function picnicTable(x, z, ry) {
    const g = new THREE.Group();
    const top = box(1.9, 0.12, 0.95, 0xa97c50);
    top.position.y = 0.78;
    g.add(top);
    for (const sz of [-0.8, 0.8]) {
      const bench = box(1.9, 0.1, 0.34, 0x96703f);
      bench.position.set(0, 0.45, sz);
      g.add(bench);
    }
    for (const sx of [-0.75, 0.75]) {
      const legs = box(0.1, 0.78, 1.8, 0x7a5a3a);
      legs.position.set(sx, 0.39, 0);
      g.add(legs);
    }
    g.rotation.y = ry;
    g.position.set(x, terrainHeight(x, z), z);
    group.add(g);
    zones.addBlockerBox(x, z, 1.95, 2.0, ry, 0.02);
    return g;
  }
  const BB = SITES.bigbox;
  if (BB) {
    for (const [dx, dz, ry] of [[-9, 8, 0.1], [-11, 4.5, -0.2]]) {
      const sp = openSpot(BB.x + dx, BB.z + dz, 1.8, 6);
      if (sp) picnicTable(sp.x, sp.z, ry);
    }
  }

  // ==================================================== the wildflower meadow ----
  // a wide, lavish oval of it across the middle of the isle: daisies,
  // tulips, poppies, lupine spikes, a stand of sunflowers, rose bushes. Two
  // thousand flowers is a lot of meshes — so they're instanced: one mesh per
  // shape-and-color, however many flowers it draws.
  const M0 = openSpot(ISLAND6.x - 1, ISLAND6.z + 8, 1.0, 10) ?? { x: ISLAND6.x, z: ISLAND6.z + 8, y: 1 };
  // (wider than it was, and ragged at the edges: full in the middle,
  // thinning out toward the rim and toward the Labs — see flowerDensity)
  const M = { x: M0.x - 3, z: M0.z, y: M0.y, rx: 25, rz: 17 };
  const M_CORE = { rx: 19, rz: 13 }; // the old, tidier oval: the kiosk still keys off it
  const inMeadow = (x, z, k = 1) => ((x - M.x) / (M.rx * k)) ** 2 + ((z - M.z) / (M.rz * k)) ** 2 < 1;
  const Y6 = SITES.labsYard, P6 = SITES.labsPad;
  // the places around the meadow, claimed before a single flower goes in:
  // the gift kiosk (toward the Labs), the hive (the empty north), and the
  // butterflies' house (the west edge)
  const kx = M.x + M_CORE.rx * 0.75, kz = M.z + M_CORE.rz + 2.5;
  const K = openSpot(kx, kz, 2.8, 8) ?? { x: kx, z: kz, y: terrainHeight(kx, kz) };
  const HV = openSpot(ISLAND6.x - 12, ISLAND6.z - 22, 3.6, 12) ?? { x: ISLAND6.x - 12, z: ISLAND6.z - 22, y: terrainHeight(ISLAND6.x - 12, ISLAND6.z - 22) };
  // the butterflies' house: out back, next door to the hive, in its own
  // garden of great big flowers
  const BH = openSpot(HV.x + 10, HV.z + 2, 4.2, 10) ?? { x: HV.x + 10, z: HV.z + 2, y: terrainHeight(HV.x + 10, HV.z + 2) };
  const toM = Math.hypot(M.x - BH.x, M.z - BH.z) || 1;
  const ARBOR = { x: BH.x + ((M.x - BH.x) / toM) * 5.2, z: BH.z + ((M.z - BH.z) / toM) * 5.2 }; // the arbor runs toward the meadow
  // the little hill in the middle of the meadow: its top is where the moles
  // come up (the Burrough's molehill; burrough.js builds it here)
  let HILL = null;
  for (let x = M.x - 14; x <= M.x + 2; x += 0.5) {
    for (let z = M.z - 14; z <= M.z + 2; z += 0.5) {
      const h = terrainHeight(x, z);
      if (!zones.nearAnything(x, z, 1.4) && (!HILL || h > HILL.y + 0.01)) HILL = { x, z, y: h };
    }
  }
  const claimed = [[K, 3.4], [HV, 4.5], [BH, 5.5], [ARBOR, 2.4], [HILL, 1.25]];
  // the Labs' picnic tables: down by the kiosk, on the way to the beach
  // (they used to be out by the hive; the butterflies moved in)
  for (const [dx, dz, ry] of [[-6, 3, 0.2], [-9.5, 0.5, -0.3], [-5, 6.5, 0.5]]) {
    const sp = openSpot(K.x + dx, K.z + dz, 1.9, 5);
    if (sp) { picnicTable(sp.x, sp.z, ry); claimed.push([sp, 1.8]); }
  }
  // how thick the flowers grow here: full in the middle, thinning to a
  // ragged edge (a wobble in the rim, so it's no tidy oval), and sparser
  // toward the Labs
  const flowerDensity = (x, z) => {
    const a = Math.atan2(z - M.z, x - M.x);
    const wob = 1 + 0.16 * Math.sin(3 * a + 1.3) + 0.1 * Math.sin(5 * a + 0.4) + 0.06 * Math.sin(8 * a + 2.1);
    const rn = Math.hypot((x - M.x) / M.rx, (z - M.z) / M.rz) / wob;
    let d = smoothstep(1.05, 0.4, rn);
    d *= smoothstep(1, 16, Math.hypot(x - Y6.x, z - Y6.z) - Y6.r);
    d *= smoothstep(1, 10, Math.hypot(x - P6.x, z - P6.z) - P6.r);
    // and full again round the hive and the butterflies' house
    d = Math.max(d, 0.85 * smoothstep(9, 4, Math.hypot(x - (HV.x + BH.x) / 2, z - (HV.z + BH.z) / 2)));
    // and a ring of them round the molehill, up on its hill
    const hd = Math.hypot(x - HILL.x, z - HILL.z);
    if (hd < 3.4) d = Math.max(d, 0.95);
    return d;
  };
  const meadowOK = (x, z) => terrainHeight(x, z) > 0.4 &&
    Math.hypot(x - Y6.x, z - Y6.z) > Y6.r + 1 && Math.hypot(x - P6.x, z - P6.z) > P6.r + 1 &&
    claimed.every(([c, r]) => Math.hypot(x - c.x, z - c.z) > r) &&
    !zones.nearAnything(x, z, 0.35);
  {
    const kinds = {
      daisy: { geo: (() => { const g = new THREE.IcosahedronGeometry(0.1, 0); g.scale(1, 0.45, 1); return g; })(),
        colors: [0xfbf7ef, 0xf2cf5b, 0xf2a0a8], lift: 0.02 },
      tulip: { geo: new THREE.CylinderGeometry(0.09, 0.05, 0.16, 6), colors: [0xd84f4f, 0xf2a0a8, 0xe8743a, 0xf2cf5b], lift: 0.07 },
      poppy: { geo: (() => { const g = new THREE.IcosahedronGeometry(0.11, 0); g.scale(1, 0.6, 1); return g; })(),
        colors: [0xe8432f, 0xe8743a], lift: 0.03 },
      lupine: { geo: new THREE.ConeGeometry(0.07, 0.38, 6), colors: [0x9a7ae0, 0x6a8ae0, 0xe89ac8], lift: 0.17 },
    };
    const kindNames = Object.keys(kinds);
    const buckets = new Map(); // `${kind}:${color}` → [matrix...]
    const stems = [];
    const dummy = new THREE.Object3D();
    let placed = 0;
    const GX = (HV.x + BH.x) / 2, GZ = (HV.z + BH.z) / 2;
    for (let i = 0; i < 11000 && placed < 3400; i++) {
      // most across the meadow (out past its rim, where the density thins
      // them to nothing); some in the back garden, some round the molehill
      const a = hash(i, 11) * Math.PI * 2, r = Math.sqrt(hash(i, 12));
      const where = hash(i, 23);
      const [cx, cz, sx, sz] = where < 0.8 ? [M.x, M.z, M.rx * 1.3, M.rz * 1.3] : where < 0.93 ? [GX, GZ, 9, 9] : [HILL.x, HILL.z, 3.4, 3.4];
      const x = cx + Math.cos(a) * r * sx + (hash(i, 13) - 0.5) * 0.6;
      const z = cz + Math.sin(a) * r * sz + (hash(i, 14) - 0.5) * 0.6;
      if (hash(i, 22) > flowerDensity(x, z)) continue;
      if (!meadowOK(x, z)) continue;
      const y = terrainHeight(x, z);
      // patches of one kind drift across the field, like real meadows do
      const patch = Math.floor((Math.sin(x * 0.35) + Math.cos(z * 0.41) + 2) * 1.2) % kindNames.length;
      const kind = hash(i, 15) < 0.7 ? kindNames[patch] : kindNames[Math.floor(hash(i, 16) * kindNames.length)];
      const K = kinds[kind];
      const color = K.colors[Math.floor(hash(i, 17) * K.colors.length)];
      const h = (kind === 'lupine' ? 0.45 : 0.22) + hash(i, 18) * 0.28;
      dummy.position.set(x, y + h / 2, z);
      dummy.rotation.set(0, 0, (hash(i, 19) - 0.5) * 0.2);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      stems.push(dummy.matrix.clone());
      dummy.position.set(x, y + h + K.lift, z);
      dummy.rotation.set(0, hash(i, 20) * 6, 0);
      dummy.scale.setScalar(0.85 + hash(i, 21) * 0.5);
      dummy.updateMatrix();
      const key = `${kind}:${color}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(dummy.matrix.clone());
      placed++;
    }
    const stemGeo = new THREE.CylinderGeometry(0.016, 0.022, 1, 4);
    const stemMesh = new THREE.InstancedMesh(stemGeo, mat(0x4e9a45), stems.length);
    stems.forEach((m, i) => stemMesh.setMatrixAt(i, m));
    group.add(stemMesh);
    for (const [key, list] of buckets) {
      const [kind, color] = key.split(':');
      const im = new THREE.InstancedMesh(kinds[kind].geo, mat(Number(color), 0.7), list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      group.add(im);
    }
    // a stand of sunflowers along the north edge, faces to the sun
    for (let i = 0; i < 14; i++) {
      const x = M.x - M.rx * 0.55 + i * (M.rx * 1.1 / 13) + (hash(i, 30) - 0.5);
      const z = M.z - M.rz * 0.72 + (hash(i, 31) - 0.5) * 1.5;
      if (!meadowOK(x, z)) continue;
      const y = terrainHeight(x, z), h = 1.1 + hash(i, 32) * 0.5;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, h, 5), mat(0x4e9a45));
      stem.position.set(x, y + h / 2, z);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 10), mat(0xf2c230, 0.7));
      face.rotation.x = Math.PI / 2 - 0.3;
      face.position.set(x, y + h, z + 0.05);
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 8), mat(0x6b4a2e));
      eye.rotation.x = face.rotation.x;
      eye.position.set(x, y + h + 0.01, z + 0.08);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0x4e9a45));
      leaf.scale.set(1.6, 0.3, 0.8);
      leaf.position.set(x + 0.1, y + h * 0.5, z);
      group.add(stem, face, eye, leaf);
      zones.addBlocker(x, z, 0.15, 'tree');
    }
    // rose bushes, round and heavy with blooms
    for (let i = 0; i < 10; i++) {
      const a = hash(i, 40) * Math.PI * 2, r = 0.55 + hash(i, 41) * 0.4;
      const x = M.x + Math.cos(a) * r * M.rx, z = M.z + Math.sin(a) * r * M.rz;
      if (!meadowOK(x, z)) continue;
      const y = terrainHeight(x, z);
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), mat(0x3f7a4a, 0.95));
      bush.scale.set(1.1, 0.8, 1);
      bush.position.set(x, y + 0.4, z);
      bush.castShadow = true;
      group.add(bush);
      const rose = mat([0xe8506a, 0xf2a0a8, 0xfbf7ef][i % 3], 0.6);
      for (let k = 0; k < 9; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), rose);
        const ba = hash(i * 10 + k, 42) * Math.PI * 2, bh = hash(i * 10 + k, 43);
        b.position.set(x + Math.cos(ba) * 0.62, y + 0.35 + bh * 0.45, z + Math.sin(ba) * 0.55);
        group.add(b);
      }
      zones.addBlocker(x, z, 0.6, 'tree');
    }
    // the back garden's great big flowers, taller than you, round the hive
    // and the butterflies' house (it's their house; they went big)
    for (let i = 0; i < 40; i++) {
      const a = hash(i, 50) * Math.PI * 2, r = 3.5 + hash(i, 51) * 6.5;
      const x = GX + Math.cos(a) * r, z = GZ + Math.sin(a) * r;
      if (!meadowOK(x, z) || zones.nearAnything(x, z, 1.0)) continue;
      const y = terrainHeight(x, z), h = 1.5 + hash(i, 52) * 1.3;
      const col = [0xf2a0c0, 0xf2cf5b, 0xb9a3e8, 0xe8743a, 0xfbf7ef][i % 5];
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 5), mat(0x4e9a45));
      stem.position.set(x, y + h / 2, z);
      stem.castShadow = true;
      group.add(stem);
      const head = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const pa = (k / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), mat(col, 0.7));
        petal.scale.set(1, 0.3, 0.55);
        petal.position.set(Math.cos(pa) * 0.3, 0, Math.sin(pa) * 0.3);
        petal.rotation.y = -pa;
        head.add(petal);
      }
      const mid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0xf2c230, 0.6));
      head.add(mid);
      head.position.set(x, y + h, z);
      head.rotation.set((hash(i, 53) - 0.5) * 0.5, 0, (hash(i, 54) - 0.5) * 0.5);
      head.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(head);
      const leafG = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(0x4e9a45));
      leafG.scale.set(1.8, 0.3, 0.8);
      leafG.position.set(x + 0.15, y + h * 0.45, z);
      group.add(leafG);
      zones.addBlocker(x, z, 0.2, 'tree');
    }
  }

  // the meadow's two keepers: a butterfly and a bee, working the flowers
  // everybody with wings: they drift between spots in their own patch,
  // hover as they go, turn to say hi — and keep a polite distance from each
  // other (the butterfly and the bee used to fly straight through each other)
  const fliers = [];
  function flier(kind, colors, name, lines, voice, speed, bob, { pickTarget, scale = 0.85, start = M, extra = null } = {}) {
    const a = buildAnimal(kind, colors);
    a.scale.setScalar(scale);
    a.position.set(start.x, terrainHeight(start.x, start.z), start.z);
    extra?.(a);
    group.add(a);
    const st = { target: null, pause: 1 + Math.random() * 2 };
    const me = { a };
    fliers.push(me);
    let li = 0;
    register({
      getPos: () => a.position, r: 2.4,
      label: `${name}와(과) 대화하기`,
      use: () => ui.say(lines[li++ % lines.length], { speaker: name, voice }),
    });
    // too close to another flier AND getting closer? (so two who start close
    // can still part — they used to freeze inside each other)
    const crowded = (x, z) => fliers.some((o) => o !== me &&
      Math.hypot(o.a.position.x - x, o.a.position.z - z) < 1.6 &&
      Math.hypot(o.a.position.x - x, o.a.position.z - z) < Math.hypot(o.a.position.x - a.position.x, o.a.position.z - a.position.z));
    updates.push((dt, t, playerPos) => {
      const near = playerPos && Math.hypot(playerPos.x - a.position.x, playerPos.z - a.position.z) < 3;
      const lift = bob(t);
      if (near) {
        a.rotation.y = turnToward(a.rotation.y, Math.atan2(playerPos.x - a.position.x, playerPos.z - a.position.z), dt, 3);
        a.position.y = terrainHeight(a.position.x, a.position.z) + lift;
        animateGait(a, t, 0);
        return;
      }
      if (st.pause > 0 || !st.target) {
        st.pause -= dt;
        if (st.pause <= 0) st.target = pickTarget();
        animateGait(a, t, 0);
      } else {
        const dx = st.target.x - a.position.x, dz = st.target.z - a.position.z, d = Math.hypot(dx, dz);
        if (d < 0.2) { st.pause = 2 + Math.random() * 5; st.target = null; } else {
          const nx = a.position.x + (dx / d) * speed * dt, nz = a.position.z + (dz / d) * speed * dt;
          if (crowded(nx, nz)) { st.target = pickTarget(); st.pause = 0.6; } // after you — no, after YOU
          else if (zones.islandCanStand(nx, nz, 0.3)) { a.position.x = nx; a.position.z = nz; } else { st.target = null; st.pause = 1; }
          a.rotation.y = turnToward(a.rotation.y, Math.atan2(dx, dz), dt, 4);
          animateGait(a, t, 1, 12);
        }
      }
      a.position.y = terrainHeight(a.position.x, a.position.z) + lift;
    });
    return a;
  }
  const meadowTarget = () => {
    const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.85;
    return { x: M.x + Math.cos(ang) * rr * M.rx, z: M.z + Math.sin(ang) * rr * M.rz };
  };
  let workerN = 0;
  const meadowWorker = (kind, colors, name, lines, voice, speed, bob) =>
    flier(kind, colors, name, lines, voice, speed, bob, { pickTarget: meadowTarget, start: { x: M.x + (workerN++ ? 4 : -4), z: M.z + 2 } });
  meadowWorker('moth', { body: 0x3a3440, head: 0x3a3440, wing: 0x7ec3e8 }, '아주르', [
    '오! 안녕! 아스터 조심. 클로버도. 그리고 — 뭐 전부 조심해, 여긴 다 꽃이야, 그게 포인트야.',
    '나는 나비야. 자꾸 나방이라고 하는데, 나는 나방 아님 박사야.',
    '연구소에서는 기록만 하면 뭐든 심게 해 줘. 나는 꽃으로 기록해. 이제 형식에 적응하는 것 같아.',
    '버즈는 일을 아주 잘해. 일하는 게 무서울 정도야. 살짝 떨어진 곳에서 크게 존경하고 있어.',
  ], 760, 0.9, (t) => 0.35 + Math.sin(t * 2.2) * 0.12);
  meadowWorker('bee', { body: 0xf2c230, head: 0xf2c230 }, '버즈', [
    '수분 조사, 9열. 지금 9열에 서 있어. 괜찮아. 9열은 회복력이 좋아.',
    '아침에 꽃 400송이. 자랑 아니야. 보고야.',
    '아주르가 자꾸 목록에 없는 걸 심어. 목록이 지고 있어. 존경해.',
    '연구소에서 논문을 쓰래서 육각형을 만들었어. 논문이 아니래. 더 낫다고 했어.',
  ], 820, 1.4, (t) => 0.25 + Math.abs(Math.sin(t * 5)) * 0.1);

  // =============================================================== the hive ----
  // out on the empty north side: a great golden skep on a stone, honeycomb
  // stacked by the door, and the Queen on her flower throne. She is a DIVA.
  {
    const face = Math.atan2(M.x - HV.x, M.z - HV.z); // the door looks toward the flowers
    const h = new THREE.Group();
    const gold = mat(0xe8b84a, 0.8), goldDark = mat(0xc9962e, 0.8);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.05, 0.35, 9), mat(0x8a8378, 0.95));
    base.position.y = 0.17;
    h.add(base);
    const core = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.5, 12), gold);
    core.position.y = 0.35 + 1.25;
    h.add(core);
    for (let i = 0; i < 6; i++) {
      const R = 1.38 - i * 0.2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.2, 5, 14), i % 2 ? gold : goldDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.55 + i * 0.36;
      h.add(ring);
    }
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), goldDark);
    knob.position.y = 2.75;
    h.add(knob);
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.34, 10, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x3a2a10 }));
    door.position.set(0, 0.4, 1.36);
    h.add(door);
    // honeycomb, stacked by the door, and two jars
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 6), mat(0xf2c64a, 0.5));
      cell.rotation.x = Math.PI / 2;
      cell.position.set(1.9 + (i ? Math.cos(a) * 0.36 : 0), 0.6 + (i ? Math.sin(a) * 0.36 : 0), 0.6);
      h.add(cell);
    }
    for (const [x, z] of [[1.6, 1.2], [1.95, 1.0]]) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 8), mat(0xe8a020, 0.3));
      jar.position.set(x, 0.15, z);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 8), mat(0xd84f4f));
      lid.position.set(x, 0.33, z);
      h.add(jar, lid);
    }
    h.rotation.y = face;
    h.position.set(HV.x, HV.y, HV.z);
    h.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(h);
    zones.addBlocker(HV.x, HV.z, 2.05);
    // the throne: an enormous pink bloom, a little to the side of the door
    const tx = HV.x + Math.sin(face) * 2.9 + Math.cos(face) * 1.6;
    const tz = HV.z + Math.cos(face) * 2.9 - Math.sin(face) * 1.6;
    const ty = terrainHeight(tx, tz);
    const throne = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), mat(0xf2a0c0, 0.7));
      petal.scale.set(1, 0.3, 0.6);
      petal.position.set(Math.cos(a) * 0.45, 0.35, Math.sin(a) * 0.45);
      petal.rotation.y = -a;
      throne.add(petal);
    }
    const heart = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.2, 9), mat(0xf2cf5b, 0.6));
    heart.position.y = 0.42;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 6), mat(0x4e9a45));
    stalk.position.y = 0.17;
    throne.add(heart, stalk);
    throne.position.set(tx, ty, tz);
    group.add(throne);
    zones.addBlocker(tx, tz, 0.8);
    // Her Majesty
    const queen = buildAnimal('bee', { body: 0xf2b420, head: 0xf2b420 });
    queen.scale.setScalar(1.15);
    {
      const crown = new THREE.Group();
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 10, 1, true), mat(0xf2cf5b, 0.25));
      crown.add(band);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const pt = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), mat(0xf2cf5b, 0.25));
        pt.position.set(Math.cos(a) * 0.19, 0.12, Math.sin(a) * 0.19);
        crown.add(pt);
      }
      const jewel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0xe8506a, 0.2));
      jewel.position.set(0, 0.02, 0.21);
      crown.add(jewel);
      crown.position.set(0, 0.42, 0.02);
      crown.rotation.z = 0.15; // worn at an angle. obviously.
      queen.userData.parts.head.add(crown);
    }
    queen.position.set(tx, ty + 0.5, tz);
    queen.rotation.y = face;
    queen.userData.fidget = true;
    group.add(queen);
    let qi = 0, met = false;
    const QUEEN = [
      '음흠. 다가와도 돼. 칭찬 먼저, 질문 다음, 그리고 다시 칭찬.',
      '꿀 한 병에 꽃이 몇 송이나 필요한지 아니? 나도 몰라, 자기야. 그런 건 사람이 따로 있어.',
      '나비들? 귀엽지. 한철이야. 우리는 영원하다고, 얘야.',
      '버즈는 나에게 보고해. 모두가 나에게 보고해. 꽃들도 나에게 보고해. 태양도 고려 중이야.',
      '어깨에 그거 꽃가루니? …아이코닉해. 그대로 둬.',
      '나는 안 쏴. 쏠 필요가 없거든. 나를 봐.',
    ];
    register({
      getPos: () => queen.position, r: 2.6,
      label: '여왕님께 다가가기',
      use: () => {
        if (!met) {
          met = true;
          ui.say(['안녕, 자기야.', '벌집을 찾았구나. 당연히 찾지. 다들 결국 찾게 돼 있어. 빛 때문에.'],
            { speaker: '여왕벌', voice: 900 });
          return;
        }
        ui.say(QUEEN[qi++ % QUEEN.length], { speaker: '여왕벌', voice: 900 });
      },
    });
    // two workers, back and forth between the hive and the meadow
    const hiveTarget = () => (Math.random() < 0.5
      ? { x: HV.x + Math.sin(face) * 3.3 + (Math.random() - 0.5) * 3, z: HV.z + Math.cos(face) * 3.3 + (Math.random() - 0.5) * 3 }
      : meadowTarget());
    flier('bee', { body: 0xf2c230, head: 0xf2c230 }, '허니듀', [
      '근무 중! 말 못 해! …조금은 할 수 있어. 안녕! 잘 가!',
      '여왕님은 분홍 꽃의 꿀만 드셔. 분홍만. 체계가 있어.',
      '와글의 춤이 남쪽에 최고의 꽃이 있대. 와글의 춤은 항상 그래.',
    ], 840, 1.5, (t) => 0.3 + Math.abs(Math.sin(t * 5.5)) * 0.12, { pickTarget: hiveTarget, scale: 0.7, start: { x: HV.x + 3, z: HV.z + 4 } }); // (clear of the Queen's throne — she used to start wedged into it)
    flier('bee', { body: 0xe8a82a, head: 0xe8a82a }, '와글', [
      '*작게 춤을 춘다* …이건 “꽃이 저쪽”이라는 뜻이야. 꽃은 다 저쪽에 있어. 좋은 춤이야.',
      '버즈가 내 상사야. 이달의 사원상으로 육각형을 줬어. 벌집에 보관해. 육각형 안에.',
    ], 800, 1.3, (t) => 0.28 + Math.abs(Math.sin(t * 4.5 + 1)) * 0.14, { pickTarget: hiveTarget, scale: 0.7, start: { x: HV.x - 3, z: HV.z + 2 } });
  }

  // ======================================================= the chrysalis house ----
  // where Azure lives: an arbor of flowered arches you walk through, and at
  // its end a round nursery under a petal roof — three cradles rocking, three
  // babies swaddled in their chrysalises, and a nanny keeping watch.
  {
    const face = Math.atan2(M.x - BH.x, M.z - BH.z); // the arbor runs toward the meadow
    const sf = Math.sin(face), cf = Math.cos(face);
    const at = (lx, lz) => ({ x: BH.x + lx * cf + lz * sf, z: BH.z - lx * sf + lz * cf });
    const y0 = BH.y;
    const g = new THREE.Group();
    const leaf = mat(0x4e9a52, 0.9), wood = mat(0xd9c49a, 0.8);
    const blooms = [mat(0xf2a0c0, 0.6), mat(0xf2cf5b, 0.6), mat(0xb9a3e8, 0.6), mat(0xfbf7ef, 0.6)];
    // the nursery: a round floor, slim posts, a petal roof
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.6, 0.24, 10), mat(0xe8dcc0, 0.9));
    floor.position.y = 0.12;
    g.add(floor);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.5) continue; // the doorway (+z)
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.5, 6), wood);
      post.position.set(Math.cos(a) * 2.3, 1.45, Math.sin(a) * 2.3);
      g.add(post);
      const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), leaf);
      vine.position.set(Math.cos(a) * 2.32, 1.1 + (i % 3) * 0.4, Math.sin(a) * 2.32);
      g.add(vine);
      const wp = at(Math.cos(a) * 2.3, Math.sin(a) * 2.3);
      zones.addBlocker(wp.x, wp.z, 0.15);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.5, 10), mat(0xf2b8cc, 0.7));
    roof.position.y = 2.7 + 0.75;
    g.add(roof);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), i % 2 ? mat(0xf2a0c0, 0.7) : mat(0xf2cf5b, 0.7));
      petal.scale.set(0.9, 0.25, 0.55);
      petal.position.set(Math.cos(a) * 2.85, 2.72, Math.sin(a) * 2.85);
      petal.rotation.y = -a;
      petal.rotation.z = -0.35;
      g.add(petal);
    }
    const bud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat(0xe8506a, 0.6));
    bud.scale.y = 1.4;
    bud.position.y = 4.4;
    g.add(bud);
    // light, under the petal roof (it was very dark in there): a glowing
    // flower lantern hung from the peak, and fairy lights round the posts.
    // all glow, no lamps (VISUAL_CANON: emissive, not light)
    const lanternStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), mat(0x4e9a52));
    lanternStem.position.y = 2.95;
    g.add(lanternStem);
    const lantern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd88a, emissiveIntensity: 1.3, roughness: 0.4, flatShading: true }));
    lantern.scale.y = 1.2;
    lantern.position.y = 2.45;
    lantern.castShadow = false;
    g.add(lantern);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: [0xffe8a0, 0xffc0d8, 0xd8c8ff][i % 3], emissiveIntensity: 1.4 }));
      fl.position.set(Math.cos(a) * 2.35, 2.55 + Math.sin(a * 4) * 0.08, Math.sin(a) * 2.35);
      fl.castShadow = false;
      g.add(fl);
    }
    floor.material.emissive = new THREE.Color(0x6a5030);
    floor.material.emissiveIntensity = 0.35; // the lantern's glow, on the boards
    // three cradles on rockers, each with a swaddled chrysalis and a sleepy face
    const cradles = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const c = new THREE.Group();
      for (const sz of [-0.3, 0.3]) {
        const rocker = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 4, 10, Math.PI * 0.7), wood);
        rocker.rotation.set(0, Math.PI / 2, Math.PI + Math.PI * 0.15);
        rocker.position.set(0, 0.42, sz);
        c.add(rocker);
      }
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 10, 1, true, Math.PI / 2, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xe8d4a8, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
      basket.rotation.x = -Math.PI / 2; // the open side up: a cradle, not a lid
      basket.position.y = 0.42;
      c.add(basket);
      const swaddle = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.4, 3, 8), mat([0xb8e0a0, 0xf2c0d0, 0xc8d8f0][i], 0.8));
      swaddle.rotation.x = Math.PI / 2;
      swaddle.position.set(0, 0.42, 0.05);
      c.add(swaddle);
      const face2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), mat(0x4a4450, 0.7));
      face2.position.set(0, 0.47, 0.38);
      c.add(face2);
      for (const sx of [-0.05, 0.05]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0xfbf7ef }));
        eye.position.set(sx, 0.49, 0.5); // shut, sleeping
        c.add(eye);
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 3), mat(0x4a4450));
        ant.position.set(sx * 1.6, 0.6, 0.4);
        ant.rotation.z = -sx * 6;
        c.add(ant);
      }
      c.position.set(Math.cos(a) * 1.25, 0.24, Math.sin(a) * 1.25);
      c.rotation.y = -a + Math.PI / 2;
      g.add(c);
      cradles.push(c);
      const cp = at(c.position.x, c.position.z);
      zones.addBlocker(cp.x, cp.z, 0.45);
    }
    // the arbor: flowered arches from the doorway out toward the meadow
    for (let k = 0; k < 4; k++) {
      const z = 2.9 + k * 1.3;
      for (const sx of [-1.15, 1.15]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.9, 5), wood);
        post.position.set(sx, 0.95, z);
        g.add(post);
        const wp = at(sx, z);
        zones.addBlocker(wp.x, wp.z, 0.12);
      }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 4, 12, Math.PI), wood);
      arch.position.set(0, 1.9, z);
      g.add(arch);
      for (let j = 0; j < 7; j++) {
        const a = (j / 6) * Math.PI;
        const lb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), leaf);
        lb.position.set(Math.cos(a) * 1.15, 1.9 + Math.sin(a) * 1.15, z);
        g.add(lb);
        const bl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), blooms[(j + k) % 4]);
        bl.position.set(Math.cos(a) * 1.2, 1.95 + Math.sin(a) * 1.2, z + 0.12);
        g.add(bl);
      }
    }
    g.rotation.y = face;
    g.position.set(BH.x, y0, BH.z);
    g.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial && !(o.material.emissiveIntensity > 1)) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(g);
    zones.addSurfaceDisc(BH.x, BH.z, 2.5, y0 + 0.24);
    updates.push((dt, t) => {
      cradles.forEach((c, i) => { c.rotation.z = Math.sin(t * 1.3 + i * 2.1) * 0.12; });
    });
    // the nanny: an orange butterfly who has seen everything and is not
    // impressed by any of it, except the babies
    const inner = [[0, 0], [0.5, -0.3], [-0.5, -0.3]].map(([lx, lz]) => at(lx, lz));
    flier('moth', { body: 0x3a3032, head: 0x3a3032, wing: 0xf2963a }, '모나크 유모', [
      '쉿. 번데기가 되는 중이에요. 아주 큰일이고, 아주아주 조용한 일이에요.',
      '셋이에요. 하나는 나방이 될 거예요, 알겠어요. 똑같이 사랑할 거예요. 농담을 만회하려고 더 많이, 아마도요.',
      '아주르가 꿀을 가져다주고 야외 노트를 읽어 줘요. 한마디도 못 알아들어요. 아주 좋아해요.',
      '나오면 일주일은 날개만 있고 분별이 없어요. 그러다 자라요. 대부분 그래요.',
    ], 700, 0.5, (t) => 0.3 + Math.sin(t * 1.8) * 0.08, { pickTarget: () => ({ ...inner[Math.floor(Math.random() * 3)] }), scale: 0.8, start: inner[0] });
    let bi = 0;
    register({
      pos: new THREE.Vector3(BH.x, 0, BH.z), r: 2.2, priority: 0,
      label: '아기들 들여다보기',
      use: () => ui.say([
        '(번데기 셋이 요람에 포근히 싸여 스스로 살짝씩 흔들려요. 하나가 잠꼬대로 한숨 쉬어요.)',
        '(분홍이의 더듬이가 꿈틀해요. 아마 꽃 꿈을 꾸는 거예요. 다들 그래요.)',
        '(초록이는 분명 나방이 될 거예요. 그럴 귀를 갖췄어요.)',
      ][bi++ % 3]),
    });
  }

  // ==================================================== blueberry bushes ----
  // here and there, wherever they came up; pick them when they're ripe
  {
    const leafMat = mat(0x3f7a4a, 0.95), berryMat = mat(0x3f4f9a, 0.4);
    const spots = [[-14, 12], [10, 18], [-22, -6], [4, 26], [-8, 30], [16, 8]];
    spots.forEach(([dx, dz], i) => {
      const sp = openSpot(ISLAND6.x + dx, ISLAND6.z + dz, 1.2, 4);
      if (!sp) return;
      const g = new THREE.Group();
      for (const [ox, oy, oz, r] of [[0, 0.45, 0, 0.55], [0.4, 0.35, 0.2, 0.4], [-0.35, 0.35, -0.15, 0.42]]) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
        blob.position.set(ox, oy, oz);
        blob.castShadow = true;
        g.add(blob);
      }
      const berries = [];
      for (let b = 0; b < 9; b++) {
        const a = hash(i * 20 + b, 5) * Math.PI * 2;
        const berry = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), berryMat);
        berry.position.set(Math.cos(a) * 0.55, 0.3 + hash(i * 20 + b, 6) * 0.4, Math.sin(a) * 0.55);
        g.add(berry);
        berries.push(berry);
      }
      g.position.set(sp.x, sp.y, sp.z);
      group.add(g);
      zones.addBlocker(sp.x, sp.z, 0.6, 'tree');
      const bush = { berries, regrow: 0 };
      register({
        pos: new THREE.Vector3(sp.x, 0, sp.z), r: 1.8,
        enabled: () => bush.berries[0].visible,
        label: '블루베리 따기',
        use: () => {
          bush.berries.forEach((b) => { b.visible = false; });
          bush.regrow = 300 + i * 40;
          S.addItem('blueberries', 2);
          jingle();
          ui.toast('<b>블루베리</b> 한 줌을 땄어요. 하나는 주머니에, 하나는 당신에게.', '🫐');
          ui.updateHUD();
        },
      });
      updates.push((dt) => {
        if (bush.regrow > 0) {
          bush.regrow -= dt;
          if (bush.regrow <= 0) bush.berries.forEach((b) => { b.visible = true; });
        }
      });
    });
  }

  // ====================================================== the gift kiosk ----
  {
    const face = Math.atan2(ISLAND6_BEACH.x - K.x, ISLAND6_BEACH.z - K.z); // opening onto the beach, where the customers are
    // a proper booth now: walls on three sides, a counter across the front
    // with the window above it, a roof — and Dot INSIDE it (the old open
    // stall had her standing half through its back wall)
    const k = new THREE.Group();
    const BLUE = 0x3f6ab0, WHITE = 0xf3efe2;
    const floor = box(2.6, 0.12, 2.0, 0xa97c50);
    floor.position.y = 0.06;
    k.add(floor);
    const backW = box(2.6, 2.5, 0.14, WHITE);
    backW.position.set(0, 1.25, -0.93);
    k.add(backW);
    for (const sx of [-1.23, 1.23]) {
      const side = box(0.14, 2.5, 2.0, WHITE);
      side.position.set(sx, 1.25, 0);
      k.add(side);
    }
    const front = box(2.6, 1.05, 0.14, BLUE);
    front.position.set(0, 0.52, 0.93);
    k.add(front);
    const counterTop = box(2.7, 0.08, 0.5, 0xa97c50);
    counterTop.position.set(0, 1.08, 0.93);
    k.add(counterTop);
    const header = box(2.6, 0.5, 0.14, BLUE);
    header.position.set(0, 2.3, 0.93);
    k.add(header);
    const roof = box(2.95, 0.14, 2.35, BLUE);
    roof.position.set(0, 2.62, 0.05);
    k.add(roof);
    // striped awning over the window
    for (let i = 0; i < 6; i++) {
      const slat = box(0.44, 0.05, 0.8, i % 2 ? WHITE : BLUE);
      slat.position.set(-1.1 + i * 0.44, 2.1, 1.33);
      slat.rotation.x = 0.35;
      k.add(slat);
    }
    const banner = sign('낫벨 연구소 · 기념품', 2.4, 0.4, '#3f6ab0', '#f3efe2');
    banner.position.set(0, 2.3, 1.01);
    k.add(banner);
    // the merch, on the counter: mugs, a folded tee, a little plush rocket
    for (const [x, col] of [[-0.9, WHITE], [-0.62, BLUE]]) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), mat(col, 0.5));
      mug.position.set(x, 1.22, 0.95);
      k.add(mug);
    }
    const tee = box(0.5, 0.08, 0.36, 0x8a9aa8);
    tee.position.set(0.05, 1.16, 0.95);
    k.add(tee);
    const rocket = new THREE.Group();
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 7), mat(WHITE));
    const rn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 7), mat(0xd84f4f));
    rn.position.y = 0.25;
    rocket.add(rb, rn);
    rocket.position.set(0.8, 1.3, 0.95);
    k.add(rocket);
    // a shelf of plushies on the back wall
    const shelf = box(2.0, 0.06, 0.3, 0xa97c50);
    shelf.position.set(0, 1.7, -0.75);
    k.add(shelf);
    for (let i = 0; i < 5; i++) {
      const plush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat([0xd84f4f, 0xf2cf5b, BLUE, 0x8fce7a, 0xf2a0a8][i], 0.8));
      plush.position.set(-0.8 + i * 0.4, 1.85, -0.75);
      k.add(plush);
    }
    k.rotation.y = face;
    k.position.set(K.x, K.y, K.z);
    k.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(k);
    zones.addBlockerBox(K.x, K.z, 2.7, 2.1, face, 0.05);
    // the cashier: a mole from the Boring Department, on a rotation — inside
    const dot = buildAnimal('mole', { body: 0x6a5a50 });
    dot.scale.setScalar(0.8);
    const bx = K.x - Math.sin(face) * 0.15, bz = K.z - Math.cos(face) * 0.15;
    dot.position.set(bx, K.y + 0.12, bz);
    dot.rotation.y = face;
    dot.userData.fidget = true;
    group.add(dot);
    const MERCH = [
      { id: 'labs_mug', price: 18 },
      { id: 'labs_tee', price: 35 },
      { id: 'rocket_plush', price: 60 },
    ];
    const counterAt = { x: K.x + Math.sin(face) * 1.8, z: K.z + Math.cos(face) * 1.8 };
    register({
      pos: new THREE.Vector3(counterAt.x, 0, counterAt.z), r: 1.8,
      label: '기념품 가판대 구경하기',
      use: async () => {
        const picked = await ui.ask('“기념품 가판대에 오셨네요. 전부 과학 인접 상품이에요.”', [
          ...MERCH.map((m) => ({
            label: `${ITEMS[m.id].emoji} ${ITEMS[m.id].name}`, value: m.id, hint: `${m.price}🔘`,
            disabled: S.state.buttons < m.price,
          })),
          { label: '그냥 구경이에요', value: null },
        ], { speaker: '도트', voice: 280 });
        const m = MERCH.find((x) => x.id === picked);
        if (!m) return;
        S.spend(m.price);
        S.addItem(m.id);
        kaching();
        ui.updateHUD();
        ui.toast(`<b>${ITEMS[m.id].name}</b>을(를) 샀어요.`, ITEMS[m.id].emoji);
        ui.say(pick3([
          '연구를 후원해 주셔서 감사해요. 방금 그게 연구였어요.',
          '환불 불가. 규정이 아니라 — 방법을 몰라요.',
          '달에서 입어 보세요. 누군가 알아챌 거예요. 아마 로버가요.',
        ]), { speaker: '도트', voice: 280 });
      },
    });

    // and behind the kiosk: a baby rover with bangs, "smoking." it's water
    // vapor. it's a whole thing. you wouldn't get it.
    const bx2 = K.x - Math.sin(face) * 2.4 + Math.cos(face) * 1.2;
    const bz2 = K.z - Math.cos(face) * 2.4 - Math.sin(face) * 1.2;
    const emo = buildRover(0x3a3844);
    emo.scale.setScalar(0.75);
    emo.position.set(bx2, terrainHeight(bx2, bz2), bz2);
    emo.rotation.y = face + Math.PI * 0.6; // turned away. obviously.
    const bangs = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), mat(0x16140f, 0.6));
    bangs.rotation.z = Math.PI / 2 + 0.4;
    bangs.position.set(-0.03, 0.05, 0.07);
    emo.userData.head.add(bangs);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 7), mat(0x9ac4e8, 0.2));
    bottle.position.set(0.32, 0.11, 0.25);
    emo.add(bottle);
    group.add(emo);
    zones.addBlocker(bx2, bz2, 0.5);
    const puffs = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
        new THREE.MeshBasicMaterial({ color: 0xf3f6f8, transparent: true, opacity: 0, depthWrite: false }));
      group.add(p);
      puffs.push(p);
    }
    let puffT = 0;
    const eyeW = new THREE.Vector3();
    updates.push((dt, t) => {
      puffT += dt;
      emo.userData.head.rotation.y = Math.sin(t * 0.4) * 0.4; // looking at nothing, meaningfully
      const cyc = puffT % 6; // every six seconds: one long, thoughtful exhale
      emo.userData.head.getWorldPosition(eyeW);
      puffs.forEach((p, i) => {
        const k = (cyc - i * 0.25) / 2.5;
        if (k < 0 || k > 1) { p.material.opacity = 0; return; }
        p.position.set(eyeW.x + Math.sin(emo.rotation.y) * (0.2 + k * 0.6), eyeW.y + k * 0.9, eyeW.z + Math.cos(emo.rotation.y) * (0.2 + k * 0.6));
        p.scale.setScalar(1 + k * 3);
        p.material.opacity = 0.55 * (1 - k);
      });
    });
    let ei = 0;
    register({
      getPos: () => emo.position, r: 2.0,
      label: '가판대 뒤 로버 살펴보기',
      use: () => {
        tone(330, { dur: 0.2, type: 'sine', vol: 0.03, slide: -60 });
        ui.say([
          '(작은 로버가 길게 수증기를 내뿜고 당신을 보지 않아요.) …그냥 물이에요. 사연이 있는 거예요.',
          '스트릭스 소장한테는 여기 있다고 하지 마세요. 아니 말해요. 다 무의미해요. 달은 너무 주류예요.',
          '(앞머리 먼저, 눈을 당신 쪽으로 돌렸다가 거둬요.) …있어도 돼요. 뭐든. 상관없어요.',
          '다들 달에 가고 싶어 해요. 나는 아이러니하게 가고 싶어요. 차이가 있어요.',
        ][ei++ % 4]);
      },
    });
  }

  // ====================================================== the south beach ----
  const SB = { x: ISLAND6_BEACH.x, z: ISLAND6_BEACH.z + 1 };
  {
    const sy = (x, z) => terrainHeight(x, z);
    // towels, laid over the sand as it lies
    const towel = (x, z, ry, colA, colB) => {
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 64;
      const c = cv.getContext('2d');
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? colA : colB; c.fillRect(0, i * 8, 32, 8); }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(1.1, 2.0, 2, 4);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(ry);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, sy(x + pos.getX(i), z + pos.getZ(i)) + 0.04);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
      m.position.set(x, 0, z);
      m.receiveShadow = true;
      group.add(m);
    };
    towel(SB.x - 3, SB.z - 1, 0.2, '#f2a0a8', '#fbf7ef');
    towel(SB.x - 1.4, SB.z - 1.3, -0.1, '#9ac4e8', '#fbf7ef');
    towel(SB.x + 3.2, SB.z + 0.4, 0.4, '#f2cf5b', '#e8743a');
    // an umbrella over the pink towel
    const pole = box(0.06, 2.2, 0.06, 0xdfe2e6);
    pole.position.set(SB.x - 3.4, sy(SB.x - 3.4, SB.z - 2) + 1.1, SB.z - 2);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.5, 8), mat(0xd84f4f, 0.7));
    canopy.position.set(SB.x - 3.4, sy(SB.x - 3.4, SB.z - 2) + 2.3, SB.z - 2);
    group.add(pole, canopy);
    zones.addBlocker(SB.x - 3.4, SB.z - 2, 0.15);
    // baby rovers: two sunbathing on towels, two at the sandcastle, a ball between them
    const tanning = [];
    for (const [x, z, col] of [[SB.x - 3, SB.z - 1, 0xf6e0e8], [SB.x - 1.4, SB.z - 1.3, 0xdff0f6]]) {
      const r = buildRover(col);
      r.scale.setScalar(0.6);
      r.position.set(x, sy(x, z) + 0.04, z);
      r.rotation.y = Math.PI; // facing the sea
      group.add(r);
      tanning.push(r);
    }
    // the sandcastle: towers, a keep, and a flag
    const CX = SB.x + 1, CZ = SB.z + 2.2, cy = sy(CX, CZ);
    const sand = mat(0xe8d49a, 0.95);
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 8), sand);
    keep.position.set(CX, cy + 0.3, CZ);
    group.add(keep);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 7), sand);
      tw.position.set(CX + Math.cos(a) * 0.75, cy + 0.25, CZ + Math.sin(a) * 0.75);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 7), sand);
      cap.position.set(tw.position.x, cy + 0.62, tw.position.z);
      group.add(tw, cap);
    }
    const flagPole = box(0.02, 0.5, 0.02, 0x7a5230);
    flagPole.position.set(CX, cy + 0.85, CZ);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ color: 0x3f6ab0, side: THREE.DoubleSide }));
    flag.position.set(CX + 0.11, cy + 1.02, CZ);
    group.add(flagPole, flag);
    zones.addBlocker(CX, CZ, 1.0);
    const players = [];
    for (const [dx, col] of [[-2.2, 0xe8e2d2], [2.4, 0xf2e6b8]]) {
      const r = buildRover(col);
      r.scale.setScalar(0.65);
      r.position.set(CX + dx, sy(CX + dx, CZ + 1.8), CZ + 1.8);
      r.rotation.y = dx < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(r);
      players.push(r);
    }
    const ball = new THREE.Group();
    const ballColors = [0xd84f4f, 0xfbf7ef, 0x3f6ab0, 0xf2cf5b];
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, (i / 4) * Math.PI * 2, Math.PI / 2), mat(ballColors[i], 0.5));
      ball.add(seg);
    }
    group.add(ball);
    updates.push((dt, t) => {
      // back and forth, a lazy lob each way
      const k = (t * 0.45) % 2, u = k < 1 ? k : 2 - k;
      const a = players[0].position, b = players[1].position;
      ball.position.set(a.x + (b.x - a.x) * u, cy + 0.35 + Math.sin(u * Math.PI) * 1.6, a.z + (b.z - a.z) * u);
      ball.rotation.x += dt * 3;
      players.forEach((p, i) => {
        const catching = i === 0 ? u < 0.12 : u > 0.88;
        p.userData.head.position.y = 0.82 + (catching ? 0.12 : 0);
        for (const w of p.userData.wheels) w.rotation.x = Math.sin(t * 2 + i) * 0.3;
      });
      tanning.forEach((r, i) => {
        // eye to the sun; a little wriggle to settle in; now and then a
        // lazy roll to warm the other side
        r.userData.head.rotation.x = -0.5 + Math.sin(t * 0.3 + i) * 0.05;
        r.userData.head.rotation.y = Math.sin(t * 0.21 + i * 2) * 0.4;
        const roll = (t * 0.05 + i * 0.5) % 1;
        r.rotation.z = Math.sin(t * 1.7 + i) * 0.04 + (roll < 0.08 ? Math.sin((roll / 0.08) * Math.PI) * 0.45 : 0);
        for (const w of r.userData.wheels) w.rotation.x = Math.sin(t * 0.8 + i) * 0.25;
      });
      flag.rotation.y = Math.sin(t * 2.5) * 0.3;
    });
    // the mole on his break: lawn chair, thermos, hard hat set down beside him
    const MX = SB.x + 4.4, MZ = SB.z - 1.4, my = sy(MX, MZ);
    // (facing the SEA now — he'd been sitting with his back to it — and
    // sat properly in a chair big enough for him, not through its back)
    const chair = new THREE.Group();
    const seat = box(1.15, 0.08, 1.0, 0x5b8b7a);
    seat.position.set(0, 0.35, 0.05);
    const cback = box(1.15, 0.85, 0.08, 0x5b8b7a);
    cback.position.set(0, 0.75, -0.55);
    cback.rotation.x = -0.4;
    chair.add(seat, cback);
    for (const [lx, lz] of [[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.4], [0.5, -0.4]]) {
      const leg = box(0.05, 0.35, 0.05, 0xc0c4c8);
      leg.position.set(lx, 0.17, lz);
      chair.add(leg);
    }
    chair.position.set(MX, my, MZ);
    group.add(chair);
    const mole = buildAnimal('mole', { body: 0x5a4a44 });
    mole.position.set(MX, my + 0.12, MZ + 0.12);
    mole.rotation.x = -0.18; // leaning back into it
    mole.userData.noFidget = true; // his movement is his own (below)
    group.add(mole);
    const table = box(0.4, 0.3, 0.4, 0xa97c50);
    table.position.set(MX + 0.9, my + 0.15, MZ + 0.1);
    const thermos = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), mat(0xd84f4f, 0.4));
    const thermosRest = new THREE.Vector3(MX + 0.9, my + 0.45, MZ + 0.1);
    thermos.position.copy(thermosRest);
    const hat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mat(0xf2cf5b, 0.6));
    hat.scale.set(1, 0.6, 1);
    hat.position.set(MX - 0.85, my + 0.12, MZ + 0.2);
    group.add(table, thermos, hat);
    // every so often: a long, slow sip; in between, a look up and down the beach
    const sipAt = new THREE.Vector3(MX + 0.25, my + 1.25, MZ + 0.75);
    updates.push((dt, t) => {
      const c = t % 11;
      const k = c < 1 ? c : c < 3 ? 1 : c < 4 ? 4 - c : 0; // up, hold, down
      thermos.position.lerpVectors(thermosRest, sipAt, k);
      thermos.rotation.z = k * 1.1;
      const head = mole.userData.parts.head;
      head.rotation.x = -k * 0.35;
      head.rotation.y = k ? 0 : Math.sin(t * 0.35) * 0.5;
    });
    zones.addBlocker(MX, MZ, 0.6);
    const onBreak = sign('휴식 중', 0.8, 0.3, '#f2cf5b', '#2e2a26');
    const bp = box(0.05, 0.6, 0.05, 0x7a5230);
    bp.position.set(MX + 0.7, my + 0.3, MZ - 0.6);
    onBreak.position.set(MX + 0.7, my + 0.65, MZ - 0.62);
    onBreak.rotation.y = Math.PI;
    group.add(bp, onBreak);
    let mi = 0;
    register({
      getPos: () => mole.position, r: 2.2,
      label: '휴식 중인 두더지와 대화하기',
      use: () => ui.say([
        '15분이에요. 노조 규정이에요. 굴착부가 이 15분을 힘들게 쟁취했고, 매분을 만끽할 작정이에요.',
        '굴착에 대해 아무도 말해 주지 않는 게 뭔지 아세요? 태양이요. 볼 수가 없어요. 그래서 여기 와서 그냥… 바라봐요. 직접 보진 않아요. 바보 아니거든요.',
        '꼬마들은 하루 종일 공놀이해요. 언젠가 달에 가겠죠. 오늘은 공이에요.',
        '(그가 보온병을 아주 천천히 마시며, 수평선과 눈을 맞춰요.)',
      ][mi++ % 4], { speaker: '웬델', voice: 240 }),
    });
    let ti = 0;
    register({
      pos: new THREE.Vector3(SB.x - 2.2, 0, SB.z - 1.2), r: 2.0,
      label: '일광욕하는 로버들에게 인사하기',
      use: () => ui.say([
        '(아기 로버 두 대가 수건 위에 누워 태양 전지판을 햇볕에 기울여요. 하나가 눈도 안 뜨고 삑 소리를 내요. 그게 인사예요.)',
        '(분홍이가 아주 살짝 뒤집어요, 충전을 고르게 하려고요.)',
      ][ti++ % 2]),
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }
  return { group, update, molehill: { x: HILL.x, z: HILL.z } };
}

function pick3(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
      }
