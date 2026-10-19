// The village: Pip's Odds & Ends (shop), The Lantern Room (café), and the
// Notbell Museum — exteriors on the plaza, dollhouse interiors far away
// (you teleport through doors behind a fade, see zones.js).

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS, COFFEE_PRICE, COFFEE_BOOST_SECS, FERN_LORE, GROWTH, SHOP_HATS, SONGS } from './catalog.js';
import { kaching, sip, jingle, requestSong } from './audio.js';
import { buildAnimal } from './animals.js';
import * as mail from './mail.js';
import * as doors from './doors.js';
import { rand, turnToward } from './utils.js';
import { HOLIDAY } from './calendar.js';
import { hangCafeArt, artPiece, makeFramed } from './art.js';
import { glowWindow } from './nightglow.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

const VOICE = { pip: 760, luna: 470, fern: 300 };

// ------------------------------------------------------------ exteriors ----

function makeDoor(color = 0x6b4a2e) {
  const g = new THREE.Group();
  const frame = box(1.5, 2.3, 0.18, 0xd9c08f);
  frame.position.y = 1.15;
  const door = box(1.15, 2.0, 0.2, color);
  door.position.set(0, 1.0, 0.04);
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xf2cf5b, 0.4));
  knob.position.set(0.36, 1.0, 0.18);
  g.add(frame, door, knob);
  g.userData.isDoor = [door, knob]; // (doors.js hangs it on a hinge once it's in place)
  return g;
}

export function makeWindow(r = 0.45) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.14, 8), mat(0xfff6e0));
  rim.rotation.x = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 8), mat(0xbfe6f2, 0.3));
  glass.rotation.x = Math.PI / 2;
  glowWindow(glass); // stays a lit, lantern-catching surface; warms at night
  g.add(rim, glass);
  return g;
}

// A matted rectangular window: a cream border + a solid back, with a glass pane
// set inside it — the rectangular cousin of makeWindow. It glows too.
export function makeRectWindow(w = 0.8, h = 1.3) {
  const g = new THREE.Group();
  const frame = box(w + 0.2, h + 0.2, 0.12, 0xfff6e0); // cream mat + solid back
  const glass = box(w, h, 0.16, 0xbfe6f2);
  glass.position.z = 0.05; // the pane sits proud of the mat
  glowWindow(glass);
  g.add(frame, glass);
  return g;
}

// A hanging lamp: warm bulb under a tin shade, on a cord that rises out of
// frame — dollhouse rooms have no ceilings, but light has to come from
// somewhere, and "somewhere" is up. The bulb is emissive and always on
// (interiors are always lit; no new lights — see the budget).
export function makeHangingLamp(shadeColor = 0xc2703a) {
  const g = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.5, 5), mat(0x3a342c, 0.9));
  cord.position.y = 2.25;
  g.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.4, 7, 1, true), mat(shadeColor, 0.6));
  shade.position.y = 0.1;
  shade.castShadow = true;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0),
    new THREE.MeshStandardMaterial({
      color: 0xfff2cc, emissive: 0xffdfa0, emissiveIntensity: 0.95, flatShading: true,
    }));
  bulb.position.y = -0.08;
  g.add(bulb);
  return g; // hang at ~3.0 over whatever deserves the light
}

// The office cousin: a fluorescent tube in a grey tray, hung on thin rods
// toward an implied ceiling. BULKO, the clinic, and the Labs run on this —
// light with a work ethic and no warmth to spare.
export function makeCeilingTube(len = 3.2) {
  const g = new THREE.Group();
  const tray = box(len + 0.3, 0.12, 0.5, 0x8a9098);
  tray.position.y = 0.1;
  g.add(tray);
  const tube = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.3),
    new THREE.MeshStandardMaterial({
      color: 0xf4f8fa, emissive: 0xe8f2f6, emissiveIntensity: 0.85, flatShading: true,
    }));
  g.add(tube);
  for (const sx of [-len / 2 + 0.2, len / 2 - 0.2]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), mat(0x8a9098, 0.8));
    rod.position.set(sx, 0.85, 0);
    g.add(rod);
  }
  return g; // hang at ~3.4+
}

function makeShopExterior() {
  const g = new THREE.Group();
  // a low stone footing — the plaza's edge slopes just enough to show
  // daylight under a proud mustard box, and Pip would never stand for it
  const plinth = box(7.3, 1.2, 6.3, 0xc9bda6);
  plinth.position.y = -0.42;
  g.add(plinth);
  const walls = box(7, 3.4, 6, 0xe8b84b);
  walls.userData.occlude = true;
  walls.position.y = 1.7 + 0.18;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.6, 4), mat(0x4f8f6a));
  roof.position.y = 4.6;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = makeDoor(0x7a4a26);
  door.position.z = 3.01;
  g.add(door);
  // striped awning over the door
  for (let i = 0; i < 5; i++) {
    const slat = box(0.56, 0.08, 1.3, i % 2 ? 0xfff3da : 0xe8743a);
    slat.position.set(-1.4 + i * 0.58 + 0.06, 2.6, 3.55);
    slat.rotation.x = 0.5;
    g.add(slat);
  }
  for (const sx of [-1, 1]) {
    const w = makeWindow();
    w.position.set(sx * 2.1, 2.0, 3.0);
    g.add(w);
    const side = makeWindow();
    side.position.set(sx * 3.51, 2.0, 0);
    side.rotation.y = Math.PI / 2;
    side.traverse((o) => {
      if (o.isMesh && !o.material.transparent) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.add(side);
  }
  // a big button for a sign, naturally — up on the roof's peak like a
  // weathervane (on the front wall the eaves ran straight through it)
  const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 10), mat(0xf2cf5b, 0.35));
  sign.rotation.x = Math.PI / 2;
  sign.position.set(0, 6.55, 0);
  g.add(sign);
  for (const [hx, hy] of [[-0.16, 0.12], [0.16, 0.12], [-0.16, -0.12], [0.16, -0.12]]) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 6), mat(0xb8902e, 0.5));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(hx, 6.55 + hy, 0);
    g.add(hole);
  }
  const finial = box(0.1, 0.5, 0.1, 0x55483a);
  finial.position.set(0, 5.85, 0);
  g.add(finial);
  return g;
}

function makeCafeExterior() {
  const g = new THREE.Group();
  const walls = box(6.4, 3.2, 5.6, 0xf3e6cf);
  walls.position.y = 1.6;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.4, 4), mat(0xc97b63));
  roof.position.y = 4.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = makeDoor(0x8a5a3a);
  door.position.z = 2.81;
  g.add(door);
  const w = makeWindow(0.55);
  w.position.set(-1.9, 2.0, 2.8);
  g.add(w);
  // the lantern by the door — warm, always on, very loved
  const post = box(0.12, 2.2, 0.12, 0x55483a);
  post.position.set(2.4, 1.1, 3.3);
  g.add(post);
  const glow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.26, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd98f })
  );
  glow.position.set(2.4, 2.3, 3.3);
  g.add(glow);
  // a chalkboard A-frame by the door, in Luna's handwriting
  const board = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 160; cv.height = 200;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#23302a';
  ctx.fillRect(0, 0, 160, 200);
  ctx.strokeStyle = '#8a5a3a';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 150, 190);
  ctx.fillStyle = '#f3efe2';
  ctx.textAlign = 'center';
  ctx.font = '700 17px ui-rounded, "Segoe UI", system-ui, sans-serif';
  ctx.fillText('랜턴', 80, 38);
  ctx.fillText('룸', 80, 58);
  ctx.font = 'italic 600 15px ui-rounded, "Segoe UI", system-ui, sans-serif';
  ctx.fillText('오늘:', 80, 90);
  ctx.fillStyle = '#ffd98f';
  ctx.font = '700 18px ui-rounded, "Segoe UI", system-ui, sans-serif';
  ctx.fillText('랜턴 로스트', 80, 114);
  ctx.fillStyle = '#f3efe2';
  ctx.font = 'italic 600 14px ui-rounded, "Segoe UI", system-ui, sans-serif';
  ctx.fillText('램프가 따뜻해요', 80, 148);
  ctx.strokeStyle = '#f3efe2'; // a chalk cup, steaming
  ctx.lineWidth = 2.5;
  ctx.strokeRect(66, 160, 24, 18);
  ctx.beginPath(); ctx.arc(93, 169, 5, -1.2, 1.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(72, 156); ctx.quadraticCurveTo(76, 150, 72, 144); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(82, 156); ctx.quadraticCurveTo(86, 150, 82, 144); ctx.stroke();
  const chalkTex = new THREE.CanvasTexture(cv);
  chalkTex.colorSpace = THREE.SRGBColorSpace;
  for (const side of [1, -1]) {
    const leaf = box(0.8, 1.05, 0.06, 0x8a5a3a);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.95), new THREE.MeshBasicMaterial({ map: chalkTex }));
    face.position.z = 0.035;
    leaf.add(face);
    leaf.position.set(0, 0.5, side * 0.2);
    leaf.rotation.x = side * -0.36;
    if (side < 0) leaf.rotation.y = Math.PI;
    board.add(leaf);
  }
  board.position.set(-2.5, 0, 3.75);
  board.rotation.y = 0.35; // angled to catch the plaza's eye
  g.add(board);
  // chimney + drifting smoke
  const chimney = box(0.6, 1.2, 0.6, 0xb09a7e);
  chimney.position.set(1.7, 4.6, -1.2);
  g.add(chimney);
  const puffs = [];
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75, flatShading: true, roughness: 1,
  });
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), puffMat);
    p.position.set(1.7, 5.2, -1.2);
    p.userData.t = i / 3;
    puffs.push(p);
    g.add(p);
  }
  g.userData.puffs = puffs;
  return g;
}

// The post office closes the plaza's fourth side. No interior yet — the mail
// is still being sorted (C8) — but the building stands, patient as a mailbox.
function makePostOfficeExterior() {
  const g = new THREE.Group();
  // a foundation first — the ground near the dock has opinions, and a post
  // office should look like it plans to stay
  const plinth = box(6.4, 1.6, 5.4, 0xd8cbb2);
  plinth.position.y = -0.55; // sunk well below the downhill side
  g.add(plinth);
  const walls = box(6, 3.1, 5, 0xf0e2c8);
  walls.userData.occlude = true;
  walls.position.y = 1.55 + 0.25;
  g.add(walls);
  // prism ridge roof in postal blue. TWO gotchas: thetaStart π/2 BEFORE
  // rotateZ (or the ridge skews), and a 3-cylinder only spans 1.73×radius
  // across the ridge — size r to the WALL DEPTH, not to instinct
  const roofGeo = new THREE.CylinderGeometry(3.3, 3.3, 6.6, 3, 1, false, Math.PI / 2);
  roofGeo.rotateZ(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, mat(0x4a6a9c));
  roof.scale.y = 0.42;
  roof.position.y = 3.35 + 3.3 * 0.42 / 2; // eaves on the wall top
  roof.castShadow = true;
  g.add(roof);
  const door = makeDoor(0x5a3d22);
  door.position.set(0, 0.25, 2.51);
  g.add(door);
  for (const sx of [-1, 1]) {
    const w = makeWindow();
    w.position.set(sx * 1.9, 2.25, 2.5);
    g.add(w);
  }
  // the sign is a bottle with a letter rolled inside — how mail has always
  // arrived here; the post office is just the part where somebody admits it
  const bottle = new THREE.Group();
  const glassB = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.85, 7), mat(0x9fd4d4, 0.3));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 7), mat(0x9fd4d4, 0.3));
  neck.position.y = 0.55;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 6), mat(0xb08a5a, 0.8));
  cork.position.y = 0.75;
  const letter = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), mat(0xfff6e0, 0.9));
  bottle.add(glassB, neck, cork, letter);
  bottle.rotation.z = 1.15; // adrift, as received
  bottle.position.set(0, 2.85, 2.95); // hung out over the door on its bracket, clear of the eave
  const bracket = box(0.08, 0.08, 0.5, 0x3a3a3a);
  bracket.position.set(0, 3.2, 2.75);
  g.add(bracket);
  bottle.traverse((o) => { o.castShadow = true; });
  g.add(bottle);
  // the pillar box: BULKO-buoy red, slot like a buttonhole
  const pillar = new THREE.Group();
  // (the drum runs down into the ground: the yard slopes away from the
  // footing here, and a pillar box does not hover)
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 2.6, 8), mat(0xb0453a));
  drum.position.y = 0.2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 8), mat(0x8f3831));
  cap.position.y = 1.65;
  const slot = box(0.5, 0.08, 0.06, 0x2a2a2a);
  slot.position.set(0, 1.25, 0.42);
  pillar.add(drum, cap, slot);
  pillar.position.set(1.9, 0, 3.4);
  pillar.traverse((o) => { o.castShadow = true; });
  g.add(pillar);
  g.rotation.y = -Math.PI / 2; // the door greets the pier path — mail comes by sea
  return g;
}

