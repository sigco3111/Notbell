import * as THREE from 'three';
import { terrainHeight, clearOfSites, PLAYER_SPAWN, ISLAND_RADIUS, ISLAND2, SITES } from './terrain.js';
import * as zones from './zones.js';
import { rand, pick } from './utils.js';
import { SEASON, isNight } from './calendar.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { play as playTool } from './tools.js';
import { jingle } from './audio.js';

function mat(color, roughness = 0.95) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness });
}

const TRUNK_MAT = mat(0x7a5230);
const LEAF_COLORS = {
  spring: [0xf7b8d0, 0xfac7da, 0x8fce7a],   // blossom season
  summer: [0x4ca54c, 0x55b055, 0x3f9747],
  autumn: [0xe8943a, 0xd8743a, 0xc9b14b],
  winter: [0xe8efe9, 0xdfe8e2, 0xd2dfd8],   // snow-dusted
};
const LEAF_MATS = (LEAF_COLORS[SEASON] || LEAF_COLORS.summer).map((c) => mat(c));
const PINE_MAT = mat(0x2f7d4f);
const FRUIT_MAT = mat(0xff5f45, 0.6); // sunset-red: reads against green, gold AND rust leaves
const ROCK_MAT = mat(0x9aa0a6);
const STEM_MAT = mat(0x4e9a45);
const PETAL_MATS = [mat(0xff6b81, 0.8), mat(0xffd23e, 0.8), mat(0xffffff, 0.8), mat(0xc77dff, 0.8)];
const CENTER_MAT = mat(0xffc94d, 0.7);
const WOOD_MAT = mat(0xa97c50);

// butterfly species — the wing color IS the species
const BUTTERFLY_SPECIES = [
  { id: 'lemon_flit', color: 0xfff3a8 },
  { id: 'paper_wisp', color: 0xffffff },
  { id: 'rose_skipper', color: 0xffb3d1 },
  { id: 'sky_dancer', color: 0x9fd8ff },
];

function makeTree(withFruit) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.9, 7), TRUNK_MAT);
  trunk.position.y = 0.95;
  g.add(trunk);

  const leafMat = pick(LEAF_MATS);
  const blobs = [
    [0, 2.9, 0, 1.55],
    [0.95, 2.45, 0.25, 1.0],
    [-0.85, 2.5, -0.3, 1.05],
  ];
  for (const [x, y, z, r] of blobs) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
    blob.position.set(x, y, z);
    g.add(blob);
  }
  if (withFruit) {
    g.userData.fruits = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rand(-0.3, 0.3);
      const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), FRUIT_MAT);
      // on the OUTSIDE of the leaves, where you can see it's worth picking:
      // come in from beyond the canopy until we touch leaf, then sit there
      const y = 2.35 + rand(-0.2, 0.3);
      let r = 2.6;
      while (r > 0.5 && !blobs.some(([bx, by, bz, br]) =>
        Math.hypot(Math.cos(a) * r - bx, y - by, Math.sin(a) * r - bz) < br)) r -= 0.05;
      r += 0.08;
      fruit.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(fruit);
      g.userData.fruits.push(fruit);
    }
  }
  return g;
}

function makePine() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.2, 7), TRUNK_MAT);
  trunk.position.y = 0.6;
  g.add(trunk);
  const tiers = [
    [1.5, 1.6, 1.7],
    [1.15, 1.4, 2.8],
    [0.75, 1.2, 3.8],
  ];
  for (const [r, h, y] of tiers) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), PINE_MAT);
    cone.position.y = y;
    g.add(cone);
  }
  return g;
}

function makeFlower() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 5), STEM_MAT);
  stem.position.y = 0.25;
  g.add(stem);
  const petalMat = pick(PETAL_MATS);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), petalMat);
    petal.position.set(Math.cos(a) * 0.15, 0.52, Math.sin(a) * 0.15);
    petal.scale.set(1, 0.5, 1);
    g.add(petal);
  }
  const center = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), CENTER_MAT);
  center.position.y = 0.54;
  g.add(center);
  return g;
}

function makeRock() {
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.45, 1.1), 0), ROCK_MAT);
  rock.scale.y = rand(0.55, 0.8);
  rock.rotation.y = rand(0, Math.PI * 2);
  return rock;
}

function makeSign() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), WOOD_MAT);
  post.position.y = 0.55;
  g.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.1), WOOD_MAT);
  board.position.y = 1.25;
  board.rotation.y = 0.4;
  g.add(board);
  return g;
}

