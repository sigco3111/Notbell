// THE BURROUGH — the city under the islands.
//
// The moles were here first. Everybody up top knows a mole or two (the
// Boring Department at the Labs, the Baron at the manor, his pups) and
// nobody up top ever asks where they go home to at night. Down. They go
// down. Two ways in: a molehill on the little hill in the Labs meadow, and
// a little arched door in the back wall of the Moledecai wine cellar. The distance between them is not to scale. Nothing down here is.
//
// Neighborhoods, west to east, on the Boring Line (a streetcar: the Boring
// Department dug it in one night, the paperwork took eleven years; the
// tunnel runs on past both ends into the dark, and nobody has been to
// either end):
//   · THE WORKS — under the Labs. Boring Dept. Local 1 (walk in: Doris at
//     the front desk with the candy dish, Ping in IT, two engineers at the
//     chalkboard), Bertha the shop steward, a punch clock, the Visitors'
//     Bureau (dirt globes), Auger walking the track west.
//   · THE INSTITUTE FOR DEEP STUDY — up a quiet lane: Mould Hall (walk in:
//     the common room, the fire, Dr. Fennimore thinking), a blackboard, the
//     mushroom woods. Professor Mödel walks the lane; Professor Emerita
//     Rosalind (a naked mole rat) keeps tea at four.
//   · LOAM STREET — midtown. The Loamsworth Arms (Beaumont on the door; walk
//     in: the lobby, the hall, and apartment 2B, where Sorrel lives, very
//     much on purpose), Mrs. Loamsworth at her window, Thelonious Mole on the
//     corner, Nibs's hot worm cart (contains no worms), Marjorie forecasting
//     the surface weather (always wrong) to a small loyal crowd, Spoke in the
//     Burrough Electric wheel, and the Daily Dirt (walk in: the newsroom,
//     the coffee, the Tunnel Vision podcast, the Little Desk Sessions) with
//     its ethics correspondent Lowell (a worm, with legs, no comment).
//   · UPTOWN — under the manor. The Moledecai, the old family building the
//     family left three Barons ago, and Fitzgerald, who still keeps the door
//     (walk in: the fourth floor, Mrs. Vanderburrow's: a chandelier, a
//     painting of the sky, Pomme the pill bug); Central Mulch, a park of
//     three mushrooms and a bench.
// Down here they hear the bell through the rock on the heavy tides. Nobody
// up top has ever asked them. (Don't resolve that here — see docs/LORE.md.)
//
// Placement is deterministic without touching the shared seeded PRNG (a
// local hash), so adding the Burrough never reshuffles anything placed
// after it.

import * as THREE from 'three';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';
import { buildAnimal, animateGait } from './animals.js';
import { terrainHeight, ISLAND6_BEACH } from './terrain.js';
import { CELLAR } from './island5.js';
import { currentWeather } from './almanac.js';
import { fbm, smoothstep, hash2, vnoise, turnToward } from './utils.js';
import { tone, plop, jingle, kaching, thud, playSong } from './audio.js';
import { addPlaceNamer, addZonePlace } from './fieldguide.js';

export const BURROUGH = { x: 0, z: -1300 }; // well past camera.far from anything up top
const O = BURROUGH;
const W = (x, z) => ({ x: O.x + x, z: O.z + z }); // local → world

// ------------------------------------------------------------ the plan ----
// Everything below is laid out in local coordinates (x east, z south; the
// camera looks north, so shopfronts face +z).
const WORKS = { x: -54, z: -3, rx: 15, rz: 10 };
const MIDTOWN = { x: 0, z: -4, rx: 21, rz: 12 };
const UPTOWN = { x: 54, z: -3, rx: 15, rz: 10 };
const INSTITUTE = { x: -46, z: -31, rx: 12, rz: 8 };
const LINE_END = 260; // the tunnel runs on this far each way, into the dark
const AREAS = [
  { seg: [-LINE_END, 0, LINE_END, 0], r: 4.2 }, // the Boring Line's tunnel, end to end (and then some)
  { ell: WORKS }, { ell: MIDTOWN }, { ell: UPTOWN },
  { seg: [-47, -10, -46, -24], r: 3 },          // Institute Lane
  { ell: INSTITUTE },
];
const TRACK_Z = -2.4;
const STOPS = [
  { name: '웍스', x: -52 },
  { name: '롬 스트리트', x: 0 },
  { name: '업타운', x: 52 },
];
const PLAT = { z0: -1.0, z1: 1.3, hw: 4.5, h: 0.3 }; // platforms, just south of the track
const LADDER_W = { x: -64, z: -10.4 };            // up to the Labs
const LADDER_E = { x: 64, z: -10.4 };             // up to the wine cellar
const ARRIVE_W = { x: -64, z: -8, rotY: 0 };
const ARRIVE_E = { x: 64, z: -8, rotY: 0 };

// the rooms you can walk into, off in the elsewhere (far from the street and
// from each other)
const ROOMS = {
  local1: { x: -300, z: -1700, w: 16, d: 10 },
  mould: { x: -100, z: -1700, w: 16, d: 10 },
  arms: { x: 100, z: -1700, w: 22, d: 10 },
  dirt: { x: 300, z: -1700, w: 20, d: 11 },
  ritz: { x: 500, z: -1700, w: 18, d: 10 },
};

function sdSeg(x, z, [ax, az, bx, bz], r) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) - r;
}
function sdEll(x, z, e) {
  return (Math.hypot((x - e.x) / e.rx, (z - e.z) / e.rz) - 1) * Math.min(e.rx, e.rz);
}
// signed distance to the open ground: < 0 inside, > 0 inside the earth
function sd(lx, lz) {
  let d = Infinity;
  for (const a of AREAS) d = Math.min(d, a.seg ? sdSeg(lx, lz, a.seg, a.r) : sdEll(lx, lz, a.ell));
  return d;
}
// which way is open ground from here (unit xz), and is this a back wall?
function openward(lx, lz) {
  const gx = sd(lx + 0.3, lz) - sd(lx - 0.3, lz), gz = sd(lx, lz + 0.3) - sd(lx, lz - 0.3);
  const l = Math.hypot(gx, gz) || 1;
  return { x: -gx / l, z: -gz / l };
}

// raised floors (platforms) are part of the ground down here
const PADS = [];
for (const st of STOPS) PADS.push({ x0: st.x - PLAT.hw, x1: st.x + PLAT.hw, z0: PLAT.z0, z1: PLAT.z1, h: PLAT.h });

export function burroughHeight(x, z) {
  const lx = x - O.x, lz = z - O.z;
  const d = sd(lx, lz);
  let h = (vnoise(lx * 0.5, lz * 0.5) - 0.5) * 0.08;
  if (d > 0) {
    // the walls: tall at the back of every street, low on any bank whose
    // open ground lies to its north (the camera looks north, over those)
    const south = sd(lx, lz + 0.5) - sd(lx, lz - 0.5); // > 0: open ground is north of here
    const tall = 9 - 5.8 * smoothstep(-0.3, 0.5, south);
    h += smoothstep(0, 5, d) * tall + fbm(lx * 0.3, lz * 0.3) * smoothstep(0, 3, d) * 1.4;
  }
  for (const p of PADS) if (lx > p.x0 && lx < p.x1 && lz > p.z0 && lz < p.z1) h = Math.max(h, p.h);
  return h;
}

// solid footprints: circles {x, z, r} and axis boxes {x0, x1, z0, z1} (local)
const circles = [];
const boxes = [];
const block = (x, z, r) => circles.push({ x, z, r });
const blockBox = (x0, z0, x1, z1) => boxes.push({ x0, x1, z0, z1 });
function solid(lx, lz, pad = 0) {
  for (const c of circles) if (Math.hypot(lx - c.x, lz - c.z) < c.r + pad) return true;
  for (const b of boxes) if (lx > b.x0 - pad && lx < b.x1 + pad && lz > b.z0 - pad && lz < b.z1 + pad) return true;
  return false;
}

// a local hash, so the Burrough never draws from the shared seeded PRNG
let seedN = 0;
const h01 = () => hash2(++seedN * 1.37, 71.3);

// ------------------------------------------------------------ the kit ----
function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
function glow(color, k = 0.9) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, flatShading: true });
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
function sign(lines, w, h, bg = '#f3e6c8', fg = '#3a2a1c', { weight = 800, border = null, align = 'center' } = {}) {
  const cv = document.createElement('canvas');
  // the canvas takes the plane's shape (a long thin band used to get a
  // squat canvas, and its text stretched sideways)
  cv.height = Math.max(64, Math.round(512 * h / w));
  cv.width = Math.round(cv.height * w / h);
  const c = cv.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, cv.width, cv.height);
  if (border) { c.strokeStyle = border; c.lineWidth = 10; c.strokeRect(8, 8, cv.width - 16, cv.height - 16); }
  c.fillStyle = fg;
  c.textAlign = align;
  c.textBaseline = 'middle';
  const ls = lines.split('\n');
  let size = (cv.height / ls.length) * 0.62;
  do { c.font = `${weight} ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`; size -= 2; } while (ls.some((l) => c.measureText(l).width > cv.width * 0.88) && size > 10);
  const x = align === 'left' ? cv.width * 0.06 : cv.width / 2;
  ls.forEach((l, i) => c.fillText(l, x, cv.height / 2 + (i - (ls.length - 1) / 2) * size * 1.25));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
function dotTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// hats: every mole down here has an opinion about headwear
function hardHat() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf2cf5b, 0.5));
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 10), mat(0xf2cf5b, 0.5));
  g.add(dome, brim);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), glow(0xfff2c0, 1.2));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 0.14, 0.28);
  g.add(lamp);
  return g;
}
function fedora(color = 0x4a4038) {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 10), mat(color));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 8), mat(color));
  crown.position.y = 0.13;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.05, 8), mat(0x2a2420));
  band.position.y = 0.05;
  g.add(brim, crown, band);
  return g;
}
function topHat(color = 0x1e1a18) {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 10), mat(color));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 10), mat(color));
  crown.position.y = 0.22;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 10), mat(0x8a1f2a));
  band.position.y = 0.06;
  g.add(brim, crown, band);
  return g;
}
function flatCap(color) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), mat(color));
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.2), mat(0x2a2420));
  peak.position.set(0, -0.03, 0.3);
  g.add(top, peak);
  return g;
}
function beret(color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.1, 10), mat(color));
  m.rotation.z = 0.25;
  return m;
}
function beanie(color) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
  dome.scale.y = 1.25;
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 10), mat(color));
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(0xf3efe2));
  pom.position.y = 0.42;
  g.add(dome, cuff, pom);
  return g;
}
function visor(color = 0x3a8a5a) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 10, 1, true), mat(0x2a2420));
  band.material.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 10, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.75, roughness: 0.4 }));
  shade.position.set(0, 0, 0.2);
  shade.rotation.x = 0.25;
  g.add(band, shade);
  return g;
}
function headphones() {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 4, 12, Math.PI), mat(0x2a2a2a, 0.4));
  arc.rotation.z = 0;
  const cups = [-1, 1].map((sx) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), mat(0xb8433a, 0.4));
    cup.rotation.z = Math.PI / 2;
    cup.position.set(sx * 0.42, 0, 0);
    return cup;
  });
  g.add(arc, ...cups);
  return g;
}
function spectacles(color = 0xc9a24a, r = 0.075) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.015, 4, 10), mat(color, 0.3));
    ring.position.set(sx * (r + 0.045), 0, 0);
    g.add(ring);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.015), mat(color, 0.3));
  g.add(bridge);
  return g;
}
function onHead(critter, thing, y = 0.33, z = 0) {
  thing.position.set(0, y, z);
  critter.userData.parts.head.add(thing);
  return thing;
}
// sit down: legs forward, so nobody sits through the seat
function sit(critter) {
  for (const l of critter.userData.parts.legs) l.rotation.x = -1.35;
  critter.userData.noFidget = true;
}