function makeMuseumExterior() {
  const g = new THREE.Group();
  const walls = box(9, 3.6, 6.5, 0xcfd6cf);
  walls.position.y = 1.8;
  g.add(walls);
  // prism roof — thetaStart phases one vertex to +X, so rotateZ lands it
  // straight up: a true ridge, at last. r sized to the WALL DEPTH: a
  // 3-cylinder spans 1.73×r across the ridge (6.5-deep walls need r≈4,
  // squashed back down with scale.y — same apex, honest eaves)
  // ...and it reaches forward over the portico, so the columns hold it up
  // instead of standing out in the rain (r 4.6 spans 7.97 across: back wall
  // at -3.25 to past the porch lip at +4.3; shifted +0.5 to center on that)
  const roofGeo = new THREE.CylinderGeometry(4.6, 4.6, 9.8, 3, 1, false, Math.PI / 2);
  roofGeo.rotateZ(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, mat(0x7c8894));
  roof.scale.y = 0.37;
  roof.position.set(0, 3.6 + 4.6 * 0.37 / 2, 0.5); // eaves on the wall top
  roof.castShadow = true;
  g.add(roof);
  for (const sx of [-2.9, -1, 1, 2.9]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.7, 7), mat(0xece9dd));
    col.position.set(sx, 1.85, 3.5); // all the way up to the pediment
    col.castShadow = true;
    g.add(col);
  }
  const porch = box(8.6, 0.3, 1.8, 0xb9c0b9);
  porch.position.set(0, 0.15, 3.4);
  g.add(porch);
  const door = makeDoor(0x4a3a5a);
  door.position.z = 3.26;
  door.scale.setScalar(1.1);
  g.add(door);
  // a narrow matted window in each bay flanking the door (between the pillars)
  for (const sx of [-1.95, 1.95]) {
    const mwin = makeRectWindow(0.8, 1.3);
    mwin.position.set(sx, 2.0, 3.26);
    g.add(mwin);
  }
  return g;
}

// ------------------------------------------------------------- interiors ----

function buildRoom(base, w, d, floorColor, wallColor) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mat(floorColor));
  floor.position.set(base.x, -0.2, base.z);
  floor.receiveShadow = true;
  floor.castShadow = true;
  g.add(floor);
  const wallH = 4.6;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.4), mat(wallColor));
  back.position.set(base.x, wallH / 2, base.z - d / 2);
  g.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH, d), mat(wallColor));
    side.position.set(base.x + sx * w / 2, wallH / 2, base.z);
    g.add(side);
  }
  // skirting board, because cozy lives in the details
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.5, 0.18), mat(0x8a6f4d));
  skirt.position.set(base.x, 0.25, base.z - d / 2 + 0.3);
  g.add(skirt);
  return g;
}

function warmLamp(x, y, z, color = 0xffd9a0, intensity = 40, dist = 16) {
  const light = new THREE.PointLight(color, intensity, dist, 2);
  light.position.set(x, y, z);
  return light;
}

// a café cup: saucer, cup, a handle you could actually hold, and coffee in it
function makeCup(color = 0xfffaf0) {
  const g = new THREE.Group();
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.03, 10), mat(color, 0.5));
  saucer.position.y = 0.015;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.17, 9, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true, side: THREE.DoubleSide }));
  cup.position.y = 0.115;
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.09, 9), mat(color, 0.5));
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.035;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.108, 9), mat(0x4a2d1e, 0.3));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.175;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 4, 8), mat(color, 0.5));
  handle.position.set(0.13, 0.12, 0);
  g.add(saucer, cup, base, coffee, handle);
  return g;
}

function npcAt(kind, colors, x, z, rotY, baseY = 0) {
  const npc = buildAnimal(kind, colors);
  npc.position.set(x, baseY, z);
  npc.rotation.y = rotY;
  npc.userData.fidget = true;
  return npc;
}

// little decorated blobs for the shop shelves
function shelfClutter(x, y, z, parent) {
  const colors = [0xe06a6a, 0x6a9ae0, 0xe0c46a, 0x8fce7a, 0xc77dff];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(0.12, 0.2), 0),
      mat(colors[(i + Math.floor(x + z)) % colors.length], 0.6)
    );
    b.position.set(x + i * 0.5 - 0.75, y, z);
    parent.add(b);
  }
}

function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}

// ------------------------------------------------------------ the works ----

