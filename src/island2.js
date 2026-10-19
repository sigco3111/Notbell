// The Far Isle: a smaller, quieter neighbor. A grocery with a lobster
// behind the counter, a church with no bell and no plans to get one,
// a public garden, and — half-buried on the north beach — the Old Singer.

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS, GROWTH } from './catalog.js';
import { kaching, sip, jingle } from './audio.js';
import { buildAnimal } from './animals.js';
import { rand, pick, turnToward } from './utils.js';
import { makeWindow } from './buildings.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}

const IN = {
  grocery: { x: 300, z: 900 },
  church: { x: 300, z: 980 },
};

const VOICE = { barnaby: 290, alder: 410 };

const BARNABY_CHAT = [
  '아침 기차에서 방금 내린 신선함! 기차는 아무것도 안 실어요. 그냥 이 말이 좋아서요.',
  '랍스터가 식료품점을 하는데 아무도 수프 농담을 안 해요. 멋진 섬. 멋진 사람들.',
  '알더 수사님이 촛농 조각을 미역과 교환해 줘요. 조각으로 뭘 하냐고는 묻지 마세요. (불을 켜요. 좋아요.)',
  '제 사촌이 당신 섬 조수 웅덩이에 살아요. 손은 흔들어요. 안 친해요.',
];
let barnabyChatIdx = 0;

const ALDER_LORE = [
  '우리는 듣는 이들이오, 걷는 이여. 신도 모시지 않고 종도 울리지 않소. 바다가 빌려 간 그 하나를 기다리며 들을 뿐.',
  '안개가 짙으면, 신도 전원이 가만히 앉아 있소. 종소리를 들었다는 이도 있고, 하웰 소리를 들었다는 이도 있소. 둘 다 나름대로 신성하오.',
  '종루는 일부러 비워 두오. 종이 있어야 할 자리의 빈 공간 자체가 하나의 종이오. 그걸 곱씹으며 앉아 있어도 좋고, 그냥 앉아 있어도 좋소 — 앉는 것도 좋은 것이오.',
];
let alderLoreIdx = 0;