function makeButterfly() {
  const g = new THREE.Group();
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });
  const wingGeo = new THREE.PlaneGeometry(0.36, 0.24);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0.19, 0, 0); // hinge at the body

  const right = new THREE.Mesh(wingGeo, wingMat);
  const left = new THREE.Mesh(wingGeo, wingMat);
  left.scale.x = -1;
  g.add(right, left);
  g.userData.wings = { left, right };
  g.userData.wingMat = wingMat;

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.18, 2, 5), mat(0x55483a));
  body.rotation.x = Math.PI / 2;
  g.add(body);

  g.userData.setSpecies = (spec) => {
    g.userData.species = spec.id;
    wingMat.color.set(spec.color);
  };
  return g;
}

function makeDragonfly() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 2, 5), mat(0x57c8d8, 0.5));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x2a6a78, 0.4));
  eye.position.set(0, 0, 0.22);
  g.add(eye);
  const wingGeo = new THREE.PlaneGeometry(0.34, 0.07);
  wingGeo.translate(0.17, 0, 0);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xdff4f8, side: THREE.DoubleSide, transparent: true, opacity: 0.7, roughness: 0.6,
  });
  g.userData.wings = [];
  for (const sx of [-1, 1]) {
    for (const sz of [0.08, -0.06]) {
      const w = new THREE.Mesh(wingGeo, wingMat);
      w.position.set(sx * 0.04, 0.04, sz);
      w.scale.x = sx;
      w.rotation.z = sx * 0.1;
      g.add(w);
      g.userData.wings.push(w);
    }
  }
  return g;
}

function makeSnail() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 2, 5), mat(0xc9a06a, 0.7));
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.05;
  g.add(body);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(0x8a5a3a, 0.6));
  shell.position.set(0, 0.13, -0.04);
  g.add(shell);
  const whorl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x6b4a2e, 0.6));
  whorl.position.set(0, 0.18, -0.04);
  g.add(whorl);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 4), mat(0xc9a06a, 0.7));
    eye.position.set(sx * 0.03, 0.13, 0.12);
    eye.rotation.x = -0.4;
    g.add(eye);
  }
  return g;
}

function makeLadybird() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), mat(0xd84f4f, 0.5));
  dome.scale.set(1, 0.6, 1.15);
  dome.position.y = 0.05;
  g.add(dome);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(0x241f18, 0.5));
  head.position.set(0, 0.04, 0.1);
  g.add(head);
  for (const [dx, dz] of [[-0.04, 0.02], [0.04, 0.02], [-0.03, -0.05], [0.03, -0.05]]) {
    const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.018, 0), mat(0x241f18, 0.5));
    dot.position.set(dx, 0.1, dz);
    g.add(dot);
  }
  return g;
}

function makeCricket() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 2, 5), mat(0x6f9a45, 0.7));
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.07;
  g.add(body);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.16, 4), mat(0x55772f, 0.7));
    leg.position.set(sx * 0.07, 0.1, -0.06);
    leg.rotation.z = sx * 1.0;
    g.add(leg);
  }
  return g;
}

function makeBeetle() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0x3a3228, 0.5));
  shell.scale.set(1, 0.75, 1.25);
  g.add(shell);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0x241f18, 0.5));
  head.position.set(0, 0, 0.16);
  g.add(head);
  // four tiny "buttonholes" on the shell — the namesake
  for (const [hx, hz] of [[-0.04, -0.03], [0.04, -0.03], [-0.04, 0.05], [0.04, 0.05]]) {
    const hole = new THREE.Mesh(new THREE.IcosahedronGeometry(0.018, 0), mat(0xf2cf5b, 0.3));
    hole.position.set(hx, 0.11, hz);
    g.add(hole);
  }
  return g;
}

const NO_NET_LINES = [
  '손 닿지 않는 곳에서 춤추며 살짝 불쌍히 여겨요. 채집망이 있으면 좋을 텐데 — 핍의 가게에 있어요.',
  '두 손을 모았어요. 빗나갔어요. 애초에 가까이 있지도 않았어요.',
];

const TREE_STRUCTURE_CLEARANCE = 3;

