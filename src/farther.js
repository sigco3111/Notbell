// Farther Isle — way out past the Far Isle, which is the entire joke: a
// long ride on the Farther Line into open water, to a campground in the lee
// of its own little mountain. Tents and RVs and one fire that has never been
// allowed to go out; picnic tables, a blanket, a hammock, kayaks on the
// beach; a trail that switchbacks to the summit (sign the register); the
// Farther General under Cypress the pelican; and the mangrove flats, trees
// that waded out to meet the tide halfway and liked it there. Campers come
// and go — a different handful every day.

import * as THREE from 'three';
import { makeFlames } from './campfire.js';
import { SITES, terrainHeight, ISLAND7, ISLAND7_FLATS, ISLAND7_BACK, MOUNT7, TRAIL7, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching, sip, tone } from './audio.js';
import { buildAnimal, animateGait } from './animals.js';
import { rand, pick, turnToward } from './utils.js';
import { addIslandInfo, addZonePlace } from './fieldguide.js';
import { glowWindow } from './nightglow.js';
import { waveAt } from './ocean.js';
import { isNight } from './calendar.js';
import { ITEMS } from './catalog.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}

const IN_GENERAL = { x: 300, z: 1940 }; // the store interior, off in the elsewhere

const VOICE = { huck: 250, wren: 480, cypress: 300 };

// the ferry calls here — boats.js reads this (create farther before boats)
export const FARTHER_DOCK = { x: 0, z: 0, rotY: 0, buoyPos: null };

const HUCK_CHAT = [
  '헉이야. 열한 번째 여름을 여기서 캠핑 중이지. 텐트가 RV가 되고, RV에 어닝이 달렸어. 조만간 현관도 생기겠지. 집이란 그렇게 생기는 거야, 친구 — 일부러 짓는 사람은 없어.',
  '조수는 밀려오고, 밀려나가. 나는 의자를 방향마다 하나씩 둬.',
  '사이프러스는 콩을 세 종류 들여놓고 세 번째가 뭔지 절대 안 알려줘. 엄청나게 존중해.',
  '언제 집에 가냐고들 물어. 집은 주전자가 있는 곳이야. 내 주전자는 여기 있어.',
];

const WREN_CHAT = [
  '쉿 — 저기. 갯벌에. 왜가리. 화요일부터 한 발로 서 있어. 헌신적이야. 존경해.',
  '이번 달 기록된 새 마흔한 마리. 반영까지 세면 마흔둘인데, 난 안 세. 엄밀함이야, 친구.',
  '희귀한 새를 바라고 보는 사람들도 있지. 난 누군가는 기록해야 해서 봐. 하늘은 하루 종일 그냥 뭔가를 해, 감독도 없이.',
  '맹그로브가 섬 최고의 은신처야. 물에 서 있으면 새들이 널 가구로 여겨. 가구 노릇은 아주 편안해.',
];

const CYPRESS_CHAT = [
  '제너럴에 온 걸 환영해. 다 있어. 없으면 목요일에 다시 와 — 조수가 보통 하나씩 가져다줘.',
  '영수증은 파우치로. 모든 게 파우치로. 파우치가 파일링 시스템이고, 파일링 시스템은 가득 찼어.',
  '마시멜로가 최고 인기. 콩이 2위. 세 번째 콩은 예상보다 잘 팔려.',
];