export function createIsland2() {
  const group = new THREE.Group();
  const updates = [];
  const T = SITES.town2;
  const ty = terrainHeight(T.x, T.z);

  // a lamp post for the little square
  const post = box(0.14, 2.6, 0.14, 0x55483a);
  post.position.set(T.x, ty + 1.3, T.z + 2);
  const lampGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd98f }));
  lampGlow.position.set(T.x, ty + 2.7, T.z + 2);
  group.add(post, lampGlow);

  // ====================================================== Barnaby's
  const gSpot = { x: T.x - 6, z: T.z - 3 };
  {
    const gy = terrainHeight(gSpot.x, gSpot.z);
    const ext = new THREE.Group();
    const walls = box(6.4, 3.2, 5.4, 0x5fa8a0);
    walls.position.y = 1.6;
    ext.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.1, 2.2, 4), mat(0xd9a440));
    roof.position.y = 4.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    ext.add(roof);
    const door = box(1.1, 1.9, 0.18, 0x2e6e66);
    door.position.set(0, 0.95, 2.71);
    ext.add(door);
    // a window on each side of the door
    for (const sx of [-2.0, 2.0]) {
      const gwin = makeWindow(0.4);
      gwin.position.set(sx, 1.7, 2.72);
      ext.add(gwin);
    }
    // produce crates out front
    for (const [ox, c] of [[-2.2, 0xff9430], [-1.2, 0xd84f4f], [1.4, 0x8fce7a]]) {
      const crate = box(0.8, 0.5, 0.8, 0xa97c50);
      crate.position.set(ox, 0.25, 3.2);
      ext.add(crate);
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(c, 0.6));
        p.position.set(ox + (i - 1) * 0.22, 0.58, 3.2);
        ext.add(p);
      }
    }
    ext.position.set(gSpot.x, gy, gSpot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    zones.addBlockerBox(gSpot.x, gSpot.z, 6.4, 5.4, 0, 0.05);
    for (const ox of [-2.2, -1.2, 1.4]) zones.addBlocker(gSpot.x + ox, gSpot.z + 3.2, 0.45); // the crates

    // interior
    const roomStart = group.children.length;
    const B = IN.grocery;
    const floor = box(15, 0.4, 11, 0xa97c50);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [15, 4.4, 0.4, B.x, 2.2, B.z - 5.5],
      [0.4, 4.4, 11, B.x - 7.5, 2.2, B.z],
      [0.4, 4.4, 11, B.x + 7.5, 2.2, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xd8ebe8));
      wall.position.set(x, y, z);
      group.add(wall);
    }
    const counter = box(4.6, 1.1, 1.2, 0x2e6e66);
    counter.position.set(B.x - 2.5, 0.55, B.z - 2.8);
    group.add(counter);
    // produce shelves
    for (const sx of [-6.2, 5.0]) {
      for (const y of [1.2, 2.2]) {
        const shelf = box(2.6, 0.14, 1, 0x8a5a3a);
        shelf.position.set(B.x + sx, y, B.z - 4.8);
        group.add(shelf);
        for (let i = 0; i < 4; i++) {
          const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0),
            mat(pick([0xff9430, 0xd84f4f, 0x8fce7a, 0xffd23e]), 0.6));
          p.position.set(B.x + sx - 0.9 + i * 0.6, y + 0.26, B.z - 4.8);
          group.add(p);
        }
      }
    }
    // the soup corner (the "restaurant")
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.7, 9), mat(0x2e2a26, 0.5));
    pot.position.set(B.x + 3.4, 0.9, B.z - 3.4);
    const potStand = box(1.4, 0.55, 1.4, 0x8a5a3a);
    potStand.position.set(B.x + 3.4, 0.27, B.z - 3.4);
    group.add(pot, potStand);
    const steamPuffs = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1 }));
      sp.userData.k = i / 3;
      steamPuffs.push(sp);
      group.add(sp);
    }
    updates.push((dt, t) => {
      for (const sp of steamPuffs) {
        sp.userData.k = (sp.userData.k + dt * 0.4) % 1;
        const k = sp.userData.k;
        sp.position.set(B.x + 3.4 + Math.sin(t + k * 7) * 0.1, 1.35 + k * 1.1, B.z - 3.4);
        sp.material.opacity = 0.5 * (1 - k);
        sp.scale.setScalar(0.6 + k);
      }
    });
    for (const a of [0.6, 2.2]) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.62, 7), mat(0xa97c50));
      stool.position.set(B.x + 3.4 + Math.cos(a) * 1.6, 0.31, B.z - 3.4 + Math.sin(a) * 1.6 + 1.2);
      group.add(stool);
    }

    const barnStool = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 7), mat(0x1d4a44));
    barnStool.position.set(B.x - 2.5, 0.3, B.z - 3.9);
    group.add(barnStool);
    const barnaby = buildAnimal('lobster', { body: 0xd84f4f });
    barnaby.userData.fidget = true;
    barnaby.position.set(B.x - 2.5, 0.6, B.z - 3.9);
    group.add(barnaby);
    wireBob(barnaby, updates);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('grocery', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 7.1, x1: B.x + 7.1, z0: B.z - 4.4, z1: B.z + 5.1 },
      blockers: [
        { x: B.x - 2.5, z: B.z - 2.8, w: 4.6, d: 1.2 }, // the counter, its full length
        { x: B.x + 3.4, z: B.z - 3.4, r: 1.2 },
        ...[0.6, 2.2].map((a) => ({ x: B.x + 3.4 + Math.cos(a) * 1.6, z: B.z - 2.2 + Math.sin(a) * 1.6, r: 0.4 })), // the stools
      ],
      spawn: { x: B.x, z: B.z + 4.4, rotY: Math.PI },
      lighting: {
        bg: 0x1c2422, fog: 0x1c2422, fogNear: 24, fogFar: 58,
        hemiSky: 0xeaf4f0, hemiGround: 0x4a5a52, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(gSpot.x, 0, gSpot.z + 3.4), r: 2.6,
      label: '바나비의 채소·잡화점 들어가기',
      use: () => zones.go('grocery'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.9), r: 1.6, zone: 'grocery',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: gSpot.x, z: gSpot.z + 4.4, rotY: 0 }),
    });
    register({
      pos: new THREE.Vector3(B.x - 2.5, 0, B.z - 2.8), r: 3, zone: 'grocery',
      label: '바나비와 대화하기',
      use: () => barnabyMenu(),
    });
  }

  // ====================================================== The Listening House
  const cSpot = { x: T.x + 6, z: T.z - 4 };
  {
    const cy = terrainHeight(cSpot.x, cSpot.z);
    const ext = new THREE.Group();
    const nave = box(5.4, 4.4, 7, 0xd8d4c8);
    nave.position.y = 2.2;
    ext.add(nave);
    // across the ridge a 3-prism spans 1.73×r: the 5.4-wide nave needs r ≈ 3.5
    const roofGeo = new THREE.CylinderGeometry(3.47, 3.47, 7.4, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x5a6a80));
    roof.scale.y = 0.77;
    roof.position.y = 4.4 + 3.47 * 0.77 / 2; // eaves on the wall top; same apex as ever
    roof.rotation.y = Math.PI / 2; // ridge runs along the nave
    roof.castShadow = true;
    ext.add(roof);
    // the belfry: a proper bell-cote over the front gable, standing clear of
    // the roof — a solid base on the ridge, a tall open arch, a little cap.
    // And no bell in it. On purpose. (It used to be two stubby posts half
    // sunk in the roof, which read as a chimney that had given up.)
    const BZ = 2.4, ridgeY = 4.4 + 3.47 * 0.77; // apex of the roof
    const cote = box(1.9, 1.5, 1.5, 0xd8d4c8);
    cote.position.set(0, ridgeY + 0.35, BZ);
    ext.add(cote);
    for (const sx of [-0.78, 0.78]) {
      const post = box(0.34, 1.9, 1.3, 0xd8d4c8);
      post.position.set(sx, ridgeY + 1.1 + 0.95, BZ);
      ext.add(post);
    }
    const lintel = box(1.9, 0.36, 1.4, 0xd8d4c8);
    lintel.position.set(0, ridgeY + 3.18, BZ);
    ext.add(lintel);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.3, 4), mat(0x5a6a80));
    cap.rotation.y = Math.PI / 4;
    cap.position.set(0, ridgeY + 3.36 + 0.65, BZ);
    ext.add(cap);
    // where the bell would hang: a hook, and nothing on it
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 4, 8, Math.PI * 1.4), mat(0x6a6a6a, 0.4));
    hook.position.set(0, ridgeY + 2.85, BZ);
    ext.add(hook);
    // tall door + a strip of colored glass above it
    const door = box(1.3, 2.3, 0.2, 0x4a3a5a);
    door.position.set(0, 1.15, 3.51);
    ext.add(door);
    const glassColors = [0xffd23e, 0x6a9ae0, 0xc77dff];
    glassColors.forEach((c, i) => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
      pane.position.set((i - 1) * 0.6, 3.1, 3.52);
      ext.add(pane);
    });
    ext.position.set(cSpot.x, cy, cSpot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    zones.addBlockerBox(cSpot.x, cSpot.z, 5.4, 7, 0, 0.05);

    // interior: long, hushed, lit through colored glass
    const roomStart = group.children.length;
    const B = IN.church;
    const floor = box(12, 0.4, 16, 0xb9c0b9);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [12, 5.4, 0.4, B.x, 2.7, B.z - 8],
      [0.4, 5.4, 16, B.x - 6, 2.7, B.z],
      [0.4, 5.4, 16, B.x + 6, 2.7, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xcfcabb));
      wall.position.set(x, y, z);
      group.add(wall);
    }

    // the great window: small panes in an arch, amber bell on sea-blue
    const PANES = [
      '  aca  ',
      ' bbabb ',
      'bbaaabb',
      'bbaaabb',
      'baaaaab', // the bell's mouth, flaring wide
    ];
    const paneColor = { a: 0xffd23e, b: 0x5b8bc9, c: 0xc77dff };
    PANES.forEach((row, ri) => {
      [...row].forEach((ch, ci) => {
        if (!paneColor[ch]) return;
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62),
          new THREE.MeshBasicMaterial({ color: paneColor[ch], transparent: true, opacity: 0.9 }));
        pane.position.set(B.x - 2.1 + ci * 0.7, 4.3 - ri * 0.7, B.z - 7.78);
        group.add(pane);
      });
    });
    // the same bell, shown to the world: mirror the great window onto the
    // OUTSIDE of the nave's back wall — smaller panes, set a little overhead
    PANES.forEach((row, ri) => {
      [...row].forEach((ch, ci) => {
        if (!paneColor[ch]) return;
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.48),
          new THREE.MeshBasicMaterial({ color: paneColor[ch], transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
        pane.position.set(-1.65 + ci * 0.55, 3.8 - ri * 0.55, -3.52);
        ext.add(pane);
      });
    });
    // pews
    for (let r = 0; r < 4; r++) {
      for (const sx of [-2.6, 2.6]) {
        const pew = box(3.6, 0.5, 0.9, 0x8a5a3a);
        pew.position.set(B.x + sx, 0.25, B.z - 2.5 + r * 2.2);
        const back = box(3.6, 0.8, 0.18, 0x8a5a3a);
        back.position.set(B.x + sx, 0.85, B.z - 2.1 + r * 2.2);
        group.add(pew, back);
      }
    }

    // the dais: a cushion, a candle stand, and the empty bell frame
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 10), mat(0xb9c0b9));
    dais.position.set(B.x, 0.15, B.z - 5.6);
    group.add(dais);
    const frameA = box(0.3, 2.2, 0.3, 0x55483a);
    frameA.position.set(B.x - 1.0, 1.4, B.z - 5.8);
    const frameB = box(0.3, 2.2, 0.3, 0x55483a);
    frameB.position.set(B.x + 1.0, 1.4, B.z - 5.8);
    const frameTop = box(2.6, 0.3, 0.3, 0x55483a);
    frameTop.position.set(B.x, 2.6, B.z - 5.8);
    group.add(frameA, frameB, frameTop);
    // (no bell. that's the point.)

    // candles: a few always lit, more appear as visitors light them
    const candleGroup = new THREE.Group();
    group.add(candleGroup);
    function refreshCandles() {
      candleGroup.clear();
      const lit = Math.min(2 + (S.state.flags.candlesLit || 0), 9);
      for (let i = 0; i < 9; i++) {
        const cx = B.x - 3.6 + (i % 3) * 0.4, cz = B.z - 4.6 + Math.floor(i / 3) * 0.4;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3 + (i % 3) * 0.08, 6), mat(0xf6efdc, 0.6));
        stick.position.set(cx, 0.9, cz);
        candleGroup.add(stick);
        if (i < lit) {
          const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
            new THREE.MeshBasicMaterial({ color: 0xffd98f }));
          flame.position.set(cx, 1.12 + (i % 3) * 0.04, cz);
          candleGroup.add(flame);
        }
      }
      const stand = box(1.4, 0.8, 1.0, 0x55483a);
      stand.position.set(B.x - 3.2, 0.4, B.z - 4.4);
      candleGroup.add(stand);
    }
    refreshCandles();

    const alder = buildAnimal('heron', { body: 0x8fa3b8 });
    alder.userData.fidget = true;
    alder.position.set(B.x, 0.15, B.z - 5.2);
    alder.rotation.y = 0;
    group.add(alder);
    wireBob(alder, updates, 0.6);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('church', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.6, x1: B.x + 5.6, z0: B.z - 6.6, z1: B.z + 7.6 },
      blockers: [
        { x: B.x, z: B.z - 5.6, r: 1.6 }, // dais
        { x: B.x - 3.2, z: B.z - 4.4, r: 0.9 }, // candles
        // the pews are furniture, not fog
        ...[0, 1, 2, 3].flatMap((r) => [-2.6, 2.6].map((sx) => (
          { x: B.x + sx, z: B.z - 2.35 + r * 2.2, w: 3.6, d: 1.15 }))),
      ],
      spawn: { x: B.x, z: B.z + 6.8, rotY: Math.PI },
      lighting: {
        bg: 0x1a2030, fog: 0x1a2030, fogNear: 28, fogFar: 70,
        hemiSky: 0xd8e2f0, hemiGround: 0x4a5258, hemiIntensity: 1.05,
        sunIntensity: 0,
      },
    });
    zones.setDoor('church', { x: cSpot.x, z: cSpot.z + 4.8 });
    register({
      pos: new THREE.Vector3(cSpot.x, 0, cSpot.z + 4.2), r: 2.6,
      label: '듣는 집 들어가기',
      use: () => zones.go('church'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 7.2), r: 1.8, zone: 'church',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: cSpot.x, z: cSpot.z + 5.2, rotY: 0 }),
    });
    register({
      getPos: () => alder.position, r: 3.2, zone: 'church',
      label: '알더 수사와 대화하기',
      use: () => alderMenu(refreshCandles),
    });
    register({
      pos: new THREE.Vector3(B.x + 2.6, 0, B.z - 0.3), r: 2.0, zone: 'church',
      label: '긴 의자에 앉기', priority: 0,
      use: async () => {
        await ui.fadeSwap(() => {});
        ui.say('앉았어요. 이곳의 고요는 양모 같은 질감이에요. 그 어딘가에서, 아주 희미하게, 무언가 울릴 듯해요. 작은 곳 한두 군데가 기워진 기분이에요.');
      },
    });
  }

  // ====================================================== the public garden
  {
    const G = SITES.garden2;
    const gy = terrainHeight(G.x, G.z);
    // hedge ring with a south gap
    for (let a = 0.4; a < Math.PI * 2 - 0.4; a += 0.32) {
      const hx = G.x + Math.cos(a + Math.PI / 2) * 5.4;
      const hz = G.z + Math.sin(a + Math.PI / 2) * 5.4;
      const hedge = box(1.4, 1.0, 1.0, 0x3f9747);
      hedge.position.set(hx, terrainHeight(hx, hz) + 0.5, hz);
      hedge.rotation.y = a;
      group.add(hedge);
      zones.addBlockerBox(hx, hz, 1.4, 1.0, a); // in through the gate, like a guest
    }
    // flower beds
    for (const [ox, oz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.8], [2.2, 1.8]]) {
      const bed = box(2.4, 0.25, 1.6, 0x6b4a2e);
      bed.position.set(G.x + ox, gy + 0.12, G.z + oz);
      group.add(bed);
      for (let i = 0; i < 6; i++) {
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0),
          mat(pick([0xff6b81, 0xffd23e, 0xffffff, 0xc77dff]), 0.7));
        bloom.position.set(G.x + ox + rand(-0.9, 0.9), gy + 0.45, G.z + oz + rand(-0.5, 0.5));
        group.add(bloom);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 4), mat(0x4e9a45));
        stem.position.set(bloom.position.x, gy + 0.3, bloom.position.z);
        group.add(stem);
      }
    }
    // fountain
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.5, 10), mat(0x9aa0a6));
    basin.position.set(G.x, gy + 0.25, G.z);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x57c8d8, roughness: 0.2, emissive: 0x1a4a52, emissiveIntensity: 0.3 }));
    water.position.set(G.x, gy + 0.5, G.z);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 7), mat(0x9aa0a6));
    spire.position.set(G.x, gy + 0.9, G.z);
    group.add(basin, water, spire);
    zones.addBlocker(G.x, G.z, 1.5);
    const drops = [];
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true }));
      d.userData.k = i / 8;
      drops.push(d);
      group.add(d);
    }
    updates.push((dt, t) => {
      for (const d of drops) {
        d.userData.k = (d.userData.k + dt * 0.7) % 1;
        const k = d.userData.k;
        const a = k * Math.PI;
        d.position.set(
          G.x + Math.cos(d.userData.k * 19) * 0.5 * k,
          gy + 1.3 + Math.sin(a) * 0.7 - k * 0.6,
          G.z + Math.sin(d.userData.k * 19) * 0.5 * k
        );
        d.material.opacity = 0.9 * (1 - k * 0.6);
      }
    });
    // bench
    const bench = box(2.0, 0.4, 0.7, 0xa97c50);
    bench.position.set(G.x, gy + 0.35, G.z + 3.6);
    const benchBack = box(2.0, 0.6, 0.15, 0xa97c50);
    benchBack.position.set(G.x, gy + 0.85, G.z + 3.9);
    group.add(bench, benchBack);
    zones.addBlockerBox(G.x, G.z + 3.7, 2.0, 0.9, 0, 0.02);
    register({
      pos: new THREE.Vector3(G.x, 0, G.z + 3.2), r: 2.0,
      label: '정원 벤치에 앉기',
      use: () => ui.say('공동 정원에 앉았어요. 벌 한 마리가 당신을 전수 조사하고 승인해요. 분수가 조용히, 영원히 박수쳐요.'),
    });
  }

  // ====================================================== the Old Singer
  {
    const W = SITES.bones;
    // she lies along whatever heading keeps every bone on dry sand — nose
    // to tail is sixteen units, and she will not be hung off a cliff again
    const LEN0 = -8, LEN1 = 8.2;
    let heading = 0, best = -1;
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2;
      const c = Math.cos(ang), sn = Math.sin(ang);
      let ok = 0;
      for (let u = LEN0; u <= LEN1; u += 1) {
        for (const v of [-2.4, 0, 2.4]) {
          if (terrainHeight(W.x + u * c + v * sn, W.z - u * sn + v * c) > 0.1) ok++;
        }
      }
      if (ok > best) { best = ok; heading = ang; }
    }
    const hc = Math.cos(heading), hs = Math.sin(heading);
    const at = (u, v = 0) => ({ x: W.x + u * hc + v * hs, z: W.z - u * hs + v * hc });
    const place = (m, u, lift, v = 0) => {
      const p = at(u, v);
      m.position.set(p.x, terrainHeight(p.x, p.z) + lift, p.z);
    };
    const boneMat = mat(0xe8e4d8, 0.7);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), boneMat);
    skull.scale.set(1.5, 0.75, 1.0);
    place(skull, -5.6, 0.4);
    skull.rotation.y = heading + 0.4;
    skull.castShadow = true;
    group.add(skull);
    for (let i = 0; i < 6; i++) {
      const ribR = 2.4 - i * 0.25;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(ribR, 0.13, 6, 10, Math.PI), boneMat);
      place(rib, -2.4 + i * 1.5, 0.1);
      rib.rotation.y = heading + Math.PI / 2;
      rib.castShadow = true;
      group.add(rib);
      const vert = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), boneMat);
      place(vert, -2.4 + i * 1.5 + 0.75, 0.15);
      group.add(vert);
    }
    const tailBone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.8, 5), boneMat);
    place(tailBone, 7.2, 0.2);
    tailBone.rotation.set(0, heading, -Math.PI / 2);
    group.add(tailBone);
    // solid ribs: walk around her, not through her
    const mid = at(0.6);
    zones.addBlockerBox(mid.x, mid.z, 5.2, 16, heading + Math.PI / 2, 0);
    const plaque = at(-3.9, 3.4);

    register({
      pos: new THREE.Vector3(plaque.x, 0, plaque.z), r: 2.6,
      label: '바람에 닳은 명패 읽기',
      use: async () => {
        await ui.say([
          '바다에 둥글게 닳은 청동 명패, 돌에 박혀 있어요:',
          '“옛 노래꾼. 울림이 멎었을 때 그녀가 종의 노래를 깊은 물로 옮겼다. 바다는 둘 다 기억한다.” —듣는 이들',
        ]);
        if (!S.hasFlag('metOldSinger')) {
          S.setFlag('metOldSinger');
          ui.say('바람이 뼈대 사이를 지나가고, 한 음 — 딱 한 음만큼은 — 종소리처럼 들려요.');
        }
      },
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

function wireBob(npc, updates, speed = 1) {
  const parts = npc.userData.parts;
  const phase = rand(0, Math.PI * 2);
  updates.push((dt, t, playerPos) => {
    parts.body.position.y = parts.bodyY + Math.sin(t * 1.6 * speed + phase) * 0.03;
    parts.head.position.y = parts.headY + Math.sin(t * 1.6 * speed + phase + 0.5) * 0.02;
    if (playerPos) {
      const dx = playerPos.x - npc.position.x;
      const dz = playerPos.z - npc.position.z;
      if (Math.hypot(dx, dz) < 8) {
        npc.rotation.y = turnToward(npc.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
    }
  });
}

// ------------------------------------------------------ Barnaby's menus ----

async function barnabyMenu() {
  if (!S.hasFlag('metBarnaby')) {
    S.setFlag('metBarnaby');
    await ui.say([
      '오! 본섬에서 온 얼굴이네. 파 아일에 온 걸 환영해 — 인구: 더 차분함.',
      '바나비야. 채소, 잡화, 그리고 해협 양쪽에서 최고의 미역 스튜. 유일한 미역 스튜이기도 해. 두 기록 모두 자랑스럽게 보유 중이야.',
    ], { speaker: '바나비', voice: VOICE.barnaby });
  }
  const choice = await ui.ask('뭘 해 줄까?', [
    { label: '🌱 씨앗·스튜 사기', value: 'buy' },
    { label: '🥕 농작물 팔기 (섬 가격!)', value: 'sell' },
    { label: '잡담', value: 'chat' },
    { label: '나가기', value: 'leave' },
  ], { speaker: '바나비', voice: VOICE.barnaby });

  if (choice === 'buy') return barnabyBuy();
  if (choice === 'sell') return barnabySell();
  if (choice === 'chat') {
    await ui.say(BARNABY_CHAT[barnabyChatIdx++ % BARNABY_CHAT.length],
      { speaker: '바나비', voice: VOICE.barnaby });
    return barnabyMenu();
  }
}

async function barnabyBuy() {
  const STEW_PRICE = 30;
  const wares = [
    ...Object.keys(GROWTH).map((id) => ({
      label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id,
      hint: `${ITEMS[id].price}🔘`, disabled: S.state.buttons < ITEMS[id].price,
    })),
    { label: '🍲 미역 스튜 (여기서 먹기)', value: 'stew', hint: `${STEW_PRICE}🔘`, disabled: S.state.buttons < STEW_PRICE },
    { label: '뒤로', value: 'back' },
  ];
  const choice = await ui.ask('씨앗은 여행을 잘해. 스튜는 전혀 못 해 — 그게 매력이야.', wares,
    { speaker: '바나비', voice: VOICE.barnaby });
  if (choice === 'stew') {
    S.spend(STEW_PRICE);
    S.drinkCoffee(45);
    sip();
    ui.updateHUD();
    ui.toast('귀 끝까지 따뜻해져요. <i>45초간 조금 빨라져요!</i>', '🍲');
    await ui.say('조심해, 그릇이 열을 오래 잡아둬. 가문의 비밀이야. (비밀은 따뜻한 그릇이야.)',
      { speaker: '바나비', voice: VOICE.barnaby });
    return barnabyMenu();
  }
  if (GROWTH[choice]) {
    S.spend(ITEMS[choice].price);
    S.addItem(choice);
    kaching();
    ui.toast(`Bought <b>${ITEMS[choice].name}</b>.`, ITEMS[choice].emoji);
    ui.updateHUD();
    return barnabyBuy();
  }
  return barnabyMenu();
}

async function barnabySell() {
  const stock = Object.entries(S.state.inv)
    .map(([id, n]) => ({ id, n, item: ITEMS[id] }))
    .filter(({ item }) => item && (item.kind === 'produce' || item.kind === 'fruit'));
  if (!stock.length) {
    await ui.say('오늘은 텃밭 수확이 없나? 주황색이나 빨간 걸 좀 길러 봐. 따뜻한 색 안에서는 유연하거든.',
      { speaker: '바나비', voice: VOICE.barnaby });
    return barnabyMenu();
  }
  const choices = stock.map(({ id, n, item }) => ({
    label: `${item.emoji} ${item.name} ×${n}`,
    value: id,
    hint: `${Math.round(item.price * 1.5) * n}🔘`,
  }));
  choices.push({ label: '다 팔았어요', value: 'done' });
  const choice = await ui.ask('갓 수확한 거지? 섬 가격으로 쳐줄게 — 그 까치보다 1.5배.', choices,
    { speaker: '바나비', voice: VOICE.barnaby });
  if (choice === 'done') return barnabyMenu();
  const n = S.countItem(choice);
  const total = Math.round(ITEMS[choice].price * 1.5) * n;
  S.removeItem(choice, n);
  S.earn(total);
  kaching();
  ui.toast(`<b>${ITEMS[choice].name}</b> ${n}개를 <b>${total}</b>버튼에 팔았어요!`, '🔘');
  ui.updateHUD();
  return barnabySell();
}

// ------------------------------------------------- Brother Alder's menus ----

async function alderMenu(refreshCandles) {
  if (!S.hasFlag('metAlder')) {
    S.setFlag('metAlder');
    await ui.say([
      '어서 오시오, 걷는 이여. 나는 알더 수사요. 여기는 듣는 집이오.',
      '예배는 진행 중이지 않소. 언제나 진행 중이지 않소. 우리는 그저 고요를 따뜻하게 데워 둘 뿐이오, 종이 집으로 돌아올 경우를 대비해서.',
    ], { speaker: '알더 수사', voice: VOICE.alder });
  }
  const choice = await ui.ask('고요가 무엇을 도와드릴까요?', [
    { label: '듣는 이들에 대해 묻기', value: 'lore' },
    { label: `🕯️ 촛불 켜기`, value: 'candle', hint: '5🔘', disabled: S.state.buttons < 5 },
    { label: '나가기', value: 'leave' },
  ], { speaker: '알더 수사', voice: VOICE.alder });

  if (choice === 'lore') {
    await ui.say(ALDER_LORE[alderLoreIdx++ % ALDER_LORE.length],
      { speaker: '알더 수사', voice: VOICE.alder });
    return alderMenu(refreshCandles);
  }
  if (choice === 'candle') {
    S.spend(5);
    S.state.flags.candlesLit = (S.state.flags.candlesLit || 0) + 1;
    S.save();
    refreshCandles();
    jingle();
    ui.updateHUD();
    await ui.say('필요한 누군가를 위해 작은 불꽃을 켰어요. 바다 아래 어딘가에서, 따뜻한 무언가가 알아챘어요.',
      { speaker: '알더 수사', voice: VOICE.alder });
    return alderMenu(refreshCandles);
  }
}