export function createBuildings() {
  const group = new THREE.Group();
  const C = SITES.village;
  const updates = [];

  // plaza centerpiece: a little well with a button-shaped roof finial
  const wellX = C.x;
  const wellZ = C.z + 4;
  const well = new THREE.Group();
  const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.9, 8), mat(0x9aa0a6));
  wellBase.position.y = 0.45;
  const wellWater = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 8), mat(0x3fb0e8, 0.3));
  wellWater.position.y = 0.86;
  well.add(wellBase, wellWater);
  for (const sx of [-1, 1]) {
    const post = box(0.14, 1.3, 0.14, 0x7a5230);
    post.position.set(sx * 0.95, 1.4, 0);
    well.add(post);
  }
  const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), mat(0xc97b63));
  wellRoof.position.y = 2.4;
  wellRoof.rotation.y = Math.PI / 4;
  well.add(wellRoof);
  // the winch: an axle between the posts, a crank, and a bucket that goes
  // down for water and comes back up again, forever, for nobody in particular
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 6), mat(0x8a6f4d));
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 1.85;
  well.add(axle);
  const crank = new THREE.Group();
  const crankArm = box(0.06, 0.34, 0.06, 0x7a5230);
  crankArm.position.y = 0.17;
  const crankGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 5), mat(0x6b4a2e));
  crankGrip.rotation.z = Math.PI / 2;
  crankGrip.position.set(0.1, 0.34, 0);
  crank.add(crankArm, crankGrip);
  crank.position.set(1.08, 1.85, 0);
  well.add(crank);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), mat(0xd9c49a, 0.9));
  well.add(rope);
  const bucket = new THREE.Group();
  const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.26, 7), mat(0x9a6a3e));
  const bands = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 7), mat(0x6a7078, 0.4));
  bands.position.y = 0.06;
  bucket.add(pail, bands);
  well.add(bucket);
  // ripples when the bucket touches the water, and the odd glint of a
  // button down below
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 12),
    new THREE.MeshBasicMaterial({ color: 0xe8f7ff, transparent: true, opacity: 0, depthWrite: false }));
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.92;
  well.add(ripple);
  const glints = [];
  for (const [gx, gz] of [[-0.3, 0.2], [0.25, -0.3], [0.1, 0.38]]) {
    const gl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0 }));
    gl.position.set(gx, 0.92, gz);
    well.add(gl);
    glints.push(gl);
  }
  let rippleT = 9;
  updates.push((dt, t) => {
    // down slowly, a pause in the water, up slowly, a pause at the top
    const cyc = (t % 16) / 16;
    const depth = cyc < 0.35 ? cyc / 0.35 : cyc < 0.5 ? 1 : cyc < 0.85 ? 1 - (cyc - 0.5) / 0.35 : 0;
    const by = 1.55 - depth * 0.62;
    bucket.position.set(Math.sin(t * 1.3) * 0.03, by, Math.sin(t * 0.9) * 0.03);
    bucket.rotation.z = Math.sin(t * 1.3) * 0.08;
    rope.scale.y = 1.8 - by;
    rope.position.set(bucket.position.x / 2, (1.8 + by + 0.13) / 2, bucket.position.z / 2);
    crank.rotation.x = -depth * Math.PI * 4;
    if (cyc > 0.35 && cyc < 0.37 && rippleT > 1) rippleT = 0;
    rippleT += dt;
    const rk = Math.min(1, rippleT / 1.4);
    ripple.scale.setScalar(1 + rk * 2.2);
    ripple.material.opacity = rippleT < 1.4 ? 0.6 * (1 - rk) : 0;
    glints.forEach((gl, i) => { gl.material.opacity = Math.max(0, Math.sin(t * 1.1 + i * 2.1)) ** 8; });
  });
  well.position.set(wellX, terrainHeight(wellX, wellZ), wellZ);
  well.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });
  group.add(well);
  zones.addBlocker(wellX, wellZ, 1.1);
  register({
    pos: well.position, r: 2.2, label: '우물 들여다보기',
    use: () => ui.say([
      '우물을 들여다봐요. 동전— 아니, 버튼이 바닥에서 반짝여요.',
      '저 아래 누군가가 저축 중이에요.',
    ]),
  });

  // ----- holiday dressing for the plaza
  if (HOLIDAY) {
    // festive bunting between two poles by the well, whatever the occasion
    const buntingColors = [0xff6b81, 0xffd23e, 0x6a9ae0, 0x8fce7a];
    const wy = terrainHeight(C.x, C.z);
    for (const sx of [-1, 1]) {
      const pole = box(0.1, 2.6, 0.1, 0xa97c50);
      pole.position.set(C.x + sx * 4, wy + 1.3, C.z + 3);
      group.add(pole);
    }
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), mat(buntingColors[i % 4], 0.7));
      flag.rotation.x = Math.PI; // point down
      flag.position.set(C.x - 4 + k * 8, wy + 2.5 - Math.sin(k * Math.PI) * 0.5, C.z + 3);
      group.add(flag);
    }
    if (HOLIDAY.id === 'spooky') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const px = C.x + Math.cos(a) * 3.2, pz = C.z + Math.sin(a) * 3.2;
        const pumpkin = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), mat(0xe8743a, 0.6));
        pumpkin.scale.y = 0.8;
        pumpkin.position.set(px, terrainHeight(px, pz) + 0.35, pz);
        pumpkin.castShadow = true;
        group.add(pumpkin);
        const stem = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), mat(0x55772f));
        stem.position.set(px, terrainHeight(px, pz) + 0.75, pz);
        group.add(stem);
      }
    }
    if (HOLIDAY.id === 'frost') {
      const lightColors = [0xffd23e, 0xff6b81, 0x8fce7a, 0x6a9ae0];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
          new THREE.MeshBasicMaterial({ color: lightColors[i % 4] }));
        bulb.position.set(C.x + Math.cos(a) * 2.2, wy + 2.6 + Math.sin(a * 3) * 0.15, C.z + Math.sin(a) * 2.2);
        group.add(bulb);
      }
    }
  }

  // ----- placements: an arc on the north side of the plaza, facing south
  const spots = {
    shop: { x: C.x - 8, z: C.z - 3.5, w: 7, d: 6 },
    cafe: { x: C.x + 8, z: C.z - 3.5, w: 6.4, d: 5.6 },
    museum: { x: C.x, z: C.z - 7.5, w: 9, d: 6.5 },
    // the post office lives by the dock road, not the plaza — the mail
    // arrives by sea, and the sorting should happen where it lands.
    // (absolute coords: flattest unblocked patch between pier and cottage,
    // found by survey 2026-07-01 — the seeded terrain keeps it true)
    post: { x: -11.6, z: 19.7, w: 6, d: 5 },
  };

  const exteriors = {
    shop: makeShopExterior(),
    cafe: makeCafeExterior(),
    museum: makeMuseumExterior(),
    post: makePostOfficeExterior(),
  };

  // what's solid, in each exterior's own coordinates: [x, z, w, d] boxes and
  // [x, z, r] posts. (The old round force-fields kept you two steps shy of
  // every wall and let you cut the corners.)
  const SOLID = {
    shop: [[0, 0, 7.3, 6.3]],
    cafe: [[0, 0, 6.4, 5.6], [2.4, 3.3, 0.25], [-2.5, 3.75, 0.85]], // (the A-frame gets elbow room: folks used to stand in it)
    museum: [[0, 0, 9, 6.5], ...[-2.9, -1, 1, 2.9].map((x) => [x, 3.5, 0.3])],
    post: [[0, 0, 6.4, 5.4], [1.9, 3.4, 0.5]],
  };
  for (const [name, spot] of Object.entries(spots)) {
    const ext = exteriors[name];
    const baseY = terrainHeight(spot.x, spot.z);
    ext.position.set(spot.x, baseY, spot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    const ry = ext.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
    for (const b of SOLID[name]) {
      const wx = spot.x + b[0] * c + b[1] * sn, wz = spot.z - b[0] * sn + b[1] * c;
      if (b.length === 4) zones.addBlockerBox(wx, wz, b[2], b[3], ry, 0.05);
      else zones.addBlocker(wx, wz, b[2]);
    }
    // where a villager stands to go in (ambient errands walk here)
    // the front door swings (errands walk through it)
    let doorGroup = null;
    ext.traverse((o) => { if (!doorGroup && o.userData.isDoor) doorGroup = o; });
    if (doorGroup) doors.hinge(name, ...doorGroup.userData.isDoor);
    const DOOR_OUT = { shop: 4.0, cafe: 3.8, museum: 4.9, post: 3.6 };
    const dz = DOOR_OUT[name];
    zones.setDoor(name, { x: spot.x + dz * sn, z: spot.z + dz * c });
    // the museum's porch is a step up, not a slab you wade through
    if (name === 'museum') zones.addSurfaceBox(spot.x, spot.z + 3.5, 9.2, 2.3, baseY + 0.3);
  }

  // Luna's chalkboard: what's on today (the answer is mostly the same)
  register({
    pos: new THREE.Vector3(spots.cafe.x - 2.5, 0, spots.cafe.z + 4.4), r: 1.6,
    label: '칠판 읽기',
    use: () => ui.say([
      '“오늘: 랜턴 로스트. 그리고: 랜턴 로스트. 랜턴 로스트에 대해 물어보세요.” 너무 자주 다시 그려서 분필 홈이 파였어요.',
      '“램프가 따뜻합니다.” 아래에 작게: “항상 따뜻합니다. 특선이 아닙니다. 말하는 게 좋을 뿐.”',
      '“램프가 켜져 있을 때면 언제든 영업. 칩이 느린 곡들을 연주. 팁은 버튼으로, 혹은 램프에게 칭찬으로.”',
    ][Math.floor(Math.random() * 3)]),
  });

  // the notice moved to the window when the door started opening
  // (offsets follow the westward facing: door at -x, pillar box toward the pier)
  register({
    pos: new THREE.Vector3(spots.post.x - 2.7, 0, spots.post.z - 1.9), r: 1.8,
    label: '공지 읽기',
    use: () => ui.say([
      '창에 조심스러운 발바닥 글씨 카드: “낫벨 우체국 — 개국. 분류가 완료되었습니다. 철저했습니다.”',
      '“섬 누구에게나 편지, 우표 한 장. 답장은 당신의 우체통으로. 병 배달은 평소처럼 계속. 조수에 감사를.”',
    ]),
  });
  register({
    pos: new THREE.Vector3(spots.post.x - 3.4, 0, spots.post.z + 1.9), r: 2.0,
    label: '기둥 우체통 살펴보기',
    use: () => ui.say([
      '접은 편지, 혹은 아주 의지 강한 버튼 하나 너비의 투입구가 있는 빨간 기둥 우체통. 페인트는 새것. 아이디어는 페인트보다 오래됐어요.',
      '작은 명판: “편지 — 안쪽, 카운터에서, 우표와 함께. 이 통은 감상용.”',
    ]),
  });

  // café smoke drifts up and fades, forever
  const puffs = exteriors.cafe.userData.puffs;
  updates.push((dt, t) => {
    for (const p of puffs) {
      p.userData.t = (p.userData.t + dt * 0.25) % 1;
      const k = p.userData.t;
      p.position.y = 5.2 + k * 2.2;
      p.position.x = 1.7 + Math.sin(t * 0.8 + k * 6) * 0.3;
      p.scale.setScalar(0.6 + k * 1.1);
      p.material.opacity = 0.6 * (1 - k);
    }
  });

  // ----- interiors live far off-island; doors teleport you there
  const IN = {
    shop: { x: 300, z: 0 },
    cafe: { x: 300, z: 80 },
    museum: { x: 300, z: 160 },
    post: { x: 300, z: 2100 }, // (its own spot: it used to share (300, 240) with your cottage)
  };

  function wireDoors(name, spot, label) {
    const inBase = IN[name];
    const doorPos = new THREE.Vector3(spot.x, 0, spot.z + spot.d / 2 + 0.4);
    register({
      pos: doorPos, r: 2.6, label: `enter ${label}`,
      use: () => zones.go(name),
    });
    register({
      pos: new THREE.Vector3(inBase.x, 0, inBase.z + 5.2), r: 1.6,
      zone: name, label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: spot.x, z: spot.z + spot.d / 2 + 2.2, rotY: 0 }),
    });
  }

  // ====================================================== Pip's Odds & Ends
  {
    const roomStart = group.children.length;
    const B = IN.shop;
    group.add(buildRoom(B, 16, 12, 0xa97c50, 0xe3c98f));

    const counter = box(5, 1.1, 1.2, 0x8a5a3a);
    counter.position.set(B.x, 0.55, B.z - 2.5);
    group.add(counter);
    const shopLamp = makeHangingLamp(0xd9a440); // shelf-gold, Pip approved the invoice
    shopLamp.position.set(B.x, 2.85, B.z - 1.6); // over the counter, clear of the wares
    group.add(shopLamp);

    // shelves of mysterious wares
    for (const [sx, y] of [[-5.5, 1.4], [-5.5, 2.4], [5.5, 1.4], [5.5, 2.4]]) {
      const shelf = box(3.6, 0.16, 1, 0x8a5a3a);
      shelf.position.set(B.x + sx, y, B.z - 5.2);
      group.add(shelf);
      shelfClutter(B.x + sx, y + 0.25, B.z - 5.2, group);
    }

    // THE button. on a velvet pedestal. obviously.
    const pedestal = box(0.8, 1.2, 0.8, 0x7a3a4a);
    pedestal.position.set(B.x + 6.5, 0.6, B.z - 2);
    group.add(pedestal);
    const theButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), mat(0xfff0a0, 0.15));
    theButton.position.set(B.x + 6.5, 1.35, B.z - 2);
    group.add(theButton);
    updates.push((dt, t) => { theButton.rotation.y = t * 0.7; });
    register({
      pos: pedestal.position, r: 2, zone: 'shop', label: '가장 반짝이는 버튼 감상하기',
      use: () => ui.say(
        ['반짝여요. 눈부셔요. 구조적으로는, 그냥 버튼이에요.',
         '방 건너편에서 핍이 아주, 아주 주시하고 있어요.'],
      ),
    });

    // a stool so Pip can actually see (and be seen) over his counter
    // (tall enough that Pip is a shopkeeper over a counter, not a head on it —
    // at the old height he read as something sinking through the floor)
    const pipStool = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.0, 7), mat(0x6b4a2e));
    pipStool.position.set(B.x, 0.5, B.z - 3.6);
    group.add(pipStool);
    const pip = npcAt('magpie', { body: 0x39414f, head: 0x39414f }, B.x, B.z - 3.6, 0, 1.0);
    group.add(pip);
    wireNpcBob(pip, updates);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('shop', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 7.5, x1: B.x + 7.5, z0: B.z - 4.4, z1: B.z + 5.4 },
      blockers: [
        { x: B.x, z: B.z - 2.5, w: 5, d: 1.2 }, // counter (its full length: the ends used to be walk-in)
        { x: B.x + 6.5, z: B.z - 2, r: 0.9 },  // pedestal
      ],
      spawn: { x: B.x, z: B.z + 4.6, rotY: Math.PI },
      lighting: {
        bg: 0x241c14, fog: 0x241c14, fogNear: 24, fogFar: 60,
        hemiSky: 0xffe6c0, hemiGround: 0x6b5135, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    wireDoors('shop', spots.shop, '핍의 잡동사니');

    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 2.5), r: 3, zone: 'shop',
      label: '핍과 대화하기',
      use: () => pipMenu(),
    });
  }

  // ====================================================== The Lantern Room
  {
    const roomStart = group.children.length;
    const B = IN.cafe;
    group.add(buildRoom(B, 14, 11, 0x7a5230, 0xead9b8));
    hangCafeArt(group, B); // culture

    const counter = box(4.6, 1.1, 1.2, 0x6b4a2e);
    counter.position.set(B.x - 2, 0.55, B.z - 2.8);
    group.add(counter);
    const cafeLamp = makeHangingLamp(0xc2452c); // low over the bar, Lantern Room warm
    cafeLamp.position.set(B.x - 2, 2.8, B.z - 2.8);
    group.add(cafeLamp);

    // the espresso rig: tank, tower, tiny important levers
    const machine = new THREE.Group();
    machine.add(box(1.1, 0.9, 0.7, 0xb05a4a));
    const spout = box(0.16, 0.3, 0.3, 0x55483a);
    spout.position.set(0, -0.2, 0.32);
    machine.add(spout);
    machine.position.set(B.x - 3.2, 1.55, B.z - 2.8);
    group.add(machine);

    // THE old lamp — the lighthouse's lamp, retired to counter duty
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.5, 8), mat(0x9a8a6a, 0.4));
    lampBase.position.set(B.x - 0.2, 1.35, B.z - 2.8);
    group.add(lampBase);
    const lampGlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe2a8 })
    );
    lampGlow.position.set(B.x - 0.2, 1.95, B.z - 2.8);
    group.add(lampGlow);
    const lampLight = warmLamp(B.x - 0.2, 2.4, B.z - 2.6, 0xffc97a, 60, 18);
    group.add(lampLight);
    updates.push((dt, t) => {
      const pulse = 1 + Math.sin(t * 1.7) * 0.06;
      lampGlow.scale.setScalar(pulse);
      lampLight.intensity = 60 + Math.sin(t * 1.7) * 8;
    });
    register({
      pos: lampBase.position, r: 2.2, zone: 'cafe', label: '오래된 램프 보기',
      use: () => {
        const seen = S.hasFlag('sawLamp');
        S.setFlag('sawLamp');
        ui.say(seen
          ? '램프가 부드럽게 빛나요, 좋은 은퇴처를 찾은 불씨처럼.'
          : ['묵직한 놋쇠 램프, 세월에 렌즈가 흐려졌어요. 켜지 않아도 따뜻해요.',
             '작은 카드: “등대에서 옴. 닦지 마시오. 간지러우니까.”']);
      },
    });

    // two round tables with stools
    for (const [tx, tz] of [[B.x + 3.4, B.z + 0.6], [B.x - 3.6, B.z + 1.6]]) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 8), mat(0x8a5a3a));
      top.position.set(tx, 1.0, tz);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6), mat(0x6b4a2e));
      leg.position.set(tx, 0.5, tz);
      group.add(top, leg);
      // two cups of the Lantern Roast, on saucers, handles out
      for (const [cx, cz, ry] of [[0.35, -0.25, 0.4], [-0.4, 0.3, 2.6]]) {
        const cup = makeCup();
        cup.position.set(tx + cx, 1.07, tz + cz);
        cup.rotation.y = ry;
        group.add(cup);
      }
      for (const a of [0.7, 2.6]) {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.62, 7), mat(0xa97c50));
        stool.position.set(tx + Math.cos(a) * 1.7, 0.31, tz + Math.sin(a) * 1.7);
        group.add(stool);
      }
    }

    // Chip, the house musician: a cricket, a stool, a guitar, no plans
    const chipStool = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.8, 7), mat(0x6b4a2e));
    chipStool.position.set(B.x + 5.2, 0.4, B.z - 2.6);
    group.add(chipStool);
    const chip = new THREE.Group();
    const chipBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 2, 5), mat(0x6f9a45, 0.7));
    chipBody.rotation.x = -0.5;
    chipBody.position.y = 0.25;
    chip.add(chipBody);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.35 }));
      eye.position.set(sx * 0.07, 0.45, 0.1);
      chip.add(eye);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), mat(0x55772f));
      antenna.position.set(sx * 0.05, 0.6, 0.04);
      antenna.rotation.z = -sx * 0.5;
      chip.add(antenna);
    }
    const guitar = new THREE.Group();
    const guitarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 9), mat(0xc97b35, 0.5));
    guitarBody.rotation.x = Math.PI / 2;
    guitar.add(guitarBody);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.04), mat(0x55483a, 0.5));
    neck.position.set(0.12, 0.2, 0);
    neck.rotation.z = -0.5;
    guitar.add(neck);
    guitar.position.set(0.08, 0.26, 0.16);
    guitar.rotation.z = 0.3;
    chip.add(guitar);
    chip.position.set(B.x + 5.2, 0.8, B.z - 2.6);
    chip.rotation.y = -0.6;
    group.add(chip);
    updates.push((dt, t) => {
      chip.rotation.z = Math.sin(t * 2.2) * 0.06; // swaying with the tune in his head
    });
    register({
      pos: chipStool.position, r: 2.4, zone: 'cafe',
      label: '칩에게 노래 신청하기',
      use: async () => {
        const choice = await ui.ask('음? 아 — 그래. 어떤 기분이야?', [
          ...SONGS.map((s) => ({ label: `🎵 ${s.name}`, value: s.id })),
          { label: '그냥 듣는 중', value: null },
        ], { speaker: '칩', voice: 820 });
        if (!choice) {
          ui.say('최고의 관객이야.', { speaker: '칩', voice: 820 });
          return;
        }
        const song = SONGS.find((s) => s.id === choice);
        requestSong(choice);
        ui.toast(`♪ 칩이 “${song.name}”을(를) 연주해요`, '🦗');
      },
    });

    const lunaStool = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 7), mat(0x55483a));
    lunaStool.position.set(B.x - 2, 0.3, B.z - 3.8);
    group.add(lunaStool);
    const luna = npcAt('moth', { body: 0xe8e0c8, head: 0xe8e0c8 }, B.x - 2, B.z - 3.8, 0, 0.6);
    group.add(luna);
    wireNpcBob(luna, updates);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('cafe', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 6.5, x1: B.x + 6.5, z0: B.z - 3.9, z1: B.z + 4.9 },
      blockers: [
        { x: B.x - 2, z: B.z - 2.8, w: 4.6, d: 1.2 }, // counter (its full length)
        { x: B.x + 3.4, z: B.z + 0.6, r: 1.1 }, // tables
        { x: B.x - 3.6, z: B.z + 1.6, r: 1.1 },
        // their stools, and Chip on his
        ...[[3.4, 0.6], [-3.6, 1.6]].flatMap(([tx, tz]) => [0.7, 2.6].map((a) => ({ x: B.x + tx + Math.cos(a) * 1.7, z: B.z + tz + Math.sin(a) * 1.7, r: 0.4 }))),
        { x: B.x + 5.2, z: B.z - 2.6, r: 0.55 },
      ],
      spawn: { x: B.x + 1, z: B.z + 4.2, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 22, fogFar: 55,
        hemiSky: 0xffe9c8, hemiGround: 0x70573b, hemiIntensity: 1.0,
        sunIntensity: 0,
      },
    });
    wireDoors('cafe', spots.cafe, '랜턴 룸');

    register({
      pos: new THREE.Vector3(B.x - 2, 0, B.z - 2.8), r: 3, zone: 'cafe',
      label: '루나와 대화하기',
      use: () => lunaMenu(),
    });
  }

  // ====================================================== Notbell Museum
  // Bigger on the inside. The building respects the collection.
  const museumDisplays = new THREE.Group();
  let refreshMuseum = () => {};
  {
    const roomStart = group.children.length;
    const B = IN.museum;
    const wallMat = 0xd8d2c2;

    // floors: entrance gallery, great hall, aquarium hall — old wood + runners
    for (const [w, d, x, z] of [
      [12.4, 7.9, B.x, B.z + 6.75],
      [37.4, 9.4, B.x, B.z - 1.5],
      [18.4, 9.0, B.x, B.z - 10.5],
    ]) {
      const floor = box(w, 0.4, d, 0x9a8468);
      floor.position.set(x, -0.2, z);
      floor.receiveShadow = true;
      group.add(floor);
    }
    const runner = box(2.6, 0.06, 7.4, 0x8a3a3a);
    runner.position.set(B.x, 0.05, B.z + 6.7);
    group.add(runner);
    const roundRug = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.06, 12), mat(0x8a3a3a, 0.85));
    roundRug.position.set(B.x, 0.05, B.z - 1);
    group.add(roundRug);

    // walls of the whole cross, with sconces that pretend to be gaslight
    const WALLS = [
      [12.8, 0.4, B.x, B.z + 10.5],
      [13.0, 0.4, B.x - 12.4, B.z + 3.2], [13.0, 0.4, B.x + 12.4, B.z + 3.2],
      [0.4, 9.8, B.x - 18.5, B.z - 1.5], [0.4, 9.8, B.x + 18.5, B.z - 1.5],
      [10.0, 0.4, B.x - 13.9, B.z - 6.2], [10.0, 0.4, B.x + 13.9, B.z - 6.2],
      [0.4, 8.8, B.x - 9, B.z - 10.6], [0.4, 8.8, B.x + 9, B.z - 10.6],
      [18.4, 0.4, B.x, B.z - 15],
      [0.4, 7.6, B.x - 6.2, B.z + 6.9], [0.4, 7.6, B.x + 6.2, B.z + 6.9],
    ];
    for (const [w, d, x, z] of WALLS) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.2, d), mat(wallMat));
      wall.position.set(x, 2.6, z);
      group.add(wall);
    }
    for (const [sx, sz] of [[-8, 2.8], [8, 2.8], [-16, -5.8], [16, -5.8], [0, 10.1]]) {
      const sconce = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      sconce.position.set(B.x + sx, 3.4, B.z + sz);
      group.add(sconce);
    }
    group.add(warmLamp(B.x, 4.2, B.z - 1, 0xffe2b0, 60, 30));

    // benches + rope barriers: the furniture of patience
    for (const [bx, bz, ry] of [[B.x - 3, B.z - 3.4, 0.3], [B.x + 3.4, B.z + 0.6, -0.4]]) {
      const bench = box(2.0, 0.4, 0.7, 0x8a5a3a);
      bench.position.set(bx, 0.35, bz);
      bench.rotation.y = ry;
      group.add(bench);
    }
    function rope(x0, z0, x1, z1) {
      for (const [px, pz] of [[x0, z0], [x1, z1]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), mat(0xc9a440, 0.4));
        post.position.set(px, 0.45, pz);
        group.add(post);
      }
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let k = 0; k < 3; k++) {
        const t0 = k / 3, t1 = (k + 1) / 3;
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len / 3, 4), mat(0x8a3a3a, 0.8));
        seg.position.set(
          x0 + (x1 - x0) * (t0 + t1) / 2,
          0.78 - Math.sin(((t0 + t1) / 2) * Math.PI) * 0.08,
          z0 + (z1 - z0) * (t0 + t1) / 2);
        seg.rotation.z = Math.PI / 2;
        seg.rotation.y = Math.atan2(z1 - z0, x1 - x0) * -1;
        group.add(seg);
      }
    }

    // ---------- west wing: the fossil hall
    const sandPit = box(7, 0.3, 5, 0xd9c08f);
    sandPit.position.set(B.x - 14, 0.15, B.z + 0.2);
    group.add(sandPit);
    const halfBone = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 6, 10, Math.PI * 0.8), mat(0xe8e4d8, 0.7));
    halfBone.position.set(B.x - 14.5, 0.3, B.z + 0.4);
    halfBone.rotation.x = -Math.PI / 2.4;
    group.add(halfBone);
    rope(B.x - 17.2, B.z + 2.5, B.x - 10.8, B.z + 2.5);
    const plinthSpots = [];
    for (let i = 0; i < 5; i++) {
      const px = B.x - 17 + i * 1.9;
      const plinth = box(1.0, 0.9 + (i % 2) * 0.25, 1.0, 0xb9c0b9);
      plinth.position.set(px, (0.9 + (i % 2) * 0.25) / 2, B.z - 5.4);
      group.add(plinth);
      plinthSpots.push({ x: px, y: 0.9 + (i % 2) * 0.25 + 0.25, z: B.z - 5.4 });
    }
    // the Mystery Skeleton: assembles itself one donation at a time
    register({
      pos: new THREE.Vector3(B.x - 14, 0, B.z - 3), r: 2.4, zone: 'museum',
      label: '해골 명판 읽기',
      use: () => ui.say('“수수께끼 해골. 종: 미정. 시대: 점심 이전. 기증에 감사히 조립됨.” —F.'),
    });

    // ---------- east wing: the bug hall, six little worlds
    const terrSpots = [];
    for (let i = 0; i < 6; i++) {
      const tx = B.x + 10.5 + (i % 3) * 3.2;
      const tz = B.z - 4.6 + Math.floor(i / 3) * 6.4;
      const stand = box(2.2, 1.0, 1.6, 0x6b4a2e);
      stand.position.set(tx, 0.5, tz);
      group.add(stand);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.18, roughness: 0.1 }));
      glass.position.set(tx, 1.78, tz);
      group.add(glass);
      const bed = box(1.9, 0.12, 1.3, [0x5fb74a, 0x7a5230, 0x3fb0e8, 0x6ec45a, 0x1a2030, 0xd9c08f][i]);
      bed.position.set(tx, 1.1, tz);
      group.add(bed);
      // habitat dressing per tank
      if (i === 0 || i === 3) { // meadow / grass
        for (let k = 0; k < 3; k++) {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), mat(0x4e9a45, 0.9));
          tuft.position.set(tx - 0.5 + k * 0.5, 1.3, tz + (k % 2 ? 0.3 : -0.2));
          group.add(tuft);
        }
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat(0xff6b81, 0.7));
        bloom.position.set(tx + 0.4, 1.45, tz);
        group.add(bloom);
      } else if (i === 1) { // old log
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.3, 7), mat(0x7a5230));
        log.rotation.z = Math.PI / 2;
        log.position.set(tx, 1.3, tz);
        group.add(log);
      } else if (i === 2) { // pond
        const pondT = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), mat(0x57c8d8, 0.2));
        pondT.position.set(tx, 1.18, tz);
        group.add(pondT);
      } else if (i === 4) { // the dark tank
        const shroomT = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 6),
          new THREE.MeshBasicMaterial({ color: 0x7fe8d8 }));
        shroomT.position.set(tx - 0.4, 1.22, tz + 0.2);
        group.add(shroomT);
      } else { // sand
        const pebble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0x9aa0a6));
        pebble.position.set(tx + 0.3, 1.2, tz - 0.2);
        group.add(pebble);
      }
      terrSpots.push({ x: tx, y: 1.7, z: tz });
    }
    register({
      pos: new THREE.Vector3(B.x + 12, 0, B.z - 1.5), r: 2.6, zone: 'museum',
      label: '곤충관 카드 읽기',
      use: () => ui.say('“이 관의 모든 입주자는 자기 서식지를 직접 승인했습니다. 협상은 길었습니다.” —F.'),
    });

    // ---------- north wing: the aquarium
    const tankGlass = new THREE.Mesh(new THREE.BoxGeometry(16, 4.6, 6.5),
      new THREE.MeshStandardMaterial({
        color: 0x2b8fc4, transparent: true, opacity: 0.42, roughness: 0.1, flatShading: true,
      }));
    tankGlass.position.set(B.x, 2.5, B.z - 11.2);
    group.add(tankGlass);
    const tankBack = box(16.2, 4.8, 0.3, 0x1d5a7a);
    tankBack.material.emissive = new THREE.Color(0x0b2f44);
    tankBack.material.emissiveIntensity = 0.25;
    tankBack.receiveShadow = true;
    tankBack.position.set(B.x, 2.5, B.z - 14.5);
    group.add(tankBack);
    const tankSand = box(15.8, 0.3, 6.3, 0xd9c08f);
    tankSand.position.set(B.x, 0.35, B.z - 11.2);
    group.add(tankSand);
    // kelp, light rays, the dark grotto corner for cave species
    const kelps = [];
    for (let i = 0; i < 9; i++) {
      const kelp = new THREE.Group();
      const kx = B.x - 7.2 + i * 1.8;
      const kz = kx > B.x + 2
        ? B.z - 8.05 - (i % 2) * 0.35
        : B.z - 11 + (i % 2) * 1.4;
      for (let seg = 0; seg < 4; seg++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0, 4), mat(0x3f7a45, 0.9));
        blade.position.y = 0.6 + seg * 0.8;
        kelp.add(blade);
      }
      kelp.position.set(kx, 0.4, kz);
      kelps.push(kelp);
      group.add(kelp);
    }
    for (let i = 0; i < 4; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.4),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      ray.position.set(B.x - 6 + i * 4, 2.6, B.z - 11);
      ray.rotation.z = 0.18;
      group.add(ray);
    }
    // a little rock grotto in the right corner — a cave nook for the cave
    // species, framing a soft glow. No flat panel, so the water reads as one tank.
    const ROCKS = [
      [B.x + 3.9, 1.3, B.z - 12.8, 1.3, 0x4c5868],
      [B.x + 7.1, 1.5, B.z - 12.9, 1.4, 0x556272],
      [B.x + 5.6, 3.2, B.z - 13.4, 1.5, 0x47535f], // the overhang
      [B.x + 4.7, 0.7, B.z - 10.6, 0.8, 0x586474],
      [B.x + 6.7, 0.6, B.z - 10.9, 0.7, 0x505c6a],
      [B.x + 5.7, 0.8, B.z - 12.0, 0.6, 0x5e6a78],
    ];
    for (const [rx, ry, rz, rr, rc] of ROCKS) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 0), mat(rc, 0.95));
      rock.position.set(rx, ry, rz);
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      rock.castShadow = true;
      group.add(rock);
    }
    const grottoGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: 0x7fe8d8 }));
    grottoGlow.position.set(B.x + 5.6, 1.5, B.z - 12.2);
    group.add(grottoGlow);
    group.add(warmLamp(B.x + 5.6, 1.8, B.z - 12.0, 0x9af0e0, 40, 9));
    const bubbles = [];
    for (let i = 0; i < 12; i++) {
      const bub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
        new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.7 }));
      bub.userData = { col: i % 3, k: rand(0, 1) };
      bubbles.push(bub);
      group.add(bub);
    }
    rope(B.x - 8.2, B.z - 7.4, B.x + 8.2, B.z - 7.4);

    // ---------- the entrance gallery: nine waiting walls
    const artSlots = [];
    for (let i = 0; i < 9; i++) {
      const west = i < 5;
      const sx = west ? B.x - 5.95 : B.x + 5.95;
      const sz = B.z + 3.9 + (west ? i : i - 5) * 1.55;
      artSlots.push({ x: sx, y: 2.5, z: sz, rotY: west ? Math.PI / 2 : -Math.PI / 2 });
    }

    // dynamic displays live here and rebuild on every donation
    group.add(museumDisplays);
    const swimmers = [];
    const flutterers = [];

    refreshMuseum = () => {
      museumDisplays.clear();
      swimmers.length = 0;
      flutterers.length = 0;
      const donated = S.state.donations.map((id) => ({ id, item: ITEMS[id] })).filter((d) => d.item);

      // fossils → plinths + the Mystery Skeleton gaining parts
      const fossils = donated.filter((d) => d.item.kind === 'fossil');
      fossils.slice(0, plinthSpots.length).forEach((d, i) => {
        const sSpot = plinthSpots[i];
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0xc9bda4, 0.8));
        f.scale.y = 0.7;
        f.position.set(sSpot.x, sSpot.y, sSpot.z);
        museumDisplays.add(f);
      });
      const SKELLY = {
        megalodont_tooth: () => { // the skull, mostly grin
          const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), mat(0xe8e4d8, 0.7));
          skull.scale.set(1.2, 0.8, 0.9);
          skull.position.set(B.x - 17.2, 3.2, B.z - 2.5);
          return [skull];
        },
        trilobutton: () => Array.from({ length: 4 }, (_, k) => {
          const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55 - k * 0.06, 0.07, 5, 8, Math.PI), mat(0xe8e4d8, 0.7));
          rib.position.set(B.x - 15.6 + k * 0.5, 3.0, B.z - 2.5);
          rib.rotation.z = Math.PI;
          return rib;
        }),
        fern_frond: () => Array.from({ length: 5 }, (_, k) => {
          const vert = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xe8e4d8, 0.7));
          vert.position.set(B.x - 16.4 + k * 0.55, 3.55, B.z - 2.5);
          return vert;
        }),
        curlstone: () => { // the splendid spiral tail
          const tail = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 5, 10, Math.PI * 1.6), mat(0xe8e4d8, 0.7));
          tail.position.set(B.x - 12.9, 3.1, B.z - 2.5);
          tail.rotation.z = 0.6;
          return [tail];
        },
        very_old_pebble: () => { // a pebble, where the heart goes
          const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0x9aa0a6, 0.6));
          heart.position.set(B.x - 15.1, 2.9, B.z - 2.4);
          return [heart];
        },
      };
      for (const d of fossils) {
        (SKELLY[d.id]?.() ?? []).forEach((m) => museumDisplays.add(m));
      }

      // fish + tide pool finds → the aquarium (cave species in the grotto)
      const fishes = donated.filter((d) => d.item.kind === 'fish' || d.item.kind === 'pool');
      fishes.forEach((d, i) => {
        const deep = (d.item.where ?? 'sea') === 'cave';
        const hue = (d.id.length * 47 + i * 61) % 360;
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0),
          mat(new THREE.Color(`hsl(${hue}, 60%, ${deep ? 75 : 55}%)`).getHex(), 0.5));
        body.scale.set(1.7, 0.8, 0.8);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4),
          mat(new THREE.Color(`hsl(${hue}, 60%, 45%)`).getHex(), 0.5));
        tail.rotation.z = Math.PI / 2;
        tail.position.x = -0.38;
        const fish = new THREE.Group();
        fish.add(body, tail);
        fish.userData = {
          cx: deep ? B.x + 5.6 : B.x - 2.5,
          cz: B.z - 11.2,
          rx: deep ? 1.4 : 5.5,
          rz: deep ? 1.6 : 2.2,
          y: 1.2 + (i % 4) * 0.75,
          ph: i * 1.3,
          sp: rand(0.25, 0.5),
        };
        swimmers.push(fish);
        museumDisplays.add(fish);
      });

      // bugs → their terrariums
      const TANK_OF = {
        lemon_flit: 0, paper_wisp: 0, rose_skipper: 0, sky_dancer: 0,
        buttonshell_beetle: 1, dewdrop_dragonfly: 2, meadow_cricket: 3,
        cave_glimmerwing: 4, lantern_firefly: 4, garden_snail: 5, ladybird: 5,
      };
      const BUG_TINT = {
        lemon_flit: 0xfff3a8, paper_wisp: 0xffffff, rose_skipper: 0xffb3d1,
        sky_dancer: 0x9fd8ff, buttonshell_beetle: 0x3a3228, dewdrop_dragonfly: 0x57c8d8,
        meadow_cricket: 0x6f9a45, cave_glimmerwing: 0xd8fff2, lantern_firefly: 0xffe98f,
        garden_snail: 0x8a5a3a, ladybird: 0xd84f4f,
      };
      donated.filter((d) => d.item.kind === 'bug').forEach((d, i) => {
        const tank = terrSpots[TANK_OF[d.id] ?? 0];
        const bug = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(BUG_TINT[d.id] ?? 0xffd23e, 0.5));
        const flies = [0, 2, 4].includes(TANK_OF[d.id]);
        bug.userData = { cx: tank.x, cz: tank.z, y: flies ? tank.y : tank.y - 0.5, ph: i * 1.7, flies };
        flutterers.push(bug);
        museumDisplays.add(bug);
      });

      // art → the entrance gallery
      const arts = donated.filter((d) => d.item.kind === 'art');
      artSlots.forEach((slot, i) => {
        const piece = arts[i] ? artPiece(arts[i].id) : null;
        if (piece) {
          const framed = makeFramed(piece);
          framed.position.set(slot.x, slot.y, slot.z);
          framed.rotation.y = slot.rotY;
          museumDisplays.add(framed);
        } else {
          const empty = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 1.2), mat(0xc8c2b2, 0.9));
          empty.position.set(slot.x, slot.y, slot.z);
          museumDisplays.add(empty);
        }
      });
    };
    refreshMuseum();

    // the halls breathe only while you're inside them
    updates.push((dt, t) => {
      if (zones.current() !== 'museum') return;
      for (const fish of swimmers) {
        const u = fish.userData;
        const a = t * u.sp + u.ph;
        fish.position.set(u.cx + Math.sin(a) * u.rx, u.y + Math.sin(a * 2) * 0.2, u.cz + Math.sin(a * 2) * u.rz * 0.5);
        fish.rotation.y = Math.atan2(Math.cos(a) * u.rx, Math.cos(a * 2) * u.rz) + Math.PI / 2;
      }
      for (const bug of flutterers) {
        const u = bug.userData;
        if (u.flies) {
          bug.position.set(u.cx + Math.cos(t * 1.3 + u.ph) * 0.5, u.y + Math.sin(t * 2 + u.ph) * 0.25, u.cz + Math.sin(t * 1.1 + u.ph) * 0.35);
        } else {
          bug.position.set(u.cx + Math.cos(u.ph) * 0.5, u.y + Math.max(0, Math.sin(t * 2.4 + u.ph)) * 0.08, u.cz + Math.sin(u.ph) * 0.3);
        }
      }
      for (let i = 0; i < kelps.length; i++) {
        kelps[i].rotation.z = Math.sin(t * 0.8 + i) * 0.08;
      }
      for (const bub of bubbles) {
        bub.userData.k = (bub.userData.k + dt * 0.12) % 1;
        bub.position.set(
          B.x - 5 + bub.userData.col * 4 + Math.sin(t + bub.userData.k * 9) * 0.15,
          0.6 + bub.userData.k * 3.8,
          B.z - 11.5);
        bub.material.opacity = 0.7 * (1 - bub.userData.k * 0.6);
      }
    });

    const fern = npcAt('tortoise', { body: 0x9aa86b, head: 0x9aa86b }, B.x - 1.5, B.z - 2.2, 0.4);
    group.add(fern);
    wireNpcBob(fern, updates, 0.5);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('museum', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 18.1, x1: B.x + 18.1, z0: B.z - 14.6, z1: B.z + 10.1 },
      blockers: [
        { x: B.x - 12.25, z: B.z + 7, r: 6.4 }, { x: B.x + 12.25, z: B.z + 7, r: 6.4 },
        { x: B.x - 13.9, z: B.z - 10.5, r: 5.2 }, { x: B.x + 13.9, z: B.z - 10.5, r: 5.2 },
        { x: B.x - 5.4, z: B.z - 11.2, r: 3.6 }, { x: B.x, z: B.z - 11.2, r: 3.6 }, { x: B.x + 5.4, z: B.z - 11.2, r: 3.6 }, // the tank — full width, no walking in
        { x: B.x - 14, z: B.z + 0.2, w: 7, d: 5 }, // the dig pit (its rim, not a circle inside it)
        { x: B.x - 1.5, z: B.z - 2.2, r: 1.0 }, // Fern
        // the benches, the fossil plinths, the terrarium stands (none was solid)
        { x: B.x - 3, z: B.z - 3.4, w: 2.0, d: 0.7, rot: 0.3 }, { x: B.x + 3.4, z: B.z + 0.6, w: 2.0, d: 0.7, rot: -0.4 },
        ...[0, 1, 2, 3, 4].map((i) => ({ x: B.x - 17 + i * 1.9, z: B.z - 5.4, w: 1.0, d: 1.0 })),
        ...[0, 1, 2, 3, 4, 5].map((i) => ({ x: B.x + 10.5 + (i % 3) * 3.2, z: B.z - 4.6 + Math.floor(i / 3) * 6.4, w: 2.2, d: 1.6 })),
      ],
      spawn: { x: B.x, z: B.z + 9.4, rotY: Math.PI },
      lighting: {
        bg: 0x1c2026, fog: 0x1c2026, fogNear: 30, fogFar: 80,
        hemiSky: 0xf2ead8, hemiGround: 0x5a6258, hemiIntensity: 1.2,
        sunIntensity: 0,
      },
    });

    register({
      pos: new THREE.Vector3(spots.museum.x, 0, spots.museum.z + spots.museum.d / 2 + 0.4), r: 2.6,
      label: '낫벨 박물관 들어가기',
      use: async () => {
        await zones.go('museum');
        if (!S.hasFlag('sawBigInside')) {
          S.setFlag('sawBigInside');
          ui.say('틀림없이, 안이 훨씬 넓어요. 문 옆 작은 명판이 설명해요: "건물이 컬렉션을 존경합니다."');
        }
      },
    });
    register({
      pos: new THREE.Vector3(IN.museum.x, 0, IN.museum.z + 9.9), r: 1.8,
      zone: 'museum', label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: spots.museum.x, z: spots.museum.z + spots.museum.d / 2 + 2.2, rotY: 0 }),
    });

    register({
      getPos: () => fern.position, r: 3, zone: 'museum',
      label: '펀과 대화하기',
      use: () => fernMenu(refreshMuseum),
    });
  }

  // ============================================================ Notbell Post
  // The sorting hall. Not open for business yet — open for VISITS, which is
  // different, and Moss will explain the difference at his own pace.
  {
    const roomStart = group.children.length;
    const B = IN.post;
    group.add(buildRoom(B, 12, 9, 0x9a6b42, 0xefe0c4));

    const counter = box(4.5, 1.05, 1.1, 0x8a5a3a);
    counter.position.set(B.x - 0.5, 0.52, B.z - 1.2);
    group.add(counter);
    const postLamp = makeHangingLamp(0x4a6a9c); // postal blue, of course
    postLamp.position.set(B.x - 0.5, 2.95, B.z - 1.2);
    group.add(postLamp);

    // the pigeon-hole wall: every cubby a promise, some already kept
    const board = box(5.8, 3.0, 0.35, 0x6b4a2e);
    board.position.set(B.x - 2.4, 1.9, B.z - 4.1);
    group.add(board);
    const LETTERED = new Set([1, 4, 8, 9, 14, 16]);
    for (let i = 0; i < 18; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const sx = B.x - 2.4 - 2.1 + col * 0.84, sy = 0.95 + row * 0.86;
      const slot = box(0.74, 0.74, 0.14, 0x40332a);
      slot.position.set(sx, sy, B.z - 3.9);
      group.add(slot);
      if (LETTERED.has(i)) {
        const slip = box(0.5, 0.34, 0.1, 0xfff6e0);
        slip.position.set(sx, sy - 0.1, B.z - 3.8);
        slip.rotation.z = (i % 3 - 1) * 0.08; // filed, not flattened
        group.add(slip);
      }
    }
    { // one cubby holds a whole bottle. it fit. nobody asked how
      const cubbyBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.62, 7), mat(0x9fd4d4, 0.3));
      cubbyBottle.rotation.x = Math.PI / 2 - 0.25;
      cubbyBottle.position.set(B.x - 2.4 + 2.1, 1.75, B.z - 3.72);
      group.add(cubbyBottle);
    }

    // the sorting line: today's letters, pinned like laundry, in order of patience
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5, 5), mat(0x8a7a5e, 0.9));
    rope.rotation.z = Math.PI / 2;
    rope.position.set(B.x - 0.5, 2.5, B.z - 2.4);
    group.add(rope);
    [-1.8, -0.6, 0.6, 1.8].forEach((ox, i) => {
      const clip = box(0.06, 0.12, 0.05, 0x4a4f55);
      clip.position.set(B.x - 0.5 + ox, 2.44, B.z - 2.4);
      group.add(clip);
      const letter = box(0.34, 0.26, 0.02, 0xfff6e0);
      letter.position.set(B.x - 0.5 + ox, 2.26, B.z - 2.4);
      letter.rotation.y = (i % 2 ? -1 : 1) * 0.12;
      group.add(letter);
    });

    // the brass scale: for weighing words
    const scalePost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.32, 6), mat(0xc9962e, 0.45));
    scalePost.position.set(B.x + 1.1, 1.2, B.z - 1.2);
    const beam = box(0.72, 0.04, 0.04, 0xc9962e);
    beam.position.set(B.x + 1.1, 1.38, B.z - 1.2);
    group.add(scalePost, beam);
    for (const sx of [-0.3, 0.3]) {
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 8), mat(0xc9962e, 0.45));
      pan.position.set(B.x + 1.1 + sx, 1.28, B.z - 1.2);
      group.add(pan);
    }

    // arrivals: a crate of bottles with the sea still in their voices
    const crate = box(1.1, 0.5, 0.8, 0x8a5a3a);
    crate.position.set(B.x + 3.6, 0.25, B.z - 3.3);
    group.add(crate);
    for (const [bx, tilt] of [[-0.28, 0.2], [0.04, -0.12], [0.34, 0.3]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.6, 7), mat(0x9fd4d4, 0.3));
      b.position.set(B.x + 3.6 + bx, 0.66, B.z - 3.3);
      b.rotation.z = tilt;
      group.add(b);
    }

    // a clock, which is fine. it's not the clock that's slow
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), mat(0xfff6e0, 0.7));
    clockFace.rotation.z = Math.PI / 2;
    clockFace.position.set(B.x + 5.75, 2.6, B.z - 0.5);
    group.add(clockFace);
    const minuteHand = box(0.04, 0.3, 0.03, 0x3a342c);
    minuteHand.position.set(B.x + 5.7, 2.7, B.z - 0.5);
    const hourHand = box(0.04, 0.2, 0.03, 0x3a342c);
    hourHand.rotation.x = 1.1;
    hourHand.position.set(B.x + 5.7, 2.58, B.z - 0.42);
    group.add(minuteHand, hourHand);

    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 9), mat(0xb0453a, 0.9));
    rug.position.set(B.x, 0.05, B.z + 1.2);
    rug.receiveShadow = true;
    group.add(rug);

    // Moss, Postmaster. On a stool, like Pip — professional courtesy
    const mossStool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.5, 8), mat(0x6b4a2e));
    mossStool.position.set(B.x - 0.5, 0.25, B.z - 2.3);
    group.add(mossStool);
    const moss = buildAnimal('sloth', { body: 0x9a8a72, head: 0xa5947c });
    moss.position.set(B.x - 0.5, 0.5, B.z - 2.3);
    moss.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(moss);
    updates.push((dt, t) => {
      if (zones.current() !== 'post') return;
      const p = moss.userData.parts;
      if (p?.body) p.body.position.y = p.bodyY + Math.sin(t * 0.5) * 0.015; // breathing, at leisure
    });

    const MOSS_LINES = [
      '“우편이 느리다고들 해.” 그가 편지를 뒤집어 뒷면을 읽고 만족스럽게 고개 끄덕여요. “우편은 철저해.”',
      '“여기 모든 건 바다에서 나왔어. 소금에 절이고, 병에서 숙성시켰지. 빈티지를 서두르지 않듯 엽서도 서두르지 않아.”',
      '“우표들이 좋아.” 우표를 분명히 감상하는 침묵. “어떤 건 버튼이야.”',
      '“주소 없는 봉투가 하나 있어. 종 그림만.” 그가 조심스럽게 B 아래로 파일해요. “모든 건 결국 갈 곳을 찾아. 내가 증거야.”',
    ];
    let mossIdx = 0;
    register({
      pos: new THREE.Vector3(B.x - 0.5, 0, B.z - 2.3), r: 3.2, zone: 'post',
      label: '카운터 방문하기',
      use: async () => {
        if (!S.hasFlag('metMoss')) {
          S.setFlag('metMoss');
          await ui.say([
            '나무늘보가 당신 쪽으로 돌아봐요. 시간이 좀 걸려요. 기다릴 가치가 있어요.',
            '“모스,” 그가 말해요. “우체국장. 분류가 끝났어. 철저하지 않게 되어서, 멈췄지.”',
            '“카운터 열렸어. 섬 누구에게나 편지. 우표 한 장.”',
          ], { speaker: '모스', voice: 200 });
          return;
        }
        // the counter first; a little chat if you're just visiting
        if (await mail.counter()) return;
        await ui.say(MOSS_LINES[mossIdx++ % MOSS_LINES.length], { speaker: '모스', voice: 200 });
      },
    });
    register({
      pos: new THREE.Vector3(B.x + 3.6, 0, B.z - 3.3), r: 2.0, zone: 'post',
      label: '상자 들여다보기',
      use: () => ui.say('(도착품 상자, 코르크가 아직 축축해요. 한 병엔 켈프만 들었어요. 켈프에도 주소가 있어요.)'),
    });

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('post', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.5, x1: B.x + 5.5, z0: B.z - 3.2, z1: B.z + 4.1 },
      blockers: [
        { x: B.x - 0.5, z: B.z - 1.9, w: 4.6, d: 2.6 }, // the counter and Moss's side of it (a box: the old circle kept you out of reach of him)
        { x: B.x + 3.6, z: B.z - 3.3, r: 0.9 }, // the crate
      ],
      spawn: { x: B.x, z: B.z + 3.5, rotY: Math.PI },
      lighting: {
        bg: 0x241c14, fog: 0x241c14, fogNear: 24, fogFar: 60,
        hemiSky: 0xffe6c0, hemiGround: 0x6b5135, hemiIntensity: 1.2,
        sunIntensity: 0,
      },
    });

    register({
      pos: new THREE.Vector3(spots.post.x - 2.9, 0, spots.post.z), r: 2.4,
      label: '낫벨 우체국 들어가기',
      use: async () => {
        await zones.go('post');
        if (!S.hasFlag('sawPost')) {
          S.setFlag('sawPost');
          ui.say('소금, 종이, 인내 냄새가 나요. 카운터 뒤 어딘가에서 편지가 편지답게 읽히고 있어요.');
        }
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 3.8), r: 1.6,
      zone: 'post', label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: spots.post.x - 3.8, z: spots.post.z, rotY: -Math.PI / 2 }),
    });
  }

  // ------------------------------------------------------------- update ----
  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

