// THE DROPPED CROWN — the world under the reef.
//
// Captain Brine's grandmother used to say the reef off Notbell was a crown a
// sea-queen threw away, on purpose. She was right about all of it. Put on
// Pip's diver's suit, swim out over the bright water, and dive: down here
// the coral grows in a ring of candy-colored points, and everybody lives in
// the crown the queen didn't want.
//
// Neighborhoods, joined by the Kelp Highway (walk it, or ride a bubble):
//   · THE CROWN — the coral court. Octavia (who is NOT the queen, and would
//     like that on record), Delphine (a dolphin with legs, in sneakers),
//     Bernard (a blue whale, the largest animal that has ever lived, exactly
//     as big as everyone else), two fish-folk out jogging, glitter crabs,
//     a giant clam that makes one pearl a day.
//   · KELPWOOD — the kelp forest: tall gold-green ribbons swaying up to the
//     light, garibaldi, urchins, otters holding hands on the surface above,
//     and Ranger Holdfast, who looks after the Highway.
//   · THE LADY BUTTON — a salvage barge from the bell hunt (Moledecai
//     Salvage Co., who billed by the hour), sunk and now "luxury
//     residences": exposed beams, original barnacles, a jellyfish chandelier,
//     a doorman eel, and Mister Periwinkle, broker.
//   · THE GLOW — the trench, where the plankton light up when you move
//     through them, jellyfish waltz, and Lanterne the anglerfish keeps a lamp
//     lit for anyone who comes down in the dark ("up there you had a
//     lighthouse; down here, you have me").
// The bell is not down here either. The survey markers say so.

import * as THREE from 'three';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { REEF } from './oceanlife.js';
import { WATER_Y } from './terrain.js';
import { fbm, smoothstep, hash2, vnoise, turnToward } from './utils.js';
import { tone, plop, jingle } from './audio.js';
import { addPlaceNamer } from './fieldguide.js';

export const CROWN = { x: -1150, z: 0, r: 104 }; // far past camera.far from anywhere up top
const O = CROWN;
const MID = { x: O.x, z: O.z + 12 };                 // the middle of the world, for its bounds
const COURT = { x: O.x, z: O.z, r: 20 };
const KELP = { x: O.x - 58, z: O.z - 30, r: 24 };
const WRECK = { x: O.x + 58, z: O.z - 24, r: 18 };
const GLOW = { x: O.x + 2, z: O.z + 60, r: 22 };
const ARRIVE = { x: O.x, z: O.z + 14 };
const SURFACE_Y = 36; // high enough that the camera never pokes through it

// the Kelp Highway: one loop through every neighborhood
const HWY = [
  [O.x - 8, O.z + 16], [O.x - 26, O.z + 6], [KELP.x + 16, KELP.z + 12], [KELP.x + 4, KELP.z + 24],
  [O.x - 40, O.z + 40], [GLOW.x - 22, GLOW.z - 8], [GLOW.x, GLOW.z - 18], [GLOW.x + 22, GLOW.z - 6],
  [O.x + 44, O.z + 22], [WRECK.x - 8, WRECK.z + 18], [O.x + 30, O.z - 4], [O.x + 10, O.z + 14],
].map(([x, z]) => ({ x, z }));

const STOPS = [
  { name: '왕관', i: 0 },
  { name: '켈프숲', i: 3 },
  { name: '빛나는 곳', i: 6 },
  { name: '레이디 버튼 호', i: 9 },
];

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

