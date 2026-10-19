// The Moon. Where the rovers go when they grow up — if they want.
//
// It is the quietest place the archipelago owns, and the rovers appreciate
// it professionally. Sound doesn't carry here, so they talk in lamp-blinks,
// the language they learned (secondhand, through forty years of telescope
// notes) from a certain lighthouse. They name craters after feelings, draw
// ten-thousand-year lines in the dust on purpose, fish the dust sea with
// magnets, and keep exactly one rock in a museum. The currency is gold star
// stickers, which are priceless, which is the point.

import * as THREE from 'three';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildRover } from './island6.js';
import { rand, pick, fbm, smoothstep, hash2, vnoise, turnToward } from './utils.js';
import { tone, thud, plop, jingle, sadTrombone } from './audio.js';
import { METEOR_TABLE, rollTable } from './catalog.js';

export const MOON = { x: 1000, z: 0, r: 95 };

function mat(color, rough = 0.95) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

// ----------------------------------------------------------- the ground ----

const LAND = { x: 980, z: 30, r: 10, h: 1.2 };   // the landing pad
const SET = { x: 1012, z: -6, r: 16, h: 1.5 };   // the settlement
const DUST = { x: 1040, z: 26, r: 18, h: -1.1 }; // the dust sea (a basin)
const TRAX = { x: 985, z: -26, r: 13, h: 1.4 };  // the track garden

const CRATERS = [
  { x: 1048, z: -32, r: 16, d: 4.5, name: '만족 크레이터', sign: '“만족 크레이터. 인구 0. 완벽.”' },
  { x: 955, z: 10, r: 13, d: 3.5, name: '가벼운 우려 크레이터', sign: '“가벼운 우려 크레이터. (구 불안 크레이터. 사정이 나아짐.)”' },
  { x: 996, z: 54, r: 11, d: 3, name: '낮잠 크레이터', sign: '“낮잠 크레이터. 쉿.”' },
  { x: 1022, z: -56, r: 14, d: 4, name: '와호 크레이터', sign: '“와호 크레이터. 헬멧은 이미 썼음. 진행할 것.”' },
];

export function moonHeight(x, z) {
  const d = Math.hypot(x - MOON.x, z - MOON.z);
  let h = fbm(x * 0.035 + 11, z * 0.035 - 6) * 4.2 - 0.6;
  h += smoothstep(72, 100, d) * 7; // the horizon rolls up into far hills
  for (const c of CRATERS) {
    const cd = Math.hypot(x - c.x, z - c.z);
    h += smoothstep(c.r * 1.5, c.r * 0.95, cd) * c.d * 0.35; // the rim
    h -= smoothstep(c.r, c.r * 0.2, cd) * c.d;               // the bowl
  }
  for (const s of [LAND, SET, DUST, TRAX]) {
    const sd = Math.hypot(x - s.x, z - s.z);
    if (sd < s.r) h += (s.h - h) * smoothstep(s.r, s.r * 0.45, sd);
  }
  return h;
}

const moonBlockers = [];

function addMoonBlocker(x, z, r) {
  moonBlockers.push({ x, z, r });
}

// ------------------------------------------------------------------------

