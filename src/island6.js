// Notbell Labs: the far-west research isle. Founded to hear the bell again
// (the machines kept getting bigger; the research kept getting wider), now
// home to frontier chemistry, one room-sized computer, a rocket division,
// a cafeteria, and a kindergarten of rovers who may go to the moon when
// they grow up, if they want. Almost named Bell Labs. Legal said no.

import * as THREE from 'three';
import { CONSTELLATION_NAMES } from './sky.js';
import { SITES, ISLAND3, ISLAND6, terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { jingle, tone, doorChime, sip } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { addIslandInfo } from './fieldguide.js';
import { HOLIDAY, isNight } from './calendar.js';
import { currentWeather, setSpaceFade } from './almanac.js';
import { setLaunchNight } from './sky.js';
import { makeCeilingTube } from './buildings.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function solidShadowCaster(o) {
  if (!o.isMesh) return false;
  const materials = Array.isArray(o.material) ? o.material : [o.material];
  return !materials.some((m) => m && (
    m.transparent || m.isMeshBasicMaterial || (m.emissive && m.emissive.getHex() !== 0)
  ));
}

const IN = { x: 300, z: 1700 }; // the labs interior, off in the elsewhere

// the dock the Persistent calls at (consumed by boats.js — create the labs
// before the boats in main.js, same deal as BULKO)
export const LABS_DOCK = { x: 0, z: 0, rotY: 0, buoyPos: null };

// painted lettering for boards and banners: auto-shrinks each line to fit
// (the BULKO sign's trick), so the words always make it onto the wood
function letteredPlane(w, h, lines, bg, fg, pxPerUnit = 128) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * pxPerUnit);
  cv.height = Math.round(h * pxPerUnit);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [text, yFrac, sizeFrac, weight = 800] of lines) {
    let size = Math.round(cv.height * sizeFrac);
    do {
      ctx.font = `${weight} ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`;
      if (ctx.measureText(text).width <= cv.width * 0.9 || size <= 10) break;
      size -= 2;
    } while (true);
    ctx.fillText(text, cv.width / 2, cv.height * yFrac);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

// ----------------------------------------------------------- the flag ----
// The Notbell flag: the outline of the bell that isn't, a button where the
// clapper was. Same mark as the front door of the website, because the Labs
// standardized it. They standardize everything. They have a committee.

function flagTexture() {
  const cv = document.createElement('canvas');
  cv.width = 160;
  cv.height = 100;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fdf6e4';
  ctx.fillRect(0, 0, 160, 100);
  ctx.strokeStyle = '#e8d5ae';
  ctx.lineWidth = 5;
  ctx.strokeRect(2, 2, 156, 96);
  // the bell that isn't
  ctx.strokeStyle = '#8a6f4d';
  ctx.lineWidth = 5;
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.moveTo(58, 62);
  ctx.bezierCurveTo(58, 30, 64, 16, 80, 16);
  ctx.bezierCurveTo(96, 16, 102, 30, 102, 62);
  ctx.quadraticCurveTo(108, 65, 108, 70);
  ctx.lineTo(52, 70);
  ctx.quadraticCurveTo(52, 65, 58, 62);
  ctx.stroke();
  // the button that is
  ctx.setLineDash([]);
  ctx.fillStyle = '#f2cf5b';
  ctx.strokeStyle = '#c9a02c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(80, 80, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a6f4d';
  for (const [hx, hz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    ctx.beginPath();
    ctx.arc(80 + hx, 80 + hz, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------ rovers ----
// (exported: the moon is where they go when they grow up)

export function buildRover(bodyColor = 0xdfe2e6) {
  const g = new THREE.Group();
  const body = box(0.55, 0.22, 0.75, bodyColor);
  body.position.y = 0.28;
  g.add(body);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.45), mat(0x2e3e6b, 0.5));
  panel.position.set(0, 0.42, -0.12);
  g.add(panel);
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, mat(0x2e2a26, 0.6));
    w.position.set(sx * 0.34, 0.13, sz * 0.3);
    g.add(w);
    wheels.push(w);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 5), mat(0x9aa3ad, 0.5));
  mast.position.set(0, 0.6, 0.22);
  g.add(mast);
  const headG = new THREE.Group();
  const eyeBox = box(0.16, 0.1, 0.1, 0xc8ccd2);
  headG.add(eyeBox);
  const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 }));
  eye.position.z = 0.06;
  headG.add(eye);
  headG.position.set(0, 0.82, 0.22);
  g.add(headG);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), mat(0xf2cf5b, 0.5));
  antenna.position.set(-0.18, 0.55, -0.25);
  g.add(antenna);
  g.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
  g.userData = { wheels, head: headG };
  return g;
}

// a tiny yellow hard hat, regulation issue
function hardHat() {
  const h = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0xf2cf5b, 0.6));
  dome.scale.set(1, 0.62, 1);
  h.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.05, 9), mat(0xe2bd42, 0.6));
  brim.position.y = -0.1;
  h.add(brim);
  h.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
  return h;
}