function mat(color, rough = 0.55) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
// the toy look: glossy candy plastic
function candy(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.28, metalness: 0.05 });
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function distToHighway(x, z) {
  let best = Infinity;
  for (let i = 0; i < HWY.length; i++) {
    const a = HWY[i], b = HWY[(i + 1) % HWY.length];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}

export function crownHeight(x, z) {
  let h = fbm(x * 0.045 + 5, z * 0.045 - 3) * 1.8 - 0.5; // sand dunes
  const d = Math.hypot(x - MID.x, z - MID.z);
  h += smoothstep(92, 114, d) * 14;                      // the basin's walls
  const gd = Math.hypot(x - GLOW.x, z - GLOW.z);
  h -= smoothstep(GLOW.r, GLOW.r * 0.3, gd) * 8;         // the Glow: a trench
  for (const s of [COURT, WRECK]) {
    const sd = Math.hypot(x - s.x, z - s.z);
    if (sd < s.r) h += (0.1 - h) * smoothstep(s.r, s.r * 0.5, sd);
  }
  // the highway is smoothed by a lot of feet
  const hd = distToHighway(x, z);
  if (hd < 3) h = h * (0.5 + 0.5 * smoothstep(0, 3, hd));
  return h;
}

const blockers = [];
function addBlock(x, z, r) { blockers.push({ x, z, r }); }
const movers = []; // the walkers: solid to you, and polite to each other

export function createCrown(player) {
  const group = new THREE.Group();
  const updates = []; // (dt, t, playerPos) — crown zone only

  zones.registerWorld('crown', {
    root: group,
    groundHeight: crownHeight,
    canWalk(x, z) {
      if (Math.hypot(x - MID.x, z - MID.z) > CROWN.r) return false;
      for (const b of blockers) if (Math.hypot(x - b.x, z - b.z) < b.r) return false;
      // everybody walking about is solid too — unless you're already inside
      // one of them (then they don't hold you, so you can always step away)
      const pp = player.group.position;
      for (const m of movers) {
        if (Math.hypot(x - m.position.x, z - m.position.z) < 0.55 && Math.hypot(pp.x - m.position.x, pp.z - m.position.z) > 0.9) return false;
      }
      return true;
    },
    spawn: { x: ARRIVE.x, z: ARRIVE.z, rotY: Math.PI },
    lighting: {
      bg: 0x2f86b8, fog: 0x2f86b8, fogNear: 14, fogFar: 92,
      hemiSky: 0xa8f0ff, hemiGround: 0x2a5a78, hemiIntensity: 1.15,
      sunIntensity: 1.5,
      sunPos: [O.x + 30, 80, O.z + 20],
      sunTarget: [O.x, 0, O.z],
    },
  });

  addPlaceNamer('crown', (x, z) => {
    const near = (s) => Math.hypot(x - s.x, z - s.z) < s.r + 4;
    if (near(COURT)) return '👑 떨어진 왕관';
    if (near(KELP)) return '🌿 켈프숲';
    if (near(WRECK)) return '🛳️ 레이디 버튼 호';
    if (near(GLOW)) return '✨ 빛나는 곳';
    if (distToHighway(x, z) < 5) return '🫧 켈프 하이웨이';
    return '🫧 떨어진 왕관';
  });

  // ============================================================ the seabed ----
  {
    const SIZE = 250, SEG = 124;
    let geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(MID.x, 0, MID.z);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, crownHeight(pos.getX(i), pos.getZ(i)));
    geo = geo.toNonIndexed();
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const col = new THREE.Color();
    const va = new THREE.Vector3();
    const SAND_A = new THREE.Color(0xf3e1b0), SAND_B = new THREE.Color(0xeed6a2);
    const PINK = new THREE.Color(0xf6cfc6), MOSSY = new THREE.Color(0xa8b98a);
    const ROAD = new THREE.Color(0xfff1d0), DEEP = new THREE.Color(0x3a4a86), WALL = new THREE.Color(0x6f93b4);
    for (let i = 0; i < p.count; i += 3) {
      va.fromBufferAttribute(p, i);
      const y = (va.y + p.getY(i + 1) + p.getY(i + 2)) / 3;
      col.copy(vnoise(va.x * 0.4, va.z * 0.4) > 0.5 ? SAND_A : SAND_B);
      if (Math.hypot(va.x - COURT.x, va.z - COURT.z) < COURT.r - 3) col.lerp(PINK, 0.7);
      if (Math.hypot(va.x - KELP.x, va.z - KELP.z) < KELP.r) col.lerp(MOSSY, 0.55);
      if (distToHighway(va.x, va.z) < 1.6) col.copy(ROAD);
      if (y < -1.5) col.lerp(DEEP, Math.min(1, (-1.5 - y) / 6));
      if (y > 3) col.lerp(WALL, Math.min(1, (y - 3) / 6));
      col.multiplyScalar(1 + (hash2(i, 9) - 0.5) * 0.08);
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = col.r; colors[(i + k) * 3 + 1] = col.g; colors[(i + k) * 3 + 2] = col.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // the surface, seen from underneath: a shimmering bright ceiling
  const shimmer = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    c.fillStyle = '#7fd4f0';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      c.beginPath();
      const y0 = Math.random() * 128;
      c.moveTo(0, y0);
      for (let x = 0; x <= 128; x += 16) c.lineTo(x, y0 + Math.sin(x * 0.08 + i) * 8);
      c.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
  })();
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(260, 260),
    new THREE.MeshBasicMaterial({ map: shimmer, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(MID.x, SURFACE_Y, MID.z);
  group.add(ceiling);
  updates.push((dt) => { shimmer.offset.x += dt * 0.02; shimmer.offset.y += dt * 0.013; });

  // light shafts: soft slanted beams from the surface, swaying
  const shafts = [];
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xeafcff, transparent: true, opacity: 0.07, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 12; i++) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.2, 40, 8, 1, true), shaftMat);
    const a = (i / 12) * Math.PI * 2 + 0.3, r = 12 + (i % 4) * 16;
    shaft.position.set(MID.x + Math.cos(a) * r, 17, MID.z + Math.sin(a) * r);
    shaft.rotation.z = 0.25;
    shaft.userData.ph = i;
    group.add(shaft);
    shafts.push(shaft);
  }
  updates.push((dt, t) => {
    for (const s of shafts) s.rotation.x = Math.sin(t * 0.3 + s.userData.ph) * 0.08;
    shaftMat.opacity = 0.06 + Math.sin(t * 0.7) * 0.015;
  });

  // ======================================================= plankton ----
  // a slow snow of tiny living lights. they flare when something moves
  // through them — you, mostly. denser (and brighter) down in the Glow.
  const PLK = 1100;
  const plkPos = new Float32Array(PLK * 3), plkCol = new Float32Array(PLK * 3);
  const plkBase = [], plkFlare = new Float32Array(PLK);
  const PAL = [new THREE.Color(0x7ff7e6), new THREE.Color(0xb6a8ff), new THREE.Color(0x9fff9a), new THREE.Color(0x7fcfff)];
  for (let i = 0; i < PLK; i++) {
    const inGlow = i < 520;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (inGlow ? GLOW.r : 95);
    const cx = inGlow ? GLOW.x : MID.x, cz = inGlow ? GLOW.z : MID.z;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    plkPos[i * 3] = x;
    plkPos[i * 3 + 1] = crownHeight(x, z) + 0.6 + Math.random() * (inGlow ? 9 : 14);
    plkPos[i * 3 + 2] = z;
    const c = PAL[i % PAL.length];
    plkBase.push({ c, ph: Math.random() * 9, glow: inGlow ? 0.75 : 0.3 });
  }
  const plkGeo = new THREE.BufferGeometry();
  plkGeo.setAttribute('position', new THREE.BufferAttribute(plkPos, 3));
  plkGeo.setAttribute('color', new THREE.BufferAttribute(plkCol, 3));
  const plankton = new THREE.Points(plkGeo, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  group.add(plankton);
  updates.push((dt, t, pp) => {
    for (let i = 0; i < PLK; i++) {
      const b = plkBase[i];
      const x = plkPos[i * 3], y = plkPos[i * 3 + 1], z = plkPos[i * 3 + 2];
      // drift: a slow upward snow that wraps around
      plkPos[i * 3 + 1] = y + dt * 0.12;
      if (plkPos[i * 3 + 1] > 24) plkPos[i * 3 + 1] = crownHeight(x, z) + 0.4;
      if (pp && Math.abs(x - pp.x) < 2.6 && Math.abs(z - pp.z) < 2.6 && Math.abs(y - pp.y - 1) < 2.6) plkFlare[i] = 1;
      plkFlare[i] = Math.max(0, plkFlare[i] - dt * 0.6);
      const k = b.glow * (0.55 + 0.45 * Math.sin(t * 2 + b.ph)) + plkFlare[i] * 1.4;
      plkCol[i * 3] = b.c.r * k; plkCol[i * 3 + 1] = b.c.g * k; plkCol[i * 3 + 2] = b.c.b * k;
    }
    plkGeo.attributes.position.needsUpdate = true;
    plkGeo.attributes.color.needsUpdate = true;
  });

  // rising bubbles, from vents and clams and anyone breathing
  const bubbles = [];
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xeafcff, transparent: true, opacity: 0.55, roughness: 0.1, flatShading: true });
  function bubble(x, y, z, size = 0.1) {
    const b = bubbles.find((q) => !q.visible) || (() => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), bubbleMat);
      group.add(m);
      bubbles.push(m);
      return m;
    })();
    b.visible = true;
    b.scale.setScalar(size);
    b.position.set(x, y, z);
    b.userData.v = 1.2 + Math.random() * 0.8;
    b.userData.wob = Math.random() * 9;
  }
  const vents = [];
  updates.push((dt, t) => {
    for (const b of bubbles) {
      if (!b.visible) continue;
      b.position.y += b.userData.v * dt;
      b.position.x += Math.sin(t * 3 + b.userData.wob) * 0.004;
      if (b.position.y > SURFACE_Y - 0.5) b.visible = false;
    }
    for (const v of vents) {
      v.t -= dt;
      if (v.t <= 0) { v.t = 0.35 + Math.random() * 0.8; bubble(v.x + (Math.random() - 0.5) * 0.3, v.y, v.z, 0.06 + Math.random() * 0.1); }
    }
  });

  // =================================================== coral, the kit ----
  const CANDY = [0xff8fb1, 0xffb86b, 0xc8a2ff, 0x7fe0d0, 0xfff07a, 0xff9aa8, 0x9fd8ff, 0xb8f28a];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function place(obj, x, z, lift = 0) {
    obj.position.set(x, crownHeight(x, z) + lift, z);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(obj);
    return obj;
  }
  function brain(x, z, r = 0.8, c = pick(CANDY)) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), candy(c));
    m.scale.y = 0.7;
    g.add(m);
    for (let k = 0; k < 3; k++) { // the folds
      const fold = new THREE.Mesh(new THREE.TorusGeometry(r * (0.4 + k * 0.2), 0.05, 4, 10), candy(new THREE.Color(c).multiplyScalar(0.85).getHex()));
      fold.rotation.x = Math.PI / 2;
      fold.position.y = r * 0.45 - k * 0.12;
      g.add(fold);
    }
    addBlock(x, z, r * 0.9);
    return place(g, x, z, r * 0.2);
  }
  function bubbles3(x, z, c = pick(CANDY)) {
    const g = new THREE.Group();
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + Math.random() * 0.18, 1), candy(c));
      s.position.set((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.9);
      g.add(s);
    }
    return place(g, x, z);
  }
  function tubes(x, z, c = pick(CANDY)) {
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const h = 0.6 + Math.random() * 1.1;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, h, 7, 1, true), candy(c));
      tube.material.side = THREE.DoubleSide;
      const a = (k / 6) * Math.PI * 2;
      tube.position.set(Math.cos(a) * 0.3, h / 2, Math.sin(a) * 0.3);
      g.add(tube);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 4, 8), candy(0xfff07a));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(tube.position.x, h, tube.position.z);
      g.add(rim);
    }
    addBlock(x, z, 0.6);
    return place(g, x, z);
  }
  function staghorn(x, z, c = pick(CANDY)) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1 + Math.random() * 0.8, 5), candy(c));
      b.position.set((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4);
      b.rotation.set((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
      g.add(b);
      const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), candy(0xffffff));
      tip.position.set(b.position.x + Math.sin(b.rotation.z) * -0.5, b.position.y + 0.5, b.position.z + Math.sin(b.rotation.x) * 0.5);
      g.add(tip);
    }
    return place(g, x, z);
  }
  function fan(x, z, c = pick(CANDY)) {
    const g = new THREE.Group();
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.9, 9, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.5, flatShading: true }));
    f.position.y = 0.1;
    g.add(f);
    g.rotation.y = Math.random() * Math.PI;
    g.userData.sway = Math.random() * 9;
    updates.push((dt, t) => { g.rotation.z = Math.sin(t * 0.9 + g.userData.sway) * 0.12; });
    return place(g, x, z);
  }
  function anemone(x, z, c = pick(CANDY)) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.35, 8), candy(new THREE.Color(c).multiplyScalar(0.8).getHex()));
    base.position.y = 0.17;
    g.add(base);
    const arms = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(a) * 0.25, 0.35, Math.sin(a) * 0.25);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.45, 2, 5), candy(c));
      arm.position.y = 0.25;
      pivot.add(arm);
      pivot.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      pivot.userData = { a, ph: Math.random() * 9 };
      g.add(pivot);
      arms.push(pivot);
    }
    updates.push((dt, t) => {
      for (const p of arms) {
        const w = Math.sin(t * 1.6 + p.userData.ph) * 0.25;
        p.rotation.x = Math.sin(p.userData.a) * (0.4 + w);
        p.rotation.z = -Math.cos(p.userData.a) * (0.4 + w);
      }
    });
    addBlock(x, z, 0.5);
    return place(g, x, z);
  }
  function seastar(x, z, c = pick(CANDY)) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const arm = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), candy(c));
      const a = (k / 5) * Math.PI * 2;
      arm.rotation.set(Math.PI / 2, 0, -a);
      arm.position.set(Math.sin(a) * 0.18, 0.06, Math.cos(a) * 0.18);
      g.add(arm);
    }
    return place(g, x, z);
  }
  function urchin(x, z) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), candy(0x5a3a7a));
    g.add(core);
    for (let k = 0; k < 14; k++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.45, 3), candy(0x7a4aa0));
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
      sp.position.copy(v).multiplyScalar(0.3);
      sp.lookAt(v.clone().multiplyScalar(2));
      sp.rotateX(Math.PI / 2);
      g.add(sp);
    }
    addBlock(x, z, 0.4);
    return place(g, x, z, 0.2);
  }
  function rock(x, z, r = 1) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(0x8fa8b8, 0.9));
    m.scale.y = 0.6;
    m.rotation.y = Math.random() * 3;
    addBlock(x, z, r * 0.85);
    return place(m, x, z, r * 0.15);
  }
  function scatterAround(c, rMin, rMax, n, makers) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (distToHighway(x, z) < 2.4) continue;
      if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 1)) continue;
      pick(makers)(x, z);
    }
  }

  // ================================================ THE CROWN (the court) ----
  // twelve tall coral points in a ring, each tipped with a glowing pearl —
  // the crown itself, dropped, grown over, lived in
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = COURT.x + Math.cos(a) * 15, z = COURT.z + Math.sin(a) * 15;
    if (distToHighway(x, z) < 3.5) continue; // the gates stay open
    const c = CANDY[i % CANDY.length];
    const h = i % 2 ? 5.5 : 8;
    const point = new THREE.Group();
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.5, h, 7), candy(c));
    spire.position.y = h / 2;
    point.add(spire);
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35 - k * 0.3, 0.12, 5, 10), candy(0xffffff));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1 + k * (h / 3.5);
      point.add(ring);
    }
    const jewel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1),
      new THREE.MeshStandardMaterial({ color: 0xfff6f0, emissive: 0xffe0f0, emissiveIntensity: 0.6, roughness: 0.15, flatShading: true }));
    jewel.position.y = h + 0.4;
    point.add(jewel);
    place(point, x, z);
    addBlock(x, z, 1.5);
  }
  scatterAround(COURT, 4, 13, 26, [brain, bubbles3, tubes, staghorn, fan, anemone, seastar]);
  scatterAround(COURT, 16, 22, 18, [brain, tubes, fan, staghorn, rock]);

  // the giant clam: opens, closes, and makes exactly one pearl a day
  {
    const CL = { x: COURT.x + 6, z: COURT.z - 5 };
    const clam = new THREE.Group();
    const shellGeo = new THREE.SphereGeometry(1.1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const lower = new THREE.Mesh(shellGeo, candy(0xc8a2ff));
    lower.rotation.x = Math.PI;
    lower.scale.y = 0.45;
    clam.add(lower);
    const hinge = new THREE.Group();
    hinge.position.z = -1;
    const upper = new THREE.Mesh(shellGeo, candy(0xd8b8ff));
    upper.scale.y = 0.45;
    upper.position.z = 1;
    hinge.add(upper);
    clam.add(hinge);
    const pearl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1),
      new THREE.MeshStandardMaterial({ color: 0xfffaf2, emissive: 0xfff0e0, emissiveIntensity: 0.4, roughness: 0.1 }));
    pearl.position.y = 0.2;
    clam.add(pearl);
    place(clam, CL.x, CL.z, 0.45);
    addBlock(CL.x, CL.z, 1.3);
    vents.push({ x: CL.x, y: crownHeight(CL.x, CL.z) + 0.8, z: CL.z, t: 0 });
    const today = () => new Date().toDateString();
    updates.push((dt, t) => {
      hinge.rotation.x = -(0.25 + Math.max(0, Math.sin(t * 0.4)) * 0.55);
      pearl.visible = S.state.flags.clamPearlDay !== today();
    });
    register({
      pos: new THREE.Vector3(CL.x, 0, CL.z + 1.8), r: 2.4, zone: 'crown',
      label: () => (S.state.flags.clamPearlDay !== today() ? '조개의 진주 받기' : '거대 조개 감상하기'),
      use: () => {
        if (S.state.flags.clamPearlDay === today()) {
          ui.say('조개가 느린 방울 한 줄기를 내뱉어요. 오늘은 이게 다예요. 하루에 진주 하나를 만들고, 한 번도 늦은 적이 없어요.');
          return;
        }
        S.state.flags.clamPearlDay = today();
        S.addItem('pearl');
        jingle();
        ui.foundItem('pearl');
        ui.updateHUD();
      },
    });
  }

  // arrival: a column of bubbles where you came down (and go back up)
  vents.push({ x: ARRIVE.x + 1.5, y: crownHeight(ARRIVE.x + 1.5, ARRIVE.z), z: ARRIVE.z, t: 0 });
  {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, SURFACE_Y, 5), mat(0xd9c08f));
    rope.position.set(ARRIVE.x + 1.5, SURFACE_Y / 2, ARRIVE.z);
    group.add(rope);
    const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 5, 8, Math.PI), mat(0x5a6a7a, 0.4));
    anchor.position.set(ARRIVE.x + 1.5, crownHeight(ARRIVE.x + 1.5, ARRIVE.z) + 0.4, ARRIVE.z);
    anchor.rotation.x = Math.PI;
    group.add(anchor);
    register({
      pos: new THREE.Vector3(ARRIVE.x + 1.5, 0, ARRIVE.z), r: 2.2, zone: 'crown',
      label: '수면으로 헤엄쳐 올라가기',
      use: async () => {
        plop();
        await zones.go('island', { x: REEF.x, z: REEF.z, rotY: 0 });
        ui.toast('햇빛 속으로 수면을 뚫었어요. 암초가 아래에서 빛나요, 비밀을 간직한 듯이. 실제로 간직했거든요.', '🫧');
      },
    });
  }

  // ------------------------------------------------------------ the folk ----
  function walker(g, points, speed, opts = {}) {
    const w = { g, points, i: 0, speed, pause: 1 + Math.random() * 2, ...opts };
    g.position.set(points[0].x, crownHeight(points[0].x, points[0].z), points[0].z);
    group.add(g);
    movers.push(g);
    updates.push((dt, t, pp) => {
      if (w.pause > 0) {
        w.pause -= dt;
        animateGait(g, t, 0);
        if (pp && Math.hypot(pp.x - g.position.x, pp.z - g.position.z) < 4) {
          g.rotation.y = turnToward(g.rotation.y, Math.atan2(pp.x - g.position.x, pp.z - g.position.z), dt, 4);
        }
        return;
      }
      const tg = points[w.i];
      const dx = tg.x - g.position.x, dz = tg.z - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.4) { w.i = (w.i + 1) % points.length; w.pause = w.rest ?? 1.5 + Math.random() * 3; return; }
      let nx = g.position.x + (dx / d) * speed * dt, nz = g.position.z + (dz / d) * speed * dt;
      // somebody in the way? step round them on your right, or wait
      // (walkers used to swim straight through each other)
      const inWay = (x, z) => movers.some((o) => o !== g && Math.hypot(o.position.x - x, o.position.z - z) < 0.85 &&
        Math.hypot(o.position.x - x, o.position.z - z) < Math.hypot(o.position.x - g.position.x, o.position.z - g.position.z));
      if (inWay(nx, nz)) {
        const ux = dx / d + (dz / d) * 1.2, uz = dz / d - (dx / d) * 1.2, ul = Math.hypot(ux, uz);
        const sx = g.position.x + (ux / ul) * speed * dt, sz = g.position.z + (uz / ul) * speed * dt;
        if (inWay(sx, sz) || blockers.some((b) => Math.hypot(sx - b.x, sz - b.z) < b.r)) {
          animateGait(g, t, 0);
          return;
        }
        nx = sx; nz = sz;
      }
      if (pp && Math.hypot(pp.x - nx, pp.z - nz) < 1 && Math.hypot(pp.x - nx, pp.z - nz) < Math.hypot(pp.x - g.position.x, pp.z - g.position.z)) {
        animateGait(g, t, 0);
        return; // you're in the way; they wait
      }
      g.position.set(nx, crownHeight(nx, nz) + (w.lift ?? 0), nz);
      g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 6);
      animateGait(g, t, 1, w.rate ?? 10);
    });
    return w;
  }
  function talker(getPos, name, voice, lines, r = 2.6) {
    let k = 0;
    register({
      getPos, r, zone: 'crown', label: `${name}와(과) 대화하기`,
      use: () => ui.say(lines[k++ % lines.length], { speaker: name, voice }),
    });
  }
  const ring = (c, r, n, off = 0) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + off;
    return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
  });

  // Octavia, on her brain coral, NOT a queen
  {
    const oct = buildAnimal('octopus', { body: 0xff9ab8, head: 0xff9ab8 });
    const seat = brain(COURT.x - 3, COURT.z - 2, 1.3, 0xffd0dc);
    void seat;
    oct.position.set(COURT.x - 3, crownHeight(COURT.x - 3, COURT.z - 2) + 1.05, COURT.z - 2);
    oct.rotation.y = 0.5;
    const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 4, 10), candy(0xfff07a));
    tiara.position.set(0, 1.72, 0);
    tiara.rotation.x = Math.PI / 2 - 0.3;
    oct.add(tiara);
    group.add(oct);
    updates.push((dt, t, pp) => {
      oct.position.y = crownHeight(COURT.x - 3, COURT.z - 2) + 1.05 + Math.sin(t * 1.2) * 0.06;
      animateGait(oct, t, 0.3, 3); // the arms never quite stop
      if (pp) oct.rotation.y = turnToward(oct.rotation.y, Math.atan2(pp.x - oct.position.x, pp.z - oct.position.z), dt, 2);
    });
    talker(() => oct.position, '옥타비아', 330, [
      '이야기는 들었겠지. 바다 여왕, 왕관, 던져 버렸다. 밝혀두지만 나는 여왕이 아니었어. 아주 무거운 모자를 들고 있던 아주 피곤한 문어였을 뿐이야.',
      '세상 끝으로 던졌어. 여기 떨어져서 자랐지. 이제 모두가 그 안에 살고 아무도 쓸 필요가 없어. 내 인생 최고의 결정이야.',
      '티아라? 아, 이건 코스튬이야. 농담일 때는 왕관을 써도 돼. 그게 비밀 전부야.',
      '브라인 가족에게 안부 전해 줘. 할머니들은 항상 이야기를 정확히 알지. 그 다음 사람들이 칼을 덧붙이는 거야.',
    ]);
  }

  // Delphine: a dolphin. with legs. in sneakers. doing laps.
  {
    const del = buildAnimal('dolphin', { body: 0x8fb4cc, head: 0x8fb4cc, belly: 0xeef6fa });
    walker(del, ring(COURT, 9, 8, 0.2), 2.4, { rest: 0.6, rate: 13 });
    talker(() => del.position, '델핀', 700, [
      '안녕!! 나 델핀! 돌고래야! 응, 다리! 지느러미 써 봤어. 다리가 육지에서 더 빠르고 나는 육지에 절대 안 가. 원칙의 문제야!',
      '운동화는 접지력 때문이야. 모래가 엄청 미끄럽거든. 사람들한테는 그렇게 말해. 사실은 그냥 좋아해.',
      '조개까지 달리기 시합! 아니! 잠깐! 너 말고! 너 공기 가득한 모자 썼잖아! 그건 반칙이면서 귀여워!',
    ]);
  }

  // Bernard: a blue whale, the largest animal that has ever lived, exactly as
  // tall as you. strolling the highway like any other gentleman.
  {
    const ber = buildAnimal('whale', { body: 0x5a7fa8, head: 0x5a7fa8, belly: 0xc9d8e2 });
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 10), mat(0x2e2a26));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.42, 10), mat(0x2e2a26));
    top.position.y = 0.23;
    hat.add(brim, top);
    hat.position.set(0, 1.45, 0.45);
    ber.add(hat);
    walker(ber, [HWY[1], HWY[2], { x: (HWY[2].x + HWY[3].x) / 2 + 2, z: (HWY[2].z + HWY[3].z) / 2 }, HWY[2]], 1.1, { rest: 4 });
    talker(() => ber.position, '버나드', 150, [
      '실례. 지나갈게. 조심해 — 나 고래야. 역사상 가장 큰 동물이라더군.',
      '자꾸 “안 그래 보이는데”라고들 해. 나는 그냥 머리에 안 두거든. 어디에 두겠어? 내 머리는 엄청나다고.',
      '매일 아침 하이웨이를 이용해. 꼬리지느러미에 좋아. 의사 지시야. 의사가 해삼이긴 한데, 그래도.',
    ]);
  }

  // Gil and Marina: fish-folk out for a jog around the crown, every day, forever
  {
    const gil = buildAnimal('fishfolk', { body: 0xffa94d, fin: 0xff6b6b, stripe: 0xfff6e8 });
    const mar = buildAnimal('fishfolk', { body: 0x9fd8ff, fin: 0xc8a2ff, stripe: 0xfff6e8, lips: 0xff9ab8 });
    gil.scale.setScalar(0.8);
    mar.scale.setScalar(0.8);
    walker(gil, ring(COURT, 12, 14), 3.2, { rest: 0.05, rate: 16 });
    walker(mar, ring(COURT, 12, 14, 0.35), 3.2, { rest: 0.05, rate: 16 });
    talker(() => gil.position, '길', 600, [
      '(헉) 마흔 바퀴. (헉) 마리나는 쉰 바퀴래. (헉) 마리나는 말이 많아.',
      '다리는 우리한텐 신상이야! 진화가 너무 오래 걸려서. 그냥 우리가 결정했어.' ]);
    talker(() => mar.position, '마리나', 660, [
      '따라와, 길! (그녀는 계속 달려요.)',
      '물속 달리기의 비결은 안 달리는 거야. 서둘러 떠가는 거지. 하나의 스포츠야.' ]);
  }

  // glitter crabs: sparkly, sideways, everywhere. Sequin runs the gossip.
  {
    const crabs = [];
    const CRAB_C = [0xff8fb1, 0xc8a2ff, 0x7fe0d0, 0xffb86b, 0xfff07a];
    for (let i = 0; i < 10; i++) {
      const crab = buildAnimal('crab', { body: CRAB_C[i % CRAB_C.length] });
      crab.scale.setScalar(0.45);
      const sequins = [];
      for (let k = 0; k < 7; k++) {
        const s2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.1 }));
        s2.position.set((Math.random() - 0.5) * 0.9, 0.62 + Math.random() * 0.1, (Math.random() - 0.5) * 0.6);
        crab.add(s2);
        sequins.push(s2);
      }
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 16;
      crab.position.set(COURT.x + Math.cos(a) * r, 0, COURT.z + Math.sin(a) * r);
      Object.assign(crab.userData, { sequins, dir: Math.random() * Math.PI * 2, t: Math.random() * 3 });
      group.add(crab);
      crabs.push(crab);
    }
    updates.push((dt, t) => {
      for (const c of crabs) {
        const u = c.userData;
        u.t -= dt;
        if (u.t < 0) { u.t = 1 + Math.random() * 3; u.dir += (Math.random() - 0.5) * 2; }
        // sideways, always sideways
        const nx = c.position.x + Math.cos(u.dir) * dt * 0.9, nz = c.position.z + Math.sin(u.dir) * dt * 0.9;
        if (Math.hypot(nx - COURT.x, nz - COURT.z) < COURT.r - 2 && !blockers.some((b) => Math.hypot(b.x - nx, b.z - nz) < b.r)) {
          c.position.x = nx; c.position.z = nz;
        } else u.dir += Math.PI;
        c.position.y = crownHeight(c.position.x, c.position.z);
        c.rotation.y = u.dir; // (facing across its own path: crab)
        animateGait(c, t, 1, 18);
        for (const s2 of u.sequins) s2.material.emissiveIntensity = Math.random() < 0.04 ? 1.4 : Math.max(0.15, s2.material.emissiveIntensity * 0.9);
      }
    });
    talker(() => crabs[0].position, '스팽글', 820, [
      '충분히 세게 믿으면 뭐든 반짝여. 나는 아주 세게 믿어.',
      '옥타비아는 여왕이 아니었다는데, 배만 한 왕관을 쓰고 있었어. 그냥 말이야. 그냥 말이라고.',
      '레이디 버튼 호 가 봤어? 젠트리피케이션. 젠트리피케이션이야. 멀쩡한 난파선이었는데. 이제 도어맨이 있어.',
    ], 2.2);
  }

  // little fish in schools: candy-colored, big-eyed, circling
  function school(c, n, colr, rad, height) {
    const fish = [];
    for (let i = 0; i < n; i++) {
      const f = new THREE.Group();
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), candy(colr));
      body.scale.set(0.6, 0.9, 1.3);
      f.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.2, 3), candy(colr));
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.3;
      tail.scale.x = 0.3;
      f.add(tail);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x222222, 0.3));
        eye.position.set(sx * 0.1, 0.06, 0.14);
        f.add(eye);
      }
      f.userData = { off: new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.2), ph: Math.random() * 9 };
      group.add(f);
      fish.push(f);
    }
    const speed = 0.25 + Math.random() * 0.15;
    updates.push((dt, t) => {
      const a = t * speed + c.x;
      const cx = c.x + Math.cos(a) * rad, cz = c.z + Math.sin(a) * rad;
      const heading = Math.atan2(-Math.sin(a), Math.cos(a));
      for (const f of fish) {
        const u = f.userData;
        f.position.set(cx + u.off.x, crownHeight(cx, cz) + height + u.off.y + Math.sin(t * 2 + u.ph) * 0.15, cz + u.off.z);
        f.rotation.y = heading;
      }
    });
  }
  school(COURT, 12, 0xffb86b, 8, 3);
  school(COURT, 10, 0x9fd8ff, 11, 5);
  school({ x: COURT.x + 4, z: COURT.z + 6 }, 9, 0xff8fb1, 5, 2.4);

  // ============================================================ KELPWOOD ----
  {
    const kelps = [];
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x8aa84a, roughness: 0.6, flatShading: true, side: THREE.DoubleSide });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xa8c05a, roughness: 0.6, flatShading: true, side: THREE.DoubleSide });
    const bulbMat = candy(0xc9a84a);
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * KELP.r;
      const x = KELP.x + Math.cos(a) * r, z = KELP.z + Math.sin(a) * r;
      if (distToHighway(x, z) < 2.6) continue;
      if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 1.2)) continue;
      // a stalk: a chain of segments, each hinged to the last, so it sways
      const root = new THREE.Group();
      root.position.set(x, crownHeight(x, z), z);
      let parent = root;
      const segs = [];
      const n = 8 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const seg = new THREE.Group();
        seg.position.y = k === 0 ? 0 : 1.9;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 4), kelpMat);
        stem.position.y = 0.95;
        seg.add(stem);
        if (k % 2 === 1) {
          const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.4), bladeMat);
          blade.position.set(0.3, 1.0, 0);
          blade.rotation.z = -0.6;
          seg.add(blade);
          const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), bulbMat);
          bulb.position.set(0.05, 1.3, 0);
          seg.add(bulb);
        }
        seg.rotation.y = Math.random() * Math.PI * 2;
        parent.add(seg);
        parent = seg;
        segs.push(seg);
      }
      root.userData = { segs, ph: Math.random() * 9 };
      group.add(root);
      kelps.push(root);
      blockers.push({ x, z, r: 0.35 });
    }
    updates.push((dt, t) => {
      for (const k of kelps) {
        const u = k.userData;
        for (let i = 0; i < u.segs.length; i++) {
          u.segs[i].rotation.z = Math.sin(t * 0.8 + u.ph + i * 0.35) * 0.07;
          u.segs[i].rotation.x = Math.cos(t * 0.6 + u.ph + i * 0.3) * 0.05;
        }
      }
    });
    scatterAround(KELP, 2, KELP.r, 14, [rock, urchin, urchin, seastar]);
    school(KELP, 8, 0xff8a2a, 9, 4); // garibaldi: bright orange, very territorial, very proud
    school({ x: KELP.x + 6, z: KELP.z - 6 }, 6, 0xff8a2a, 6, 7);
    // otters on the surface, holding hands so they don't drift apart —
    // from down here: two little silhouettes against the light
    for (const [ox, oz] of [[0, 0], [1.1, 0.2]]) {
      const ot = buildAnimal('otter', { body: 0x6e5040, head: 0x6e5040 });
      ot.rotation.set(Math.PI, 0.3, 0); // floating on their backs
      ot.position.set(KELP.x + ox, SURFACE_Y - 0.4, KELP.z + oz + 4);
      group.add(ot);
      updates.push((dt, t) => { ot.position.y = SURFACE_Y - 0.4 + Math.sin(t * 0.9 + ox) * 0.08; });
    }
    // Ranger Holdfast, keeper of the Highway
    const ranger = buildAnimal('otter', { body: 0x8a6a50, head: 0x8a6a50 });
    const rhat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.1, 10), mat(0x6b5a3a));
    rhat.position.set(0, 1.52, 0.5);
    ranger.add(rhat);
    const crownR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.26, 10), mat(0x6b5a3a));
    crownR.position.set(0, 1.68, 0.5);
    ranger.add(crownR);
    const RS = HWY[3];
    ranger.position.set(RS.x + 2.5, crownHeight(RS.x + 2.5, RS.z), RS.z);
    group.add(ranger);
    blockers.push({ x: RS.x + 2.5, z: RS.z, r: 0.6 });
    updates.push((dt, t, pp) => {
      animateGait(ranger, t, 0);
      if (pp) ranger.rotation.y = turnToward(ranger.rotation.y, Math.atan2(pp.x - ranger.position.x, pp.z - ranger.position.z), dt, 3);
    });
    talker(() => ranger.position, '홀드패스트 레인저', 380, [
      '홀드패스트 레인저야. 켈프 하이웨이를 지켜: 표지판, 거품, 분실물. 대부분 분실물. 대부분 아주 끈질긴 슬리퍼 한 짝.',
      '위쪽 사람들 말로는 최초의 여행자들이 켈프 숲을 따라 긴 해안을 내려왔대 — 먹을 것, 쉴 곳, 잔잔한 물, 계속. 숲으로 된 길. 그 이야기 좋아해. 그 일을 하고 있어.',
      '너울이 지나갈 땐 뭔가 꽉 잡아. 그게 이름(꽉 잡아)의 뜻이야. 좋은 조언이기도 하고.',
    ]);
  }

  // ===================================================== THE LADY BUTTON ----
  // Moledecai Salvage Co.'s old barge, sunk looking for the bell, now
  // "luxury residences." The hull is cut open along one side like a
  // dollhouse, so you can see every floor.
  {
    const W = WRECK;
    const ship = new THREE.Group();
    const wood = 0x8a5a3a, dark = 0x5a3a26;
    const len = 16, wid = 5.6, hgt = 6.4;
    // hull: bottom, far side, both ends — the near side is cut away
    const keel = box(len, 0.6, wid, dark);
    keel.position.y = 0.3;
    ship.add(keel);
    // the belly of the barge: a long tapered prism half-buried in the sand
    const bellyGeo = new THREE.CylinderGeometry(wid * 0.62, wid * 0.62, len + 1.2, 3, 1, false, Math.PI / 2);
    bellyGeo.rotateZ(Math.PI / 2);
    const belly = new THREE.Mesh(bellyGeo, mat(dark));
    belly.rotation.x = Math.PI; // point down, like a keel
    belly.scale.y = 0.45;
    belly.position.y = 0.1;
    ship.add(belly);
    // gold trim, because the brochure said "gold trim"
    for (const ty of [2.5, 4.5, hgt + 0.15]) {
      const trim = box(len + 0.1, 0.12, 0.14, 0xe0b44a);
      trim.position.set(0, ty, -wid / 2 + 0.25);
      ship.add(trim);
    }
    // wallpaper on the far wall, a different pattern per floor, faintly lit
    for (const [fy, col] of [[1.6, 0x2f7d7a], [3.6, 0x8a3a4a], [5.6, 0x3a5a8a]]) {
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.6, 1.8),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.8 }));
      paper.position.set(0, fy, -wid / 2 + 0.21);
      ship.add(paper);
      for (const lx of [-4.5, 4.5]) { // a pair of warm sconces per floor
        const sconce = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0),
          new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffd98f, emissiveIntensity: 1.3 }));
        sconce.position.set(lx, fy + 0.5, -wid / 2 + 0.35);
        ship.add(sconce);
      }
    }
    const far = box(len, hgt, 0.4, wood);
    far.position.set(0, hgt / 2, -wid / 2);
    ship.add(far);
    for (const sx of [-1, 1]) {
      const end = box(0.4, hgt, wid, wood);
      end.position.set(sx * len / 2, hgt / 2, 0);
      ship.add(end);
    }
    const bow = new THREE.Mesh(new THREE.ConeGeometry(wid / 2, 3, 4), mat(wood));
    bow.rotation.set(0, Math.PI / 4, -Math.PI / 2);
    bow.scale.set(1, 1, 0.7);
    bow.position.set(len / 2 + 1.4, hgt * 0.45, 0);
    ship.add(bow);
    // floors: lobby, lounge, and the penthouse deck
    const floors = [0.6, 2.6, 4.6];
    for (const fy of floors.slice(1)) {
      const fl = box(len - 0.4, 0.2, wid - 0.4, 0xc9a07a);
      fl.position.y = fy;
      ship.add(fl);
    }
    const deck = box(len, 0.25, wid, 0xb08a5a);
    deck.position.y = hgt;
    ship.add(deck);
    // a cut edge of broken ribs along the open side — the dollhouse face
    for (let k = -3; k <= 3; k++) {
      const rib = box(0.25, hgt * (0.55 + (k % 2 ? 0.2 : 0)), 0.3, dark);
      rib.position.set(k * 2.2, rib.geometry.parameters.height / 2, wid / 2 - 0.1);
      ship.add(rib);
    }
    // warm porthole lights along the far wall, two rows
    for (let k = -3; k <= 3; k++) {
      for (const py of [1.7, 3.7]) {
        const ph = new THREE.Mesh(new THREE.CircleGeometry(0.28, 8),
          new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffd98f, emissiveIntensity: 0.9 }));
        ph.position.set(k * 2.1, py, -wid / 2 + 0.22);
        ship.add(ph);
      }
    }
    // LOBBY: reception desk, a potted anemone, velvet rope
    const desk = box(2.4, 1.0, 0.8, 0x6e3a4a);
    desk.position.set(-3, 1.1, -1.2);
    ship.add(desk);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 4, 10, Math.PI), mat(0xc4413a));
    rope.position.set(2, 1.3, 1.4);
    ship.add(rope);
    for (const sx of [1.1, 2.9]) {
      const stanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.9, 6), mat(0xc9962e, 0.3));
      stanchion.position.set(sx, 1.05, 1.4);
      ship.add(stanchion);
    }
    // LOUNGE: velvet couch, a rug, a record player, the jellyfish chandelier
    const couch = box(3.2, 0.7, 1.1, 0x8a4ab0);
    couch.position.set(-2, 3.05, -1.8);
    ship.add(couch);
    const cback = box(3.2, 0.8, 0.3, 0x7a3aa0);
    cback.position.set(-2, 3.5, -2.3);
    ship.add(cback);
    const rug = box(3.6, 0.04, 2.4, 0xd9a440);
    rug.position.set(-2, 2.73, 0.2);
    ship.add(rug);
    const player0 = box(0.7, 0.4, 0.6, 0x3a2a1e);
    player0.position.set(3, 2.95, -1.8);
    ship.add(player0);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12), mat(0x111111, 0.2));
    disc.position.set(3, 3.17, -1.8);
    ship.add(disc);
    const jellies = [];
    for (let k = 0; k < 5; k++) {
      const jb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xffc8f0, emissive: 0xff9ae0, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 }));
      const a = (k / 5) * Math.PI * 2;
      jb.position.set(-2 + Math.cos(a) * 0.7, 4.0, 0.2 + Math.sin(a) * 0.7);
      ship.add(jb);
      jellies.push(jb);
    }
    // PENTHOUSE: deck chairs, a striped umbrella, a sea-cucumber sommelier
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), candy(0xff8fb1));
    umbrella.position.set(1.5, hgt + 2.1, 0.5);
    ship.add(umbrella);
    const upole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 5), mat(0xffffff));
    upole.position.set(1.5, hgt + 1.1, 0.5);
    ship.add(upole);
    for (const sx of [-0.4, 3.2]) {
      const chair = box(0.8, 0.14, 1.6, 0xfff6e8);
      chair.position.set(sx, hgt + 0.45, 0.8);
      chair.rotation.x = -0.25;
      ship.add(chair);
    }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 5, 6), mat(dark));
    mast.position.set(-5, hgt + 1.8, -1);
    mast.rotation.z = 0.5; // snapped, and leaning on its dignity
    ship.add(mast);
    ship.position.set(W.x, crownHeight(W.x, W.z), W.z);
    ship.rotation.y = 0.3;
    ship.rotation.z = 0.04;
    ship.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(ship);
    // solid hull (walk up to its open side and look in)
    const hc = Math.cos(0.3), hs = Math.sin(0.3);
    for (let k = -3; k <= 3; k++) {
      const lx = k * 2.3, lz = -0.3; // (on the keel's midline: you used to wade knee-deep into its near side)
      blockers.push({ x: W.x + lx * hc + lz * hs, z: W.z - lx * hs + lz * hc, r: 2.4 });
    }
    updates.push((dt, t) => {
      for (const [k, jb] of jellies.entries()) jb.position.y = 4.0 + Math.sin(t * 1.5 + k) * 0.1;
    });
    const face = (lx, lz) => new THREE.Vector3(W.x + lx * hc + lz * hs, 0, W.z - lx * hs + lz * hc);
    // the sign out front
    const sign = new THREE.Group();
    const board = box(3.6, 1.0, 0.12, 0x2e2a26);
    board.position.y = 1.8;
    sign.add(board);
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 140;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#2e2a26'; cx.fillRect(0, 0, 512, 140);
    cx.fillStyle = '#e8c56a'; cx.textAlign = 'center';
    cx.font = 'italic 700 46px Georgia, serif';
    cx.fillText('레이디 버튼 호', 256, 60);
    cx.font = '600 16px ui-rounded, system-ui, sans-serif'; // (at 22 it ran off both edges)
    cx.fillStyle = '#f3ead6';
    cx.fillText('럭셔리 레지던스 · 노출 보 · 오리지널 따개비', 256, 104);
    const signTex = new THREE.CanvasTexture(cv);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.95), new THREE.MeshBasicMaterial({ map: signTex }));
    signFace.position.set(0, 1.8, 0.07);
    sign.add(signFace);
    for (const sx of [-1.6, 1.6]) {
      const post = box(0.12, 1.4, 0.12, 0xc9962e);
      post.position.set(sx, 0.7, 0);
      sign.add(post);
    }
    const sp = face(-4, 7);
    sign.position.set(sp.x, crownHeight(sp.x, sp.z), sp.z);
    sign.rotation.y = 0.3;
    group.add(sign);
    blockers.push({ x: sp.x, z: sp.z, r: 0.5 });
    // the doorman: an eel in a little cap, leaning on the ribs
    const eel = new THREE.Group();
    const eelMat = candy(0x6a9a5a);
    for (let k = 0; k < 7; k++) {
      const seg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 - k * 0.018, 0), eelMat);
      seg.position.set(Math.sin(k * 0.7) * 0.25, 0.25 + k * 0.28, 0);
      eel.add(seg);
    }
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x222222, 0.3));
      eye.position.set(sx * 0.1, 1.95, 0.16);
      eel.add(eye);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 8), mat(0x2e3a6a));
    cap.position.set(0, 2.15, 0);
    eel.add(cap);
    const ep = face(4, 4);
    eel.position.set(ep.x, crownHeight(ep.x, ep.z), ep.z);
    group.add(eel);
    blockers.push({ x: ep.x, z: ep.z, r: 0.5 });
    updates.push((dt, t) => {
      eel.children.forEach((c, k) => { if (k < 7) c.position.x = Math.sin(k * 0.7 + t * 1.6) * 0.25; });
    });
    talker(() => eel.position, '모리스 (도어맨)', 290, [
      '좋은 저녁이야. 입주민과 손님만. …손님처럼 보이네. 손님의 모자를 썼어. 들어가.',
      '레이디 버튼 호는 마흔 여름 전, 종을 찾다 가라앉았지. 가는 내내 시간당 청구. 이제는 시간이 우리에게 청구해. 그게 부동산이야.',
    ]);
    // Mister Periwinkle, broker: a hermit crab in a VERY good shell
    const peri = buildAnimal('crab', { body: 0xe07a5a });
    peri.scale.setScalar(0.8);
    const shell = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const whorl = new THREE.Mesh(new THREE.TorusGeometry(0.42 - k * 0.09, 0.14 - k * 0.02, 5, 10), candy(0xfff0d8));
      whorl.rotation.x = Math.PI / 2;
      whorl.position.y = 0.85 + k * 0.16;
      shell.add(whorl);
    }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), candy(0xffd0a0));
    spire.position.y = 1.55;
    shell.add(spire);
    shell.position.z = -0.2;
    peri.add(shell);
    const pp0 = face(-1, 5);
    peri.position.set(pp0.x, crownHeight(pp0.x, pp0.z), pp0.z);
    group.add(peri);
    blockers.push({ x: pp0.x, z: pp0.z, r: 0.6 });
    updates.push((dt, t, pp) => {
      animateGait(peri, t, 0);
      if (pp) peri.rotation.y = turnToward(peri.rotation.y, Math.atan2(pp.x - peri.position.x, pp.z - peri.position.z), dt, 3);
    });
    register({
      getPos: () => peri.position, r: 2.6, zone: 'crown',
      label: '페리윙클 씨와 대화하기',
      use: async () => {
        const c = await ui.ask('“페리윙클. 중개인이야. 선체를 알아보는 눈을 하셨군.”', [
          { label: '호실 둘러보기', value: 'tour' },
          { label: '종에 대해 묻기', value: 'bell' },
          { label: '그의 껍데기에 대해 묻기', value: 'shell' },
          { label: '나가기', value: null },
        ], { speaker: '페리윙클 씨', voice: 520 });
        if (c === 'tour') {
          ui.say([
            '“1A호: 로비 인접. 전 주방. 인양팀 스튜 냄새는 완전히 제거됨. 대체로.”',
            '“2B호: 라운지. 벨벳. 살아있는 해파리 조명. 레코드는 고래 노래만, 그것도 고래 한 마리만 나오는데 좀 웅얼거려.”',
            '“펜트하우스: 오픈 플랜, 오픈 에어, 오픈 씨. 천장? 협의 가능. 없다는 뜻이야.”',
          ], { speaker: '페리윙클 씨', voice: 520 });
        } else if (c === 'bell') {
          ui.say([
            '“종? 아. 이 물건의 원래 목적이지. 몰드카이 인양이 이 대륙붕 전체를 마흔 여름간 뒤졌어. 부츠 발견. 대포 발견. 두 번째 대포 발견. 종은 없어.”',
            '“0호 — 빌지 — 는 매물 아님. 아래에서 대조기마다 뭔가 반짝여. 입주민들에겐 동전이라고 해. 물론, 아름답게 거짓말하는 거야.”',
          ], { speaker: '페리윙클 씨', voice: 520 });
        } else if (c === 'shell') {
          ui.say('“이거? 빈티지야. 전 주인은 아주 크고 취향 좋은 고둥. 나도 다들 그렇듯 임대 중이야. 우린 다 껍데기를 임대하는 거야, 자기.”', { speaker: '페리윙클 씨', voice: 520 });
        }
      },
    });
    register({
      pos: face(0, 4), r: 3.4, zone: 'crown', priority: 0,
      label: '레이디 버튼 호 들여다보기',
      use: () => ui.say([
        '인형 집처럼 절개된 3개 층: 벨벳 로프의 로비, 진짜 해파리 샹들리에 아래 라운지, 그리고 줄무늬 파라솔에 천장이 아예 없는 펜트하우스 데크.',
        '꼭대기 데크에서 나비넥타이 맨 해삼이 바닷물 잔을 흔들며 사색하듯 고개를 끄덕여요. 그는 소믈리에예요. 바닷물은 “시원한 맛”으로 평가돼요.',
      ]),
    });
    // the salvage company's survey marker, still standing
    const marker = new THREE.Group();
    const mpost = box(0.14, 1.4, 0.14, 0xc9962e);
    mpost.position.y = 0.7;
    marker.add(mpost);
    const plate = box(0.9, 0.5, 0.06, 0x9aa3ad);
    plate.position.y = 1.4;
    marker.add(plate);
    const mp = face(6, 8);
    marker.position.set(mp.x, crownHeight(mp.x, mp.z), mp.z);
    group.add(marker);
    blockers.push({ x: mp.x, z: mp.z, r: 0.3 });
    register({
      pos: mp, r: 1.8, zone: 'crown',
      label: '측량 표지 읽기',
      use: () => ui.say('가장자리가 녹슨 놋쇠판: “몰드카이 인양 주식회사 — 측량 표지 38 — 종: 여기도 없음. (청구: 6시간)”'),
    });
    scatterAround(W, W.r - 4, W.r + 4, 10, [rock, brain, fan, tubes]);
  }

  // ============================================================ THE GLOW ----
  {
    // jellyfish, waltzing slowly in the dark
    const jellies = [];
    for (let i = 0; i < 9; i++) {
      const col = [0xff9ae0, 0x9ad8ff, 0xc8a2ff][i % 3];
      const j = new THREE.Group();
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
      j.add(bell);
      for (let k = 0; k < 6; k++) {
        const ten = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 1.3, 3),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 }));
        const a = (k / 6) * Math.PI * 2;
        ten.position.set(Math.cos(a) * 0.3, -0.65, Math.sin(a) * 0.3);
        j.add(ten);
      }
      const a = (i / 9) * Math.PI * 2, r = 5 + (i % 3) * 5;
      j.userData = { a, r, ph: i * 1.3, y0: 2 + (i % 4) * 1.5 };
      group.add(j);
      jellies.push(j);
    }
    updates.push((dt, t) => {
      for (const j of jellies) {
        const u = j.userData;
        const a = u.a + t * 0.05;
        const x = GLOW.x + Math.cos(a) * u.r, z = GLOW.z + Math.sin(a) * u.r;
        const pulse = Math.sin(t * 1.8 + u.ph);
        j.position.set(x, crownHeight(x, z) + u.y0 + 3 + pulse * 0.4, z);
        j.scale.set(1 + pulse * 0.08, 1 - pulse * 0.1, 1 + pulse * 0.08);
      }
    });
    // lanternfish: little dark fish with glowing dots
    const lfish = [];
    for (let i = 0; i < 14; i++) {
      const f = new THREE.Group();
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(0x2a3050));
      b.scale.set(0.6, 0.8, 1.4);
      f.add(b);
      for (let k = 0; k < 3; k++) {
        const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: 0x9ff8ff }));
        dot.position.set(0.1, -0.05, 0.12 - k * 0.12);
        f.add(dot);
      }
      f.userData = { ph: Math.random() * 9, r: 3 + Math.random() * 14, sp: 0.2 + Math.random() * 0.3, y: 1 + Math.random() * 6 };
      group.add(f);
      lfish.push(f);
    }
    updates.push((dt, t) => {
      for (const f of lfish) {
        const u = f.userData;
        const a = t * u.sp + u.ph;
        const x = GLOW.x + Math.cos(a) * u.r, z = GLOW.z + Math.sin(a) * u.r;
        f.position.set(x, crownHeight(x, z) + u.y, z);
        f.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
      }
    });
    // Lanterne, the anglerfish who keeps a lamp for anyone down here
    const ang = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), mat(0x3a3a5a, 0.5));
    body.scale.set(1, 0.9, 1.1);
    ang.add(body);
    const jaw = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), mat(0x2a2a44, 0.5));
    jaw.scale.set(1.1, 0.5, 0.8);
    jaw.position.set(0, -0.35, 0.45);
    ang.add(jaw);
    for (let k = -3; k <= 3; k++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 3), mat(0xfaf7ee, 0.3));
      tooth.rotation.x = Math.PI;
      tooth.position.set(k * 0.14, -0.05, 0.95);
      ang.add(tooth);
    }
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), mat(0xfaf7ee, 0.2));
      eye.position.set(sx * 0.42, 0.35, 0.62);
      ang.add(eye);
      const pupil = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(0x111111, 0.2));
      pupil.position.set(sx * 0.42, 0.35, 0.76);
      ang.add(pupil);
    }
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 5), mat(0x3a3a5a));
    stalk.position.set(0, 1.2, 0.4);
    stalk.rotation.x = 0.5;
    ang.add(stalk);
    const lure = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1),
      new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffe680, emissiveIntensity: 1.6 }));
    lure.position.set(0, 1.75, 0.8);
    ang.add(lure);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(3, 3, 1);
    halo.position.copy(lure.position);
    ang.add(halo);
    const AP = { x: GLOW.x, z: GLOW.z + 2 };
    ang.position.set(AP.x, crownHeight(AP.x, AP.z) + 1.6, AP.z);
    group.add(ang);
    blockers.push({ x: AP.x, z: AP.z, r: 1.3 });
    updates.push((dt, t, pp) => {
      ang.position.y = crownHeight(AP.x, AP.z) + 1.6 + Math.sin(t * 0.8) * 0.15;
      lure.material.emissiveIntensity = 1.3 + Math.sin(t * 2.2) * 0.4;
      halo.material.opacity = 0.4 + Math.sin(t * 2.2) * 0.15;
      if (pp) ang.rotation.y = turnToward(ang.rotation.y, Math.atan2(pp.x - ang.position.x, pp.z - ang.position.z), dt, 1.5);
    });
    talker(() => ang.position, '랜턴', 260, [
      'Don’t mind the teeth. They came with the face. The lamp is the important part.',
      '위엔 등대가 있었지. 아래엔 내가 있어. 같은 일이야. 어둠 속으로 내려오는 누군가를 위해 불을 켜둘 이가 있어야지.',
      '플랑크톤 사이로 발을 휘저어 봐. 움직이면 빛나거든. 모든 것에, 언제나 “오! 안녕!”이라고 말하는 방식이야. 아주 힘이 돼.',
      '가끔, 대조기엔, 무언가 울리는 소리가 들려. 멀리서. 한 번. 그런 밤엔 램프를 조금 더 밝혀 둬. 혹시 우리를 찾고 있을지 모르니까.',
    ], 3.2);
    register({
      pos: new THREE.Vector3(GLOW.x - 6, 0, GLOW.z + 6), r: 5, zone: 'crown', priority: 0,
      label: '플랑크톤 사이로 발 휘젓기',
      use: () => {
        for (let i = 0; i < PLK; i++) plkFlare[i] = Math.hypot(plkPos[i * 3] - player.group.position.x, plkPos[i * 3 + 2] - player.group.position.z) < 7 ? 1 : plkFlare[i];
        tone(1480, { dur: 0.5, type: 'sine', vol: 0.02 });
        tone(1976, { time: 0.1, dur: 0.6, type: 'sine', vol: 0.015 });
        ui.toast('플랑크톤이 주변에서 환하게 빛나요 — 수천 개의 작은 “오! 안녕!”.', '✨');
      },
    });
    scatterAround(GLOW, 4, GLOW.r, 12, [rock, rock, urchin]);
  }

  // ======================================================= THE KELP HIGHWAY ----
  // road markers along the way, and the bubble stops
  {
    const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xfff6e8, 0.6), 400);
    let n = 0;
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < HWY.length && n < 400; i++) {
      const a = HWY[i], b = HWY[(i + 1) % HWY.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const px = -(b.z - a.z) / len, pz = (b.x - a.x) / len;
      for (let d = 0; d < len && n < 398; d += 2.2) {
        for (const s2 of [-1.9, 1.9]) {
          const x = a.x + (b.x - a.x) * (d / len) + px * s2, z = a.z + (b.z - a.z) * (d / len) + pz * s2;
          m4.makeTranslation(x, crownHeight(x, z) + 0.05, z);
          stones.setMatrixAt(n++, m4);
        }
      }
    }
    stones.count = n;
    group.add(stones);
    // highway shields at each stop, and a few road signs in between
    function roadSign(x, z, text, ry) {
      const g = new THREE.Group();
      const post = box(0.12, 1.8, 0.12, 0x9aa3ad);
      post.position.y = 0.9;
      g.add(post);
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const c = cv.getContext('2d');
      c.fillStyle = '#2f7d4f'; c.fillRect(0, 0, 256, 128);
      c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(6, 6, 244, 116);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      let size = 34;
      const lines = text.split('\n');
      do { c.font = `700 ${size}px ui-rounded, system-ui, sans-serif`; size -= 2; } while (lines.some((l) => c.measureText(l).width > 230) && size > 12);
      lines.forEach((l, i) => c.fillText(l, 128, 64 + (i - (lines.length - 1) / 2) * (size + 6)));
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      // a board with a face on its front (it used to be one double-sided
      // plane on the post's centerline: mirrored from behind, post through the text)
      const back = box(1.46, 0.76, 0.08, 0x2f7d4f);
      back.position.y = 1.9;
      g.add(back);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: tex }));
      face.position.set(0, 1.9, 0.045);
      g.add(face);
      g.position.set(x, crownHeight(x, z), z);
      g.rotation.y = ry;
      group.add(g);
      blockers.push({ x, z, r: 0.2 });
    }
    const signAt = (i, text, side = 3) => {
      const a = HWY[i], b = HWY[(i + 1) % HWY.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const px = -(b.z - a.z) / len, pz = (b.x - a.x) / len;
      roadSign(a.x + px * side + (b.x - a.x) * 0.3, a.z + pz * side + (b.z - a.z) * 0.3, text, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI);
    };
    signAt(1, '켈프 HWY 1\n켈프숲 →');
    signAt(4, '켈프 HWY 1\n빛나는 곳 →\n(등불 지참)');
    signAt(7, '서행\n거북 있음');
    signAt(8, '켈프 HWY 1\n레이디 버튼 호 →');
    signAt(10, '켈프 HWY 1\n왕관 →');

    // the bubble stops: a big shimmering bubble at each, ready to carry you
    const bubbleSkin = new THREE.MeshStandardMaterial({
      color: 0xdff8ff, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.2,
      emissive: 0x9fe8ff, emissiveIntensity: 0.15, side: THREE.DoubleSide, depthWrite: false,
    });
    for (const st of STOPS) {
      const p = HWY[st.i];
      st.p = { x: p.x, z: p.z };
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), bubbleSkin);
      b.position.set(p.x, crownHeight(p.x, p.z) + 1.4, p.z);
      group.add(b);
      st.mesh = b;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.08, 5, 16), candy(0x9fd8ff));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, crownHeight(p.x, p.z) + 0.1, p.z);
      group.add(ring);
      vents.push({ x: p.x, y: crownHeight(p.x, p.z) + 0.2, z: p.z, t: 0 });
    }
    updates.push((dt, t) => {
      for (const st of STOPS) if (!riding || riding.bubble !== st.mesh) {
        st.mesh.position.y = crownHeight(st.p.x, st.p.z) + 1.4 + Math.sin(t * 1.3 + st.i) * 0.1;
      }
    });
    // riding: in the bubble, along the highway, the short way round
    let riding = null;
    for (const st of STOPS) {
      register({
        getPos: () => st.mesh.position, r: 2.6, zone: 'crown', priority: 2,
        enabled: () => !riding,
        label: '거품 안에 들어가기',
        use: async () => {
          const dest = await ui.ask('거품이 공손하게 흔들려요. 어디로 갈까요?', [
            ...STOPS.filter((d) => d !== st).map((d) => ({ label: `🫧 ${d.name}`, value: d.name })),
            { label: '여기 있기', value: null },
          ]);
          const to = STOPS.find((d) => d.name === dest);
          if (!to) return;
          // the shorter way round the loop
          const N = HWY.length;
          const fwd = (to.i - st.i + N) % N, back = (st.i - to.i + N) % N;
          const path = [];
          for (let k = 0; k <= Math.min(fwd, back); k++) path.push(HWY[(st.i + (fwd <= back ? k : -k) + N) % N]);
          riding = { bubble: st.mesh, path, seg: 0, k: 0, home: st };
          player.riding = true;
          plop();
          ui.toast(`다음 정거장: ${to.name}. 거품 안에 발을 넣고 계세요.`, '🫧');
        },
      });
    }
    updates.push((dt, t) => {
      if (!riding) return;
      const r = riding;
      const a = r.path[r.seg], b = r.path[r.seg + 1];
      if (!b) {
        // arrival: pop! you drift down onto the road, the bubble re-forms at home
        player.riding = false;
        player.group.position.set(a.x + 1.6, crownHeight(a.x + 1.6, a.z), a.z);
        for (let k = 0; k < 12; k++) bubble(a.x + (Math.random() - 0.5) * 2, crownHeight(a.x, a.z) + 1 + Math.random() * 2, a.z + (Math.random() - 0.5) * 2, 0.12);
        tone(880, { dur: 0.08, type: 'sine', vol: 0.05 });
        r.bubble.position.set(r.home.p.x, crownHeight(r.home.p.x, r.home.p.z) + 1.4, r.home.p.z);
        riding = null;
        return;
      }
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      r.k += (dt * 7) / len;
      if (r.k >= 1) { r.k = 0; r.seg++; return; }
      const x = a.x + (b.x - a.x) * r.k, z = a.z + (b.z - a.z) * r.k;
      const y = crownHeight(x, z) + 2.4 + Math.sin(t * 2) * 0.2;
      r.bubble.position.set(x, y, z);
      player.group.position.set(x, y - 1.0, z);
      player.group.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    });
  }

  // breath bubbles from your snorkel, now and then
  let breath = 1;
  updates.push((dt) => {
    breath -= dt;
    if (breath <= 0) {
      breath = 1.2 + Math.random() * 1.5;
      const p = player.group.position;
      for (let k = 0; k < 3; k++) bubble(p.x + (Math.random() - 0.5) * 0.2, p.y + 1.9 + k * 0.2, p.z + (Math.random() - 0.5) * 0.2, 0.05 + k * 0.02);
    }
  });

  // the deeper you go into the Glow, the darker the water
  const refs = zones.lightingRefs();
  const bright = new THREE.Color(0x2f86b8), dim = new THREE.Color(0x0b1638), tmpC = new THREE.Color();
  updates.push((dt, t, pp) => {
    if (!pp || !refs.scene) return;
    const k = smoothstep(GLOW.r + 14, GLOW.r * 0.3, Math.hypot(pp.x - GLOW.x, pp.z - GLOW.z));
    tmpC.copy(bright).lerp(dim, k);
    refs.scene.background.copy(tmpC);
    refs.scene.fog.color.copy(tmpC);
    refs.hemi.intensity = 1.15 - k * 0.8;
    refs.sun.intensity = 1.5 - k * 1.3;
  });

  group.traverse((o) => { if (o.isMesh && !o.material.transparent && o.castShadow === false) o.castShadow = true; });

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  // ------------------------------------------------ getting down there ----
  // from the island: swim out over the reef (Pip's diver's suit) and dive
  register({
    getPos: () => player.group.position, r: 99, zone: 'island', priority: 2,
    enabled: () => {
      const p = player.group.position;
      return Math.hypot(p.x - REEF.x, p.z - REEF.z) < REEF.r + 2 && p.y < WATER_Y && S.countItem('scuba_suit') > 0;
    },
    label: '암초로 잠수하기',
    use: async () => {
      plop();
      await zones.go('crown');
      if (!S.hasFlag('sawCrown')) {
        S.setFlag('sawCrown');
        ui.say([
          '아래로, 아래로, 밝은 물을 지나 — 암초가 언덕에서 본 도시처럼 발밑에 펼쳐져요.',
          '사탕색 산호 뾰족탑들의 고리, 끝마다 빛나는 진주. 누군가 떨어뜨린 자리에 놓인 왕관. 덮여 자라고, 살림이 들었어요.',
          '어디선가 운동화 신은 돌고래가 “안녕!!” 하고 외치며 달리기를 멈추지 않아요.',
        ]);
      }
    },
  });

  return { group, update };
                }