export function createMoon(player) {
  const group = new THREE.Group();
  const updates = []; // (dt, t, playerPos), moon zone only

  zones.registerWorld('moon', {
    root: group,
    groundHeight: moonHeight,
    canWalk(x, z) {
      if (Math.hypot(x - MOON.x, z - MOON.z) > MOON.r) return false;
      for (const b of moonBlockers) {
        if (Math.hypot(x - b.x, z - b.z) < b.r) return false;
      }
      return true;
    },
    spawn: { x: LAND.x, z: LAND.z + 3.4, rotY: Math.PI },
    lighting: {
      bg: 0x04050a, fog: 0x04050a, fogNear: 130, fogFar: 380,
      hemiSky: 0x2a3550, hemiGround: 0x0a0c12, hemiIntensity: 0.55,
      sunIntensity: 3.2,
      sunPos: [MOON.x + 80, 90, MOON.z + 50],
      sunTarget: [MOON.x, 0, MOON.z],
    },
  });

  // --------------------------------------------------------- the ground ----
  {
    const SIZE = 230, SEG = 118;
    let geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(MOON.x, 0, MOON.z);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, moonHeight(pos.getX(i), pos.getZ(i)));
    }
    geo = geo.toNonIndexed();
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const color = new THREE.Color();
    const va = new THREE.Vector3();
    const GRAY_A = new THREE.Color(0xb4b4bc);
    const GRAY_B = new THREE.Color(0xa4a4ae);
    const BOWL = new THREE.Color(0x8b8b96);
    const DUSTC = new THREE.Color(0x72727c);
    const SPARK = new THREE.Color(0xe2e6f0);
    for (let i = 0; i < p.count; i += 3) {
      va.fromBufferAttribute(p, i);
      let inBowl = 0;
      for (const c of CRATERS) {
        inBowl = Math.max(inBowl, smoothstep(c.r, c.r * 0.4, Math.hypot(va.x - c.x, va.z - c.z)));
      }
      if (Math.hypot(va.x - DUST.x, va.z - DUST.z) < DUST.r - 1) {
        color.copy(DUSTC);
      } else if (hash2(i, 13) > 0.992) {
        color.copy(SPARK); // a fleck that remembers being a star
      } else {
        color.copy(vnoise(va.x * 0.5 + 3, va.z * 0.5 - 8) > 0.5 ? GRAY_A : GRAY_B);
        color.lerp(BOWL, inBowl);
      }
      color.multiplyScalar(1 + (hash2(i, 5) - 0.5) * 0.08);
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = color.r;
        colors[(i + k) * 3 + 1] = color.g;
        colors[(i + k) * 3 + 2] = color.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
    }));
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ------------------------------------------------------------ the sky ----
  {
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 650; i++) {
      const a = rand(0, Math.PI * 2);
      const elev = Math.acos(rand(0.04, 1)); // denser near the zenith
      const r = 260;
      pts.push(
        MOON.x + Math.cos(a) * Math.sin(elev) * r,
        Math.cos(elev) * r + 4,
        MOON.z + Math.sin(a) * Math.sin(elev) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xeef2ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.9,
    }));
    stars.material.fog = false;
    group.add(stars);
  }

  // home, hanging in the black — every island the volcano ever made
  let glint;
  {
    const home = new THREE.Group();
    const sea = new THREE.Mesh(new THREE.IcosahedronGeometry(15, 2),
      new THREE.MeshStandardMaterial({
        color: 0x3fa0d8, emissive: 0x10283c, flatShading: true, roughness: 0.6,
      }));
    home.add(sea);
    // the archipelago, roughly as charted (the cartographer was a rover)
    const isles = [
      [0, 0.2, 2.2, 0x5fb74a],   // Notbell
      [1.6, -0.6, 1.4, 0x5fb74a], // the Far Isle
      [-1.1, -1.5, 1.1, 0x4f8a52], // the moss
      [0.6, -2.1, 0.9, 0x55504c], // the mountain, retired
      [0.2, 1.7, 1.2, 0x595a5e],  // the warehouse
      [1.7, 1.5, 1.3, 0x5fb74a],  // the orchards
      [-2.3, -0.9, 1.5, 0xb6b1a4], // the Labs (off every chart but this one)
    ];
    for (const [ix, iz, ir, c] of isles) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(ir, 0), mat(c, 0.9));
      blob.scale.y = 0.35;
      const len = Math.hypot(ix, iz, 13.5);
      blob.position.set(ix, 13.8, iz).multiplyScalar(15.2 / len);
      blob.lookAt(0, 0, 0);
      home.add(blob);
    }
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.2, 2.6), 0),
        new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0x404048, flatShading: true,
          transparent: true, opacity: 0.85, roughness: 1,
        }));
      const a = rand(0, Math.PI * 2), e = rand(-0.9, 0.9);
      cloud.position.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(16.4);
      cloud.scale.y = 0.4;
      home.add(cloud);
    }
    // the glint, southeast of the big island, deep in the navy water
    glint = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf2cf5b, emissive: 0xc9a02c, emissiveIntensity: 0.6, flatShading: true,
      }));
    glint.position.set(2.4, 12.8, 2.8).multiplyScalar(15.1 / Math.hypot(2.4, 12.8, 2.8));
    home.add(glint);
    home.traverse((o) => { o.material && (o.material.fog = false); });
    home.position.set(MOON.x - 30, 72, MOON.z - 185);
    group.add(home);
    updates.push((dt, t) => {
      home.rotation.y = t * 0.01; // home turns slowly, like it has all day
      glint.material.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 0.7)) * 1.2;
    });
  }

  // ----------------------------------------------------- the landing pad ----
  {
    const scorch = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.1, 14), mat(0x55555e, 1));
    scorch.position.set(LAND.x, LAND.h + 0.02, LAND.z - 3);
    group.add(scorch);
    // the rocket, parked on its legs, pointed home
    const rocket = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 5.2, 10), mat(0xf2efe4, 0.7));
    body.position.y = 3.6;
    rocket.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.9, 10), mat(0xd9534f, 0.7));
    nose.position.y = 7.1;
    rocket.add(nose);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = box(0.16, 2.6, 0.16, 0x9aa3ad);
      leg.position.set(Math.cos(a) * 1.5, 1.0, Math.sin(a) * 1.5);
      leg.rotation.z = Math.cos(a) * 0.4;
      leg.rotation.x = -Math.sin(a) * 0.4;
      rocket.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.15, 7), mat(0x9aa3ad, 0.6));
      foot.position.set(Math.cos(a) * 2.0, 0.1, Math.sin(a) * 2.0);
      rocket.add(foot);
    }
    const ladder = box(0.5, 3.4, 0.08, 0xc9962e);
    ladder.position.set(0, 1.7, 1.1);
    rocket.add(ladder);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc97a, flatShading: true }));
    glow.position.set(0, 2.0, 1.06);
    rocket.add(glow);
    rocket.position.set(LAND.x, LAND.h, LAND.z - 3);
    rocket.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(rocket);
    addMoonBlocker(LAND.x, LAND.z - 3, 2.4);
    updates.push((dt, t) => {
      glow.material.emissiveIntensity = 1 + Math.sin(t * 1.6) * 0.4; // still humming
    });

    register({
      pos: new THREE.Vector3(LAND.x, 0, LAND.z + 0.4), r: 2.6, zone: 'moon',
      label: '집으로 날아가기',
      use: async () => {
        const go = await ui.ask('로켓이 다리를 뻗고 사다리를 내린 채, 심장을 빛내며 기다려요. 빛의 씨앗이 여기서는 조금 다른 노래를 흥얼거려요. 좀 더 둥근 노래요.', [
          { label: '🌍 집으로 날아가기', value: 'go' },
          { label: '조금 더 있기', value: null },
        ]);
        if (!go) return;
        await ui.fadeSwap(async () => {
          tone(54, { dur: 1.8, type: 'sawtooth', vol: 0.07 });
          await ui.say([
            '떨어지는 건 그저 정해진 시간의 도착이에요. 로켓은 지켜진 약속처럼 해내요.',
            '검은 것이 옅어지고, 옅은 것이 파래져요. 내려가는 어디쯤에서 바다가 다시 시작돼요 — 동체 너머로 들려요. 그리워했는지 방금 전까지 몰랐어요.',
          ]);
          await zones.go('island', { x: -134, z: -73, rotY: Math.PI });
        });
        ui.toast('집. 갈매기들이 그을음 자국에 대해 벌써 의견이 있어요.', '🌊');
      },
    });

    // the flag the rovers planted for the first graduate
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), mat(0xd9d4c8, 0.5));
    pole.position.set(LAND.x + 4.2, moonHeight(LAND.x + 4.2, LAND.z - 1) + 1.3, LAND.z - 1);
    group.add(pole);
    const cloth = box(1.2, 0.74, 0.04, 0xfdf6e4);
    cloth.position.set(LAND.x + 4.85, moonHeight(LAND.x + 4.2, LAND.z - 1) + 2.2, LAND.z - 1);
    group.add(cloth);
    const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.12, 5),
      new THREE.MeshStandardMaterial({ color: 0xf2cf5b, emissive: 0x8a6f1c, flatShading: true }));
    sticker.position.set(LAND.x + 5.2, moonHeight(LAND.x + 4.2, LAND.z - 1) + 2.42, LAND.z - 0.97);
    group.add(sticker);
    register({
      pos: new THREE.Vector3(LAND.x + 4.2, 0, LAND.z - 1), r: 2.0, zone: 'moon',
      label: '깃발 읽기',
      use: () => ui.say([
        '빳빳한 작은 깃발, 유치원 첫 졸업생이 도착한 날 꽂혔어요: 없는 종, 있는 버튼. 바람이 건드린 적도 없고, 건드릴 예정도 없어요.',
        '모퉁이에 살짝 비뚤게, 금별 스티커 하나. “획득함,” 명판에 적혀 있어요. 그게 명판 전부예요.',
      ]),
    });
  }

  // ------------------------------------------------------ the settlement ----
  const rovers = []; // the wandering grown-ups

  function adultRover(opts = {}) {
    const r = buildRover(opts.body ?? 0xcfd2d8);
    r.scale.setScalar(Math.max(opts.scale ?? 2.05, 2));
    return r;
  }

  function placeNPC(g, x, z, ry = 0, solid = true) {
    g.position.set(x, moonHeight(x, z), z);
    g.rotation.y = ry;
    group.add(g);
    if (solid) addMoonBlocker(x, z, 0.8); // a grown rover is a lot of rover (you used to walk right through them)
  }

  // the charging meadow: solar flowers, planted in rows, leaning sunward
  {
    for (let i = 0; i < 6; i++) {
      const fx = SET.x - 6 + (i % 3) * 2.6;
      const fz = SET.z + 4.5 + Math.floor(i / 3) * 2.6;
      const fy = moonHeight(fx, fz);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5), mat(0x9aa3ad, 0.6));
      stem.position.set(fx, fy + 0.75, fz);
      group.add(stem);
      const panel = box(1.1, 0.06, 0.8, 0x2e3e6b);
      panel.position.set(fx + 0.25, fy + 1.55, fz + 0.15);
      panel.rotation.z = -0.5 + rand(-0.08, 0.08);
      panel.rotation.x = 0.3;
      group.add(panel);
      addMoonBlocker(fx, fz, 0.45);
    }
    // one rover always charging here, dreaming in maps
    const napper = adultRover({ body: 0xc4ccd4 });
    placeNPC(napper, SET.x - 3.4, SET.z + 8.6, 2.6);
    napper.userData.head.rotation.x = 0.55;
    register({
      pos: new THREE.Vector3(SET.x - 3.4, 0, SET.z + 8.6), r: 1.8, zone: 'moon',
      label: '충전 중인 로버 들여다보기',
      use: () => ui.say('(충전 중. 바퀴가 아주 살짝 꿈틀해요. 피니언 선생님 말이 맞았어요 — 얘네 정말 지도로 꿈꿔요.)'),
    });
  }

  // the beacon: how the moon talks to anyone patient enough to watch
  {
    const bx = SET.x + 7, bz = SET.z - 6;
    const by = moonHeight(bx, bz);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 7.5, 7), mat(0x9aa3ad, 0.6));
    tower.position.set(bx, by + 3.75, bz);
    tower.castShadow = true;
    group.add(tower);
    const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffd9a0, emissive: 0xffc97a, emissiveIntensity: 0.2, flatShading: true,
      }));
    lamp.position.set(bx, by + 7.8, bz);
    lamp.material.fog = false;
    group.add(lamp);
    addMoonBlocker(bx, bz, 0.8);
    // it blinks the old harbor pattern: two short, one long, rest
    let blinkT = 0;
    updates.push((dt, t) => {
      blinkT = (blinkT + dt) % 3.6;
      const on = blinkT < 0.25 || (blinkT > 0.55 && blinkT < 0.8) || (blinkT > 1.2 && blinkT < 2.0);
      lamp.material.emissiveIntensity = on ? 2.0 : 0.12;
    });

    const beacon = adultRover({ body: 0xd8d2c0 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.9, 4), mat(0xc9962e, 0.5));
    mast.position.set(0.18, 0.9, -0.25);
    beacon.add(mast);
    const mastLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc97a, flatShading: true }));
    mastLamp.position.set(0.18, 1.38, -0.25);
    beacon.add(mastLamp);
    placeNPC(beacon, bx - 1.8, bz + 1.6, 0.8);
    let beaconIdx = 0;
    const BEACON_LINES = [
      '⬩ ⬩ — ⬩ (비컨이 반가워해요. 램프가 두 번 말해요, 첫 번째가 눈부심에 묻힐까 봐.)',
      '— — ⬩ ⬩ ⬩ (당신이 타고 온 빛에 대한 긴 생각. 비컨은 이 언어를 그 빛에서 배웠어요 — 간접적으로, 40년치 망원경 노트로.)',
      '⬩ — ⬩ (비컨이 램프를 머리 위 푸른 구슬에 향했다가, 당신에게, 그리고 다시. 번역: “거기서 왔구나. 티 나. 칭찬이야.”)',
      '— (비컨이 길고 따뜻한 깜빡임 하나를 유지해요. 번역은 없어요. 그래도 알아들었어요.)',
    ];
    register({
      getPos: () => beacon.position, r: 2.4, zone: 'moon',
      label: '비컨의 깜빡임 보기',
      use: () => {
        tone(1400, { dur: 0.05, vol: 0.03 });
        ui.say(BEACON_LINES[beaconIdx++ % BEACON_LINES.length], { speaker: '비컨', voice: 880 });
      },
    });
  }

  // the Best Rock Museum (one dome, one pedestal, one rock; rotation: daily)
  {
    const mx = SET.x - 1, mz = SET.z - 9;
    const my = moonHeight(mx, mz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb9b4a8, 0.9));
    dome.position.set(mx, my, mz);
    dome.castShadow = true;
    group.add(dome);
    addMoonBlocker(mx, mz, 3.4);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.1, 7), mat(0xd9d4c8, 0.8));
    pedestal.position.set(mx, my + 0.55, mz + 4.6);
    group.add(pedestal);
    const bestRock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), mat(0x9a9aa4, 0.95));
    bestRock.position.set(mx, my + 1.35, mz + 4.6);
    bestRock.castShadow = true;
    group.add(bestRock);
    addMoonBlocker(mx, mz + 4.6, 0.7);
    updates.push((dt, t) => {
      bestRock.rotation.y = t * 0.3; // display rotation. it earned this.
    });
    const ROCKS = [
      '제럴드 (화성암)', '토스트', '둥근 편', '항목 7',
      '솔직히 아름다운 바위', '소조가 앉았던 바위',
      '아마 운석 (논쟁 중)', '그렉 (제럴드의 라이벌)',
    ];
    const today = Math.floor(Date.now() / 86400000);
    register({
      pos: new THREE.Vector3(mx, 0, mz + 5.6), r: 2.2, zone: 'moon',
      label: '오늘의 최고 바위 감상하기',
      use: () => ui.say([
        `받침대 명판: “오늘의 최고 바위: ${ROCKS[today % ROCKS.length]}. 책임감 있게 감상해 주세요.”`,
        '순수한 햇빛 광선 아래에서 천천히 회전해요. 인정할 건 인정해야 해요, 훌륭한 바위예요.',
      ]),
    });

    const pebble = adultRover({ body: 0xd2cabe });
    const bowtie = box(0.22, 0.1, 0.05, 0xb0453a);
    bowtie.position.set(0, 0.62, 0.38);
    pebble.add(bowtie);
    placeNPC(pebble, mx + 2.2, mz + 4.2, -0.7);
    let pebbleIdx = 0;
    const PEBBLE_LINES = [
      '페블이에요. 관장. 최고 바위 박물관에 오신 걸 환영해요. 오늘의 최고 바위는 받침대에. 어제의 최고 바위는 그 외 전부예요. 컬렉션은 아주 잘나가요.',
      '어떤 바위가 최고인지 순환시켜요. 민주주의예요. 먼지 바다도 투표해요 — 투표용지가 엄청 무거워서 종단 속도로 도착하죠.',
      '기증은 안 돼요. 추천은 가능해요. 위원회는 지구 뜰 때 모이고, 깨어 있는 사람 전원으로 구성돼요.',
      '아래 고향엔 움직임을 멈춘 것들의 박물관이 통째로 있죠. 펀. 전설이에요. 망원경으로 편지를 주고받아요, 하룻밤에 한 단어씩.',
    ];
    register({
      getPos: () => pebble.position, r: 2.4, zone: 'moon',
      label: '페블과 대화하기',
      use: () => ui.say(PEBBLE_LINES[pebbleIdx++ % PEBBLE_LINES.length], { speaker: '페블', voice: 480 }),
    });
  }

  // crater signage (the parks department is one rover with strong opinions)
  for (const c of CRATERS) {
    const a = Math.atan2(SET.x - c.x, SET.z - c.z); // sign faces the settlement
    const sx = c.x + Math.sin(a) * (c.r + 2.5);
    const sz = c.z + Math.cos(a) * (c.r + 2.5);
    const sy = moonHeight(sx, sz);
    const post = box(0.1, 1.3, 0.1, 0x9aa3ad);
    post.position.set(sx, sy + 0.65, sz);
    group.add(post);
    const boardC = box(1.7, 0.6, 0.08, 0xd9d4c8);
    boardC.position.set(sx, sy + 1.5, sz);
    boardC.rotation.y = a;
    group.add(boardC);
    register({
      pos: new THREE.Vector3(sx, 0, sz), r: 2.0, zone: 'moon',
      label: '크레이터 표지판 읽기',
      use: () => ui.say(c.sign),
    });
  }

  // the lookout: Old Sojo, a bench, and home in the sky
  {
    const c = CRATERS[0]; // Contentment, naturally
    const a = Math.atan2(MOON.x - c.x, (MOON.z - 100) - c.z);
    const lx = c.x + Math.sin(a) * (c.r + 1.5) - 4;
    const lz = c.z + Math.cos(a) * (c.r + 1.5);
    const ly = moonHeight(lx, lz);
    const bench = new THREE.Group();
    const seat = box(2.4, 0.14, 0.6, 0xb9b4a8);
    seat.position.y = 0.5;
    bench.add(seat);
    for (const sx of [-1, 1]) {
      const leg = box(0.14, 0.5, 0.55, 0x9aa3ad);
      leg.position.set(sx * 0.95, 0.25, 0);
      bench.add(leg);
    }
    bench.position.set(lx, ly, lz);
    bench.rotation.y = Math.PI; // facing the rise
    group.add(bench);
    addMoonBlocker(lx, lz, 0.7);
    const plate = box(0.7, 0.3, 0.05, 0xc9962e);
    plate.position.set(lx + 1.4, ly + 0.5, lz);
    group.add(plate);
    register({
      pos: new THREE.Vector3(lx + 1.4, 0, lz + 0.8), r: 1.8, zone: 'moon',
      label: '벤치 명판 읽기',
      use: () => ui.say('“로버 둘 또는 말랑한 방문객 하나 기준. — 위원회”'),
    });

    const sojo = adultRover({ body: 0xcfc4a8, scale: 1.5 });
    // one wheel replaced, long ago, with whatever fit
    const odd = sojo.userData.wheels[2];
    odd.scale.setScalar(1.3);
    odd.material = mat(0xb0453a, 0.6);
    placeNPC(sojo, lx - 2.4, lz - 0.4, Math.PI - 0.3);
    let sojoIdx = 0;
    const SOJO_STORIES = [
      ['“앉아. 벤치는 로버 둘 또는 말랑한 방문객 하나 기준이야.”',
       '“나는 혼자 올라왔어, 유치원도 스티커도 없던 때에. 연구소에서 삽 팔이랑 무전기, 그리고 연료보다 긴 질문 목록을 줬지.”',
       '“두 번째 겨울에 무전기가 고장 났어. 그래서 원을 그리며 달렸지 — 망원경이 읽을 수 있게, 크게. 아직 여기 있음. 아직 여기 있음. 아래 칠판에 분필로 적었다더군. 아직도 있다던데.”',
       '“그러다 어느 날 하늘이 열리고, 로켓이 유치원 첫 졸업생을 데려왔어. 그 뒤로 비상용 원은 안 그렸지. 이제는 재미로 그려. 완전히 다른 원이야.”'],
      ['“저기 고향 보여? 다른 것들처럼 뜨고 지지. 파란 거. 시끄러운 거.”',
       '“소리는 빈 공간을 못 건너니까, 대신 느끼는 거야 — 바퀴로, 땅으로. 조수가 당기는 것. 화산이 으스대며 콧노래 부르는 것. 그리고 대조기엔, 선원… 무언가 울리는 소리.”',
       '“수십 년 전에 연구소에 말했어. 그래프를 액자에 넣고 공은 늑대에게 줬더군. 공평해. 걔는 들었으니까. 우리는 느꼈을 뿐이야.”'],
      ['“여기 올라와서 처음 한 일? 아무것도. 한 달 동안. 장엄했어.”',
       '“연구소는 고장 난 줄 알았대. 나는 고요를 듣고 있었어. 여기 고요는 비어 있지 않아 — 가득 차 있어. 쉬게 된 모든 소리가 있어.”',
       '“그래서 어른들이 남는 거야, 운석으로 부자가 돼 굴러갈 수도 있는데. 여긴 군도가 소유한 가장 조용한 곳이야. 누군가는 전문적으로 감상해야지.”'],
    ];
    register({
      getPos: () => sojo.position, r: 2.8, zone: 'moon',
      label: '늙은 소조와 대화하기',
      use: () => ui.say(SOJO_STORIES[sojoIdx++ % SOJO_STORIES.length], { speaker: '늙은 소조', voice: 360 }),
    });

    register({
      pos: new THREE.Vector3(lx, 0, lz + 1), r: 1.6, zone: 'moon', priority: 0,
      label: '앉아서 고향 바라보기',
      use: () => ui.say([
        '군도가 암흑에 매달려 있어요 — 파랗고 초록이고 두 발바닥에 받칠 만큼 작아요. 구름이 해협을 흘러가요. 화산이 연기를 뿜어요. 여기서도 포근해요.',
        '큰 섬 남동쪽, 남색 물 깊은 곳에서 무언가가 햇빛을 받아요. 반짝임. 눈을 고정하면 사라지고, 노력을 멈추면 돌아와요.',
        '늙은 소조는 쳐다보지 않아요. “그 반짝임을 40년째 기록해 왔어,” 그녀가 말해요. “대조기엔 울려. 언젠가 누군가 저 아래로 내려가 인사할 거야. 로버는 안 돼 — 녹슬거든. 말랑하고, 고집 센 누군가가.”',
      ]),
    });
  }

  // ---------------------------------------------------- the track garden ----
  {
    const θmax = 22.6;
    for (let th = 0.6; th < θmax; th += 0.34) {
      const r = 1.5 + 0.42 * th;
      const gx = TRAX.x + Math.cos(th) * r;
      const gz = TRAX.z + Math.sin(th) * r;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.16), mat(0x6e6e78, 1));
      seg.position.set(gx, moonHeight(gx, gz) + 0.03, gz);
      seg.rotation.y = -th - Math.PI / 2;
      group.add(seg);
    }
    const tracks = adultRover({ body: 0xe2ddd0 });
    tracks.userData.wheels.forEach((w) => { w.material = mat(0xf2efe4, 0.8); }); // chalk wheels
    group.add(tracks);
    let th = 0.6, dir = 1;
    updates.push((dt) => {
      th += dir * dt * 0.5;
      if (th > θmax) { th = θmax; dir = -1; }
      if (th < 0.6) { th = 0.6; dir = 1; }
      const r = 1.5 + 0.42 * th;
      const gx = TRAX.x + Math.cos(th) * r;
      const gz = TRAX.z + Math.sin(th) * r;
      tracks.position.set(gx, moonHeight(gx, gz), gz);
      tracks.rotation.y = -th - (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      for (const w of tracks.userData.wheels) w.rotation.x += dt * 3;
    });
    let tracksIdx = 0;
    const TRACKS_LINES = [
      '트랙스. 나는 그려. 먼지는 선을 만 년간 잡아두니까, 진심으로 그리는 게 좋아.',
      '이 작품은 〈나선 41호: 계속 갔다〉야. 비평가들 — 페블 — 은 “둥글다”고 하지. 비평이 맞아. 그게 작품이거든.',
      '네 부츠가 지금 작품에 기여하고 있어. 사과하지 마. 협업이야.',
      '소조의 비상용 원들이 아직 동쪽 가장자리 너머에 있어. 우리가 관리해. 누가 곤란해서가 아니야. 여기서 누군가 그린 것 중 최고니까.',
    ];
    register({
      getPos: () => tracks.position, r: 2.6, zone: 'moon',
      label: '트랙스와 대화하기',
      use: () => ui.say(TRACKS_LINES[tracksIdx++ % TRACKS_LINES.length], { speaker: '트랙스', voice: 560 }),
    });
  }

  // ------------------------------------------------------- the dust sea ----
  // fishing, except the sea is dust, the rod is a magnet, and the bite
  // is a CLUNK you feel through your boots.
  {
    const magnetRover = adultRover({ body: 0xb89890 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 4), mat(0x7a5230));
    rod.position.set(0.3, 0.85, 0.3);
    rod.rotation.z = -0.7;
    magnetRover.add(rod);
    const horseshoe = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 6, 10, Math.PI), mat(0xb0453a, 0.5));
    horseshoe.position.set(0.85, 0.45, 0.3);
    horseshoe.rotation.z = Math.PI;
    magnetRover.add(horseshoe);
    placeNPC(magnetRover, DUST.x - DUST.r + 2.5, DUST.z - 4, 1.2);
    let magnetIdx = 0;
    const MAGNET_LINES = [
      '아래 고향 바다는 종을 맡고 있다더군. 우리 바다는 떨어진 나머지 전부를 맡고 있어. 공정한 거래지. 조용한 재고고.',
      '달진주를 한 번 잡은 적 있어. 딱 하나. 네 까치가 버튼 생각하듯 생각해 — 끊임없이, 소리 내서.',
      '보조개를 노려. 바다는 뭘 품고 있으면 숨을 쉬어. 먼지가 어떻게 숨 쉬는지 묻지 마. 먼지도 네게 안 묻거든.',
    ];
    register({
      getPos: () => magnetRover.position, r: 2.6, zone: 'moon',
      label: '매그넷과 대화하기',
      use: () => {
        if (!S.hasFlag('magnetLent')) {
          S.setFlag('magnetLent');
          jingle();
          ui.say([
            '매그넷. 나는 먼지 바다에서 낚시해. 물고기 말고 — 철고기. 하늘이 40억 년째 방류 중이고 면허는 나밖에 없어.',
            '자 — 대여용 낚싯대. 보조개에 던지고, 쿵 소리를 기다려. 너무 이른 건 조심하고. 먼지는 조급함을 싫어해. 어느 바다나 마찬가지야.',
          ], { speaker: '매그넷', voice: 420 });
          ui.toast('매그넷이 <b>대여용 낚싯대</b>를 빌려줬어요! 먼지 바다의 보조개에 던져 보세요.', '🧲');
          return;
        }
        ui.say(MAGNET_LINES[magnetIdx++ % MAGNET_LINES.length], { speaker: '매그넷', voice: 420 });
      },
    });

    // the dimples: where the sea is breathing
    const dimples = [];
    function moveDimple(d) {
      const a = rand(0, Math.PI * 2);
      const r = rand(3, DUST.r - 4);
      d.x = DUST.x + Math.cos(a) * r;
      d.z = DUST.z + Math.sin(a) * r;
      d.m.position.set(d.x, moonHeight(d.x, d.z) + 0.05, d.z);
    }
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 5, 12),
        new THREE.MeshStandardMaterial({ color: 0x55555e, flatShading: true, roughness: 1 }));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      const d = { m: ring, x: 0, z: 0, phase: rand(0, 6) };
      moveDimple(d);
      dimples.push(d);
    }
    updates.push((dt, t) => {
      for (const d of dimples) {
        d.m.scale.setScalar(1 + Math.sin(t * 1.4 + d.phase) * 0.18);
      }
    });

    // the cast itself
    let dustState = 'idle'; // idle | waiting | clunk
    let dustTimer = 0;
    let activeDimple = null;
    const castFrom = new THREE.Vector3();
    const magnetBob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xb0453a, 0.5));
    magnetBob.visible = false;
    group.add(magnetBob);

    function nearDimple() {
      for (const d of dimples) {
        if (Math.hypot(d.x - player.group.position.x, d.z - player.group.position.z) < 4.4) return d;
      }
      return null;
    }

    function resetCast() {
      dustState = 'idle';
      magnetBob.visible = false;
      activeDimple = null;
    }

    register({
      getPos: () => player.group.position, r: 99, priority: 0, zone: 'moon',
      enabled: () => S.hasFlag('magnetLent') && (dustState !== 'idle' || !!nearDimple()),
      label: () => (dustState === 'idle' ? '자석 던지기'
        : dustState === 'clunk' ? '끌어올리기!' : '쿵 소리 기다리기…'),
      use: () => {
        if (dustState === 'idle') {
          const d = nearDimple();
          if (!d) return;
          activeDimple = d;
          castFrom.copy(player.group.position);
          magnetBob.position.set(d.x, moonHeight(d.x, d.z) + 0.25, d.z);
          magnetBob.visible = true;
          plop();
          dustState = 'waiting';
          dustTimer = rand(2.5, 6);
        } else if (dustState === 'waiting') {
          resetCast();
          ui.toast('너무 일러요. 먼지가 품고 있던 것 위로 다시 닫혀요.', '🌑');
        } else if (dustState === 'clunk') {
          const id = rollTable(METEOR_TABLE);
          S.addItem(id);
          jingle();
          ui.foundItem(id);
          ui.updateHUD();
          moveDimple(activeDimple);
          resetCast();
        }
      },
    });

    updates.push((dt, t, playerPos) => {
      if (dustState === 'idle') return;
      if (castFrom.distanceTo(playerPos) > 0.4) { resetCast(); return; }
      if (dustState === 'waiting') {
        magnetBob.position.y = moonHeight(magnetBob.position.x, magnetBob.position.z) + 0.25 + Math.sin(t * 2) * 0.04;
        dustTimer -= dt;
        if (dustTimer <= 0) {
          dustState = 'clunk';
          dustTimer = 0.9;
          magnetBob.position.y -= 0.22;
          thud(); // you feel it through your boots
        }
      } else if (dustState === 'clunk') {
        dustTimer -= dt;
        if (dustTimer <= 0) {
          resetCast();
          sadTrombone();
          ui.toast('놓쳤어요. 아래 어딘가에서 철이 다시 낮잠으로 돌아가요.', '🧲');
        }
      }
    });
  }

  // moon rocks, personally considered
  {
    const spots = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = rand(22, 44);
      const x = MOON.x + Math.cos(a) * r;
      const z = MOON.z + Math.sin(a) * r;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.22, 0.34), 0), mat(0x8e8e98, 0.95));
      rock.position.set(x, moonHeight(x, z) + 0.15, z);
      rock.castShadow = true;
      group.add(rock);
      const spot = { rock, regrow: 0 };
      spots.push(spot);
      register({
        pos: rock.position, r: 1.8, zone: 'moon',
        enabled: () => rock.visible,
        label: '달 바위 줍기',
        use: () => {
          rock.visible = false;
          spot.regrow = 300; // the moon finds another; the moon has several
          S.addItem('moon_rock');
          jingle();
          ui.foundItem('moon_rock');
          ui.updateHUD();
        },
      });
    }
    updates.push((dt) => {
      for (const s of spots) {
        if (!s.rock.visible) {
          s.regrow -= dt;
          if (s.regrow <= 0) s.rock.visible = true;
        }
      }
    });
  }

  // Comet, who does the perimeter (the perimeter does not need doing)
  {
    const comet = adultRover({ body: 0xeef2f6, scale: 1.15 });
    placeNPC(comet, SET.x - 2, SET.z - 2, 0, false); // (Comet does the perimeter: no fixed spot to be solid at)
    const state = { target: null, pauseT: 0 };
    updates.push((dt, t, playerPos) => {
      const pd = Math.hypot(playerPos.x - comet.position.x, playerPos.z - comet.position.z);
      if (pd < 3.2) {
        comet.rotation.y = turnToward(comet.rotation.y,
          Math.atan2(playerPos.x - comet.position.x, playerPos.z - comet.position.z), dt, 6);
        return;
      }
      if (state.pauseT > 0) { state.pauseT -= dt; return; }
      if (!state.target) {
        const a = rand(0, Math.PI * 2);
        state.target = { x: SET.x + Math.cos(a) * rand(4, 13), z: SET.z + Math.sin(a) * rand(4, 13) };
      }
      const dx = state.target.x - comet.position.x, dz = state.target.z - comet.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) { state.target = null; state.pauseT = rand(0.5, 2); return; }
      comet.rotation.y = turnToward(comet.rotation.y, Math.atan2(dx, dz), dt, 4);
      comet.position.x += Math.sin(comet.rotation.y) * 2.6 * dt; // zoomy
      comet.position.z += Math.cos(comet.rotation.y) * 2.6 * dt;
      comet.position.y = moonHeight(comet.position.x, comet.position.z);
      for (const w of comet.userData.wheels) w.rotation.x += dt * 9;
    });
    let cometIdx = 0;
    const COMET_LINES = [
      '나는 매일 외곽 순찰을 해. 외곽은 순찰이 필요 없어. 그래서 완벽한 거야.',
      '와호 크레이터는 정직하게 지어진 이름이야. 동쪽 경사로 가 봐. 팔은 붙이고. 먼지를 믿어.',
      '내려가면 — 유치원에 들러. 유리 너머로 손 흔들어. 하중을 받치는 일이야. 흔들면 알게 될 거야.',
    ];
    register({
      getPos: () => comet.position, r: 2.6, zone: 'moon',
      label: '코멧과 대화하기',
      use: async () => {
        if (!S.hasFlag('metComet')) {
          S.setFlag('metComet');
          tone(990, { dur: 0.06, vol: 0.04 });
          tone(1320, { time: 0.08, dur: 0.06, vol: 0.04 });
          await ui.say([
            '(로버 하나가 너무 빨리 다가와서 멈추려고 당신을 두 바퀴 공전해요.)',
            '삐! 삐! 아래서 위로 왔어?! 유— 유치원 지나서 온 거야? 피니언 선생님 아직— 창문 아직— 아직 손 흔들어?',
          ], { speaker: '코멧', voice: 920 });
          if (S.hasFlag('metPinion')) {
            S.addItem('gold_star');
            jingle();
            await ui.say([
              '알았어. 크레용이랑 야망 냄새 날 줄 알았다니까.',
              '자 — 졸업 때 받은 마지막 스티커. 피니언 선생님이 물건 말고 사람에게 쓰라 했어. 그래서. 씀.',
            ], { speaker: '코멧', voice: 920 });
            ui.toast('코멧이 <b>금별 스티커</b>를 줬어요! 돈보다 좋아요.', '⭐');
          } else {
            await ui.say('선생님을 아직 못 만났다고?! 내려가. 유리방으로 가. 블록을 소리 내서 읽어. 그리고 돌아와서 얘기하자, 졸업생과 예비 졸업생으로.',
              { speaker: '코멧', voice: 920 });
          }
          return;
        }
        ui.say(COMET_LINES[cometIdx++ % COMET_LINES.length], { speaker: '코멧', voice: 920 });
      },
    });
  }

  // ============================================================ update ----
  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}