function straitKeepouts() {
  const dir = { x: ISLAND2.x, z: ISLAND2.z };
  const dLen = Math.hypot(dir.x, dir.z);
  dir.x /= dLen; dir.z /= dLen;
  function findShore(fromT, step) {
    let t = fromT;
    for (let i = 0; i < 400; i++) {
      if (terrainHeight(dir.x * (t + step), dir.z * (t + step)) < 0.15) break;
      t += step;
    }
    return t;
  }
  const tA = findShore(24, 0.5);
  const tB = findShore(dLen - 14, -0.5);
  const A = { x: dir.x * tA, z: dir.z * tA };
  const B = { x: dir.x * tB, z: dir.z * tB };
  // (the rail line's stations reserve their own ground — see railway.js)
  return [
    { ...A, r: 8.0 },
    { ...B, r: 8.0 },
  ];
}

const TREE_KEEPOUTS = [
  ...straitKeepouts(),
  { x: SITES.town2.x - 6, z: SITES.town2.z - 3, r: 7.1 },
  { x: SITES.town2.x + 6, z: SITES.town2.z - 4, r: 7.4 },
  { x: SITES.garden2.x, z: SITES.garden2.z, r: 5.0 },
  { x: SITES.bones.x, z: SITES.bones.z, r: 9.5 }, // the Old Singer, all sixteen units of her
];

function clearOfTreeKeepouts(x, z) {
  if (zones.nearBlocker(x, z, TREE_STRUCTURE_CLEARANCE)) return false;
  return !TREE_KEEPOUTS.some((k) => Math.hypot(x - k.x, z - k.z) < k.r);
}

