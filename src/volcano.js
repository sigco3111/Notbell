// The volcano. She made all three islands, long ago, and then she retired.
// She smokes sometimes, the way old engines tick as they cool. She has
// never hurt anyone and isn't going to start for you.

import * as THREE from 'three';
import { VOLCANO, VOLCANO_SHELF, SITES, WATER_Y, terrainHeight } from './terrain.js';
import { makeCampfire } from './campfire.js';
import { register } from './interact.js';
import * as zones from './zones.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { isNight } from './calendar.js';
import { sip } from './audio.js';
import { rand, pick } from './utils.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

export function createVolcano() {
  const group = new THREE.Group();
  const updates = [];
  const V = VOLCANO;
  const craterY = terrainHeight(V.x, V.z); // the sunken crater floor

  // the heart: a warm glow in the crater, breathing very slowly
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 12),
    new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0.85 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(V.x, craterY + 0.15, V.z);
  group.add(glow);
  // ...and the lava shows from outside now: a warm halo hanging over the
  // crater (a little by day, properly at night) and embers drifting up
  const haloCv = document.createElement('canvas');
  haloCv.width = haloCv.height = 64;
  {
    const c = haloCv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,160,90,0.8)');
    g.addColorStop(0.3, 'rgba(255,120,60,0.45)');
    g.addColorStop(0.65, 'rgba(255,95,45,0.14)');
    g.addColorStop(1, 'rgba(255,80,40,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  // not one orb but a haze: a broad low glow sitting in the crater mouth,
  // a wider, fainter bloom above it, and the faintest wash up into the smoke
  const haloTex = new THREE.CanvasTexture(haloCv);
  const halos = [
    [22, 7, 3.5, 0.5], [34, 14, 7, 0.32], [44, 26, 13, 0.16],
  ].map(([w, h, y, k]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, transparent: true, opacity: 0.2,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xff7a44,
    }));
    sp.scale.set(w, h, 1);
    sp.position.set(V.x, craterY + y, V.z);
    sp.renderOrder = 5; // after the sky and its horizon haze, or they paint over it
    sp.userData.k = k;
    group.add(sp);
    return sp;
  });
  // two lazy lava runnels spilling over the rim, down the slope a little way
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a });
  for (const [ang, len] of [[0.5, 5.5], [2.6, 4]]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const d = 2.8 + (i / 6) * len;
      const a = ang + Math.sin(i * 1.7) * 0.06;
      const x = V.x + Math.cos(a) * d, z = V.z + Math.sin(a) * d;
      pts.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.05, z));
    }
    const runnel = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.22, 4), lavaMat);
    group.add(runnel);
  }
  const embers = [];
  for (let i = 0; i < 10; i++) {
    const e = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffa04a, transparent: true }));
    e.userData = { t: Math.random() * 4, x: Math.random() * 3.6 - 1.8, z: Math.random() * 3.6 - 1.8 };
    group.add(e);
    embers.push(e);
  }
  updates.push((dt, t) => {
    const night = isNight() ? 1 : 0;
    for (const sp of halos) {
      sp.material.opacity = sp.userData.k * (0.35 + night * 0.65 + Math.sin(t * 0.7) * 0.08);
    }
    glow.material.opacity = 0.75 + Math.sin(t * 1.3) * 0.15;
    for (const e of embers) {
      const u = e.userData;
      u.t += dt;
      if (u.t > 4) { u.t = 0; u.x = Math.random() * 3.6 - 1.8; u.z = Math.random() * 3.6 - 1.8; }
      e.position.set(V.x + u.x + Math.sin(u.t * 2) * 0.3, craterY + 1 + u.t * 3, V.z + u.z);
      e.material.opacity = Math.max(0, 1 - u.t / 4);
    }
  });
  const emberLight = new THREE.PointLight(0xff8a4c, 60, 24, 2);
  emberLight.position.set(V.x, craterY + 2, V.z);
  group.add(emberLight);
  // a few cooled boulders around the rim
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const rx = V.x + Math.cos(a) * rand(4.5, 6);
    const rz = V.z + Math.sin(a) * rand(4.5, 6);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.5, 1.0), 0), mat(0x4a4440));
    rock.position.set(rx, terrainHeight(rx, rz) + 0.3, rz);
    rock.castShadow = true;
    group.add(rock);
    zones.addBlocker(rx, rz, rock.geometry.parameters.radius * 0.85, 'tree');
  }

  // she smokes sometimes. it means she's comfortable.
  const puffs = [];
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0),
      new THREE.MeshStandardMaterial({
        color: 0xd8d2cc, transparent: true, opacity: 0, roughness: 1, flatShading: true,
      }));
    puff.visible = false;
    puffs.push(puff);
    group.add(puff);
  }
  let smokeTimer = rand(10, 25);
  let smoking = 0;
  updates.push((dt, t) => {
    glow.material.opacity = 0.7 + Math.sin(t * 0.5) * 0.18;
    emberLight.intensity = 55 + Math.sin(t * 0.5) * 14;
    smokeTimer -= dt;
    if (smokeTimer <= 0 && smoking <= 0) {
      smoking = rand(8, 16); // a comfortable little smoke
      smokeTimer = rand(25, 70);
      puffs.forEach((p, i) => { p.userData.k = -i * 0.18; p.visible = true; });
    }
    if (smoking > 0) {
      smoking -= dt;
      for (const p of puffs) {
        p.userData.k += dt * 0.22;
        const k = p.userData.k;
        if (k < 0) continue;
        const kk = k % 1;
        p.position.set(
          V.x + Math.sin(t * 0.6 + k * 9) * (1 + kk * 2),
          craterY + 2 + kk * 9,
          V.z + Math.cos(t * 0.5 + k * 7) * (1 + kk * 1.5)
        );
        p.scale.setScalar(0.8 + kk * 2.6);
        p.material.opacity = (smoking > 2 ? 0.5 : 0.5 * (smoking / 2)) * (1 - kk * 0.7);
      }
    } else {
      for (const p of puffs) p.visible = false;
    }
  });

  // ------------------------------------------------------- the shelf fire ----
  // on the black-sand shelf west of the bar: a driftwood fire Cinder keeps
  // for the evenings (the sun can't do everything, she concedes, grudgingly).
  // Two flat warm stones to sit on; nobody walks through it.
  {
    const fx = VOLCANO_SHELF.x + 2.2, fz = VOLCANO_SHELF.z + 1.6;
    const fire = makeCampfire(fx, fz, { scale: 1 });
    group.add(fire.group);
    updates.push((dt, t) => fire.update(dt, t));
    zones.addBlocker(fx, fz, 1.3);
    for (const [dx, dz] of [[-1.9, 1.1], [1.6, 1.7]]) {
      const x = fx + dx, z = fz + dz;
      const seat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x5e5854, 0.95));
      seat.scale.set(1.2, 0.35, 1);
      seat.position.set(x, terrainHeight(x, z) + 0.1, z);
      seat.castShadow = seat.receiveShadow = true;
      group.add(seat);
    }
    register({
      pos: new THREE.Vector3(fx, 0, fz + 1.8), r: 2,
      label: '모닥불에 발 녹이기',
      use: () => ui.say('불이 탁 소리를 내며 가라앉아요. 유목 냄새와, 희미하게, 산 냄새가 나요. 등 뒤 어딘가에서 신더가 한쪽 눈을 떠서 당신이 제대로 감상하는지 확인해요.'),
    });
  }

  // ------------------------------------------------- Cinder the iguana ----
  const cinder = buildAnimal('salamander', { body: 0x7a8a6a, head: 0x7a8a6a });
  cinder.scale.setScalar(1.25);
  // iguana upgrades: a row of spikes and a skeptical brow
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), mat(0x55613b, 0.7));
    spike.position.set(0, 0.62 - i * 0.04, 0.35 - i * 0.3);
    spike.rotation.x = -0.3;
    cinder.add(spike);
  }
  // her spot: a great flat basking rock on the black-sand shelf, in full sun
  const VB = SITES.vbeach;
  const baskX = VB.x - 2.5, baskZ = VB.z + 1;
  const baskY = terrainHeight(baskX, baskZ);
  const landWaypoint = (dx, dz) => {
    const x = baskX + dx, z = baskZ + dz;
    return terrainHeight(x, z) > WATER_Y ? { x, z } : null;
  };
  const cinderWaypoints = [
    { x: baskX, z: baskZ },
    landWaypoint(2.3, -2.1),
    landWaypoint(4.1, 0.7),
    landWaypoint(0.8, 3.3),
  ].filter(Boolean);
  const cinderRoute = cinderWaypoints.length > 1
    ? cinderWaypoints.flatMap((_, i) => (i === 0 ? [] : [i, 0]))
    : [0];
  const baskRock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat(0x5e5854, 0.95));
  baskRock.scale.set(1.3, 0.28, 1.0);
  baskRock.position.set(baskX, baskY + 0.25, baskZ);
  baskRock.castShadow = true;
  group.add(baskRock);
  // a warm flat rock you can step up onto (Cinder won't mind. much.)
  zones.addSurface({
    contains: (x, z) => ((x - baskX) / 1.8) ** 2 + ((z - baskZ) / 1.4) ** 2 < 1,
    height: () => baskY + 0.6,
  });
  cinder.position.set(baskX, baskY + 0.55, baskZ);
  cinder.rotation.y = Math.atan2(0 - baskX, 0 - baskZ); // faces the home islands, eyes half shut
  group.add(cinder);

  // a frond lean-to, in case the sun ever overdoes it (it hasn't yet)
  const leanTo = new THREE.Group();
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6), mat(0x8a6f4d));
    pole.position.set(sx * 1.3, 1.1, 0);
    leanTo.add(pole);
  }
  const backPoleL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 6), mat(0x8a6f4d));
  backPoleL.position.set(-1.3, 0.6, -1.6);
  const backPoleR = backPoleL.clone();
  backPoleR.position.x = 1.3;
  leanTo.add(backPoleL, backPoleR);
  for (let i = 0; i < 5; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), mat(0x55772f, 0.9));
    frond.scale.z = 0.18;
    frond.position.set(-1.2 + i * 0.6, 1.75, -0.8);
    frond.rotation.x = Math.PI / 2 + 0.5;
    leanTo.add(frond);
  }
  leanTo.position.set(VB.x + 3, terrainHeight(VB.x + 3, VB.z - 1), VB.z - 1);
  leanTo.rotation.y = 0.4;
  leanTo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(leanTo);

  // ------------------------------------------------------ the tiki bar ----
  const bar = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 0.8), mat(0xa97c50));
  counter.position.y = 0.5;
  bar.add(counter);
  const thatchPoles = [-1.2, 1.2].map((sx) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), mat(0x8a6f4d));
    pole.position.set(sx, 1.2, 0);
    bar.add(pole);
    return pole;
  });
  void thatchPoles;
  const thatch = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.0, 7), mat(0xc9a972, 0.95));
  thatch.position.y = 2.8;
  bar.add(thatch);
  for (const sx of [-1.7, 1.7]) {
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5), mat(0x6b4a2e));
    torch.position.set(sx, 0.7, 0.9);
    bar.add(torch);
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    flame.position.set(sx, 1.5, 0.9);
    flame.userData.flicker = true;
    bar.add(flame);
    updates.push((dt, t) => {
      flame.scale.setScalar(0.85 + Math.sin(t * 9 + sx) * 0.2);
    });
  }
  for (let i = 0; i < 2; i++) {
    const coconut = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0x6b4a2e, 0.7));
    coconut.position.set(-0.5 + i, 1.12, 0.1);
    bar.add(coconut);
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 6), mat(pick([0xff6b81, 0xffd23e]), 0.6));
    umbrella.position.set(-0.5 + i + 0.06, 1.3, 0.1);
    bar.add(umbrella);
  }
  const barSign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), mat(0xe8d49a, 0.7));
  barSign.position.set(0, 1.9, 0.6);
  bar.add(barSign);
  bar.position.set(VB.x + 0.5, terrainHeight(VB.x + 0.5, VB.z + 3.5), VB.z + 3.5);
  bar.rotation.y = Math.PI; // counter faces the sea
  bar.traverse((o) => { if (o.isMesh && !o.userData.flicker) o.castShadow = true; });
  group.add(bar);
  zones.addBlockerBox(bar.position.x, bar.position.z, 2.9, 0.9, Math.PI, 0.05);

  register({
    pos: new THREE.Vector3(VB.x + 0.5, 0, VB.z + 4.6), r: 2.4,
    label: '양심 바 구경하기',
    use: async () => {
      const choice = await ui.ask(
        '유목 간판: “라바뷰 바. 직원 없음. 코코 피즈 15단추. 항아리가 당신을 믿어요.”', [
          { label: '🥥 코코 피즈', value: 'fizz', hint: '15🔘', disabled: S.state.buttons < 15 },
          { label: '그냥 항아리 감상하기', value: 'jar' },
          { label: '나가기', value: null },
        ]);
      if (choice === 'fizz') {
        S.spend(15);
        S.drinkCoffee(20);
        sip();
        ui.updateHUD();
        ui.toast('차갑고 톡 쏘고, 여름 맛이 살짝 나요. 항아리가 딸랑 소리로 감사해요.', '🥥');
      } else if (choice === 'jar') {
        ui.say('단추가 반쯤 담긴 피클 항아리. 누군가 잎사귀에 쓴 차용증을 넣어 뒀고, 다른 누군가가 그 차용증을 갚았어요. 시스템이 작동해요.');
      }
    },
  });
  let cinderRouteStep = 0;
  let cinderPause = 4.5;
  updates.push((dt, t) => {
    if (isNight()) {
      const ease = Math.min(1, dt * 1.4);
      cinder.position.x += (baskX - cinder.position.x) * ease;
      cinder.position.z += (baskZ - cinder.position.z) * ease;
      if (Math.hypot(cinder.position.x - baskX, cinder.position.z - baskZ) < 0.03) {
        cinder.position.x = baskX;
        cinder.position.z = baskZ;
      }
      cinder.position.y = terrainHeight(cinder.position.x, cinder.position.z) + 0.45;
      cinder.rotation.y = Math.atan2(0 - cinder.position.x, 0 - cinder.position.z);
      cinderRouteStep = 0;
      cinderPause = 4.5;
      animateGait(cinder, t, 0);
      return;
    }

    if (cinderPause > 0) {
      cinderPause -= dt;
      cinder.position.y = zones.islandGroundHeight(cinder.position.x, cinder.position.z); // (on the sand, not 0.55 over it)
      animateGait(cinder, t, 0);
      return;
    }

    const target = cinderWaypoints[cinderRoute[cinderRouteStep]];
    const dx = target.x - cinder.position.x, dz = target.z - cinder.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      cinder.position.x = target.x;
      cinder.position.z = target.z;
      cinder.position.y = zones.islandGroundHeight(target.x, target.z);
      cinderPause = cinderRoute[cinderRouteStep] === 0 ? 5.5 : 2.4;
      cinderRouteStep = (cinderRouteStep + 1) % cinderRoute.length;
      animateGait(cinder, t, 0);
      return;
    }

    const step = Math.min(dist, dt * 1.2);
    cinder.rotation.y = Math.atan2(dx, dz);
    cinder.position.x += (dx / dist) * step;
    cinder.position.z += (dz / dist) * step;
    cinder.position.y = zones.islandGroundHeight(cinder.position.x, cinder.position.z); // (on the sand, not 0.55 over it)
    animateGait(cinder, t, 1);
  });

  const CINDER_LINES = [
    '안녕하세여. 신더. 주민. 화산학자. 주로 “주민” 쪽이에요.',
    '그분이 섬 세 개를 다 만드셨어요, 아시나요. 하나씩 밀어 올리시고 은퇴하셨어요. 완성된 작품 활동은 존중하는 게 예의예요.',
    '사람들이 물어요. “신더야, 안전해?” 이봐요. 그분은 해저에서 섬 셋을 올리신 분이에요. 당신 상대할 시간이 있을 것 같아요?',
    '연기는 그분이 편안하시다는 뜻이에요. 고양이 그르렁 같은 거죠, 고양이가 산이라면요.',
    '군도에서 가장 따뜻한 바위들이에요. 순번이 있어요. 지금은 네 번째 바위. 좋은 바위예요.',
  ];
  let cinderIdx = 0;
  register({
    getPos: () => cinder.position,
    r: 3,
    label: '신더와 대화하기',
    use: () => {
      if (!S.hasFlag('metCinder')) {
        S.setFlag('metCinder');
        ui.say([
          '식은 용암 색깔의 이구아나가 한쪽 눈을 떠요. 바위에 착 붙은 자세에서 수백 년의 연습이 느껴져요.',
          '“손님들! 배까지 타고 오셨네. 산에 온 걸 환영해. 발 닦고 들어와. 농담이야. 여긴 전부 재니까.”',
        ], { speaker: 'Cinder', voice: 460 });
        return;
      }
      ui.say(CINDER_LINES[cinderIdx++ % CINDER_LINES.length], { speaker: 'Cinder', voice: 460 });
    },
  });

  // the rim plaque — the Listeners get everywhere
  register({
    pos: new THREE.Vector3(V.x - 5, 0, V.z + 3), r: 2.6,
    label: '가장자리 표지 읽기',
    use: () => ui.say([
      '불에 구운 듯한 납작한 돌, 깊게 새겨져 있어요:',
      '“그분이 섬들을 만드셨다. 등대가 서 있던 절벽도 그분이 만드셨다. 빛이 지금 잠든 동굴도 그분이 만드셨다. 예의를 갖춰라.” —듣는 이들',
    ]),
  });

  function update(dt, t) {
    for (const u of updates) u(dt, t);
  }

  return { group, update };
}