export function createFarther() {
  const group = new THREE.Group();
  const updates = [];       // island zone
  const storeUpdates = [];  // 'general' zone
  const C = SITES.camp;
  const SY = SITES.storeYard;
  const F = ISLAND7_FLATS;

  addIslandInfo({
    key: 'farther',
    name: '파더 섬', x: ISLAND7.x, z: ISLAND7.z + 4, r: 30, icon: '🏕️',
    blurb: '파 아일보다 한참 더 멀리, 그게 농담 전부야. 자기만의 작은 산 아래 캠핑장(정상 트레일 — 등록부에 서명), 카약, 파더 제너럴, 그리고 조수를 중간까지 마중 나간 맹그로브.',
    folk: '헉 · 렌 · 사이프러스 · 스틸트(한 발, 화요일부터) · 이번 주 캠핑하는 누구든',
    mystery: '“저녁이면 파 아일 너머에 연기. 모닥불 연기 — 정다운 종류. 물 건너에서 마시멜로 냄새가 생생히 났어. 주저앉을 수밖에 없었지.” —브라인 선장',
  });

  // ======================================================== the campsite ----
  // the camp sits back from the station ramp now (passengers used to step off
  // the Farther Line straight into the fire), everything a stride apart
  const FIRE = { x: C.x + 0.5, z: C.z + 0.5 };
  let campfire = null;
  {
    const fy = terrainHeight(FIRE.x, FIRE.z);
    // stone ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rand(-0.1, 0.1);
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + rand(-0.04, 0.06), 0), mat(0x8a8378));
      stone.position.set(FIRE.x + Math.cos(a) * 0.85, fy + 0.12, FIRE.z + Math.sin(a) * 0.85);
      stone.castShadow = stone.receiveShadow = true;
      group.add(stone);
    }
    // charred logs, leaned the way fires like
    for (const ry of [0.3, 1.4, 2.5]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 6), mat(0x4a3a2c));
      log.rotation.z = Math.PI / 2 - 0.35;
      log.rotation.y = ry;
      log.position.set(FIRE.x, fy + 0.22, FIRE.z);
      log.castShadow = true;
      group.add(log);
    }
    // the flames (and the warm pool of light they throw): see campfire.js
    campfire = makeFlames(FIRE.x, fy, FIRE.z, { scale: 1.1 });
    group.add(campfire.group);
    zones.addBlocker(FIRE.x, FIRE.z, 1.35); // solid: NOBODY walks through the fire
    // log benches, two sides
    for (const [bx, bz, ry] of [[FIRE.x - 2.1, FIRE.z + 0.6, 0.5], [FIRE.x + 1.6, FIRE.z + 1.6, -0.7]]) {
      const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 2.2, 7), mat(0x8a5a3a));
      bench.rotation.z = Math.PI / 2;
      bench.rotation.y = ry;
      bench.position.set(bx, terrainHeight(bx, bz) + 0.26, bz);
      bench.castShadow = bench.receiveShadow = true;
      group.add(bench);
      zones.addBlockerBox(bx, bz, 2.2, 0.55, ry, 0, 'tree'); // the whole log, not just its middle ('tree': the planners placed round the old circle; don't reshuffle them)
    }
    register({
      pos: new THREE.Vector3(FIRE.x, 0, FIRE.z + 1.6), r: 1.9,
      label: '모닥불 곁에 앉기',
      use: async () => {
        if (!(S.state.inv.marshmallows > 0)) {
          ui.say('불이 넉넉하게 타닥거려요. 마시멜로가 있다면 가보급 브론즈로 구워줄 거예요. 제너럴에서 팔아요.');
          return;
        }
        const c = await ui.ask('불이 늘 하던 제안을 해요.', [
          { label: '🍡 마시멜로 굽기', value: 'toast' },
          { label: '그냥 앉아 있기', value: null },
        ]);
        if (c === 'toast') {
          await ui.fadeSwap(() => {});
          ui.say('천천히 하나를 구워요, 조수가 도는 방식대로 — 참을성 있게, 양면을. 좋은 결정의 정확한 색깔이 나와요. 봉지 어딘가에서 다른 하나가 그 자리를 채워요.');
        } else {
          ui.say('앉아 있어요. 말은 불이 해요. 어쩐지 동시에 좋은 청취자이기도 해요.');
        }
      },
    });
  }

  // ------------------------------------------------ walk-in camp rooms ----
  // Every tent and RV opens: step up to the door and you're inside (a small
  // room off in the elsewhere, like every interior). Each gets furnished by
  // its own dress() — whoever lives there shows in what's lying about.
  let roomSlot = 0;
  const campRoomUpdates = {};
  function campRoom(id, name, kind, doorOut, dress) {
    const B = { x: 360 + (roomSlot % 4) * 34, z: 1940 + Math.floor(roomSlot / 4) * 34 };
    roomSlot++;
    const start = group.children.length;
    const isTent = kind === 'tent';
    const W = isTent ? 5 : 7, D = isTent ? 4.4 : 3.6;
    const floor = box(W, 0.3, D, isTent ? 0x8f8a6a : 0x9a7b5a);
    floor.position.set(B.x, -0.15, B.z);
    group.add(floor);
    if (isTent) {
      // canvas walls sloping up to a ridge: two big tilted panels + the back
      const canvas = new THREE.MeshStandardMaterial({ color: dress.canvas ?? 0xd9c08f, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
      for (const sx of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(D + 0.2, 3.4), canvas);
        panel.rotation.order = 'ZYX'; // face sideways, then lean in to the ridge
        panel.rotation.y = Math.PI / 2;
        panel.rotation.z = sx * 0.62;
        panel.position.set(B.x + sx * 1.15, 1.25, B.z);
        group.add(panel);
      }
      const tri = new THREE.Shape([new THREE.Vector2(-2.2, 0), new THREE.Vector2(2.2, 0), new THREE.Vector2(0, 2.65)]);
      const backTri = new THREE.Mesh(new THREE.ShapeGeometry(tri), canvas);
      backTri.position.set(B.x, 0, B.z - D / 2);
      group.add(backTri);
      const lamp = new THREE.PointLight(0xffd9a0, 18, 9, 2);
      lamp.position.set(B.x, 2.1, B.z);
      group.add(lamp);
    } else {
      const wallMat = mat(dress.wall ?? 0xe8dcc4);
      for (const [w, h, d, x, z] of [
        [W, 2.6, 0.2, B.x, B.z - D / 2], [0.2, 2.6, D, B.x - W / 2, B.z], [0.2, 2.6, D, B.x + W / 2, B.z],
      ]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        wall.position.set(x, 1.3, z);
        wall.receiveShadow = true;
        group.add(wall);
      }
      // a bright window on the back wall, and a ceiling lamp
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ color: 0xcfeaf6 }));
      win.position.set(B.x + 1.2, 1.6, B.z - D / 2 + 0.11);
      group.add(win);
      const lamp = new THREE.PointLight(0xffe2b8, 24, 12, 2);
      lamp.position.set(B.x, 2.3, B.z);
      group.add(lamp);
    }
    const blockers = [];
    dress.build?.(B, W, D, blockers);
    const room = collectInteriorRoot(group, start);
    zones.registerInterior(id, {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - W / 2 + 0.5, x1: B.x + W / 2 - 0.5, z0: B.z - D / 2 + 0.5, z1: B.z + D / 2 + 0.2 },
      blockers,
      spawn: { x: B.x, z: B.z + D / 2 - 0.2, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 20, fogFar: 50,
        hemiSky: 0xfff0d8, hemiGround: 0x7a6448, hemiIntensity: 1.5, sunIntensity: 0,
      },
    });
    addZonePlace(id, name);
    zones.setDoor(id, doorOut);
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + D / 2), r: 1.6, zone: id,
      label: '밖으로 나가기',
      use: () => zones.leaveTo(doorOut),
    });
    for (const it of dress.things ?? []) register({ ...it, zone: id, pos: new THREE.Vector3(B.x + it.at[0], 0, B.z + it.at[1]) });
    return B;
  }
  // (small furnishing helpers for the rooms)
  function sleepingBag(x, z, ry, color) {
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.3, 3, 6), mat(color));
    bag.rotation.z = Math.PI / 2;
    bag.rotation.y = ry;
    bag.scale.set(1, 0.5, 1);
    bag.position.set(x, 0.18, z);
    group.add(bag);
    const pillow = box(0.5, 0.14, 0.35, 0xf3efe6);
    pillow.position.set(x + Math.cos(ry) * 0.75, 0.1, z - Math.sin(ry) * 0.75);
    pillow.rotation.y = ry;
    group.add(pillow);
  }
  function lantern(x, y, z) {
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    l.position.set(x, y + 0.2, z);
    const base = box(0.2, 0.08, 0.2, 0x3a3630);
    base.position.set(x, y + 0.04, z);
    group.add(l, base);
  }

  const TENT_ROOMS = {
    wren: {
      name: '⛺ 렌의 텐트', label: '렌의 텐트에 고개 숙여 들어가기',
      build: (B, W, D, bl) => {
        sleepingBag(B.x - 1, B.z - 0.6, 0, 0x5b8b7a);
        lantern(B.x + 1.3, 0, B.z - 1.2);
        // field notebooks, stacked with rigor; a spare pair of binoculars
        for (let i = 0; i < 4; i++) {
          const nb = box(0.4, 0.06, 0.3, [0x8a5a3a, 0x3a7d8a, 0xb0453a, 0xd9c08f][i]);
          nb.position.set(B.x + 1.2, 0.03 + i * 0.065, B.z + 0.3);
          nb.rotation.y = i * 0.2;
          group.add(nb);
        }
        bl.push({ x: B.x - 1, z: B.z - 0.6, w: 1.9, d: 0.8 });
      },
      things: [{ at: [1.2, 0.3], r: 1.4, label: '렌의 야외 노트 읽기',
        use: () => ui.say('“화: 왜가리, 한 발. 수: 왜가리, 한 발. 목: 왜가리, 한 발, 나를 쳐다봄. 돌파구.”') }],
    },
    spare: {
      name: '⛺ 여분 텐트', label: '여분 텐트 들여다보기',
      build: (B, W, D, bl) => {
        const blanket = box(1.6, 0.12, 1.2, 0xc9705a);
        blanket.position.set(B.x, 0.06, B.z - 0.8);
        group.add(blanket);
        lantern(B.x - 1.4, 0, B.z - 1.3);
        bl.push({ x: B.x, z: B.z - 0.8, w: 1.6, d: 1.2 });
      },
      things: [{ at: [0, -0.2], r: 1.6, label: '여분 텐트 둘러보기',
        use: () => ui.say('청소됐고, 환기됐고, 개킨 담요가 모서리에 반듯해요. 그 위 쪽지: “필요한 누구에게나. —H.”') }],
    },
    campers: {
      name: '⛺ 이번 주 텐트', label: '캠퍼들의 텐트 들여다보기',
      build: (B, W, D, bl) => {
        sleepingBag(B.x - 1.1, B.z - 0.5, 0.15, 0xe8a33a);
        sleepingBag(B.x + 1.0, B.z - 0.9, -0.2, 0x6a7ec9);
        lantern(B.x, 0, B.z - 1.6);
        const pack = box(0.5, 0.6, 0.3, 0x3f7a5a);
        pack.position.set(B.x + 1.5, 0.3, B.z + 0.6);
        group.add(pack);
        const snacks = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0xf2cf5b));
        snacks.position.set(B.x - 0.2, 0.1, B.z + 0.4);
        group.add(snacks);
        bl.push({ x: B.x - 1.1, z: B.z - 0.5, w: 1.9, d: 0.8 }, { x: B.x + 1.0, z: B.z - 0.9, w: 1.9, d: 0.8 });
      },
      things: [{ at: [-0.2, 0.6], r: 1.4, label: '간식 상황 살펴보기',
        use: () => ui.say('트레일 믹스, 선별 완료: 초콜릿 조각이 전부 사라졌어요. 여기 누군가는 프로이고, 다른 누군가는 오늘 밤 알게 될 거예요.') }],
    },
  };

  // tents: canvas prisms, one lived-in, one politely spare
  const tentDoors = [];
  function tent(x, z, ry, color, id) {
    const g = new THREE.Group();
    const y = terrainHeight(x, z);
    const bodyGeo = new THREE.CylinderGeometry(1.15, 1.15, 2.2, 3, 1, false, Math.PI / 2);
    bodyGeo.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, mat(color, 0.95));
    body.scale.y = 0.85;
    body.position.y = 0.58;
    g.add(body);
    const dark = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.06, 3, 1, false, Math.PI / 2), mat(0x3a3226));
    dark.rotation.z = Math.PI / 2; // the doorway: a shadow the shape of the tent
    dark.scale.x = 0.85;
    dark.position.set(1.1, 0.45, 0);
    g.add(dark);
    g.rotation.y = ry;
    g.position.set(x, y, z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(g);
    zones.addBlocker(x, z, 1.3);
    // the flap is on the tent's local +x: step up to it and duck inside
    const dx = Math.cos(ry), dz = -Math.sin(ry);
    const doorOut = { x: x + dx * 2.3, z: z + dz * 2.3, rotY: Math.atan2(dx, dz) };
    tentDoors.push({ doorOut, x, z, dx, dz, id: `tent_${id}` }); // (nudged onto open ground once the camp is built)
    const T = TENT_ROOMS[id];
    campRoom(`tent_${id}`, T.name, 'tent', doorOut, { canvas: color, ...T });
    register({
      pos: new THREE.Vector3(x + dx * 1.9, 0, z + dz * 1.9), r: 1.5,
      label: T.label,
      use: () => zones.go(`tent_${id}`),
    });
  }
  tent(C.x - 8.5, C.z + 0.5, 1.4, 0xd9c08f, 'wren');     // Wren's, sun-faded canvas
  tent(C.x + 4.5, C.z - 8.5, -2.0, 0x5b8b7a, 'spare');    // the spare, sea-green (up on the grass past the grill — it used to crowd the General's porch)
  tent(C.x + 6, C.z + 7.5, 2.6, 0xc9705a, 'campers');     // this week's campers

  function rvFurniture(B, W, D, bl, { bench = 0xb0453a, curtains = null } = {}) {
    // a dinette at one end, a galley along the back, a bunk at the other end
    const table = box(1.0, 0.08, 0.8, 0xa97c50);
    table.position.set(B.x - 2.2, 0.75, B.z - 0.6);
    const tleg = box(0.1, 0.72, 0.1, 0x6b7280);
    tleg.position.set(B.x - 2.2, 0.36, B.z - 0.6);
    group.add(table, tleg);
    for (const sx of [-0.8, 0.8]) {
      const seat = box(0.5, 0.45, 0.9, bench);
      seat.position.set(B.x - 2.2 + sx, 0.22, B.z - 0.6);
      group.add(seat);
    }
    const galley = box(2.0, 0.9, 0.6, 0xd9cbb0);
    galley.position.set(B.x, 0.45, B.z - D / 2 + 0.45);
    group.add(galley);
    const kettle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0x8fa3b8, 0.4));
    kettle.position.set(B.x + 0.4, 1.02, B.z - D / 2 + 0.45);
    group.add(kettle);
    const bunk = box(1.6, 0.4, 1.9, 0x8a6a48);
    bunk.position.set(B.x + 2.5, 0.2, B.z - 0.4);
    const mattress = box(1.5, 0.18, 1.8, 0xece3d0);
    mattress.position.set(B.x + 2.5, 0.49, B.z - 0.4);
    group.add(bunk, mattress);
    if (curtains) {
      const cur = box(1.6, 0.9, 0.04, curtains);
      cur.position.set(B.x + 1.2, 1.6, B.z - D / 2 + 0.14);
      group.add(cur);
    }
    bl.push(
      { x: B.x - 2.2, z: B.z - 0.6, w: 2.2, d: 1.0 },
      { x: B.x, z: B.z - D / 2 + 0.45, w: 2.0, d: 0.7 },
      { x: B.x + 2.5, z: B.z - 0.4, w: 1.7, d: 2.0 },
    );
  }
  const RV_ROOMS = {
    huck: {
      name: '🚐 헉의 RV', label: '헉의 RV에 들어가기', wall: 0xe8dcc4,
      build: (B, W, D, bl) => {
        rvFurniture(B, W, D, bl);
        // the wall of tide tables, annotated in pencil
        for (let i = 0; i < 6; i++) {
          const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xf6f0de }));
          sheet.position.set(B.x - 3.38, 1.3 + (i % 2) * 0.6, B.z - 1 + Math.floor(i / 2) * 0.5);
          sheet.rotation.y = Math.PI / 2;
          sheet.rotation.z = (i % 3 - 1) * 0.08;
          group.add(sheet);
        }
      },
      things: [
        { at: [-2.4, 0.4], r: 1.4, label: '조수표 읽기', use: () => ui.say('시각과 높이의 열이 열한 여름치 쌓여 있어요. 어떤 기록은 그냥 “응.” 하나는 “큰 거 — 가치 있었어.” 또 하나는 “주전자.”') },
        { at: [0.4, -0.8], r: 1.2, label: '주전자 보기', use: () => ui.say('아직 따뜻해요. 헉의 주전자는 언제나 아직 따뜻해요. 집은 그게 있는 곳이에요.') },
      ],
    },
    spare: {
      name: '🚐 휴가 RV', label: '다른 RV에 들어가기', wall: 0xdfe6d8,
      build: (B, W, D, bl) => rvFurniture(B, W, D, bl, { bench: 0x5b8b7a, curtains: 0xd84f4f }),
      things: [
        { at: [1.2, -0.9], r: 1.3, label: '쪽지 읽기', use: () => ui.say('커튼에 테이프로: “휴가에서 휴가 중. 곧 돌아옴. 코코아는 드셔도 됨, 좋은 코코아는 안 됨.”') },
      ],
    },
    gordy: {
      name: '🛻 고디의 트레일러', label: '고디의 트레일러에 들어가기', wall: 0xc9c2a8,
      build: (B, W, D, bl) => {
        rvFurniture(B, W, D, bl, { bench: 0x6e7e4a, curtains: 0x8a6a48 });
        const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.3, 6), mat(0xd9b44a, 0.3));
        trophy.position.set(B.x - 0.4, 1.05, B.z - D / 2 + 0.45);
        group.add(trophy);
        const pizza = box(0.6, 0.06, 0.6, 0xe8d8b0);
        pizza.position.set(B.x - 2.2, 0.82, B.z - 0.6);
        group.add(pizza);
      },
      things: [
        { at: [-0.4, -0.8], r: 1.2, label: '트로피 읽기', use: () => ui.say('“세계에서 제일 그럭저럭인 낚시꾼.” 새겨져 있어요. 누군가 각인비를 냈어요. 아마 고디.') },
      ],
    },
  };

  // RVs: little caravans. one is a residence, one is a holiday from a holiday.
  const rvKnocks = [];
  function caravan(x, z, faceX, faceZ, bodyColor, stripeColor, who) {
    const g = new THREE.Group();
    const y = terrainHeight(x, z);
    const body = box(4.0, 1.9, 2.1, bodyColor);
    body.userData.occlude = true;
    body.position.y = 1.35;
    g.add(body);
    const roofGeo = new THREE.CylinderGeometry(1.15, 1.15, 3.9, 6, 1, false, 0);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(bodyColor));
    roof.scale.y = 0.42;
    roof.position.y = 2.3;
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    const stripe = box(4.02, 0.3, 2.12, stripeColor);
    stripe.position.y = 1.15;
    g.add(stripe);
    const door = box(0.8, 1.4, 0.1, 0x4a4038);
    door.position.set(-0.9, 1.1, 1.08);
    g.add(door);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.08), mat(0xbfe6f2, 0.4));
    pane.castShadow = false;
    pane.position.set(0.9, 1.6, 1.06);
    g.add(pane);
    glowWindow(pane, { max: 0.5 });
    for (const sx of [-1.3, 1.3]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 8), mat(0x2e2a26, 0.7));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.34, 1.0);
      wheel.castShadow = true;
      g.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.z = -1.0;
      g.add(wheel2);
    }
    const hitch = box(0.14, 0.14, 1.1, 0x6b7280);
    hitch.position.set(-2.4, 0.6, 0);
    hitch.rotation.y = Math.PI / 2;
    g.add(hitch);
    const vent = box(0.5, 0.14, 0.5, 0x9aa3ad);
    vent.position.set(0.8, 2.85, 0);
    g.add(vent);
    const rotY = Math.atan2(faceX - x, faceZ - z);
    g.rotation.y = rotY;
    g.position.set(x, y, z);
    group.add(g);
    zones.addBlockerBox(x, z, 4.3, 2.3, rotY, 0.05);
    // the door is at local (-0.9, +z side): step out onto the grass there
    const c0 = Math.cos(rotY), s0 = Math.sin(rotY);
    const toWorld = (lx, lz) => ({ x: x + lx * c0 + lz * s0, z: z - lx * s0 + lz * c0 });
    const doorOut = { ...toWorld(-0.9, 2.4), rotY };
    const R = RV_ROOMS[who];
    campRoom(`rv_${who}`, R.name, 'rv', doorOut, R);
    const knock = toWorld(-0.9, 1.9);
    rvKnocks.push({ ...knock, who });
    register({
      pos: new THREE.Vector3(knock.x, 0, knock.z), r: 1.5,
      label: R.label,
      use: () => zones.go(`rv_${who}`),
    });
    return g;
  }
  // Huck's rig, door to the fire; the spare, curtains drawn
  caravan(C.x + 9.5, C.z - 2.5, FIRE.x, FIRE.z, 0xece3d0, 0x3a7d8a, 'huck');
  caravan(C.x + 0.5, C.z + 11.5, FIRE.x, FIRE.z, 0xc9d4c0, 0xb0453a, 'spare');
  // ================================================= the back peninsula ----
  // out past the camp, over a neck of sand: a trailer that was parked here
  // "for the weekend" several years ago, a lawn chair, a television on a
  // crate (it gets one channel; it plays it LOUD), a cooler, and Gordy.
  const GB = { x: ISLAND7_BACK.x + 1, z: ISLAND7_BACK.z };
  const gordyTalk = { first: true, i: 0 };
  let tvScreen = null, gordy = null;
  {
    caravan(GB.x + 2.2, GB.z - 1.6, GB.x - 6, GB.z + 1, 0xb8bcc0, 0x6e7e4a, 'gordy');
    // the lawn chair, the tv on its crate, the cooler
    const chairAt = { x: GB.x - 1.6, z: GB.z + 2 };
    // a low beach chair, wide enough for a skunk: striped canvas, armrests,
    // a cupholder, and a back that stops below the tail
    const chair = new THREE.Group();
    const STRIPES = [0x6aa0c9, 0xf3efe6];
    for (let i = 0; i < 5; i++) {
      const slat = box(0.22, 0.06, 1.0, STRIPES[i % 2]);
      slat.position.set(-0.44 + i * 0.22, 0.28, 0);
      chair.add(slat);
      const bslat = box(0.22, 0.5, 0.06, STRIPES[i % 2]);
      bslat.position.set(-0.44 + i * 0.22, 0.52, -0.56);
      bslat.rotation.x = -0.45;
      chair.add(bslat);
    }
    for (const sx of [-0.62, 0.62]) {
      const arm = box(0.08, 0.06, 0.9, 0xc0c4c8);
      arm.position.set(sx, 0.52, -0.02);
      chair.add(arm);
      for (const lz of [0.4, -0.45]) {
        const leg = box(0.05, 0.5, 0.05, 0xc0c4c8);
        leg.position.set(sx, 0.25, lz);
        chair.add(leg);
      }
    }
    const cupholder = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.1, 8), mat(0xc0c4c8, 0.4));
    cupholder.position.set(0.72, 0.52, 0.3);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 6), mat(0x5a3a1e, 0.3));
    bottle.position.set(0.72, 0.62, 0.3);
    chair.add(cupholder, bottle);
    const tvAt = { x: GB.x - 1.6, z: GB.z + 5 };
    chair.rotation.y = Math.atan2(tvAt.x - chairAt.x, tvAt.z - chairAt.z);
    chair.position.set(chairAt.x, terrainHeight(chairAt.x, chairAt.z), chairAt.z);
    group.add(chair);
    const ty = terrainHeight(tvAt.x, tvAt.z);
    const crate = box(0.9, 0.6, 0.7, 0xa97c50);
    crate.position.set(tvAt.x, ty + 0.3, tvAt.z);
    const tv = box(0.9, 0.7, 0.6, 0x5a5048);
    tv.position.set(tvAt.x, ty + 0.95, tvAt.z);
    group.add(crate, tv);
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 24;
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tvScreen = { cv, tex, t: 0 };
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.52), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.set(tvAt.x, ty + 0.97, tvAt.z - 0.31);
    screen.rotation.y = Math.PI; // facing the chair
    group.add(screen);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 3), mat(0x9aa3ad));
    ant.position.set(tvAt.x + 0.15, ty + 1.5, tvAt.z);
    ant.rotation.z = -0.5;
    group.add(ant);
    zones.addBlockerBox(tvAt.x, tvAt.z, 1.0, 0.8, 0, 0.05);
    const coolAt = { x: GB.x - 0.4, z: GB.z + 2.6 };
    const cy = terrainHeight(coolAt.x, coolAt.z);
    const cooler = box(0.8, 0.5, 0.5, 0xd84f4f);
    cooler.position.set(coolAt.x, cy + 0.25, coolAt.z);
    const lid = box(0.84, 0.1, 0.54, 0xf3efe6);
    lid.position.set(coolAt.x, cy + 0.55, coolAt.z);
    group.add(cooler, lid);
    zones.addBlocker(coolAt.x, coolAt.z, 0.45);
    register({
      pos: new THREE.Vector3(coolAt.x, 0, coolAt.z + 0.8), r: 1.4,
      label: '쿨러 열기',
      use: async () => {
        const c = await ui.ask('얼음, 그리고 갈색 유리병 잔뜩: 빅 무스 루트비어. “하나 가져가,” TV에서 눈을 떼지 않고 고디가 말해요.', [
          { label: '🍺 루트비어 하나 가져가기', value: 'drink' },
          { label: '뚜껑 닫기', value: null },
        ]);
        if (c !== 'drink') return;
        S.drinkCoffee(12);
        sip();
        ui.updateHUD();
        ui.toast('빅 무스 루트비어. 공격적으로 사사프라스. 이상하게 정답.', '🍺');
      },
    });
    // Gordy, in the chair, facing the set: sat forward on the seat (so the
    // tail clears the back), legs out in front of him
    gordy = buildAnimal('skunk', { body: 0x2e2a2c, head: 0x2e2a2c });
    const cf = chair.rotation.y;
    const seatAt = { x: chairAt.x + Math.sin(cf) * 0.22, z: chairAt.z + Math.cos(cf) * 0.22 };
    const seatY = terrainHeight(chairAt.x, chairAt.z) + 0.16;
    const sitDown = () => {
      gordy.position.set(seatAt.x, seatY, seatAt.z);
      gordy.rotation.y = cf;
      gordy.userData.parts.legs.forEach((l) => { l.rotation.x = -1.3; });
    };
    sitDown();
    gordy.userData.noFidget = true;
    group.add(gordy);
    zones.addBlocker(chairAt.x, chairAt.z, 0.7);
    // now and then: up, over to the cooler, a root beer, back to the chair
    const trip = { mode: 'sit', t: 30 + Math.random() * 30, legT: 0 };
    const cooler2 = { x: coolAt.x - 0.2, z: coolAt.z + 0.75 };
    updates.push((dt, t, pp) => {
      const g = gordy;
      const busyTalking = ui.isBusy() && pp && Math.hypot(pp.x - g.position.x, pp.z - g.position.z) < 4;
      if (trip.mode === 'sit') {
        g.userData.parts.head.rotation.y = Math.sin(t * 0.3) * 0.12; // the fish is gonna get away this time
        if (!busyTalking && (trip.t -= dt) <= 0) {
          trip.mode = 'go';
          g.userData.parts.legs.forEach((l) => { l.rotation.x = 0; });
          g.position.y = terrainHeight(g.position.x, g.position.z);
        }
        return;
      }
      if (busyTalking) { animateGait(g, t, 0); return; }
      const tg = trip.mode === 'go' ? cooler2 : seatAt;
      const dx = tg.x - g.position.x, dz = tg.z - g.position.z, d = Math.hypot(dx, dz);
      if (trip.mode === 'drink') {
        animateGait(g, t, 0);
        g.userData.parts.head.rotation.x = Math.sin(Math.min(1, (trip.legT += dt) / 1.5) * Math.PI) * -0.3;
        if (trip.legT > 3) { trip.mode = 'back'; g.userData.parts.head.rotation.x = 0; }
        return;
      }
      if (d < 0.15) {
        if (trip.mode === 'go') { trip.mode = 'drink'; trip.legT = 0; g.rotation.y = Math.atan2(coolAt.x - g.position.x, coolAt.z - g.position.z); }
        else { trip.mode = 'sit'; trip.t = 40 + Math.random() * 50; sitDown(); }
        return;
      }
      const step = Math.min(d, 1.1 * dt);
      g.position.x += (dx / d) * step;
      g.position.z += (dz / d) * step;
      g.position.y = terrainHeight(g.position.x, g.position.z);
      g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 6);
      animateGait(g, t, 1, 9);
    });
    register({
      getPos: () => gordy.position, r: 2.4,
      label: '고디와 대화하기',
      use: () => {
        const LINES = [
          '긴 주말 보내러 왔지. 트레일러 끌고. 내가 아는 한 그 주말은 아직 진행 중이야.',
          'TV는 채널 하나. 낚시 프로그램. 같은 회차. 이번엔 물고기가 도망칠 것 같아. 느낌이 와.',
          '쿨러 저기 있어. 루트비어. 빅 무스. 마지막 하나는 가져가지 마, 비상용이야.',
          '헉이 어떤 밤에 들러. 우린 말 안 해. 최고야.',
          '사람들이 줄무늬 보고 엄청 비켜줘. 나야 좋지. 의자 놓을 자리 넓고.',
        ];
        if (gordyTalk.first) {
          gordyTalk.first = false;
          ui.say([
            { text: '난 “방귀 섬”인 줄 알았어.' },
            { text: '하! 아니야. 알아. 다들 알아. …솔직히 아직 좀 아쉬워.' },
          ], { speaker: '고디', voice: 280 });
          return;
        }
        ui.say(LINES[gordyTalk.i++ % LINES.length], { speaker: '고디', voice: 280 });
      },
    });
  }

  // Huck's camp furniture: two chairs, honestly aimed
  for (const [cx, cz, ry] of [[C.x + 3.9, C.z - 1.4, -1.9], [C.x + 4.1, C.z + 1.7, -1.2]]) {
    const chair = new THREE.Group();
    const seat = box(0.7, 0.12, 0.7, 0xb0453a);
    seat.position.y = 0.45;
    chair.add(seat);
    const back = box(0.7, 0.7, 0.1, 0xb0453a);
    back.position.set(0, 0.8, -0.32);
    chair.add(back);
    for (const [lx, lz] of [[-0.28, 0.28], [0.28, 0.28], [-0.28, -0.28], [0.28, -0.28]]) {
      const leg = box(0.07, 0.45, 0.07, 0x6b7280);
      leg.position.set(lx, 0.22, lz);
      chair.add(leg);
    }
    chair.rotation.y = ry;
    chair.position.set(cx, terrainHeight(cx, cz), cz);
    group.add(chair);
    zones.addBlocker(cx, cz, 0.55);
  }

  // Huck himself, bucket hat, exactly where you'd expect
  const huck = buildAnimal('bear', { body: 0x8a6a48 });
  let huckWalk = null;
  {
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.14, 9), mat(0xa8a084, 0.85));
    hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.26, 8), mat(0xa8a084, 0.85));
    crown.position.y = 0.16;
    hat.add(crown);
    // on his HEAD (it used to hang in the air behind it)
    hat.position.set(0, 0.34, -0.02);
    hat.rotation.x = -0.12;
    huck.userData.parts.head.add(hat);
    huck.position.set(C.x + 3.9, terrainHeight(C.x + 3.9, C.z + 0.2), C.z + 0.2);
    huck.rotation.y = Math.atan2(FIRE.x - huck.position.x, FIRE.z - huck.position.z); // facing his fire
    group.add(huck);
    huckWalk = makeWanderer(huck, { home: { x: huck.position.x, z: huck.position.z, face: FIRE }, stay: 25 });
    register({
      getPos: () => huck.position, r: 2.6,
      label: '헉과 대화하기',
      use: () => ui.say(pick(HUCK_CHAT), { speaker: '헉', voice: VOICE.huck }),
    });
  }

  // ================================================== the Farther General ----
  const STORE = { x: SY.x, z: SY.z };
  const storeRy = Math.atan2(C.x - STORE.x, C.z - STORE.z);
  const STORE_FRONT = { x: STORE.x + Math.sin(storeRy) * 5.8, z: STORE.z + Math.cos(storeRy) * 5.8, face: STORE };
  {
    const sy = terrainHeight(STORE.x, STORE.z);
    const ext = new THREE.Group();
    const plinth = box(7.4, 1.3, 6.0, 0x8a8378);
    plinth.position.y = -0.5;
    ext.add(plinth);
    const walls = box(6.8, 2.9, 5.2, 0xefe4c8);
    walls.userData.occlude = true;
    walls.position.y = 1.45;
    ext.add(walls);
    const roofGeo = new THREE.CylinderGeometry((5.2 + 0.9) / 1.73, (5.2 + 0.9) / 1.73, 7.6, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0xb0563e)); // barn red, not mud brown
    roof.scale.y = 0.5;
    roof.position.y = 2.9 + (5.2 + 0.9) / 1.73 * 0.5 / 2; // eaves on the wall top
    roof.castShadow = roof.receiveShadow = true;
    ext.add(roof);
    // the porch: deck, posts, its own little roof — country store, regulation
    const deck = box(6.8, 0.24, 1.8, 0xa97c50);
    deck.position.set(0, 0.12, 3.5);
    ext.add(deck);
    for (const px of [-3.0, 0, 3.0]) {
      const post = box(0.16, 2.3, 0.16, 0x8a5a3a);
      post.position.set(px, 1.3, 4.2);
      ext.add(post);
    }
    const porchRoof = box(7.2, 0.14, 2.4, 0x9a4a36);
    porchRoof.position.set(0, 2.5, 3.6);
    porchRoof.rotation.x = 0.1;
    ext.add(porchRoof);
    const door = box(1.1, 1.9, 0.14, 0x4a3a2c);
    door.position.set(-0.8, 0.95 + 0.24, 2.62);
    ext.add(door);
    const paneS = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.08), mat(0xbfe6f2, 0.4));
    paneS.castShadow = false;
    paneS.position.set(1.4, 1.6, 2.62);
    ext.add(paneS);
    glowWindow(paneS, { max: 0.5 });
    // porch goods: a barrel, crates, and an honest bench
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.9, 8), mat(0x8a5a3a));
    barrel.position.set(2.6, 0.69, 3.4);
    barrel.castShadow = true;
    ext.add(barrel);
    const crate = box(0.7, 0.5, 0.7, 0xa97c50);
    crate.position.set(-2.6, 0.49, 3.4);
    ext.add(crate);
    // the sign stands on the porch roof's front edge, saying where you are
    // (it used to hang under the roof, where the camera never saw it)
    const sign = signBoard('파더 제너럴', 3.0, 0.7);
    sign.position.set(0, 2.85, 4.62);
    ext.add(sign);
    for (const bx of [-1.2, 1.2]) {
      const bracket = box(0.08, 0.35, 0.08, 0x8a5a3a);
      bracket.position.set(bx, 2.52, 4.6);
      ext.add(bracket);
    }
    ext.position.set(STORE.x, sy, STORE.z);
    ext.rotation.y = Math.atan2(C.x - STORE.x, C.z - STORE.z); // porch faces the camp
    group.add(ext);
    {
      const ry = ext.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
      zones.addBlockerBox(STORE.x, STORE.z, 7.4, 6.0, ry, 0.05);
      // the porch: a step up, with its three posts and its goods in the way
      zones.addSurfaceBox(STORE.x + 3.5 * sn, STORE.z + 3.5 * c, 6.8, 1.8, sy + 0.24, ry);
      for (const [lx, lz, r] of [[-3, 4.2, 0.2], [0, 4.2, 0.2], [3, 4.2, 0.2], [2.6, 3.4, 0.5], [-2.6, 3.4, 0.45]]) {
        zones.addBlocker(STORE.x + lx * c + lz * sn, STORE.z - lx * sn + lz * c, r);
      }
    }

    const rotY = ext.rotation.y;
    const doorWorld = {
      x: STORE.x + Math.sin(rotY) * 3.6,
      z: STORE.z + Math.cos(rotY) * 3.6,
    };
    register({
      pos: new THREE.Vector3(doorWorld.x, 0, doorWorld.z), r: 2.2,
      label: '파더 제너럴 들어가기',
      use: () => zones.go('general'),
    });

    // ------------------------------------------------------ the interior ----
    const roomStart = group.children.length;
    const B = IN_GENERAL;
    const floor = box(12, 0.4, 10, 0xb08d66);
    floor.position.set(B.x, -0.2, B.z);
    group.add(floor);
    // (it was a dim little room: two warm hanging lamps and a big window now)
    for (const lx of [-2.5, 2.5]) {
      const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
      bulb.position.set(B.x + lx, 2.9, B.z - 0.5);
      const cord = box(0.03, 0.7, 0.03, 0x3a3630);
      cord.position.set(B.x + lx, 3.35, B.z - 0.5);
      const light = new THREE.PointLight(0xffdcae, 26, 14, 2);
      light.position.set(B.x + lx, 2.7, B.z - 0.5);
      group.add(bulb, cord, light);
    }
    const bigWin = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshBasicMaterial({ color: 0xcfeaf6 }));
    bigWin.position.set(B.x - 5.78, 1.8, B.z + 1.2);
    bigWin.rotation.y = Math.PI / 2;
    group.add(bigWin);
    for (const [w, h, d, x, y, z] of [
      [12, 3.6, 0.4, B.x, 1.8, B.z - 5],
      [0.4, 3.6, 10, B.x - 6, 1.8, B.z],
      [0.4, 3.6, 10, B.x + 6, 1.8, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xe6d8bc));
      wall.receiveShadow = true;
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // the counter, and Cypress behind it
    const counter = box(3.6, 1.0, 0.9, 0x8a5a3a);
    counter.position.set(B.x - 3.2, 0.5, B.z - 2.6);
    group.add(counter);
    const till = box(0.5, 0.4, 0.4, 0x55483a);
    till.position.set(B.x - 4.2, 1.2, B.z - 2.6);
    group.add(till);
    const lantern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    lantern.position.set(B.x - 2.2, 1.25, B.z - 2.6);
    group.add(lantern);
    // shelves: two aisles + the back wall, stocked with the essentials
    function shelf(x, z, ry) {
      const s = new THREE.Group();
      const back = box(3.0, 1.9, 0.08, 0xa97c50);
      back.position.set(0, 0.95, -0.22);
      s.add(back);
      for (const sx of [-1.46, 1.46]) {
        const side = box(0.08, 1.9, 0.5, 0xa97c50);
        side.position.set(sx, 0.95, 0);
        s.add(side);
      }
      for (const ly of [0.5, 1.0, 1.5]) {
        const plank = box(3.0, 0.06, 0.46, 0x96703f);
        plank.position.set(0, ly, 0);
        s.add(plank);
        for (let i = 0; i < 5; i++) {
          const kindRoll = (i + ly * 4) % 3;
          let good;
          if (kindRoll < 1) {
            good = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 7),
              mat([0xc9705a, 0x5b8b7a, 0xd9a440][i % 3], 0.5)); // cans. one of them is the third bean.
            good.position.y = ly + 0.16;
          } else if (kindRoll < 2) {
            good = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat(0xb9a582, 0.95));
            good.scale.y = 0.75; // sacks
            good.position.y = ly + 0.14;
          } else {
            good = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.16), mat([0xd9c08f, 0x8fa3b8][i % 2], 0.8));
            good.position.y = ly + 0.15;
          }
          good.position.x = -1.2 + i * 0.6;
          good.castShadow = true;
          s.add(good);
        }
      }
      s.rotation.y = ry;
      s.position.set(x, 0, z);
      group.add(s);
    }
    shelf(B.x + 1.2, B.z - 3.2, 0);
    shelf(B.x + 1.2, B.z - 0.2, 0);
    shelf(B.x - 3.2, B.z + 1.6, Math.PI / 2);
    // the pot-belly stove, ticking warmly
    const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.1, 8), mat(0x3a3630, 0.6));
    stove.position.set(B.x + 4.4, 0.55, B.z + 2.8);
    stove.castShadow = true;
    group.add(stove);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), mat(0x3a3630, 0.6));
    pipe.position.set(B.x + 4.4, 2.3, B.z + 2.8);
    group.add(pipe);
    const kettle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0x8fa3b8, 0.4));
    kettle.scale.y = 0.8;
    kettle.position.set(B.x + 4.4, 1.25, B.z + 2.8);
    kettle.castShadow = true;
    group.add(kettle);

    // Cypress, behind the counter, pouch at the ready
    const cypress = buildAnimal('pelican', { body: 0xece7dc, head: 0xece7dc });
    cypress.position.set(B.x - 3.2, 0.1, B.z - 3.9);
    cypress.rotation.y = Math.PI * 0.05;
    group.add(cypress);
    storeUpdates.push((dt, t) => { cypress.position.y = 0.1 + Math.sin(t * 1.2) * 0.025; });

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('general', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.6, x1: B.x + 5.6, z0: B.z - 4.4, z1: B.z + 4.6 },
      blockers: [
        { x: B.x - 3.2, z: B.z - 2.6, r: 1.8 },  // counter
        { x: B.x + 1.2, z: B.z - 3.2, r: 1.4 },  // aisle shelf
        { x: B.x + 1.2, z: B.z - 0.2, r: 1.4 },  // aisle shelf
        { x: B.x - 3.2, z: B.z + 1.6, r: 1.4 },  // wall shelf
        { x: B.x + 4.4, z: B.z + 2.8, r: 0.9 },  // the stove
      ],
      spawn: { x: B.x, z: B.z + 3.8, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 20, fogFar: 52,
        hemiSky: 0xfff0d8, hemiGround: 0x8a6c48, hemiIntensity: 1.7,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.2), r: 1.8, zone: 'general',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({
        x: doorWorld.x + Math.sin(rotY) * 1.2,
        z: doorWorld.z + Math.cos(rotY) * 1.2,
        rotY: rotY + Math.PI,
      }),
    });
    register({
      getPos: () => cypress.position, r: 3.4, zone: 'general',
      label: '사이프러스에게 쇼핑하기',
      use: () => shopMenu(),
    });
    // the full General: food, gear, and things to remember it by
    const GOODS = [
      { id: 'marshmallows', aisle: 'food', price: 5 },
      { id: 'trail_mix', aisle: 'food', price: 4 },
      { id: 'third_bean', aisle: 'food', price: 3 },
      { id: 'flashlight', aisle: 'gear', price: 450, once: true },
      { id: 'camp_lantern', aisle: 'gear', price: 30 },
      { id: 'bug_spray', aisle: 'gear', price: 8 },
      { id: 'compass', aisle: 'gear', price: 25, once: true },
      { id: 'camp_mug', aisle: 'keep', price: 6 },
      { id: 'postcard_farther', aisle: 'keep', price: 3 },
    ];
    const AISLES = [['food', '🍡 캠핑 음식'], ['gear', '🔦 캠핑 장비'], ['keep', '🏝️ 기념품']];
    const SAYS = {
      marshmallows: '마시멜로. 최고 인기. 불에 구워; 봉지가 좀처럼 바닥나지 않고, 우리는 이유를 묻지 않아.',
      trail_mix: '트레일 믹스. 초콜릿 조각은 명예 제도로 운영.',
      third_bean: '세 번째 콩. 아니, 안 알려줘. 응, 맛있어.',
      flashlight: '제대로 된 손전등. 어두워지면 앞바닥을 비춰줘. 여기 어둠은 진짜 어둠이야.',
      camp_lantern: '캠핑 랜턴. 양철과 유리. 작은 빛이 동반이 될 곳 어디든 걸어.',
      bug_spray: '벌레 퇴치제. 시트로넬라. 여기 모기는 예의 바르지만, 확실한 게 좋지.',
      compass: '놋쇠 나침반. 북쪽을 가리켜. 대부분. 가끔 모닥불을.',
      camp_mug: '법랑 머그. 찌그러진 게 하중을 지탱해.',
      postcard_farther: '엽서. “네가 더 멀리 있으면 좋겠어.” 우체국에서 부쳐, 알아서 해줄 거야.',
    };
    async function buyAisle(aisle) {
      const list = GOODS.filter((g) => g.aisle === aisle && !(g.once && S.countItem(g.id) > 0));
      const picked = await ui.ask('이 선반 위에:', [
        ...list.map((g) => ({
          label: `${ITEMS[g.id].emoji} ${ITEMS[g.id].name}`, value: g.id, hint: `${g.price}🔘`,
          disabled: S.state.buttons < g.price,
        })),
        { label: '뒤로', value: null },
      ], { speaker: '사이프러스', voice: VOICE.cypress });
      const g = GOODS.find((x) => x.id === picked);
      if (!g) return shopMenu();
      S.spend(g.price);
      S.addItem(g.id);
      kaching();
      ui.updateHUD();
      ui.toast(`<b>${ITEMS[g.id].name}</b>을(를) 샀어요. 사이프러스가 버튼을 파우치에 파일해요.`, ITEMS[g.id].emoji);
      await ui.say(SAYS[g.id], { speaker: '사이프러스', voice: VOICE.cypress });
      return buyAisle(aisle);
    }
    async function shopMenu() {
      const c = await ui.ask('“뭘로 할래?”', [
        ...AISLES.map(([k, label]) => ({ label, value: k })),
        { label: '💬 수다', value: 'chat' },
        { label: '그냥 구경 중', value: null },
      ], { speaker: '사이프러스', voice: VOICE.cypress });
      if (c === 'chat') {
        await ui.say(pick(CYPRESS_CHAT), { speaker: '사이프러스', voice: VOICE.cypress });
        return shopMenu();
      }
      if (c) return buyAisle(c);
    }
    register({
      pos: new THREE.Vector3(B.x + 1.2, 0, B.z - 1.7), r: 2.0, zone: 'general',
      label: '선반 구경하기',
      use: () => shopMenu(),
    });
    register({
      pos: new THREE.Vector3(B.x + 4.4, 0, B.z + 1.6), r: 1.7, zone: 'general', priority: 0,
      label: '난로에 손 녹이기',
      use: () => ui.say('난로가 똑딱거려요. 위의 주전자는 다음에 올 누군가에 대한 예의로 영원히 거의 끓고 있어요.'),
    });
  }

  // ==================================================== the mangrove flats ----
  {
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      const r = 3 + Math.sqrt(rand(0, 1)) * 10;
      const x = F.x + Math.cos(a) * r;
      const z = F.z + Math.sin(a) * r * 0.9;
      const y = terrainHeight(x, z);
      if (y > 0.3) continue; // mangroves live where the tide can reach them
      const tree = makeMangrove(rand(0.8, 1.25));
      tree.rotation.y = rand(0, Math.PI * 2);
      tree.position.set(x, Math.max(y, WATER_Y - 0.25), z);
      group.add(tree);
      zones.addBlocker(x, z, 0.75 * tree.scale.x, 'tree'); // roots are roots — wade around
    }
    // Stilt, the heron. one leg. since Tuesday.
    const stilt = buildAnimal('heron', { body: 0x9fb3c8 });
    stilt.position.set(F.x - 2, Math.max(terrainHeight(F.x - 2, F.z + 2.5), WATER_Y - 0.1), F.z + 2.5);
    stilt.rotation.y = 2.4;
    group.add(stilt);
    register({
      getPos: () => stilt.position, r: 2.6,
      label: '스틸트 바라보기',
      use: () => ui.say('(스틸트가 물을 바라봐요. 물이 스틸트를 바라봐요. 이게 아침 내내 이어져 왔고, 양측 모두 잘되고 있다 여기는 것 같아요.)'),
    });
  }

  function makeMangrove(scale = 1) {
    const g = new THREE.Group();
    const wood = mat(0x6e5136, 0.95);
    const knot = { x: 0, y: 1.0, z: 0 };
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      const bx = Math.cos(a) * (0.65 + rand(-0.1, 0.15));
      const bz = Math.sin(a) * (0.65 + rand(-0.1, 0.15));
      const from = new THREE.Vector3(bx, -0.3, bz);
      const to = new THREE.Vector3(knot.x, knot.y, knot.z);
      const dir = to.clone().sub(from);
      const len = dir.length();
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, len, 5), wood);
      root.position.copy(from).add(to).multiplyScalar(0.5);
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      root.castShadow = true;
      g.add(root);
    }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.9, 6), wood);
    trunk.position.y = knot.y + 0.4;
    trunk.castShadow = true;
    g.add(trunk);
    const leafMat = mat(0x3f7747, 0.95);
    for (const [ox, oy, oz, r] of [[0, 2.2, 0, 0.95], [0.6, 1.95, 0.25, 0.65], [-0.55, 2.0, -0.25, 0.7]]) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
      blob.position.set(ox, oy, oz);
      blob.castShadow = true;
      g.add(blob);
    }
    g.scale.setScalar(scale);
    return g;
  }

  function makeKayak(color) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat(color, 0.5));
    hull.scale.set(1.15, 0.5, 4.3);
    g.add(hull);
    const deck = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat(0xf3efe6, 0.6));
    deck.scale.set(0.35, 0.18, 3.6);
    deck.position.y = 0.16;
    g.add(deck);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 4, 10), mat(0x2e2a26));
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1, 1.4, 1);
    rim.position.y = 0.22;
    g.add(rim);
    const well = new THREE.Mesh(new THREE.CircleGeometry(0.34, 10), mat(0x2e2a26));
    well.rotation.x = -Math.PI / 2;
    well.scale.set(1, 1.4, 1);
    well.position.y = 0.2;
    g.add(well);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // ================================================== Wren, birdwatching ----
  const wren = buildAnimal('duck', { body: 0x9a7a5c, head: 0x8a6a4c });
  {
    // binoculars: two little barrels on a strap thought
    const bino = new THREE.Group();
    for (const sx of [-0.09, 0.09]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 6), mat(0x3a3630, 0.5));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.x = sx;
      bino.add(barrel);
    }
    bino.position.set(0, 0.95, 0.55);
    wren.add(bino);
    wren.position.set(C.x - 7, terrainHeight(C.x - 7, C.z + 6), C.z + 6);
    group.add(wren);
    register({
      getPos: () => wren.position, r: 2.4,
      label: '렌과 대화하기',
      use: () => ui.say(pick(WREN_CHAT), { speaker: '렌', voice: VOICE.wren }),
    });
  }
  const wrenWalk = {
    g: wren, seg: 0, speed: 1.3, pause: 2,
    points: [
      { x: C.x - 6, z: C.z + 6 },   // camp edge
      { x: F.x - 7, z: F.z - 3 },   // the bank over the flats
      { x: F.x - 3, z: F.z + 1 },   // down among the mangroves
      { x: C.x + 1, z: C.z + 9 },   // the south beach
    ],
  };

  // ======================================================== the west pier ----
  {
    const bearing = -Math.PI / 2; // due west, into the evening, toward home
    const bx = Math.sin(bearing), bz = Math.cos(bearing);
    const P0 = { x: SY.x - 1, z: SY.z - 7 }; // north of the General
    let shoreT = 0;
    for (let tt = 0; tt < 26; tt += 0.5) {
      if (terrainHeight(P0.x + bx * tt, P0.z + bz * tt) < 0.25) { shoreT = tt - 1; break; }
      shoreT = tt;
    }
    const sx = P0.x + bx * shoreT, sz = P0.z + bz * shoreT;
    FARTHER_DOCK.x = sx;
    FARTHER_DOCK.z = sz;
    FARTHER_DOCK.rotY = bearing + Math.PI; // step off facing the island
    const px = -bz, pz = bx;
    // the west beach shelves gently — the pier walks out until it means it
    const LAST = 8;
    for (let i = 0; i < 9; i++) {
      const t = i + 0.5;
      const plank = box(2.4, 0.16, 1.0, i % 4 === 2 ? 0x96703f : 0xa97c50);
      plank.position.set(sx + bx * t, 0.55, sz + bz * t);
      plank.rotation.y = bearing;
      plank.receiveShadow = true;
      group.add(plank);
      if (i % 2 === 0 && i !== LAST) {
        // legs all the way down to the sand, whatever the depth
        for (const side of [-1, 1]) {
          const lx = sx + bx * t + px * side * 1.1, lz = sz + bz * t + pz * side * 1.1;
          const bot = Math.min(terrainHeight(lx, lz), WATER_Y) - 0.3, top = 0.5;
          const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, top - bot, 6), mat(0x6b4a2e));
          pile.position.set(lx, (top + bot) / 2, lz);
          group.add(pile);
        }
      }
      if (i === LAST) {
        // the front posts: the pier ends where two tall posts say it does
        for (const side of [-1, 1]) {
          const fx = sx + bx * (t + 0.35) + px * side * 1.1, fz = sz + bz * (t + 0.35) + pz * side * 1.1;
          const fbot = Math.min(terrainHeight(fx, fz), WATER_Y) - 0.3, ftop = 1.55;
          const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, ftop - fbot, 6), mat(0x6b4a2e));
          fp.position.set(fx, (ftop + fbot) / 2, fz);
          fp.castShadow = true;
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13 + 0.03, 0.13 + 0.03, 0.08, 6), mat(0x4f3622));
          cap.position.y = (ftop - fbot) / 2 + 0.02;
          fp.add(cap);
          group.add(fp);
        }
      }
    }
    zones.addCrossing({
      contains(x, z) {
        const dx = x - sx, dz = z - sz;
        const t = dx * bx + dz * bz;
        if (t < -0.5 || t > 9.5) return false;
        return Math.abs(dx * px + dz * pz) < 1.3;
      },
      height: () => 0.64,
    });
    // the bell-buoy the Persistent answers to: at the pier's end, within an
    // arm's reach of the planks (it used to be out of reach — and invisible)
    const bxp = sx + bx * 9.8 + px * 2.0, bzp = sz + bz * 9.8 + pz * 2.0;
    const buoy = new THREE.Group();
    const bbase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
    bbase.position.y = 0.5;
    const btop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
    btop.position.y = 1.2;
    buoy.add(bbase, btop);
    buoy.position.set(bxp, Math.max(terrainHeight(bxp, bzp), WATER_Y - 0.2), bzp);
    buoy.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(buoy);
    FARTHER_DOCK.buoyPos = new THREE.Vector3(bxp, 0, bzp);
  }

  // ================================================= the campground ----
  // everything a campground wants, a good stride apart
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
  picnicTable(C.x - 10, C.z + 6, 0.3);
  picnicTable(C.x - 13.5, C.z + 1.5, -0.2);
  const tableLantern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0xffe6a0, 0.4));
  tableLantern.position.set(C.x - 10, terrainHeight(C.x - 10, C.z + 6) + 0.95, C.z + 6);
  glowWindow(tableLantern, { warm: 0xffd98f, max: 1.2 });
  group.add(tableLantern);

  // the picnic blanket, on the south lawn, with a basket and one watermelon
  const BL = { x: C.x + 13.5, z: C.z + 1 }; // the east lawn, clear of the kayak rack
  {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      c.fillStyle = (i + j) % 2 ? '#d84f4f' : '#fff6e8';
      c.fillRect(i * 8, j * 8, 8, 8);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const by = terrainHeight(BL.x, BL.z);
    // draped over the ground it lies on (a flat sheet on a slope sank into
    // the hill on one side and hovered on the other)
    const bgeo = new THREE.PlaneGeometry(2.4, 1.9, 6, 5);
    bgeo.rotateX(-Math.PI / 2);
    bgeo.rotateY(0.3);
    const bp = bgeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      bp.setY(i, terrainHeight(BL.x + bp.getX(i), BL.z + bp.getZ(i)) + 0.05);
    }
    bgeo.computeVertexNormals();
    const blanket = new THREE.Mesh(bgeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    blanket.position.set(BL.x, 0, BL.z);
    blanket.receiveShadow = true;
    group.add(blanket);
    const basket = box(0.55, 0.32, 0.4, 0xc9a06a);
    basket.position.set(BL.x + 0.6, terrainHeight(BL.x + 0.6, BL.z - 0.3) + 0.2, BL.z - 0.3);
    group.add(basket);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 10, Math.PI), mat(0x8a6a44));
    handle.position.set(BL.x + 0.6, terrainHeight(BL.x + 0.6, BL.z - 0.3) + 0.36, BL.z - 0.3);
    group.add(handle);
    const melon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10, 1, false, 0, Math.PI), mat(0xe8574f, 0.6));
    melon.rotation.x = Math.PI / 2;
    melon.position.set(BL.x - 0.5, terrainHeight(BL.x - 0.5, BL.z + 0.2) + 0.17, BL.z + 0.2);
    group.add(melon);
    const rind = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.11, 10, 1, false, 0, Math.PI), mat(0x4f9a52, 0.6));
    rind.rotation.x = Math.PI / 2;
    rind.position.set(BL.x - 0.5, terrainHeight(BL.x - 0.5, BL.z + 0.2) + 0.16, BL.z + 0.2);
    rind.scale.set(1, 0.9, 1);
    group.add(rind);
    register({
      pos: new THREE.Vector3(BL.x, 0, BL.z), r: 2.0, priority: 0,
      label: '피크닉 담요에 앉기',
      use: () => ui.say(pick([
        '앉아요. 수박은 이미 잘려 있어요. 누가 잘랐는지 아무도 말 안 해요. 누군가는 항상 잘라요.',
        '담요가 햇볕에 따뜻해요. 개미가 바구니를 공식 검열하고, 적합하다 판정하고, 좋은 리뷰를 남겨요.',
      ])),
    });
  }

  // a hammock slung between two pines, facing the water
  const HM = { x: C.x + 12, z: C.z + 6 };
  const hammockPines = [];
  {
    const needle = mat(0x3f7a4f, 0.95), bark = mat(0x6e5136, 0.95);
    for (const sx of [-1.6, 1.6]) {
      const x = HM.x + sx, z = HM.z;
      const pine = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 7), bark);
      trunk.position.y = 0.8;
      pine.add(trunk);
      for (const [r, h, yy] of [[1.2, 1.5, 2.0], [0.9, 1.3, 2.9], [0.6, 1.1, 3.7]]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), needle);
        cone.position.y = yy;
        pine.add(cone);
      }
      pine.position.set(x, terrainHeight(x, z) - 0.05, z);
      group.add(pine);
      zones.addBlocker(x, z, 0.4, 'tree');
      hammockPines.push(pine);
    }
    const hy = terrainHeight(HM.x, HM.z);
    const sling = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8, 1, true, Math.PI * 1.1, Math.PI * 0.8), // (the arc hangs down: it used to stand up sideways like a wall)
      new THREE.MeshStandardMaterial({ color: 0x5b8bc9, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
    sling.rotation.z = Math.PI / 2;
    sling.position.set(HM.x, hy + 0.95, HM.z);
    group.add(sling);
    zones.addBlockerBox(HM.x, HM.z, 2.6, 0.9, 0, 0, 'tree');
    for (const sx of [-1, 1]) {
      const rope = box(0.35, 0.03, 0.03, 0xd9c08f);
      rope.position.set(HM.x + sx * 1.45, hy + 1.2, HM.z);
      rope.rotation.z = sx * 0.5;
      group.add(rope);
    }
  }

  // the camp kitchen: a stone grill with a pot of the island's third bean
  const GRILL = { x: C.x - 2, z: C.z - 8 };
  {
    const gy = terrainHeight(GRILL.x, GRILL.z);
    const base = box(1.2, 0.8, 0.8, 0x8a8378);
    base.position.set(GRILL.x, gy + 0.4, GRILL.z);
    group.add(base);
    const grate = box(1.1, 0.04, 0.7, 0x2e2a26);
    grate.position.set(GRILL.x, gy + 0.82, GRILL.z);
    group.add(grate);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.28, 8), mat(0x3a3630, 0.5));
    pot.position.set(GRILL.x + 0.2, gy + 0.98, GRILL.z);
    group.add(pot);
    zones.addBlockerBox(GRILL.x, GRILL.z, 1.3, 0.9, 0, 0.02);
  }

  // kayaks pulled up on the south-east beach, on a rack and on the sand
  const KB = { x: F.x - 10, z: F.z + 3 };
  {
    const ky = Math.max(terrainHeight(KB.x, KB.z), WATER_Y + 0.1);
    // animal-sized: long enough to sit a camper, wide enough not to tip one
    for (const [ox, oz, ry, col] of [[0, 0, 0.3, 0x3a9a8a], [2.1, 0.8, 0.35, 0xf2cf5b], [-2.0, -0.7, 0.2, 0xd84f4f]]) {
      const kx = KB.x + ox, kz = KB.z + oz;
      const kyak = makeKayak(col);
      kyak.rotation.y = ry;
      kyak.position.set(kx, Math.max(terrainHeight(kx, kz), WATER_Y + 0.05) + 0.2, kz);
      group.add(kyak);
    }
    const paddle = box(0.08, 0.05, 2.8, 0x8a5a3a);
    paddle.position.set(KB.x + 1.0, ky + 0.12, KB.z - 2.4);
    paddle.rotation.y = 1.2;
    group.add(paddle);
    for (const e of [-1.4, 1.4]) {
      const blade = box(0.34, 0.04, 0.5, 0xf2cf5b);
      blade.position.set(KB.x + 1.0 + Math.sin(1.2) * e, ky + 0.12, KB.z - 2.4 + Math.cos(1.2) * e);
      blade.rotation.y = 1.2;
      group.add(blade);
    }
    zones.addBlockerBox(KB.x, KB.z, 6.0, 4.8, 0.3, 0);
    register({
      pos: new THREE.Vector3(KB.x, 0, KB.z + 3.2), r: 2.6,
      label: '카약 살펴보기',
      use: () => ui.say(pick([
        '카약 세 척, 조수선 위로 끌어 올려져 있어요: 청록, 노랑, 그리고 누군가 마커로 패딩턴 경이라 이름 붙인 빨간 것.',
        '거치대의 표지: “하나 빌려 가고, 돌려놓을 것, 그리고 고래를 만나면 캠프에서 안부 전할 것.”',
      ])),
    });
  }

  // CAMP FARTHER: an arch over the path in from the station — walked back
  // from the shore along that path until it's clear of the platform, the
  // ramp and the track (it used to stand where the train had to go through it)
  {
    const toward = { x: 104, z: -40 }; // the way the line runs home
    const dl = Math.hypot(toward.x - C.x, toward.z - C.z);
    const ux = (toward.x - C.x) / dl, uz = (toward.z - C.z) / dl;
    let tS = 4;
    while (tS < 30 && terrainHeight(C.x + ux * tS, C.z + uz * tS) > 0.8) tS += 0.5;
    let at = Math.min(tS - 4, 11);
    const clear = (t) => {
      const x = C.x + ux * t, z = C.z + uz * t, cs0 = Math.cos(Math.atan2(ux, uz)), sn0 = Math.sin(Math.atan2(ux, uz));
      return [-2.6, 0, 2.6].every((o) => !zones.nearAnything(x + o * cs0, z - o * sn0, 1.2));
    };
    while (at > 6 && !clear(at)) at -= 0.5;
    const AX = C.x + ux * at, AZ = C.z + uz * at;
    const ay = terrainHeight(AX, AZ);
    const ry = Math.atan2(ux, uz);
    const cs = Math.cos(ry), sn = Math.sin(ry);
    // a touch bigger than before: two log posts and a proper crossbeam
    for (const side of [-2.4, 2.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 3.8, 7), mat(0x6e5136));
      post.position.set(AX + side * cs, ay + 1.9, AZ - side * sn);
      group.add(post);
      zones.addBlocker(AX + side * cs, AZ - side * sn, 0.25);
    }
    const beam = box(5.4, 0.22, 0.22, 0x5a4230);
    beam.position.set(AX, ay + 3.6, AZ);
    beam.rotation.y = ry;
    group.add(beam);
    const arch = signBoard('파더 캠프', 4.6, 0.95);
    arch.position.set(AX, ay + 3.0, AZ);
    arch.rotation.y = ry;
    group.add(arch);
    const back = signBoard('또 오세요', 4.6, 0.95);
    back.position.set(AX - sn * 0.1, ay + 3.0, AZ - cs * 0.1);
    back.rotation.y = ry + Math.PI;
    group.add(back);
  }

  // ===================================================== the summit trail ----
  {
    const T0 = TRAIL7[0];
    const ty = terrainHeight(T0.x - 1, T0.z - 1);
    const post = box(0.14, 1.05, 0.14, 0x6e5136); // (ends under the board, not through its face)
    post.position.set(T0.x - 1, ty + 0.525, T0.z - 1);
    group.add(post);
    const board = signBoard('정상 트레일 ↑', 1.9, 0.5);
    board.position.set(T0.x - 1, ty + 1.3, T0.z - 1);
    board.rotation.y = Math.atan2(C.x - T0.x, C.z - T0.z);
    group.add(board);
    zones.addBlocker(T0.x - 1, T0.z - 1, 0.2);
    register({
      pos: new THREE.Vector3(T0.x - 1, 0, T0.z - 0.2), r: 1.8,
      label: '트레일 표지 읽기',
      use: () => ui.say('“정상 트레일 — 0.6km — 보통 — 지그재그 — 간식 지참. 전망: 있음.” 아래에 새겨져 있어요: “간식은 선택이 아님.”'),
    });
    // little marker posts along the way, painted orange at the tip
    for (let i = 1; i < TRAIL7.length - 1; i++) {
      const p = TRAIL7[i];
      const my = terrainHeight(p.x + 1.2, p.z);
      const m = box(0.12, 0.8, 0.12, 0x6e5136);
      m.position.set(p.x + 1.2, my + 0.4, p.z);
      group.add(m);
      const tip = box(0.14, 0.14, 0.14, 0xe8743a);
      tip.position.set(p.x + 1.2, my + 0.85, p.z);
      group.add(tip);
      zones.addBlocker(p.x + 1.2, p.z, 0.15);
    }
    // a bench halfway up, for the view and the snack
    const BP = TRAIL7[4];
    const bench = box(1.6, 0.14, 0.5, 0xa97c50);
    const benchY = terrainHeight(BP.x - 1.4, BP.z + 1);
    bench.position.set(BP.x - 1.4, benchY + 0.45, BP.z + 1);
    bench.rotation.y = 0.6;
    group.add(bench);
    for (const s2 of [-0.6, 0.6]) {
      const leg = box(0.1, 0.45, 0.4, 0x6b7280);
      leg.position.set(BP.x - 1.4 + s2 * Math.cos(0.6), benchY + 0.22, BP.z + 1 - s2 * Math.sin(0.6));
      leg.rotation.y = 0.6;
      group.add(leg);
    }
    zones.addBlockerBox(BP.x - 1.4, BP.z + 1, 1.6, 0.5, 0.6, 0.02);
    // the summit: a cairn, a pennant, and the register in its tin box
    const SM = { x: MOUNT7.x, z: MOUNT7.z };
    const sy = terrainHeight(SM.x, SM.z);
    // (every piece sits on its own bit of ground — the peak is a peak, and
    // things set by the summit's height alone hung in the air off its slopes)
    const gAt = (x, z) => Math.min(terrainHeight(x, z), terrainHeight(x + 0.3, z), terrainHeight(x - 0.3, z), terrainHeight(x, z + 0.3), terrainHeight(x, z - 0.3));
    const cy0 = gAt(SM.x + 1.2, SM.z + 0.8);
    for (let k = 0; k < 5; k++) {
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 - k * 0.07, 0), mat(0x8a8378, 0.95));
      stone.scale.y = 0.6;
      stone.position.set(SM.x + 1.2, cy0 + 0.12 + k * 0.36, SM.z + 0.8);
      stone.rotation.y = k;
      group.add(stone);
    }
    zones.addBlocker(SM.x + 1.2, SM.z + 0.8, 0.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), mat(0xd9d2c0));
    const py0 = gAt(SM.x - 0.8, SM.z - 0.6);
    pole.position.set(SM.x - 0.8, py0 + 1.1, SM.z - 0.6);
    group.add(pole);
    const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.9, 3), mat(0xe8743a, 0.8));
    pennant.rotation.z = -Math.PI / 2;
    pennant.position.set(SM.x - 0.35, py0 + 2.1, SM.z - 0.6);
    group.add(pennant);
    updates.push((dt, t) => { pennant.rotation.x = Math.sin(t * 3) * 0.3; });
    const tin = box(0.5, 0.35, 0.35, 0x9aa3ad);
    const ty0 = gAt(SM.x - 0.6, SM.z + 1);
    tin.position.set(SM.x - 0.6, ty0 + 0.85, SM.z + 1);
    group.add(tin);
    const tinPost = box(0.1, 0.75, 0.1, 0x6e5136);
    tinPost.position.set(SM.x - 0.6, ty0 + 0.3, SM.z + 1);
    group.add(tinPost);
    register({
      pos: new THREE.Vector3(SM.x - 0.6, 0, SM.z + 1.6), r: 2.0,
      label: '정상 등록부에 서명하기',
      use: async () => {
        await ui.say([
          '기둥 위 양철 상자. 안에 샌드위치 봉지 속 노트와, 끈 달린 연필.',
          '최근 기록: “해냈다!! —리디 (4온스)” · “아깝다 —스프린트” · “아깝다 —스프린트” · “늑대 다녀감 —H.” · “텍사스가 더 높음. —P.” (아님) · “여기서 보는 별은 말이야 —V.”',
        ]);
        if (!S.hasFlag('summitFarther')) {
          S.setFlag('summitFarther');
          ui.toast('정상 등록부에 서명했어요. 연필은 전망이 뾰족한 만큼 정확히 무뎌요.', '⛰️');
        } else {
          ui.say('이름 옆에 작은 표를 하나 더해요. 정상 몇 번째쯤. 산은 점수를 안 매기지만, 노트는 매겨요.');
        }
      },
    });
  }

  // ------------------------------------------------ everyone gets about ----
  // Campers (and Huck) don't stand in one place all day: they settle
  // somewhere for a while, then get up and wander to another good spot —
  // the fire, a table, the blanket, the beach, the store porch, Gordy's —
  // and back. They steer round anything solid (the fire most of all), wait
  // politely if you're in the way, and turn to say hi when you're close.
  const POIS = () => {
    const pts = [];
    for (const a of [0.3, 1.5, 2.6, 3.8, 5.0]) pts.push({ x: FIRE.x + Math.cos(a) * 2.8, z: FIRE.z + Math.sin(a) * 2.8, face: FIRE });
    pts.push({ x: C.x - 10, z: C.z + 7.3, face: { x: C.x - 10, z: C.z + 6 } });
    pts.push({ x: C.x - 13.5, z: C.z + 2.8, face: { x: C.x - 13.5, z: C.z + 1.5 } });
    pts.push({ x: BL.x - 1.8, z: BL.z - 0.6, face: BL });
    pts.push({ x: KB.x - 1, z: KB.z + 4, face: { x: KB.x, z: KB.z + 12 } });
    pts.push({ x: STORE_FRONT.x, z: STORE_FRONT.z, face: STORE_FRONT.face });
    pts.push({ x: GB.x - 3.2, z: GB.z + 3.4, face: { x: GB.x - 1.6, z: GB.z + 5 } }); // watching Gordy's show
    pts.push({ x: GRILL.x, z: GRILL.z + 1.3, face: GRILL });
    return pts.filter((p) => zones.islandCanStand(p.x, p.z, 0.4));
  };
  let poiCache = null;
  // the nearest spot a body can actually stand, near p (a spot that lands
  // inside something — the trail spot was inside Huck's RV — slides clear)
  function standable(p) {
    if (p.lie || zones.islandCanStand(p.x, p.z, 0.4)) return p;
    for (let r = 0.5; r <= 4; r += 0.5) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        if (zones.islandCanStand(x, z, 0.4)) return { ...p, x, z };
      }
    }
    return p;
  }
  function makeWanderer(a, { home, lie = false, trail = false, stay = 15 }) {
    return { a, home, lie, trail, mode: 'stay', timer: stay, target: null, stuck: 0, restY: a.rotation.y, sideT: 0, best: Infinity, stall: 0 };
  }
  function pickTarget(w) {
    if (w.trail) {
      const pts = [...TRAIL7, { x: MOUNT7.x + 1.5, z: MOUNT7.z - 1.5 }];
      const p = pick(pts);
      return { x: p.x + 0.6, z: p.z + 0.6, face: { x: MOUNT7.x - 20, z: MOUNT7.z + 30 } };
    }
    if (!poiCache) poiCache = POIS();
    if (Math.random() < 0.3 || !poiCache.length) return w.home;
    return pick(poiCache);
  }
  function stepWanderer(w, dt, t, playerPos) {
    const a = w.a;
    const near = playerPos && Math.hypot(playerPos.x - a.position.x, playerPos.z - a.position.z) < 3.2;
    if (w.lie) return; // the hammock is a commitment
    if (w.mode === 'stay') {
      animateGait(a, t, 0);
      w.timer -= dt;
      const face = near ? Math.atan2(playerPos.x - a.position.x, playerPos.z - a.position.z) : w.restY;
      a.rotation.y = turnToward(a.rotation.y, face, dt, 3);
      if (w.timer <= 0 && !near) {
        w.target = pickTarget(w);
        w.mode = 'walk';
        w.stuck = 0;
        w.best = Infinity;
        w.stall = 0;
      }
      return;
    }
    const tg = w.target;
    const dx = tg.x - a.position.x, dz = tg.z - a.position.z, d = Math.hypot(dx, dz);
    if (d < 0.5) {
      w.mode = 'stay';
      w.timer = 15 + Math.random() * 25;
      w.restY = Math.atan2(tg.face.x - a.position.x, tg.face.z - a.position.z);
      return;
    }
    if (near && Math.hypot(playerPos.x - (a.position.x + dx / d), playerPos.z - (a.position.z + dz / d)) < 1.2) {
      animateGait(a, t, 0); // you're in the way; they'll wait
      return;
    }
    // no closer in four seconds? this spot isn't happening today; go home
    if (d < w.best - 0.3) { w.best = d; w.stall = 0; } else if ((w.stall += dt) > 4) {
      w.target = w.target === w.home ? pickTarget(w) : w.home;
      w.best = Infinity;
      w.stall = 0;
      w.side = 0;
      return;
    }
    const want = Math.atan2(dx, dz), step = Math.min(d, 1.5 * dt);
    let moved = false;
    w.sideT = Math.max(0, w.sideT - dt);
    // while committed to a detour, keep to that side a moment before trying straight again
    const offs = w.sideT > 0 ? [0.5, 1.0, 1.6, 0, -0.5, -1.0, -1.6] : [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6];
    for (const off of offs) {
      const h = want + off * (w.side || 1);
      const nx = a.position.x + Math.sin(h) * step, nz = a.position.z + Math.cos(h) * step;
      if (!zones.islandCanStand(nx, nz, 0.35)) continue;
      a.position.x = nx;
      a.position.z = nz;
      a.rotation.y = turnToward(a.rotation.y, h, dt, 6);
      if (off !== 0) {
        if (!w.side) w.side = Math.sign(off);
        w.sideT = 1.2;
      } else if (w.sideT <= 0) w.side = 0;
      moved = true;
      break;
    }
    a.position.y = zones.islandGroundHeight(a.position.x, a.position.z);
    animateGait(a, t, moved ? 1 : 0);
    if (!moved) {
      w.stuck += dt;
      if (w.stuck > 3) { w.target = pickTarget(w); w.stuck = 0; w.side = 0; }
    }
  }

  // ============================================= this week's campers ----
  // a rotating cast: a few of them are here on any given day (the day of
  // the year picks who), each in their favorite spot doing their favorite
  // thing. talk to them; they'll be gone by next week and someone else here.
  const SPOTS = {
    fire: { x: FIRE.x - 2.53, z: FIRE.z - 0.19, face: FIRE }, // (behind the log bench, not inside it)
    table: { x: C.x - 10, z: C.z + 7.2, face: { x: C.x - 10, z: C.z + 6 } },
    blanket: { x: BL.x - 0.2, z: BL.z - 0.3, face: { x: BL.x + 3, z: BL.z + 3 } },
    hammock: { x: HM.x, z: HM.z, y: 0.55, face: { x: HM.x, z: HM.z + 5 }, lie: true },
    summit: { x: MOUNT7.x + 1.5, z: MOUNT7.z - 1.5, face: { x: MOUNT7.x - 20, z: MOUNT7.z + 30 } },
    trail: { x: TRAIL7[3].x - 0.8, z: TRAIL7[3].z + 0.8, face: TRAIL7[4] },
    beach: { x: KB.x - 1.5, z: KB.z + 2.5, face: { x: KB.x, z: KB.z + 12 } },
    tent: { x: C.x + 6 + Math.sin(2.6) * 2.4, z: C.z + 7.5 + Math.cos(2.6) * 2.4, face: FIRE },
    grill: { x: GRILL.x, z: GRILL.z + 1.1, face: GRILL },
  };
  const CAMPERS = [
    { name: '시슬', kind: 'hedgehog', colors: { body: 0x8a6a48 }, spot: 'fire', prop: 'guitar', voice: 620, lines: [
      '코드 세 개를 알고 셋 다 나를 알아. 이 곡은 마시멜로에 대한 거야. 전부 마시멜로에 대한 거야.',
      '신청곡? 받아. 같은 노래를 연주하지만, 받긴 해.' ] },
    { name: '핌', kind: 'penguin', colors: {}, spot: 'tent', prop: 'pack', voice: 520, lines: [
      '모든 날씨에 대비해서 쌌어. 맑네. 맑음에도 준비됐어. 모든 게 준비됐고, 모든 게 무거워.',
      '캠핑에 드레스 코드가 있어? 세 벌 가져왔어. 전부 입고 있어.' ] },
    { name: '리디', kind: 'frog', colors: { body: 0x7ab04a, belly: 0xf1ecc4, feet: 0xe8c547 }, spot: 'summit', prop: 'pack', voice: 700, lines: [
      '기본 무게: 4온스. 그게 나야. 내가 그 4온스야.',
      '올라왔구나! 등록부에 서명해. 연필 써. 연필도 경험의 일부야.' ] },
    { name: '루멘', kind: 'moth', colors: { body: 0xd9c9a8 }, spot: 'table', prop: 'book', voice: 680, lines: [
      '9장. 랜턴이랑 나랑 둘 다 아주 몰입 중이야.',
      '어두운 하늘 보러 왔어. 이 테이블의 램프 하나 때문에 남아. 모순인 건 알아.' ] },
    { name: '걸리버', kind: 'pelican', colors: {}, spot: 'beach', prop: 'paddle', voice: 300, lines: [
      '카약 가이드야. 왼쪽 젓고, 오른쪽 젓고, 물고기가 물으면, 너 나 못 봤어.',
      '아침에 군도에서 해류 타고 왔어. 네 시간에 샌드위치 두 개. 가치 있었어.' ] },
    { name: '듄', kind: 'horse', colors: { body: 0xc9a06a }, spot: 'blanket', prop: null, voice: 340, lines: [
      '담요 빼고 다 팔았어. 내 인생 최고의 거래. 담요도 동의해.',
      '수박 먹을래? 수박은 항상 있어. 누가 자꾸 자르는지 몰라. 묻는 건 그만뒀어.' ] },
    { name: '버로우', kind: 'mole', colors: { body: 0x55483a }, spot: 'tent', prop: 'shovel', voice: 260, lines: [
      '비가 와. 오늘은 아냐. 하지만 오고, 내 배수로는 준비될 거야.',
      '다들 텐트를 가져왔지. 난 땅에 대한 더 나은 아이디어를 가져왔어.' ] },
    { name: '스프린트', kind: 'tortoise', colors: {}, spot: 'trail', prop: 'pack', voice: 240, lines: [
      '가을까지 정상. 다음 가을. 페이스 조절 중이야. 페이스 조절은 아주 잘해.',
      '등록부에 두 번 썼어. “아깝다.” 두 번 다. 수련이야.' ] },
    { name: '멜로', kind: 'capybara', colors: { body: 0xb08a5a, head: 0xb08a5a }, spot: 'hammock', prop: null, voice: 230, lines: [
      '해먹이랑 나는 합의에 도달했어. 합의 내용은 내가 머무는 거야.',
      '음. (그게 생각 전부였어. 좋은 생각이었어.)' ] },
    { name: '벨라', kind: 'owl', colors: { body: 0x9a8a78 }, spot: 'summit', prop: null, voice: 480, lines: [
      '여기는 하늘이 너무 어두워서 별들이 자기소개를 해야 해.',
      '별똥별 잡아봤어? 그물 가져와. 다들 그물을 까먹어.' ] },
    { name: '시더', kind: 'boar', colors: { body: 0x6e5a48, head: 0x6e5a48 }, spot: 'grill', prop: 'spatula', voice: 250, lines: [
      '콩. 세 번째 콩이 돌아왔어. 나도 뭔지 몰라, 근데 정말 잘 자라고 있어.',
      '배고파? 콩이야. 항상 콩이야. 그게 캠핑이야, 친구.' ] },
    { name: '주니퍼', kind: 'rabbit', colors: { body: 0xe8dcc8 }, spot: 'fire', prop: 'mug', voice: 640, lines: [
      '캠핑 처음이야! 통나무용 쿠션 가져왔어. 통나무 얘긴 아무도 안 해줬어. 통나무는 대단해.',
      '헉 말로는 불이 꺼진 적 없대. 한 번도. 믿기로 했어, 그게 더 재밌으니까.' ] },
  ];
  function propFor(kind, animal) {
    const g = new THREE.Group();
    // measure the body so props sit on its surface, not inside it
    const bs = animal.userData.parts?.body?.scale ?? { x: 1, z: 1.25 };
    const halfW = 0.5 * bs.x, halfL = 0.5 * bs.z;
    if (kind === 'guitar') {
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xc9853a, 0.6));
      body.scale.set(1, 1.2, 0.45);
      g.add(body);
      const neck = box(0.06, 0.55, 0.05, 0x6b4a2e);
      neck.position.y = 0.4;
      g.add(neck);
      g.position.set(0.1, 0.75, halfL + 0.15);
      g.rotation.z = -0.9;
    } else if (kind === 'pack') {
      const pack = box(0.5, 0.6, 0.3, 0x3f7a5a);
      pack.position.set(0, 0.95, -halfL - 0.12);
      g.add(pack);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 7), mat(0xc9705a));
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, 1.32, -halfL - 0.12);
      g.add(roll);
    } else if (kind === 'book') {
      const book = box(0.3, 0.04, 0.22, 0x5b8bc9);
      book.position.set(0, 0.95, halfL + 0.12);
      book.rotation.x = -0.5;
      g.add(book);
    } else if (kind === 'paddle') {
      const p = box(0.07, 1.8, 0.05, 0x8a5a3a);
      p.position.set(halfW + 0.15, 0.9, 0.2);
      g.add(p);
      const blade = box(0.2, 0.4, 0.03, 0xf2cf5b);
      blade.position.set(halfW + 0.15, 1.7, 0.2);
      g.add(blade);
    } else if (kind === 'shovel') {
      const p = box(0.06, 1.2, 0.06, 0xa97c50);
      p.position.set(halfW + 0.15, 0.7, 0.3);
      g.add(p);
      const blade = box(0.24, 0.26, 0.04, 0x9aa3ad);
      blade.position.set(halfW + 0.15, 0.05, 0.3);
      g.add(blade);
    } else if (kind === 'spatula') {
      const p = box(0.05, 0.5, 0.05, 0x3a3630);
      p.position.set(halfW + 0.1, 0.9, halfL * 0.6);
      p.rotation.x = 0.8;
      g.add(p);
    } else if (kind === 'mug') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.14, 8), mat(0x5b8bc9, 0.5));
      m.position.set(halfW + 0.08, 0.85, halfL * 0.6);
      g.add(m);
    }
    return g;
  }
  const dayNo = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  const order = CAMPERS.map((c, i) => ({ c, k: ((i + 1) * 2654435761 + dayNo * 40503) % 1000 }))
    .sort((a, b) => a.k - b.k).map((o) => o.c);
  const taken = new Set();
  const campersHere = [];
  for (const c of order) {
    if (campersHere.length >= 4) break;
    let spotKey = c.spot;
    if (taken.has(spotKey)) {
      spotKey = Object.keys(SPOTS).find((k) => !taken.has(k) && k !== 'hammock' && k !== 'summit');
      if (!spotKey) continue;
    }
    taken.add(spotKey);
    const sp = standable(SPOTS[spotKey]);
    const a = buildAnimal(c.kind, c.colors);
    const prop = c.prop ? propFor(c.prop, a) : null;
    if (prop) a.add(prop);
    const gy = zones.islandGroundHeight(sp.x, sp.z);
    a.position.set(sp.x, gy + (sp.y ?? 0), sp.z);
    a.rotation.y = Math.atan2(sp.face.x - sp.x, sp.face.z - sp.z);
    if (sp.lie) {
      // along the sling (it runs east-west), sunk into it, legs tucked up
      a.rotation.set(0, Math.PI / 2, 0);
      a.position.y = gy + 0.32;
      a.userData.parts.legs.forEach((l, i) => { l.rotation.x = i < 2 ? -1.3 : 1.3; });
      a.userData.noFidget = true;
    }
    group.add(a);
    let li = 0;
    campersHere.push(makeWanderer(a, {
      home: { x: sp.x, z: sp.z, face: sp.face }, lie: !!sp.lie,
      trail: spotKey === 'summit' || spotKey === 'trail',
      stay: 12 + Math.random() * 20,
    }));
    register({
      getPos: () => a.position, r: 2.6,
      label: `talk to ${c.name}`,
      use: () => ui.say(c.lines[li++ % c.lines.length], { speaker: c.name, voice: c.voice }),
    });
  }
  updates.push((dt, t, playerPos) => {
    for (const w of campersHere) stepWanderer(w, dt, t, playerPos);
  });

  // =================================================== the kayaker ----
  // someone's always out on the water: a long slow loop around the island
  // and halfway back toward the archipelago, paddle flashing left, right
  {
    const ring = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const rr of [ISLAND7.r + 9, ISLAND7.r + 14, ISLAND7.r + 20]) {
        const x = ISLAND7.x + Math.cos(a) * rr, z = ISLAND7.z + Math.sin(a) * rr;
        if (terrainHeight(x, z) < WATER_Y - 0.6) { ring.push({ x, z }); break; }
      }
    }
    // ...and once a lap, a long paddle out toward the archipelago and back
    if (ring.length > 4) {
      const home = { x: 98, z: -30 }; // the Far Isle, roughly
      let near = 0;
      ring.forEach((p, i) => { if (Math.hypot(p.x - home.x, p.z - home.z) < Math.hypot(ring[near].x - home.x, ring[near].z - home.z)) near = i; });
      const out = [];
      const p0 = ring[near], dx = home.x - p0.x, dz = home.z - p0.z, dl = Math.hypot(dx, dz);
      for (const d of [12, 24, 36, 46]) {
        const x = p0.x + (dx / dl) * d + (d === 46 ? 6 : 0), z = p0.z + (dz / dl) * d;
        if (terrainHeight(x, z) < WATER_Y - 0.6) out.push({ x, z });
      }
      ring.splice(near + 1, 0, ...out, ...[...out].reverse().slice(1), { ...p0 });
    }
    if (ring.length > 4) {
      const kayak = new THREE.Group();
      kayak.add(makeKayak(0xe8743a));
      const paddler = buildAnimal('fox', { body: 0x8a6a48 });
      paddler.position.y = -0.2;
      kayak.add(paddler);
      const paddle = new THREE.Group();
      const shaft = box(2.8, 0.06, 0.06, 0x8a5a3a);
      paddle.add(shaft);
      for (const sx of [-1.4, 1.4]) {
        const blade = box(0.45, 0.04, 0.26, 0xf2cf5b);
        blade.position.x = sx;
        paddle.add(blade);
      }
      paddle.position.set(0, 0.95, 0.45);
      kayak.add(paddle);
      group.add(kayak);
      let u = 0;
      const seg = (i) => ring[((i % ring.length) + ring.length) % ring.length];
      updates.push((dt, t) => {
        u += dt * 0.09;
        const i = Math.floor(u), k = u - i;
        const a = seg(i), b = seg(i + 1);
        const kx = a.x + (b.x - a.x) * k, kz = a.z + (b.z - a.z) * k;
        kayak.position.set(kx, WATER_Y + waveAt(kx, kz, t) + 0.12, kz); // riding the swell
        kayak.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        paddle.rotation.z = Math.sin(t * 3.2) * 0.55; // left, right, left
        paddle.rotation.y = Math.sin(t * 3.2 + 1) * 0.3;
      });
      register({
        getPos: () => kayak.position, r: 6,
        label: '카약 탄 사람에게 손 흔들기',
        use: () => ui.say(pick([
          '(카약 탄 사람이 패들째로 흔들어요. 엄청난 손짓이에요. 완전히 봐준 느낌이에요.)',
          '“좋은 아침! 아니면 뭐든! 여기는 대부분 그냥 “물”이야!”',
        ])),
      });
    }
  }

  // campsite pines: a loose ring of them around the high ground, so the camp
  // feels like it's IN somewhere (it used to sit on a bare lawn)
  {
    const needle = mat(0x3f7a4f, 0.95), bark = mat(0x6e5136, 0.95);
    let planted = 0;
    for (let k = 0; k < 160 && planted < 22; k++) {
      const a = rand(0, Math.PI * 2), rr = rand(9, 21);
      const x = ISLAND7.x + Math.cos(a) * rr, z = ISLAND7.z + Math.sin(a) * rr;
      const y = terrainHeight(x, z);
      if (y < 0.9 || zones.nearAnything(x, z, 2.6)) continue;
      const pine = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.1, 7), bark);
      trunk.position.y = 0.55;
      pine.add(trunk);
      for (const [r, h, yy] of [[1.3, 1.5, 1.6], [1.0, 1.3, 2.6], [0.65, 1.1, 3.5]]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), needle);
        cone.position.y = yy;
        pine.add(cone);
      }
      pine.scale.setScalar(rand(0.8, 1.15));
      pine.position.set(x, y - 0.05, z);
      pine.rotation.y = rand(0, Math.PI * 2);
      group.add(pine);
      zones.addBlocker(x, z, 0.8 * pine.scale.x, 'tree');
      planted++;
    }
  }

  // =========================================================== fireflies ----
  // after dark the camp and the flats fill with them: slow, drifting, each
  // blinking to its own rhythm (vertex colors on additive points, so a dark
  // firefly is simply not there)
  const flies = (() => {
    const N = 60;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) {
      const overFlats = i % 3 === 0;
      const cx = overFlats ? F.x : C.x, cz = overFlats ? F.z : C.z, R = overFlats ? 9 : 15;
      const a = (i * 2.399) % (Math.PI * 2), r = Math.sqrt(((i * 7919) % 97) / 97) * R;
      seeds.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, ph: i * 1.7, sp: 0.4 + (i % 5) * 0.12 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.45, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    pts.frustumCulled = false;
    pts.visible = false;
    group.add(pts);
    return { pts, pos, col, seeds, geo };
  })();

  // everything solid casts and catches light; glows and glass do not
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.transparent) return;
    if (o.material.isMeshBasicMaterial) return;
    if (o.material.emissive && o.material.emissiveIntensity > 0) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });

  // every tent's door steps you out onto open ground (the spare tent's used
  // to set you down on a bench that went up after it)
  for (const td of tentDoors) {
    let od = 2.3;
    while (od < 4.5 && !zones.islandCanStand(td.x + td.dx * od, td.z + td.dz * od, 0.32)) od += 0.25;
    td.doorOut.x = td.x + td.dx * od;
    td.doorOut.z = td.z + td.dz * od;
    zones.setDoor(td.id, { x: td.doorOut.x, z: td.doorOut.z });
  }

  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'general') {
      for (const fn of storeUpdates) fn(dt, t, playerPos);
      return;
    }
    if (zone !== 'island') return;
    // (this list was built and never run: the campers never walked, the
    // pennant never flew, the kayaker sat parked under the Notbell plaza)
    for (const fn of updates) fn(dt, t, playerPos);

    // the fire, gently alive
    campfire.update(dt, t);

    // fireflies, after dark
    flies.pts.visible = isNight();
    if (flies.pts.visible) {
      flies.seeds.forEach((f, i) => {
        const x = f.x + Math.sin(t * f.sp * 0.5 + f.ph) * 1.6;
        const z = f.z + Math.cos(t * f.sp * 0.4 + f.ph * 1.3) * 1.6;
        flies.pos[i * 3] = x;
        flies.pos[i * 3 + 1] = Math.max(terrainHeight(x, z), WATER_Y) + 0.8 + Math.sin(t * f.sp + f.ph) * 0.5 + (i % 4) * 0.3;
        flies.pos[i * 3 + 2] = z;
        const blink = Math.max(0, Math.sin(t * (0.9 + f.sp) + f.ph)) ** 3;
        flies.col[i * 3] = blink * 0.95;
        flies.col[i * 3 + 1] = blink;
        flies.col[i * 3 + 2] = blink * 0.45;
      });
      flies.geo.attributes.position.needsUpdate = true;
      flies.geo.attributes.color.needsUpdate = true;
    }

    // Gordy's TV: flickering blues, and — when you're near — the fishing
    // show, loud (a muffled murmur; it's always the same episode)
    if (tvScreen) {
      tvScreen.t -= dt;
      if (tvScreen.t <= 0) {
        tvScreen.t = 0.25 + Math.random() * 0.4;
        const c = tvScreen.cv.getContext('2d');
        c.fillStyle = pick(['#5a86b8', '#6aa0c9', '#4a7aa8', '#7ab0d0', '#3f6a90']);
        c.fillRect(0, 0, 32, 24);
        c.fillStyle = '#3f7a4f'; c.fillRect(0, 16, 32, 8);          // the lake
        c.fillStyle = '#e8c547'; c.fillRect(8 + Math.random() * 12, 10, 4, 5); // the hat
        tvScreen.tex.needsUpdate = true;
        if (playerPos && Math.hypot(playerPos.x - GB.x, playerPos.z - GB.z) < 9 && Math.random() < 0.7) {
          tone(160 + Math.random() * 140, { dur: 0.12, type: 'triangle', vol: 0.012 });
        }
      }
    }

    // Wren makes her rounds, pausing generously — birds don't hurry her
    const w = wrenWalk;
    if (w.pause > 0) {
      w.pause -= dt;
      animateGait(w.g, t, 0);
      if (playerPos) {
        const dxp = playerPos.x - w.g.position.x, dzp = playerPos.z - w.g.position.z;
        if (Math.hypot(dxp, dzp) < 5) {
          w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dxp, dzp), dt, 4);
        }
      }
    } else {
      const target = w.points[w.seg];
      const dx = target.x - w.g.position.x, dz = target.z - w.g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        w.seg = (w.seg + 1) % w.points.length;
        w.pause = 6 + Math.random() * 10; // there was a bird
      } else {
        const step = Math.min(w.speed * dt, d);
        w.g.position.x += (dx / d) * step;
        w.g.position.z += (dz / d) * step;
        w.g.position.y = Math.max(terrainHeight(w.g.position.x, w.g.position.z), WATER_Y - 0.1);
        w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dx, dz), dt, 6);
        animateGait(w.g, t, 1);
      }
    }

    // Huck: mostly by his fire, but he gets up — to his RV, to the beach,
    // over to Gordy's to not-talk for a while — and comes back
    stepWanderer(huckWalk, dt, t, playerPos);

    // the welcome, once
    if (playerPos && !S.hasFlag('seenFarther') &&
        Math.hypot(playerPos.x - ISLAND7.x, playerPos.z - ISLAND7.z) < 20) {
      S.setFlag('seenFarther');
      ui.toast('파더 섬. 이름은 약속이고, 충실히 지켜졌어요.', '🏕️');
    }
  }

  return { group, update };
}

// the sign helper: painted board, block letters, readable at camera distance
function signBoard(text, w = 3.4, h = 0.8) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a3f33';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#6a5c48';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#f3ead6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 72;
  do {
    ctx.font = `bold ${size}px ui-rounded, 'Segoe UI', system-ui, sans-serif`;
    size -= 4;
  } while (ctx.measureText(text).width > 460 && size > 18);
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; // (without it the browns went grey)
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08),
    new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.9 }));
  board.castShadow = board.receiveShadow = true;
  return board;
    }
