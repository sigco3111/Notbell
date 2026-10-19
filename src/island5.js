// Grove Isle: orange orchards, an old mansion full of old money and small
// grandchildren, hot springs you can actually sit in, geysers with a
// schedule, and the famous interspecies lounge: capybaras, crocodiles,
// and the little birds who work on commission.

import * as THREE from 'three';
import { SITES, ISLAND5, ISLAND5_HAND, WATER_Y, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { jingle, kaching, splash, tone } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { addIslandInfo } from './fieldguide.js';
import { glowWindow } from './nightglow.js';
import { isNight } from './calendar.js';

// fruit hangs on the OUTSIDE of a round crown (radius R, centre cy, squashed
// by sy) — tucked inside the leaves, nobody could tell the tree was ripe
function onCrown(fruit, a, y, R, cy, sy) {
  const dy = Math.min(0.95, Math.abs(y - cy) / (R * sy));
  const r = R * Math.sqrt(1 - dy * dy) + 0.1;
  fruit.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
}

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

const IN_MANOR = { x: 300, z: 1380 };
export const CELLAR = { x: 300, z: 1540 }; // the wine cellar (the Burrough keeps a door in its back wall)

const MOLEDECAI_CHAT = [
  '몰드카이. 그로브 섬의 몰드카이 가입니다. 다른 몰드카이는 없습니다. 저희는 아주 배타적이거든요.',
  '오랜 부란, 사랑하는 방문객이여, 오랜 인내에 복리가 붙은 것일 뿐입니다.',
  '과수원이요? 어머니가 심으셨죠. 과수는 아무것에도 사과하지 않는 유일한 투자라 하셨습니다.',
  '손주들이 어딘가에 있습니다. 보기 전에 소리를 먼저 들으실 겁니다. 영영 못 보실 수도 있고요.',
];

const PEMBERTON_LINES = [
  '펨버턴입니다, 나리-내지-마님. 저택 집사입니다. 차는 뜨겁고, 은식기는 세어 두었으며, 아이들은, 유감스럽게도, 빠릅니다.',
  '어린 도련님들을 쫓아다니는 게 아닙니다. 결국 있게 될 자리에 미리 자리하는 것이지요.',
  '펭귄이 집사 일을 하냐고요, 네. 서식지에서 통근이 상당했습니다. 연금은 훌륭하고요.',
];

const TILLY_LINES = [
  '오! 먼지 조심하세요 — 뭐. 먼지가 없긴 해요. 하지만 있었을 자리는 조심하세요!',
  '작은 두더지 셋에 저 하나. 남작님은 “놀게 두라”고 하세요. 맞는 말이지만 근무 시간에는 전하지 마세요.',
  '초상화는 매일 닦아요. 3대 남작이 윙크해요, 확실해요. 하녀 말은 아무도 안 믿지만. 윙크가 거기 있다고요.',
];

export function createIsland5(player) {
  const group = new THREE.Group();
  const updates = [];
  const M = SITES.manor;
  const SP = SITES.springs;
  const OR = SITES.orchard;
  const TREE_STRUCTURE_CLEARANCE = 3;

  function groveRailStop() {
    const toward = ISLAND5_HAND[0];
    const dx = toward.x - ISLAND5.x, dz = toward.z - ISLAND5.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    let t = 4;
    while (terrainHeight(ISLAND5.x + ux * (t + 0.5), ISLAND5.z + uz * (t + 0.5)) >= 0.2) t += 0.5;
    return { x: ISLAND5.x + ux * (t - 2), z: ISLAND5.z + uz * (t - 2) };
  }

  const groveStop = groveRailStop();
  const treeKeepouts = [
    { x: M.x - 6, z: M.z - 2, r: 6.4 + TREE_STRUCTURE_CLEARANCE },
    { x: M.x + 6, z: M.z - 2, r: 6.4 + TREE_STRUCTURE_CLEARANCE },
    { x: M.x, z: M.z + 1.9, r: 4.5 },
    { x: M.x, z: M.z + 6, r: 5.0 + 2.2 }, // the whole court, not just the fountain
    { ...groveStop, r: 5.2 },
  ];
  const placedTrees = [];
  function clearOfTreeKeepouts(x, z) {
    if (zones.nearBlocker(x, z, TREE_STRUCTURE_CLEARANCE)) return false;
    if (treeKeepouts.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) return false;
    return !placedTrees.some((p) => Math.hypot(x - p.x, z - p.z) < 2.7);
  }
  function treeSpotNear(x, z, minH = 0.5) {
    for (const [dx, dz] of [
      [0, 0], [2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4],
      [1.7, 1.7], [-1.7, 1.7], [1.7, -1.7], [-1.7, -1.7],
    ]) {
      const sx = x + dx, sz = z + dz;
      const h = terrainHeight(sx, sz);
      if (h < minH || !clearOfTreeKeepouts(sx, sz)) continue;
      placedTrees.push({ x: sx, z: sz });
      return { x: sx, z: sz, h };
    }
    return null;
  }
  function distToSegment(x, z, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
  }
  const groveLineSegments = [
    [{ x: 0, z: 0 }, ISLAND5_HAND[1]],
    [ISLAND5_HAND[1], ISLAND5_HAND[0]],
    [ISLAND5_HAND[0], groveStop],
  ];
  function clearOfGroveLine(x, z) {
    return groveLineSegments.every(([a, b]) => distToSegment(x, z, a, b) > 2.4);
  }

  addIslandInfo({
    key: 'grove',
    mystery: '“남동쪽에 오래된 부. 과수원, 온천수, 남작. 이제 기차가 거기 간다는데, 기차가 확인해 줬지.” —부두에서 들음',
    name: '그로브 섬', x: ISLAND5.x, z: ISLAND5.z, r: 34, icon: '🍊',
    blurb: '과수원, 오래된 부, 그리고 온천수. 몰드카이 저택, 오렌지 숲, 몸을 담글 수 있는 간헐천, 그리고 군도에서 가장 차분한 라운지: 카피바라, 악어, 시중드는 새들. 그로브 선이 낫벨에서 곧장 증기를 뿜으며 온다.',
    folk: '몰드카이 남작 · 펨버턴 · 틸리 · 작고 빠른 손주 셋 · 카피바라들 · 악어들 · 그들의 새들',
  });

  // ------------------------------------------------------- the orchards ----
  const orchardTrees = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const spot = treeSpotNear(OR.x - 5.4 + col * 3.6 + (row % 2) * 1.2, OR.z - 4.5 + row * 4.2);
      if (!spot) continue;
      const { x: tx, z: tz, h: ty } = spot;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.6, 7), mat(0x7a5230));
      trunk.position.y = 0.8;
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat(0x3f9747));
      crown.position.y = 2.4;
      crown.scale.y = 0.9;
      tree.add(crown);
      const oranges = [];
      for (let f = 0; f < 4; f++) {
        const a = (f / 4) * Math.PI * 2 + rand(-0.3, 0.3);
        const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(0xff9430, 0.6));
        onCrown(fruit, a, 2.2 + rand(0, 0.6), 1.5, 2.4, 0.9);
        tree.add(fruit);
        oranges.push(fruit);
      }
      tree.position.set(tx, ty - 0.05, tz);
      zones.addBlocker(tx, tz, 0.6, 'tree'); // trunks are solid
      tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(tree);
      const ot = { oranges, regrow: 0 };
      orchardTrees.push(ot);
      register({
        pos: new THREE.Vector3(tx, 0, tz), r: 2.2,
        enabled: () => ot.oranges[0].visible,
        label: '오렌지 따기',
        use: () => {
          ot.oranges.forEach((f) => { f.visible = false; });
          ot.regrow = rand(360, 620);
          S.addItem('orange', 3);
          jingle();
          ui.toast('<b>오렌지</b> 3개를 땄어요! <i>카피바라 인증.</i>', '🍊');
          ui.updateHUD();
        },
      });
    }
  }
  updates.push((dt) => {
    for (const ot of orchardTrees) {
      if (!ot.oranges[0].visible) {
        ot.regrow -= dt;
        if (ot.regrow <= 0) ot.oranges.forEach((f) => { f.visible = true; });
      }
    }
  });

  // -------------------------------------------------------- the mansion ----
  const my = terrainHeight(M.x, M.z);
  {
    const ext = new THREE.Group();
    const main = box(11, 5, 7, 0xf0e8d8);
    main.position.y = 2.5;
    ext.add(main);
    for (const sx of [-7.5, 7.5]) {
      const wing = box(4, 3.6, 5.5, 0xe8dcc4);
      wing.position.set(sx, 1.8, 0.5);
      ext.add(wing);
      // a hipped roof that covers the whole wing (4×5.5), eaves on the walls:
      // square pyramid turned square-on in the geometry, then stretched
      const wingGeo = new THREE.ConeGeometry(3.4, 1.6, 4);
      wingGeo.rotateY(Math.PI / 4);
      const wingRoof = new THREE.Mesh(wingGeo, mat(0x5a6a80));
      wingRoof.position.set(sx, 3.6 + 0.8, 0.5);
      wingRoof.scale.set(1.0, 1, 1.3);
      wingRoof.castShadow = true;
      ext.add(wingRoof);
    }
    // r sized to wall depth (7-deep walls → r≈4.4; same apex via scale.y) — B18
    const roofGeo = new THREE.CylinderGeometry(4.4, 4.4, 11.4, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x4a5a70));
    roof.scale.y = 0.51;
    roof.position.y = 5.9;
    roof.castShadow = true;
    ext.add(roof);
    for (const sx of [-2.2, 2.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.4, 7), mat(0xfaf4e8));
      col.position.set(sx, 2.2, 3.7);
      col.castShadow = true;
      ext.add(col);
    }
    const pediment = box(6, 0.5, 1.4, 0xfaf4e8);
    pediment.position.set(0, 4.5, 3.6);
    ext.add(pediment);
    const door = box(1.8, 2.6, 0.2, 0x4a3a2a);
    door.position.set(0, 1.3, 3.55);
    ext.add(door);
    for (const sx of [-4, 4]) {
      for (const wy of [1.8, 3.6]) {
        const win = box(1.1, 1.3, 0.14, 0xbfe6f2);
        win.position.set(sx, wy, 3.55);
        ext.add(win);
      }
    }
    // the back of the house keeps up appearances too
    for (const sx of [-4, -1.3, 1.3, 4]) {
      for (const wy of [1.8, 3.6]) {
        const win = box(1.1, 1.3, 0.14, 0xbfe6f2);
        win.position.set(sx, wy, -3.55);
        ext.add(win);
      }
    }
    for (const sx of [-9.55, 9.55]) {
      const win = box(0.14, 1.2, 1.6, 0xbfe6f2);
      win.position.set(sx, 1.8, 0.5);
      ext.add(win);
    }
    for (const wsx of [-7.5, 7.5]) {
      const win = box(1.0, 1.1, 0.14, 0xbfe6f2);
      win.position.set(wsx, 1.8, -2.2);
      ext.add(win);
    }
    ext.position.set(M.x, my, M.z - 2);
    ext.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o.material.color && o.material.color.getHex() === 0xbfe6f2) glowWindow(o); // every manor window glows
    });
    group.add(ext);
    // the house, the wings, the portico columns: rectangles, not balloons
    zones.addBlockerBox(M.x, M.z - 2, 11, 7, 0, 0.05);
    for (const sx of [-7.5, 7.5]) zones.addBlockerBox(M.x + sx, M.z - 1.5, 4, 5.5, 0, 0.05);
    for (const sx of [-2.2, 2.2]) zones.addBlocker(M.x + sx, M.z + 1.7, 0.32);

    // gravel court + fountain where the grandchildren orbit — on a proper
    // stone footing that reaches the ground all the way round (it used to be
    // a paper-thin disc: buried on the uphill side, floating on the down)
    let courtLow = my;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      courtLow = Math.min(courtLow, terrainHeight(M.x + Math.cos(a) * 4.6, M.z + 6 + Math.sin(a) * 4.6));
    }
    let courtHigh = my;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      courtHigh = Math.max(courtHigh, terrainHeight(M.x + Math.cos(a) * 4.2, M.z + 6 + Math.sin(a) * 4.2));
    }
    const courtTop = courtHigh + 0.12;
    const courtH = courtTop - (courtLow - 0.4);
    const court = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.75, courtH, 14), mat(0xd9d2c0, 0.95));
    court.position.set(M.x, courtTop - courtH / 2, M.z + 6);
    court.receiveShadow = true;
    group.add(court);
    zones.addSurfaceDisc(M.x, M.z + 6, 4.95, courtTop); // (to the lip of the footing — no wading in its edge)
    const fbasin = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.5, 10), mat(0xb9c0b9));
    fbasin.position.set(M.x, courtTop + 0.25, M.z + 6);
    const fwater = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x57c8d8, roughness: 0.2, emissive: 0x1a4a52, emissiveIntensity: 0.3 }));
    fwater.position.set(M.x, courtTop + 0.5, M.z + 6);
    group.add(fbasin, fwater);
    zones.addBlocker(M.x, M.z + 6, 1.35);

    // the three grandchildren: small, fast, and everywhere on this island.
    // they sprint, they sniff, they vanish into the mansion and reappear —
    // follow one inside and you'll find them lapping the grand hall.
    const doorSpot = { x: M.x, z: M.z + 1.9 };
    const pups = [];
    for (let i = 0; i < 3; i++) {
      const pup = buildAnimal('mole', { body: 0x55483a, head: 0x55483a });
      pup.scale.setScalar(0.5);
      const data = {
        g: pup, mode: 'pause', pauseT: i * 1.5 + 1,
        target: new THREE.Vector3(), speed: rand(2.6, 3.4),
        insideT: 0, chase: 0, phase: (i / 3) * Math.PI * 2,
      };
      pup.position.set(M.x + 2 + i, terrainHeight(M.x + 2 + i, M.z + 6), M.z + 6);
      pups.push(data);
      group.add(pup);

      register({
        getPos: () => pup.position,
        r: 2.6,
        zone: () => (data.mode === 'inside' ? 'manor' : 'island'),
        label: '두더지 꼬마와 놀기',
        use: () => {
          for (const q of pups) if (q.mode !== 'inside') q.chase = 9;
          ui.toast('꼬마들이 즉시 충성을 바꿨어요. 이제 당신이 행렬이에요.', '😆');
          tone(rand(950, 1250), { dur: 0.07, type: 'triangle', vol: 0.035 });
          tone(rand(1050, 1350), { time: 0.1, dur: 0.07, type: 'triangle', vol: 0.035 });
        },
      });
    }

    function syncPupVisibility(inManor = zones.current() === 'manor') {
      for (const p of pups) p.g.visible = inManor ? p.mode === 'inside' : p.mode !== 'inside';
    }
    const pupZoneGate = {
      set visible(inManor) { syncPupVisibility(inManor); },
    };

    function pickPupTarget(data) {
      // mostly the open isle; sometimes, irresistibly, the front door
      if (rand(0, 1) < 0.16) {
        data.mode = 'toDoor';
        data.target.set(doorSpot.x, 0, doorSpot.z);
        return;
      }
      for (let tries = 0; tries < 12; tries++) {
        const a = rand(0, Math.PI * 2);
        const r = Math.sqrt(rand(0, 1)) * (ISLAND5.r - 3);
        const x = ISLAND5.x + Math.cos(a) * r;
        const z = ISLAND5.z + Math.sin(a) * r;
        if (terrainHeight(x, z) > 0.3 && zones.islandCanWalk(x, z)) {
          data.mode = 'run';
          data.target.set(x, 0, z);
          return;
        }
      }
      data.mode = 'pause';
      data.pauseT = 1;
    }

    let giggleT = 4;
    updates.push((dt, t, playerPos) => {
      giggleT -= dt;
      let anyNear = false;
      for (const data of pups) {
        const g = data.g;
        if (data.chase > 0 && playerPos) {
          // orbiting the visitor is the highest honor a pup can bestow
          data.chase -= dt;
          const a = t * 2.2 + data.phase;
          const x = playerPos.x + Math.cos(a) * 1.8;
          const z = playerPos.z + Math.sin(a) * 1.6;
          const y = data.mode === 'inside' ? 0 : terrainHeight(x, z);
          g.position.set(x, y + Math.abs(Math.sin(a * 4)) * 0.15, z);
          g.rotation.y = a + Math.PI / 2;
          anyNear = true;
          continue;
        }
        if (data.mode === 'inside') {
          // lapping the grand hall, politely avoiding the good table
          data.insideT -= dt;
          const a = t * 1.7 + data.phase;
          const x = IN_MANOR.x - 3 + Math.cos(a) * 3.4;
          const z = IN_MANOR.z + 1 + Math.sin(a) * 2.4;
          g.position.set(x, Math.abs(Math.sin(a * 4)) * 0.14, z);
          g.rotation.y = a + Math.PI / 2;
          if (data.insideT <= 0) {
            data.mode = 'pause';
            data.pauseT = 0.5;
            g.position.set(doorSpot.x + rand(-0.5, 0.5), terrainHeight(doorSpot.x, doorSpot.z), doorSpot.z + rand(0, 0.8));
          }
          continue;
        }
        if (data.mode === 'pause') {
          data.pauseT -= dt;
          if (data.pauseT <= 0) pickPupTarget(data);
          continue;
        }
        // running somewhere very important
        const dx = data.target.x - g.position.x;
        const dz = data.target.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.6) {
          if (data.mode === 'toDoor') {
            data.mode = 'inside';
            data.insideT = rand(10, 26);
            g.position.set(IN_MANOR.x - 3, 0, IN_MANOR.z + 3);
          } else {
            data.mode = 'pause';
            data.pauseT = rand(0.6, 2.2); // sniff. consider. depart.
          }
          continue;
        }
        const nx = g.position.x + (dx / dist) * data.speed * dt;
        const nz = g.position.z + (dz / dist) * data.speed * dt;
        if (zones.islandCanWalk(nx, nz)) {
          g.position.set(nx, terrainHeight(nx, nz) + Math.abs(Math.sin(t * 11 + data.phase)) * 0.13, nz);
          g.rotation.y = Math.atan2(dx, dz);
        } else {
          pickPupTarget(data);
        }
        if (playerPos && Math.hypot(playerPos.x - nx, playerPos.z - nz) < 8) anyNear = true;
      }
      if (giggleT <= 0 && anyNear) {
        giggleT = rand(5, 11);
        tone(rand(900, 1200), { dur: 0.07, type: 'triangle', vol: 0.03 });
        tone(rand(1000, 1300), { time: 0.09, dur: 0.07, type: 'triangle', vol: 0.03 });
      }
      syncPupVisibility(); // zone-aware: inside pups show in the manor, outside pups on the isle
    });

    // ------------------------------------------------ the grand hall ----
    const manorStart = group.children.length;
    const B = IN_MANOR;
    const floor = box(20, 0.4, 14, 0x9a7448);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, d, x, z] of [
      [20, 0.4, B.x, B.z - 7], [0.4, 14, B.x - 10, B.z], [0.4, 14, B.x + 10, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), mat(0xe4d8c0));
      wall.position.set(x, 3, z);
      group.add(wall);
    }
    const rug = box(7, 0.06, 11, 0x7a3a3a);
    rug.position.set(B.x, 0.06, B.z);
    group.add(rug);
    // chandelier
    const chRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 6, 14), mat(0xd9a440, 0.4));
    chRing.rotation.x = Math.PI / 2;
    chRing.position.set(B.x, 4.6, B.z - 1);
    group.add(chRing);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const candle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
        new THREE.MeshBasicMaterial({ color: 0xffd98f }));
      candle.position.set(B.x + Math.cos(a) * 1.2, 4.8, B.z - 1 + Math.sin(a) * 1.2);
      group.add(candle);
    }
    const chLight = new THREE.PointLight(0xffd9a0, 55, 24, 2);
    chLight.position.set(B.x, 4.2, B.z - 1);
    group.add(chLight);
    // fireplace
    const hearth = box(3, 2.4, 0.8, 0x8a8478);
    hearth.position.set(B.x - 9.5, 1.2, B.z - 2);
    group.add(hearth);
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: 0xff8a4c }));
    fire.position.set(B.x - 9.3, 0.7, B.z - 2);
    group.add(fire);
    updates.push((dt, t) => {
      fire.scale.setScalar(0.85 + Math.sin(t * 7) * 0.18);
    });
    // portraits: the Moledecai line, oils on canvas, noses on display
    for (let i = 0; i < 3; i++) {
      const cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = ['#3a3226', '#2e3a4a', '#403040'][i];
      ctx.fillRect(0, 0, 96, 128);
      ctx.fillStyle = '#55483a';
      ctx.beginPath();
      ctx.ellipse(48, 64, 26, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2a8b8';
      ctx.beginPath();
      ctx.ellipse(48, 76, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i === 2) { // the third Baron, mid-wink (Tilly is right)
        ctx.strokeStyle = '#16140f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(36, 56);
        ctx.lineTo(44, 58);
        ctx.stroke();
        ctx.fillStyle = '#16140f';
        ctx.beginPath();
        ctx.arc(58, 57, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#16140f';
        ctx.beginPath();
        ctx.arc(38, 57, 3, 0, Math.PI * 2);
        ctx.arc(58, 57, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const frame = box(1.5, 2.0, 0.1, 0xd9a440);
      frame.position.set(B.x - 4 + i * 4, 3.4, B.z - 6.78);
      group.add(frame);
      const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.7),
        new THREE.MeshBasicMaterial({ map: tex }));
      canvasM.position.set(B.x - 4 + i * 4, 3.4, B.z - 6.72);
      group.add(canvasM);
    }
    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 5.5), r: 3.2, zone: 'manor',
      label: '가족 초상화 감상하기',
      use: () => ui.say('몰드카이 코 3대分. 3대 남작이 윙크하는 것 같아요. 보면 볼수록 확신이 들어요. 틸리 말이 맞았어요.'),
    });
    // long table
    const table = box(6, 0.2, 1.6, 0x6b4a2e);
    table.position.set(B.x + 3, 1.0, B.z + 2);
    group.add(table);
    for (const [lx, lz] of [[-2.6, -0.6], [2.6, -0.6], [-2.6, 0.6], [2.6, 0.6]]) {
      const leg = box(0.18, 1.0, 0.18, 0x55483a);
      leg.position.set(B.x + 3 + lx, 0.5, B.z + 2 + lz);
      group.add(leg);
    }

    const moledecai = buildAnimal('mole', { body: 0x55483a, head: 0x55483a });
    // the monocle of generational wealth
    const monocle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9a440, roughness: 0.3 }));
    monocle.position.set(0.17, 1.27, 0.72);
    moledecai.add(monocle);
    moledecai.updateMatrixWorld(true);
    moledecai.userData.parts.head.attach(monocle); // it goes where his eye goes
    const ascot = box(0.3, 0.25, 0.12, 0x7a3a3a);
    ascot.position.set(0, 0.95, 0.45);
    moledecai.add(ascot);
    group.add(moledecai);

    const pemberton = buildAnimal('penguin', { body: 0x2e3640, head: 0x2e3640 });
    group.add(pemberton);
    const tray = box(0.5, 0.05, 0.3, 0xd9a440);
    tray.position.set(0.5, 1.05, 0.3);
    pemberton.add(tray);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.1, 7), mat(0xfffaf0, 0.5));
    cup.position.set(0.5, 1.13, 0.3);
    pemberton.add(cup);

    const tilly = buildAnimal('hedgehog', { body: 0xc9a06a, head: 0xc9a06a });
    const apron = box(0.5, 0.55, 0.1, 0xfffaf0);
    apron.position.set(0, 0.6, 0.5);
    tilly.add(apron);
    group.add(tilly);

    // the household keeps its rounds: dignified, ceaseless, indoor-paced
    const STAFF = [
      { g: moledecai, speed: 0.7, wp: [
        [B.x - 7.8, B.z - 1.5], [B.x - 4, B.z - 5], [B.x + 1, B.z - 3],
        [B.x - 2, B.z + 3], [B.x - 7.8, B.z - 1.5]] },
      { g: pemberton, speed: 1.0, wp: [
        [B.x + 7, B.z + 5], [B.x + 3, B.z + 0.2], [B.x - 6, B.z - 0.5],
        [B.x + 1, B.z + 5.5], [B.x + 7, B.z + 5]] },
      { g: tilly, speed: 1.2, wp: [
        [B.x + 6, B.z - 4.5], [B.x - 2, B.z - 5.5], [B.x - 8.5, B.z + 3],
        [B.x + 5, B.z + 2.5], [B.x + 6, B.z - 4.5]] },
    ];
    for (const [si, st] of STAFF.entries()) {
      st.idx = si % st.wp.length;
      st.pauseT = si * 2 + 1;
      st.walk = 0;
      st.g.position.set(st.wp[st.idx][0], 0, st.wp[st.idx][1]);
    }
    updates.push((dt, t, playerPos) => {
      for (const st of STAFF) {
        const g = st.g;
        let walking = false;
        if (st.pauseT > 0) {
          st.pauseT -= dt;
          // paused: attend to the visitor, as breeding requires
          if (playerPos) {
            const dx = playerPos.x - g.position.x;
            const dz = playerPos.z - g.position.z;
            if (Math.hypot(dx, dz) < 6) {
              g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 3);
            }
          }
          if (st.pauseT <= 0) st.idx = (st.idx + 1) % st.wp.length;
        } else {
          const [tx2, tz2] = st.wp[st.idx];
          const dx = tx2 - g.position.x;
          const dz = tz2 - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            st.pauseT = rand(3, 8);
          } else {
            g.position.x += (dx / dist) * st.speed * dt;
            g.position.z += (dz / dist) * st.speed * dt;
            g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 5);
            walking = true;
          }
        }
        st.walk += ((walking ? 1 : 0) - st.walk) * Math.min(1, dt * 8);
        animateGait(g, t, st.walk, 7);
      }
    });

    register({
      pos: new THREE.Vector3(M.x, 0, M.z + 1.9), r: 2.6,
      label: '몰드카이 저택 벨 울리기',
      use: async () => {
        await zones.go('manor');
        if (!S.hasFlag('metManor')) {
          ui.say('노크를 끝내기도 전에 펨버턴이 문을 열어요. “남작님은 접견 중이십니다. 남작님은 항상 접견 중이십니다. 주된 취미이지요.”');
        }
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 6.8), r: 1.8, zone: 'manor',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: M.x, z: M.z + 3.2, rotY: 0 }),
    });

    let mIdx = 0, pIdx = 0, tIdx = 0;
    register({
      getPos: () => moledecai.position, r: 3, zone: 'manor',
      label: '몰드카이 남작과 대화하기',
      use: async () => {
        if (!S.hasFlag('metManor')) {
          S.setFlag('metManor');
          await ui.say([
            '와인빛 아스콧을 두른 노년의 두더지가 벽난로에서 돌아서요. 단안경이 빛을 받아요.',
            '“손님인가! 하필 종의 섬에서라니. 앉게. 아니 서게. 의자들은 가업이고 솔직히 과대평가됐네.”',
            '“몰드카이일세. 재산은 오래됐고, 코는 더 오래됐지. 결국 이야기를 듣고 싶어질 걸세. 다들 그러니까.”',
          ], { speaker: '몰드카이 남작', voice: 280 });
          return;
        }
        const opts = [
          { label: '수다 떨기', value: 'chat' },
          { label: '재산에 대해 묻기', value: 'fortune' },
          { label: '나가기', value: null },
        ];
        if (S.countItem('lantern_koi') > 0 && !S.hasFlag('koiSold')) {
          opts.splice(2, 0, { label: '🏮 랜턴 잉어 건네기', value: 'koi', hint: '800🔘' });
        }
        const choice = await ui.ask('그래, 그래. 무슨 일인가, 무슨 일인가.', opts,
          { speaker: '몰드카이 남작', voice: 280 });
        if (choice === 'chat') {
          ui.say(MOLEDECAI_CHAT[mIdx++ % MOLEDECAI_CHAT.length], { speaker: '몰드카이 남작', voice: 280 });
        } else if (choice === 'fortune') {
          ui.say([
            '그가 단안경을 닦아요. 닦을 필요 없는 단안경을요.',
            '“조부는 인양 잠수부였네. 바로 그 인양 잠수부. 등대의 종이 가라앉았을 때 늙은 탠지가 건져 오라고 고용했지. 마흔 여름을 잠수했네.”',
            '“결국 못 찾았지. 시간당 청구였네. 우리 가문은 바다가 비밀을 지켜 준 것에 깊이 감사하고 있네.”',
          ], { speaker: '몰드카이 남작', voice: 280 });
        } else if (choice === 'koi') {
          S.removeItem('lantern_koi', 1);
          S.earn(800);
          S.setFlag('koiSold');
          kaching();
          ui.updateHUD();
          ui.say([
            '“빛나는 잉어. 동쪽 별채 연못을 위한 걸세. 어머니가 한 마리 키우셨는데, 연못은 30년째 어두웠네.”',
            '값을 깎지 않고 지불해요. 몰드카이가 그런다는 건 러브레터나 다름없어요.',
            '“연못에 다시 불이 켜지겠네. 손주들에게는 말하지 말게. 직접 찾게 두게.”',
          ], { speaker: '몰드카이 남작', voice: 280 });
        }
      },
    });
    register({
      getPos: () => pemberton.position, r: 2.6, zone: 'manor',
      label: '펨버턴과 대화하기',
      use: () => ui.say(PEMBERTON_LINES[pIdx++ % PEMBERTON_LINES.length], { speaker: '펨버턴', voice: 380 }),
    });
    register({
      getPos: () => tilly.position, r: 2.6, zone: 'manor',
      label: '틸리와 대화하기',
      use: () => ui.say(TILLY_LINES[tIdx++ % TILLY_LINES.length], { speaker: '틸리', voice: 660 }),
    });

    // ---------------- the grand staircase, and what it leads to ----------
    // it rises toward the back wall, foot to the room, and it is SOLID —
    // treads down to the floor, a banister you can't walk through
    for (let step = 0; step < 5; step++) {
      const h = 0.3 + step * 0.32;
      const tread = box(2.2, h, 0.62, 0x8a5a3a);
      tread.position.set(B.x + 8.6, h / 2, B.z - 2.3 - step * 0.62);
      group.add(tread);
    }
    const banister = box(0.1, 1.0, 3.4, 0xd9a440);
    banister.position.set(B.x + 7.45, 1.25, B.z - 3.6);
    group.add(banister);
    for (let k = 0; k < 4; k++) {
      const spindle = box(0.08, 0.9, 0.08, 0xd9a440);
      spindle.position.set(B.x + 7.45, 0.45 + k * 0.3, B.z - 2.1 - k * 0.85);
      group.add(spindle);
    }
    register({
      pos: new THREE.Vector3(B.x + 8.6, 0, B.z - 1.3), r: 1.9, zone: 'manor',
      label: '대계단 오르기',
      use: () => zones.go('manor_up'),
    });
    // the cellar hatch, by the fireplace where the floor stays warm
    const hatch = box(1.4, 0.1, 1.4, 0x6b4a2e);
    hatch.position.set(B.x - 7.5, 0.07, B.z + 3.5);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 5, 10), mat(0x55504c, 0.4));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(B.x - 7.5, 0.16, B.z + 3.1);
    group.add(hatch, ring);
    register({
      pos: new THREE.Vector3(B.x - 7.5, 0, B.z + 3.5), r: 1.8, zone: 'manor',
      label: '와인 저장고로 내려가기',
      use: () => zones.go('cellar'),
    });
    const manorRoom = collectInteriorRoot(group, manorStart);
    zones.registerInterior('manor', {
      root: [manorRoom, pupZoneGate],
      floorY: 0,
      bounds: { x0: B.x - 9.6, x1: B.x + 9.6, z0: B.z - 6.4, z1: B.z + 7.2 },
      blockers: [
        { x: B.x + 3, z: B.z + 2, w: 6.1, d: 1.7 }, // the long table, end to end
        { x: B.x - 9.5, z: B.z - 2, r: 1.4 },
        { x: B.x + 8.5, z: B.z - 3.95, w: 2.5, d: 3.4 }, // the staircase
      ],
      spawn: { x: B.x, z: B.z + 6.4, rotY: Math.PI },
      lighting: {
        bg: 0x241e16, fog: 0x241e16, fogNear: 28, fogFar: 70,
        hemiSky: 0xf2e2c4, hemiGround: 0x5a4c3a, hemiIntensity: 1.1,
        sunIntensity: 0,
      },
    });

    // ======================= upstairs: the study =========================
    const upstairsStart = group.children.length;
    const U = { x: 300, z: 1460 };
    const ufloor = box(16, 0.4, 10, 0x8a6a44);
    ufloor.position.set(U.x, -0.2, U.z);
    ufloor.receiveShadow = true;
    group.add(ufloor);
    for (const [w, d, x, z] of [
      [16, 0.4, U.x, U.z - 5], [0.4, 10, U.x - 8, U.z], [0.4, 10, U.x + 8, U.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), mat(0xddd0b8));
      wall.position.set(x, 2.5, z);
      group.add(wall);
    }
    // four-poster bed
    const bedU = box(2.4, 0.6, 3.2, 0x6b4a2e);
    bedU.position.set(U.x - 5.5, 0.3, U.z - 2.6);
    const mattU = box(2.2, 0.3, 3.0, 0xfffaf0);
    mattU.position.set(U.x - 5.5, 0.7, U.z - 2.6);
    group.add(bedU, mattU);
    for (const [px2, pz2] of [[-6.5, -4], [-4.5, -4], [-6.5, -1.2], [-4.5, -1.2]]) {
      const post = box(0.12, 2.6, 0.12, 0x55483a);
      post.position.set(U.x + px2, 1.3, U.z + pz2);
      group.add(post);
    }
    const canopy = box(2.6, 0.1, 3.4, 0x7a3a3a);
    canopy.position.set(U.x - 5.5, 2.6, U.z - 2.6);
    group.add(canopy);
    // desk, telescope, the night window
    const deskU = box(2.4, 1.0, 1.1, 0x6b4a2e);
    deskU.position.set(U.x + 2, 0.5, U.z - 4.1);
    group.add(deskU);
    // a real window: painted view (sea, sky, and HER — the little volcano
    // the Baron keeps an eye on), a wooden frame with a cross of muntins,
    // and a sill deep enough for a cup of tea. The view follows the clock.
    function paintView(night) {
      const cv = document.createElement('canvas');
      cv.width = 220; cv.height = 160;
      const c = cv.getContext('2d');
      const sky = c.createLinearGradient(0, 0, 0, 110);
      sky.addColorStop(0, night ? '#0d1a3a' : '#7cc6ee');
      sky.addColorStop(1, night ? '#2a3a66' : '#d8f0f8');
      c.fillStyle = sky;
      c.fillRect(0, 0, 220, 110);
      if (night) {
        c.fillStyle = '#eef4ff';
        for (const [x, y] of [[24, 18], [70, 34], [120, 14], [168, 30], [200, 12], [96, 52], [40, 60]]) c.fillRect(x, y, 2, 2);
      }
      c.fillStyle = night ? '#16284a' : '#3fa6d8'; // the sea
      c.fillRect(0, 108, 220, 52);
      c.fillStyle = night ? '#1c1a22' : '#6e5a4e'; // the volcano, asleep
      c.beginPath();
      c.moveTo(70, 112); c.lineTo(112, 58); c.lineTo(128, 58); c.lineTo(170, 112);
      c.closePath(); c.fill();
      c.fillStyle = night ? '#2a2630' : '#8a766a';
      c.beginPath(); c.moveTo(112, 58); c.lineTo(128, 58); c.lineTo(138, 72); c.lineTo(104, 72); c.closePath(); c.fill();
      c.fillStyle = night ? 'rgba(200,200,220,0.25)' : 'rgba(255,255,255,0.7)'; // one lazy wisp
      c.beginPath(); c.arc(124, 46, 7, 0, Math.PI * 2); c.arc(134, 36, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = night ? '#1a3322' : '#4f9a52'; // Grove's own treetops in the foreground
      for (const x of [10, 36, 186, 212]) { c.beginPath(); c.arc(x, 150, 22, 0, Math.PI * 2); c.fill(); }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    const viewDay = paintView(false), viewNight = paintView(true);
    const winU = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshBasicMaterial({ map: viewDay }));
    winU.position.set(U.x + 5, 2.6, U.z - 4.78);
    group.add(winU);
    for (const [w, h, x, y] of [
      [2.5, 0.16, 0, 0.88], [2.5, 0.16, 0, -0.88], [0.16, 1.9, -1.17, 0], [0.16, 1.9, 1.17, 0], // frame
      [0.08, 1.6, 0, 0], [2.2, 0.08, 0, 0.1], // muntins
    ]) {
      const bar = box(w, h, 0.12, 0xf3ead8);
      bar.position.set(U.x + 5 + x, 2.6 + y, U.z - 4.72);
      group.add(bar);
    }
    const sill = box(2.8, 0.14, 0.45, 0xf3ead8);
    sill.position.set(U.x + 5, 1.66, U.z - 4.6);
    group.add(sill);
    const sillCup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.14, 8), mat(0xfaf4e8, 0.5));
    sillCup.position.set(U.x + 5.8, 1.8, U.z - 4.6);
    group.add(sillCup);
    let viewT = 0;
    updates.push((dt) => {
      if (zones.current() !== 'manor_up' || (viewT -= dt) > 0) return;
      viewT = 2;
      const want = isNight() ? viewNight : viewDay;
      if (winU.material.map !== want) { winU.material.map = want; winU.material.needsUpdate = true; }
    });
    const scope = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 8), mat(0xd9a440, 0.4));
    tube.rotation.x = -0.7;
    tube.position.y = 1.3;
    scope.add(tube);
    for (const lx of [-0.25, 0.25]) {
      const leg = box(0.06, 1.1, 0.06, 0x55483a);
      leg.position.set(lx, 0.55, 0.1);
      leg.rotation.z = lx * 0.5;
      scope.add(leg);
    }
    scope.position.set(U.x + 5, 0, U.z - 3.4);
    group.add(scope);
    register({
      pos: new THREE.Vector3(U.x + 5, 0, U.z - 3), r: 1.8, zone: 'manor_up',
      label: '망원경 들여다보기',
      use: () => ui.say('자고 있는 화산을 향해 있어요. 경통에 붙은 쪽지: “화요일 새벽 3시에 연기를 뿜었다. 아무도 안 믿는다. —M.”'),
    });
    // THE crooked portrait, and what it hides
    const portCv = document.createElement('canvas');
    portCv.width = 256;
    portCv.height = 340;
    const portCtx = portCv.getContext('2d');
    const oilGround = portCtx.createRadialGradient(126, 116, 18, 128, 176, 240);
    oilGround.addColorStop(0, '#34402e');
    oilGround.addColorStop(0.62, '#241d18');
    oilGround.addColorStop(1, '#100d0b');
    portCtx.fillStyle = oilGround;
    portCtx.fillRect(0, 0, 256, 340);
    portCtx.fillStyle = 'rgba(76, 59, 33, 0.42)';
    portCtx.fillRect(28, 40, 64, 84);
    portCtx.fillStyle = 'rgba(22, 48, 40, 0.5)';
    portCtx.fillRect(160, 54, 48, 116);
    portCtx.lineJoin = 'round';
    portCtx.lineWidth = 18;
    portCtx.strokeStyle = '#9e6d24';
    portCtx.strokeRect(18, 18, 220, 304);
    portCtx.lineWidth = 7;
    portCtx.strokeStyle = '#efc96a';
    portCtx.strokeRect(32, 32, 192, 276);
    const portraitPoly = (pts, color) => {
      portCtx.fillStyle = color;
      portCtx.beginPath();
      portCtx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) portCtx.lineTo(pts[i][0], pts[i][1]);
      portCtx.closePath();
      portCtx.fill();
    };
    portraitPoly([[58, 300], [78, 248], [102, 224], [153, 224], [179, 248], [200, 300], [186, 322], [70, 322]], '#27251f');
    portraitPoly([[78, 248], [105, 224], [128, 254], [102, 288]], '#f0e6d1');
    portraitPoly([[151, 224], [178, 248], [152, 288], [128, 254]], '#d8cbb2');
    portraitPoly([[112, 254], [128, 270], [144, 254], [140, 304], [116, 304]], '#3c3329');
    portraitPoly([[119, 294], [137, 294], [137, 314], [119, 314]], '#76342c');
    portCtx.fillStyle = '#ddb54e';
    portCtx.beginPath();
    portCtx.arc(128, 318, 10, 0, Math.PI * 2);
    portCtx.fill();
    portraitPoly([[76, 118], [88, 88], [113, 68], [148, 70], [174, 92], [188, 126], [184, 170], [164, 206], [130, 225], [94, 212], [70, 174], [66, 138]], '#493b31');
    portraitPoly([[88, 88], [113, 68], [120, 117], [84, 142]], '#5a4b3e');
    portraitPoly([[148, 70], [174, 92], [166, 154], [128, 120]], '#3a2f29');
    portraitPoly([[70, 174], [94, 212], [128, 225], [112, 182]], '#362c27');
    portraitPoly([[166, 154], [184, 170], [164, 206], [132, 184]], '#2f2823');
    portraitPoly([[96, 148], [119, 132], [146, 134], [164, 154], [160, 184], [140, 204], [112, 200], [94, 176]], '#d6b69f');
    portraitPoly([[119, 132], [146, 134], [154, 156], [128, 166], [104, 156]], '#e7c8ad');
    portraitPoly([[112, 178], [128, 166], [145, 178], [136, 194], [119, 194]], '#c9a58f');
    portraitPoly([[121, 160], [136, 160], [128, 169]], '#16120f');
    portCtx.strokeStyle = '#17120f';
    portCtx.lineWidth = 4;
    portCtx.beginPath();
    portCtx.moveTo(97, 126);
    portCtx.lineTo(115, 123);
    portCtx.moveTo(141, 123);
    portCtx.lineTo(159, 126);
    portCtx.stroke();
    portCtx.lineWidth = 3;
    portCtx.strokeStyle = '#d4b04b';
    portCtx.beginPath();
    portCtx.arc(158, 128, 13, 0, Math.PI * 2);
    portCtx.moveTo(168, 137);
    portCtx.lineTo(181, 154);
    portCtx.stroke();
    const portTex = new THREE.CanvasTexture(portCv);
    portTex.colorSpace = THREE.SRGBColorSpace;
    const portGold = mat(0xd9a440);
    const portU = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.1), [
      portGold, portGold, portGold, portGold,
      new THREE.MeshBasicMaterial({ map: portTex }),
      portGold,
    ]);
    portU.castShadow = true;
    portU.receiveShadow = true;
    portU.position.set(U.x - 1.5, 2.6, U.z - 4.72);
    portU.rotation.z = 0.05; // suspiciously crooked
    group.add(portU);
    const safeBox = box(1.1, 1.1, 0.4, 0x4a4f55);
    safeBox.position.set(U.x - 1.5, 2.5, U.z - 4.86);
    safeBox.visible = false;
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), mat(0xd9a440, 0.3));
    dial.rotation.x = Math.PI / 2;
    dial.position.set(U.x - 1.5, 2.5, U.z - 4.6);
    dial.visible = false;
    group.add(safeBox, dial);
    register({
      pos: new THREE.Vector3(U.x - 1.5, 0, U.z - 3.9), r: 2.0, zone: 'manor_up',
      label: () => (S.hasFlag('foundSafe') ? '가족 금고 열기' : '삐뚤어진 초상화 바로잡기'),
      use: async () => {
        if (!S.hasFlag('foundSafe')) {
          S.setFlag('foundSafe');
          portU.rotation.z = 0;
          portU.position.x = U.x - 3.2;
          safeBox.visible = true;
          dial.visible = true;
          await ui.say([
            '초상화를 바로잡았더니 아주 옆으로 돌아가요. 자주 바로잡히는 초상화다운 솜씨로요.',
            '그 뒤: 벽 금고, 반짝이는 다이얼. 작은 카드: “비밀번호: 잠긴 적 없음. 아무도 확인 안 함.”',
          ]);
          return;
        }
        if (!S.hasFlag('safeOpened')) {
          S.setFlag('safeOpened');
          S.addItem('first_invoice');
          S.earn(300);
          jingle();
          kaching();
          ui.updateHUD();
          await ui.say([
            '손잡이가 돌아가요. 안에는 버튼. 대대로 쌓인 버튼 더미 — 그리고 금색 액자에 든 누렇게 바랜 종이 한 장.',
            '“청구서 1호. 잠수 한 (1) 여름분. 종: 위치 확인 불가. 전액 지불 완료.” 창업 문서예요.',
            '버튼 위의 쪽지: “발견자의 십일조: 한 줌 가져가시오. 엿보기는 정직하게 보상받아야 하오. —M.”',
          ]);
          ui.toast('<b>청구서 1호</b>와 버튼 한 줌을 얻었어요: <b>+300</b>!', '🧾');
          return;
        }
        ui.say('금고가 열려 있어요. 버튼들이 만족스럽게 가라앉아요. 청구서가 반짝여요. 왕조는 계속돼요.');
      },
    });
    register({
      pos: new THREE.Vector3(U.x, 0, U.z + 4.2), r: 1.8, zone: 'manor_up',
      label: '계단 내려가기',
      use: () => zones.go('manor', { x: B.x + 7.6, z: B.z - 4.4, rotY: Math.PI }),
    });
    const upstairsRoom = collectInteriorRoot(group, upstairsStart);
    zones.registerInterior('manor_up', {
      root: upstairsRoom,
      floorY: 0,
      bounds: { x0: U.x - 7.6, x1: U.x + 7.6, z0: U.z - 4.4, z1: U.z + 4.6 },
      blockers: [{ x: U.x - 5.5, z: U.z - 2.6, r: 1.8 }, { x: U.x + 2, z: U.z - 4.1, r: 1.2 }],
      spawn: { x: U.x, z: U.z + 3.8, rotY: Math.PI },
      lighting: {
        bg: 0x241e16, fog: 0x241e16, fogNear: 26, fogFar: 64,
        hemiSky: 0xf2e2c4, hemiGround: 0x5a4c3a, hemiIntensity: 1.05,
        sunIntensity: 0,
      },
    });

    // ======================= below: the wine cellar =======================
    const cellarStart = group.children.length;
    const C2 = CELLAR;
    const cfloor = box(14, 0.4, 9, 0x5a5048);
    cfloor.position.set(C2.x, -0.2, C2.z);
    cfloor.receiveShadow = true;
    group.add(cfloor);
    for (const [w, d, x, z] of [
      [14, 0.4, C2.x, C2.z - 4.5], [0.4, 9, C2.x - 7, C2.z], [0.4, 9, C2.x + 7, C2.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, d), mat(0x6e645a));
      wall.position.set(x, 2.1, z);
      group.add(wall);
    }
    // barrels on their sides, racked
    for (let i = 0; i < 4; i++) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 10), mat(0x8a5a3a));
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(C2.x - 5 + (i % 2) * 1.8, 0.7 + Math.floor(i / 2) * 1.5, C2.z - 3.4);
      barrel.castShadow = true;
      group.add(barrel);
    }
    // bottle racks: a wall of sleeping vintages
    for (let bx2 = 0; bx2 < 8; bx2++) {
      for (let by2 = 0; by2 < 4; by2++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6),
          mat(by2 === 2 && bx2 === 5 ? 0x9fe8ff : 0x2e4034, 0.3));
        bottle.rotation.x = Math.PI / 2;
        bottle.position.set(C2.x + 2 + bx2 * 0.55, 0.8 + by2 * 0.5, C2.z - 4.1);
        group.add(bottle);
      }
    }
    const candleC = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    candleC.position.set(C2.x, 1.4, C2.z + 1);
    const candleStandC = box(0.5, 1.2, 0.5, 0x55483a);
    candleStandC.position.set(C2.x, 0.6, C2.z + 1);
    group.add(candleC, candleStandC);
    const parmC = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12), mat(0xe8c95c, 0.6));
    parmC.position.set(C2.x - 5.5, 0.2, C2.z + 2.5);
    group.add(parmC);
    register({
      pos: new THREE.Vector3(C2.x + 3.5, 0, C2.z - 3), r: 2.6, zone: 'cellar',
      label: '저장고 장부 살펴보기',
      use: () => ui.say([
        '5대분 필적의 장부예요. 하이라이트:',
        '“스콜의 해 레드 — 종이 가라앉은 그 가을에 병입. 결의의 맛. 종이 다시 올라올 때까지 열지 말 것.”',
        '“문빔 ’34 — 희미하게 빛남. 문빔에 대해서는 논하지 않는다.”',
        '“화요일 화이트 — 괜찮음. 괜찮아요. 병에 든 화요일이에요.”',
      ]),
    });
    register({
      pos: new THREE.Vector3(C2.x + 4.7, 0, C2.z - 3), r: 2.2, zone: 'cellar',
      label: '빛나는 병을 불빛에 들어 보기', priority: 0,
      use: () => ui.say('문빔 ’34. 틀림없이, 빛나고 있어요. 있던 자리에 정확히 도로 놓고, 5대 전들처럼, 논하지 않기로 결심해요.'),
    });
    register({
      pos: new THREE.Vector3(C2.x, 0, C2.z + 3.6), r: 1.8, zone: 'cellar',
      label: '홀로 다시 올라가기',
      use: () => zones.go('manor', { x: B.x - 7.5, z: B.z + 2.4, rotY: 0 }),
    });
    const cellarRoom = collectInteriorRoot(group, cellarStart);
    zones.registerInterior('cellar', {
      root: cellarRoom,
      floorY: 0,
      bounds: { x0: C2.x - 6.6, x1: C2.x + 6.6, z0: C2.z - 3.6, z1: C2.z + 4.1 },
      blockers: [
        { x: C2.x - 5, z: C2.z - 3.4, r: 1.6 },
        { x: C2.x - 5.5, z: C2.z + 2.5, r: 0.75 }, // the wheel of parmesan
        { x: C2.x, z: C2.z + 1, w: 0.55, d: 0.55 }, // the candle stand
      ],
      spawn: { x: C2.x, z: C2.z + 3.2, rotY: Math.PI },
      lighting: {
        bg: 0x14100c, fog: 0x14100c, fogNear: 16, fogFar: 44,
        hemiSky: 0xd9b88a, hemiGround: 0x2a2018, hemiIntensity: 0.7,
        sunIntensity: 0,
      },
    });
  }

  // ------------------------------------------------------ the hot springs ----
  const springPools = [];
  const spy = terrainHeight(SP.x, SP.z);
  // three pools, bigger than they were, and no two the same shape — hot
  // water finds its own edges; nobody poured these from a compass
  for (const [ox, oz, r] of [[-2.9, -1.1, 2.7], [2.8, 1.8, 2.2], [0.3, -4.4, 1.75]]) {
    const px = SP.x + ox, pz = SP.z + oz;
    const py = terrainHeight(px, pz);
    const ph = rand(0, Math.PI * 2);
    const edge = (a) => r * (1 + 0.16 * Math.sin(3 * a + ph) + 0.08 * Math.sin(5 * a + ph * 1.7));
    const rim = [];
    const nStones = Math.round(r * 5);
    for (let i = 0; i < nStones; i++) {
      const a = (i / nStones) * Math.PI * 2;
      const e = edge(a) + 0.3;
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.5), 0), mat(0x9a948a));
      stone.position.set(px + Math.cos(a) * e, py + 0.15, pz + Math.sin(a) * e);
      stone.castShadow = true;
      group.add(stone);
      rim.push(stone);
    }
    const outline = new THREE.Shape();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      // shape space is (x, y) → world (x, -z) after the -π/2 tilt below
      const e = edge(a);
      if (i === 0) outline.moveTo(Math.cos(a) * e, -Math.sin(a) * e);
      else outline.lineTo(Math.cos(a) * e, -Math.sin(a) * e);
    }
    const water = new THREE.Mesh(new THREE.ShapeGeometry(outline, 1),
      new THREE.MeshStandardMaterial({
        color: 0xa8d8d0, transparent: true, opacity: 0.85,
        roughness: 0.1, emissive: 0x2a544c, emissiveIntensity: 0.3,
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(px, py + 0.42, pz);
    group.add(water);
    // steam
    const wisps = [];
    for (let k = 0; k < 3; k++) {
      const wisp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, roughness: 1 }));
      wisp.userData.k = k / 3;
      wisps.push(wisp);
      group.add(wisp);
    }
    springPools.push({ x: px, z: pz, r, y: py, wisps });

    register({
      pos: new THREE.Vector3(px, 0, pz), r: r + 1.4,
      label: '온천에 몸 담그기',
      use: async () => {
        await ui.fadeSwap(() => {
          // wade in; the water comes up to wherever worries live
          const a = rand(0, Math.PI * 2);
          const sx2 = px + Math.cos(a) * r * 0.3, sz2 = pz + Math.sin(a) * r * 0.3;
          player.group.position.set(sx2, terrainHeight(sx2, sz2), sz2);
        });
        S.drinkCoffee(90);
        ui.say(pick([
          '몸을 담갔어요. 열기가 근육 하나하나를 찾아내어 개별적으로 용서해 줘요.',
          '증기, 미네랄의 고요, 멀리 간헐천의 한숨. 생각들이 왔다가, 둘러보고, 아무 요구 없이 떠나요.',
          '건너편 카피바라가 인사 삼아 한쪽 눈을 떴다가 감아요. 접견이 끝났어요.',
        ]));
        ui.toast('유연하고 반짝거려요. <i>90초간 빨라져요!</i>', '♨️');
      },
    });
  }
  // ---- the permanent residents: the springs are never unattended ----
  // the soak dialogue has always claimed a capybara across the pool.
  // now it's load-bearing: two capybaras on permanent assignment, one
  // crocodile off duty, and the orchard's dropped oranges adrift.
  const bigPool = springPools[0], midPool = springPools[1];
  const soakers = [];
  const placeSoaker = (kind, colors, pool, ox, oz, ry, sink) => {
    const a = buildAnimal(kind, colors);
    const y0 = pool.y - sink;
    a.position.set(pool.x + ox, y0, pool.z + oz);
    a.rotation.y = ry;
    a.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(a);
    zones.addBlocker(pool.x + ox, pool.z + oz, 0.55);
    soakers.push({ g: a, y0, ph: rand(0, 9) });
    return a;
  };
  const capyA = placeSoaker('capybara', { body: 0xb08a5a, head: 0xb08a5a }, bigPool, -0.8, 0.5, 2.3, 0.24);
  placeSoaker('capybara', { body: 0xa8835e, head: 0xa8835e }, bigPool, 0.9, -0.6, -0.9, 0.2);
  const crocSoaker = placeSoaker('croc', { body: 0x4a6a2a, head: 0x4a6a2a }, midPool, 0.2, 0.3, 1.1, 0.34);

  const springOranges = [];
  for (let i = 0; i < 5; i++) {
    const pool = springPools[i % springPools.length];
    const orange = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0xff9430, 0.6));
    orange.userData = { pool, a: rand(0, Math.PI * 2), rr: rand(0.35, 0.7), sp: rand(0.08, 0.2), ph: rand(0, 9) };
    group.add(orange);
    springOranges.push(orange);
  }

  register({
    pos: new THREE.Vector3(capyA.position.x, 0, capyA.position.z), r: 2.4,
    label: '탕 속 손님들에게 인사하기',
    use: () => ui.say(pick([
      '(카피바라 둘 다 눈을 뜨지 않아요. 따뜻함은 풀타임 직업이라는 걸 깨달았고, 둘은 경력직 전문가예요.)',
      '카피바라 하나가 아주 천천히 숨을 내쉬어요. 인사이거나 하나의 온전한 철학이에요. 아마 둘 다요.',
      '“음,” 가까운 쪽 카피바라가 다른 건 아무것도 움직이지 않고 말해요. 경영진 치고 최고의 찬사예요.',
    ])),
  });
  register({
    pos: new THREE.Vector3(crocSoaker.position.x, 0, crocSoaker.position.z), r: 2.4,
    label: '악어에게 고갯짓하기',
    use: () => ui.say(pick([
      '(고갯짓했어요. 악어가 답례해요 — 정확히 한 번, 나머지는 나중을 위해 아껴요.)',
      '악어가 증기를 바라봐요, 어떤 이들이 TV를 보듯이. 아무것도 안 해요. 그게 좋은 점이에요.',
    ])),
  });

  updates.push((dt, t) => {
    for (const pool of springPools) {
      for (const wisp of pool.wisps) {
        wisp.userData.k = (wisp.userData.k + dt * 0.25) % 1;
        const k = wisp.userData.k;
        wisp.position.set(
          pool.x + Math.sin(t * 0.6 + k * 9) * pool.r * 0.5,
          pool.y + 0.7 + k * 1.6,
          pool.z + Math.cos(t * 0.5 + k * 7) * pool.r * 0.4);
        wisp.scale.setScalar(0.6 + k * 1.2);
        wisp.material.opacity = 0.35 * (1 - k);
      }
    }
    for (const s of soakers) {
      s.g.position.y = s.y0 + Math.sin(t * 0.8 + s.ph) * 0.035; // spa physics
    }
    for (const o of springOranges) {
      const u = o.userData;
      u.a += dt * u.sp;
      o.position.set(
        u.pool.x + Math.cos(u.a) * u.pool.r * u.rr,
        u.pool.y + 0.46 + Math.sin(t * 1.3 + u.ph) * 0.03,
        u.pool.z + Math.sin(u.a) * u.pool.r * u.rr);
      o.rotation.y = u.a;
    }
  });

  // the springs sit in orchard country: oranges hang right over the water
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const spot = treeSpotNear(SP.x + Math.cos(a) * (SP.r + 2.5), SP.z + Math.sin(a) * (SP.r + 2.5));
    if (!spot) continue;
    const { x: tx, z: tz, h: ty } = spot;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.6, 7), mat(0x7a5230));
    trunk.position.y = 0.8;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 1), mat(0x3f9747));
    crown.position.y = 2.35;
    tree.add(crown);
    const fruits = [];
    for (let f = 0; f < 5; f++) {
      const fa = (f / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 0), mat(0xff9430, 0.55));
      onCrown(fruit, fa, 2.1 + rand(0, 0.7), 1.45, 2.35, 1);
      tree.add(fruit);
      fruits.push(fruit);
    }
    tree.position.set(tx, ty - 0.05, tz);
    zones.addBlocker(tx, tz, 0.6, 'tree'); // trunks are solid
    tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(tree);
    const ot = { oranges: fruits, regrow: 0 };
    orchardTrees.push(ot);
    register({
      pos: new THREE.Vector3(tx, 0, tz), r: 2.3,
      enabled: () => ot.oranges[0].visible,
      label: '오렌지 따기',
      use: () => {
        ot.oranges.forEach((f) => { f.visible = false; });
        ot.regrow = rand(360, 620);
        S.addItem('orange', 3);
        jingle();
        ui.foundItem('orange');
        ui.updateHUD();
      },
    });
  }
  // benches for the post-soak glow
  const springBenches = [
    [SP.x - 4.5, SP.z + 4.5, 0.6],
    [SP.x + 4.5, SP.z + 4, -0.7 + Math.PI],
    [SP.x + 0.5, SP.z - 5.5, Math.PI],
  ];
  for (const [bx2, bz2, ry2] of springBenches) {
    const by2 = terrainHeight(bx2, bz2);
    const bench = box(2.0, 0.4, 0.7, 0xa97c50);
    bench.position.set(bx2, by2 + 0.35, bz2);
    bench.rotation.y = ry2;
    const back = box(2.0, 0.6, 0.15, 0xa97c50);
    back.position.set(bx2 - Math.sin(ry2) * 0.32, by2 + 0.85, bz2 - Math.cos(ry2) * 0.32);
    back.rotation.y = ry2;
    group.add(bench, back);
    zones.addBlockerBox(bx2 - Math.sin(ry2) * 0.1, bz2 - Math.cos(ry2) * 0.1, 2.0, 0.95, ry2, 0.02);
  }
  register({
    pos: new THREE.Vector3(SP.x - 4.5, 0, SP.z + 4.5), r: 2.2,
    label: '온천 벤치에서 쉬기', priority: 0,
    use: () => ui.say('앉았어요, 증기로 따뜻하고 오렌지 향기가 나요. 카피바라가 지나가며 고갯짓해요, 전문가 대 전문가로.'),
  });

  // geysers, on a proud schedule
  for (const [gx, gz] of [[SP.x + 4.5, SP.z - 3.5], [SP.x - 5, SP.z + 3]]) {
    const gy = terrainHeight(gx, gz);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 0.6, 8), mat(0x9a948a));
    nozzle.position.set(gx, gy + 0.3, gz);
    group.add(nozzle);
    zones.addBlocker(gx, gz, 0.72);
    const jet = [];
    for (let k = 0; k < 6; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 1 }));
      jet.push(puff);
      group.add(puff);
    }
    let gTimer = rand(12, 30);
    let erupting = 0;
    updates.push((dt, t, playerPos) => {
      gTimer -= dt;
      if (gTimer <= 0 && erupting <= 0) {
        erupting = 4;
        gTimer = rand(22, 45);
        if (playerPos && Math.hypot(playerPos.x - gx, playerPos.z - gz) < 30) splash();
      }
      if (erupting > 0) {
        erupting -= dt;
        jet.forEach((puff, k) => {
          const kk = ((t * 1.6) + k / 6) % 1;
          puff.position.set(gx + Math.sin(t * 8 + k) * 0.2, gy + 0.6 + kk * 5.5, gz);
          puff.scale.setScalar(0.5 + kk * 1.3);
          puff.material.opacity = (erupting > 1 ? 0.6 : 0.6 * erupting) * (1 - kk * 0.8);
        });
      } else {
        for (const puff of jet) puff.material.opacity = 0;
      }
    });
  }

  // ------------------------------------------- the southern orchards ----
  // the peninsula is orchard country: oranges and peaches, heavy and visible
  const SO = SITES.southOrchard;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const spot = treeSpotNear(SO.x - 7 + col * 4.4 + (row % 2) * 1.6, SO.z - 7 + row * 4.6);
      if (!spot) continue;
      const { x: tx, z: tz, h: ty } = spot;
      const peachy = (row + col) % 2 === 1;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 1.7, 7), mat(0x7a5230));
      trunk.position.y = 0.85;
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), mat(peachy ? 0x55b055 : 0x3f9747));
      crown.position.y = 2.5;
      crown.scale.y = 0.9;
      tree.add(crown);
      const fruits = [];
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + rand(-0.25, 0.25);
        const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0),
          mat(peachy ? 0xffb38a : 0xff9430, 0.55));
        onCrown(fruit, a, 2.15 + rand(0, 0.8), 1.6, 2.5, 0.9);
        tree.add(fruit);
        fruits.push(fruit);
      }
      tree.position.set(tx, ty - 0.05, tz);
      zones.addBlocker(tx, tz, 0.6, 'tree'); // trunks are solid
      tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(tree);
      const ot = { oranges: fruits, regrow: 0 };
      orchardTrees.push(ot);
      const itemId = peachy ? 'peach' : 'orange';
      register({
        pos: new THREE.Vector3(tx, 0, tz), r: 2.3,
        enabled: () => ot.oranges[0].visible,
        label: peachy ? '복숭아 따기' : '오렌지 따기',
        use: () => {
          ot.oranges.forEach((f) => { f.visible = false; });
          ot.regrow = rand(360, 620);
          S.addItem(itemId, 3);
          jingle();
          ui.foundItem(itemId);
          ui.updateHUD();
        },
      });
    }
  }

  // Panhandle wildflowers stay off the Grove Line and out from under trees.
  const flowerColors = [0xff6b81, 0xffd23e, 0xffffff, 0xc77dff];
  function addFlower(x, z, h) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 4), mat(0x4e9a45));
    stem.position.set(x, h + 0.3, z);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(pick(flowerColors), 0.7));
    bloom.position.set(x, h + 0.45, z);
    for (const part of [stem, bloom]) {
      part.castShadow = true;
      part.receiveShadow = true;
      group.add(part);
    }
  }
  for (const islet of ISLAND5_HAND) {
    let flowers = 0;
    for (let tries = 0; tries < 80 && flowers < 12; tries++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand(0, 1)) * (islet.r - 1.2);
      const x = islet.x + Math.cos(a) * r;
      const z = islet.z + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h <= WATER_Y || !clearOfGroveLine(x, z) || zones.nearBlocker(x, z, 1.2)) continue;
      if (placedTrees.some((p) => Math.hypot(x - p.x, z - p.z) < 2.8)) continue;
      addFlower(x, z, h);
      flowers++;
    }
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
      if (Math.hypot(dx, dz) < 7) {
        npc.rotation.y = turnToward(npc.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
    }
  });
      }
