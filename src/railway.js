// The railway kit: every little line in the archipelago is built from this
// one file — the strait line (red), the Grove Line (green), the Farther Line
// (salt-teal). Before this file there were three near-identical copies, and
// every fix had to be made three times (it usually got made once).
//
// A line is two things:
//  · defineLine(...) at MODULE LOAD: pure geometry from the heightmap — the
//    route, the rail heights, where the platforms go. It registers the
//    platforms as walkable surfaces and reserves the ground (keepouts) so the
//    trees and cottages planted later grow around the railway, not through it.
//  · createRailway(line, ...) at creation: meshes, the timetable, riders.
//
// House rules, all lines:
//  · two engines, one on each end. No turntables, no turning around: the one
//    in front pulls (and smokes), the one behind rides along backward.
//  · every car follows the rail on its own — the consist bends on curves and
//    tilts on grades instead of hovering off the track as one rigid stick.
//  · the platform stands BESIDE the track; the cars stop alongside it.
//  · the track runs low near the stations and high over open water, so the
//    Persistent can pass underneath.
//  · riders: one per carriage (two carriages — the player takes a seat like
//    anybody). At most two villagers queue per platform. You can board only
//    if the train is in, a carriage is free, and nobody is queued ahead of
//    you; otherwise you "wait for the train" and join the back of the queue.