export function createBurrough(player, { molehill = null } = {}) {
  const group = new THREE.Group();
  group.name = 'burrough';
  const updates = [];     // (dt, t, playerPos) — the street, burrough zone only
  const roomUpdates = {}; // zone → updates, for the rooms you can walk into
  const movers = [];      // walkers: solid to you, like the villagers up top
  const roomRoots = {};   // zone → the room's group (it shows and hides itself)
  let cellarDoor = null;
  const at = (lx, lz) => burroughHeight(O.x + lx, O.z + lz);
  function shade(obj) {
    obj.traverse((o) => { if (o.isMesh && !o.material.emissive?.getHex?.()) { o.castShadow = true; o.receiveShadow = true; } });
  }
  function put(obj, lx, lz, lift = 0) {
    obj.position.set(O.x + lx, at(lx, lz) + lift, O.z + lz);
    shade(obj);
    group.add(obj);
    return obj;
  }

  zones.registerWorld('burrough', {
    groundHeight: burroughHeight,
    canWalk(x, z) {
      const lx = x - O.x, lz = z - O.z;
      // the streetcar is solid, and so is everybody walking about — unless
      // you're already overlapping them (a reload, a walker who arrived at
      // their own start point): then they don't hold you, so you can always
      // step away (the island's rule; without it a save could trap you)
      const pp = player.group.position, plx = pp.x - O.x, plz = pp.z - O.z;
      const inCar = (ax, az, pad) => Math.abs(ax - line.x) < 2.75 + pad && Math.abs(az - TRACK_Z) < 1.2 + pad;
      if (inCar(lx, lz, 0) && !inCar(plx, plz, 0.35)) return false;
      for (const m of movers) {
        if (Math.hypot(x - m.position.x, z - m.position.z) < 0.55 && Math.hypot(pp.x - m.position.x, pp.z - m.position.z) > 0.9) return false;
      }
      return sd(lx, lz) < -0.5 && !solid(lx, lz);
    },
    spawn: { ...W(ARRIVE_W.x, ARRIVE_W.z), rotY: 0 },
    lighting: {
      bg: 0x1d140d, fog: 0x1d140d, fogNear: 20, fogFar: 75,
      hemiSky: 0xffd9a8, hemiGround: 0x4a3322, hemiIntensity: 1.05,
      sunIntensity: 1.1,
      sunPos: [O.x - 20, 60, O.z + 30],
      sunTarget: [O.x, 0, O.z],
    },
  });

  addPlaceNamer('burrough', (x, z) => {
    const lx = x - O.x, lz = z - O.z;
    const inE = (e, pad = 1) => sdEll(lx, lz, e) < pad;
    if (inE(INSTITUTE) || sdSeg(lx, lz, [-47, -12, -46, -24], 3) < 0) return '🎓 심층 연구소';
    if (inE(WORKS)) return '⛏️ 웍스';
    if (inE(MIDTOWN)) return '🚋 롬 스트리트';
    if (inE(UPTOWN)) return '🎩 업타운';
    return '🚋 보어링 선';
  });

  // talkers and walkers. A walker loops its points; it stops for anyone
  // standing near (to talk, or just because you're in the way) and turns
  // to look at them.
  function talker(getPos, name, voice, lines, r = 2.4, zone = 'burrough') {
    let k = 0;
    register({
      getPos, r, zone, label: `talk to ${name}`,
      use: () => ui.say(lines[k++ % lines.length], { speaker: name, voice }),
    });
  }
  function walker(g, pts, speed, opts = {}) {
    const points = pts.map(([x, z]) => W(x, z));
    const w = { i: 1, pause: 1, ...opts };
    g.position.set(points[0].x, burroughHeight(points[0].x, points[0].z), points[0].z);
    group.add(g);
    movers.push(g);
    updates.push((dt, t, pp) => {
      const near = pp && Math.hypot(pp.x - g.position.x, pp.z - g.position.z) < (w.stopFor ?? 2.6);
      if (near || ui.isBusy() && pp && Math.hypot(pp.x - g.position.x, pp.z - g.position.z) < 4) {
        animateGait(g, t, 0);
        g.rotation.y = turnToward(g.rotation.y, Math.atan2(pp.x - g.position.x, pp.z - g.position.z), dt, 5);
        return;
      }
      if (w.pause > 0) {
        w.pause -= dt;
        animateGait(g, t, 0);
        if (w.onPause) w.onPause(dt, t);
        return;
      }
      const tg = points[w.i];
      const dx = tg.x - g.position.x, dz = tg.z - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { w.i = (w.i + 1) % points.length; w.pause = w.rest ?? 1 + h01() * 2.5; return; }
      let nx = g.position.x + (dx / d) * speed * dt, nz = g.position.z + (dz / d) * speed * dt;
      // somebody coming the other way (or dawdling ahead)? step round them on
      // your right, the way people do on a sidewalk; wait only if there's no
      // room to (walkers used to walk straight through each other)
      const inWay = (x, z) => movers.some((o) => o !== g && Math.hypot(o.position.x - x, o.position.z - z) < 0.85 &&
        Math.hypot(o.position.x - x, o.position.z - z) < Math.hypot(o.position.x - g.position.x, o.position.z - g.position.z));
      if (inWay(nx, nz)) {
        const ux = dx / d + (dz / d) * 1.2, uz = dz / d - (dx / d) * 1.2, ul = Math.hypot(ux, uz);
        const sx = g.position.x + (ux / ul) * speed * dt, sz = g.position.z + (uz / ul) * speed * dt;
        if (inWay(sx, sz) || sd(sx - O.x, sz - O.z) > -0.6 || solid(sx - O.x, sz - O.z)) {
          animateGait(g, t, 0);
          return;
        }
        nx = sx; nz = sz;
      }
      g.position.set(nx, burroughHeight(nx, nz), nz);
      g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 6);
      animateGait(g, t, 1, w.rate ?? 10);
    });
    return w;
  }
  function stand(critter, lx, lz, rotY = 0, lift = 0) {
    critter.position.set(O.x + lx, at(lx, lz) + lift, O.z + lz);
    critter.rotation.y = rotY;
    group.add(critter);
    block(lx, lz, 0.45);
    return critter;
  }
  // somebody who stays put, but isn't a statue: they look up and down the
  // street, shift about, and turn to you when you come close
  function lively(critter, { list = updates, look = 0.5, speed = 0.35, face = 4.5, bob = 0, hop = 0 } = {}) {
    const base = critter.rotation.y, ph = h01() * 20, y0 = critter.position.y;
    const wp = new THREE.Vector3();
    critter.userData.noFidget = true;
    list.push((dt, t, pp) => {
      let want = base + Math.sin(t * speed + ph) * look + Math.sin(t * speed * 2.7 + ph) * look * 0.35;
      if (pp && face) {
        critter.getWorldPosition(wp);
        if (Math.hypot(pp.x - wp.x, pp.z - wp.z) < face) want = Math.atan2(pp.x - wp.x, pp.z - wp.z) - (critter.parent?.rotation?.y || 0);
      }
      critter.rotation.y = turnToward(critter.rotation.y, want, dt, 3);
      const p = critter.userData.parts;
      p.body.rotation.z = Math.sin(t * 0.8 + ph) * 0.05;
      if (bob) p.body.position.y = p.bodyY + Math.abs(Math.sin(t * 2 + ph)) * bob;
      if (hop) {
        const c = (t + ph) % 7;
        critter.position.y = y0 + (c < 0.45 ? Math.sin((c / 0.45) * Math.PI) * hop : 0);
      }
    });
  }

  // ============================================================ the dirt ----
  function ground(X0, X1, Z0, Z1, SX, SZ) {
    let geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(O.x + (X0 + X1) / 2, 0, O.z + (Z0 + Z1) / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, burroughHeight(pos.getX(i), pos.getZ(i)));
    geo = geo.toNonIndexed();
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const col = new THREE.Color();
    const FLOOR_A = new THREE.Color(0x8a6848), FLOOR_B = new THREE.Color(0x7e5f42);
    const PATH = new THREE.Color(0xa88a66), PLATFORM = new THREE.Color(0xb8a58a);
    // the walls, in strata: every band a different century of dirt
    const STRATA = [0x6b4a32, 0x7d5a3c, 0x5e4230, 0x8a6a4a, 0x6a4c38, 0x9a7a58, 0x5a3e2c].map((c) => new THREE.Color(c));
    const MOSS = new THREE.Color(0x5f6e3a);
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3 - O.x;
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 - O.z;
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const d = sd(x, z);
      if (d > 0.2 && y > 0.25) {
        const band = Math.floor(y * 1.1 + Math.sin(x * 0.08) * 0.8);
        col.copy(STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length]);
        if (vnoise(x * 0.6, y * 2) > 0.8) col.lerp(MOSS, 0.4);
      } else {
        col.copy(vnoise(x * 0.7, z * 0.7) > 0.5 ? FLOOR_A : FLOOR_B);
        if (Math.abs(z - 0.8) < 3.2 && d < -0.5) col.lerp(PATH, 0.35); // the walkway beside the Line
        if (y > 0.2 && y < 0.35 && d < 0) col.copy(PLATFORM);
      }
      col.multiplyScalar(1 + (hash2(i, 5) - 0.5) * 0.1);
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
  ground(-88, 78, -46, 16, 166, 62);
  ground(-LINE_END - 2, -88, -12, 10, 116, 22); // the Line, running off west
  ground(78, LINE_END + 2, -12, 10, 124, 22);   // and east

  // ======================================================= street furniture ----
  const lampBulbs = []; // Burrough Electric's customers (Spoke powers these)
  function lamp(lx, lz, h = 3.2) {
    const g = new THREE.Group();
    const post = box(0.14, h, 0.14, 0x3a3430);
    post.position.y = h / 2;
    const arm = box(0.7, 0.08, 0.08, 0x3a3430);
    arm.position.set(0.3, h - 0.05, 0);
    const shadeC = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 6), mat(0x3a3430));
    shadeC.position.set(0.6, h - 0.12, 0);
    const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), glow(0xffd98a, 1.1));
    bulb.position.set(0.6, h - 0.28, 0);
    g.add(post, arm, shadeC, bulb);
    put(g, lx, lz);
    bulb.castShadow = false;
    lampBulbs.push(bulb);
    block(lx, lz, 0.25);
    return g;
  }
  function signPost(lx, lz, text, w = 2.4, h = 0.6, bg = '#2f5a44', fg = '#f3e6c8', ry = 0) {
    const g = new THREE.Group();
    const post = box(0.1, 2.2, 0.1, 0x3a3430);
    post.position.y = 1.1;
    const s = sign(text, w, h, bg, fg, { border: '#e8d49a' });
    s.position.set(0, 2.2 + h / 2 - 0.1, 0.06);
    g.add(post, s);
    g.rotation.y = ry;
    put(g, lx, lz);
    block(lx, lz, 0.15);
    return g;
  }

  // a shopfront, carved into the wall: front face at z (local), back into
  // the earth. The sign gets its own band at the top; the windows stay
  // below it. Returns the spot just outside the door.
  function frontage({ x, z, w, h, d = 5, color, trim = 0xe8dcc0, name, sub = '', signBg = '#f3e6c8', signFg = '#3a2a1c', rows = 1, cols = 2, door = true, doorColor = 0x3a2a20 }) {
    const g = new THREE.Group();
    const bodyM = box(w, h, d, color);
    bodyM.position.set(0, h / 2, -d / 2);
    bodyM.userData.occlude = true;
    g.add(bodyM);
    const cornice = box(w + 0.4, 0.3, 0.5, trim);
    cornice.position.set(0, h, 0.05);
    g.add(cornice);
    const base = box(w + 0.1, 0.35, 0.2, trim);
    base.position.set(0, 0.17, 0.02);
    g.add(base);
    if (door) {
      const dr = box(1.1, 1.9, 0.12, doorColor);
      dr.position.set(0, 0.95, 0.02);
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10, 0, Math.PI), mat(doorColor));
      arch.position.set(0, 1.9, 0.09);
      const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0xc9a24a, 0.3));
      knob.position.set(0.35, 0.95, 0.1);
      g.add(dr, arch, knob);
    }
    const signH = name ? (sub ? 0.95 : 0.6) : 0;
    // round windows, warm — it's always evening down here
    const winMat = glow(0xffc87a, 0.75);
    const frameMat = mat(trim);
    const top = h - 0.75 - signH - 0.2; // the top row sits under the sign band
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = (c + 0.5) * (w / cols) - w / 2;
        if (door && r === 0 && Math.abs(wx) < 1.1) continue;
        const wy = rows === 1 ? Math.min(h * 0.45, top) : 1.6 + r * ((top - 1.6) / Math.max(1, rows - 1));
        const pane = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), winMat);
        pane.position.set(wx, wy, 0.03);
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.07, 4, 12), frameMat);
        frame.position.set(wx, wy, 0.05);
        g.add(pane, frame);
      }
    }
    if (name) {
      const s = sign(sub ? `${name}\n${sub}` : name, Math.min(w - 0.6, 5.5), signH, signBg, signFg);
      s.position.set(0, h - 0.2 - signH / 2, 0.14);
      g.add(s);
    }
    put(g, x, z);
    blockBox(x - w / 2, z - d, x + w / 2, z + 0.1);
    return { x, z: z + 1.1 };
  }
  // a door you can walk through into one of the rooms
  function doorway(spot, zone, label, onEnter) {
    register({
      pos: new THREE.Vector3(O.x + spot.x, 0, O.z + spot.z), r: 1.5, zone: 'burrough', priority: 2,
      label,
      use: async () => {
        await zones.go(zone);
        if (onEnter) onEnter();
      },
    });
  }

  // ================================================ the ways in and out ----
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  function ladder(lx, lz, warm) {
    const g = new THREE.Group();
    for (const sx of [-0.4, 0.4]) {
      const rail = box(0.1, 9, 0.1, 0x8a6a44);
      rail.position.set(sx, 4.5, 0);
      g.add(rail);
    }
    for (let y = 0.4; y < 9; y += 0.5) {
      const rung = box(0.8, 0.06, 0.08, 0x9a7a50);
      rung.position.set(0, y, 0);
      g.add(rung);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 12, 8, 1, true), shaftMat.clone());
    if (warm) shaft.material.color.set(0xffc27a);
    shaft.position.set(0, 6, 0.6);
    g.add(shaft);
    put(g, lx, lz);
    shaft.castShadow = false;
    block(lx, lz, 0.6);
    return g;
  }
  ladder(LADDER_W.x, LADDER_W.z, false);
  ladder(LADDER_E.x, LADDER_E.z, true);
  {
    // west: a hard-hat-yellow sign on a post; east: a brass-and-velvet rope
    signPost(LADDER_W.x - 1.6, LADDER_W.z + 1.2, '↑ 연구소로\n(머리 조심)', 1.7, 0.7, '#f2cf5b', '#2e2a26');
    signPost(LADDER_E.x - 1.8, LADDER_E.z + 1.2, '↑ 몰드카이 지하실\n입주민과 손님', 1.9, 0.7, '#2e3a2a', '#e8d49a');
    for (const dx of [-1.1, 1.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), mat(0xc9a24a, 0.3));
      put(post, LADDER_E.x + dx, LADDER_E.z + 1.6, 0.45);
      block(LADDER_E.x + dx, LADDER_E.z + 1.6, 0.12);
      const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat(0xc9a24a, 0.3));
      put(knob, LADDER_E.x + dx, LADDER_E.z + 1.6, 0.95);
    }
    const rope = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 4, 12, Math.PI), mat(0x8a1f2a, 0.6));
    rope.rotation.set(0, 0, Math.PI);
    rope.scale.y = 0.28; // a gentle swag between the posts, well clear of the floor
    put(rope, LADDER_E.x, LADDER_E.z + 1.6, 0.9);
    // welcome, on a board of its own by the Labs ladder
    signPost(-67.2, -5.4, '버로에 온 걸 환영해\n인구 많음', 2.6, 0.8, '#e8dcc0', '#5a3a24', 0.35);
  }
  register({
    pos: new THREE.Vector3(O.x + LADDER_W.x, 0, O.z + LADDER_W.z + 1.2), r: 1.8, zone: 'burrough',
    label: '연구소로 올라가기',
    use: async () => {
      await zones.go('island', { ...labsHill.out });
      ui.toast('위로, 밖으로, 눈부신 작은 언덕의 꽃들 속으로. 아래 어딘가에서 보어링 선이 딩딩 울려요.', '☀️');
    },
  });
  register({
    pos: new THREE.Vector3(O.x + LADDER_E.x, 0, O.z + LADDER_E.z + 1.2), r: 1.8, zone: 'burrough',
    label: '와인 저장고로 올라가기',
    use: async () => {
      await zones.go('cellar', { x: CELLAR.x - 1.2, z: CELLAR.z - 2.4, rotY: Math.PI });
      ui.toast('작은 문을 지나 누군가의 와인 저장고로. 아주 조용해요. 문빔 ’34가 빛나요.', '🍷');
    },
  });

  // ---- up top: the molehill on the little hill in the Labs meadow ----
  // (labsgrounds.js finds the hilltop and rings it with flowers; failing
  // that, somewhere dry and open near Wendell's chair)
  const labsHill = (() => {
    const B = ISLAND6_BEACH;
    let spot = molehill;
    for (let r = 0; r <= 9 && !spot; r += 0.75) {
      for (let k = 0; k < (r ? 12 : 1) && !spot; k++) {
        const a = (k / 12) * Math.PI * 2 + r;
        const x = B.x + 3 + Math.cos(a) * r, z = B.z - 6 + Math.sin(a) * r;
        if (terrainHeight(x, z) > 0.6 && !zones.nearAnything(x, z, 1.6)) spot = { x, z };
      }
    }
    spot = spot || { x: B.x + 3, z: B.z - 6 };
    const y = terrainHeight(spot.x, spot.z);
    const g = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.95, 0.5, 8), mat(0x7a5a3c));
    mound.position.y = 0.2;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 8), mat(0x1d140d, 1));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.46;
    const rungs = box(0.5, 0.05, 0.05, 0x9a7a50);
    rungs.position.set(0, 0.62, -0.18);
    for (const sx of [-0.25, 0.25]) {
      const rail = box(0.05, 0.5, 0.05, 0x8a6a44);
      rail.position.set(sx, 0.55, -0.18);
      g.add(rail);
    }
    const stake = box(0.06, 0.9, 0.06, 0x7a5230);
    stake.position.set(0.9, 0.45, 0.2);
    const plate = sign('보어링 부\n직원 출입구\n(방문객 환영)', 0.8, 0.45, '#f2cf5b', '#2e2a26');
    plate.position.set(0.9, 0.95, 0.24);
    const hat = hardHat(); // set down on the grass beside the stake, clear of the sign
    hat.scale.setScalar(0.8);
    hat.position.set(1.45, 0.02, 0.35);
    hat.rotation.set(0.15, 0.4, 0);
    g.add(mound, hole, rungs, stake, plate);
    g.add(hat);
    g.position.set(spot.x, y - 0.05, spot.z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(g);
    zones.addBlocker(spot.x, spot.z, 0.9);
    register({
      pos: new THREE.Vector3(spot.x, 0, spot.z + 1), r: 1.9,
      label: '두더지 언덕으로 내려가기',
      use: () => enter(ARRIVE_W),
    });
    group.userData.molehill = spot; // (the screenshot harness goes looking for it)
    return { g, out: { x: spot.x, z: spot.z + 1.6, rotY: 0 } };
  })();

  // ---- up top: the little door in the back wall of the wine cellar ----
  {
    const C = CELLAR;
    const g = new THREE.Group();
    const dark = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12, 0, Math.PI), mat(0x120c08, 1));
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.35), mat(0x120c08, 1));
    lower.position.y = -0.17;
    dark.add(lower);
    dark.position.y = 0.35;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.05, 4, 12, Math.PI), mat(0xc9a24a, 0.3));
    trim.position.y = 0.35;
    const plaque = sign('서비스 출입구\n(버로)', 0.55, 0.22, '#c9a24a', '#2e2a1c');
    plaque.position.set(0, 1.12, 0.01);
    g.add(dark, trim, plaque);
    g.position.set(C.x - 1.2, 0, C.z - 4.28);
    group.add(g);
    cellarDoor = g;
    register({
      pos: new THREE.Vector3(C.x - 1.2, 0, C.z - 3.3), r: 1.4, zone: 'cellar',
      label: '작은 문으로 비집고 들어가기',
      use: () => enter(ARRIVE_E),
    });
  }

  async function enter(spot) {
    plop();
    await zones.go('burrough', { ...W(spot.x, spot.z), rotY: spot.rotY });
    if (!S.hasFlag('sawBurrough')) {
      S.setFlag('sawBurrough');
      ui.say([
        '사다리를 따라 한참 아래로, 뿌리들과 머리 조심 표지를 지나, 그리고 또 조심하라는 표지를 지나.',
        '그러고는 어둠이 활짝 열리며 도시가 나타나요. 램프. 둥근 창들. 어딘가에서 전차 종이 딩딩.',
        '기둥의 표지: 버로에 온 걸 환영해. 인구. 많음.',
      ]);
    }
  }

  // ======================================================= THE BORING LINE ----
  // the track and the wire, all the way out into the dark both ways
  {
    const railMat = mat(0x9a9a9a, 0.35);
    for (const dz of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(LINE_END * 2, 0.08, 0.08), railMat);
      rail.position.set(O.x, 0.06, O.z + TRACK_Z + dz);
      rail.receiveShadow = true;
      group.add(rail);
    }
    const nTies = Math.ceil((LINE_END * 2) / 0.9) + 1;
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.06, 1.6), mat(0x5a4230), nTies);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let x = -LINE_END; x <= LINE_END && n < nTies; x += 0.9) { m4.makeTranslation(O.x + x, 0.03, O.z + TRACK_Z); ties.setMatrixAt(n++, m4); }
    ties.count = n;
    ties.receiveShadow = true;
    group.add(ties);
    const wire = new THREE.Mesh(new THREE.BoxGeometry(LINE_END * 2, 0.03, 0.03), mat(0x2a2a2a));
    wire.position.set(O.x, 4.1, O.z + TRACK_Z);
    group.add(wire);
    for (let x = -LINE_END + 4; x <= LINE_END - 4; x += 14) {
      const pz = TRACK_Z - 1.7;
      const post = box(0.14, 4.3, 0.14, 0x3a3430);
      put(post, x, pz, 2.15);
      const arm = box(0.08, 0.08, 1.8, 0x3a3430);
      put(arm, x, pz + 0.85, 4.2);
      block(x, pz, 0.2);
    }
    // platforms: a lip of cut stone, a name board, a bell pull
    for (const st of STOPS) {
      const edge = box(PLAT.hw * 2, 0.32, 0.18, 0xd8c8a8);
      put(edge, st.x, PLAT.z0 + 0.09, 0.0);
      edge.position.y = 0.16;
      const pole = box(0.12, 2.6, 0.12, 0x3a3430);
      put(pole, st.x - 3.2, PLAT.z1 - 0.3, 1.3 + PLAT.h);
      const board = sign(`보어링 선\n${st.name}`, 1.9, 0.75, '#2f5a44', '#f3e6c8', { border: '#e8d49a' });
      board.position.set(O.x + st.x - 3.2, PLAT.h + 2.35, O.z + PLAT.z1 - 0.22);
      group.add(board);
      block(st.x - 3.2, PLAT.z1 - 0.3, 0.2);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 8, 1, true), mat(0xc9a24a, 0.3));
      put(bell, st.x - 3.2, PLAT.z1 - 0.05, PLAT.h + 1.6);
      bell.material.side = THREE.DoubleSide;
      st.bell = bell;
    }
    signPost(-70, 2.9, '보어링 선\n← 서쪽 (끝까지)');
    signPost(70, 2.9, '보어링 선\n동쪽 (끝까지) →');
    signPost(-30, 3.2, '← 웍스 · 롬 스트리트 →');
    signPost(30, 3.2, '← 롬 스트리트 · 업타운 →');
    signPost(-25, 3.2, '틈새 주의\n(틈새는 언제나 있음)', 2.2, 0.6, '#f2cf5b', '#2e2a26');
  }

  // the car: open-sided, like a summer trolley, so you can see who's aboard
  const car = new THREE.Group();
  const FLOOR_Y = 0.675;
  {
    const green = 0x3f7a5a, cream = 0xefe2c0;
    const floor = box(5.2, 0.25, 2.1, 0x5a4230);
    floor.position.y = 0.55;
    const skirtS = box(5.2, 0.5, 0.1, green);
    skirtS.position.set(0, 0.9, 1.0);
    const skirtN = skirtS.clone();
    skirtN.position.z = -1.0;
    const roof = box(5.6, 0.18, 2.4, green);
    roof.position.y = 2.75;
    const roofTop = box(4.4, 0.16, 1.5, cream);
    roofTop.position.y = 2.9;
    car.add(floor, skirtS, skirtN, roof, roofTop);
    for (const sx of [-2.45, -0.8, 0.8, 2.45]) for (const sz of [-1.0, 1.0]) {
      const post = box(0.1, 1.9, 0.1, cream);
      post.position.set(sx, 1.75, sz);
      car.add(post);
    }
    for (const sx of [-2.6, 2.6]) {
      const end = box(0.14, 1.0, 2.1, green);
      end.position.set(sx, 1.1, 0);
      const lampF = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), glow(0xfff0c0, 1.2));
      lampF.position.set(sx + Math.sign(sx) * 0.08, 1.3, 0);
      lampF.rotation.y = Math.sign(sx) * Math.PI / 2;
      car.add(end, lampF);
    }
    const band = box(5.25, 0.12, 2.15, cream);
    band.position.y = 1.2;
    car.add(band);
    for (const sx of [-1.7, 0, 1.7]) {
      const bench = box(1.2, 0.12, 0.5, 0x8a5a3a);
      bench.position.set(sx, 0.95, -0.55);
      car.add(bench);
    }
    const nameplate = sign('보어링 선', 2.4, 0.32, '#3f7a5a', '#efe2c0');
    nameplate.position.set(0, 2.52, 1.21);
    car.add(nameplate);
    // the trolley pole, up to the wire, sparking now and then
    const pole = box(0.05, 0.05, 1.6, 0x2a2a2a);
    pole.rotation.y = Math.PI / 2;
    pole.rotation.z = 0.7;
    pole.position.set(-0.8, 3.45, 0);
    car.add(pole);
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), glow(0xbfe8ff, 2));
    spark.position.set(-1.4, 4.08, 0);
    car.add(spark);
    car.userData.spark = spark;
    for (const sx of [-1.9, 1.9]) for (const sz of [-0.7, 0.7]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), mat(0x3a3a3a, 0.4));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.32, sz);
      car.add(wheel);
    }
    car.traverse((o) => { if (o.isMesh && o !== spark) { o.castShadow = true; o.receiveShadow = true; } });
    car.position.set(O.x + STOPS[0].x, 0, O.z + TRACK_Z);
    group.add(car);
  }
  // the motorman (standing at the controls, feet on the floor), and a
  // regular on the bench with the paper, who looks up now and then
  const motor = buildAnimal('mole', { body: 0x5a4a44 });
  motor.scale.setScalar(0.85);
  onHead(motor, flatCap(0x2f5a44), 0.34);
  motor.position.set(2.1, FLOOR_Y, 0.1);
  motor.rotation.y = Math.PI / 2;
  motor.userData.noFidget = true;
  car.add(motor);
  const reader = buildAnimal('mole', { body: 0x6a5a50 });
  reader.scale.setScalar(0.8);
  sit(reader);
  reader.position.set(-1.7, 0.9, -0.5); // seated on the bench (top at 1.01)
  const paper = sign('데일리\n더트', 0.55, 0.6, '#f3efe2', '#2e2a26');
  paper.position.set(0, 1.0, 1.3);   // held out in front of the snout, not through it
  reader.add(paper);
  car.add(reader);
  lively(reader, { look: 0.4, speed: 0.3, face: 0 });
  updates.push((dt, t) => {
    // the paper comes down, a look around, and back up
    const c = t % 13;
    const down = c > 9 && c < 12 ? Math.sin(((c - 9) / 3) * Math.PI) : 0;
    paper.position.y = 1.0 - down * 0.45;
    paper.rotation.x = down * 0.7;
    paper.rotation.z = Math.sin(t * 3.1) * 0.02;
    motor.userData.parts.head.rotation.x = Math.sin(t * 0.7) * 0.08;
  });

  // the timetable: shuttle Works → Loam St → Uptown → Loam St → …, a short
  // dwell at each; ring the bell and it comes to you; board and it takes
  // you straight where you're going
  const line = { x: STOPS[0].x, route: [0, 1, 2, 1], ri: 0, dwell: 4, express: null, rider: null, v: 0, held: false };
  const stopAt = (i) => STOPS[i];
  function nextStopIndex() {
    return line.express ?? line.route[line.ri];
  }
  function docked(i) {
    return line.dwell > 0 && Math.abs(line.x - STOPS[i].x) < 0.3;
  }
  function ding() {
    tone(1318, { dur: 0.12, type: 'sine', vol: 0.05 });
    tone(1318, { dur: 0.16, type: 'sine', vol: 0.05, time: 0.22 });
  }
  STOPS.forEach((st, i) => {
    register({
      pos: new THREE.Vector3(O.x + st.x, 0, O.z + 0.2), r: 3.4, zone: 'burrough', priority: 2,
      enabled: () => !line.rider,
      label: () => (docked(i) ? '보어링 선 타기' : '보어링 선 부르기'),
      use: async () => {
        if (!docked(i)) {
          line.express = i;
          line.dwell = 0;
          ding();
          ui.toast('딩딩. 보어링 선이 오고 있어요. (항상 오고 있었어요.)', '🚋');
          return;
        }
        line.held = true; // the motorman waits while you make up your mind
        const dest = await ui.ask('“어디로?”', [
          ...STOPS.filter((d) => d !== st).map((d) => ({ label: `🚋 ${d.name}`, value: d.name })),
          { label: '그냥 구경 중', value: null },
        ], { speaker: '운전수', voice: 250 });
        line.held = false;
        const to = STOPS.findIndex((d) => d.name === dest);
        if (to < 0 || !docked(i)) return;
        line.rider = { to, t: 0 };
        line.express = to;
        line.dwell = 0;
        player.riding = true;
        ding();
        ui.toast(`다음 정거장: ${STOPS[to].name}. 틈새 주의. 틈새는 언제나 있어요.`, '🚋');
      },
    });
  });
  updates.push((dt, t) => {
    const target = stopAt(nextStopIndex());
    if (line.dwell > 0) {
      if (!line.held) line.dwell -= dt;
      line.v = 0;
    } else {
      const d = target.x - line.x;
      // somebody on the track ahead? the car waits, and says so
      const pp = player.group.position;
      const ahead = (pp.x - car.position.x) * Math.sign(d);
      if (!line.rider && Math.abs(pp.z - (O.z + TRACK_Z)) < 1.25 && ahead > 0 && ahead < 4.2) {
        line.v = 0;
        line.waitDing = (line.waitDing ?? 0) - dt;
        if (line.waitDing <= 0) { ding(); line.waitDing = 2.5; }
        return;
      }
      const want = Math.sign(d) * Math.min(6, 0.5 + Math.abs(d) * 0.8);
      line.v += (want - line.v) * Math.min(1, dt * 1.5);
      line.x += line.v * dt;
      if (Math.abs(d) < 0.12) {
        line.x = target.x;
        line.v = 0;
        line.dwell = 5;
        ding();
        if (line.express !== null) {
          // pick the timetable back up from wherever the express left it
          const ri = line.route.indexOf(line.express);
          line.ri = (ri + 1) % line.route.length;
          line.express = null;
        } else line.ri = (line.ri + 1) % line.route.length;
        if (line.rider) {
          player.riding = false;
          player.group.position.set(O.x + target.x + 1.2, PLAT.h, O.z + 0.4);
          player.group.rotation.y = 0;
          line.rider = null;
        }
      }
    }
    car.position.set(O.x + line.x, 0, O.z + TRACK_Z);
    car.position.y = Math.abs(line.v) > 0.5 ? Math.sin(t * 14) * 0.015 : 0;
    car.userData.spark.visible = Math.abs(line.v) > 1 && Math.sin(t * 23) > 0.6;
    for (const st of STOPS) st.bell.rotation.z = docked(STOPS.indexOf(st)) ? Math.sin(t * 9) * 0.2 : 0;
    if (line.rider) {
      player.group.position.set(car.position.x + 0.3, car.position.y + FLOOR_Y, car.position.z + 0.15);
      player.group.rotation.y = line.v >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    // the motorman keeps to whichever end is the front
    motor.rotation.y = line.v < -0.1 ? -Math.PI / 2 : Math.PI / 2;
    motor.position.x = line.v < -0.1 ? -2.1 : 2.1;
  });

  // commuters: walking the platform side of the Line, out into the dark and
  // back, stopping for anyone in the way
  {
    const COMMUTE_LINES = [
      '못 서, 늦었어. 항상 늦었어. 그게 라이프스타일이야.',
      '전차 탈 수도 있어. 걸어. 더 빠른 건 아냐. 그냥 걷는 게 좋아.',
      '처음 내려왔어? 그렇게 고개 들고 다니지 마. 언젠가 어딘가에 부딪혀.',
      '러시아워의 롬 스트리트. 여섯 명. 광란이야.',
      '통근 40분. 가는 데 20, 어둠을 보며 “흠” 하는 데 20.',
    ];
    const FOLK = [
      // (out past the neighborhoods they keep to the middle of the tunnel,
      // clear of Old Faithful, the lamps and the signposts — walkers don't
      // steer, so their paths have to)
      { kind: 'mole', body: 0x5e5048, hat: () => fedora(0x6a5a48), path: [[-62, 2.1], [-8, 1.9], [30, 2.2], [66, 1.0], [96, 1.0], [66, 1.0], [30, 2.2], [-8, 1.9]], speed: 1.5 },
      { kind: 'hamster', body: 0xd8a068, hat: () => beret(0xb8433a), path: [[40, 2.6], [8, 1.8], [-20, 1.8], [-62, 2.2], [-68, 0.6], [-110, 0.6], [-68, 0.6], [-62, 2.2], [-20, 1.8], [8, 1.8]], speed: 1.8 }, // (past Marjorie's crate at a polite distance)
      { kind: 'mole', body: 0x6a5a50, hat: () => hardHat(), path: [[-58, 2.4], [-64, 0.6], [-130, 0.6], [-64, 0.6]], speed: 1.2 },
      { kind: 'groundhog', body: 0x9a7048, hat: () => flatCap(0x4a5a6a), path: [[64, 2.0], [14, 1.9], [-40, 2.1], [14, 1.9]], speed: 1.3 },
      { kind: 'mole', body: 0x4e4540, hat: () => topHat(0x2a2420), path: [[58, 2.3], [66, 0.8], [150, 0.8], [66, 0.8]], speed: 1.0 },
    ];
    let q = 0;
    FOLK.forEach((f) => {
      const c = buildAnimal(f.kind, { body: f.body, head: f.body });
      onHead(c, f.hat(), f.kind === 'hamster' ? 0.34 : 0.32);
      if (f.kind !== 'hamster') c.scale.setScalar(0.9);
      walker(c, f.path, f.speed, { rest: 1.5 + h01() * 3 });
      talker(() => c.position, '통근자', 280 + q * 60, [COMMUTE_LINES[q++ % COMMUTE_LINES.length]], 2.0);
    });
  }

  // ============================================================ THE WORKS ----
  const local1Door = frontage({ x: -54, z: -8.6, w: 8, h: 5.2, color: 0x7a5238, trim: 0xf2cf5b, name: '보어링 부 · 1지부', sub: '우리는 판다 · 태초부터', signBg: '#2e2a26', signFg: '#f2cf5b', cols: 3 });
  doorway(local1Door, 'burrough_local1', '1지부 들어가기');
  {
    // the union banner above the left window; hard hats on hooks by the door
    const banner = sign('모든 두더지에게 15분을', 2.2, 0.4, '#b8433a', '#fff3d6');
    banner.position.set(O.x - 56.67, at(-56.7, -8.6) + 3.65, O.z - 8.46);
    group.add(banner);
    for (let k = 0; k < 4; k++) {
      const hat = hardHat();
      hat.scale.setScalar(0.6);
      put(hat, -54 + 0.95 + (k % 2) * 0.48, -8.35, 1.35 + Math.floor(k / 2) * 0.45);
    }
  }
  // the punch clock
  {
    const g = new THREE.Group();
    const post = box(0.12, 1.2, 0.12, 0x3a3430);
    post.position.y = 0.6;
    const clock = box(0.6, 0.8, 0.35, 0xb8b0a0);
    clock.position.y = 1.5;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), mat(0xfff8ec));
    face.position.set(0, 1.62, 0.18);
    const slot = box(0.3, 0.05, 0.05, 0x2a2420);
    slot.position.set(0, 1.28, 0.18);
    g.add(post, clock, face, slot);
    put(g, -48.8, -7.4);
    block(-48.8, -7.4, 0.35);
    register({
      pos: new THREE.Vector3(O.x - 48.8, 0, O.z - 6.6), r: 1.4, zone: 'burrough', priority: 2,
      label: '출퇴근 시계 찍기',
      use: () => {
        thud();
        ui.say(S.hasFlag('punchedBurrough')
          ? '카-청크. 또 한 장: 방문객 — 근무 중. 당신은 여전히 여기 직원이 아니에요. 시계는 여전히 신경 안 써요.'
          : '카-청크. 카드가 찍혀 나와요: 방문객 — 근무 중. 아무도 당신에게 월급을 주지 않아요. 시계는 신경 안 써요.');
        S.setFlag('punchedBurrough');
      },
    });
  }
  // Bertha, shop steward, walking her picket-line-of-one in front of the hall
  {
    const b = buildAnimal('mole', { body: 0x4e4038 });
    onHead(b, hardHat(), 0.3);
    walker(b, [[-57, -6.7], [-50.6, -6.3]], 1.1, { rest: 3.5, rate: 9 });
    talker(() => b.position, '버사', 230, [
      '버사야. 보어링 부 1지부 직장대표. 관리자면, 난 쉬는 시간이야. 아니면, 그래도 쉬는 시간이야.',
      '보어링 선은 하룻밤에 팠어. 서류작업은 11년 걸렸지. 둘 다 자랑스러워.',
      '부서 절반이 연구소로 통근해. 듣는 우물 때문에 우릴 고용했지. 두더지만큼 암반을 통해 듣는 건 없어.',
      '웬델? 15분 쉬는 중. 봄부터 15분 쉬는 중이야. 확인 안 해. 그게 연대야.',
      '들어가 봐, 사무실 열었어. 도리스에게 안부 전해. 도리스에게 양식은 달라고 하지 마.',
    ]);
  }
  // the Visitors' Bureau: mole tourism is the Burrough's fastest-growing industry
  {
    const g = new THREE.Group();
    const counter = box(2.8, 1.0, 1.0, 0x9a6a44);
    counter.position.y = 0.5;
    const top = box(3.0, 0.1, 1.2, 0xe8dcc0);
    top.position.y = 1.05;
    const roof = box(3.2, 0.14, 2.3, 0x3f7a5a);
    roof.position.set(0, 2.55, -0.55);
    g.add(counter, top, roof);
    for (const sx of [-1.45, 1.45]) {
      const post = box(0.1, 1.5, 0.1, 0xe8dcc0);
      post.position.set(sx, 1.8, 0.4);
      g.add(post);
    }
    const s = sign('방문객 안내소\n지도 · 흙 지구본 · 길 안내 (아래로)', 2.8, 0.6, '#3f7a5a', '#f3e6c8');
    s.position.set(0, 2.2, 0.47);
    g.add(s);
    // a rack of dirt globes on the counter
    for (let k = 0; k < 3; k++) {
      const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.5, roughness: 0.1 }));
      glass.position.set(-0.9 + k * 0.35, 1.26, 0.2);
      const baseG = box(0.2, 0.08, 0.2, 0x6a4a30);
      baseG.position.set(-0.9 + k * 0.35, 1.14, 0.2);
      g.add(glass, baseG);
    }
    put(g, -61.2, -8.2);
    blockBox(-62.7, -10.2, -59.7, -7.6);
    // Tuppence stands behind the counter (not in it)
    const tup = buildAnimal('hamster', { body: 0xe0a060 });
    stand(tup, -61.2, -9.7, 0, 0);
    lively(tup, { look: 0.45, speed: 0.5, bob: 0.03 });
    const SOUVENIRS = [{ id: 'dirt_globe', price: 120 }, { id: 'daily_dirt', price: 2 }];
    const talk = [
      '버로에 온 걸 환영해! 인구: 많음! 할 것: 많음! 하늘: 없음!',
      '주요 명소: 보어링 선, 롬 스트리트, 심층 연구소(보기만, 노크 금지), 그리고 업타운, 부자 두더지들이 더는 안 사는 곳.',
      '처음 내려왔어? 다들 첫날은 고개를 들고 다녀. 곧 나아져.',
    ];
    let k = 0;
    register({
      pos: new THREE.Vector3(O.x - 61.2, 0, O.z - 6.8), r: 1.9, zone: 'burrough',
      label: '방문객 안내소 들르기',
      use: async () => {
        const picked = await ui.ask(talk[k++ % talk.length], [
          ...SOUVENIRS.map((m) => ({
            label: `${ITEMS[m.id].emoji} ${ITEMS[m.id].name}`, value: m.id, hint: `${m.price}🔘`,
            disabled: S.state.buttons < m.price,
          })),
          { label: '그냥 방문 중', value: null },
        ], { speaker: '터펜스', voice: 640 });
        const m = SOUVENIRS.find((x) => x.id === picked);
        if (!m) return;
        S.spend(m.price);
        S.addItem(m.id);
        kaching();
        ui.updateHUD();
        ui.toast(`You bought <b>${ITEMS[m.id].name}</b>.`, ITEMS[m.id].emoji);
        ui.say(m.id === 'dirt_globe'
          ? '흔들어! 가라앉아! 항상 가라앉아! 그게 버로야!'
          : '오늘 아침 따끈따끈! 뭐. 오늘 아침 치. 또 핫 웜 기사야.', { speaker: '터펜스', voice: 640 });
      },
    });
  }
  // the Department's boring machine, parked by the Line west of the Works,
  // and Auger, who walks the track out west and back
  {
    const drill = new THREE.Group();
    const bodyD = box(2.2, 1.6, 1.6, 0xd8a03a);
    bodyD.position.y = 1.0;
    const bit = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 7), mat(0x9a9a9a, 0.35));
    bit.rotation.z = Math.PI / 2;
    bit.position.set(-1.9, 1.0, 0);
    drill.add(bodyD, bit);
    for (const sz of [-0.8, 0.8]) {
      const tread = box(2.4, 0.5, 0.35, 0x3a3a3a);
      tread.position.set(0, 0.25, sz);
      drill.add(tread);
    }
    const plate = sign('올드 페이스풀', 1.4, 0.3, '#2e2a26', '#f2cf5b');
    plate.position.set(0, 1.4, 0.81);
    drill.add(plate);
    put(drill, -77, 2.2);
    blockBox(-79.6, 1.3, -75.8, 3.1);
    updates.push((dt, t) => { bit.rotation.x = t * 0.4; });
    const auger = buildAnimal('mole', { body: 0x5a4a44 });
    onHead(auger, hardHat(), 0.3);
    // (the car never runs west of the Works, so the track out there is his)
    walker(auger, [[-60, -2.4], [-72, -2.4], [-96, -2.4], [-72, -2.4]], 1.0, {
      rest: 4, rate: 9,
      onPause: (dt, t) => { auger.userData.parts.head.rotation.x = Math.max(0, Math.sin(t * 5)) * 0.35; }, // tap, tap: checking the rail
    });
    talker(() => auger.position, '오거', 270, [
      '선로 점검이야. 램프가 지칠 때까지 서쪽으로 걷고, 그다음 돌아와.',
      '어디까지 가냐고? 서쪽. 누구든 가본 데 너머. 교수는 끝난다고 증명할 수 없대. 우린 안 끝난다고도 증명할 수 없지. 다들 행복해.',
      '하룻밤에 팠어. 어느 밤이었는지 아무도 말 안 했지. 저 밖에선 아직도 그 밤일지도 몰라.',
      '어떤 밤엔, 큰 조수 때, 레일을 통해 종소리가 들려. 좋은 소리야. 박자를 맞춰줘.',
    ]);
  }
  lamp(-58, -5.2);
  lamp(-44, -5.2);
  lamp(-66, 2.6);

  // =============================================== THE INSTITUTE FOR DEEP STUDY ----
  {
    // the gate at the foot of the lane: two posts, a bar, the plaque hung
    // from it (clear of the banks on either side)
    for (const gx of [-49.6, -44.3]) {
      const p = box(0.6, 2.9, 0.6, 0xb8ad98);
      put(p, gx, -13.4, 1.45);
      const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), mat(0xd8cdb8));
      put(cap, gx, -13.4, 3.05);
      block(gx, -13.4, 0.45);
    }
    const bar = box(5.9, 0.25, 0.3, 0xb8ad98);
    put(bar, -46.95, -13.4, 2.8);
    const plaque = sign('심층 연구소\n학생 없음 · 수업 없음 · 서두름 없음', 3.4, 0.62, '#2e2a26', '#e8d49a', { border: '#c9a24a' });
    plaque.position.set(O.x - 46.95, at(-46.95, -13.4) + 2.32, O.z - 13.2);
    group.add(plaque);
  }
  // Mould Hall: red brick, white trim, a cupola with a clock nobody winds
  const mouldDoor = frontage({ x: -46, z: -33.3, w: 11, h: 5.6, color: 0x9a4a3a, trim: 0xf3efe2, name: '몰드 홀', signBg: '#f3efe2', signFg: '#6a2a20', rows: 2, cols: 5, doorColor: 0x2e3e2e });
  doorway(mouldDoor, 'burrough_mould', '몰드 홀 들어가기');
  {
    const cup = new THREE.Group();
    const drum = box(1.6, 1.3, 1.6, 0xf3efe2);
    drum.position.y = 0.65;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.2, 4), mat(0x4a6a5a));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.9;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), mat(0xfff8ec));
    face.position.set(0, 0.7, 0.81);
    const hand = box(0.04, 0.34, 0.02, 0x2a2420);
    hand.position.set(0, 0.82, 0.83);
    const hand2 = box(0.25, 0.04, 0.02, 0x2a2420);
    hand2.position.set(0.1, 0.7, 0.83);
    cup.add(drum, roof, face, hand, hand2);
    put(cup, -46, -35.8, 5.6);
  }
  // the blackboard
  {
    const g = new THREE.Group();
    const board = box(2.6, 1.6, 0.08, 0x2e3a32);
    board.position.y = 1.5;
    const frame = box(2.8, 1.8, 0.05, 0x8a6a44);
    frame.position.set(0, 1.5, -0.05);
    g.add(board, frame);
    for (const sx of [-1.2, 1.2]) {
      const leg = box(0.08, 1.4, 0.08, 0x8a6a44);
      leg.position.set(sx, 0.7, -0.05);
      g.add(leg);
    }
    const chalk = sign('정리:\n이 터널은 끝이 있음이\n증명될 수 없다.\n증명:\n(계속 파라)  ∎', 2.4, 1.4, '#2e3a32', '#e8efe8', { weight: 500 });
    chalk.position.set(0, 1.5, 0.05);
    g.add(chalk);
    put(g, -39.5, -30.2);
    blockBox(-41, -30.5, -38, -29.9);
    let k = 0;
    register({
      pos: new THREE.Vector3(O.x - 39.5, 0, O.z - 29), r: 1.8, zone: 'burrough',
      label: '칠판 읽기',
      use: () => ui.say([
        [
          '정리 (뫼델): 이 터널은 끝이 있음이 증명될 수 없다.',
          '증명: (계속 파라)',
          '그리고 아래에, 다른 필적으로: “나 좀 봐. —R.”',
        ],
        [
          '어제 이후 새로 쓰인 줄, 구석에 아주 작게: “충분히 깊은 모든 버로에는 자기 지도에 없는 방이 들어 있다.”',
          '보어링 부 누군가가 아래에 썼어요: “확인함.” 다른 누군가가 그걸 지우고 썼어요: “다시 확인.”',
        ],
      ][k++ % 2]),
    });
  }
  // the mushroom woods around the Institute (the IAS has woods; so do we)
  function mushroom(lx, lz, s = 1, cap = 0xd8b89a) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.6 * s, 6), mat(0xf0e6d2));
    stem.position.y = 0.8 * s;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.9 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap));
    top.scale.y = 0.6;
    top.position.y = 1.55 * s;
    g.add(stem, top);
    g.rotation.y = h01() * 6;
    put(g, lx, lz);
    block(lx, lz, 0.3 * s);
    return g;
  }
  {
    const CAPS = [0xd8b89a, 0xc88a6a, 0xe8d0b0, 0xb87a5a];
    let placed = 0;
    for (let i = 0; i < 400 && placed < 22; i++) {
      const lx = INSTITUTE.x + (h01() - 0.5) * 26, lz = INSTITUTE.z + (h01() - 0.5) * 16;
      const d = sd(lx, lz);
      if (d > -0.8 || d < -3.5) continue;
      if (lz > -26 && Math.abs(lx + 46.5) < 4) continue;          // the lane stays clear
      if (lz < -32.5 && Math.abs(lx + 46) < 6.5) continue;        // Mould Hall's front
      if (Math.abs(lx + 46) < 4.5) continue;                       // and its front walk
      if (Math.abs(lx + 39.5) < 2.8 && Math.abs(lz + 30) < 2.6) continue; // the blackboard
      if (sdSeg(lx, lz, [-37.5, -28.2, -46.6, -23], 1.6) < 0) continue; // Mödel's walk
      if (Math.abs(lx + 51.8) < 2.8 && lz > -32 && lz < -23.5) continue; // tea, and the view of it
      if (solid(lx, lz) || circles.some((c) => Math.hypot(c.x - lx, c.z - lz) < 1.6)) continue;
      mushroom(lx, lz, 0.8 + h01() * 0.9, CAPS[placed % CAPS.length]);
      placed++;
    }
  }
  // Professor Mödel: fedora, round spectacles, a scarf (it is cold; he checked)
  {
    const m = buildAnimal('mole', { body: 0x4a4038 });
    m.scale.setScalar(0.92);
    onHead(m, fedora(0x5a5248), 0.3);
    onHead(m, spectacles(), 0.08, 0.4);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 5, 10), mat(0x8a3a3a));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(0, 0.95, 0.3);
    m.add(scarf);
    walker(m, [[-42, -28.2], [-37.5, -28.2], [-42, -28.2], [-46.6, -23], [-47, -16], [-46.6, -23]], 0.8, { rest: 2.5, rate: 8, stopFor: 3 });
    talker(() => m.position, '뫼델 교수', 210, [
      '뫼델이오. 심층 연구소 교수. 악수를 못 하는 걸 용서하시오. 여긴 추워서. 항상 추워. 확인했소.',
      '충분히 깊은 모든 버로에는 참이지만 팔 수 없는 터널이 있음을 증명했소. 보어링 부에서 개인적으로 받아들였지.',
      '버로 칙허를 아주 꼼꼼히 읽었소. 4조에 결함이 있소. 제발, 내 청문회에서 언급하지 마시오.',
      '방정식의 어떤 해에선, 두더지가 자기 과거로 터널을 팔 수 있소. 시도해 보지 않았소. 내가 늦었다는 사실만 발견할 테니.',
      '연구소엔 학생도 수업도 없소. 우리 생각엔. 연구소(랩스)가 가장 어려운 질문을 내려보내면, 우린 더 좋은 질문을 돌려보내오. 질문들에게 아주 좋은 약속이오.',
      '매일 그 길을 걸었다 돌아오오. 내가 아주 존경하던 누군가가 함께 걷곤 했소. 이제 두 사람 몫을 걷소. 짧은 길이오. 충분하오.',
    ], 2.6);
  }
  // Professor Emerita Rosalind: a naked mole rat, tea at four, always four
  {
    const chair = new THREE.Group();
    const seat = box(1.2, 0.5, 1.0, 0x6a3a4a);
    seat.position.y = 0.25;
    const back = box(1.2, 1.1, 0.25, 0x6a3a4a);
    back.position.set(0, 0.8, -0.45);
    for (const sx of [-0.55, 0.55]) {
      const armr = box(0.18, 0.4, 1.0, 0x6a3a4a);
      armr.position.set(sx, 0.6, 0);
      chair.add(armr);
    }
    chair.add(seat, back);
    put(chair, -52.4, -29.6);
    const tea = new THREE.Group();
    const tbl = box(0.7, 0.6, 0.7, 0x8a6a44);
    tbl.position.y = 0.3;
    const pot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), mat(0xf3efe2, 0.4));
    pot.position.y = 0.76;
    tea.add(tbl, pot);
    put(tea, -51.1, -29.4);
    blockBox(-53.1, -30.3, -50.7, -29.0);
    const r = buildAnimal('molerat', { body: 0xf0b8a8 });
    r.scale.setScalar(0.85);
    sit(r);
    onHead(r, spectacles(), 0.06, 0.4);
    r.position.set(O.x - 52.4, at(-52.4, -29.6) + 0.42, O.z - 29.5);
    group.add(r);
    // the cup: from the table, up to her, a sip, and back down
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.1, 8), mat(0xf3efe2, 0.4));
    const rest = new THREE.Vector3(O.x - 50.9, at(-51.1, -29.4) + 0.66, O.z - 29.25);
    const lip = new THREE.Vector3(O.x - 52.25, r.position.y + 0.95, O.z - 28.95);
    cup.position.copy(rest);
    group.add(cup);
    const ph = h01() * 9;
    updates.push((dt, t) => {
      const c = (t + ph) % 12;
      const k = c < 1.2 ? c / 1.2 : c < 3 ? 1 : c < 4.2 ? 1 - (c - 3) / 1.2 : 0;
      cup.position.lerpVectors(rest, lip, smoothstep(0, 1, k));
      const head = r.userData.parts.head;
      head.rotation.x = c > 1.2 && c < 3 ? -0.25 : Math.sin(t * 0.6 + ph) * 0.06; // the sip; otherwise, a slow nod along with her thoughts
      r.rotation.y = Math.sin(t * 0.21 + ph) * 0.35 - 0.15;
      r.userData.parts.body.rotation.z = Math.sin(t * 0.5) * 0.04;
    });
    talker(() => r.position, '로잘린드 명예교수', 380, [
      '로잘린드. 명예교수. 너무 오래 명예교수라 케이크가 동났어.',
      '우리 벌거숭이두더지쥐는 늙지 않아, 얘야. 그냥 더 고참이 될 뿐. 연구소가 땅 구멍이던 때부터 고참이었어. 지금도 땅 구멍이야. 아주 저명한.',
      '뫼델은 버로 최고의 두뇌야. 내 차도 마시기 전에 확인해주지. 둘 다 사랑이야.',
      '차는 4시. 항상 4시야. 여긴 아무도 해를 본 적 없어서, 좋은 시간을 골라 지키기로 했어.',
      '칠판? 내가 “나 좀 봐”라고 썼어. 그가 보러 왔지. 우린 차를 마셨어. 증명은 그렇게 검증하는 거야.',
    ], 2.2);
  }

  // =========================================================== LOAM STREET ----
  // the Loamsworth Arms: four floors of round windows, stacked into the wall,
  // a green canopy out front, and Beaumont under it
  const APT = { x: -8, z: -10.2, w: 11, h: 9 };
  {
    frontage({ x: APT.x, z: APT.z, w: APT.w, h: APT.h, d: 6, color: 0x8a6448, trim: 0xd8c8a8, name: '', rows: 4, cols: 4, door: true, doorColor: 0x4a3020 });
    // the canopy, out to the curb, with the name on its front
    const canopy = box(1.6, 0.12, 3.0, 0x2e4a3a); // (narrow enough to clear the ground-floor portholes)
    put(canopy, APT.x, APT.z + 1.5, 2.75);
    const valance = sign('롬스워스 암스', 1.6, 0.3, '#2e4a3a', '#e8d49a');
    valance.position.set(O.x + APT.x, at(APT.x, APT.z) + 2.55, O.z + APT.z + 3.02);
    group.add(valance);
    for (const sx of [-0.74, 0.74]) {
      const pole = box(0.06, 2.75, 0.06, 0xc9a24a);
      put(pole, APT.x + sx, APT.z + 2.95, 1.37);
      block(APT.x + sx, APT.z + 2.95, 0.12);
    }
    const runner = box(1.1, 0.02, 2.9, 0x8a1f2a);
    put(runner, APT.x, APT.z + 1.5, 0.01);
    runner.castShadow = false;
    // little balconies, and a fire-escape ladder
    const rowY = (r) => 1.6 + r * ((APT.h - 0.75 - 0.2 - 1.6) / 3);
    for (let r = 1; r < 4; r++) {
      for (const c of [-1, 1]) {
        const ledge = box(1.3, 0.12, 0.6, 0x5a4230);
        put(ledge, APT.x + c * 4.125, APT.z + 0.3, rowY(r) - 0.6);
      }
    }
    for (let y = 0.5; y < 8.2; y += 0.45) {
      const rung = box(0.5, 0.05, 0.05, 0x3a3430);
      put(rung, APT.x + 5.0, APT.z + 0.35, y);
    }
    for (const sx of [-0.25, 0.25]) {
      const rail = box(0.05, 8, 0.05, 0x3a3430);
      put(rail, APT.x + 5.0 + sx, APT.z + 0.35, 4);
    }
    // laundry lines across the front
    const COLORS = [0xe8dcc0, 0xb8433a, 0x6a8ab8, 0xf2cf5b, 0x8ab87a, 0xf0b8c8];
    const shirts = [];
    for (const [y, z] of [[5.4, 1.2], [7.0, 0.8]]) {
      const lineM = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 0.02), mat(0xe8e0d0));
      lineM.position.set(O.x + APT.x, at(APT.x, APT.z) + y, O.z + APT.z + z);
      group.add(lineM);
      for (let k = 0; k < 7; k++) {
        const shirt = box(0.5 + h01() * 0.3, 0.55 + h01() * 0.3, 0.03, COLORS[(k + Math.round(y)) % COLORS.length]);
        shirt.geometry.translate(0, -0.3, 0);
        shirt.position.set(O.x + APT.x - 4.4 + k * 1.3, at(APT.x, APT.z) + y, O.z + APT.z + z);
        shirt.castShadow = true;
        group.add(shirt);
        shirts.push(shirt);
      }
    }
    updates.push((dt, t) => shirts.forEach((s, i) => { s.rotation.x = Math.sin(t * 0.9 + i) * 0.08; }));
    // Mrs. Loamsworth, leaning out of her second-floor window (the left one,
    // over the fire escape)
    const mrs = buildAnimal('mole', { body: 0x6a5a50 });
    mrs.scale.setScalar(0.75);
    const kerchief = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb8433a));
    onHead(mrs, kerchief, 0.12);
    const mx = APT.x + 0.5 * (APT.w / 4) - APT.w / 2;
    const my0 = at(APT.x, APT.z) + rowY(1) - 0.95;
    mrs.position.set(O.x + mx, my0, O.z + APT.z + 0.1);
    mrs.userData.noFidget = true;
    group.add(mrs);
    updates.push((dt, t, pp) => {
      if (pp) mrs.rotation.y = turnToward(mrs.rotation.y, Math.max(-0.8, Math.min(0.8, Math.atan2(pp.x - mrs.position.x, pp.z - mrs.position.z))), dt, 2);
      mrs.position.z = O.z + APT.z + 0.1 + Math.max(0, Math.sin(t * 0.4)) * 0.18; // leaning out further, for the good gossip
    });
    let k = 0;
    const lines = [
      '안녕, 아래! 버로 사람이 아니네. 고개를 들고 있어. 여긴 아무도 고개를 안 들어.',
      '2층, 엘리베이터 없음, 전망 없음, 대폭풍 이후 임대료 동결. 절대 안 나가.',
      '빨래가 마르는 데 한 9년 걸려, 여긴. 마르는 게 중요한 게 아냐. 널어놓는 게 중요한 거지.',
      '그 로웰 — 좋은 청년. 다리. 아무도 안 물어봐. 뭐, 나는 물어봐. “노코멘트”래. 매번. 아주 정중하게.',
      '2B 새 입주자 만났어? 소렐. 레코드 틀고. 살아있는 빵을 만들어. 사랑스러워. 좀 과해.',
    ];
    register({
      pos: new THREE.Vector3(O.x + mx, 0, O.z + APT.z + 1.4), r: 1.8, zone: 'burrough',
      label: '롬스워스 부인 불러보기',
      use: () => ui.say(lines[k++ % lines.length], { speaker: '롬스워스 부인', voice: 330 }),
    });
    // Beaumont: the doorman. burgundy coat, gold braid, top hat, white
    // gloves. extremely classy. he knows it; he's gracious about it.
    const bm = buildAnimal('mole', { body: 0x524640 });
    const coat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.53, 1), mat(0x6a1f2a));
    coat.scale.set(1.08, 1.0, 1.22);
    coat.position.y = 0.64;
    bm.add(coat);
    for (let q = 0; q < 3; q++) {
      const btn = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(0xe8c85a, 0.3));
      btn.position.set(0, 0.46 + q * 0.17, 0.63);
      bm.add(btn);
    }
    for (const sx of [-1, 1]) {
      const ep = box(0.2, 0.06, 0.22, 0xe8c85a);
      ep.position.set(sx * 0.42, 1.0, 0.05);
      bm.add(ep);
    }
    const bow = box(0.2, 0.08, 0.05, 0x1e1a18);
    bow.position.set(0, 0.95, 0.62);
    bm.add(bow);
    for (const leg of bm.userData.parts.legs) leg.children.forEach((c) => { c.material = mat(0xf7f5f0); }); // the gloves
    onHead(bm, topHat(), 0.34);
    stand(bm, APT.x + 1.6, APT.z + 1.6, 0.25);
    lively(bm, { look: 0.35, speed: 0.25 });
    talker(() => bm.position, '보몬트', 250, [
      '좋은 저녁이오. 롬스워스 암스에 오신 걸 환영하오. 카펫 조심하시오. 우리 둘보다 나이가 많고, 본인도 알고 있소.',
      '롬스워스 부인? 2층이오. 이미 당신이 온 걸 아시오. 나보다 먼저 아셨소.',
      '2B에 새 입주자가 왔소. 아주 예술적이오. 젖은 흙 냄새 양초를 태우지. 건물 전체가 젖은 흙 냄새요. 늘 그랬소. 소렐은 자기 건 다르다고 하오.',
      '들어가시오. 로비는 방문객에게 열려 있소. 엘리베이터는 고장이오. 대폭풍 이후로 고장이오. 보기에는 아주 좋은 엘리베이터요.',
    ]);
    doorway({ x: APT.x, z: APT.z + 1.0 }, 'burrough_arms', '롬스워스 암스 들어가기',
      () => ui.toast('보몬트가 문을 잡아줘요. “이쪽이오.”', '🎩'));
  }
  // the Daily Dirt
  const dirtDoor = frontage({ x: 7.5, z: -10.2, w: 7.5, h: 5.6, color: 0x5a4a3e, trim: 0xf3efe2, name: '데일리 더트', sub: '“파기에 적합한 모든 뉴스”', signBg: '#f3efe2', signFg: '#2e2a26', rows: 2, cols: 3 });
  doorway(dirtDoor, 'burrough_dirt', '데일리 더트 들어가기');
  // the front pages, one a day
  const FRONT_PAGES = [
    ['핫 웜 카트 “벌레 무첨가,” 판매자 주장', '윤리 담당 기자 “납득 불가.” 2면, 3면, 4면, 5면에 계속.'],
    ['웜 윤리: 41일차', '우리 기자 9,000단어 송고. 판매자는 한 단어 송고: “츄러스.”'],
    ['보어링 선 제시간 운행', '경영진 “충격.” 노조 “놀랍지 않다.” 운전수 “내버려 두길 바람.”'],
    ['연구소 교수, 무언가 증명', '뭔지는 아무도 모름. 교수 “만족.” 지면 안쪽: 큰 조수에 또 종소리 들려; 주민들 “놀랍지 않다,” “좋은 소리.”'],
    ['몰드카이 가 여전히 위층', '3대 남작 집권 중. 버로 “솔직히 괜찮음.” 도어맨 문 지켜.'],
    ['예보관 맑음 예보; 지상에는 우산 지참 권고', '마조리: “31년. 한 번도 맞은 적 없음. 그에 맞게 계획하시오.”'],
    ['다리: 누구 것?', '탐사 보도. 우리 기자는 인터뷰를 거절함. 우리 기자가 씀.'],
  ];
  const dayIdx = () => Math.floor(Date.now() / 86400000);
  {
    // the newsstand, with the paper in stacks
    const g = new THREE.Group();
    const stand2 = box(1.8, 1.0, 1.0, 0x3f7a5a);
    stand2.position.y = 0.5;
    const roof = box(2.1, 0.1, 1.3, 0x2f5a44);
    roof.position.y = 2.3;
    for (const sx of [-0.85, 0.85]) {
      const post = box(0.08, 1.3, 0.08, 0x2f5a44);
      post.position.set(sx, 1.65, 0.4);
      g.add(post);
    }
    for (let k = 0; k < 3; k++) {
      const stack = box(0.42, 0.14 + k * 0.05, 0.3, 0xf3efe2);
      stack.position.set(-0.55 + k * 0.55, 1.08, 0.15);
      g.add(stack);
    }
    const s = sign('데일리 더트 · 2🔘', 1.8, 0.3, '#f3efe2', '#2e2a26');
    s.position.set(0, 2.05, 0.46);
    g.add(stand2, roof, s);
    put(g, 13.2, -7.2);
    blockBox(12.2, -7.8, 14.2, -6.6);
    register({
      pos: new THREE.Vector3(O.x + 13.2, 0, O.z - 6.0), r: 1.6, zone: 'burrough',
      label: '오늘의 데일리 더트 읽기',
      use: () => {
        const [head, deck] = FRONT_PAGES[dayIdx() % FRONT_PAGES.length];
        ui.say(['데일리 더트 — “파기에 적합한 모든 뉴스”', head, deck]);
      },
    });
  }
  // Lowell: a worm, with legs, the ethics desk
  {
    const lw = buildAnimal('worm', { body: 0xe89a9a });
    const hat = fedora(0x6a5a48);
    hat.scale.setScalar(0.85);
    const card = sign('PRESS', 0.22, 0.12, '#f3efe2', '#2e2a26');
    card.position.set(0.18, 0.12, 0.22);
    hat.add(card);
    onHead(lw, hat, 0.3);
    const pad = box(0.25, 0.32, 0.04, 0xf3efe2);
    pad.position.set(0.32, 0.75, 1.15);
    pad.rotation.x = -0.4;
    lw.add(pad);
    walker(lw, [[10.6, -6.2], [3.2, -6.2], [10.6, -6.2], [9, -5.2]], 1.3, { rest: 3, rate: 14 });
    talker(() => lw.position, '로웰', 470, [
      '로웰이야. 데일리 더트 윤리 데스크. 윤리 데스크는 나야. 책상도 나야. 누워서 타자 쳐.',
      '“핫 웜.” 핫. 웜. 누굴 고발하는 건 아냐. 질문하는 거야. 매일. 같은 햄스터에게.',
      '닙스는 츄러스래. 하나 먹어봤어. 저널리즘을 위해. 아주 맛있는 츄러스였어. 그게 걱정되는 거야.',
      '다리? 노코멘트. 여기서 질문하는 쪽은 나야.',
      '여섯. 좋아. 여섯이야. 그래도 노코멘트.',
    ]);
  }
  // Nibs and the hot worm cart (contains no worms)
  {
    const g = new THREE.Group();
    const cart = box(1.6, 0.8, 0.9, 0xb8433a);
    cart.position.y = 0.75;
    const top = box(1.7, 0.08, 1.0, 0xe8dcc0);
    top.position.y = 1.19;
    g.add(cart, top);
    for (const sx of [-0.55, 0.55]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10), mat(0x3a3430));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.3, 0.48);
      g.add(wheel);
    }
    const pole = box(0.06, 1.6, 0.06, 0xe8dcc0);
    pole.position.set(0, 2.0, 0);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 8), mat(0xf2cf5b));
    umb.position.set(0, 2.9, 0);
    const umb2 = new THREE.Mesh(new THREE.ConeGeometry(1.21, 0.5, 8, 1, true, 0, Math.PI / 4), mat(0xb8433a));
    umb2.position.set(0, 2.9, 0);
    g.add(pole, umb, umb2);
    // a tray of hot worms (churros)
    for (let k = 0; k < 5; k++) {
      const churro = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 2, 5), mat(0xd8a050));
      churro.rotation.z = Math.PI / 2 + (k - 2) * 0.1;
      churro.position.set(-0.35 + k * 0.12, 1.27, 0.1);
      g.add(churro);
    }
    const s = sign('핫 웜 8🔘\n(벌레 무첨가)', 1.5, 0.5, '#f3e6c8', '#b8433a');
    s.position.set(0, 0.85, 0.46);
    g.add(s);
    put(g, 0.5, -6.4);
    blockBox(-0.4, -6.95, 1.4, -5.85);
    const nibs = buildAnimal('hamster', { body: 0xc88a50, belly: 0xf8f0e0 });
    onHead(nibs, flatCap(0xe8dcc0), 0.34);
    stand(nibs, 2.0, -6.7, -0.4);
    lively(nibs, { look: 0.7, speed: 0.6, bob: 0.04, hop: 0.12 }); // calling out to the street
    const lines = [
      '핫 웜! 핫 웜이요! 벌레 무첨가! 원래 그래! 카트에 두 군데나 써 있어!',
      '츄러스야. 튀긴 반죽, 시나몬, 길쭉하고 꿈틀한 모양. 우리 할머니가 핫 웜이라 불렀고 우리 할머니는 비전의 햄스터셨어.',
      '로웰이 매일 아침 노트 들고 와. 핫 웜 하나 주지. 적어. 먹어. 우리에겐 시스템이 있어.',
    ];
    let k = 0;
    register({
      getPos: () => nibs.position, r: 2.2, zone: 'burrough',
      label: '닙스와 대화하기',
      use: async () => {
        const choice = await ui.ask(lines[k++ % lines.length], [
          { label: '🥖 핫 웜 하나 주세요', value: 'buy', hint: '8🔘', disabled: S.state.buttons < 8 },
          { label: '그냥 구경 중', value: null },
        ], { speaker: '닙스', voice: 620 });
        if (choice !== 'buy' || !S.spend(8)) return;
        kaching();
        ui.updateHUD();
        ui.toast('핫 웜: 따뜻하고, 시나몬 향이고, 그리고 — 확인해 보니 — 완전히 벌레 없음.', '🥖');
      },
    });
  }
  // Thelonious Mole, on the corner, with his hat out
  {
    const th = buildAnimal('mole', { body: 0x524640 });
    onHead(th, beret(0x2a2a3a), 0.33);
    const shades = spectacles(0x1a1a1a);
    for (const sx of [-0.12, 0.12]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), mat(0x1a1a1a, 0.2));
      lens.position.set(sx, 0, 0.005);
      shades.add(lens);
    }
    onHead(th, shades, 0.08, 0.4);
    // the saxophone: a brass crook, body, and bell
    const sax = new THREE.Group();
    const brass = mat(0xd8a83a, 0.3);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 7), brass);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.09, 0.22, 8, 1, true), brass);
    bell.material.side = THREE.DoubleSide;
    bell.position.set(0, -0.38, 0.1);
    bell.rotation.x = -0.9;
    sax.add(tube, bell);
    sax.position.set(0.12, 0.85, 0.55);
    sax.rotation.x = 0.35;
    th.add(sax);
    stand(th, -14.5, -6.2, 0.35);
    th.userData.noFidget = true;
    const hat = fedora(0x2a2a3a);
    hat.rotation.x = Math.PI; // upside down, for buttons
    put(hat, -13.4, -5.1, 0.28);
    const coins = [];
    for (let k = 0; k < 6; k++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), mat(0xd8b85a, 0.3));
      coin.position.set(O.x - 13.4 + (h01() - 0.5) * 0.2, at(-13.4, -5.1) + 0.12, O.z - 5.1 + (h01() - 0.5) * 0.2);
      coin.visible = k < 3;
      group.add(coin);
      coins.push(coin);
    }
    updates.push((dt, t) => {
      // he sways; the horn swings with him
      th.rotation.z = Math.sin(t * 2.2) * 0.06;
      sax.rotation.x = 0.35 + Math.sin(t * 2.2 + 0.5) * 0.1;
      th.userData.parts.head.rotation.x = Math.sin(t * 4.4) * 0.05;
      const tips = Math.min(6, 3 + (S.state.flags.burroughTips || 0));
      coins.forEach((c, i) => { c.visible = i < tips; });
    });
    const lines = [
      '저녁이야. 여긴 항상 저녁이야. 그래서 음악이 좋은 거야.',
      '모자는 버튼을 받아. 모자는 신청곡도 받아. 난 안 받아. 근데 모자는 받아.',
      '전차가 몇 분마다 지나가. 딩딩. 난 전차 종 조성으로 연주해. 다른 종은 내 알 바 아냐.',
    ];
    let k = 0;
    register({
      getPos: () => th.position, r: 2.6, zone: 'burrough',
      label: '텔로니어스 몰 연주 듣기',
      use: async () => {
        const choice = await ui.ask(lines[k++ % lines.length], [
          { label: '🔘 모자에 버튼 넣기', value: 'tip', hint: '5🔘', disabled: S.state.buttons < 5 },
          { label: '그냥 듣기', value: null },
        ], { speaker: '텔로니어스 몰', voice: 200 });
        if (choice !== 'tip' || !S.spend(5)) return;
        S.state.flags.burroughTips = (S.state.flags.burroughTips || 0) + 1;
        S.save();
        jingle();
        ui.updateHUD();
        playSong('mind_the_gap', true);
        ui.say('고마워. 이 곡은 “틈새 주의”야.', { speaker: '텔로니어스 몰', voice: 200 });
      },
    });
  }
  // Marjorie, forecasting the surface weather from a soapbox, to a small
  // loyal crowd who shake their heads and come back tomorrow. never right.
  {
    const crate = box(1.1, 0.5, 0.8, 0x9a7a50);
    put(crate, -6.5, 3.2, 0.25);
    block(-6.5, 3.2, 0.7);
    const s = sign('지상 일기예보', 1.1, 0.24, '#f3e6c8', '#3a2a1c');
    s.position.set(O.x - 6.5, 0.26, O.z + 3.61);
    group.add(s);
    const mj = buildAnimal('groundhog', { body: 0x8a6440, head: 0x8a6440 });
    onHead(mj, flatCap(0x6a8ab8), 0.32);
    mj.position.set(O.x - 6.5, at(-6.5, 3.2) + 0.5, O.z + 3.2);
    mj.rotation.y = Math.PI * 0.9;
    group.add(mj);
    // she addresses one side of the crowd, then the other, with a little hop
    // on the big points
    lively(mj, { look: 0.9, speed: 0.45, bob: 0.05, hop: 0.18, face: 3.2 });
    const crowd = [
      { kind: 'mole', body: 0x5e5048, x: -8.3, z: 5.7 },
      { kind: 'hamster', body: 0xe8c8a0, x: -6.2, z: 6.0 },
      { kind: 'mole', body: 0x6a5a50, x: -4.6, z: 5.4 },
    ].map((c) => {
      const cr = buildAnimal(c.kind, { body: c.body, head: c.body });
      if (c.kind === 'mole') cr.scale.setScalar(0.85);
      stand(cr, c.x, c.z, Math.atan2(-6.5 - c.x, 3.2 - c.z));
      return cr;
    });
    const phs = crowd.map(() => h01() * 20);
    updates.push((dt, t) => crowd.forEach((cr, i) => {
      // a slow head-shake now and then: she's done it again
      const c = (t + phs[i]) % 9;
      const shake = c < 1.4 ? Math.sin(c * 14) * 0.25 * (1 - c / 1.4) : 0;
      cr.userData.parts.head.rotation.y = shake;
      cr.userData.parts.body.rotation.z = Math.sin(t * 0.7 + phs[i]) * 0.04;
    }));
    talker(() => crowd[0].position, '단골', 260, [
      '어제 맑다고 했어. 위엔 비 왔지. 난 어쨌든 우산 가져왔어. 마조리는 그렇게 쓰는 거야.',
      '31년째 다녀. 한 번도 맞은 적 없어. 그런 신뢰성은 어디에도 없어.',
    ], 1.8);
    const FORECAST = {
      clear: '오늘 지상은 비. 폭우. 코트, 우산, 그리고 첫 번째 우산을 위한 두 번째 우산을 가져가시오.',
      rain: '오늘 위는 화창! 구름 한 점 없음! 우산은 두고 가시오, 필요 없을 거요. 내 명성을 걸지.',
      snow: '오늘 지상은 따뜻. 해변 날씨. 샌들. 내 수염으로 느껴져.',
      fog: '오늘 위는 아주 맑음. 수 마일이 보일 거요. 수 마일!',
    };
    let k = 0;
    register({
      getPos: () => mj.position, r: 2.4, zone: 'burrough',
      label: '지상 일기예보 듣기',
      use: () => {
        const say = [
          FORECAST[currentWeather()] || FORECAST.clear,
          '31년. 한 번도 맞은 적 없지. 그게 날 뭐로 만드는 줄 아시오? 일관성. 날 기준으로 계획할 수 있소.',
          '매일 아침 내 그림자를 보오. 바로 저기 램프가 있거든. 저 위가 뭐든 6주 연장이라는 뜻이오.',
        ][k++ % 3];
        ui.say(say, { speaker: '마조리', voice: 300 });
      },
    });
  }
  // Burrough Electric: Spoke, in the wheel, powering every lamp in Midtown
  {
    const g = new THREE.Group();
    const R = 1.5;
    const frameM = mat(0x3a3430);
    for (const sx of [-0.55, 0.55]) {
      const leg = box(0.12, 2.2, 0.12, 0x3a3430);
      leg.position.set(0, 1.1, sx);
      g.add(leg);
    }
    const wheel = new THREE.Group();
    for (const sz of [-0.45, 0.45]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 4, 16), frameM);
      rim.position.z = sz;
      wheel.add(rim);
    }
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), mat(0xc9a24a, 0.4));
      rung.rotation.x = Math.PI / 2;
      rung.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      wheel.add(rung);
    }
    wheel.position.y = 2.0;
    g.add(wheel);
    const s = sign('버로 전기\n“미드타운의 모든 램프”', 1.8, 0.55, '#2e2a26', '#f2cf5b');
    s.position.set(0, 0.55, 0.62);
    g.add(s);
    put(g, 16.2, -8.4);
    g.rotation.y = 0.25;
    blockBox(14.4, -9.2, 18.0, -7.6);
    const spoke = buildAnimal('hamster', { body: 0xe8d0a8, belly: 0xfff8ec });
    spoke.rotation.y = Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(O.x + 16.2, at(16.2, -8.4) + 0.5, O.z - 8.4);
    holder.rotation.y = 0.25;
    holder.add(spoke);
    group.add(holder);
    updates.push((dt, t) => {
      wheel.rotation.z -= dt * 2.6;
      animateGait(spoke, t, 1, 16);
      const flick = 0.95 + Math.sin(t * 2.6 * 7) * 0.08;
      for (const b of lampBulbs) b.material.emissiveIntensity = 1.1 * flick;
    });
    talker(() => holder.position, '스포크', 700, [
      '버로 전기! 미드타운의 모든 램프! 나 혼자! 안 지쳐! 지쳐본 적 없어! 노력해봤어!',
      '램프가 깜빡이면, 그건 내가 손 흔드는 거야.',
      '경영진이 자꾸 햄스터 한 마리 더 주겠대. 왜 필요하냐고 하지. 그리고 한 바퀴 돌며 생각해. 그리고 또 한 바퀴.',
    ], 2.8);
  }
  lamp(-16.2, -7.6);
  lamp(4, -7.8);
  lamp(19.5, -5);
  lamp(-18, -5);
  lamp(8, 4.8);

  // ================================================================ UPTOWN ----
  const ritzDoor = frontage({ x: 55.5, z: -9.2, w: 9, h: 6.6, color: 0x6b4a3a, trim: 0xe8dcc0, name: '몰드카이 호텔', sub: '대폭풍 이전 창업', signBg: '#2e3a2a', signFg: '#e8d49a', rows: 3, cols: 4, doorColor: 0x2e3a2a });
  {
    // the stoop: three steps up to the door, with railings
    for (let s = 0; s < 3; s++) {
      const step = box(2.2 - s * 0.1, 0.15, 0.4, 0xb8ad98);
      put(step, 55.5, -8.0 + s * -0.35, 0.08 + s * 0.15);
      step.position.y = 0.075 + s * 0.15;
    }
    for (const sx of [-1.15, 1.15]) {
      const rail = box(0.06, 0.06, 1.3, 0x2a2a2a);
      put(rail, 55.5 + sx, -8.4, 0.95);
      rail.rotation.x = 0.35;
      const newel = box(0.1, 0.9, 0.1, 0x2a2a2a);
      put(newel, 55.5 + sx, -7.8, 0.45);
    }
    blockBox(54.2, -9.2, 56.8, -7.6);
    doorway({ x: 55.5, z: -7.0 }, 'burrough_ritz', '4층으로 올라가기',
      () => ui.toast('피츠제럴드가 허리 숙여 안내해요. “밴더버로 부인은 아무도 기다리지 않으십니다. 기뻐하실 겁니다.”', '🎩'));
    ritzDoor.z = -6.6;
    // brass lamps either side of the door
    for (const sx of [-1.8, 1.8]) {
      const lampB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), glow(0xffd98a, 1.0));
      lampB.position.set(O.x + 55.5 + sx, at(55.5, -9) + 2.1, O.z - 9.0);
      group.add(lampB);
    }
    const fitz = buildAnimal('mole', { body: 0x524640 });
    const coat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 1), mat(0x2e3a2a));
    coat.scale.set(1.06, 0.95, 1.2);
    coat.position.y = 0.62;
    fitz.add(coat);
    for (let k = 0; k < 3; k++) {
      const btn = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), mat(0xc9a24a, 0.3));
      btn.position.set(0, 0.45 + k * 0.17, 0.6);
      fitz.add(btn);
    }
    onHead(fitz, flatCap(0x2e3a2a), 0.34);
    stand(fitz, 57.6, -7.7, 0.2);
    lively(fitz, { look: 0.8, speed: 0.2 }); // up the street, down the street
    talker(() => fitz.position, '피츠제럴드', 240, [
      '좋은 저녁이오. 명단에 없으시오. 아무도 명단에 없소. 그래도 관리하오. 아주 좋은 명단이오.',
      '몰드카이 호텔. 버로 최고의 주소. 가족은 세 남작 전에 위로 올라갔소. 나는 그때부터 문을 지키오.',
      '할아버지는 저 위에서 시간당 청구로 재산을 모으셨소. 여기 아래에선 큰 조수 때 종소리가 들리오, 아시오? 암반을 통해. 저 위 누구도 우리에게 묻지 않았소.',
      '남작이 매년 겨울 카드를 보내오. “문을 지키시오.”라고. 그래서 문을 지키오.',
      '새끼들이 가끔 지하실 통해 놀러 오오. 현관을 열한 번 오르내리고 집에 가오. 내 한 해의 하이라이트요.',
      '올라가셔도 되오, 물론. 4층. 밴더버로 부인. 당신을 기다리지 않으시오. 누구도 기다리신 적 없고, 항상 기뻐하시오.',
    ]);
  }
  // Central Mulch: three mushrooms, a moss lawn, a bench
  {
    const moss = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.08, 10), mat(0x5f7a3a));
    put(moss, 44.5, -7.6, 0.02);
    moss.castShadow = false;
    mushroom(42.4, -9.2, 1.5, 0xc88a6a);
    mushroom(46.6, -9.6, 1.2, 0xe8d0b0);
    mushroom(44.2, -10.4, 1.8, 0xd8b89a);
    const bench = new THREE.Group();
    const seat = box(1.8, 0.1, 0.5, 0x6a4a30);
    seat.position.y = 0.45;
    const back = box(1.8, 0.45, 0.08, 0x6a4a30);
    back.position.set(0, 0.75, -0.22);
    bench.add(seat, back);
    for (const sx of [-0.8, 0.8]) {
      const leg = box(0.08, 0.45, 0.45, 0x2a2a2a);
      leg.position.set(sx, 0.22, 0);
      bench.add(leg);
    }
    put(bench, 44.5, -6.8);
    blockBox(43.5, -7.2, 45.5, -6.5);
    signPost(41.0, -6.0, '센트럴 멀치\n이끼 위로만 다니세요', 1.6, 0.55, '#2e3a2a', '#e8d49a');
    // on the bench: a retired groundhog, feeding the beetles
    const old = buildAnimal('groundhog', { body: 0x9a8a78, head: 0x9a8a78, belly: 0xd8ccbc });
    old.scale.setScalar(0.9);
    sit(old);
    old.position.set(O.x + 44.9, at(44.9, -6.8) + 0.4, O.z - 6.85);
    group.add(old);
    const beetles = [];
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), glow(0x3a6a8a, 0.15));
      b.scale.set(1, 0.6, 1.3);
      group.add(b);
      beetles.push({ m: b, a: h01() * 6, r: 0.8 + h01() * 0.8 });
    }
    updates.push((dt, t) => {
      for (const b of beetles) {
        b.a += dt * 0.5;
        const x = 44.9 + Math.cos(b.a) * b.r, z = -5.4 + Math.sin(b.a) * b.r * 0.5;
        b.m.position.set(O.x + x, at(x, z) + 0.06, O.z + z);
        b.m.rotation.y = -b.a;
      }
      // he leans down to the beetles, and back
      const c = t % 8;
      old.userData.parts.head.rotation.x = c < 2 ? Math.sin((c / 2) * Math.PI) * 0.45 : 0;
      old.rotation.y = Math.sin(t * 0.25) * 0.3;
    });
    talker(() => old.position, '홀리스 씨', 200, [
      '딱정벌레들이 날 알아. 이 벤치에서 40년. 내 이름은 몰라. 부스러기를 알지.',
      '업타운은 예전엔 몰드카이 가뿐이었어. 지금은 몰드카이 건물과, 그 외 모두. 이게 더 나아.',
      '나도 예보관이었어. 마조리 전에. 매번 맞았지. 들으러 오는 사람은 없었어. 사랑받고 싶으면, 자신 있게 틀려.',
    ], 2.4);
  }
  lamp(48, -4.8);
  lamp(61, -4.8);
  lamp(52, 3.4);

  // ========================================================== the rooms ----
  // Walk-in rooms, dollhouse-style for the camera: a floor, a back wall and
  // two side walls, the front open. Each is its own interior zone.
  function room(key, { floor, wall, trim, name, tall = 4.4 }) {
    const R = ROOMS[key];
    const zone = `burrough_${key}`;
    const g = new THREE.Group();
    g.name = zone;
    group.add(g);
    const P = (obj, lx, lz, y = 0) => {
      obj.position.set(R.x + lx, y, R.z + lz);
      shade(obj);
      g.add(obj);
      return obj;
    };
    const fl = box(R.w, 0.2, R.d, floor);
    fl.castShadow = false;
    P(fl, 0, 0, -0.1);
    const back = box(R.w + 0.6, tall, 0.3, wall);
    P(back, 0, -R.d / 2 - 0.15, tall / 2);
    for (const sx of [-1, 1]) P(box(0.3, tall, R.d, wall), sx * (R.w / 2 + 0.15), 0, tall / 2);
    P(box(R.w, 0.25, 0.08, trim), 0, -R.d / 2 + 0.04, 0.12);
    P(box(R.w, 0.25, 0.2, trim), 0, R.d / 2 + 0.1, 0.12);
    const rm = { R, zone, g, P, blockers: [], updates: [] };
    roomRoots[zone] = g;
    roomUpdates[zone] = rm.updates;
    addZonePlace(zone, name);
    return rm;
  }
  function finishRoom(rm, outside, { lighting } = {}) {
    const { R } = rm;
    zones.registerInterior(rm.zone, {
      root: rm.g,
      floorY: 0,
      bounds: { x0: R.x - R.w / 2 + 0.5, x1: R.x + R.w / 2 - 0.5, z0: R.z - R.d / 2 + 0.5, z1: R.z + R.d / 2 - 0.3 },
      blockers: rm.blockers,
      spawn: { x: R.x, z: R.z + R.d / 2 - 1.0, rotY: Math.PI },
      lighting: {
        bg: 0x1d140d, fog: 0x1d140d, fogNear: 30, fogFar: 80,
        hemiSky: 0xffe2b8, hemiGround: 0x5a4028, hemiIntensity: 1.15,
        sunIntensity: 0.7, sunPos: [R.x - 8, 30, R.z + 16], sunTarget: [R.x, 0, R.z],
        ...lighting,
      },
    });
    register({
      pos: new THREE.Vector3(R.x, 0, R.z + R.d / 2 - 0.4), r: 1.6, zone: rm.zone, priority: 2,
      label: '거리로 다시 나가기',
      use: () => zones.go('burrough', { ...W(outside.x, outside.z + 0.4), rotY: 0 }),
    });
    // a doormat, so you can find the way out
    const mat2 = box(1.6, 0.03, 0.9, 0x6a4a30);
    mat2.castShadow = false;
    rm.P(mat2, 0, R.d / 2 - 0.55, 0.02);
  }
  // furniture kit, in room-local coordinates
  function furnish(rm) {
    const { P, blockers, R } = rm;
    const solidBox = (lx, lz, w, d) => blockers.push({ x: R.x + lx, z: R.z + lz, w, d });
    const solidDisc = (lx, lz, r) => blockers.push({ x: R.x + lx, z: R.z + lz, r });
    return {
      desk(lx, lz, w = 1.8, d = 0.9, color = 0x8a6a44) {
        const g = new THREE.Group();
        const top = box(w, 0.1, d, color);
        top.position.y = 0.8;
        g.add(top);
        for (const sx of [-1, 1]) {
          const side = box(0.1, 0.8, d, color);
          side.position.set(sx * (w / 2 - 0.05), 0.4, 0);
          g.add(side);
        }
        P(g, lx, lz);
        solidBox(lx, lz, w, d);
        return g;
      },
      typewriter(lx, lz, y = 0.85) {
        const g = new THREE.Group();
        const body = box(0.55, 0.16, 0.4, 0x2e3a32);
        body.position.y = 0.08;
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), mat(0x1e1a18));
        roller.rotation.z = Math.PI / 2;
        roller.position.set(0, 0.2, -0.12);
        const page = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.36), mat(0xf7f5f0));
        page.position.set(0, 0.38, -0.14);
        page.rotation.x = -0.2;
        g.add(body, roller, page);
        P(g, lx, lz, y);
        return g;
      },
      shelf(lx, lz, w = 3, h = 3, rows = 4) {
        const g = new THREE.Group();
        const back = box(w, h, 0.4, 0x6a4a30);
        back.position.y = h / 2;
        g.add(back);
        const BOOKS = [0xb8433a, 0x3f7a5a, 0x2e4a6a, 0xd8a03a, 0x6a3a5a, 0xe8dcc0, 0x5a6a3a];
        for (let r = 0; r < rows; r++) {
          let x = -w / 2 + 0.15;
          while (x < w / 2 - 0.2) {
            const bw = 0.08 + h01() * 0.1, bh = 0.35 + h01() * 0.25;
            const book = box(bw, bh, 0.3, BOOKS[Math.floor(h01() * BOOKS.length)]);
            book.position.set(x + bw / 2, 0.15 + r * (h / rows) + bh / 2, 0.22);
            g.add(book);
            x += bw + 0.02;
          }
        }
        P(g, lx, lz);
        solidBox(lx, lz, w, 0.6);
        return g;
      },
      chair(lx, lz, ry = 0, color = 0x6a3a4a) {
        const g = new THREE.Group();
        const seat = box(1.0, 0.45, 0.9, color);
        seat.position.y = 0.22;
        const back = box(1.0, 1.0, 0.22, color);
        back.position.set(0, 0.7, -0.4);
        for (const sx of [-0.45, 0.45]) {
          const arm = box(0.14, 0.35, 0.9, color);
          arm.position.set(sx, 0.55, 0);
          g.add(arm);
        }
        g.add(seat, back);
        g.rotation.y = ry;
        P(g, lx, lz);
        solidDisc(lx, lz, 0.6);
        return g;
      },
      rug(lx, lz, w, d, color) {
        const r = box(w, 0.03, d, color);
        r.castShadow = false;
        P(r, lx, lz, 0.015);
        return r;
      },
      plant(lx, lz, s = 1) {
        const g = new THREE.Group();
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.2 * s, 0.45 * s, 8), mat(0xb86a4a));
        pot.position.y = 0.22 * s;
        g.add(pot);
        for (let k = 0; k < 6; k++) {
          const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 * s, 0), mat(0x4a7a3a));
          leaf.scale.set(0.5, 1, 0.25);
          const a = (k / 6) * Math.PI * 2;
          leaf.position.set(Math.cos(a) * 0.2 * s, 0.75 * s + (k % 2) * 0.25 * s, Math.sin(a) * 0.2 * s);
          leaf.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
          g.add(leaf);
        }
        P(g, lx, lz);
        solidDisc(lx, lz, 0.3 * s);
        return g;
      },
      wallSign(lx, y, text, w, h, bg, fg, opts) {
        const s = sign(text, w, h, bg, fg, opts);
        P(s, lx, -R.d / 2 + 0.02, y);
        return s;
      },
      critter(kind, colors, lx, lz, ry = 0, lift = 0, block = true) {
        const c = buildAnimal(kind, colors);
        c.position.set(R.x + lx, lift, R.z + lz);
        c.rotation.y = ry;
        rm.g.add(c);
        if (block) solidDisc(lx, lz, 0.45);
        return c;
      },
      solidBox, solidDisc,
    };
  }
  const worldPos = (rm, lx, lz) => new THREE.Vector3(rm.R.x + lx, 0, rm.R.z + lz);

  // ---------------------------------------------- inside Local 1 ----
  {
    const rm = room('local1', { floor: 0x7a6048, wall: 0x9a7a58, trim: 0xf2cf5b, name: '⛏️ 보어링 부 1지부' });
    const F = furnish(rm);
    const { P, R } = rm;
    F.rug(0, 1.2, 5, 3, 0x6a4a3a);
    F.wallSign(0, 3.6, '보어링 부 · 1지부', 5, 0.6, '#2e2a26', '#f2cf5b');
    // the front desk: Doris, the forms, the candy dish, a TAKE A NUMBER
    // machine with no numbers in it
    F.desk(-3.2, -0.6, 2.6, 1.0, 0x8a5a3a);
    F.typewriter(-3.8, -0.7);
    for (let k = 0; k < 4; k++) P(box(0.4, 0.05 + k * 0.03, 0.3, 0xf3efe2), -2.1 - (k % 2) * 0.05, -0.8, 0.88 + k * 0.08);
    const dish = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide }));
    bowl.position.y = 0.22;
    dish.add(bowl);
    const CANDY = [0xe84a4a, 0xf2cf5b, 0x8ad86a, 0xf0a0c8, 0xd8a050];
    for (let k = 0; k < 9; k++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), glow(CANDY[k % CANDY.length], 0.15));
      c.position.set((h01() - 0.5) * 0.24, 0.1 + h01() * 0.08, (h01() - 0.5) * 0.24);
      dish.add(c);
    }
    P(dish, -2.9, -0.35, 0.85);
    const numbers = new THREE.Group();
    const nb = box(0.3, 0.4, 0.25, 0xb8433a);
    nb.position.y = 0.2;
    numbers.add(nb);
    P(numbers, -4.3, -0.3, 0.85);
    F.wallSign(-3.2, 2.4, '번호표를 뽑으세요\n(번호표 다 떨어짐)', 2.2, 0.6, '#f3efe2', '#b8433a');
    const doris = F.critter('mole', { body: 0x6a5a50 }, -3.2, -1.7, 0);
    doris.scale.setScalar(0.9);
    onHead(doris, spectacles(0x8a3a5a, 0.085), 0.08, 0.4);
    const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0x3a302a));
    onHead(doris, bun, 0.36, -0.12);
    // the sigh: a long slow sag, and back
    rm.updates.push((dt, t, pp) => {
      const c = t % 9;
      const sag = c < 2.4 ? Math.sin((c / 2.4) * Math.PI) : 0;
      doris.userData.parts.body.scale.y = doris.userData.parts.body.userData.sy ??= doris.userData.parts.body.scale.y;
      doris.userData.parts.body.scale.y *= 1 - sag * 0.08;
      doris.userData.parts.head.rotation.x = sag * 0.3;
      if (pp) doris.rotation.y = turnToward(doris.rotation.y, Math.atan2(pp.x - doris.position.x, pp.z - doris.position.z) * 0.6, dt, 2);
    });
    doris.userData.noFidget = true;
    let dk = 0;
    const DORIS = [
      '1지부. 도와드릴까요. 아니라고 해 주세요.',
      '번호표 뽑으세요. 번호표 없어요. 대신 사탕 드세요. 대기는 똑같아요.',
      '터널 하나에 서류 11년. 10년은 내가 했어요. 나머지 1년은 버사가 했고, 아직도 그 얘길 해요.',
      '15분 때문에 오셨다면, 15분이에요. 웬델 때문에 오셨다면, 웬델이 어디 있는지 몰라요. 아무도 몰라요. 웬델은 해변에 있어요.',
      '27-B 양식은 27-A 양식을 요청하는 양식이에요. 27-A 양식은 저와 면담을 요청하는 양식이고요. 둘 다 필요해요.',
    ];
    register({
      getPos: () => doris.position, r: 2.2, zone: rm.zone, label: '도리스와 대화하기',
      use: () => ui.say(DORIS[dk++ % DORIS.length], { speaker: '도리스', voice: 290 }),
    });
    let ck = 0;
    register({
      pos: worldPos(rm, -2.9, 0.6), r: 1.4, zone: rm.zone, priority: 2, label: '딱딱한 사탕 하나 가져가기',
      use: () => {
        const flavor = ['버터스카치', '체리', '라임', '분홍색 무언가', '루트비어'][ck % 5];
        ui.say([
          '하나 드세요. 두 개 드세요. 접시째 드세요. 양식만 달라고 하지 마세요.',
          '좋아요. 하나 드세요.',
          '대폭풍 때 거예요. 괜찮아요. 딱딱한 사탕은 영원해요.',
        ][ck++ % 3], { speaker: '도리스', voice: 290 });
        ui.toast(`딱딱한 사탕: ${flavor}, 터널보다 오래됐지만 여전히 완벽해요.`, '🍬');
      },
    });
    // the union corner: a bulletin board, a photo, the water cooler
    F.wallSign(-6.4, 2.2, '1지부 게시판\n• 15분 휴식: 쟁취\n• 웬델: 휴식 중\n• 바자회: 화요일', 2.2, 1.5, '#c8a878', '#2e2a26', { weight: 600, align: 'left' });
    F.wallSign(-3.6, 3.4, '우리가 판 그날 밤\n(사진: 매우 어두움)', 1.3, 0.9, '#1a1410', '#e8dcc0', { border: '#8a6a44', weight: 600 });
    {
      const cooler = new THREE.Group();
      const baseC = box(0.5, 1.0, 0.5, 0xe8e8e0);
      baseC.position.y = 0.5;
      const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.6, roughness: 0.1 }));
      jug.position.y = 1.25;
      cooler.add(baseC, jug);
      P(cooler, -7.2, -4.2);
      F.solidDisc(-7.2, -4.2, 0.4);
    }
    // IT: one terminal, a rack of blinking lights, and Ping
    {
      F.desk(4.6, -3.6, 2.4, 1.0, 0x5a5a5a);
      const term = new THREE.Group();
      const crt = box(0.8, 0.7, 0.7, 0xd8d0b8);
      crt.position.y = 0.35;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), glow(0x5aff8a, 0.6));
      screen.position.set(0, 0.38, 0.36);
      term.add(crt, screen);
      P(term, 4.4, -3.8, 0.85);
      const rack = box(1.0, 2.6, 0.7, 0x3a3a3a);
      P(rack, 6.8, -4.3, 1.3);
      F.solidBox(6.8, -4.3, 1.0, 0.7);
      const leds = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 3; c++) {
        const led = new THREE.Mesh(new THREE.CircleGeometry(0.035, 6), glow([0x5aff8a, 0xffc85a, 0xff5a5a][(r + c) % 3], 1.2));
        P(led, 6.55 + c * 0.25, -3.94, 0.5 + r * 0.26);
        leds.push(led);
      }
      rm.updates.push((dt, t) => leds.forEach((l, i) => { l.visible = Math.sin(t * (2 + (i % 5)) + i * 1.7) > -0.3; }));
      // cables, everywhere, on purpose
      for (let k = 0; k < 5; k++) {
        const cable = new THREE.Mesh(new THREE.TorusGeometry(0.35 + k * 0.08, 0.025, 4, 12, Math.PI), mat([0x2a2a2a, 0xb8433a, 0x2e4a8a][k % 3]));
        cable.rotation.x = Math.PI / 2;
        P(cable, 5.8 + k * 0.1, -3.2, 0.03);
      }
      F.wallSign(4.6, 2.6, '전산실\n메워 보고\n다시 파 봤어?', 2.4, 0.9, '#2e2a26', '#5aff8a', { weight: 600 });
      const ping = F.critter('hamster', { body: 0xb8906a }, 4.4, -2.5, Math.PI);
      const hs = headphones();
      hs.scale.setScalar(0.8);
      onHead(ping, hs, 0.1);
      onHead(ping, spectacles(0x2a2a2a, 0.09), 0.06, 0.4);
      rm.updates.push((dt, t, pp) => {
        ping.userData.parts.head.rotation.x = 0.15 + Math.max(0, Math.sin(t * 9)) * 0.05; // typing, typing
        ping.rotation.y = pp && Math.hypot(pp.x - ping.position.x, pp.z - ping.position.z) < 2.6
          ? turnToward(ping.rotation.y, Math.atan2(pp.x - ping.position.x, pp.z - ping.position.z), dt, 3)
          : turnToward(ping.rotation.y, Math.PI, dt, 3);
      });
      ping.userData.noFidget = true;
      talker(() => ping.position, '핑', 660, [
        '전산이에요. 터널을 껐다 켜 보셨어요?',
        '보어링 선 전체가 이 단말기 하나로 돌아가요. 만지지 마. 나도 안 만져. 그냥 지켜봐.',
        '연구소의 에이다가 발로 짠 메모리를 보내줬어요. 아름다운 작품. 무서워. 서랍에 넣어뒀어. 웅웅거려.',
        '다 괜찮아. 불이 깜빡여. 깜빡이는 건 괜찮아. 깜빡임이 멈출 때가 문제야.',
      ], 2.2, rm.zone);
    }
    // the engineers at the chalkboard, planning the west
    {
      const board = new THREE.Group();
      const slate = box(4.2, 2.0, 0.1, 0x2e3a32);
      slate.position.y = 2.0;
      const frame = box(4.4, 2.2, 0.06, 0x8a6a44);
      frame.position.set(0, 2.0, -0.05);
      const chalk = sign('A안: 파기 →\nB안: 파기 ←\nC안: 파기 ↓ (버사에게 문의)\n     서   쪽   ═══════════ ? ', 4.0, 1.8, '#2e3a32', '#e8efe8', { weight: 500, align: 'left' });
      chalk.position.set(0, 2.0, 0.06);
      board.add(slate, frame, chalk);
      P(board, 0.6, -4.7);
      const gauge = F.critter('mole', { body: 0x5a4a44 }, -0.2, -3.3, Math.PI);
      onHead(gauge, hardHat(), 0.3);
      const plumb = F.critter('mole', { body: 0x6a5a50 }, 1.6, -3.1, Math.PI + 0.3);
      onHead(plumb, hardHat(), 0.3);
      onHead(plumb, spectacles(), 0.08, 0.4);
      rm.updates.push((dt, t) => {
        // one explains, one considers; now and then they swap
        const swap = Math.floor(t / 7) % 2;
        const [talk, think] = swap ? [plumb, gauge] : [gauge, plumb];
        talk.userData.parts.head.rotation.x = Math.sin(t * 6) * 0.12;
        talk.rotation.y = Math.PI + Math.sin(t * 1.3) * 0.4;
        think.userData.parts.head.rotation.x = 0.1;
        think.userData.parts.head.rotation.z = Math.sin(t * 0.4) * 0.2; // the head-tilt of an engineer who has concerns
        think.rotation.y = Math.PI + (think === plumb ? 0.3 : -0.2);
      });
      gauge.userData.noFidget = plumb.userData.noFidget = true;
      talker(() => gauge.position, '게이지', 260, [
        '게이지. 엔지니어링. 연장을 계획 중이야. 서쪽. 그리고 더 서쪽. 대부분 서쪽의 문제야.',
        '두 번 재고 한 번 파. 그리고 한 번 더 파, 첫 번째가 아주 잘 팠거든.',
      ], 1.8, rm.zone);
      talker(() => plumb.position, '플럼', 300, [
        '플럼. 이쪽도 엔지니어링. 교수는 터널이 끝남을 증명할 수 없대. 좋아. 고용 안정.',
        'C안은 버사 거야. C안은 말 안 해. C안은 그냥 “아래로.”',
      ], 1.8, rm.zone);
    }
    // filing cabinets, full of the eleven years
    for (let k = 0; k < 3; k++) {
      const cab = box(0.8, 1.5, 0.7, 0x7a8a7a);
      P(cab, -5.2 + k * 0.85, -4.4, 0.75);
      for (let d = 0; d < 3; d++) P(box(0.5, 0.05, 0.02, 0xc9a24a), -5.2 + k * 0.85, -4.04, 0.35 + d * 0.45);
    }
    F.solidBox(-4.35, -4.4, 2.6, 0.7);
    finishRoom(rm, local1Door);
  }

  // ---------------------------------------------- inside Mould Hall ----
  {
    const rm = room('mould', { floor: 0x6a3a2a, wall: 0xe8dcc8, trim: 0xf3efe2, name: '🎓 몰드 홀' });
    const F = furnish(rm);
    const { P } = rm;
    F.rug(0, 0, 8, 5, 0x3a4a5a);
    F.wallSign(0, 3.9, '심층 연구소', 5, 0.45, '#e8dcc8', '#6a2a20', { weight: 700 });
    // the fireplace, with a fire that doesn't need the sky
    {
      const g = new THREE.Group();
      const surround = box(2.6, 2.0, 0.6, 0xb8ad98);
      surround.position.y = 1.0;
      const hearth = box(1.6, 1.2, 0.3, 0x1a1410);
      hearth.position.set(0, 0.6, 0.18);
      const mantle = box(3.0, 0.14, 0.8, 0x8a6a44);
      mantle.position.y = 2.05;
      g.add(surround, hearth, mantle);
      P(g, 0, -4.7);
      F.solidBox(0, -4.5, 3.0, 1.0);
      const flames = [0xffa040, 0xffd060, 0xff7030].map((c, i) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.04, 0.6 - i * 0.1, 5), glow(c, 1.6));
        P(f, -0.25 + i * 0.25, -4.3, 0.35);
        return f;
      });
      rm.updates.push((dt, t) => flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * (7 + i * 2) + i) * 0.2; }));
      const portrait = sign('A. 몰\n창립자\n“여기서 팠고,\n여기서 생각했다”', 1.1, 1.3, '#4a3a2a', '#e8d49a', { border: '#c9a24a', weight: 600 });
      P(portrait, 0, -4.84, 3.0);
    }
    F.shelf(-4.8, -4.6, 3.6, 3.2, 4);
    F.shelf(4.8, -4.6, 3.6, 3.2, 4);
    // the armchairs by the fire, and the fellows in them
    F.chair(-1.9, -2.4, 0.5, 0x6a3a4a);
    F.chair(1.9, -2.4, -0.5, 0x3a5a4a);
    const fen = F.critter('hamster', { body: 0xd8b080 }, -1.9, -2.35, 0.5, 0.35, false);
    sit(fen);
    onHead(fen, spectacles(0x2a2a2a, 0.09), 0.06, 0.4);
    const pell = F.critter('groundhog', { body: 0x8a6a4a, head: 0x8a6a4a }, 1.9, -2.35, -0.5, 0.35, false);
    sit(pell);
    const book = box(0.5, 0.06, 0.4, 0xb8433a);
    pell.userData.parts.head.add(book);
    book.position.set(0, 0.18, 0.3);
    book.rotation.x = -0.9; // on his face, asleep under it
    rm.updates.push((dt, t) => {
      // Fennimore: chin on paw, thinking so hard he rocks a little
      fen.userData.parts.head.rotation.x = 0.15 + Math.sin(t * 0.5) * 0.08;
      fen.userData.parts.head.rotation.z = Math.sin(t * 0.23) * 0.12;
      // Pell: breathing, deeply, under the book
      pell.userData.parts.body.scale.y = 1.05 * (1 + Math.sin(t * 1.1) * 0.06);
    });
    talker(() => fen.position, '페니모어 박사', 560, [
      '쉿. 생각 중이야. 화요일부터 생각 중이야. 알려줄게.',
      '내가 생각하고 있는지에 대해 생각하고 있어. 지금까지: 응. 초기 단계야.',
      '펠? 펠도 생각 중이야. 펠은 눈 감고 얼굴에 책을 올리고 생각해. 그것도 방법이야.',
    ], 2.0, rm.zone);
    register({
      getPos: () => pell.position, r: 2.0, zone: rm.zone, label: '펠 박사 들여다보기',
      use: () => ui.say('쿨. …증명은… …에… 쿨.', { speaker: '펠 박사', voice: 180 }),
    });
    // the reading table, with green-shaded lamps and the open books
    F.desk(0, 1.4, 3.6, 1.2, 0x5a3a2a);
    for (const sx of [-1.2, 1.2]) {
      const stem = box(0.05, 0.4, 0.05, 0xc9a24a);
      P(stem, sx, 1.2, 1.05);
      const shadeL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.14, 8), glow(0x3a8a5a, 0.6));
      P(shadeL, sx, 1.2, 1.28);
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.4), mat(0xf7f5f0));
      P(page, sx * 0.4, 1.5, 0.87);
    }
    F.wallSign(-4.8, 3.65, '정숙\n(생각 진행 중)', 1.4, 0.6, '#e8dcc8', '#6a2a20', { border: '#6a2a20' });
    // the tea urn, always hot, always four
    {
      const urn = new THREE.Group();
      const tbl = box(1.2, 0.8, 0.6, 0x8a6a44);
      tbl.position.y = 0.4;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.55, 10), mat(0xc9a24a, 0.3));
      body.position.y = 1.08;
      urn.add(tbl, body);
      P(urn, 6.6, -1.4);
      F.solidBox(6.6, -1.4, 1.2, 0.6);
      register({
        pos: worldPos(rm, 6.0, -0.4), r: 1.3, zone: rm.zone, label: '차 한 잔 따르기',
        use: () => ui.toast('연구소 주전자의 차. 컵 안은 정확히 4시예요.', '🫖'),
      });
    }
    // the visitors' book
    {
      const stand = box(0.5, 1.0, 0.5, 0x5a3a2a);
      P(stand, -6.4, 1.8, 0.5);
      P(box(0.6, 0.06, 0.45, 0xf3efe2), -6.4, 1.8, 1.04);
      F.solidDisc(-6.4, 1.8, 0.35);
      let vk = 0;
      register({
        pos: worldPos(rm, -6.4, 2.8), r: 1.3, zone: rm.zone, label: '방명록 읽기',
        use: () => ui.say([
          ['방명록. 최근 기록:', '“낫벨 연구소 — 가장 어려운 질문을 가져왔다. 더 어려운 걸 들고 떠남. 10/10. —S.”', '“모닥불 좋음 —통근자”'],
          ['“생각하러 옴. 생각함. 추천. —헤이즐 박사”', '“차는 항상 4시인가요? —방문객” 그리고 아래에, 아주 오래된 필적으로: “응. —R.”'],
        ][vk++ % 2]),
      });
    }
    finishRoom(rm, mouldDoor, { lighting: { hemiSky: 0xffe0c0, hemiIntensity: 1.1 } });
  }

  // ------------------------------------ inside the Loamsworth Arms ----
  // left: the lobby. middle: the hall, apartment doors, the famous elevator.
  // right, through a door in the partition: 2B, where Sorrel lives.
  {
    const rm = room('arms', { floor: 0x5a3a2a, wall: 0xc8b89a, trim: 0xd8c8a8, name: '🏢 롬스워스 암스' });
    const F = furnish(rm);
    const { P, R } = rm;
    // the lobby floor, black and white tiles
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const t = box(0.9, 0.02, 1.1, (i + j) % 2 ? 0x2a2420 : 0xf3efe2);
      t.castShadow = false;
      P(t, -10.6 + 0.45 + i * 0.9, -R.d / 2 + 0.55 + j * 1.1, 0.01);
    }
    F.wallSign(-7, 3.8, '롬스워스 암스 · 대폭풍 이전 창업', 5, 0.4, '#2e4a3a', '#e8d49a');
    // brass mailboxes
    {
      const mb = new THREE.Group();
      const back = box(2.2, 1.6, 0.3, 0xc9a24a);
      back.position.y = 1.6;
      mb.add(back);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        const slot = box(0.34, 0.26, 0.04, 0x8a6a2a);
        slot.position.set(-0.85 + c * 0.42, 1.0 + r * 0.38, 0.16);
        mb.add(slot);
      }
      P(mb, -9.3, -4.75);
    }
    // the elevator: very nice to look at
    {
      const doors = new THREE.Group();
      for (const sx of [-0.45, 0.45]) {
        const d = box(0.88, 2.4, 0.1, 0xb8a060);
        d.position.set(sx, 1.2, 0);
        doors.add(d);
      }
      const frame = box(2.2, 2.9, 0.08, 0x6a4a2a);
      frame.position.set(0, 1.45, -0.06);
      doors.add(frame);
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12, 0, Math.PI), mat(0xc9a24a, 0.3));
      dial.position.set(0, 2.55, 0.06);
      doors.add(dial);
      P(doors, -5.7, -4.9);
      F.wallSign(-5.7, 0.9, '고장\n(대폭풍 이후)', 0.9, 0.4, '#f3efe2', '#b8433a');
      let ek = 0;
      register({
        pos: worldPos(rm, -5.7, -3.6), r: 1.3, zone: rm.zone, label: '엘리베이터 버튼 누르기',
        use: () => ui.say([
          '띵. 아무 일도 없어요. 문 위 작은 화살표가 아주 우아하게 아무것도 가리키지 않아요.',
          '띵. 멀리 위에서 기계적인 무언가가 한숨 쉬어요. 문은 엄청난 위엄으로 닫혀 있어요.',
        ][ek++ % 2]),
      });
    }
    F.plant(-10.0, -1.2, 1.3);
    // a bench for waiting on the elevator (forever)
    {
      const bench = box(1.6, 0.45, 0.5, 0x5a3a2a);
      P(bench, -8.4, -1.4, 0.22);
      F.solidBox(-8.4, -1.4, 1.6, 0.5);
    }
    // the hall: a red runner, three doors, a radiator, a hall lamp
    F.rug(-0.8, 0, 3.2, R.d - 1.2, 0x8a1f2a);
    for (const [k, dx] of [['1A', -3.4], ['1B', -0.8], ['1C', 1.6]]) {
      const door = box(1.1, 2.2, 0.1, 0x4a3020);
      P(door, dx, -4.93, 1.1);
      const num = sign(k, 0.35, 0.22, '#c9a24a', '#2e2a1c');
      P(num, dx, -4.86, 1.9);
      const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0xc9a24a, 0.3));
      P(knob, dx + 0.35, -4.86, 1.05);
    }
    {
      const rad = new THREE.Group();
      for (let k = 0; k < 8; k++) {
        const fin = box(0.08, 0.7, 0.3, 0xd8d0c0);
        fin.position.set(-0.35 + k * 0.1, 0.45, 0);
        rad.add(fin);
      }
      P(rad, -2.1, -4.7);
      rm.updates.push((dt, t) => { rad.position.y = Math.max(0, Math.sin(t * 17)) * 0.004 * (t % 11 < 1 ? 1 : 0); }); // clank
    }
    // the partition between the hall and 2B, with a doorway in it
    const PX = 3.2;
    P(box(0.2, 3.4, 5.2, 0xc8b89a), PX, -2.4, 1.7);
    P(box(0.2, 3.4, 1.4, 0xc8b89a), PX, 4.3, 1.7);
    P(box(0.2, 0.9, 2.2, 0xc8b89a), PX, 2.5, 2.95);  // over the doorway
    const plate = sign('2B', 0.35, 0.22, '#c9a24a', '#2e2a1c');
    plate.position.set(R.x + PX - 0.12, 2.2, R.z + 1.1);
    plate.rotation.y = -Math.PI / 2;
    rm.g.add(plate);
    rm.blockers.push({ x: R.x + PX, z: R.z - 2.4, w: 0.3, d: 5.2 }, { x: R.x + PX, z: R.z + 4.3, w: 0.3, d: 1.4 });
    // 2B: the dirt wall is ORIGINAL. edison bulbs, a record player, plants
    // in macramé, a bike on the wall, a jar of sourdough starter named Gerald
    {
      const AX = 7.1; // the middle of the apartment
      F.rug(AX, 0.4, 4.2, 3.2, 0xd8a86a);
      // the exposed dirt, in strata, framed like it's art (it is, to Sorrel)
      const STR = [0x6b4a32, 0x8a6a4a, 0x5e4230, 0x9a7a58];
      for (let k = 0; k < 6; k++) P(box(7.4, 0.6, 0.06, STR[k % 4]), AX, -4.93, 0.4 + k * 0.62);
      const neon = sign('롬 스위트 롬', 2.0, 0.4, '#1a1014', '#ff8ac8', { weight: 600 });
      neon.material.color.set(0xffffff);
      P(neon, AX, -4.85, 3.2);
      // edison bulbs on long cords
      const bulbs = [];
      for (const bx of [-2.4, -0.8, 0.8, 2.4]) {
        const cord = box(0.02, 1.4, 0.02, 0x2a2a2a);
        P(cord, AX + bx, -1.2 + (bx % 2), 3.7);
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), glow(0xffb050, 1.4));
        P(b, AX + bx, -1.2 + (bx % 2), 2.95);
        bulbs.push(b);
      }
      rm.updates.push((dt, t) => bulbs.forEach((b, i) => { b.material.emissiveIntensity = 1.3 + Math.sin(t * 3 + i * 2) * 0.1; }));
      // the record player on a crate of records, spinning
      const crate = box(1.0, 0.7, 0.7, 0xb88a5a);
      P(crate, AX + 2.6, -3.9, 0.35);
      F.solidBox(AX + 2.6, -3.9, 1.0, 0.7);
      for (let k = 0; k < 8; k++) P(box(0.03, 0.55, 0.55, [0x2a2a2a, 0xb8433a, 0x3f7a5a, 0xd8a03a][k % 4]), AX + 2.25 + k * 0.08, -3.9, 0.38);
      const tt = box(0.8, 0.12, 0.6, 0x5a3a2a);
      P(tt, AX + 2.6, -3.9, 0.76);
      const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16), mat(0x1a1a1a, 0.3));
      P(vinyl, AX + 2.5, -3.9, 0.84);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 10), mat(0xff8ac8));
      P(label, AX + 2.5, -3.9, 0.845);
      rm.updates.push((dt) => { vinyl.rotation.y += dt * 3.5; label.rotation.y += dt * 3.5; });
      register({
        pos: worldPos(rm, AX + 2.6, -2.8), r: 1.3, zone: rm.zone, label: '레코드 틀기',
        use: () => {
          playSong(['mind_the_gap', 'foggy_lullaby', 'button_bossa'][Math.floor(Math.random() * 3)], true);
          ui.toast('지직. 씨익. 음악. “더 따뜻하게 들리잖아,” 방 건너편에서 소렐이 고개 들지 않고 말해요.', '🎶');
        },
      });
      // the bike, hung on the wall like a painting
      {
        const bike = new THREE.Group();
        for (const sx of [-0.55, 0.55]) {
          const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 4, 14), mat(0x2a2a2a));
          wheel.position.x = sx;
          bike.add(wheel);
        }
        const frame = box(1.1, 0.06, 0.04, 0x3f8a7a);
        frame.position.y = 0.18;
        const bar = box(0.06, 0.4, 0.04, 0x3f8a7a);
        bar.position.set(0.4, 0.35, 0);
        bike.add(frame, bar);
        P(bike, AX - 2.4, -4.8, 2.3);
      }
      // plants: in pots, and in macramé from the ceiling
      F.plant(AX - 3.1, -3.9, 1.5);
      F.plant(AX + 3.3, 1.8, 1.1);
      for (const hx of [-1.4, 1.6]) {
        const rope = box(0.02, 1.1, 0.02, 0xe8d8b8);
        P(rope, AX + hx, -3.4, 3.4);
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), mat(0xe8d8b8));
        P(pot, AX + hx, -3.4, 2.7);
        for (let k = 0; k < 5; k++) {
          const vine = box(0.05, 0.5 + h01() * 0.4, 0.05, 0x4a7a3a);
          P(vine, AX + hx + (h01() - 0.5) * 0.3, -3.4 + (h01() - 0.5) * 0.3, 2.3);
        }
      }
      // the kitchen counter: Gerald, the kombucha, a pour-over
      {
        const counter = box(2.4, 0.9, 0.7, 0xe8dcc8);
        P(counter, AX - 1.2, -4.3, 0.45);
        F.solidBox(AX - 1.2, -4.3, 2.4, 0.7);
        const gerald = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 10), new THREE.MeshStandardMaterial({ color: 0xf0e8d0, transparent: true, opacity: 0.8, roughness: 0.2 }));
        P(gerald, AX - 2.0, -4.3, 1.06);
        const tag = sign('제럴드', 0.25, 0.1, '#f3efe2', '#2e2a26');
        P(tag, AX - 2.0, -4.14, 1.06);
        for (let k = 0; k < 2; k++) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.36, 10), new THREE.MeshStandardMaterial({ color: 0xd89a4a, transparent: true, opacity: 0.7, roughness: 0.2 }));
          P(jar, AX - 1.3 + k * 0.3, -4.35, 1.08);
        }
        const pour = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), mat(0xf3efe2));
        pour.rotation.x = Math.PI;
        P(pour, AX - 0.4, -4.3, 1.12);
        let gk = 0;
        register({
          pos: worldPos(rm, AX - 1.8, -3.2), r: 1.2, zone: rm.zone, label: '제럴드에게 인사하기',
          use: () => ui.say([
            '제럴드라고 붙은 사워도우 스타터 병. 만족스럽게 부글거려요. 어쩐지 당신을 보고 있어요.',
            '제럴드가 살짝 트림해요. 조리대 위 정갈한 글씨의 쪽지: “오전 9시 먹임, 오후 9시 먹임, 잘하고 있다고 말해줌.”',
          ][gk++ % 2]),
        });
      }
      // a low couch and a typewriter on a crate
      {
        const couch = new THREE.Group();
        const seat = box(2.4, 0.4, 0.9, 0x3f6a7a);
        seat.position.y = 0.2;
        const back = box(2.4, 0.6, 0.25, 0x3f6a7a);
        back.position.set(0, 0.6, 0.45);
        couch.add(seat, back);
        P(couch, AX, 2.8);
        F.solidBox(AX, 2.8, 2.4, 1.1);
      }
      const tcrate = box(0.7, 0.6, 0.5, 0xb88a5a);
      P(tcrate, AX + 0.2, -1.0, 0.3);
      F.solidBox(AX + 0.2, -1.0, 0.7, 0.5);
      F.typewriter(AX + 0.2, -1.0, 0.62);
      // Sorrel: beanie, big round glasses, very much on purpose
      const sorrel = F.critter('hamster', { body: 0xc8a888, belly: 0xf3ead8 }, AX - 0.6, 0.6, 0.3);
      onHead(sorrel, beanie(0xd8703a), 0.3);
      onHead(sorrel, spectacles(0x2a2a2a, 0.11), 0.05, 0.42);
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 5, 10), mat(0x7a8a4a));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0, 0.95, 0.25);
      sorrel.add(scarf);
      lively(sorrel, { list: rm.updates, look: 0.6, speed: 0.4, bob: 0.03 }); // nodding along to the record
      talker(() => sorrel.position, '소렐', 520, [
        '오, 안녕. 신발 신어도 돼. 바닥이 흙이야. 바닥은 원래 흙이었어. 오리지널이야.',
        '나는 버로가 지하로 가기 전부터 버로에 빠져 있었어.',
        '저건 제럴드. 내 스타터. 아홉 살. 아주 잘 지내. 솔직히 나보다 잘 지내고, 자랑스러워.',
        '모든 건 바이닐로 들으면 더 좋아. 레코드도 흙이야. 모든 게 흙이야. 하나의 미학이지.',
        '텔로니어스? 그가 저 모퉁이에 서기 전에 봤어. 다른 모퉁이였어. 더 작은 모퉁이. 더 좋았어.',
        '양초? “젖은 흙.” 알아. 건물 전체가 젖은 흙 냄새지. 내 건 달라. 내 건 의도적이야.',
      ], 2.2, rm.zone);
      // a candle, intentional
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8), mat(0x8a6a4a));
      P(candle, AX + 0.45, -1.1, 0.72);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 5), glow(0xffc050, 1.6));
      P(flame, AX + 0.45, -1.1, 0.86);
      rm.updates.push((dt, t) => { flame.scale.y = 1 + Math.sin(t * 13) * 0.2; });
    }
    finishRoom(rm, { x: APT.x, z: APT.z + 1.0 }, { lighting: { hemiSky: 0xffe8c8, hemiIntensity: 1.2 } });
  }

  // ------------------------------------------- inside the Daily Dirt ----
  {
    const rm = room('dirt', { floor: 0x6a5a4a, wall: 0xd8d0c0, trim: 0xf3efe2, name: '🗞️ 데일리 더트' });
    const F = furnish(rm);
    const { P, R } = rm;
    F.wallSign(-2, 3.8, '데일리 더트 · “파기에 적합한 모든 뉴스”', 6.5, 0.45, '#f3efe2', '#2e2a26');
    F.wallSign(-6.6, 2.4, '오늘:\n핫 웜 (여전히)\n전차: 제시간\n종: 들림 (좋음)', 2.0, 1.4, '#2e3a32', '#e8efe8', { weight: 500, align: 'left' });
    // the newsroom: desks, typewriters, reporters typing like the Squall is
    // coming back
    const reporters = [];
    const DESKS = [
      { x: -5.4, z: -1.2, kind: 'mole', body: 0x5e5048, hat: () => visor(), name: '부고 데스크', lines: [
        '부고. 대폭풍 이후 아무도 안 죽었어. 은퇴 얘길 써. 아주 감동적이야. 1지부 포트럭에서 안 운 사람이 없었어.',
        '다음 주: 파기를 그만둔 두더지에 대한 아주 긴 기사. 걔는 잘 지내. 정원 가꿔. 가슴 아파.',
      ] },
      { x: -2.4, z: -1.2, kind: 'hamster', body: 0xd8a068, hat: () => flatCap(0x4a5a6a), name: '스포츠 데스크', lines: [
        '스포츠. 유일한 종목은 보어링 선이 제시간에 오는가야. 그에 걸맞은 열기로 취재해.',
        '오늘 밤 빅매치. 전차 대 시계. 전차에 느낌이 와.',
      ] },
      { x: -5.4, z: 1.4, kind: 'groundhog', body: 0x8a6a4a, hat: () => beret(0x3a3a4a), name: '크로스워드 데스크', lines: [
        '크로스워드. 세로 7번: “구멍, 단 두더지용,” 여섯 글자. BURROW. 항상 burrow야. 9천 개째 풀었어. 항상 burrow야.',
        '한 번은 “하늘”이란 단어를 넣어봤어. 항의 편지가 왔어. 아주 화난 편지들. 본 사람이 없거든.',
      ] },
      { x: -2.4, z: 1.4, kind: 'mole', body: 0x6a5a50, hat: () => fedora(0x5a4a3a), name: '문화 데스크', lines: [
        '문화. 이번 주: 리틀 데스크 세션은 버로에서 가장 아늑한 공연장인가? 응. 책상이거든.',
        '텔로니어스 몰을 한 번 평론했어. 별 다섯. 그가 읽고 “오케이”라고 했어. 내 경력 최고의 날.',
      ] },
    ];
    for (const d of DESKS) {
      F.desk(d.x, d.z, 1.8, 0.9, 0x8a6a44);
      F.typewriter(d.x, d.z - 0.1);
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.13, 8), mat([0xb8433a, 0xf3efe2, 0x3f7a5a][reporters.length % 3]));
      P(mug, d.x + 0.6, d.z, 0.92);
      const c = F.critter(d.kind, { body: d.body, head: d.body }, d.x, d.z + 0.95, Math.PI, 0, true);
      if (d.kind === 'mole') c.scale.setScalar(0.9);
      onHead(c, d.hat(), 0.32);
      c.userData.noFidget = true;
      reporters.push(c);
      talker(() => c.position, d.name, 280 + reporters.length * 50, d.lines, 1.6, rm.zone);
    }
    let clack = 0;
    rm.updates.push((dt, t, pp) => {
      reporters.forEach((c, i) => {
        const burst = Math.sin(t * 0.7 + i * 1.9) > -0.2; // type, type, type… stop, think… type
        c.userData.parts.head.rotation.x = 0.2 + (burst ? Math.max(0, Math.sin(t * 14 + i)) * 0.07 : -0.1);
        c.rotation.y = Math.PI + (burst ? 0 : Math.sin(t * 0.8 + i) * 0.4);
      });
      clack -= dt;
      if (clack <= 0 && pp && pp.x < R.x + 1) {
        clack = 0.07 + Math.random() * 0.18;
        tone(1800 + Math.random() * 600, { dur: 0.015, type: 'square', vol: 0.006 });
      }
    });
    // the coffee: a percolator the size of a small mole, and a sign
    {
      const g = new THREE.Group();
      const tbl = box(1.6, 0.85, 0.7, 0x5a4a3a);
      tbl.position.y = 0.42;
      const perc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.75, 10), mat(0xb8b8b0, 0.3));
      perc.position.set(-0.3, 1.23, 0);
      const light = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), glow(0xff5a3a, 1.6));
      light.position.set(-0.3, 1.0, 0.27);
      g.add(tbl, perc, light);
      for (let k = 0; k < 4; k++) {
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.13, 8), mat([0xf3efe2, 0xb8433a, 0x3f7a5a, 0xd8a03a][k]));
        mug.position.set(0.2 + (k % 2) * 0.2, 0.92 + Math.floor(k / 2) * 0.14, (k % 2) * 0.1);
        g.add(mug);
      }
      P(g, -8.6, -4.4);
      F.solidBox(-8.6, -4.4, 1.6, 0.7);
      F.wallSign(-8.6, 2.0, '커피는\n언론 자유 문제다', 1.4, 0.6, '#f3efe2', '#b8433a', { weight: 700 });
      register({
        pos: worldPos(rm, -8.6, -3.3), r: 1.3, zone: rm.zone, label: '편집국 커피 따르기',
        use: () => ui.toast('편집국 커피: 뜨겁고, 검고, 마감 맛이 은은해요.', '☕'),
      });
    }
    // the editor's glass office, back right-of-center
    {
      const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.25, roughness: 0.1 });
      const front = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 0.06), glass);
      P(front, 1.6, -2.5, 1.3);
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 2.9), glass);
      P(side, -0.1, -3.95, 1.3);
      P(box(3.4, 0.08, 0.1, 0x3a3430), 1.6, -2.5, 2.62);
      const plaque = sign('편집장', 0.8, 0.22, '#f3efe2', '#2e2a26');
      P(plaque, 1.6, -2.45, 2.2);
      rm.blockers.push({ x: R.x + 1.6, z: R.z - 3.8, w: 3.5, d: 2.8 });
      F.desk(1.6, -3.55, 2.0, 0.9, 0x5a3a2a);
      const mudge = F.critter('groundhog', { body: 0x7a5a3a, head: 0x7a5a3a }, 1.6, -4.75, 0, 0, false);
      onHead(mudge, visor(0x3a8a5a), 0.3);
      rm.updates.push((dt, t) => {
        // pacing behind the desk, as editors do
        mudge.position.x = R.x + 1.6 + Math.sin(t * 0.5) * 0.9;
        mudge.rotation.y = Math.cos(t * 0.5) > 0 ? Math.PI / 2 : -Math.PI / 2;
        animateGait(mudge, t, 0.6, 8);
      });
      mudge.userData.noFidget = true;
      let ek = 0;
      register({
        pos: worldPos(rm, 1.6, -1.6), r: 1.8, zone: rm.zone, label: '편집장 유리 노크하기',
        use: () => ui.say([
          '로웰! 내 기사— 어. 로웰이 아니네. 로웰 말곤 아무도 로웰이 아니지. 로웰 보면 전해, 9천 단어는 책이라고.',
          '머지. 편집장. 40년. 핫 웜 기사를 1년 내내 매일 실었고 내일도 실을 거야, 팔리니까.',
          '우리는 진실한 것, 다정한 것, 그리고 들어맞는 걸 싣는다. 그 순서로. 핫 웜 기사는 셋 다야. 그래서 핫 웜 기사인 거야.',
        ][ek++ % 3], { speaker: '머지', voice: 190 }),
      });
    }
    // TUNNEL VISION: the podcast, in a padded corner, ON AIR
    {
      const PXc = 7.2;
      for (const [w, lx, lz] of [[3.6, PXc, -4.9], [0.1, PXc - 1.8, -3.6]]) P(box(w, 2.8, w > 1 ? 0.1 : 2.6, 0x3a3a4a), lx, lz, 1.4);
      for (let k = 0; k < 6; k++) P(box(0.5, 0.5, 0.08, 0x5a5a6a), PXc - 1.2 + (k % 3) * 0.7, -4.82, 1.0 + Math.floor(k / 3) * 0.8); // the foam
      F.desk(PXc, -3.6, 2.0, 0.9, 0x3a3430);
      rm.blockers.push({ x: R.x + PXc - 1.8, z: R.z - 3.6, w: 0.2, d: 2.6 });
      const onAir = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), glow(0xff3a3a, 0.4));
      P(onAir, PXc, -4.82, 2.5);
      const onAirTxt = sign('생방송', 0.9, 0.3, '#ff3a3a', '#fff3f3');
      P(onAirTxt, PXc, -4.8, 2.5);
      const titleT = sign('터널 비전\n공간과 공간 사이의 공간에 대한 팟캐스트', 2.6, 0.5, '#2a2a3a', '#f2cf5b');
      P(titleT, PXc, -4.8, 3.2);
      // the mic on its boom arm, and the host
      const boom = box(0.04, 0.04, 0.9, 0x2a2a2a);
      boom.rotation.x = 0.5;
      P(boom, PXc - 0.3, -3.5, 1.3);
      const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 3, 8), mat(0x3a3a3a, 0.3));
      P(mic, PXc - 0.3, -3.1, 1.12);
      const dex = F.critter('mole', { body: 0x5a4e48 }, PXc - 0.3, -2.4, Math.PI);
      onHead(dex, beanie(0x3a3a4a), 0.28);
      onHead(dex, spectacles(0x2a2a2a, 0.09), 0.08, 0.4);
      const hs = headphones();
      onHead(dex, hs, 0.12);
      dex.userData.noFidget = true;
      rm.updates.push((dt, t) => {
        // talking, with his whole body, the way you do on a podcast
        dex.userData.parts.head.rotation.x = Math.sin(t * 7) * 0.08 + 0.1;
        dex.rotation.y = Math.PI + Math.sin(t * 0.9) * 0.25;
        dex.userData.parts.body.rotation.z = Math.sin(t * 1.3) * 0.07;
        onAir.material.emissiveIntensity = 0.9 + Math.sin(t * 2) * 0.3;
      });
      let pk = 0;
      register({
        getPos: () => dex.position, r: 2.0, zone: rm.zone, label: '터널 비전 엿듣기',
        use: () => ui.say([
          '터널 비전, 공간과 공간 사이의 공간에 대한 팟캐스트에 다시 오신 걸 환영합니다. 오늘: 구멍은 사물인가, 사물의 부재인가? 게스트는 구멍입니다. 힘든 인터뷰였어요.',
          '터널 비전은 핫 웜 카트와 함께합니다. 벌레 무첨가. 코드 DIG를 입력하면 아무것도 없습니다. 코드는 없습니다. 있던 적도 없습니다.',
          '잠깐 곱씹어 보죠. …… 네. 긴 1초였네요. 편집하죠. 편집하지 마죠.',
          '지난주 한 청취자가 보내왔습니다: “버로 위엔 뭐가 있나요?” 좋은 질문. 9부작 시리즈를 준비 중입니다. 1부는 그냥 제가 위를 쳐다봅니다.',
          '오 — 스튜디오에 게스트. 안녕하세요. 지금 방송 중이에요. 흙에 대해 뭐라고 해 보세요. …완벽해요. 오늘 회차 끝.',
        ][pk++ % 5], { speaker: '덱스', voice: 300 }),
      });
    }
    // the LITTLE DESK SESSIONS: a desk, bookshelves behind, a trio squeezed in
    {
      const LX = 5.2, LZ = 2.2;
      F.shelf(LX, LZ - 1.5, 3.4, 2.2, 3);
      F.desk(LX, LZ - 0.5, 2.6, 0.8, 0x8a6a44);
      const tag = sign('리틀 데스크 세션', 1.8, 0.3, '#b8433a', '#f3efe2');
      P(tag, LX, LZ - 1.27, 2.4); // on top of the shelves, over the band's heads
      // the band: upright bass (a mole), ukulele (a hamster), brushes (a groundhog)
      const bassist = F.critter('mole', { body: 0x4e4540 }, LX - 1.0, LZ + 0.3, Math.PI * 0.95, 0, true);
      const bass = new THREE.Group();
      const bbody = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), mat(0x8a4a2a));
      bbody.scale.set(0.8, 1.3, 0.35);
      const neck = box(0.06, 0.9, 0.06, 0x3a2418);
      neck.position.y = 0.8;
      bass.add(bbody, neck);
      bass.position.set(0.25, 0.7, 0.55);
      bassist.add(bass);
      const uke = F.critter('hamster', { body: 0xe8c89a }, LX + 0.1, LZ + 0.4, Math.PI, 0, true);
      onHead(uke, beanie(0x5a8a6a), 0.3);
      const ukeB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xd8a050));
      ukeB.scale.set(1, 1.3, 0.4);
      ukeB.position.set(0.1, 0.62, 0.5);
      ukeB.rotation.z = -0.7;
      uke.add(ukeB);
      const drum = F.critter('groundhog', { body: 0x9a7a58, head: 0x9a7a58 }, LX + 1.2, LZ + 0.2, Math.PI * 1.05, 0, true);
      onHead(drum, flatCap(0x3a3a4a), 0.32);
      const snare = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12), mat(0xe8e0d0));
      snare.position.set(0, 0.6, 0.6);
      drum.add(snare);
      const band = [bassist, uke, drum];
      band.forEach((b) => { b.userData.noFidget = true; });
      let playing = 0;
      rm.updates.push((dt, t) => {
        playing = Math.max(0, playing - dt);
        const k = playing > 0 ? 1 : 0.35;
        band.forEach((b, i) => {
          b.userData.parts.head.rotation.x = Math.sin(t * (4 + i) + i) * 0.1 * k;
          b.userData.parts.body.rotation.z = Math.sin(t * 2.2 + i * 1.3) * 0.06 * k;
        });
        bass.rotation.z = Math.sin(t * 2.2) * 0.05 * k;
      });
      let sk = 0;
      register({
        pos: worldPos(rm, LX, LZ + 1.9), r: 1.6, zone: rm.zone, label: '리틀 데스크 세션 듣기',
        use: () => {
          playing = 14;
          const song = ['foggy_lullaby', 'button_bossa', 'tidepool_stomp'][sk % 3];
          playSong(song, true);
          ui.say([
            '안녕하세요, 롬 레인저스예요. 이 곡은 아주 조용해요. 구멍에 대한 거예요. 책상에 불러줘서 고마워요.',
            '다음 곡은 보어링 선에서, 롬 스트리트와 업타운 사이에서 썼어요. 90초짜리예요. 그 구간도 그래요.',
            '자, 마지막 곡. 스톰프예요. 발 구르진 말아 주세요. 책상이 하중을 지탱 중이거든요.',
          ][sk++ % 3], { speaker: '롬 레인저스', voice: 480 });
        },
      });
    }
    // a ticker, spitting out the wire
    {
      const tk = box(0.7, 0.9, 0.5, 0x7a8a7a);
      P(tk, -8.8, 1.8, 0.45);
      F.solidBox(-8.8, 1.8, 0.7, 0.5);
      const tape = box(0.3, 0.02, 1.2, 0xf7f5f0);
      P(tape, -8.8, 2.4, 0.9);
      rm.updates.push((dt, t) => { tape.scale.z = 0.6 + ((t * 0.1) % 1) * 0.8; tape.position.z = R.z + 2.1 + tape.scale.z * 0.5; });
    }
    finishRoom(rm, dirtDoor);
  }

  // --------------------------- inside the Moledecai: the fourth floor ----
  // Mrs. Vanderburrow's. marble, a chandelier, a grand piano, a painting of
  // the sky (artist's impression), vintage dew, and Pomme, a pill bug.
  {
    const rm = room('ritz', { floor: 0xe8e0d0, wall: 0x2e4a3a, trim: 0xc9a24a, name: '🎩 몰드카이 호텔 · 4층', tall: 4.8 });
    const F = furnish(rm);
    const { P, R } = rm;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) {
      const t = box(1.9, 0.02, 1.9, (i + j) % 2 ? 0xf3efe8 : 0xb8b0a8);
      t.castShadow = false;
      P(t, -R.w / 2 + 1.0 + i * 2.0, -R.d / 2 + 1.0 + j * 2.0, 0.01);
    }
    for (let k = 0; k < 6; k++) P(box(0.12, 4.6, 0.1, 0xc9a24a), -7.5 + k * 3, -4.93, 2.3); // gilt pilasters
    // the chandelier
    {
      const g = new THREE.Group();
      const chain = box(0.04, 1.0, 0.04, 0xc9a24a);
      chain.position.y = 0.5;
      g.add(chain);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 4, 16), mat(0xc9a24a, 0.3));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const drops = [];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), glow(0xfff4d8, 1.2));
        drop.position.set(Math.cos(a) * 0.8, -0.22, Math.sin(a) * 0.8);
        drop.scale.y = 1.6;
        g.add(drop);
        drops.push(drop);
      }
      const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), glow(0xfff4d8, 1.4));
      heart.position.y = -0.35;
      g.add(heart);
      P(g, 0, -0.5, 3.6);
      rm.updates.push((dt, t) => { g.rotation.y = Math.sin(t * 0.3) * 0.1; drops.forEach((d, i) => { d.material.emissiveIntensity = 1.1 + Math.sin(t * 2 + i) * 0.2; }); });
    }
    // the grand piano
    {
      const g = new THREE.Group();
      const body = box(1.8, 0.35, 1.3, 0x14110f);
      body.position.y = 0.95;
      const lid = box(1.7, 0.04, 1.2, 0x14110f);
      lid.position.set(0.1, 1.45, -0.25);
      lid.rotation.x = -0.5;
      const keys = box(1.5, 0.05, 0.25, 0xf3efe8);
      keys.position.set(0, 1.05, 0.72);
      g.add(body, lid, keys);
      for (const [lx, lz] of [[-0.75, 0.5], [0.75, 0.5], [0, -0.5]]) {
        const leg = box(0.1, 0.8, 0.1, 0x14110f);
        leg.position.set(lx, 0.4, lz);
        g.add(leg);
      }
      P(g, -5.2, -2.6);
      F.solidBox(-5.2, -2.6, 1.9, 1.4);
      const bench = box(0.9, 0.5, 0.4, 0x14110f);
      P(bench, -5.2, -1.4, 0.25);
      F.solidBox(-5.2, -1.4, 0.9, 0.4);
      register({
        pos: worldPos(rm, -5.2, -0.6), r: 1.3, zone: rm.zone, label: '그랜드 피아노 연주하기',
        use: () => {
          playSong('button_bossa', true);
          ui.say('오, 브라보! 브라보! 남작의 할아버지 이후로 그 곡을 친 사람이 없었어요. 그분도 그 한 곡만 아셨죠, 바로 그 곡.', { speaker: '밴더버로 부인', voice: 360 });
        },
      });
    }
    // the painting of the sky, in a gilt frame
    {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 160;
      const c = cv.getContext('2d');
      const grad = c.createLinearGradient(0, 0, 0, 160);
      grad.addColorStop(0, '#6fb8e8'); grad.addColorStop(1, '#cfeaf8');
      c.fillStyle = grad; c.fillRect(0, 0, 256, 160);
      c.fillStyle = '#ffe070'; c.beginPath(); c.arc(190, 50, 22, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      for (const [x, y] of [[60, 60], [90, 52], [120, 64]]) { c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.fill(); }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const frame = box(2.8, 1.9, 0.08, 0xc9a24a);
      P(frame, 1.6, -4.92, 2.5);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.6), new THREE.MeshBasicMaterial({ map: tex }));
      P(art, 1.6, -4.86, 2.5);
      const tag = sign('“하늘” (화가의 상상)', 1.4, 0.18, '#c9a24a', '#2e2a1c');
      P(tag, 1.6, -4.86, 1.35);
      let sk = 0;
      register({
        pos: worldPos(rm, 1.6, -3.6), r: 1.5, zone: rm.zone, label: '그림 감상하기',
        use: () => ui.say([
          '저게 하늘이에요, 달링. 화가의 상상. 거금을 줬어요. 아주 정확하대요. 파랗대요.',
          '동그란 노란 게 “해”예요. 화가 말로는 너무 밝아서 볼 수 없대요. 그럼 어떻게 그렸냐고 했죠. 그는 떠났어요.',
        ][sk++ % 2], { speaker: '밴더버로 부인', voice: 360 }),
      });
    }
    // the champagne tower (vintage dew), a gilded mirror, a palm
    {
      const g = new THREE.Group();
      const tbl = box(1.2, 0.8, 0.8, 0xe8dcc8);
      tbl.position.y = 0.4;
      g.add(tbl);
      const glassM = new THREE.MeshStandardMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.55, roughness: 0.1 });
      for (let tier = 0; tier < 3; tier++) {
        const n = 3 - tier;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          const coupe = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 8, 1, true), glassM);
          coupe.rotation.x = Math.PI;
          coupe.position.set((a - (n - 1) / 2) * 0.2, 0.88 + tier * 0.14, (b - (n - 1) / 2) * 0.2);
          g.add(coupe);
        }
      }
      P(g, 4.6, -3.8);
      F.solidBox(4.6, -3.8, 1.2, 0.8);
      register({
        pos: worldPos(rm, 4.6, -2.8), r: 1.3, zone: rm.zone, label: '빈티지 이슬 한 잔 받기',
        use: () => {
          ui.say('빈티지 이슬. 대폭풍 해 거예요. 많은 걸 겪었죠, 나처럼. 벌컥 말고 홀짝 — 엘리베이터보다 오래됐어요.', { speaker: '밴더버로 부인', voice: 360 });
          ui.toast('빈티지 이슬: 시원하고, 은은히 이끼 향이고, 아주, 아주 오래됐어요.', '🥂');
        },
      });
      const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14), new THREE.MeshStandardMaterial({ color: 0xcfe0e8, roughness: 0.05, metalness: 0.6 }));
      P(mirror, 7.2, -4.86, 2.4);
      const mframe = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.08, 5, 16), mat(0xc9a24a, 0.3));
      P(mframe, 7.2, -4.88, 2.4);
      F.plant(-7.8, -4.2, 1.6);
      F.plant(7.8, 3.8, 1.3);
    }
    // the chaise, Mrs. Vanderburrow, and Pomme on his cushion
    {
      const chaise = new THREE.Group();
      const seat = box(2.4, 0.4, 0.9, 0x8a2a3a);
      seat.position.y = 0.3;
      const back = box(0.9, 0.7, 0.9, 0x8a2a3a);
      back.position.set(-0.9, 0.7, 0);
      chaise.add(seat, back);
      for (const sx of [-1.1, 1.1]) for (const sz of [-0.38, 0.38]) {
        const leg = box(0.08, 0.2, 0.08, 0xc9a24a);
        leg.position.set(sx, 0.1, sz);
        chaise.add(leg);
      }
      P(chaise, 0.4, 1.4);
      F.solidBox(0.4, 1.4, 2.4, 0.9);
      F.rug(0.4, 1.0, 4.5, 3.0, 0x6a2a3a);
      const vb = F.critter('mole', { body: 0x5a4e48 }, -0.3, 1.4, Math.PI * 0.1, 0.45, false);
      sit(vb);
      const pearls = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 14), mat(0xf7f5f0, 0.2));
      pearls.rotation.x = Math.PI / 2 - 0.3;
      pearls.position.set(0, 0.95, 0.32);
      vb.add(pearls);
      const stole = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.13, 6, 12), mat(0xe8dcc8));
      stole.rotation.x = Math.PI / 2;
      stole.position.set(0, 0.88, 0.05);
      vb.add(stole);
      const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 4, 10, Math.PI), glow(0xfff4d8, 0.5));
      onHead(vb, tiara, 0.34, 0.05);
      const cushion = box(0.6, 0.18, 0.6, 0xc9a24a);
      P(cushion, 2.4, 2.4, 0.09);
      const pomme = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const plate = new THREE.Mesh(new THREE.SphereGeometry(0.14 - Math.abs(k - 2) * 0.02, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x6a7078));
        plate.position.z = (k - 2) * 0.07;
        plate.scale.set(1, 0.7, 0.55);
        pomme.add(plate);
      }
      P(pomme, 2.4, 2.4, 0.18);
      let rolled = 0;
      rm.updates.push((dt, t, pp) => {
        // she holds court: a turn to you, a gesture of the head, a laugh
        if (pp) vb.rotation.y = turnToward(vb.rotation.y, Math.atan2(pp.x - vb.position.x, pp.z - vb.position.z) * 0.5, dt, 2);
        vb.userData.parts.head.rotation.x = Math.sin(t * 1.1) * 0.08;
        vb.userData.parts.body.rotation.z = Math.sin(t * 0.6) * 0.05;
        rolled = Math.max(0, rolled - dt);
        pomme.scale.setScalar(rolled > 0 ? 0.8 : 1);
        pomme.rotation.x = rolled > 0 ? Math.PI / 2 : Math.sin(t * 0.8) * 0.05;
        pomme.position.x = R.x + 2.4 + (rolled > 0 ? 0 : Math.sin(t * 0.4) * 0.08);
      });
      talker(() => vb.position, '밴더버로 부인', 360, [
        '달링! 손님! 피츠제럴드가 올려보냈어요? 그 사람은 아무도 안 올려보내는데. 당신은 누군가신가 봐요.',
        '몰드카이 가가 한때는 건물 전체를 가졌죠. 이제 나에겐 4층이 있어요, 유일하게 중요한 층.',
        '남작의 할아버지를 알았어요. 매력적이었죠. 시간당 청구. 한 번은 춤 한 곡을 청구하셨어요. 냈어요. 그럴 가치가 있었으니까.',
        '위에서는, 듣자니, 영원까지 보인대요. 아래에선 샹들리에가 보이죠. 어느 쪽을 닦고 싶은지는 알아요.',
      ], 2.2, rm.zone);
      register({
        pos: worldPos(rm, 2.4, 3.2), r: 1.2, zone: rm.zone, label: '폼에게 인사하기',
        use: () => {
          rolled = 4;
          ui.say('폼, 인사해. 오 — 말렸네. 기쁘면 그래요. 아니면 겁나면. 아니면 화요일이면. 아주 기쁜 거예요, 달링. 어딘가는 화요일이니까.', { speaker: '밴더버로 부인', voice: 360 });
        },
      });
    }
    finishRoom(rm, ritzDoor, { lighting: { hemiSky: 0xfff0d8, hemiIntensity: 1.25 } });
  }

  // ======================================== roots, glow worms (last) ----
  // Placed after everything else, so they can keep clear of it all.
  {
    // roots: they come out of the back walls and droop, the way roots do,
    // so every one of them is attached to dirt
    const rootMat = mat(0x5a3e28, 0.95);
    const geo = new THREE.ConeGeometry(0.1, 1, 4);
    geo.translate(0, -0.5, 0); // base at the origin, tip down −y
    const N = 360;
    const roots = new THREE.InstancedMesh(geo, rootMat, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    let n = 0;
    const spanX = (lx) => lx;
    void spanX;
    for (let i = 0; i < 12000 && n < N; i++) {
      const tunnel = h01() < 0.55;
      const lx = tunnel ? -LINE_END + h01() * LINE_END * 2 : -86 + h01() * 162;
      const lz = tunnel ? -8 + h01() * 4 : -44 + h01() * 58;
      const d = sd(lx, lz);
      if (d < 0.4 || d > 3.2) continue;
      const o = openward(lx, lz);
      if (o.z < 0.3) continue; // back walls only: the ones facing the camera
      const y0 = at(lx, lz);
      if (y0 < 2.2) continue;
      const len = 0.7 + h01() * 1.6;
      const dir = v.set(o.x * 0.55, -0.83, o.z * 0.55).normalize();
      // the tip must stay out in the air, clear of the wall below it
      const tx = lx + dir.x * len, tz = lz + dir.z * len, ty = y0 - 0.1 + dir.y * len;
      if (ty < at(tx, tz) + 0.15 || ty < 1.9) continue;
      q.setFromUnitVectors(down, dir);
      m4.compose(v.set(O.x + lx, y0 - 0.1, O.z + lz), q, sc.set(0.7 + h01() * 0.6, len, 0.7 + h01() * 0.6));
      roots.setMatrixAt(n++, m4);
    }
    roots.count = n;
    roots.castShadow = true;
    group.add(roots);
  }
  {
    // glow worms: on the tunnel walls, right on the dirt, free and extremely
    // polite (they have their own cave up top; these are the city cousins).
    // Thickest out in the tunnels, where the lamps aren't; none behind or
    // inside anything.
    const N = 1400;
    const posA = new Float32Array(N * 3), colA = new Float32Array(N * 3);
    const base = [];
    const PAL = [new THREE.Color(0x9fffe0), new THREE.Color(0x7fd8ff), new THREE.Color(0xc8ffa0)];
    let n = 0;
    for (let i = 0; i < 30000 && n < N; i++) {
      const tunnel = h01() < 0.6;
      const lx = tunnel ? -LINE_END + h01() * LINE_END * 2 : -86 + h01() * 162;
      const lz = tunnel ? -9 + h01() * 17 : -44 + h01() * 58;
      const d = sd(lx, lz);
      if (d < 0.5 || d > 5) continue;
      const inTown = sdEll(lx, lz, MIDTOWN) < 2 || sdEll(lx, lz, UPTOWN) < 2 || sdEll(lx, lz, WORKS) < 2;
      if (inTown && h01() < 0.6) continue;
      if (solid(lx, lz, 1.2)) continue; // nothing glowing through a building
      const o = openward(lx, lz);
      // sit on the surface: a hair out from the wall, toward the open
      const px = lx + o.x * 0.08, pz = lz + o.z * 0.08;
      const y = Math.max(at(lx, lz), at(px, pz)) + 0.06;
      posA[n * 3] = O.x + px; posA[n * 3 + 1] = y; posA[n * 3 + 2] = O.z + pz;
      base.push({ c: PAL[n % 3], ph: h01() * 9 });
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posA.subarray(0, n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colA.subarray(0, n * 3), 3));
    const worms = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, map: dotTexture(),
      depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    }));
    group.add(worms);
    updates.push((dt, t) => {
      for (let i = 0; i < n; i++) {
        const b = base[i], k = 0.55 + 0.45 * Math.sin(t * 1.3 + b.ph);
        colA[i * 3] = b.c.r * k; colA[i * 3 + 1] = b.c.g * k; colA[i * 3 + 2] = b.c.b * k;
      }
      geo.attributes.color.needsUpdate = true;
    });
  }

  // the sun down here is the city's own lamplight; its shadow box follows you
  const refs = zones.lightingRefs();
  updates.push((dt, t, pp) => {
    if (!pp || !refs.sun) return;
    refs.sun.position.set(pp.x - 20, 60, pp.z + 30);
    refs.sun.target.position.set(pp.x, 0, pp.z);
  });

  // The street (two thousand-odd meshes) only needs to be in the scene while
  // you're on it — the molehill up top and the door in the cellar always
  // are, and the rooms show and hide themselves (registerInterior). It
  // switches on from update (which runs the frame you arrive, under the
  // fade) and off when you leave.
  const alwaysOn = new Set([labsHill.g, cellarDoor, ...Object.values(roomRoots)]);
  const street = group.children.filter((c) => !alwaysOn.has(c));
  let streetOn = true;
  const showStreet = (on) => {
    if (on === streetOn) return;
    streetOn = on;
    for (const c of street) c.visible = on;
  };
  showStreet(false);
  zones.onChange((z) => { if (z !== 'burrough') showStreet(false); });

  function update(dt, t, playerPos) {
    const z = zones.current();
    if (z === 'burrough') {
      showStreet(true);
      for (const u of updates) u(dt, t, playerPos);
    } else if (roomUpdates[z]) for (const u of roomUpdates[z]) u(dt, t, playerPos);
  }
  return { group, update };
    }