export function scatterNature() {
  const group = new THREE.Group();
  const placed = [];
  const flowerSpots = [];
  const treeSpots = [];

  function tryPlace(minH, maxH, minDist, maxR = ISLAND_RADIUS, opts = {}) {
    for (let tries = 0; tries < 30; tries++) {
      // both islands get nature — the Far Isle proportionally less
      const far = rand(0, 1) < 0.3;
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand(0, 1)) * (far ? maxR * (ISLAND2.r / ISLAND_RADIUS) : maxR);
      const x = (far ? ISLAND2.x : 0) + Math.cos(a) * r;
      const z = (far ? ISLAND2.z : 0) + Math.sin(a) * r;
      if (!clearOfSites(x, z, 1)) continue; // plazas, cave, pools, garden…
      if (opts.trees && !clearOfTreeKeepouts(x, z)) continue;
      const h = terrainHeight(x, z);
      if (h < minH || h > maxH) continue;
      if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < Math.max(minDist, q.d))) continue;
      placed.push({ x, z, d: minDist });
      return { x, z, h };
    }
    return null;
  }

  function add(obj, spot, sink = 0.05) {
    obj.position.set(spot.x, spot.h - sink, spot.z);
    obj.rotation.y = rand(0, Math.PI * 2);
    obj.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    group.add(obj);
  }

  const obstacles = []; // trees/pines/rocks — houses.js avoids these
  const fruitTrees = [];
  for (let i = 0; i < 36; i++) {
    const spot = tryPlace(0.6, 7, 3.2, ISLAND_RADIUS, { trees: true });
    if (spot) {
      const tree = makeTree(rand(0, 1) < 0.5);
      add(tree, spot);
      treeSpots.push(spot);
      obstacles.push({ x: spot.x, z: spot.z, r: 2 });
      zones.addBlocker(spot.x, spot.z, 0.45, 'tree'); // trunks are solid
      if (tree.userData.fruits) {
        const ft = { fruits: tree.userData.fruits, regrow: 0 };
        fruitTrees.push(ft);
        register({
          pos: { x: spot.x, z: spot.z },
          r: 2.3,
          enabled: () => ft.fruits[0].visible,
          label: '햇살 열매 따기',
          use: () => {
            ft.fruits.forEach((f) => { f.visible = false; });
            ft.regrow = rand(360, 620);
            S.addItem('sunfruit', 3);
            jingle();
            ui.toast('<b>햇살 열매</b> 3개를 땄어요! <i>그늘에서도 따뜻해요.</i>', '🍊');
            ui.updateHUD();
          },
        });
      }
    }
  }
  for (let i = 0; i < 10; i++) {
    const spot = tryPlace(1.2, 7, 3.2, ISLAND_RADIUS, { trees: true });
    if (spot) {
      add(makePine(), spot);
      obstacles.push({ x: spot.x, z: spot.z, r: 2 });
      zones.addBlocker(spot.x, spot.z, 0.9, 'tree'); // the low skirt of boughs, too
    }
  }
  for (let i = 0; i < 60; i++) {
    const spot = tryPlace(0.5, 6, 0.8);
    if (spot) {
      add(makeFlower(), spot, 0.02);
      flowerSpots.push(spot);
    }
  }
  const rockSpots = [];
  for (let i = 0; i < 14; i++) {
    const spot = tryPlace(-0.4, 6, 2.5, ISLAND_RADIUS + 4);
    if (spot) {
      const rock = makeRock();
      add(rock, spot, 0.25);
      rockSpots.push(spot);
      zones.addBlocker(spot.x, spot.z, rock.geometry.parameters.radius * 0.8, 'tree');
      obstacles.push({ x: spot.x, z: spot.z, r: 1.2 });
    }
  }
  const grassSpots = [];
  for (let i = 0; i < 8; i++) {
    const spot = tryPlace(0.6, 6, 1.2);
    if (spot) grassSpots.push(spot);
  }
  const shoreSpots = [];
  for (let i = 0; i < 8; i++) {
    const spot = tryPlace(-0.35, 0.25, 2.5, ISLAND_RADIUS + 4);
    if (spot) shoreSpots.push(spot);
  }

  // seashells strewn along every beach
  for (let i = 0; i < 26; i++) {
    const spot = tryPlace(-0.4, 0.3, 0.6, ISLAND_RADIUS + 5);
    if (!spot) continue;
    const shell = new THREE.Mesh(
      rand(0, 1) < 0.5
        ? new THREE.ConeGeometry(rand(0.09, 0.15), rand(0.14, 0.22), 5)
        : new THREE.IcosahedronGeometry(rand(0.08, 0.13), 0),
      mat(pick([0xfff3da, 0xffd9c9, 0xe8e0d0, 0xf2d9e8]), 0.6)
    );
    shell.position.set(spot.x, spot.h + 0.04, spot.z);
    shell.rotation.set(rand(0, 1.4), rand(0, Math.PI * 2), 0);
    group.add(shell);
  }

  // hermit crabs out for a walk between tides
  const beachCrabs = [];
  for (let i = 0; i < 3 && shoreSpots.length; i++) {
    const crab = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(0xd8845f, 0.7));
    body.scale.set(1.2, 0.6, 1);
    body.position.y = 0.08;
    crab.add(body);
    const shellHome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0xc9b178, 0.6));
    shellHome.position.set(0, 0.17, -0.07);
    crab.add(shellHome);
    const data = {
      mesh: crab, home: pick(shoreSpots), a: rand(0, Math.PI * 2),
      pause: rand(1, 3), respawn: 0,
    };
    crab.position.set(data.home.x, data.home.h, data.home.z);
    beachCrabs.push(data);
    group.add(crab);
    register({
      getPos: () => crab.position,
      r: 1.6,
      enabled: () => crab.visible,
      label: '소라게 떠올리기',
      use: () => {
        crab.visible = false;
        data.respawn = rand(70, 140);
        S.addItem('hermit_crab');
        jingle();
        ui.foundItem('hermit_crab');
        ui.updateHUD();
      },
    });
  }

  // welcome sign just beside where you wake up, at the plaza's south edge
  const signSpot = { x: PLAYER_SPAWN.x + 1.8, z: PLAYER_SPAWN.z - 1.4 };
  signSpot.h = terrainHeight(signSpot.x, signSpot.z);
  add(makeSign(), signSpot);
  zones.addBlocker(signSpot.x, signSpot.z, 0.35, 'tree'); // (you used to walk into the board; 'tree' so the planners don't reshuffle round it)
  register({
    pos: { x: signSpot.x, z: signSpot.z },
    r: 2,
    label: '표지판 읽기',
    use: () => ui.say([
      '“낫벨 섬에 오신 것을 환영합니다.”',
      '아래에 더 작은 글씨로: “종에 대해선 긴 이야기가 있어요. 펀에게 물어보세요. 오래된 물건을 가져가면 더 좋아요.”',
    ]),
  });

  // --------------------------------------------------- the wary list ----
  // every catchable with somewhere better to be: approach slowly or watch
  // it leave. walking is fine. running is a statement, and they hear it.
  // (they leave without comment. the leaving IS the comment.)
  const skittish = [];

  function addSkittish(mesh, wary, spook) {
    skittish.push({ mesh, wary, spook });
  }

  // ----------------------------------------------------- butterflies ----
  const butterflies = [];
  for (let i = 0; i < 7 && flowerSpots.length; i++) {
    const b = makeButterfly();
    b.userData.setSpecies(pick(BUTTERFLY_SPECIES));
    b.userData.home = pick(flowerSpots);
    b.userData.w1 = rand(0.25, 0.5);
    b.userData.w2 = rand(0.8, 1.4);
    b.userData.r = rand(1.5, 3.5);
    b.userData.phase = rand(0, Math.PI * 2);
    b.userData.prev = new THREE.Vector3();
    b.userData.respawn = 0;
    butterflies.push(b);
    group.add(b);

    register({
      getPos: () => b.position,
      r: 1.8,
      enabled: () => b.visible,
      label: () => (S.state.tools.net ? '채집망 휘두르기' : '나비 감상하기'),
      use: () => {
        if (!S.state.tools.net) {
          ui.say(pick(NO_NET_LINES));
          return;
        }
        playTool('net');
        if (Math.random() < 0.92) {
          b.visible = false;
          b.userData.respawn = rand(40, 90);
          const id = b.userData.species;
          S.addItem(id);
          jingle();
          ui.foundItem(id);
          ui.updateHUD();
        } else {
          ui.toast('휙! 우아하게 피루엣하며 도망쳤어요.', '🦋');
          b.userData.home = pick(flowerSpots); // flees to another patch
        }
      },
    });
    addSkittish(b, 5.5, () => {
      b.visible = false;
      b.userData.respawn = rand(18, 36);
    });
  }

  // --------------------------------------------------------- beetles ----
  const beetles = [];
  for (let i = 0; i < 2 && treeSpots.length; i++) {
    const beetle = makeBeetle();
    const data = { mesh: beetle, respawn: 0 };
    const perch = (spot) => {
      // clings to the sunny side of the trunk
      beetle.position.set(spot.x + 0.34, spot.h + rand(0.9, 1.5), spot.z + 0.2);
      beetle.rotation.set(-Math.PI / 2.4, 0, 0);
      beetle.visible = true;
    };
    perch(pick(treeSpots));
    data.perch = perch;
    beetles.push(data);
    group.add(beetle);

    register({
      getPos: () => beetle.position,
      r: 1.8,
      enabled: () => beetle.visible,
      label: () => (S.state.tools.net ? '채집망 들고 살금살금' : '딱정벌레 들여다보기'),
      use: () => {
        if (!S.state.tools.net) {
          ui.say('단추등 딱정벌레! 등껍질에 반듯한 구멍 네 개. 녀석이 알리바이를 갖기 전에 채집망이 필요해요.');
          return;
        }
        playTool('net');
        if (Math.random() < 0.88) {
          beetle.visible = false;
          data.respawn = rand(60, 130);
          S.addItem('buttonshell_beetle');
          jingle();
          ui.foundItem('buttonshell_beetle');
          ui.updateHUD();
        } else {
          beetle.visible = false;
          data.respawn = rand(20, 40);
          ui.toast('나무 뒤로 빠르게 사라졌어요. 아주 전문적으로.', '🪲');
        }
      },
    });
    addSkittish(beetle, 4.5, () => {
      beetle.visible = false;
      data.respawn = rand(20, 40);
    });
  }

  // ------------------------------------------- small ground residents ----
  // snails by the rocks and ladybirds on flowers are hand-catchable;
  // crickets take a net and a little luck.
  const perchers = [];

  function addPercher({ build, pool, itemId, y = 0, needNet = false, chance = 0.8,
    labelTool, labelBare, missLine, wary = 0 }) {
    if (!pool.length) return null;
    const mesh = build();
    const data = { mesh, respawn: 0, hopT: 99 };
    const perch = () => {
      const s = pick(pool);
      mesh.position.set(s.x + rand(-0.5, 0.5), s.h + y, s.z + rand(-0.5, 0.5));
      mesh.rotation.y = rand(0, Math.PI * 2);
      mesh.visible = true;
    };
    perch();
    data.perch = perch;
    perchers.push(data);
    group.add(mesh);
    register({
      getPos: () => mesh.position,
      r: 1.7,
      enabled: () => mesh.visible,
      label: () => (needNet && !S.state.tools.net ? labelBare : labelTool),
      use: () => {
        if (needNet && !S.state.tools.net) {
          ui.say(missLine);
          return;
        }
        if (S.state.tools.net) playTool('net');
        if (Math.random() < chance) {
          mesh.visible = false;
          data.respawn = rand(50, 110);
          S.addItem(itemId);
          jingle();
          ui.foundItem(itemId);
          ui.updateHUD();
        } else {
          mesh.visible = false;
          data.respawn = rand(15, 35);
          ui.toast('빗나갔어요! 갈 곳이 있나 봐요.', '💨');
        }
      },
    });
    if (wary > 0) {
      addSkittish(mesh, wary, () => {
        mesh.visible = false;
        data.respawn = rand(15, 30);
      });
    }
    return data;
  }

  addPercher({
    build: makeSnail, pool: rockSpots, itemId: 'garden_snail', chance: 1,
    labelTool: '달팽이 줍기', labelBare: '달팽이 줍기',
  });
  addPercher({
    build: makeSnail, pool: flowerSpots, itemId: 'garden_snail', chance: 1,
    labelTool: '달팽이 줍기', labelBare: '달팽이 줍기',
  });
  for (let i = 0; i < 2; i++) {
    addPercher({
      build: makeLadybird, pool: flowerSpots, itemId: 'ladybird', y: 0.55, chance: 0.95,
      labelTool: '무당벌레에게 손 내밀기', labelBare: '무당벌레에게 손 내밀기',
      wary: 3.5, // ladybirds startle; snails, pointedly, do not
    });
  }
  const crickets = [];
  for (let i = 0; i < 3; i++) {
    const c = addPercher({
      build: makeCricket, pool: grassSpots.length ? grassSpots : flowerSpots,
      itemId: 'meadow_cricket', needNet: true, chance: 0.75,
      labelTool: '채집망으로 덮치기', labelBare: '귀뚜라미 소리 듣기',
      missLine: '귀뚤. 귀뚤. 바로 저기 있어요. 채집망이 필요해요 — 핍의 가게에 있어요.',
      wary: 4.5, // crickets feel your footsteps before you take them
    });
    if (c) {
      c.hopTimer = rand(2, 5);
      crickets.push(c);
    }
  }

  // ------------------------------------------------------ dragonflies ----
  const dragonflies = [];
  for (let i = 0; i < 3 && shoreSpots.length; i++) {
    const d = makeDragonfly();
    d.userData.home = pick(shoreSpots);
    d.userData.w1 = rand(0.5, 0.8);
    d.userData.r = rand(1.8, 3.2);
    d.userData.phase = rand(0, Math.PI * 2);
    d.userData.prev = new THREE.Vector3();
    d.userData.respawn = 0;
    dragonflies.push(d);
    group.add(d);
    register({
      getPos: () => d.position,
      r: 1.9,
      enabled: () => d.visible,
      label: () => (S.state.tools.net ? '잠자리에 채집망 휘두르기' : '잠자리 감상하기'),
      use: () => {
        if (!S.state.tools.net) {
          ui.say('완전히 정지해 맴돌다가, 어느새 자리를 옮겼어요. 채집망이면 따라잡을지도. 어쩌면요.');
          return;
        }
        playTool('net');
        if (Math.random() < 0.8) {
          d.visible = false;
          d.userData.respawn = rand(45, 100);
          S.addItem('dewdrop_dragonfly');
          jingle();
          ui.foundItem('dewdrop_dragonfly');
          ui.updateHUD();
        } else {
          ui.toast('채집망 전체를 옆걸음으로 피했어요. 자랑쟁이.', '🪰');
          d.userData.home = pick(shoreSpots);
        }
      },
    });
    addSkittish(d, 6, () => {
      d.visible = false;
      d.userData.respawn = rand(15, 30);
    });
  }

  // -------------------------------------------------------- fireflies ----
  // pieces of the old light, freelancing — they only clock in after dark
  const fireflies = [];
  const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xffe98f, transparent: true });
  for (let i = 0; i < 4 && (grassSpots.length || flowerSpots.length); i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), fireflyMat.clone());
    f.userData = {
      home: pick(grassSpots.length ? grassSpots : flowerSpots),
      phase: rand(0, Math.PI * 2),
      w: rand(0.2, 0.4),
      respawn: 0,
      caughtUntil: 0,
    };
    f.visible = false;
    fireflies.push(f);
    group.add(f);
    register({
      getPos: () => f.position,
      r: 1.8,
      enabled: () => f.visible,
      label: () => (S.state.tools.net ? '반딧불이 살짝 덮기' : '반딧불이 구경하기'),
      use: () => {
        if (!S.state.tools.net) {
          ui.say('느긋하게 깜빡여요. 채집망도 가져오고, 더 중요하게, 다정함도 가져오세요.');
          return;
        }
        playTool('net');
        if (Math.random() < 0.85) {
          f.visible = false;
          f.userData.caughtUntil = rand(60, 120);
          S.addItem('lantern_firefly');
          jingle();
          ui.foundItem('lantern_firefly');
          ui.updateHUD();
        } else {
          ui.toast('휘두르는 중간에 불이 꺼졌어요. 무례하지만 인정.', '✨');
          f.userData.home = pick(grassSpots.length ? grassSpots : flowerSpots);
        }
      },
    });
    addSkittish(f, 2.5, () => { // fireflies are nearly unbotherable. nearly.
      f.userData.caughtUntil = rand(8, 16);
      f.visible = false;
    });
  }

  // hurrying is loud. the meadow takes attendance.
  const prevPlayer = new THREE.Vector3();
  let prevPlayerOk = false;

  function spookCheck(dt, playerPos) {
    if (!playerPos) return;
    if (!prevPlayerOk) {
      prevPlayer.copy(playerPos);
      prevPlayerOk = true;
      return;
    }
    const step = prevPlayer.distanceTo(playerPos);
    const moved = { x: playerPos.x - prevPlayer.x, z: playerPos.z - prevPlayer.z };
    prevPlayer.copy(playerPos);
    if (step > 3) return; // a teleport is not a footstep
    const speed = step / Math.max(dt, 1e-4);
    if (speed < 6.4) return; // walking (even caffeinated) is polite enough
    for (const s of skittish) {
      if (!s.mesh.visible || s.fleeing) continue;
      const dx = s.mesh.position.x - playerPos.x;
      const dz = s.mesh.position.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > s.wary) continue;
      if (moved.x * dx + moved.z * dz <= 0) continue; // running away is fine
      startFlee(s, playerPos);
    }
  }

  // startled things don't blink out of existence — they LEAVE: a short
  // indignant arc away from the thundering paws, fading as they go, and
  // only then does the respawn clock start. the leaving is the comment.
  const fleeing = [];

  function startFlee(s, playerPos) {
    const dx = s.mesh.position.x - playerPos.x;
    const dz = s.mesh.position.z - playerPos.z;
    const d = Math.hypot(dx, dz) || 1;
    const mats = [];
    s.mesh.traverse((o) => {
      if (o.isMesh) {
        o.material.transparent = true;
        mats.push(o.material);
      }
    });
    s.fleeing = {
      t: 0, dur: 0.85,
      dir: { x: dx / d, z: dz / d },
      home: s.mesh.position.clone(),
      mats,
    };
    fleeing.push(s);
  }

  function updateFleeing(dt) {
    for (const s of [...fleeing]) {
      const f = s.fleeing;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      s.mesh.position.x += f.dir.x * dt * 3.4;
      s.mesh.position.z += f.dir.z * dt * 3.4;
      s.mesh.position.y = f.home.y + Math.sin(k * Math.PI) * 0.9;
      for (const m of f.mats) m.opacity = 1 - k;
      if (k >= 1) {
        s.spook(); // hides + starts the respawn clock, as before
        s.mesh.position.copy(f.home);
        for (const m of f.mats) {
          m.opacity = 1;
          m.transparent = false;
        }
        s.fleeing = null;
        fleeing.splice(fleeing.indexOf(s), 1);
      }
    }
  }

  function update(dt, t, playerPos) {
    spookCheck(dt, playerPos);
    updateFleeing(dt);
    const night = isNight();
    for (const f of fireflies) {
      const u = f.userData;
      if (u.caughtUntil > 0) {
        u.caughtUntil -= dt;
        continue;
      }
      f.visible = night;
      if (!night) continue;
      const x = u.home.x + Math.cos(t * u.w + u.phase) * 2.2;
      const z = u.home.z + Math.sin(t * u.w * 0.77 + u.phase) * 2.2;
      f.position.set(x, terrainHeight(x, z) + 0.7 + Math.sin(t * 0.9 + u.phase) * 0.3, z);
      // the slow, confident blink of a professional
      f.material.opacity = 0.25 + Math.max(0, Math.sin(t * 1.8 + u.phase)) * 0.75;
      f.scale.setScalar(0.7 + Math.max(0, Math.sin(t * 1.8 + u.phase)) * 0.6);
    }
    for (const ft of fruitTrees) {
      if (!ft.fruits[0].visible) {
        ft.regrow -= dt;
        if (ft.regrow <= 0) ft.fruits.forEach((f) => { f.visible = true; });
      }
    }
    for (const p of perchers) {
      if (!p.mesh.visible) {
        p.respawn -= dt;
        if (p.respawn <= 0) p.perch();
      }
    }
    for (const c of crickets) {
      if (!c.mesh.visible) continue;
      c.hopTimer -= dt;
      if (c.hopTimer <= 0) {
        c.hopT = 0;
        c.hopTimer = rand(2, 5);
      }
      if (c.hopT < 0.4) {
        c.hopT += dt;
        c.mesh.position.y += Math.sin(Math.min(c.hopT / 0.4, 1) * Math.PI) * 0.06;
      }
    }
    for (const d of dragonflies) {
      if (!d.visible) {
        d.userData.respawn -= dt;
        if (d.userData.respawn <= 0) {
          d.userData.home = pick(shoreSpots);
          d.visible = true;
        }
        continue;
      }
      const u = d.userData;
      u.prev.copy(d.position);
      const x = u.home.x + Math.cos(t * u.w1 + u.phase) * u.r + Math.sin(t * 3.1 + u.phase) * 0.25;
      const z = u.home.z + Math.sin(t * u.w1 * 0.9 + u.phase) * u.r;
      const y = Math.max(terrainHeight(x, z), -0.4) + 0.9 + Math.sin(t * 1.7 + u.phase) * 0.2;
      d.position.set(x, y, z);
      if (u.prev.distanceToSquared(d.position) > 1e-8) {
        d.rotation.y = Math.atan2(d.position.x - u.prev.x, d.position.z - u.prev.z);
      }
      for (let k = 0; k < u.wings.length; k++) {
        u.wings[k].rotation.z = Math.sign(u.wings[k].scale.x) * (0.15 + Math.sin(t * 40 + k) * 0.35);
      }
    }
    for (const b of butterflies) {
      if (!b.visible) {
        b.userData.respawn -= dt;
        if (b.userData.respawn <= 0) {
          b.userData.setSpecies(pick(BUTTERFLY_SPECIES));
          b.userData.home = pick(flowerSpots);
          b.visible = true;
        }
        continue;
      }
      const { home, w1, w2, r, phase, wings, prev } = b.userData;
      prev.copy(b.position);
      const x = home.x + Math.cos(t * w1 + phase) * r;
      const z = home.z + Math.sin(t * w1 * 0.83 + phase) * r;
      const y = terrainHeight(x, z) + 1.2 + Math.sin(t * w2 + phase) * 0.35;
      b.position.set(x, y, z);
      if (prev.distanceToSquared(b.position) > 1e-8) {
        b.rotation.y = Math.atan2(b.position.x - prev.x, b.position.z - prev.z);
      }
      const flap = Math.sin(t * 18 + phase) * 0.85;
      wings.right.rotation.z = flap;
      wings.left.rotation.z = -flap;
    }
    for (const data of beetles) {
      if (!data.mesh.visible) {
        data.respawn -= dt;
        if (data.respawn <= 0) data.perch(pick(treeSpots));
      }
    }
    for (const c of beachCrabs) {
      if (!c.mesh.visible) {
        c.respawn -= dt;
        if (c.respawn <= 0) {
          c.home = pick(shoreSpots);
          c.mesh.position.set(c.home.x, c.home.h, c.home.z);
          c.mesh.visible = true;
        }
        continue;
      }
      // scuttle, pause, pick a new direction, scuttle
      c.pause -= dt;
      if (c.pause <= 0) {
        c.a = rand(0, Math.PI * 2);
        c.pause = rand(1.5, 4);
      } else if (c.pause < 1.2) {
        const nx = c.mesh.position.x + Math.cos(c.a) * dt * 1.6;
        const nz = c.mesh.position.z + Math.sin(c.a) * dt * 1.6;
        const h = terrainHeight(nx, nz);
        if (h > -0.4 && h < 0.35 && Math.hypot(nx - c.home.x, nz - c.home.z) < 7) {
          c.mesh.position.set(nx, h, nz);
          c.mesh.rotation.y = -c.a + Math.PI / 2; // crabs walk sideways, naturally
        } else {
          c.a += Math.PI;
        }
      }
    }
  }

  return { group, update, obstacles };
}