import * as THREE from 'three';
import { terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import { tone } from './audio.js';
import { rand } from './utils.js';
import { glowWindow } from './nightglow.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// walk from `from` toward `toward` until the ground gives out; returns a
// point 2 units shy of the waterline (the classic station spot)
export function marchToWater(from, toward, start = 2) {
  const dx = toward.x - from.x, dz = toward.z - from.z;
  const len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  let t = start;
  while (terrainHeight(from.x + ux * (t + 0.5), from.z + uz * (t + 0.5)) >= 0.2) t += 0.5;
  return { x: from.x + ux * (t - 2), z: from.z + uz * (t - 2) };
}

// ---- the consist, in distance units along the rail from its center ------
const PARTS = [
  { off: 3.75, loco: true },           // engine A: faces toward the last stop
  { off: 1.25, car: 0 },
  { off: -1.25, car: 1 },
  { off: -3.75, loco: true, back: true }, // engine B: rides backward
];
const HALF = 4.95;        // center → outer bumper
const GAP = 0.4;          // bumper → end of track when docked
const DOCK_C = GAP + HALF; // consist center when docked, from its end of line
const DOCK_ZONE = DOCK_C + HALF + 0.6; // the flat, low stretch at each end
const CRUISE = WATER_Y + 4.0; // rail height over open water (the tug fits under)
const PLAT_W = 2.6, PLAT_L = 6.6;
const PLAT_OFF = 0.65 + 0.2 + PLAT_W / 2; // track center → platform center
const RAMP_L = 4.2;
const STEP = 0.5;         // height-table resolution

// opts: { points: [{x,z}...] (first/last = the two stations),
//         stops: [{ name, toward:{x,z} }, { name, toward }],
//         sides?: [±1, ±1] platform side per stop (default: the landward one) }
export function defineLine({ points, stops, sides = [] }) {
  const PTS = points;
  const segLens = [];
  let TOTAL = 0;
  for (let i = 0; i < PTS.length - 1; i++) {
    const l = Math.hypot(PTS[i + 1].x - PTS[i].x, PTS[i + 1].z - PTS[i].z);
    segLens.push(l);
    TOTAL += l;
  }

  // position at distance d along the line (extrapolates past either end)
  function pointAt(d) {
    if (d <= 0) {
      const ux = (PTS[1].x - PTS[0].x) / segLens[0], uz = (PTS[1].z - PTS[0].z) / segLens[0];
      return { x: PTS[0].x + ux * d, z: PTS[0].z + uz * d };
    }
    let rem = d;
    for (let i = 0; i < segLens.length; i++) {
      if (rem <= segLens[i] || i === segLens.length - 1) {
        const k = rem / segLens[i];
        return {
          x: PTS[i].x + (PTS[i + 1].x - PTS[i].x) * k,
          z: PTS[i].z + (PTS[i + 1].z - PTS[i].z) * k,
        };
      }
      rem -= segLens[i];
    }
    return { ...PTS[PTS.length - 1] };
  }

  function headingAt(d) {
    const a = pointAt(d - 0.9), b = pointAt(d + 0.9);
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  // ---- rail heights: a table, so every car, tie and pile agrees ----------
  const N = Math.ceil(TOTAL / STEP);
  const Hs = new Float32Array(N + 1);
  const endY = [0, TOTAL].map((d0) => {
    let top = WATER_Y + 0.9;
    for (let k = 0; k <= DOCK_ZONE; k += STEP) {
      const p = pointAt(d0 === 0 ? k : TOTAL - k);
      top = Math.max(top, terrainHeight(p.x, p.z) + 0.35);
    }
    return top;
  });
  for (let i = 0; i <= N; i++) {
    const d = Math.min(TOTAL, i * STEP);
    const p = pointAt(d);
    const fromEnd = Math.min(d, TOTAL - d);
    const flat = d < TOTAL / 2 ? endY[0] : endY[1];
    // flat and low beside the platforms, then a smooth climb to cruise height
    const k = Math.max(0, Math.min(1, (fromEnd - DOCK_ZONE) / 12));
    const ramp = k * k * (3 - 2 * k);
    let y = flat + (Math.max(CRUISE, flat) - flat) * ramp;
    y = Math.max(y, terrainHeight(p.x, p.z) + 0.5); // islets and headlands
    Hs[i] = y;
  }
  // slope limit (raise-only, so clearance is never lost): no ski jumps
  const MAXD = 0.22 * STEP;
  for (let i = 1; i <= N; i++) Hs[i] = Math.max(Hs[i], Hs[i - 1] - MAXD);
  for (let i = N - 1; i >= 0; i--) Hs[i] = Math.max(Hs[i], Hs[i + 1] - MAXD);

  function heightAt(d) {
    const f = Math.max(0, Math.min(N, d / STEP));
    const i = Math.floor(f), k = f - i;
    return Hs[i] + ((Hs[Math.min(N, i + 1)] ?? Hs[i]) - Hs[i]) * k;
  }

  // ---- stations -----------------------------------------------------------
  const STATIONS = stops.map((st, idx) => {
    const dockC = idx === 0 ? DOCK_C : TOTAL - DOCK_C;
    const inward = idx === 0 ? -1 : 1; // along-line direction pointing INTO the land
    const h = headingAt(dockC);
    const ax = Math.sin(h), az = Math.cos(h);   // along the line (+d)
    const px = Math.cos(h), pz = -Math.sin(h);  // across it
    const c = pointAt(dockC);
    // the platform goes on whichever side has more island under it
    let side = sides[idx];
    if (!side) {
      const landScore = (sg) => {
        let sc = 0;
        for (let a = -PLAT_L / 2; a <= PLAT_L / 2 + RAMP_L; a += 1) {
          // the deck, then on past its landward end where the ramp will go
          const aa = a <= PLAT_L / 2 ? a : inward * a;
          const x = c.x + ax * aa + px * sg * PLAT_OFF, z = c.z + az * aa + pz * sg * PLAT_OFF;
          sc += Math.min(1.5, terrainHeight(x, z)) - (zones.nearBlocker(x, z, 0.5) ? 3 : 0);
        }
        return sc;
      };
      side = landScore(1) >= landScore(-1) ? 1 : -1;
    }
    const top = Math.max(endY[idx], heightAt(dockC)) + 0.35;
    const cx = c.x + px * side * PLAT_OFF, cz = c.z + pz * side * PLAT_OFF;
    const rot = h; // box depth runs along the line
    // the ramp runs from the platform's landward end, down onto the island
    const landEnd = { x: cx + ax * inward * (PLAT_L / 2), z: cz + az * inward * (PLAT_L / 2) };
    const rampFoot = { x: landEnd.x + ax * inward * RAMP_L, z: landEnd.z + az * inward * RAMP_L };
    const footY = terrainHeight(rampFoot.x, rampFoot.z);
    return {
      idx, name: st.name, toward: st.toward, dockC, side, top, h, ax, az, px, pz, inward,
      center: { x: cx, z: cz }, landEnd, rampFoot, footY,
      // spots on the deck beside each carriage door (car 0 is nearer engine A)
      doorSpot: (car) => {
        const d = dockC + (car === 0 ? 1.25 : -1.25);
        const p = pointAt(d);
        // (back from the edge: a tall rider — a horse — at 0.55 had its head
        // through the canopy and its body against the train)
        return { x: p.x + px * side * (PLAT_OFF - 0.95), z: p.z + pz * side * (PLAT_OFF - 0.95) };
      },
      // where passengers step off the ramp onto the island proper
      landing: {
        x: rampFoot.x + ax * inward * 1.2, z: rampFoot.z + az * inward * 1.2,
      },
    };
  });

  // walkable decks + ramps (surfaces), solid rails where they cross land,
  // and keepouts so later scatterers leave the whole works alone
  for (const S of STATIONS) {
    zones.addSurfaceBox(S.center.x, S.center.z, PLAT_W, PLAT_L, S.top, S.h);
    const rc = { x: (S.landEnd.x + S.rampFoot.x) / 2, z: (S.landEnd.z + S.rampFoot.z) / 2 };
    const cs = Math.cos(S.h), sn = Math.sin(S.h);
    zones.addSurface({
      contains(x, z) {
        const dx = x - rc.x, dz = z - rc.z;
        const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
        return Math.abs(lx) <= PLAT_W / 2 && Math.abs(lz) <= RAMP_L / 2;
      },
      height(x, z) {
        const along = ((x - S.landEnd.x) * S.ax + (z - S.landEnd.z) * S.az) * S.inward;
        const k = Math.max(0, Math.min(1, along / RAMP_L));
        return S.top + (S.footY - S.top) * k;
      },
    });
    for (let a = -PLAT_L / 2 - RAMP_L; a <= PLAT_L / 2; a += 2) {
      const aa = a * -S.inward;
      zones.addKeepout(S.center.x + S.ax * aa, S.center.z + S.az * aa, 3.2);
    }
  }
  // the rails themselves, where they cross dry land: solid (nobody strolls
  // under a parked engine) and reserved against trees and cottages
  for (let d = -0.6; d <= TOTAL + 0.6; d += 1) {
    const p = pointAt(d);
    const gy = terrainHeight(p.x, p.z);
    if (gy <= WATER_Y + 0.12) continue;
    zones.addKeepout(p.x, p.z, 2.6);
    const dd = Math.max(0, Math.min(TOTAL, d));
    if (heightAt(dd) - gy < 1.6) zones.addBlockerBox(p.x, p.z, 1.7, 1.05, headingAt(dd));
  }

  return { PTS, TOTAL, pointAt, headingAt, heightAt, STATIONS, stops };
}

// ---------------------------------------------------------------------------
// opts: { player, animals, name ('the Grove Line'), colors: { loco, cab,
//         cars: [a, b], roof }, dwell, pace, text: { board, wait, queued,
//         arrive: [idx0, idx1], stepOff } }
export function createRailway(line, opts) {
  const { player, name } = opts;
  const colors = opts.colors;
  const text = opts.text || {};
  const dwell = opts.dwell ?? 14;
  const pace = opts.pace ?? 3.4;
  const { TOTAL, pointAt, headingAt, heightAt, STATIONS } = line;
  const group = new THREE.Group();

  // ---- trestle: ties, two rails, piles on spans short enough to believe ---
  const tieN = Math.ceil(TOTAL / 0.8);
  for (let i = 0; i <= tieN; i++) {
    const d = (i / tieN) * TOTAL;
    const p = pointAt(d);
    const tie = box(2.0, 0.14, 0.5, 0x6b4a2e);
    tie.position.set(p.x, heightAt(d) - 0.1, p.z);
    tie.rotation.y = headingAt(d);
    group.add(tie);
  }
  for (const rOff of [-0.6, 0.6]) {
    const n = Math.ceil(TOTAL / 1.6);
    for (let i = 0; i < n; i++) {
      const d0 = (i / n) * TOTAL, d1 = ((i + 1) / n) * TOTAL;
      const a = pointAt(d0), b = pointAt(d1);
      const ya = heightAt(d0), yb = heightAt(d1);
      const h = headingAt((d0 + d1) / 2);
      const px = Math.cos(h), pz = -Math.sin(h);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const bar = box(0.12, 0.12, len + 0.06, 0x4a3f32);
      bar.position.set((a.x + b.x) / 2 + px * rOff, (ya + yb) / 2 + 0.03, (a.z + b.z) / 2 + pz * rOff);
      bar.rotation.set(Math.atan2(ya - yb, len), Math.atan2(b.x - a.x, b.z - a.z), 0, 'YXZ');
      group.add(bar);
    }
  }
  // bents: a pair of piles + cap beam wherever the rail is up off the ground
  let lastBent = -99;
  for (let d = 0; d <= TOTAL; d += 0.5) {
    const p = pointAt(d);
    const gy = terrainHeight(p.x, p.z);
    const y = heightAt(d);
    const overWater = gy < WATER_Y;
    const spacing = overWater ? 8 : 4.5;
    if (d - lastBent < spacing || y - Math.max(gy, WATER_Y) < 0.45) continue;
    lastBent = d;
    const h = headingAt(d);
    const px = Math.cos(h), pz = -Math.sin(h);
    const foot = overWater ? WATER_Y - 2.2 : gy - 0.3;
    for (const s of [-0.75, 0.75]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, y - 0.2 - foot, 6), mat(0x55483a));
      pile.position.set(p.x + px * s, (y - 0.2 + foot) / 2, p.z + pz * s);
      pile.castShadow = true;
      pile.receiveShadow = true;
      group.add(pile);
    }
    const cap = box(1.9, 0.16, 0.3, 0x6b4a2e);
    cap.position.set(p.x, y - 0.25, p.z);
    cap.rotation.y = h;
    group.add(cap);
  }
  // buffer stops: the end of the line, stated plainly
  for (const d of [-0.25, TOTAL + 0.25]) {
    const p = pointAt(d);
    const stop = box(1.6, 0.5, 0.3, 0xb0453a);
    stop.position.set(p.x, heightAt(Math.max(0, Math.min(TOTAL, d))) + 0.25, p.z);
    stop.rotation.y = headingAt(Math.max(0, Math.min(TOTAL, d)));
    group.add(stop);
    const post = box(0.16, 0.9, 0.16, 0x55483a);
    post.position.set(p.x, stop.position.y - 0.5, p.z);
    group.add(post);
  }

  // ---- stations: deck, ramp, piles, canopy -------------------------------
  for (const S of STATIONS) {
    const deck = box(PLAT_W, 0.26, PLAT_L, 0xb9c0b9);
    deck.position.set(S.center.x, S.top - 0.13, S.center.z);
    deck.rotation.y = S.h;
    group.add(deck);
    const edge = box(0.18, 0.03, PLAT_L, 0xf2cf5b); // mind the gap
    edge.position.set(S.center.x - S.px * S.side * (PLAT_W / 2 - 0.12), S.top + 0.01, S.center.z - S.pz * S.side * (PLAT_W / 2 - 0.12));
    edge.rotation.y = S.h;
    edge.castShadow = false;
    group.add(edge);
    // legs down to the ground (or into the sea) along both long edges
    for (let a = -PLAT_L / 2 + 0.3; a <= PLAT_L / 2 - 0.2; a += (PLAT_L - 0.6) / 3) {
      for (const s of [-1, 1]) {
        const x = S.center.x + S.ax * a + S.px * s * (PLAT_W / 2 - 0.25);
        const z = S.center.z + S.az * a + S.pz * s * (PLAT_W / 2 - 0.25);
        const gy = terrainHeight(x, z);
        const foot = gy < WATER_Y ? WATER_Y - 2 : gy - 0.3;
        const len = S.top - 0.26 - foot;
        if (len < 0.05) continue;
        const leg = box(0.28, len, 0.28, 0xa8afa8);
        leg.position.set(x, foot + len / 2, z);
        group.add(leg);
      }
    }
    // the ramp: one sloped slab from deck to island, with a skirt below
    const rampLen = Math.hypot(RAMP_L, S.top - S.footY);
    const ramp = box(PLAT_W, 0.22, rampLen, 0xb9c0b9);
    ramp.position.set((S.landEnd.x + S.rampFoot.x) / 2, (S.top + S.footY) / 2 - 0.11, (S.landEnd.z + S.rampFoot.z) / 2);
    const slope = Math.atan2(S.top - S.footY, RAMP_L);
    ramp.rotation.set(S.inward > 0 ? slope : -slope, S.h, 0, 'YXZ');
    group.add(ramp);
    for (let a = 0.4; a < RAMP_L; a += 1.3) {
      const x = S.landEnd.x + S.ax * S.inward * a, z = S.landEnd.z + S.az * S.inward * a;
      const y = S.top + (S.footY - S.top) * (a / RAMP_L);
      const gy = Math.max(terrainHeight(x, z), WATER_Y - 1.5) - 0.3;
      if (y - 0.2 - gy < 0.1) continue;
      for (const s of [-1, 1]) {
        const leg = box(0.24, y - 0.2 - gy, 0.24, 0xa8afa8);
        leg.position.set(x + S.px * s * (PLAT_W / 2 - 0.25), (y - 0.2 + gy) / 2, z + S.pz * s * (PLAT_W / 2 - 0.25));
        group.add(leg);
      }
    }
    // canopy on four posts, set back from the track edge
    const postOff = PLAT_W / 2 - 0.3;
    for (const a of [-2.2, 2.2]) {
      const x = S.center.x + S.ax * a + S.px * S.side * postOff;
      const z = S.center.z + S.az * a + S.pz * S.side * postOff;
      const post = box(0.14, 2.3, 0.14, 0x8a5a3a);
      post.position.set(x, S.top + 1.15, z);
      group.add(post);
    }
    const roof = box(PLAT_W + 0.3, 0.14, 5.4, colors.roof);
    roof.position.set(S.center.x + S.px * S.side * 0.2, S.top + 2.35, S.center.z + S.pz * S.side * 0.2);
    roof.rotation.set(0, S.h, S.side * 0.1, 'YXZ');
    group.add(roof);
    const bench = box(0.5, 0.35, 1.6, 0x96703f);
    bench.position.set(S.center.x + S.px * S.side * (PLAT_W / 2 - 0.4), S.top + 0.18, S.center.z + S.pz * S.side * (PLAT_W / 2 - 0.4));
    bench.rotation.y = S.h;
    group.add(bench);
    zones.addBlockerBox(bench.position.x, bench.position.z, 0.5, 1.6, S.h);
  }

  // ---- the consist ---------------------------------------------------------
  function buildLoco() {
    const loco = new THREE.Group();
    const body = box(1.3, 1.0, 2.4, colors.loco);
    body.position.y = 0.9;
    loco.add(body);
    const cab = box(1.2, 0.9, 0.9, colors.cab);
    cab.position.set(0, 1.5, -0.7);
    loco.add(cab);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 7), mat(0x2e2a26));
    chimney.position.set(0, 1.65, 0.8);
    loco.add(chimney);
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0xf2cf5b, 0.4));
    dome.position.set(0, 1.5, 0.2);
    loco.add(dome);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 8), mat(0xfff1c2, 0.4));
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 1.05, 1.22);
    glowWindow(lamp);
    loco.add(lamp);
    return loco;
  }
  const parts = PARTS.map((spec) => {
    let obj;
    if (spec.loco) {
      obj = buildLoco();
    } else {
      obj = new THREE.Group();
      const carBody = box(1.2, 0.9, 2.0, colors.cars[spec.car]);
      carBody.position.y = 0.85;
      obj.add(carBody);
      const roof = box(1.34, 0.1, 2.1, colors.cab);
      roof.position.y = 1.35;
      obj.add(roof);
      for (const sz of [-0.5, 0.5]) {
        const win = box(1.26, 0.34, 0.5, 0xbfe6f2);
        win.position.set(0, 1.0, sz);
        glowWindow(win);
        obj.add(win);
      }
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-0.7, 0.7]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 8), mat(0x2e2a26));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * 0.62, 0.26, sz);
        obj.add(wheel);
      }
    }
    obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(obj);
    return { ...spec, obj };
  });
  const locoA = parts[0].obj, locoB = parts[3].obj;
  const cars = [parts[1].obj, parts[2].obj];

  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, flatShading: true, roughness: 1 }));
    puff.userData.k = i / 4;
    puff.visible = false;
    puffs.push(puff);
    group.add(puff);
  }

  // every part finds its own spot on the rail: the consist bends and tilts
  let cNow = STATIONS[0].dockC;
  function placeTrain(c) {
    cNow = c;
    for (const pt of parts) {
      const d = c + pt.off;
      const a = pointAt(d - 0.7), b = pointAt(d + 0.7);
      const p = pointAt(d);
      const ya = heightAt(d - 0.7), yb = heightAt(d + 0.7);
      let yaw = Math.atan2(b.x - a.x, b.z - a.z);
      let pitch = Math.atan2(ya - yb, 1.4);
      if (pt.back) { yaw += Math.PI; pitch = -pitch; }
      pt.obj.position.set(p.x, (ya + yb) / 2 + 0.15, p.z);
      pt.obj.rotation.set(pitch, yaw, 0, 'YXZ');
    }
  }
  placeTrain(cNow);

  // ---- timetable -------------------------------------------------------------
  let stopIdx = 0;
  let direction = 1; // +1 toward STATIONS[1]
  let phase = 'docked';
  let timer = 8 + rand(0, 6);
  let legDur = 1;

  function whistle() {
    const [a, b] = opts.whistle || [560, 740];
    tone(a, { dur: 0.3, type: 'triangle', vol: 0.05 });
    tone(b, { time: 0.12, dur: 0.4, type: 'triangle', vol: 0.05 });
  }

  const docked = () => (phase === 'docked' ? stopIdx : null);

  // ---- riders ------------------------------------------------------------------
  // riders: { player?: true, a?, car, destination, origin }
  const animalList = Array.isArray(opts.animals) ? opts.animals : [];
  const riders = [];
  const waiting = STATIONS.map(() => []); // { a?, player?, here, destination, origin }
  const commuters = [];
  const seatWorld = new THREE.Vector3();
  let recruitT = 5 + rand(0, 4);
  let grace = 0;

  const freeCar = () => [0, 1].find((c) => !riders.some((r) => r.car === c)) ?? null;
  const villagersQueued = (idx) => waiting[idx].filter((w) => !w.player).length;
  const playerQueued = () => waiting.findIndex((q) => q.some((w) => w.player));

  function seatRiders() {
    for (const r of riders) {
      const car = cars[r.car];
      car.updateMatrixWorld(true);
      seatWorld.set(0, 1.35, r.player ? -0.45 : 0.45).applyMatrix4(car.matrixWorld);
      const g = r.player ? player.group : r.a.g;
      g.position.copy(seatWorld);
      g.rotation.y = car.rotation.y + (direction < 0 ? Math.PI : 0);
    }
  }

  function boardPlayer(idx) {
    const car = freeCar();
    if (car === null) return false;
    riders.push({ player: true, car, destination: 1 - idx, origin: idx });
    player.riding = true;
    seatRiders();
    return true;
  }

  // the queue: a real line on the platform. Villagers walk up the ramp to
  // their place, plant their feet and face the track; when someone boards,
  // the rest shuffle up. Nobody who's still walking over holds the line —
  // whoever is actually standing there boards, in order. You count as
  // standing there if you're anywhere on the platform or its ramp.
  const PLAYER_NEAR = 12, PLAYER_GONE = 22;
  const playerDist = (idx) => {
    const pp = player.group.position, c = STATIONS[idx].center;
    return Math.hypot(pp.x - c.x, pp.z - c.z);
  };
  const present = (idx, e) => (e.player ? playerDist(idx) < PLAYER_NEAR && !player.riding : e.here && !e.a.riding);

  function faceTrack(idx, a) {
    const S = STATIONS[idx];
    a.g.rotation.y = Math.atan2(-S.px * S.side, -S.pz * S.side);
  }

  function release(e) {
    if (e.a) { e.a.busy = false; e.a.queued = false; }
  }

  // send each villager in the line to their place (front of the line gets
  // the first carriage door); anyone whose place moved steps up to it
  function restack(idx) {
    let k = 0;
    for (const e of waiting[idx]) {
      if (e.player) continue;
      const spot = STATIONS[idx].doorSpot(Math.min(k++, 1));
      if (e.spot && Math.hypot(e.spot.x - spot.x, e.spot.z - spot.z) < 0.1) continue;
      e.spot = spot;
      e.here = false;
      e.a.busy = false;
      e.goalRef = e.a.goal = {
        x: spot.x, z: spot.z, r: 0.35,
        done: () => {
          e.here = true;
          e.a.busy = true; // feet planted; the train is coming
          faceTrack(idx, e.a);
          boardQueue(idx);
        },
        fail: () => {
          const q = waiting[idx], i = q.indexOf(e);
          if (i >= 0) q.splice(i, 1);
          release(e);
          restack(idx);
        },
      };
    }
  }

  // board everyone who's present, front of the line first, while there's room
  function boardQueue(idx) {
    if (docked() !== idx) return;
    const q = waiting[idx];
    let moved = false;
    for (let i = 0; i < q.length && freeCar() !== null;) {
      const e = q[i];
      if (e.player && (player.riding || playerDist(idx) > PLAYER_GONE)) {
        q.splice(i, 1); // wandered off; the queue forgives, and forgets
        continue;
      }
      if (!present(idx, e)) { i++; continue; } // still on the way: they'll catch the next one
      q.splice(i, 1);
      moved = true;
      if (e.player) {
        boardPlayer(idx);
        timer = Math.min(timer, 2.5);
        ui.toast(text.kept || `${cap(name)} kept your place. All aboard.`, '🚂');
        continue;
      }
      release(e);
      e.a.riding = true;
      e.a.away = true; // the train carries them now, not their legs
      e.a.goal = null;
      riders.push({ a: e.a, car: freeCar(), destination: e.destination, origin: idx });
      seatRiders();
    }
    if (moved) restack(idx);
  }

  function destinationFor(idx, a, explicit) {
    if (explicit !== undefined && explicit !== null) return explicit;
    const c = commuters.find((cm) => cm.a === a);
    return c ? c.homeStop : 1 - idx;
  }

  function enqueue(idx, a, destination = null) {
    if (idx === 'A') idx = 0; // the old strait-line debug names
    if (idx === 'B') idx = 1;
    if (!a || idx < 0 || idx >= STATIONS.length) return false;
    if (waiting.some((q) => q.some((w) => w.a === a))) return false;
    if (villagersQueued(idx) >= 2) return false; // the platform is only so long
    const entry = { a, here: false, destination: destinationFor(idx, a, destination), origin: idx };
    waiting[idx].push(entry);
    a.queued = true;
    restack(idx);
    return true;
  }

  function animalPool() {
    if (animalList.length) return animalList;
    return window.__notbell?.animals?.animals ?? [];
  }

  function recruit() {
    for (const S of STATIONS) {
      if (villagersQueued(S.idx) >= 2 || Math.random() > 0.3) continue;
      const near = animalPool().filter((a) =>
        a.identity && !a.home && !a.errand && !a.meeting && !a.riding && !a.busy && !a.queued &&
        !a.away && !a.goal && !a.swims && !a.anchored && !a.pastime &&
        Math.hypot(a.g.position.x - S.landing.x, a.g.position.z - S.landing.z) < 30);
      if (near.length) enqueue(S.idx, near[Math.floor(Math.random() * near.length)]);
    }
  }

  function stopRange(idx) {
    const S = STATIONS[idx];
    const dx = S.toward.x - S.landing.x, dz = S.toward.z - S.landing.z;
    const dl = Math.hypot(dx, dz) || 1;
    for (const k of [6, 4, 2, 0]) {
      const x = S.landing.x + (dx / dl) * k, z = S.landing.z + (dz / dl) * k;
      if (zones.islandCanWalk(x, z)) return { x, z, R: 16 };
    }
    return { x: S.landing.x, z: S.landing.z, R: 16 };
  }

  // off the train, onto the deck beside your carriage, and away down the ramp
  function arrive(idx) {
    const S = STATIONS[idx];
    for (const r of [...riders]) {
      if (r.destination !== idx) continue;
      riders.splice(riders.indexOf(r), 1);
      const door = S.doorSpot(r.car);
      if (r.player) {
        player.riding = false;
        player.group.position.set(door.x, S.top, door.z);
        ui.toast(text.arrive?.[idx] || `${S.name}. ${name}의 엔진이 숨을 고르고 있어요.`, '🚂');
        continue;
      }
      const a = r.a;
      a.riding = false;
      a.g.position.set(door.x, S.top, door.z);
      const existing = commuters.find((c) => c.a === a);
      if (existing && idx === existing.homeStop) {
        a.range = existing.origRange;
        a.away = !!(a.home || a.errand);
        commuters.splice(commuters.indexOf(existing), 1);
      } else {
        if (!existing) {
          commuters.push({ a, stop: idx, homeStop: r.origin, stayTimer: rand(240, 480), origRange: a.range });
        }
        a.range = stopRange(idx);
        a.away = false;
        a.state = 'idle';
        a.timer = rand(1, 3);
      }
      // down the ramp like a person, not a package (any onward trip waits
      // until they're off the platform)
      if (a.goal && !a.resume) a.resume = a.goal;
      a.goal = { x: S.landing.x + rand(-0.6, 0.6), z: S.landing.z + rand(-0.6, 0.6), r: 1.0 };
    }
    boardQueue(idx);
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  for (const S of STATIONS) {
    const idx = S.idx;
    register({
      pos: new THREE.Vector3(S.center.x, 0, S.center.z), r: 3.4,
      enabled: () => !player.riding,
      label: () => {
        if (waiting[idx].some((w) => w.player)) return `waiting for ${name}…`;
        if (docked() === idx && !waiting[idx].some((w) => present(idx, w)) && freeCar() !== null) return `${name} 타고 ${STATIONS[1 - idx].name}까지 가기`;
        return `wait for ${name}`;
      },
      use: () => {
        const q = waiting[idx];
        if (q.some((w) => w.player)) {
          const ahead = q.findIndex((w) => w.player);
          ui.say(ahead ? `줄 서 있어요 — 앞에 ${ahead === 1 ? '한' : '두'} 명. ${text.queued || '레일이 웅웅거려요.'}`
            : text.queued || '다음 차례예요. 레일이 웅웅거려요.');
          return;
        }
        if (docked() === idx && !q.some((w) => present(idx, w)) && freeCar() !== null) {
          boardPlayer(idx);
          timer = Math.min(timer, 2.5); // the conductor respects your schedule
          ui.toast(text.board || `All aboard ${name}.`, '🚂');
          return;
        }
        if (villagersQueued(idx) >= 2) {
          ui.say(text.full || '이 열차에는 이미 주민 두 명이 줄 서 있어요. 승강장이 그리 길지 않아서 — 잠시 후 다시 해 보세요.');
          return;
        }
        const other = playerQueued();
        if (other >= 0) waiting[other] = waiting[other].filter((w) => !w.player);
        q.push({ player: true, here: true, destination: 1 - idx, origin: idx });
        const ahead = q.length - 1;
        ui.say(ahead
          ? `${ahead === 1 ? '참을성 많은 주민 한 명' : '참을성 많은 주민 두 명'} 뒤에 줄을 서요. ${text.wait || ''}`.trim()
          : text.wait || '기차를 기다려요. 금방 올 거예요.');
        if (docked() === idx) boardQueue(idx);
      },
    });
  }

  // ---- the loop ------------------------------------------------------------------
  function update(dt) {
    timer -= dt;
    recruitT -= dt;
    if (recruitT <= 0) {
      recruitT = 5;
      recruit();
    }
    // anyone called away mid-queue (bedtime, an errand, a friend) steps out
    // of line rather than standing frozen on the platform
    for (const [idx, q] of waiting.entries()) {
      for (const e of [...q]) {
        if (e.player) continue;
        const a = e.a;
        if (a.home || a.errand || a.meeting || a.bedtime || (e.here ? !!a.goal : a.goal !== e.goalRef)) {
          q.splice(q.indexOf(e), 1);
          release(e);
          restack(idx);
        }
      }
    }
    if (phase === 'docked') {
      boardQueue(stopIdx);
      // anyone nearly here gets a moment's grace (the conductor has seen
      // you running up the ramp); then we go
      const nearly = waiting[stopIdx].some((w) => !present(stopIdx, w) && (w.player
        ? playerDist(stopIdx) < PLAYER_GONE
        : Math.hypot(w.a.g.position.x - STATIONS[stopIdx].center.x, w.a.g.position.z - STATIONS[stopIdx].center.z) < 9));
      if (timer <= 0 && nearly && freeCar() !== null && grace < 8) { grace += dt; return; }
      if (timer <= 0) {
        grace = 0;
        const next = stopIdx + direction;
        if (next < 0 || next >= STATIONS.length) {
          direction *= -1; // no turn-around: the other engine just takes the lead
          return;
        }
        legDur = Math.abs(STATIONS[next].dockC - STATIONS[stopIdx].dockC) / pace;
        phase = 'moving';
        timer = legDur;
        whistle();
        stopIdx = next;
      }
    } else {
      const from = STATIONS[stopIdx - direction].dockC;
      const to = STATIONS[stopIdx].dockC;
      const k = Math.max(0, Math.min(1, 1 - timer / legDur));
      placeTrain(from + (to - from) * k * k * (3 - 2 * k));
      if (timer <= 0) {
        phase = 'docked';
        timer = dwell;
        placeTrain(to);
        arrive(stopIdx);
      }
    }
    if (riders.length) seatRiders();

    // visitors eventually remember where their own patch of grass is
    for (const c of [...commuters]) {
      if (c.a.home) { // bedtime overrides sightseeing
        c.a.range = c.origRange;
        commuters.splice(commuters.indexOf(c), 1);
        continue;
      }
      c.stayTimer -= dt;
      if (c.stayTimer <= 0 && !c.a.riding && !c.a.errand && !c.a.meeting && !c.a.away && !c.a.goal) {
        if (!enqueue(c.stop, c.a, c.homeStop)) c.stayTimer = 25; // queue's full; linger
      }
    }

    // smoke belongs to whichever engine is pulling
    const moving = phase === 'moving';
    const puller = direction >= 0 ? locoA : locoB;
    for (const puff of puffs) {
      puff.visible = moving;
      if (!moving) continue;
      puff.userData.k = (puff.userData.k + dt * 0.5) % 1;
      const k = puff.userData.k;
      const chim = new THREE.Vector3(0, 1.9, 0.8).applyMatrix4(puller.matrixWorld);
      puff.position.set(chim.x, chim.y + k * 1.8, chim.z);
      puff.scale.setScalar(0.5 + k * 1.3);
      puff.material.opacity = 0.6 * (1 - k);
    }
  }

  // villagers heading for another island can take this line (zones routes)
  const isleA = zones.islandOf(STATIONS[0].landing.x, STATIONS[0].landing.z);
  const isleB = zones.islandOf(STATIONS[1].landing.x, STATIONS[1].landing.z);
  if (isleA && isleB && isleA !== isleB) {
    zones.addLink({
      a: isleA, b: isleB, kind: 'rail',
      path: [STATIONS[0].landing, STATIONS[1].landing],
      board: (villager, fromKey) => {
        const idx = fromKey === isleA ? 0 : 1;
        return enqueue(idx, villager, 1 - idx);
      },
    });
  }

  // debug/testing hooks (the shots harness rides the rails too)
  const debug = {
    enqueue, waiting, stations: STATIONS,
    phase: () => phase, docked, dockedAt: docked, riders: () => riders.length,
    // jump the timetable along (probes don't have three real minutes)
    hurry: () => { timer = Math.min(timer, 0.2); },
  };
  return { group, update, debug };
}