export function createIsland6(player) {
  const group = new THREE.Group();
  const updates = [];      // (dt, t, playerPos) — exterior, island zone only
  const labUpdates = [];   // (dt, t, playerPos) — interior, labs zone only
  const Y = SITES.labsYard;
  const P = SITES.labsPad;

  addIslandInfo({
    key: 'labs',
    name: '낫벨 연구소', x: -121, z: -58, r: 42, icon: '🚀',
    blurb: '서쪽 끝 연구 섬. 프런티어 화학, 방 하나만 한 컴퓨터 한 대, 로켓 부서, 그리고 로버 유치원(창문: 손을 흔들어 주세요). 지도는 섬보다 먼저 끝나요. 연구소는 이게 아주 웃기다고 생각해요.',
    folk: '스트릭스 소장 · 에이다(소프트웨어) · 헤이즐 박사 · 팟츠 · 피니언 선생님 · 로버들 · 보어링 부',
    mystery: '“먼 서쪽, 이끼 섬을 지나면, 누군가 하늘을 상대로 과학을 하고 있어. 고요한 밤이면 그 웅웅거림이 들려. 나는 제일 먼저 듣지.” —하웰, 이번에도 맞음',
  });

  // ===================================================== the facility ----
  // building center — set back three yards west of where it first stood, so
  // the North Isle causeway (which lands aiming right at this corner) comes
  // ashore onto open yard instead of into the east wall
  const fx = -129, fz = -63;
  const fy = Y.h;
  {
    const main = box(16, 5, 7, 0xe6e2d4);
    main.userData.occlude = true;
    main.position.set(fx, fy + 2.5, fz);
    main.receiveShadow = true;
    group.add(main);
    // a band of windows, lit from within (science doesn't sleep)
    for (let i = 0; i < 6; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.1),
        new THREE.MeshStandardMaterial({
          color: 0xfff3c4, emissive: 0xffe9a0, emissiveIntensity: 0.55,
          flatShading: true, roughness: 0.4,
        }));
      win.position.set(fx - 6.5 + i * 2.6, fy + 2.9, fz + 3.52);
      group.add(win);
    }
    // door, south face
    const door = box(1.8, 2.6, 0.18, 0x4a5568);
    door.position.set(fx, fy + 1.3, fz + 3.55);
    group.add(door);
    const lintel = box(2.4, 0.5, 0.3, 0xb6b1a4);
    lintel.position.set(fx, fy + 2.8, fz + 3.6);
    group.add(lintel);
    zones.addBlockerBox(fx, fz, 16, 7, 0, 0.05); // the building, exactly

    register({
      pos: new THREE.Vector3(fx, 0, fz + 4.4), r: 2.2,
      label: '낫벨 연구소에 들어가기',
      use: async () => {
        doorChime();
        await zones.go('labs');
        if (!S.hasFlag('visitedLabs')) {
          S.setFlag('visitedLabs');
          ui.toast('분필, 납땜, 그리고 야망 냄새가 나요.', '🔬');
        }
      },
    });
  }

  // -------------------------------------------------- the roof catwalk ----
  // stairs up the WEST side (the causeway owns the east approach now),
  // a railed walk across the top, a telescope at the far end.
  // "the catwalk is the best part of the facility" —management
  const ROOF_Y = fy + 5.65;
  const CATWALK_HALF_W = 1.55;
  const stairX0 = fx - 7.2;  // top of the stairs (roof's west edge)
  const stairX1 = fx - 14.2; // bottom of the stairs (ground, westward)
  zones.addCrossing({
    contains(x, z) {
      return x >= stairX1 && x <= stairX0 && Math.abs(z - fz) < CATWALK_HALF_W;
    },
    height(x) {
      const t = (x - stairX0) / (stairX1 - stairX0);
      return ROOF_Y + (fy - ROOF_Y) * t;
    },
  });
  zones.addCrossing({
    contains(x, z) {
      // (less the telescope's footing: the catwalk is a crossing, and
      // crossings beat blockers, so its footprint has to be carved out)
      return x >= stairX0 && x <= fx + 7.2 && Math.abs(z - fz) < CATWALK_HALF_W && Math.hypot(x - (fx + 6.4), z - fz) > 0.55;
    },
    height: () => ROOF_Y,
  });
  // the handrails are rails: thin walls just outside the walkway, so your
  // shoulders stop at them (the walkway itself is a crossing and wins)
  for (const sz of [-1, 1]) {
    zones.addBlockerBox((stairX1 + fx + 7.2) / 2, fz + sz * (CATWALK_HALF_W + 0.12), fx + 7.2 - stairX1, 0.24);
  }
  zones.addBlockerBox(fx + 7.35, fz, 0.24, CATWALK_HALF_W * 2 + 0.5); // and the far end
  {
    // the stair: a long inclined slab with cleats, plus rails
    const run = stairX0 - stairX1; // climbs eastward, toward the roof
    const rise = ROOF_Y - fy;
    const slab = box(Math.hypot(run, rise) + 0.4, 0.16, CATWALK_HALF_W * 2 - 0.2, 0x9aa3ad);
    slab.position.set((stairX0 + stairX1) / 2, (ROOF_Y + fy) / 2 + 0.05, fz);
    slab.rotation.z = Math.atan2(rise, run);
    slab.castShadow = slab.receiveShadow = true;
    group.add(slab);
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8;
      const cleat = box(0.18, 0.07, CATWALK_HALF_W * 2 - 0.2, 0x6b7280);
      cleat.position.set(stairX1 + t * run, fy + t * rise + 0.14, fz);
      cleat.castShadow = cleat.receiveShadow = true;
      group.add(cleat);
    }
    // the catwalk deck and rails
    const deck = box(15, 0.14, CATWALK_HALF_W * 2, 0x9aa3ad);
    deck.position.set(fx, ROOF_Y - 0.07, fz);
    deck.castShadow = deck.receiveShadow = true;
    group.add(deck);
    // support legs down onto the roof so the deck doesn't read as floating
    for (const lx of [fx - 6, fx - 3, fx, fx + 3, fx + 6]) {
      for (const lz of [fz - CATWALK_HALF_W + 0.2, fz + CATWALK_HALF_W - 0.2]) {
        const leg = box(0.13, 0.66, 0.13, 0x8a93a0);
        leg.position.set(lx, ROOF_Y - 0.44, lz);
        leg.castShadow = leg.receiveShadow = true;
        group.add(leg);
      }
    }
    for (const sz of [-1, 1]) {
      for (let i = 0; i <= 7; i++) {
        const post = box(0.08, 1.05, 0.08, 0xd9534f);
        post.position.set(fx - 7 + i * 2, ROOF_Y + 0.52, fz + sz * CATWALK_HALF_W);
        post.castShadow = post.receiveShadow = true;
        group.add(post);
      }
      const rail = box(15, 0.08, 0.08, 0xd9534f);
      rail.position.set(fx, ROOF_Y + 1.05, fz + sz * CATWALK_HALF_W);
      rail.castShadow = rail.receiveShadow = true;
      group.add(rail);
    }
    // the telescope, pointed somewhere very specific
    const scope = new THREE.Group();
    const tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.5, 1.1, 5), mat(0x55483a));
    tripod.position.y = 0.55;
    scope.add(tripod);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 8), mat(0xc9962e, 0.45));
    tube.position.y = 1.25;
    tube.rotation.x = -0.9; // up, and a little north
    scope.add(tube);
    scope.position.set(fx + 6.4, ROOF_Y, fz);
    scope.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(scope);
    register({
      pos: new THREE.Vector3(fx + 6.4, 0, fz), r: 1.8,
      label: '망원경 들여다보기',
      use: () => {
        if (isNight()) {
          // after dark the chalk chart on the railing names what you're seeing
          const CHARTED = {
            '종': '종 — 추 별이 없는 게 포인트. 대폭풍에 떨어졌다(선원들). 존재한 적 없다(천문학자들). 위원회 4대 4.',
            '갈고리': '갈고리 — 일 년 중 대부분 등대 위에 걸려 있어요. 우연이라고 위원회가 만장일치로, 너무 빨리 말했어요.',
            '단추': '단추 — 구멍 네 개, 완벽한 간격. 핍이 명명권을 주장해요. 핍에게 명명권은 없어요.',
            '늑대(여우)': '늑대 — 하웰 왈. 위원회가 그 모양을 검토한 결과 정중히 말씀드려요: 여우.',
            '큰 파르메산': '큰 파르메산 — 하늘에서 제일 밝은 치즈 바퀴. 불코가 후원을 요청했어요. 거절(아직은).',
            '랜턴': '랜턴 — 카페 위로 떠올라요. 루나는 자기가 먼저였다고 해요. 루나 말이 맞을지도 몰라요.',
          };
          const name = CONSTELLATION_NAMES[Math.floor(Math.random() * CONSTELLATION_NAMES.length)];
          ui.say(['망원경을 달 너머, 별들 사이로 돌려요.', `난간의 분필 차트: “${CHARTED[name]}”`]);
          return;
        }
        ui.say(S.hasFlag('rocketPowered')
          ? ['달, 거대하고 참을성 있게. 누군가 접안렌즈에 쪽지를 붙여 두었어요: “곧.”']
          : ['달, 거대하고 참을성 있게. 망원경 옆 난간에 분필로 위를 가리키는 화살표: “바로 저기 있잖아.”']);
      },
    });
  }

  // ------------------------------------------------------ the forecourt ----
  // benches, planters, and the flag. office-park charm, frontier edition.
  {
    for (const [bx, bz, ry] of [
      [fx - 3.4, fz + 5.6, 0.5], [fx + 3.4, fz + 5.6, -0.5], [fx - 9.5, fz + 8, Math.PI / 2],
    ]) {
      const bench = new THREE.Group();
      const seat = box(2.0, 0.12, 0.55, 0xa97c50);
      seat.position.y = 0.55;
      bench.add(seat);
      const back = box(2.0, 0.5, 0.1, 0xa97c50);
      back.position.set(0, 0.95, -0.26);
      bench.add(back);
      for (const sx of [-0.8, 0.8]) {
        const leg = box(0.12, 0.55, 0.5, 0x6b7280);
        leg.position.set(sx, 0.28, 0);
        bench.add(leg);
      }
      bench.position.set(bx, terrainHeight(bx, bz), bz);
      bench.rotation.y = ry;
      group.add(bench);
      zones.addBlocker(bx, bz, 0.8);
    }
    // planters: poured concrete, institutional; flowers: insubordinate.
    // a square around the flagpole, centered on the front door — but a
    // square somebody laid out by eye on a Friday, each bed a half-step off
    // true. the walk from the door runs straight between them, and the east
    // pair stays well clear of the causeway landing.
    for (const [px, pz, ry] of [
      [fx - 3.8, fz + 8.1, 0.07], [fx + 4.0, fz + 7.9, -0.1],
      [fx - 3.6, fz + 12.0, -0.06], [fx + 3.7, fz + 12.2, 0.12],
    ]) {
      const py = terrainHeight(px, pz);
      const tub = box(1.5, 0.55, 1.5, 0xb6b1a4);
      tub.position.set(px, py + 0.28, pz);
      tub.rotation.y = ry;
      group.add(tub);
      const soil = box(1.3, 0.1, 1.3, 0x5a4632);
      soil.position.set(px, py + 0.56, pz);
      soil.rotation.y = ry;
      group.add(soil);
      for (let f = 0; f < 5; f++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.45, 4), mat(0x3f9747));
        stem.position.set(px + rand(-0.45, 0.45), py + 0.8, pz + rand(-0.45, 0.45));
        group.add(stem);
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0),
          mat(pick([0xf2cf5b, 0xe88a8a, 0xb9a3e8, 0xf2f2e0]), 0.7));
        bloom.position.set(stem.position.x, py + 1.05, stem.position.z);
        group.add(bloom);
      }
      zones.addBlocker(px, pz, 1.0);
    }
  }

  // ----------------------------------------------------------- the flag ----
  const flagBaseX = fx, flagBaseZ = fz + 8.6;
  let flagGroup, flagCloth;
  {
    const py = terrainHeight(flagBaseX, flagBaseZ);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 8.2, 7), mat(0xd9d4c8, 0.5));
    pole.position.set(flagBaseX, py + 4.1, flagBaseZ);
    pole.castShadow = true;
    group.add(pole);
    const finial = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xf2cf5b, 0.4));
    finial.position.set(flagBaseX, py + 8.3, flagBaseZ);
    group.add(finial);
    // the little floodlight that makes regulation 4(c) legal
    const flood = box(0.42, 0.22, 0.42, 0x4a5568);
    flood.position.set(flagBaseX + 0.7, py + 0.15, flagBaseZ + 0.7);
    flood.rotation.z = 0.6; // its top face tipped toward the pole: that's the lens
    group.add(flood);
    // its lens (on the face toward the pole), and a faint beam up the pole —
    // lit after dark while the flag is flying. glow, not a light.
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xfff3d0, emissiveIntensity: 0, roughness: 0.3, side: THREE.DoubleSide });
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), lensMat);
    lens.position.set(0, 0.111, 0); // the top face, which the tilt aims at the flag (and the camera sees)
    lens.rotation.x = -Math.PI / 2;
    flood.add(lens);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const beamLen = 7.6;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.12, beamLen, 10, 1, true), beamMat);
    // from the lamp at the foot, up and in toward the cloth
    const bx0 = flagBaseX + 0.7, bz0 = flagBaseZ + 0.7, bx1 = flagBaseX + 0.9, bz1 = flagBaseZ;
    beam.position.set((bx0 + bx1) / 2, py + 0.2 + beamLen / 2, (bz0 + bz1) / 2);
    beam.lookAt(bx1, py + 7.6, bz1);
    beam.rotateX(Math.PI / 2); // its wide end up at the cloth
    group.add(beam);
    zones.addBlocker(flagBaseX, flagBaseZ, 0.5);

    flagGroup = new THREE.Group();
    flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 6, 1),
      new THREE.MeshStandardMaterial({
        map: flagTexture(), side: THREE.DoubleSide, flatShading: true, roughness: 0.9,
      }));
    flagCloth.position.x = 0.92;
    flagGroup.add(flagCloth);
    flagGroup.position.set(flagBaseX, py + 7.6, flagBaseZ);
    group.add(flagGroup);

    const plaque = box(0.9, 0.6, 0.08, 0xc9b178);
    plaque.position.set(flagBaseX - 0.9, py + 0.9, flagBaseZ);
    plaque.rotation.x = -0.3;
    group.add(plaque);
    // ...on a post, like a plaque that means it
    const plaquePost = box(0.1, 0.75, 0.1, 0x6b7280);
    plaquePost.position.set(flagBaseX - 0.9, py + 0.37, flagBaseZ - 0.08);
    group.add(plaquePost);
    const plaqueFace = letteredPlane(0.82, 0.52, [['깃발', 0.3, 0.3], ['규정', 0.66, 0.28]], '#c9b178', '#4a3f32');
    plaqueFace.position.set(0, 0, 0.045);
    plaque.add(plaqueFace);
    register({
      pos: new THREE.Vector3(flagBaseX, 0, flagBaseZ), r: 2.4,
      label: '깃발 규정 읽기',
      use: () => ui.say([
        '규정대로 번쩍이게 닦인 황동 명판:',
        '“깃발 규정. 새벽에 게양. 비가 오면 내릴 것 — 깃발은 양모이고, 파일런이 고집해요. 종의 날에는 조기로, 종을 위해서. 종이라면 이해했을 거예요.”',
        '“밤에는 우리가 만든, 우리 깃발에 관한 규정 4(c)조에 따라 조명 아래 게양해요. 깃발을 알아봐 주셔서 위원회가 감사드려요.”',
      ]),
    });

    // etiquette, checked the slow way — flags don't hurry
    let flagT = 0, floodK = 0;
    updates.push((dt, t) => {
      // the floodlight: on at night while the flag is up, faded in and out
      floodK += (((isNight() && flagGroup.visible) ? 1 : 0) - floodK) * Math.min(1, dt * 1.2);
      lensMat.emissiveIntensity = floodK * 2.4;
      beamMat.opacity = floodK * 0.07;
      beam.visible = floodK > 0.01;
      // a cloth in the wind: each strip of the plane waves a little later
      const posA = flagCloth.geometry.attributes.position;
      for (let i = 0; i < posA.count; i++) {
        const lx = posA.getX(i);
        posA.setZ(i, Math.sin(t * 3.2 + lx * 2.4) * 0.09 * (lx + 0.92));
      }
      posA.needsUpdate = true;
      flagT -= dt;
      if (flagT <= 0) {
        flagT = 3;
        const wet = currentWeather() !== 'clear';
        flagGroup.visible = !wet;
        const py = terrainHeight(flagBaseX, flagBaseZ);
        const half = HOLIDAY?.id === 'bellday';
        flagGroup.position.y = py + (half ? 4.6 : 7.6);
      }
    });
  }

  // -------------------------------------------------------- the big ear ----
  {
    const dx = Y.x - 2, dz = Y.z - 13; // north of the yard, clear of the eaves
    const dy = terrainHeight(dx, dz);
    const dish = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.2, 7), mat(0x9aa3ad, 0.6));
    pedestal.position.y = 1.1;
    dish.add(pedestal);
    const bowlG = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.5, 1.3, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe6e2d4, flatShading: true, roughness: 0.7, side: THREE.DoubleSide }));
    bowl.position.y = 0.6;
    bowlG.add(bowl);
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), mat(0x6b7280));
    feed.position.y = 1.0;
    bowlG.add(feed);
    const blinker = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({ color: 0xd9534f, emissive: 0xd9534f, emissiveIntensity: 1.2, flatShading: true }));
    blinker.position.y = 1.85;
    bowlG.add(blinker);
    bowlG.position.y = 2.3;
    bowlG.rotation.x = -0.7; // aimed up and out to sea
    dish.add(bowlG);
    dish.position.set(dx, dy, dz);
    dish.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(dish);
    zones.addBlocker(dx, dz, 2.8); // the bowl sweeps at head height — give it room
    updates.push((dt, t) => {
      dish.rotation.y = Math.sin(t * 0.05) * 1.2; // a very slow, very thorough sweep
      blinker.material.emissiveIntensity = (Math.sin(t * 2.5) > 0.4) ? 1.4 : 0.15;
    });
    register({
      pos: new THREE.Vector3(dx, 0, dz + 2.2), r: 2.2,
      label: '큰 귀에 귀 대보기',
      use: () => ui.say(pick([
        ['받침대의 명판: “종소리를 다시 듣기 위해 설립. 여전히 듣는 중. 연구는 자라났다.”'],
        ['받침대에 귀를 대요. 접시 안테나가 웅웅거려요. 그 웅웅거림 아주 아래에서, 있어도 너무 희미하게, 무언가가: …딩?', '아마 조수예요. 아마요.'],
        ['최신 기록: “03:12 — 고래 소리 들림. 무례한 고래. 그래도 기록함. 모든 데이터는 데이터다.”'],
      ])),
    });
  }

  // ------------------------------------------------------ the launch pad ----
  let rocketGlow, rocket, launch = null;
  const smoke = []; // faceted exhaust puffs at liftoff
  {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.25, 18), mat(0x8a857a, 0.95));
    ring.position.set(P.x, P.h + 0.05, P.z);
    ring.receiveShadow = true;
    group.add(ring);
    zones.addSurfaceDisc(P.x, P.z, 6.3, P.h + 0.18); // a pad you stand ON
    const scorch = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.28, 14), mat(0x44403a, 1));
    scorch.position.set(P.x, P.h + 0.07, P.z);
    group.add(scorch);

    // the rocket: white, red, and certain
    rocket = new THREE.Group();
    const bodyR = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 5.6, 10), mat(0xf2efe4, 0.7));
    bodyR.position.y = 3.4;
    rocket.add(bodyR);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.1, 0.5, 10), mat(0xd9534f, 0.7));
    band.position.y = 4.6;
    rocket.add(band);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.06, 2.1, 10), mat(0xd9534f, 0.7));
    nose.position.y = 7.25;
    rocket.add(nose);
    for (let i = 0; i < 3; i++) {
      const fin = box(0.18, 1.8, 1.3, 0xd9534f);
      const a = (i / 3) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 1.15, 1.3, Math.sin(a) * 1.15);
      fin.rotation.y = -a;
      rocket.add(fin);
    }
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 0.8, 10), mat(0x6b7280, 0.4));
    engine.position.y = 0.4;
    rocket.add(engine);
    const porthole = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 12), mat(0xc9962e, 0.45));
    porthole.position.set(0, 5.6, 1.06);
    rocket.add(porthole);
    const portglass = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10),
      new THREE.MeshStandardMaterial({ color: 0xbfe6f2, flatShading: true, roughness: 0.3 }));
    portglass.position.set(0, 5.6, 1.07);
    rocket.add(portglass);
    // the heart chamber: a small open hatch at paw height
    const hatchRim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 6, 12), mat(0xc9962e, 0.45));
    hatchRim.position.set(0, 2.0, 1.12);
    rocket.add(hatchRim);
    rocketGlow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 10),
      new THREE.MeshStandardMaterial({
        color: 0x2a2622, emissive: 0x000000, emissiveIntensity: 1, flatShading: true,
      }));
    rocketGlow.position.set(0, 2.0, 1.13);
    rocket.add(rocketGlow);
    rocket.position.set(P.x, P.h, P.z);
    rocket.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(rocket);
    zones.addBlocker(P.x, P.z, 1.9);

    // the gantry: scaffolding with opinions about safety
    const gantry = new THREE.Group();
    for (const [gx, gz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      const legG = box(0.16, 8.6, 0.16, 0xd9534f);
      legG.position.set(gx, 4.3, gz);
      gantry.add(legG);
    }
    for (let lvl = 1; lvl <= 4; lvl++) {
      for (const [w, d, rx] of [[1.4, 0.12, 0], [0.12, 1.4, 0]]) {
        const bar = box(w, 0.1, d, 0x9aa3ad);
        bar.position.y = lvl * 2;
        gantry.add(bar);
      }
    }
    const arm = box(1.6, 0.16, 0.3, 0x9aa3ad);
    arm.position.set(1.4, 5.4, 0);
    gantry.add(arm);
    const gantryLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0x000000, flatShading: true }));
    gantryLamp.position.set(0, 8.8, 0);
    gantry.add(gantryLamp);
    gantry.position.set(P.x - 3.1, P.h, P.z);
    gantry.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(gantry);
    zones.addBlocker(P.x - 3.1, P.z, 1.2);

    function powerUp() {
      rocketGlow.material.color.set(0xffd9a0);
      rocketGlow.material.emissive.set(0xffc97a);
      portglass.material.color.set(0xfff3c4);
      portglass.material.emissive = new THREE.Color(0xffe9a0);
      gantryLamp.material.emissive.set(0xffe9a0);
    }
    if (S.hasFlag('rocketPowered')) powerUp();
    updates.push((dt, t) => {
      if (S.hasFlag('rocketPowered')) {
        rocketGlow.material.emissiveIntensity = 1 + Math.sin(t * 1.6) * 0.4; // a heartbeat
      }
    });

    register({
      pos: new THREE.Vector3(P.x, 0, P.z + 2.6), r: 2.8,
      enabled: () => !launch, // no re-triggering once you've lit the candle
      label: () => S.hasFlag('rocketPowered') ? '로켓 살펴보기' : '로켓 점검하기',
      use: async () => {
        if (S.hasFlag('rocketPowered')) {
          const go = await ui.ask(
            '심장실이 꾸준히 빛나요. 겐트리 램프가 켜져 있어요. 클립보드 체크리스트는 마지막 줄만 빼고 전부 체크. 마지막 줄에는 간단히: “GO?”',
            [
              { label: '🚀 출발', value: 'go' },
              { label: '아직은', value: null },
            ]);
          if (!go) {
            ui.say('로켓은 태연하게 계속 웅웅거려요. 인내는 등대 지키기에서 가장 오래된 부분이에요.');
            return;
          }
          if (!S.hasFlag('moonHelmet')) {
            S.setFlag('moonHelmet');
            S.addItem('bubble_helmet');
            jingle();
            await ui.say([
              '헤이즐 박사가 고글을 비뚤게 쓰고 둥글고 반짝이는 뭔가를 들고 시설에서 뛰쳐나와요.',
              '“잠깐. 잠깐만. 헬멧! 헬멧이요. 망상과 특허 세 개가 붙은 어항이에요. 온종일 오후 내내 쓸 공기가 들어 있고, 모자도 안에 들어가요. 확인했어요. 모자 쓰고 확인했다고요.”',
            ], { speaker: '헤이즐 박사', voice: 700 });
            ui.toast('<b>버블 헬멧</b>을 얻었어요! 웃으면 김이 서려요. 자주 서릴 거예요.', '🫧');
          }
          liftoff(); // the rocket climbs (you're inside); narration + cut-to-moon play out in update()
          return;
        }
        const firstLook = !S.hasFlag('sawRocket');
        S.setFlag('sawRocket');
        if (S.countItem('lightseed')) {
          const place = await ui.ask(
            '심장실이 발 높이에서 보석함처럼 폭신하게 열려 있어요. 주머니 속의 빛의 씨앗이 더 크게 웅웅거려요 — 여기서 하늘이 보이는 거예요.',
            [
              { label: '🌟 빛의 씨앗 넣기', value: 'yes' },
              { label: '아직은', value: null },
            ]);
          if (place) {
            S.removeItem('lightseed');
            S.setFlag('rocketPowered');
            powerUp();
            jingle();
            await ui.say([
              '따뜻한 작은 빛을 심장실에 넣어요. 고양이가 자리 잡듯 자리를 잡아요: 완전하게, 그리고 위엄 있게.',
              '로켓 안 어딘가에서 무언가가 등대 노래를 흥얼거리기 시작해요. 겐트리 램프가 저절로 켜져요. 마당 건너편에서 안전모 세 개가 동시에 돌아봐요.',
              '그 빛은 백 년 동안 항구를 지켰어요. 이제 로켓 바닥에 앉아, 뾰족탑을 올려다보며 빛내요: 그래서? 위로 가자며.',
            ]);
            ui.toast('로켓에 심장이 생겼어요. <i>그 마음 그대로 — 달은 조금 더 기다릴 수 있어요.</i>', '🚀');
          }
          return;
        }
        await ui.say([
          '하얗고 빨갛고 참을성 있게, 자세 좋은 물음표처럼 하늘을 가리켜요.',
          '한가운데 작은 해치가 열려 있어요. 텅 비어 있고, 아래에는 황동 명판:',
          '“구함: 집으로 가는 길을 아는 빛 하나. 문의: 모든 곳. (했어요. 아직 문의 중.)”',
        ]);
        if (firstLook) {
          ui.toast('집으로 가는 길을 아는 빛… 잠들어 있는 걸 만났을지도 몰라요.', '✨');
        }
      },
    });
  }

  // ------------------------------------------------------------ the sign ----
  {
    const sx = Y.x + 2, sz = Y.z + 10.5;
    const sy = terrainHeight(sx, sz);
    const post1 = box(0.14, 1.8, 0.14, 0x6b7280);
    post1.position.set(sx - 1.6, sy + 0.9, sz);
    group.add(post1);
    const post2 = box(0.14, 1.8, 0.14, 0x6b7280);
    post2.position.set(sx + 1.6, sy + 0.9, sz);
    group.add(post2);
    const boardS = box(3.8, 1.2, 0.14, 0xf0e8d8);
    boardS.position.set(sx, sy + 1.7, sz);
    group.add(boardS);
    const face = letteredPlane(3.7, 1.1, [
      ['낫벨 연구소', 0.42, 0.42, 900],
      ['연구 진행 중 · 로버 조심', 0.8, 0.16, 700],
    ], '#f0e8d8', '#3a4a5c');
    face.position.set(sx, sy + 1.7, sz + 0.075);
    group.add(face);
    zones.addBlocker(sx, sz, 0.6);
    register({
      pos: new THREE.Vector3(sx, 0, sz + 1), r: 2.2,
      label: '표지판 읽기',
      use: () => ui.say([
        '“낫벨 연구소 — 연구 진행 중. 로버 조심. 로버도 당신을 조심해요.”',
        '그 아래 작게: “벨 연구소가 될 뻔했어요. 법률 담당 — 프리랜서 왜가리 — 이 안 된다고 했어요. 그의 편지는 액자에 걸어 두었어요. 아주 공손한 문구예요.”',
      ]),
    });
  }

  // ------------------------------------------------------------- the pier ----
  {
    // the shore that faces home: walk the bearing toward Notbell until wet
    const bearing = Math.atan2(0 - Y.x, 0 - Y.z); // toward the home island
    const bx = Math.sin(bearing), bz = Math.cos(bearing);
    let shoreT = 10;
    for (let tt = 10; tt < 36; tt += 0.5) {
      if (terrainHeight(Y.x + bx * tt, Y.z + bz * tt) < 0.18) break;
      shoreT = tt;
    }
    const sx = Y.x + bx * shoreT, sz = Y.z + bz * shoreT;
    LABS_DOCK.x = sx;
    LABS_DOCK.z = sz;
    LABS_DOCK.rotY = bearing + Math.PI; // step off facing the Labs
    const px = -bz, pz = bx;
    const LAST = 4;
    for (let i = 0; i < 5; i++) {
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
        if (t < -0.5 || t > 5.5) return false;
        return Math.abs(dx * px + dz * pz) < 1.3;
      },
      height: () => 0.64,
    });
    // the buoy, for ringing the Persistent
    const buoy = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
    base.position.y = 0.5;
    buoy.add(base);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
    top.position.y = 1.2;
    buoy.add(top);
    const bxp = sx + px * 2.6, bzp = sz + pz * 2.6;
    buoy.position.set(bxp, terrainHeight(bxp, bzp), bzp);
    buoy.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(buoy);
    zones.addBlocker(bxp, bzp, 0.55);
    LABS_DOCK.buoyPos = new THREE.Vector3(bxp, 0, bzp);
  }

  // ------------------------------------------- the causeway from the north ----
  // a long timber causeway from the North Isle, with the archipelago's first
  // telephone line walking beside it.
  // there is one telephone. it calls the other end of this bridge.
  {
    const dirX = Y.x - ISLAND3.x, dirZ = Y.z - ISLAND3.z;
    const len = Math.hypot(dirX, dirZ);
    const ux = dirX / len, uz = dirZ / len;
    // find the dry ends
    let tA = 12;
    for (let tt = 12; tt < len; tt += 0.5) {
      if (terrainHeight(ISLAND3.x + ux * tt, ISLAND3.z + uz * tt) < 0.25) { tA = tt - 1; break; }
    }
    let tB = len - 14;
    for (let tt = len - 14; tt > 0; tt -= 0.5) {
      if (terrainHeight(ISLAND3.x + ux * tt, ISLAND3.z + uz * tt) < 0.25) { tB = tt + 1; break; }
    }
    const ax = ISLAND3.x + ux * tA, az = ISLAND3.z + uz * tA;
    const bx2 = ISLAND3.x + ux * tB, bz2 = ISLAND3.z + uz * tB;
    const span = tB - tA;
    const hA = terrainHeight(ax, az) + 0.15;
    const hB = terrainHeight(bx2, bz2) + 0.15;
    const deckH = (tt) => {
      const t = (tt - tA) / span;
      return hA + (hB - hA) * t + Math.sin(t * Math.PI) * 1.1;
    };
    zones.addCrossing({
      contains(x, z) {
        const dx = x - ISLAND3.x, dz = z - ISLAND3.z;
        const t = dx * ux + dz * uz;
        if (t < tA - 0.5 || t > tB + 0.5) return false;
        return Math.abs(dx * -uz + dz * ux) < 1.4;
      },
      height(x, z) {
        const t = (x - ISLAND3.x) * ux + (z - ISLAND3.z) * uz;
        return deckH(Math.min(Math.max(t, tA), tB));
      },
    });
    zones.addLink({ // North Isle ⇄ the Labs, on foot, beside the phone line
      a: 'north', b: 'labs', kind: 'walk',
      path: [
        { x: ax - ux * 3, z: az - uz * 3 }, { x: ax, z: az },
        { x: bx2, z: bz2 }, { x: bx2 + ux * 3, z: bz2 + uz * 3 },
      ],
    });
    const sx2 = -uz, sz2 = ux; // sideways
    for (let tt = tA; tt <= tB; tt += 1.1) {
      const h = deckH(tt);
      const deckRot = Math.atan2(ux, uz);
      const wood = Math.round(tt) % 5 === 2 ? 0x96703f : 0xa97c50;
      const plank = box(3.15, 0.16, 1.05, wood);
      plank.position.set(ISLAND3.x + ux * tt, h, ISLAND3.z + uz * tt);
      plank.rotation.y = deckRot;
      plank.receiveShadow = true;
      group.add(plank);

      for (const side of [-1, 1]) {
        const beam = box(0.22, 0.2, 1.08, 0x6b4a2e);
        beam.position.set(
          ISLAND3.x + ux * tt + sx2 * side * 1.72,
          h + 0.08,
          ISLAND3.z + uz * tt + sz2 * side * 1.72);
        beam.rotation.y = deckRot;
        group.add(beam);
      }

      if (Math.round(tt - tA) % 4 === 0) {
        for (const side of [-1, 1]) {
          const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h - WATER_Y + 1.2, 6), mat(0x6b4a2e));
          pile.position.set(
            ISLAND3.x + ux * tt + sx2 * side * 1.55,
            (h + WATER_Y - 1.2) / 2,
            ISLAND3.z + uz * tt + sz2 * side * 1.55);
          group.add(pile);
        }
      }
      if (Math.round(tt - tA) % 7 === 0) {
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.05, 6), mat(0x7a5230));
          post.position.set(
            ISLAND3.x + ux * tt + sx2 * side * 1.72,
            h + 0.56,
            ISLAND3.z + uz * tt + sz2 * side * 1.72);
          post.castShadow = true;
          group.add(post);
        }
      }
    }
    // the telephone line: poles every few spans, wire sagging in between
    // (it ends at the shore; indoors the call continues by ordinary shouting)
    let prevTop = null;
    for (let tt = tA + 2; tt <= tB; tt += 7) {
      const wx = ISLAND3.x + ux * tt + sx2 * 2.1;
      const wz = ISLAND3.z + uz * tt + sz2 * 2.1;
      const baseY = deckH(tt) - 0.4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 6), mat(0x7a5230));
      pole.position.set(wx, baseY + 2.2, wz);
      pole.castShadow = true;
      group.add(pole);
      const cross = box(1.2, 0.1, 0.1, 0x7a5230);
      cross.position.set(wx, baseY + 4.0, wz);
      cross.rotation.y = Math.atan2(ux, uz) + Math.PI / 2;
      group.add(cross);
      const top = new THREE.Vector3(wx, baseY + 4.0, wz);
      if (prevTop) {
        // two slack segments per span — close enough to a catenary for wool
        const mid = prevTop.clone().lerp(top, 0.5);
        mid.y -= 0.55;
        for (const [a, b] of [[prevTop, mid], [mid, top]]) {
          const segLen = a.distanceTo(b);
          const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, segLen, 3), mat(0x3a3a3a, 0.5));
          wire.position.copy(a).lerp(b, 0.5);
          wire.lookAt(b);
          wire.rotateX(Math.PI / 2);
          group.add(wire);
        }
      }
      prevTop = top;
    }

    // the two telephone booths: one at each end, and each can only call the
    // other. Pick up at one end and, faintly, down the causeway, the other
    // one rings. Sometimes somebody's walking past it.
    const booths = [];
    const ANSWERS = [
      [{ text: '따르릉… 따르릉… 따르릉…' }, { text: '제방길 아주 저쪽에서, 아주 희미하게, 반대편 전화가 심장을 다해 울리고 있어요. 아무도 안 받아요.' }],
      [{ text: '따르릉… 따르— *딸깍*' }, { text: '“여보세요? 연구소 교환대입니다. …저쪽 부스예요. 아시죠? 저 보이잖아요. 손 흔들고 있어요.”', speaker: '지나가는 두더지', voice: 300 }],
      [{ text: '따르릉… *딸깍*' }, { text: '“…전화 맞나요? 벨이 울려서 당황했어요. 안녕하세요. 이야기하니 정말 좋네요. 안녕히 계세요.”', speaker: '지나가는 두더지', voice: 300 }],
      [{ text: '*click*' }, { text: '“낫벨 연구소, 다리 저쪽 끝에 전화 걸기 부서입니다. 고객님의 전화는 저희에게 소중합니다. 유일한 전화거든요.”', speaker: '스트릭스', voice: 420 }],
      [{ text: 'Brrring…' }, { text: '누군가 받더니 잠시 숨을 쉬고, “개구리는 괜찮아”라고 속삭이고는 끊어요.' }],
    ];
    function phoneBooth(cx, cz, face, where) {
      const b = new THREE.Group();
      const y0 = terrainHeight(cx, cz);
      const PAINT = 0x3f8a8a, TRIM = 0xf3e7c4;
      const floor = box(1.3, 0.12, 1.3, 0x8a8f86);
      floor.position.y = 0.06;
      b.add(floor);
      const body = box(1.15, 2.1, 1.15, PAINT);
      body.position.y = 1.17;
      b.add(body);
      // the glass door (front) and side windows, a little proud of the walls
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ef, roughness: 0.2, flatShading: true });
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.5, 0.04), glassMat);
      door.position.set(0, 1.12, 0.59);
      b.add(door);
      for (const sx of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 0.6), glassMat);
        win.position.set(sx * 0.59, 1.45, 0);
        b.add(win);
      }
      const handle = box(0.05, 0.3, 0.05, 0xd9b44a);
      handle.position.set(0.3, 1.1, 0.63);
      b.add(handle);
      // the sign band: TELEPHONE, front and back
      for (const [z, ry] of [[0.585, 0], [-0.585, Math.PI]]) {
        const sign = letteredPlane(1.0, 0.2, [['전화', 0.55, 0.75]], '#f3e7c4', '#2f5f5f');
        sign.position.set(0, 2.06, z + (z > 0 ? 0.005 : -0.005));
        sign.rotation.y = ry;
        b.add(sign);
      }
      // roof: a little pyramid wide enough to clear the walls, and a bell
      // on top (it's Notbell. of course the phone has a bell. it's the only
      // bell. don't tell anyone.)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.45, 4), mat(TRIM));
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 2.22 + 0.225;
      b.add(roof);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 7), mat(0xd9b44a, 0.4));
      bell.position.y = 2.78;
      b.add(bell);
      // inside, through the glass: the telephone itself
      const phone = box(0.3, 0.36, 0.14, 0x2e2e2e);
      phone.position.set(0, 1.35, -0.48);
      b.add(phone);
      b.position.set(cx, y0, cz);
      b.rotation.y = face;
      b.name = 'phone-booth';
      b.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(b);
      zones.addBlockerBox(cx, cz, 1.3, 1.3, face, 0.05);
      const booth = { b, bell, ring: 0 };
      booths.push(booth);
      register({
        getPos: () => new THREE.Vector3(cx + Math.sin(face) * 1.2, y0, cz + Math.cos(face) * 1.2), r: 1.9,
        label: '전화 걸어보기',
        use: () => {
          const other = booths.find((o) => o !== booth);
          if (other) other.ring = 4;
          tone(880, { dur: 0.25, type: 'square', vol: 0.02 });
          tone(880, { time: 0.4, dur: 0.25, type: 'square', vol: 0.02 });
          const first = !S.hasFlag('calledOtherEnd');
          S.setFlag('calledOtherEnd');
          ui.say(first
            ? [{ text: `제방길 ${{ north: '북쪽', Labs: '연구소' }[where]} 쪽 끝의 부스. 다이얼에는 번호가 하나뿐이에요. “저쪽 끝”이라고 적혀 있어요.` }, ...ANSWERS[0]]
            : pick(ANSWERS));
        },
      });
      return booth;
    }
    // a dry, clear spot near each landing, beside the wire side of the path
    function boothSpot(ex, ez, back) {
      // (roomy first — a booth wedged against somebody's cottage is no good)
      for (const room of [2.4, 1.4]) {
        for (const k of [3.2, 4.2, 5.2, 2.6, 6.2]) {
          for (const off of [3.2, -3.2, 4.2, -4.2, 2.6]) {
            const x = ex + back.x * k + sx2 * off, z = ez + back.z * k + sz2 * off;
            if (terrainHeight(x, z) > 0.45 && !zones.nearAnything(x, z, room)) return { x, z };
          }
        }
      }
      return { x: ex + back.x * 3 + sx2 * 3.2, z: ez + back.z * 3 + sz2 * 3.2 };
    }
    const nA = boothSpot(ax, az, { x: -ux, z: -uz });
    const nB = boothSpot(bx2, bz2, { x: ux, z: uz });
    // doors face the causeway mouth, so you walk off the bridge and there it is
    phoneBooth(nA.x, nA.z, Math.atan2(ax - nA.x, az - nA.z), 'north');
    phoneBooth(nB.x, nB.z, Math.atan2(bx2 - nB.x, bz2 - nB.z), 'Labs');
    updates.push((dt, t) => {
      for (const bo of booths) {
        if (bo.ring <= 0) { bo.bell.rotation.z = 0; continue; }
        bo.ring -= dt;
        bo.bell.rotation.z = Math.sin(t * 40) * 0.35 * Math.min(1, bo.ring);
      }
    });
  }

  // ------------------------------------------------- engineers, exterior ----
  // the Boring Department: they dug the foundations. they are not boring.
  const walkers = [];
  function addWalker(name, points, lines, opts = {}) {
    const mole = buildAnimal('mole', { body: opts.body ?? 0x5a4a44 });
    mole.scale.setScalar(0.95);
    // the hat sits ON the head (and bobs with it) — it used to float at the
    // body's origin, a little behind the snout
    const hat = hardHat();
    const head = mole.userData.parts?.head;
    if (head) {
      hat.position.y = 0.3;
      head.add(hat);
    } else {
      hat.position.y = 1.55;
      mole.add(hat);
    }
    mole.position.set(points[0].x, points[0].y ?? terrainHeight(points[0].x, points[0].z), points[0].z);
    group.add(mole);
    const w = { g: mole, points, seg: 0, speed: opts.speed ?? 1.3, pause: 0, fixedY: opts.fixedY };
    walkers.push(w);
    register({
      getPos: () => mole.position,
      r: 2.4,
      label: `talk to ${name}`,
      use: () => ui.say(pick(lines), { speaker: name, voice: 290 }),
    });
    return w;
  }
  addWalker('갠트리', [
    { x: fx - 6.5, z: fz, y: ROOF_Y }, { x: fx + 5.4, z: fz, y: ROOF_Y }, // (turns back before the telescope, not through it)
  ], [
    '갠트리. 보어링 부, 옥상 지부. 캣워크가 이 시설의 최고 명당이에요. 경영진도 동의해요. 경영진도 여기 올라와 있거든요.',
    '여기서는 발사대도, 바다도, 팟츠가 수프 냄비를 들고 가는지도 보여요. 중요 인프라예요, 이 전망.',
    '우리가 기초 공사를 팠다니까요. 그러더니 “위로 파라”는 거예요. 커리어를 결정한 날이었지.',
  ], { fixedY: ROOF_Y, speed: 1.0 });
  addWalker('파일런', [
    { x: Y.x + 3, z: Y.z + 4 }, { x: LABS_DOCK.x - 2, z: LABS_DOCK.z - 2 }, { x: Y.x + 7, z: Y.z - 4 },
  ], [
    '파일런. 물류. 이 섬의 모든 것은 배로 왔어요. 더 큰 배가 필요하다는 의견까지도.',
    '깃발이 양모예요. 양.모. 젖은 양모는 게양하는 게 아니에요. 내가 메모를 썼고, 그 메모가 규정이 됐어요. 인생 최고의 날이었지.',
    '상자 들어오고, 과학 나가고. 그게 일의 전부예요. 과학 쪽이 더 가벼워요. 무게가 어디로 가는지 아무도 설명을 못 해요.',
  ]);
  addWalker('도플러', [
    { x: P.x + 6.5, z: P.z + 2 }, { x: P.x + 2, z: P.z + 6.5 }, { x: P.x - 4.5, z: P.z + 3.5 }, { x: P.x - 2, z: P.z - 6.5 }, { x: P.x + 6, z: P.z - 3 }, // (round the rocket, not through it)
  ], [
    '도플러. 발사대 안전. 실험은 화요일에 해요. 화요일이 뭔지도 실험적으로 정의해요.',
    '어디든 편하게 서세요. 로켓은 꺼져 있어요. 꺼져 있는 게 제일 많이 검증된 기능이에요.',
    '얘가 올라갈 때 체크리스트는 아홉 장이에요. 아홉 번째 장에는 그냥 “손 흔들기”라고 적혀 있어요.',
  ], { speed: 1.6 });

  // Scout, the rover who graduated early (it asked)
  const scout = buildRover(0xe8e2d2);
  scout.position.set(P.x + 5, P.h, P.z + 5);
  group.add(scout);
  const scoutState = { target: null, pauseT: 0 };
  register({
    getPos: () => scout.position,
    r: 2.2,
    label: '스카우트에게 인사하기',
    use: () => {
      tone(880, { dur: 0.07, vol: 0.04 });
      tone(1180, { time: 0.09, dur: 0.07, vol: 0.04 });
      ui.say(pick([
        '(스카우트가 당신 주위를 느리고 조심스럽게 한 바퀴 돌고는, 만족스럽게 삐삐거리며 일하러 돌아가요. 그 한 바퀴는 포옹이었어요.)',
        '(스카우트가 아침 내내 패드 주변에서 굴리고 있던 조약돌을 보여 줘요. 스카우트 말로는, 아주 대단한 조약돌이래요.)',
        '(스카우트가 눈을 로켓에, 당신에게, 다시 로켓에 향해요. 삐. 서로 완벽하게 이해했어요.)',
      ]));
    },
  });

  // ========================================================== interior ----
  const B = IN;
  group.traverse((o) => {
    if (solidShadowCaster(o)) o.castShadow = true;
  });

  buildInterior();

  function buildInterior() {
    const room = new THREE.Group();
    const W = 36, D = 24; // x: 282..318, z: 1688..1712
    const wallMat = mat(0xe8e6da, 0.95);
    // institutional light, institutionally spaced (above the gantry rails)
    for (const tx of [-8, 6]) {
      const tube = makeCeilingTube(4.6);
      tube.position.set(B.x + tx, 4.4, B.z + 2);
      room.add(tube);
    }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.3, D + 0.5), mat(0xcfd2cc, 1)); // flush with the walls' outer faces
    floor.position.set(B.x, -0.15, B.z);
    floor.receiveShadow = true;
    room.add(floor);
    // walls (the south wall leaves a doorway)
    const north = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 4.6, 0.5), wallMat); // corners meet, not cross
    north.position.set(B.x, 2.3, B.z - D / 2);
    room.add(north);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, D + 0.5), wallMat);
      side.position.set(B.x + sx * W / 2, 2.3, B.z);
      room.add(side);
    }
    for (const sx of [-1, 1]) {
      const south = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 1.2, 4.6, 0.5), wallMat);
      south.position.set(B.x + sx * (W / 4 + 0.6), 2.3, B.z + D / 2);
      room.add(south);
    }
    const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.5), wallMat);
    lintel2.position.set(B.x, 3.8, B.z + D / 2);
    room.add(lintel2);

    // a non-walkable gantry over the hall, for atmosphere and one sign
    const beam = box(W - 4, 0.18, 1.4, 0x9aa3ad);
    beam.position.set(B.x, 3.4, B.z - 2);
    room.add(beam);
    for (const sx of [-12, 0, 12]) {
      const post = box(0.14, 3.4, 0.14, 0x9aa3ad);
      post.position.set(B.x + sx, 1.7, B.z - 2);
      room.add(post);
    }
    const banner = box(6, 0.9, 0.06, 0xf0e8d8);
    banner.position.set(B.x, 2.6, B.z - 1.9);
    room.add(banner);
    const bannerFace = letteredPlane(5.9, 0.82, [
      ['마지막 무계획 발견 이후 경과일:  0', 0.5, 0.42, 900],
    ], '#f0e8d8', '#b0453a');
    bannerFace.position.set(B.x, 2.6, B.z - 1.865);
    room.add(bannerFace);
    // handrails along the gantry — the inside catwalk reads as one now too
    for (const rz of [B.z - 2 - 0.62, B.z - 2 + 0.62]) {
      const grail = box(W - 4, 0.07, 0.07, 0xd9534f);
      grail.position.set(B.x, 3.95, rz);
      room.add(grail);
      for (let gx = -(W - 4) / 2 + 0.6; gx <= (W - 4) / 2 - 0.6; gx += 3.2) {
        const gpost = box(0.07, 0.5, 0.07, 0xd9534f);
        gpost.position.set(B.x + gx, 3.72, rz);
        room.add(gpost);
      }
    }
    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 1), r: 3, zone: 'labs',
      label: '현수막 읽기',
      use: () => ui.say('“마지막 계획에 없던 발견 이후 경과일: 0 — 자랑스럽게.”'),
    });

    const blockers = [
      { x: B.x, z: B.z - 2, r: 0.4 }, // gantry posts (the middle one)
    ];

    // ------------------------------------------------------- the lobby ----
    const desk = box(3.2, 1.1, 0.9, 0xa97c50);
    desk.position.set(B.x + 3.2, 0.55, B.z + 8.4);
    room.add(desk);
    blockers.push({ x: B.x + 3.2, z: B.z + 8.4, r: 1.6 });
    // Director Strix, behind the desk, fully briefed
    const strix = buildAnimal('owl', { body: 0x8a7a66, head: 0x9a8a76 });
    strix.position.set(B.x + 3.2, 0, B.z + 7.3);
    strix.rotation.y = Math.PI;
    room.add(strix);
    let strixIdx = 0;
    const STRIX_LINES = [
      '우리 벨 연구소가 될 뻔했지요. 법률 담당 — 프리랜서 왜가리 — 이 반대 의견을 냈어요. 청구서는 물고기 한(1) 마리였어요. 그 청구서를 액자에 걸었어요. 여기는 뭐든 액자에 걸어요.',
      '연구소는 종소리를 다시 듣기 위해 세워졌어요. 듣는 기계들은 계속 커졌고, 질문은 계속 넓어졌고, 어느 날 아침에는 로켓 부서가 있었지요. 연구라는 게 그래요.',
      '그건 그렇고, 그 늑대 말이 맞았어요. 저주파 현상, 안개 낀 밤에만, 발신원: 바다 밑. 지진계가 그랬어요. 걔는 일요일마다 차트를 보러 와요. 차트한테 비스킷을 갖다 줘요.',
      '자금이요? 단추예요. 빛은 필요한 곳 어디든 가야 한다고 믿었던 등대지기의 유산 기부예요. 우리는 그녀의 말을 극단적으로 문자 그대로 실천하는 중이에요.',
    ];
    register({
      pos: new THREE.Vector3(B.x + 3.2, 0, B.z + 6.8), r: 2.6, zone: 'labs',
      label: '스트릭스 소장에게 말 걸기',
      use: async () => {
        if (!S.hasFlag('metStrix')) {
          S.setFlag('metStrix');
          await ui.say([
            '책상 뒤의 올빼미가 머리를 통째로 당신에게 돌려요. 시간이 아주 절약되지요.',
            '“스트릭스 소장이야. 낫벨 연구소에 온 걸 환영해. 우리는 바다가 설명하지 못한 모든 걸 연구해. 목록은 길어. 커피는 공짜야. 로버들은 다정해. 분필 조심하고.”',
          ], { speaker: '스트릭스 소장', voice: 330 });
          return;
        }
        if (S.hasFlag('rocketPowered')) {
          ui.say('로켓이 지켜진 약속처럼 웅웅거려요. 연료 주입, 체크리스트, 그리고 나면 — 글쎄요. 달은 우리를 아주 오래 기다려 줬어요. 그 기다림에 보답할 생각이에요.',
            { speaker: '스트릭스 소장', voice: 330 });
          return;
        }
        if (S.countItem('lightseed')) {
          ui.say('그걸 갖고 다닌다고요? 웅웅거려요 — 건물 전체가 느끼고 있어요. 가요. 가요! 발사대로. 살살! 달걀처럼! 아주 중요한 달걀처럼!',
            { speaker: '스트릭스 소장', voice: 330 });
          return;
        }
        if (S.hasFlag('sawRocket')) {
          ui.say([
            '심장실 말이군요, 네. 엔진도 있고 연료도 있어요. 로켓에 필요한 건 집으로 가는 길을 아는 빛이에요 — 항해란 대부분 기억하는 거거든요.',
            '당신네 섬 아래에 하나 잠들어 있어요. 옛 항구의 등불, 반딧불 지렁이 동굴에. 물어보세요. 최악의 경우 거절당하고 친구가 생기는 거예요.',
          ], { speaker: '스트릭스 소장', voice: 330 });
          return;
        }
        ui.say(STRIX_LINES[strixIdx++ % STRIX_LINES.length], { speaker: '스트릭스 소장', voice: 330 });
      },
    });
    labUpdates.push((dt, t, playerPos) => {
      const dx = playerPos.x - strix.position.x, dz = playerPos.z - strix.position.z;
      if (Math.hypot(dx, dz) < 8) {
        strix.rotation.y = turnToward(strix.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
      animateGait(strix, t, 0, 8);
    });

    // THE WOLF WAS RIGHT (framed, dusted weekly)
    {
      const frame = box(2.2, 1.3, 0.08, 0x7a5230);
      frame.position.set(B.x + 9, 2.2, B.z + 11.6);
      room.add(frame);
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 144;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fdf6e4';
      ctx.fillRect(0, 0, 256, 144);
      ctx.strokeStyle = '#5b4a32';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 80);
      for (let x = 10; x < 246; x += 4) {
        const spike = (x > 120 && x < 150) ? Math.sin((x - 120) * 0.4) * 38 : Math.sin(x * 0.6) * 4;
        ctx.lineTo(x, 80 - spike);
      }
      ctx.stroke();
      ctx.fillStyle = '#8a3a2e';
      ctx.font = '700 17px ui-rounded, "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('그 늑대 말이 맞았다', 128, 126);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const chart = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.1),
        new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.9 }));
      chart.position.set(B.x + 9, 2.2, B.z + 11.53);
      chart.rotation.y = Math.PI;
      room.add(chart);
      register({
        pos: new THREE.Vector3(B.x + 9, 0, B.z + 10.6), r: 2.2, zone: 'labs',
        label: '액자 속 차트 살펴보기',
        use: () => ui.say([
          '대체로 잔잔한 지진계 기록지에 명백한 뾰족이 하나. 라벨: “설명되지 않는 저주파 현상. 안개 낀 밤에만. 발신원: 해수면 아래. 음향학적으로 종 모양.”',
          '그 아래, 다른 잉크로: “그 늑대 말이 맞았다.” 누군가 이 액자를 너무 자주 보러 와서 바닥이 닳아 하얘졌어요.',
        ]),
      });
    }

    // --------------------------------------------------- chemistry, west ----
    const chemSteam = [];
    for (const bz of [B.z + 1.5, B.z + 5.5]) {
      const bench = box(5.4, 1.0, 1.3, 0xd9d4c8);
      bench.position.set(B.x - 14.2, 0.5, bz);
      room.add(bench);
      blockers.push({ x: B.x - 14.2, z: bz, w: 5.4, d: 1.3 }); // (a circle left both ends walk-in)
      for (let i = 0; i < 4; i++) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1),
          new THREE.MeshStandardMaterial({
            color: pick([0x7fd4c0, 0xe88a8a, 0xb9a3e8, 0xf2cf5b]),
            transparent: true, opacity: 0.7, flatShading: true, roughness: 0.3,
          }));
        fl.position.set(B.x - 16.2 + i * 1.4, 1.18, bz + rand(-0.3, 0.3));
        room.add(fl);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 5), mat(0xd9d4c8, 0.3));
        neck.position.set(fl.position.x, 1.45, fl.position.z);
        room.add(neck);
        if (i % 2 === 0) {
          const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0),
            new THREE.MeshStandardMaterial({
              color: 0xf5f2e9, transparent: true, opacity: 0.18,
              flatShading: true, roughness: 1,
            }));
          puff.position.set(fl.position.x, 1.62, fl.position.z);
          room.add(puff);
          chemSteam.push({ m: puff, x: fl.position.x, z: fl.position.z, phase: chemSteam.length * 0.23 });
        }
      }
    }
    // bubbles: three tiny spheres on shift rotation above the benches
    const chemBubbles = [];
    for (let i = 0; i < 3; i++) {
      const bub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
        new THREE.MeshStandardMaterial({ color: 0xdef2ee, transparent: true, opacity: 0.7, flatShading: true }));
      bub.position.set(B.x - 15.5 + i * 1.4, 1.4, B.z + 1.5);
      room.add(bub);
      chemBubbles.push({ m: bub, t: i * 0.6 });
    }
    labUpdates.push((dt, t) => {
      for (const b of chemBubbles) {
        b.t += dt;
        const ph = b.t % 1.8;
        b.m.position.y = 1.4 + ph * 0.5;
        b.m.material.opacity = 0.7 * (1 - ph / 1.8);
      }
      for (const s of chemSteam) {
        const k = (s.phase + t * 0.12) % 1;
        s.m.position.set(
          s.x + Math.sin(t * 0.6 + s.phase * 11) * 0.08,
          1.55 + k * 0.8,
          s.z + Math.cos(t * 0.5 + s.phase * 9) * 0.06);
        s.m.scale.setScalar(0.45 + k * 0.85);
        s.m.material.opacity = 0.22 * Math.sin(k * Math.PI);
      }
    });
    register({
      pos: new THREE.Vector3(B.x - 13, 0, B.z + 3.5), r: 2.4, zone: 'labs',
      label: '화학 포스터 읽기',
      use: () => ui.say([
        '“보유 원소 주기율표: 열한(11) 개. 대부분 소금. 바다가 계속 소금을 기부해요.”',
        '그 아래 스티커 메모: “빛(제안된 원소) — 또 기각됨. 원소가 아니에요, 에이다. 친구라고요.”',
      ]),
    });

    // ---------------------------------------------- the computer, east ----
    const blinkLights = [];
    for (let c = 0; c < 4; c++) {
      const cab = box(2.4, 2.8, 0.8, c % 2 ? 0x3e5a5e : 0x46646a);
      cab.position.set(B.x + 10.4, 1.4, B.z - 7.8 + c * 2.9);
      cab.rotation.y = Math.PI / 2;
      room.add(cab);
      blockers.push({ x: B.x + 10.4, z: B.z - 7.8 + c * 2.9, r: 1.5 });
      for (let i = 0; i < 6; i++) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06),
          new THREE.MeshStandardMaterial({
            color: 0x222222, emissive: pick([0xffd23e, 0x7fd4c0, 0xe88a8a]),
            emissiveIntensity: 0.1, flatShading: true,
          }));
        lamp.position.set(
          B.x + 9.95,
          1.6 + Math.floor(i / 3) * 0.5,
          B.z - 8.55 + c * 2.9 + (i % 3) * 0.5);
        lamp.rotation.y = Math.PI / 2;
        room.add(lamp);
        blinkLights.push({ m: lamp, t: rand(0, 2), period: rand(0.4, 1.6) });
      }
    }
    // tape reels, turning over the night's results
    const reels = [];
    for (const rz of [B.z - 4.9, B.z + 0.9]) {
      for (const off of [-0.45, 0.45]) {
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), mat(0x2e2a26, 0.4));
        reel.rotation.x = Math.PI / 2;
        reel.rotation.z = Math.PI / 2;
        reel.position.set(B.x + 9.9, 2.1, rz + off);
        room.add(reel);
        reels.push(reel);
      }
    }
    labUpdates.push((dt, t) => {
      for (const L of blinkLights) {
        L.t += dt;
        if (L.t > L.period) {
          L.t = 0;
          L.m.material.emissiveIntensity = L.m.material.emissiveIntensity > 0.5 ? 0.1 : 1.1;
        }
      }
      for (const [i, reel] of reels.entries()) {
        reel.rotation.y += dt * (i % 2 ? 1.8 : -1.4);
      }
    });
    // the punch-card desk
    const cardDesk = box(2.6, 0.95, 1.2, 0xa97c50);
    cardDesk.position.set(B.x + 6.4, 0.48, B.z - 6);
    room.add(cardDesk);
    blockers.push({ x: B.x + 6.4, z: B.z - 6, r: 1.5 });
    for (let i = 0; i < 4; i++) {
      const stack = box(0.5, 0.06 + i * 0.02, 0.8, 0xf5f2e9);
      stack.position.set(B.x + 5.6 + i * 0.55, 1.0, B.z - 6 + rand(-0.1, 0.1));
      stack.rotation.y = rand(-0.15, 0.15);
      room.add(stack);
    }
    register({
      pos: new THREE.Vector3(B.x + 6.4, 0, B.z - 4.9), r: 2.0, zone: 'labs',
      label: '천공 카드 살펴보기',
      use: () => ui.say([
        '빳빳한 카드 더미, 하나하나 단정한 작은 구멍이 뚫려 있어요. 프로그램이에요. 구멍을 보면 알 수 있어요.',
        '맨 위 카드에 연필로 적혀 있어요: “MOON.1 — 섞지 말 것. 섞지 마시오. 섞으면 어떻게 되는지 배웠음.”',
      ]),
    });
    // Ada, software department, on top of cabinet two
    const ada = new THREE.Group();
    const abody = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(0x3a3248, 0.6));
    abody.position.y = 0.14;
    ada.add(abody);
    const ahead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(0x4a4258, 0.6));
    ahead.position.set(0, 0.12, 0.18);
    ada.add(ahead);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0),
        new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.3 }));
      eye.position.set(sx * 0.045, 0.16, 0.27);
      ada.add(eye);
    }
    for (let i = 0; i < 8; i++) {
      const sx = i < 4 ? -1 : 1;
      const k = i % 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 3), mat(0x3a3248, 0.6));
      leg.position.set(sx * 0.16, 0.06, -0.12 + k * 0.1);
      leg.rotation.z = sx * 1.1;
      ada.add(leg);
    }
    // her thread, anchored to the reel below
    const silk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 3),
      new THREE.MeshStandardMaterial({ color: 0xf5f2e9, transparent: true, opacity: 0.6 }));
    silk.position.set(0, -0.37, 0);
    ada.add(silk);
    ada.scale.setScalar(1.65);
    ada.position.set(B.x + 10.2, 2.95, B.z - 4.9);
    room.add(ada);
    let adaIdx = 0;
    const ADA_LINES = [
      '에이다. 소프트웨어 부서. 네, 전부요. 프로그램은 발로 짜요 — 코어 메모리는 그냥 주장이 아주 강한 레이스예요.',
      '컴퓨터는 방을 가득 채워요. 프로그램은 골무에 들어가요. 여기 아무도 나만큼 웃기다고 생각하지 않아요. 그들의 손해지요.',
      '시스템의 버그요? 친구. 나는 시스템의 버그를 먹어 치우는 세상에 단 하나뿐인 엔지니어예요.',
      '다리 여덟 개, 실 여덟 가닥, 건물만 한 베틀 하나. 달 프로그램은 지금까지 중 최고의 도일리예요.',
    ];
    register({
      pos: new THREE.Vector3(B.x + 9.4, 0, B.z - 4.9), r: 2.6, zone: 'labs',
      label: '에이다에게 말 걸기(위를 보세요)',
      use: () => ui.say(ADA_LINES[adaIdx++ % ADA_LINES.length], { speaker: '에이다', voice: 660 }),
    });
    labUpdates.push((dt, t) => {
      ada.position.y = 2.95 + Math.sin(t * 0.9) * 0.18;
      silk.scale.y = 1 + Math.sin(t * 0.9) * 0.22;
    });

    // ------------------------------------- the rover kindergarten, NE ----
    // glass on two sides, so the engineers can wave. the waving is
    // load-bearing, developmentally.
    const KG = { x0: B.x + 6, x1: B.x + 17, z0: B.z - 11, z1: B.z + 4 };
    {
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6f2, transparent: true, opacity: 0.22, roughness: 0.15,
        flatShading: true, side: THREE.DoubleSide,
      });
      // west glass wall (with the doorway), runs along x = KG.x0... but the
      // computer row lives at x ≈ B.x+10 — so the kindergarten is the NE
      // corner BEYOND the cabinets: glass from the cabinet row to the east wall
      const gx = B.x + 12.2; // west edge of the kindergarten
      const wallG = new THREE.Mesh(new THREE.PlaneGeometry(KG.z1 - KG.z0 - 3.2, 3.2), glassMat);
      wallG.rotation.y = Math.PI / 2;
      wallG.position.set(gx, 1.6, (KG.z0 + KG.z1) / 2 + 1.6);
      room.add(wallG);
      const wallS = new THREE.Mesh(new THREE.PlaneGeometry(KG.x1 - gx, 3.2), glassMat);
      wallS.position.set((gx + KG.x1) / 2, 1.6, KG.z1);
      room.add(wallS);
      // walkability: glass with a door gap at the north end of the west wall
      for (let z = KG.z1; z > KG.z0 + 3.4; z -= 1.2) {
        blockers.push({ x: gx, z, r: 0.7 });
      }
      for (let x = gx + 1.2; x < KG.x1; x += 1.2) {
        blockers.push({ x, z: KG.z1, r: 0.7 });
      }
      // inside: blocks, a ramp, a star mobile, a charging corner
      const blocksPos = [KG.x1 - 2, 0, KG.z0 + 2.5];
      for (const [i, c] of [0xe88a8a, 0xf2cf5b, 0x7fd4c0].entries()) {
        const blk = box(0.5, 0.5, 0.5, c);
        blk.position.set(blocksPos[0] + (i % 2) * 0.55, 0.25 + Math.floor(i / 2) * 0.52, blocksPos[2] + (i % 2 ? 0.2 : 0));
        room.add(blk);
      }
      register({
        pos: new THREE.Vector3(blocksPos[0], 0, blocksPos[2] + 1), r: 1.6, zone: 'labs',
        label: '블록 읽기',
        use: () => ui.say('알파벳 블록: “A는 아포지.” “B는 버닝.” “C는 쿠키.” 커리큘럼이 탄탄해요.'),
      });
      const ramp = box(2.2, 0.5, 1.2, 0xc9b178);
      ramp.position.set(KG.x1 - 4.5, 0.18, KG.z0 + 4);
      ramp.rotation.z = 0.22;
      room.add(ramp);
      // the star mobile
      const mobile = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xf2cf5b, 0.5));
        star.position.set(Math.cos(a) * 0.8, -0.5 - (i % 2) * 0.3, Math.sin(a) * 0.8);
        mobile.add(star);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5 + (i % 2) * 0.3, 3), mat(0xd9d4c8, 0.4));
        str.position.set(Math.cos(a) * 0.8, -0.25 - (i % 2) * 0.15, Math.sin(a) * 0.8);
        mobile.add(str);
      }
      const moonBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat(0xd9d4c8, 0.7));
      moonBall.position.y = -0.9;
      mobile.add(moonBall);
      mobile.position.set((gx + KG.x1) / 2 + 1, 3.2, (KG.z0 + KG.z1) / 2);
      room.add(mobile);
      labUpdates.push((dt, t) => { mobile.rotation.y = t * 0.25; });
      // charging corner: one rover always napping
      const matPad = box(1.6, 0.06, 1.2, 0x3e4a52);
      matPad.position.set(KG.x1 - 1.6, 0.03, KG.z1 - 1.6);
      room.add(matPad);
      const sleeper = buildRover(0xcfd8de);
      sleeper.position.set(KG.x1 - 1.6, 0, KG.z1 - 1.6);
      sleeper.rotation.y = 2.4;
      sleeper.userData.head.rotation.x = 0.5; // chin down. fast asleep.
      room.add(sleeper);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), mat(0x3a3a3a, 0.5));
      cord.position.set(KG.x1 - 0.8, 0.25, KG.z1 - 1.3);
      cord.rotation.z = 1.2;
      room.add(cord);
      register({
        pos: new THREE.Vector3(KG.x1 - 1.6, 0, KG.z1 - 2.6), r: 1.6, zone: 'labs',
        label: '자는 로버 엿보기',
        use: () => ui.say('(충전 중. 바퀴가 아주 살짝 파르르 떨려요. 피니언 선생님 말로는 얘네는 지도로 꿈을 꾼대요.)'),
      });

      // the students
      const rovers = [];
      for (let i = 0; i < 3; i++) {
        const rv = buildRover();
        rv.position.set(gx + 2 + i * 2.2, 0, KG.z0 + 3 + i * 2.6);
        room.add(rv);
        rovers.push({
          g: rv, target: null, pauseT: rand(0, 2), beeped: false,
          home: { x0: gx + 1.2, x1: KG.x1 - 2.6, z0: KG.z0 + 1.6, z1: KG.z1 - 3 },
        });
        register({
          getPos: () => rv.position,
          r: 1.8, zone: 'labs',
          label: '꼬마 로버에게 인사하기',
          use: () => {
            tone(990 + i * 120, { dur: 0.06, vol: 0.04 });
            tone(1320 + i * 120, { time: 0.08, dur: 0.06, vol: 0.04 });
            ui.say(pick([
              '(삐! 작게 한 바퀴 빙글 돌아요. 그 회전은 당신을 위한 거예요.)',
              '(삐삐 — 찾아낸 돌을 보여 줘요. 여기엔 돌이 없어요. 그래도 찾아냈어요.)',
              '(당신 발목을 아주 살짝 부딪히고는 후진해요. 로버 말로, 그건 악수예요.)',
              '(눈을 별 모빌에, 그리고 당신에게 향해요. 삐. 달이 저기 있다는 걸 알려 주고 싶은 거예요. 알고 있어요. 걔도 당신이 아는 걸 알아요. 삐.)',
            ]));
          },
        });
      }
      labUpdates.push((dt, t, playerPos) => {
        for (const r of rovers) {
          const g = r.g;
          const pd = Math.hypot(playerPos.x - g.position.x, playerPos.z - g.position.z);
          if (pd < 2.2) {
            // a visitor! stop and look (the mast does the looking)
            g.userData.head.rotation.y =
              Math.atan2(playerPos.x - g.position.x, playerPos.z - g.position.z) - g.rotation.y;
            if (!r.beeped) {
              r.beeped = true;
              tone(880, { dur: 0.05, vol: 0.03 });
            }
            continue;
          }
          r.beeped = false;
          g.userData.head.rotation.y *= 1 - Math.min(1, dt * 4);
          if (r.pauseT > 0) {
            r.pauseT -= dt;
            continue;
          }
          if (!r.target) {
            r.target = {
              x: rand(r.home.x0, r.home.x1),
              z: rand(r.home.z0, r.home.z1),
            };
          }
          const dx = r.target.x - g.position.x, dz = r.target.z - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            r.target = null;
            r.pauseT = rand(1, 4);
            continue;
          }
          const want = Math.atan2(dx, dz);
          g.rotation.y = turnToward(g.rotation.y, want, dt, 3);
          g.position.x += Math.sin(g.rotation.y) * 0.7 * dt;
          g.position.z += Math.cos(g.rotation.y) * 0.7 * dt;
          for (const w of g.userData.wheels) w.rotation.x += dt * 5;
        }
      });

      // Miss Pinion, who is a hen, which is to say: management material
      const pinion = buildAnimal('duck', { body: 0xf2e6cf, head: 0xf2e6cf });
      const comb = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xd9534f, 0.6));
        c.position.set(0, 0.42 + (i === 1 ? 0.06 : 0), 0.12 - i * 0.14);
        comb.add(c);
      }
      pinion.userData.parts.head.add(comb);
      pinion.position.set((gx + KG.x1) / 2, 0, (KG.z0 + KG.z1) / 2 - 1);
      room.add(pinion);
      blockers.push({ x: pinion.position.x, z: pinion.position.z, r: 0.5 });
      blockers.push({ x: blocksPos[0] + 0.28, z: blocksPos[2] + 0.1, w: 1.1, d: 0.75 }); // the block tower
      blockers.push({ x: KG.x1 - 1.6, z: KG.z1 - 1.6, r: 0.5 }); // the napper
      let pinionIdx = 0;
      const PINION_LINES = [
        '피니언이에요. 유아 로버 발달 담당. 도형, 낮잠, 탄도학을 그 순서로 가르쳐요. 그게 올바른 순서니까요.',
        '크면 달에 갈 수 있어요 — 원한다면요. 한 애는 도서관 카트가 되고 싶대요. 모두가 똑같이 자랑스러워요.',
        '유리는 엔지니어들이 지나가며 손을 흔들 수 있게 한 거예요. 그 손 흔들기가 구조적 지지 역할을 해요. 발달학적으로요.',
        '스카우트는 조기 졸업했어요. 본인이 요청했거든요. 요청하는 로버한테는 안 된다고 못 해요. 못 한다고요. 규정을 확인했어요.',
      ];
      register({
        getPos: () => pinion.position,
        r: 2.4, zone: 'labs',
        label: '피니언 선생님에게 말 걸기',
        use: () => {
          S.setFlag('metPinion'); // the graduates up there will want to know
          ui.say(PINION_LINES[pinionIdx++ % PINION_LINES.length], { speaker: '피니언 선생님', voice: 540 });
        },
      });
      labUpdates.push((dt, t, playerPos) => {
        const dx = playerPos.x - pinion.position.x, dz = playerPos.z - pinion.position.z;
        if (Math.hypot(dx, dz) < 5) {
          pinion.rotation.y = turnToward(pinion.rotation.y, Math.atan2(dx, dz), dt, 4);
        }
        animateGait(pinion, t, 0.12, 6); // gentle supervisory pacing-in-place
      });
    }

    // ----------------------------------------------- cafeteria, NW ----
    {
      const counter = box(4.2, 1.05, 1.0, 0xd9d4c8);
      counter.position.set(B.x - 14.6, 0.52, B.z - 9.4);
      room.add(counter);
      blockers.push({ x: B.x - 14.6, z: B.z - 9.4, r: 2.0 });
      const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 9), mat(0xc9962e, 0.4));
      urn.position.set(B.x - 13.4, 1.5, B.z - 9.4);
      room.add(urn);
      for (const [tx, tz] of [[B.x - 13.5, B.z - 5.6], [B.x - 8.5, B.z - 7.6]]) {
        const table = box(3.4, 0.95, 1.4, 0xa97c50);
        table.position.set(tx, 0.48, tz);
        room.add(table);
        blockers.push({ x: tx, z: tz, r: 2.0 });
        for (const sz of [-1, 1]) {
          const benchT = box(3.2, 0.45, 0.4, 0x96703f);
          benchT.position.set(tx, 0.22, tz + sz * 1.1);
          room.add(benchT);
        }
      }
      register({
        pos: new THREE.Vector3(B.x - 13.4, 0, B.z - 8.3), r: 1.8, zone: 'labs',
        label: '연구소 커피 따라 마시기',
        use: () => {
          sip();
          S.drinkCoffee(60);
          ui.toast('연구소 커피: 기술적으로는 커피. <b>논문에 실린</b> 기분이 들어요.', '☕');
        },
      });
      // Pots, the cook (a bear in a toque)
      const pots = buildAnimal('bear', { body: 0x6e5a44 });
      const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.5, 9), mat(0xf5f2e9, 0.9));
      toque.position.y = 0.5;
      pots.userData.parts.head.add(toque);
      pots.position.set(B.x - 14.6, 0, B.z - 8.1);
      room.add(pots);
      let potsIdx = 0;
      const POTS_LINES = [
        '팟츠. 구내식당. 스튜는 로켓 연료예요. 법적으로는 다른 로켓 연료. 앉아요. 먹어요. 발견해요.',
        '과학자들은 먹는 걸 까먹어서, 정오에 냄비를 두드려요. 여기는 뭘 울리지 않아요. 종에 대한 예의지요. 냄비는 이해해요.',
        '달이요? 나는 첫 피크닉을 기획 중이에요. 피크닉은 서두르는 게 아니에요. 수프는 서둘러도 되고요. 물리가 완전히 달라요.',
      ];
      register({
        getPos: () => pots.position,
        r: 2.6, zone: 'labs',
        label: '팟츠에게 말 걸기',
        use: () => ui.say(POTS_LINES[potsIdx++ % POTS_LINES.length], { speaker: '팟츠', voice: 300 }),
      });
      const menuFrame = box(5.0, 2.25, 0.16, 0x6b4a2e);
      menuFrame.position.set(B.x - 14.6, 2.35, B.z - 11.72);
      menuFrame.receiveShadow = true;
      room.add(menuFrame);
      const menuCv = document.createElement('canvas');
      menuCv.width = 512; menuCv.height = 256;
      const menuCtx = menuCv.getContext('2d');
      menuCtx.fillStyle = '#2e3a32';
      menuCtx.fillRect(0, 0, 512, 256);
      menuCtx.strokeStyle = '#e8e0d0';
      menuCtx.lineWidth = 8;
      menuCtx.strokeRect(14, 14, 484, 228);
      menuCtx.textAlign = 'center';
      menuCtx.textBaseline = 'middle';
      for (const [text, y, px] of [
        ["팟츠의 식당 ·", 45, 34],
        ['커피 — 언제나 공짜 ·', 96, 26],
        ['볼트 수프 — 6 ·', 137, 25],
        ['기어 로프 — 8 ·', 178, 25],
        ['(화요일: 역시 기어 로프)', 218, 21],
      ]) {
        menuCtx.font = `800 ${px}px ui-rounded, "Segoe UI", system-ui, sans-serif`;
        menuCtx.fillStyle = y === 45 ? '#f2cf5b' : '#f5f2e9';
        menuCtx.fillText(text, 256, y);
      }
      const menuTex = new THREE.CanvasTexture(menuCv);
      menuTex.colorSpace = THREE.SRGBColorSpace;
      const menuPanel = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 1.95),
        new THREE.MeshBasicMaterial({ map: menuTex }));
      menuPanel.position.set(B.x - 14.6, 2.35, B.z - 11.61);
      room.add(menuPanel);
      labUpdates.push((dt, t, playerPos) => {
        const dx = playerPos.x - pots.position.x, dz = playerPos.z - pots.position.z;
        if (Math.hypot(dx, dz) < 6) {
          pots.rotation.y = turnToward(pots.rotation.y, Math.atan2(dx, dz), dt, 4);
        }
        animateGait(pots, t, 0, 8);
      });
      // third shift, recharging
      const napper = buildAnimal('mole', { body: 0x5a4a44 });
      napper.position.set(B.x - 8.5, 0.35, B.z - 6.4);
      napper.rotation.y = Math.PI;
      napper.rotation.x = 0.85; // face gently down onto the table
      room.add(napper);
      register({
        pos: new THREE.Vector3(B.x - 8.5, 0, B.z - 5.8), r: 1.8, zone: 'labs',
        label: '엔지니어 살펴보기',
        use: () => ui.say('(3교대. 재충전 중. 냅킨에는 반쯤 푼 수식이 있고, 엔지니어에게는 완성된 낮잠이 있어요.)'),
      });
    }

    // ------------------------------------------ rocket division, SW ----
    {
      // the blackboard
      const bb = box(4.6, 2.2, 0.12, 0x2e3a32);
      bb.position.set(B.x - 17.5, 1.7, B.z + 8.5);
      bb.rotation.y = Math.PI / 2;
      room.add(bb);
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#2e3a32';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#e8e0d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(70, 80, 28, 0, Math.PI * 2); // home
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(130, 70, 90, 44, -0.3, 0, Math.PI * 1.65);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(208, 36, 12, 0, Math.PI * 2); // the moon
      ctx.stroke();
      ctx.font = '700 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#e8e0d0';
      ctx.fillText('HOME', 52, 122);
      ctx.fillText('UP?', 196, 18);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const chalk = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.0),
        new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.95 }));
      chalk.position.set(B.x - 17.42, 1.7, B.z + 8.5);
      chalk.rotation.y = Math.PI / 2;
      room.add(chalk);
      register({
        pos: new THREE.Vector3(B.x - 16.4, 0, B.z + 8.5), r: 2.2, zone: 'labs',
        label: '칠판 살펴보기',
        use: () => ui.say([
          '너무 많이 그렸다 지워서 칠판이 푹신해진 분필 궤도. 집, 긴 점선 곡선, 그리고 “위로?”라고 적힌 작은 원.',
          '구석에는 세는 표시. 수백 개. 메모: “생각을 멈추려는 시도.” 세는 표시가 획 중간에서 멈춰 있어요.',
        ]),
      });
      // blueprint table + model rocket
      const bp = box(2.8, 0.95, 1.6, 0xa97c50);
      bp.position.set(B.x - 12.8, 0.48, B.z + 8.6);
      room.add(bp);
      blockers.push({ x: B.x - 12.8, z: B.z + 8.6, r: 1.7 });
      const sheet = box(2.2, 0.04, 1.2, 0x2e3e6b);
      sheet.position.set(B.x - 12.8, 0.98, B.z + 8.6);
      room.add(sheet);
      const model = new THREE.Group();
      const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8), mat(0xf2efe4, 0.6));
      mb.position.y = 0.3;
      model.add(mb);
      const mn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), mat(0xd9534f, 0.6));
      mn.position.y = 0.72;
      model.add(mn);
      model.position.set(B.x - 12.2, 1.0, B.z + 8.3);
      room.add(model);
      // Dr. Hazel, trajectories (a mouse in goggles)
      const hazel = buildAnimal('mouse', { body: 0xb08a5a });
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 10), mat(0xc9962e, 0.4));
        lens.position.set(sx * 0.16, 0.18, 0.38);
        hazel.userData.parts.head.add(lens);
      }
      hazel.position.set(B.x - 13.5, 0, B.z + 6.6);
      room.add(hazel);
      let hazelIdx = 0;
      const HAZEL_LINES = [
        '헤이즐. 궤도학. 발사란 그저 아주 결심한 던지기예요. 그리고 나는 결심했어요.',
        '달은 매일 밤 머리 위를 지나가요. 아주 거만하게요. 우리는 답변을 준비하는 중이에요.',
        '모든 것은 다시 내려오고 싶어 해요. 요령은 정중하게, 그건 나중에 해 달라고 부탁하는 거예요.',
      ];
      register({
        getPos: () => hazel.position,
        r: 2.4, zone: 'labs',
        label: '헤이즐 박사에게 말 걸기',
        use: () => {
          if (S.hasFlag('rocketPowered')) {
            ui.say('심장실이 따뜻해요. 설마— 정말 하셨네요. 발사까지: 예의 바른 잠시. 달이 손님을 받을 준비가 되면 발사해요. 나는 고글 쓰고 자기 시작했어요.',
              { speaker: '헤이즐 박사', voice: 700 });
            return;
          }
          ui.say(HAZEL_LINES[hazelIdx++ % HAZEL_LINES.length], { speaker: '헤이즐 박사', voice: 700 });
        },
      });
      labUpdates.push((dt, t, playerPos) => {
        const dx = playerPos.x - hazel.position.x, dz = playerPos.z - hazel.position.z;
        if (Math.hypot(dx, dz) < 5) {
          hazel.rotation.y = turnToward(hazel.rotation.y, Math.atan2(dx, dz), dt, 5);
        }
        animateGait(hazel, t, 0.1, 7);
      });
    }

    room.traverse((o) => {
      if (solidShadowCaster(o)) o.castShadow = true;
    });
    group.add(room);

    zones.registerInterior('labs', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - W / 2 + 0.6, x1: B.x + W / 2 - 0.6, z0: B.z - D / 2 + 0.6, z1: B.z + D / 2 - 0.6 },
      blockers,
      spawn: { x: B.x, z: B.z + 10.6, rotY: Math.PI },
      lighting: {
        bg: 0xe6edf0, fog: 0xe6edf0, fogNear: 40, fogFar: 130,
        hemiSky: 0xffffff, hemiGround: 0x9aa6ad, hemiIntensity: 1.45,
        sunIntensity: 1.0,
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 11.4), r: 1.8, zone: 'labs',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: fx, z: fz + 5.2, rotY: 0 }),
    });
  }

  // ----------------------------------------------------- the launch ride ----
  // Tugboat-style: you ride the rocket up (player hidden — you're sealed inside),
  // the camera trails the climb as the island shrinks below, the existing
  // narration plays mid-ascent, then a fade cuts to the starry moon.
  const LAUNCH_NARRATION = [
    '“낫벨 관제에서 로켓으로. 체크리스트 아홉 번째 페이지.” 도플러의 목소리, 극도로 침착하게. 아래 어딘가에서 팟츠가 냄비를 두드려요.',
    '웅웅거림이 떨림이 되고, 떨림이 커다란 손이 되어 당신을 좌석에 부드럽게 눌러요. 창 너머로: 발사대, 마당, 깃발 — 작아지고, 작아지고, 우표 한 장만 한 나라.',
    '파랑이 옅어지고, 옅음이 새까매져요. 빛의 씨앗이 올라가는 내내 노래해요 — 등대가 지키던 그 네 음을 — 그리고 바다는, 태어나 처음으로, 당신이 없는 곳에 있어요.',
    '그리고 창 아래로, 전부가 한꺼번에: 화산이 만들어낸 모든 섬이, 코트의 단추처럼 물 위에 줄지어 있어요.',
  ];
  function puffSmoke(n = 6) {
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.4, 0.95), 0),
        new THREE.MeshStandardMaterial({ color: 0xd8d3c8, flatShading: true, roughness: 1, transparent: true, opacity: 0.85 }));
      const a = rand(0, Math.PI * 2), rad = rand(0.4, 2.6);
      p.position.set(P.x + Math.cos(a) * rad, P.h + 0.4 + rand(0, 0.6), P.z + Math.sin(a) * rad);
      p.userData.vel = { x: Math.cos(a) * rand(0.5, 1.5), y: rand(0.4, 1.0), z: Math.sin(a) * rand(0.5, 1.5) };
      group.add(p);
      smoke.push(p);
    }
  }
  function ageSmoke(dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.position.x += p.userData.vel.x * dt;
      p.position.y += p.userData.vel.y * dt;
      p.position.z += p.userData.vel.z * dt;
      p.scale.multiplyScalar(1 + dt * 0.8); // billow out
      p.material.opacity -= dt * 0.5;        // ~1.7s life
      if (p.material.opacity <= 0) {
        group.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        smoke.splice(i, 1);
      }
    }
  }
  function liftoff() {
    tone(60, { dur: 1.6, type: 'sawtooth', vol: 0.07 });
    tone(48, { time: 0.8, dur: 2.2, type: 'sawtooth', vol: 0.08 });
    player.riding = true;          // the rocket flies; you sit tight (player.js honors riding)
    player.group.visible = false;  // sealed inside — we watch the rocket itself rise
    puffSmoke(8);
    launch = { t: 0, vy: 0, fired: false, phase: 'rise' };
  }
  function emitExhaust() {
    // the volcano's smoke, inverted: emitted at the engine, trailing DOWN as we climb
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.8), 0),
      new THREE.MeshStandardMaterial({ color: 0xd8d2cc, flatShading: true, roughness: 1, transparent: true, opacity: 0.75 }));
    p.position.set(rocket.position.x + rand(-0.3, 0.3), rocket.position.y + 0.3, rocket.position.z + rand(-0.3, 0.3));
    p.userData.vel = { x: rand(-0.6, 0.6), y: rand(-2.5, -1.0), z: rand(-0.6, 0.6) };
    group.add(p);
    smoke.push(p);
  }
  function advanceLaunch(dt, t) {
    const L = launch;
    if (L.phase === 'gone') return; // mid-fade; hold until zones.go lands us on the moon
    L.t += dt;
    L.vy = Math.min(L.vy + 9 * dt, 24);
    if (rocket.position.y > P.h + 85) L.vy *= 0.95; // ease into a hover near the top of the sky
    rocket.position.y += L.vy * dt;
    rocket.position.x = P.x + Math.sin(t * 46) * 0.06 * Math.max(0, 1 - L.t * 0.6); // ignition shimmy, fades
    player.group.position.set(rocket.position.x, rocket.position.y + 3, rocket.position.z); // camera trails this
    if (L.t < 1.1 && Math.sin(t * 28) > 0.9) puffSmoke(2); // kicked-up ground cloud at liftoff
    if (L.vy > 4) { // continuous exhaust plume while climbing
      L.emitT = (L.emitT || 0) - dt;
      while (L.emitT <= 0) { emitExhaust(); L.emitT += 0.06; }
    }
    // climb out of the sky → starry space (begins ~+28, full near apex ~+74)
    const k = Math.max(0, Math.min(1, (rocket.position.y - P.h - 28) / 46));
    setSpaceFade(k);
    setLaunchNight(k);
    if (!L.fired && L.t > 1.3) { L.fired = true; ui.say(LAUNCH_NARRATION); }
    if (L.fired && !ui.isBusy() && rocket.position.y > P.h + 72) {
      L.phase = 'gone';
      ui.fadeSwap(async () => {
        await zones.go('moon');
        rocket.position.set(P.x, P.h, P.z); // reset the pad for next time
        player.group.visible = true;
        player.riding = false;
        setSpaceFade(0);
        setLaunchNight(0);
        launch = null;
      });
      ui.toast('착지 신호. 먼지가 공손하게 당신을 받아들여요.', '🌑');
    }
  }

  // ============================================================ update ----
  function update(dt, t, playerPos) {
    if (smoke.length) ageSmoke(dt);                // liftoff puffs linger, then clear
    if (launch) { advanceLaunch(dt, t); return; }  // during the launch, nothing else matters
    const zone = zones.current();
    if (zone === 'island') {
      // only spend effort when the labs are anywhere near the frame
      if (Math.hypot(playerPos.x - ISLAND6.x, playerPos.z - ISLAND6.z) < ISLAND6.r + 130) {
        for (const u of updates) u(dt, t, playerPos);
        for (const w of walkers) {
          // a visitor! stop, turn, give them a couple of seconds to say
          // something — then carry on (and never, ever walk THROUGH them)
          const pdx = playerPos.x - w.g.position.x, pdz = playerPos.z - w.g.position.z;
          const pd = Math.hypot(pdx, pdz);
          const sameLevel = Math.abs(playerPos.y - w.g.position.y) < 1.5;
          if (pd > 4) w.greeted = false;
          if (sameLevel && pd < 2.6 && !w.greeted) { w.greeted = true; w.greet = 2.5; }
          if (w.greet > 0) {
            w.greet -= dt;
            w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(pdx, pdz), dt, 6);
            animateGait(w.g, t, 0, 8);
            continue;
          }
          if (w.pause > 0) { w.pause -= dt; animateGait(w.g, t, 0, 8); continue; }
          const target = w.points[(w.seg + 1) % w.points.length];
          const dx = target.x - w.g.position.x, dz = target.z - w.g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.4) {
            w.seg = (w.seg + 1) % w.points.length;
            w.pause = rand(0.5, 2.5);
            continue;
          }
          w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dx, dz), dt, 5);
          const nx = w.g.position.x + (dx / dist) * w.speed * dt;
          const nz = w.g.position.z + (dz / dist) * w.speed * dt;
          if (sameLevel && Math.hypot(playerPos.x - nx, playerPos.z - nz) < 1.0 && Math.hypot(playerPos.x - nx, playerPos.z - nz) < pd) {
            animateGait(w.g, t, 0, 8); // you're in the way; he waits, politely
            continue;
          }
          w.g.position.x = nx;
          w.g.position.z = nz;
          w.g.position.y = w.fixedY ?? terrainHeight(w.g.position.x, w.g.position.z);
          animateGait(w.g, t, 1, 9);
        }
        // Scout patrols the pad apron, conscientiously
        if (scoutState.pauseT > 0) {
          scoutState.pauseT -= dt;
        } else {
          if (!scoutState.target) {
            const a = rand(0, Math.PI * 2);
            scoutState.target = { x: P.x + Math.cos(a) * rand(4.5, 7), z: P.z + Math.sin(a) * rand(4.5, 7) };
          }
          const dx = scoutState.target.x - scout.position.x, dz = scoutState.target.z - scout.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            scoutState.target = null;
            scoutState.pauseT = rand(1.5, 5);
          } else {
            scout.rotation.y = turnToward(scout.rotation.y, Math.atan2(dx, dz), dt, 3);
            scout.position.x += Math.sin(scout.rotation.y) * 0.85 * dt;
            scout.position.z += Math.cos(scout.rotation.y) * 0.85 * dt;
            scout.position.y = terrainHeight(scout.position.x, scout.position.z);
            for (const w of scout.userData.wheels) w.rotation.x += dt * 5;
          }
        }
      }
    } else if (zone === 'labs') {
      for (const u of labUpdates) u(dt, t, playerPos);
    }
  }

  return { group, update };
        }