// gentle breathing for the standing shopkeepers
function wireNpcBob(npc, updates, speed = 1) {
  const parts = npc.userData.parts;
  const phase = rand(0, Math.PI * 2);
  updates.push((dt, t, playerPos) => {
    parts.body.position.y = parts.bodyY + Math.sin(t * 1.6 * speed + phase) * 0.03;
    parts.head.position.y = parts.headY + Math.sin(t * 1.6 * speed + phase + 0.5) * 0.025;
    if (playerPos) {
      const dx = playerPos.x - npc.position.x;
      const dz = playerPos.z - npc.position.z;
      if (Math.hypot(dx, dz) < 7) {
        npc.rotation.y = turnToward(npc.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
    }
  });
}

// ----------------------------------------------------------- Pip's menus ----

const PIP_CHAT = [
  '버튼이라고, 친구! 보물이기도 한 유일한 화폐. 감정으로 월세 내봐. 안 돼. 버튼은 돼.',
  '이 가게의 모든 건 잃어버렸다가, 주웠다가, 떠밀려 왔거나, “배에서 떨어진” 거야. 전부 법적으로 별개의 분류야.',
  '늙은 탠지의 버튼 병이 이 경제 전체를 시작했어, 알아? 창틀에 올라간 최고의 재정 정책이지.',
  '거기서 반짝이는 걸 찾으면 — 뭐든 — 최고가 버튼으로 살게. 질문 없어. 가벼운 평가는 있지만, 질문은 없어.',
];
let pipChatIdx = 0;

async function pipMenu() {
  if (!S.hasFlag('metPip')) {
    S.setFlag('metPip');
    S.giveTool('rod');
    await ui.say([
      '이런, 이런! 새 얼굴에 버튼이 하나도 없— 아니 잠깐, 몇 개 있네. 소리가 들려.',
      '핍이라고 해. 잡동사니, 보물, 쓰레기 — 그 사이의 경계는 솔직히 자신감뿐이야.',
      '자. 낚싯대, 서비스야. 첫 번째는 공짜. 그게 내 수법이지!',
    ], { speaker: '핍', voice: VOICE.pip });
    jingle();
    ui.toast('핍이 <b>떠내려온 나무 낚싯대</b>를 줬어요! 물을 찾아 E를 누르세요.', '🎣');
    ui.updateHUD();
    return;
  }

  // holidays loosen even a magpie's grip on his buttons (once a year)
  if (HOLIDAY && !S.hasFlag(`gift_${HOLIDAY.id}_${new Date().getFullYear()}`)) {
    S.setFlag(`gift_${HOLIDAY.id}_${new Date().getFullYear()}`);
    S.earn(100);
    kaching();
    ui.updateHUD();
    await ui.say([
      `Happy ${HOLIDAY.name}! Here — a hundred buttons. A GIFT. From ME.`,
      '이상하게 만들지 마. 아무에게도 말하지 마. 가능하면 여기서 써.',
    ], { speaker: '핍', voice: VOICE.pip });
  }

  const choice = await ui.ask('뭘로 할래?', [
    { label: '사기', value: 'buy' },
    { label: '팔기', value: 'sell' },
    { label: '수다 떨기', value: 'chat' },
    { label: '나가기', value: 'leave' },
  ], { speaker: '핍', voice: VOICE.pip });

  if (choice === 'buy') return pipBuy();
  if (choice === 'sell') return pipSell();
  if (choice === 'chat') {
    await ui.say(PIP_CHAT[pipChatIdx++ % PIP_CHAT.length], { speaker: '핍', voice: VOICE.pip });
    return pipMenu();
  }
}

async function pipBuy() {
  const choice = await ui.ask('구경해 봐! 전부 판매 중. 거의. 대부분.', [
    { label: '🛠️ 도구', value: 'tools' },
    { label: '🌱 씨앗', value: 'seeds' },
    { label: '🎩 모자', value: 'hats' },
    { label: '🔘 가장 반짝이는 버튼', value: 'button', hint: '999🔘' },
    { label: '됐어요', value: 'leave' },
  ], { speaker: '핍', voice: VOICE.pip });

  if (choice === 'tools') return pipBuyTools();
  if (choice === 'seeds') return pipBuySeeds();
  if (choice === 'hats') return pipBuyHats();
  if (choice === 'button') {
    await ui.say([
      '아, 안목 좋은데! 가장 반짝이는 버튼. 버튼 999개, 진짜 특가야, 잠깐—',
      '…',
      '안 돼. 안 돼. 못 팔아. 그건 내 거야. 가격 매길 때 패닉이었어. 제발 말 그대로 딴 거 사 줘.',
    ], { speaker: '핍', voice: VOICE.pip });
    return pipMenu();
  }
  return pipMenu();
}

async function pipBuyTools() {
  const wares = [
    !S.state.tools.net && { label: `${ITEMS.net.emoji} 민들레 그물`, value: 'net', hint: `${ITEMS.net.price}🔘`, disabled: S.state.buttons < ITEMS.net.price },
    !S.state.tools.shovel && { label: `${ITEMS.shovel.emoji} 뭉툭한 삽`, value: 'shovel', hint: `${ITEMS.shovel.price}🔘`, disabled: S.state.buttons < ITEMS.shovel.price },
    !S.countItem('scuba_suit') && { label: `${ITEMS.scuba_suit.emoji} 인양 잠수복`, value: 'scuba', hint: `${ITEMS.scuba_suit.price}🔘`, disabled: S.state.buttons < ITEMS.scuba_suit.price },
    !S.countItem('skateboard') && { label: `${ITEMS.skateboard.emoji} 스케이트보드`, value: 'skateboard', hint: `${ITEMS.skateboard.price}🔘`, disabled: S.state.buttons < ITEMS.skateboard.price },
    { label: '뒤로', value: 'back' },
  ].filter(Boolean);
  if (wares.length === 1) {
    await ui.say('장비는 이미 다 갖췄네! 대단해. 프로야.', { speaker: '핍', voice: VOICE.pip });
    return pipBuy();
  }
  const choice = await ui.ask('내가 인정하는 모든 기술의 도구들:', wares,
    { speaker: '핍', voice: VOICE.pip });
  if (choice === 'scuba') {
    S.spend(ITEMS.scuba_suit.price);
    S.addItem('scuba_suit');
    kaching();
    ui.toast(`You bought the <b>${ITEMS.scuba_suit.name}</b>! <i>Walk into the sea like you mean it.</i>`, ITEMS.scuba_suit.emoji);
    ui.updateHUD();
    await ui.say([
      '아아, 잠수복. 탠지의 인양 잠수부 중 한 명 것이었지 — 종을 찾아 물속에서 여름 내내. 버튼으로 받았어. 사실 버튼의 시작이었지.',
      '헬멧이 종 모양이야. 전부 그랬어. 잠수부 유머인지, 잠수부 희망인지. 아무도 묻지 않았어.',
      S.state.avatar?.kind === 'duck'
        ? '…너 오리잖아. 뜨는데. 뭐 어때? 패션은 패션이지. 환불 불가.'
        : '아무 데나 들어가서 계속 가면 돼. 제대로 차려입으면 바다는 아주 협조적이야.',
    ], { speaker: '핍', voice: VOICE.pip });
  }
  if (choice === 'skateboard') {
    S.spend(ITEMS.skateboard.price);
    S.addItem('skateboard');
    kaching();
    ui.toast(`You bought the <b>${ITEMS.skateboard.name}</b>! <i>Hold run (or double-tap a direction) to skate.</i>`, ITEMS.skateboard.emoji);
    ui.updateHUD();
    await ui.say([
      '스케이트보드! 배에서 떨어진 거야. 공식적으로. 딱 한 번 타봤는데 경험을 표현하자면 “공기역학적”이었어.',
      '달리기를 누르고 있으면 올라타. 놓으면 내려. 광장은 아주 매끄러워. 언덕은 아주 가팔라. 현명하게 선택해, 아니 더 좋은 건, 하지 마.',
    ], { speaker: '핍', voice: VOICE.pip });
  }
  if (choice === 'net' || choice === 'shovel') {
    S.spend(ITEMS[choice].price);
    S.giveTool(choice);
    kaching();
    ui.toast(`You bought the <b>${ITEMS[choice].name}</b>! <i>${ITEMS[choice].blurb}</i>`, ITEMS[choice].emoji);
    ui.updateHUD();
    await ui.say(choice === 'net'
      ? '그물! 펄럭이는 것 근처에서 휘둘러. 살살! 얘네도 누군가의 이웃이야.'
      : '삽! 금 간 흙이 별 모양으로 보이면, 그건 섬이 윙크하는 거야. 거기 파.',
      { speaker: '핍', voice: VOICE.pip });
  }
  return pipBuy();
}

async function pipBuySeeds() {
  const seeds = Object.keys(GROWTH);
  const choice = await ui.ask('씨앗! 작은 약속들. 정원 밭에 심어.', [
    ...seeds.map((id) => ({
      label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id,
      hint: `${ITEMS[id].price}🔘`, disabled: S.state.buttons < ITEMS[id].price,
    })),
    { label: '뒤로', value: 'back' },
  ], { speaker: '핍', voice: VOICE.pip });
  if (choice !== 'back' && GROWTH[choice]) {
    S.spend(ITEMS[choice].price);
    S.addItem(choice);
    kaching();
    ui.toast(`Bought <b>${ITEMS[choice].name}</b>.`, ITEMS[choice].emoji);
    ui.updateHUD();
    return pipBuySeeds(); // stock up without re-navigating
  }
  return pipBuy();
}

async function pipBuyHats() {
  const stock = SHOP_HATS.filter((id) => !S.state.hats.includes(id));
  if (!stock.length) {
    await ui.say('내 모자를 전부 샀네! 섬 최고의 패셔니스타. 네 거야. 갖고 있어.',
      { speaker: '핍', voice: VOICE.pip });
    return pipBuy();
  }
  const choice = await ui.ask('모자! 안목 있는 머리를 위해. 환불 불가.', [
    ...stock.map((id) => ({
      label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id,
      hint: `${ITEMS[id].price}🔘`, disabled: S.state.buttons < ITEMS[id].price,
    })),
    { label: '뒤로', value: 'back' },
  ], { speaker: '핍', voice: VOICE.pip });
  if (choice !== 'back' && ITEMS[choice]) {
    S.spend(ITEMS[choice].price);
    S.ownHat(choice);
    kaching();
    ui.toast(`You bought the <b>${ITEMS[choice].name}</b>! Press <b>H</b> to wear it.`, ITEMS[choice].emoji);
    ui.updateHUD();
    if (choice === 'keepers_cap') {
      await ui.say('…그건 잘 간직해. 그게 한 번은 우리 모두를 지켜줬어.', { speaker: '핍', voice: VOICE.pip });
    }
    return pipBuyHats();
  }
  return pipBuy();
}

async function pipSell() {
  const stock = S.sellables();
  if (!stock.length) {
    await ui.say('빈 주머니! 뭐 — 물건이 없다는 거지. 버튼 소리는 여전히 들려. 가서 뭘 잡아와.',
      { speaker: '핍', voice: VOICE.pip });
    return pipMenu();
  }
  const choices = stock.map(({ id, n, item }) => {
    const f = S.marketFactor(id);
    return {
      label: `${item.emoji} ${item.name} ×${n}${f < 1 ? ' 📉' : ''}`,
      value: id,
      hint: `${Math.floor(item.price * f) * n}🔘`,
    };
  });
  choices.push({ label: '판매 완료', value: 'done' });

  const choice = await ui.ask('섬이 뭘 줬는지 보자!', choices,
    { speaker: '핍', voice: VOICE.pip });
  if (choice === 'done') return pipMenu();

  const n = S.countItem(choice);
  const factor = S.marketFactor(choice);
  const total = Math.floor(ITEMS[choice].price * factor) * n;
  const wasGlutted = factor < 1;
  S.removeItem(choice, n);
  S.earn(total);
  S.recordSale(choice, n);
  kaching();
  ui.toast(`${n}개의 <b>${ITEMS[choice].name}</b>을(를) <b>${total}</b> 버튼에 팔았어요!`, '🔘');
  ui.updateHUD();
  if (choice === 'old_boot') {
    await ui.say('부츠! 한 짝. 중고. 대부분의 곳에서 공격적으로 방수. 살게.',
      { speaker: '핍', voice: VOICE.pip });
  } else if (!wasGlutted && S.marketFactor(choice) < 1) {
    await ui.say([
      `Whoa whoa whoa. That is a LOT of ${ITEMS[choice].name}. The market is officially FLOODED.`,
      '그건 내일까지 반값. 수요! 공급! 규칙은 내가 안 만들어. (규칙은 내가 만들어.)',
    ], { speaker: '핍', voice: VOICE.pip });
  }
  return pipSell();
}

// ---------------------------------------------------------- Luna's menus ----

const LUNA_CHAT = [
  '나방은 평판이 있지. 현관등에 한 번 펄럭이면 갑자기 “집착”이래. 이건 커리어야.',
  '저 램프는 옛 등대 것이야. 펀이 직접 절벽에서 내렸어. 두 여름 걸렸어. 본인은 한 여름이라고 해. 그렇게 둬.',
  '좋은 커피의 비결은 인내. 최고의 커피의 비결은 더 가고 싶은 데가 없는 나방이야.',
  '어떤 밤엔 램프가 스스로 따뜻해져. 나는 곁에 앉아. 우린 그 얘긴 안 해.',
  '절벽 아래 동굴? 사랑스러운 빛, 아주 예의 바른 벌레들. 루나가 보냈다 하면 아무 일도 안 일어나. 벌레거든.',
];
let lunaChatIdx = 0;

async function lunaMenu() {
  if (!S.hasFlag('metLuna')) {
    S.setFlag('metLuna');
    await ui.say([
      '오 — 새 얼굴! 랜턴 룸에 온 걸 환영해. 아무 데나 앉아. 램프가 동반을 좋아해.',
      '나는 루나. 커피를 만들고, 빛을 돌보고, 그리고, 응, 나방이야. 우리는 이 구도가 아주 웃기다고 생각해.',
    ], { speaker: '루나', voice: VOICE.luna });
  }
  const choice = await ui.ask('뭘 데워 드릴까요?', [
    { label: `☕ 랜턴 로스트`, value: 'coffee', hint: `${COFFEE_PRICE}🔘`, disabled: S.state.buttons < COFFEE_PRICE },
    { label: '수다 떨기', value: 'chat' },
    { label: '나가기', value: 'leave' },
  ], { speaker: '루나', voice: VOICE.luna });

  if (choice === 'coffee') {
    S.spend(COFFEE_PRICE);
    S.drinkCoffee(COFFEE_BOOST_SECS);
    sip();
    ui.updateHUD();
    await ui.say('조심해요, 따뜻해요. 그러니까, 등대급 따뜻함.', { speaker: '루나', voice: VOICE.luna });
    ui.toast(`반짝이는 기분이에요. <i>${COFFEE_BOOST_SECS}초간 빨라져요!</i>`, '☕');
    return;
  }
  if (choice === 'chat') {
    await ui.say(LUNA_CHAT[lunaChatIdx++ % LUNA_CHAT.length], { speaker: '루나', voice: VOICE.luna });
    return lunaMenu();
  }
}

// ---------------------------------------------------------- Fern's menus ----

const FERN_CHAT = [
  '박물관이란 조명이 좋아진 기억일 뿐이란다, 얘야.',
  '여기 모든 게 나보다 나이 많아. 장담하는데, 그건 업적이야.',
  '화석 관에서는 천천히 가렴. 수백만 년을 기다렸단다; 서두르는 걸 무례하다 여기셔.',
];
let fernChatIdx = 0;

const FERN_THANKS = {
  fossil: '아… 아! 이거 기억나. 직접은 아니야. 대부분 직접은 아니야. 받침대로 가자꾸나.',
  fish: '수조로 가렴, 작은 것아. 조류 조심하고 — 분위기용으로 설치했는데 의견이 많아.',
  pool: '조수 웅덩이에서! 바다가 가장 이상한 작은 대사들을 보냈구나. 명예의 자리를 드리마.',
  bug: '오, 사랑스러워. 곤충 벽이 자라는구나. 거기 곤충들은, 전해 들으니, 이에 대해 몹시 우쭐한단다.',
};

async function fernMenu(refreshMuseum) {
  if (!S.hasFlag('metFern')) {
    S.setFlag('metFern');
    await ui.say([
      '음. 어서 오렴, 어서 오렴. 펀이야 — 큐레이터, 거북, 섬이 잊고 싶지 않은 모든 것의 관리인.',
      '선반이 끔찍하게 비었구나, 얘야. 섬이 보여 주는 걸 가져오렴: 물고기, 곤충, 화석, 조수 웅덩이 괴상한 것들.',
      '하나하나가 이야기의 조금을 품고 있어. 충분히 가져오면, 제대로 들려주마.',
    ], { speaker: '펀', voice: VOICE.fern });
    return;
  }

  const choice = await ui.ask('그래, 얘야?', [
    { label: '발견물 기증하기', value: 'donate' },
    { label: '수다 떨기', value: 'chat' },
    { label: '나가기', value: 'leave' },
  ], { speaker: '펀', voice: VOICE.fern });

  if (choice === 'chat') {
    const n = S.state.donations.length;
    const line = n === 0
      ? '선반은 아직 비었구나, 얘야. 섬은 관대하단다 — 가서 좀 자랑하게 두렴.'
      : FERN_CHAT[fernChatIdx++ % FERN_CHAT.length];
    await ui.say(line, { speaker: '펀', voice: VOICE.fern });
    return fernMenu(refreshMuseum);
  }
  if (choice !== 'donate') return;

  const options = S.donatables().map(({ id, item }) => ({
    label: `${item.emoji} ${item.name}`, value: id,
  }));
  if (!options.length) {
    await ui.say('지금은 컬렉션에 새로 들일 게 없구나. 섬이 제공할 거야. 항상 그래 왔어, 결국엔. 나는 알지.',
      { speaker: '펀', voice: VOICE.fern });
    return fernMenu(refreshMuseum);
  }
  options.push({ label: '오늘은 패스', value: 'cancel' });
  const pickId = await ui.ask('뭘 가져왔니?', options,
    { speaker: '펀', voice: VOICE.fern });
  if (pickId === 'cancel') return fernMenu(refreshMuseum);

  S.donate(pickId);
  refreshMuseum();
  jingle();
  ui.toast(`<b>${ITEMS[pickId].name}</b>을(를) 박물관에 기증했어요!`, '🏛️');
  await ui.say(FERN_THANKS[ITEMS[pickId].kind] || '소중히 여기마.', { speaker: '펀', voice: VOICE.fern });

  // milestone lore — the island's story, a chapter at a time
  const n = S.state.donations.length;
  for (const lore of FERN_LORE) {
    if (n >= lore.at && S.state.loreToldUpTo < lore.at) {
      S.state.loreToldUpTo = lore.at;
      S.save();
      await ui.say(lore.text, { speaker: '펀', voice: VOICE.fern });
      break;
    }
  }
  return fernMenu(refreshMuseum);
         }
