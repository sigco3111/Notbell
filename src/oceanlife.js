// The sea has residents too: friendly fins that patrol the strait, and —
// far out, where the water turns deep — whales that crest and blow.

import * as THREE from 'three';
import {
  WATER_Y, ISLAND_RADIUS, ISLAND2, ISLAND2_EAST, ISLAND3, ISLAND4, ISLAND5, ISLAND5_SOUTH,
  ISLAND5_HAND, ISLAND6, ISLAND6_WEST, ISLAND6_BEACH, ISLAND7, ISLAND7_FLATS, ISLAND7_BACK, ISLAND7_NECK, ISLAND8, ISLAND9, ISLET_CH, TEXAS, VOLCANO, VOLCANO_SHELF, terrainHeight,
} from './terrain.js';
import { splash } from './audio.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import { rand, pick } from './utils.js';

// the bright water: a coral shelf roughly between the islands and the mountain
export const REEF = { x: 58, z: -72, r: 16 };

const LAND = [
  { x: 0, z: 0, r: ISLAND_RADIUS },
  ISLAND2,
  ISLAND2_EAST,
  ISLAND3,
  ISLAND4,
  ISLAND5,
  ISLAND5_SOUTH,
  ...ISLAND5_HAND,
  ISLAND6,
  ISLAND6_WEST,
  { ...ISLAND6_BEACH, r: 16 },
  ISLAND7,
  ISLAND7_FLATS,
  ISLAND7_BACK,
  ISLAND7_NECK,
  ISLAND8,
  ISLAND9,
  ISLET_CH,
  TEXAS,
  VOLCANO,
  VOLCANO_SHELF,
];

function mat(color, rough = 0.6) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

export function createOceanLife() {
  const group = new THREE.Group();

  // ------------------------------------------------------------ sharks ----
  // they are FRIENDLY. they have a lot of teeth and zero plans for them.
  const sharks = [];
  const heartTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.font = '96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💛', 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  // each fin has a name, a patch, and things to say to anyone who swims or
  // rows close enough to hear. (they get the teeth question a lot.)
  const orbits = [
    { cx: 50, cz: -16, r: 13, name: '검이', body: 0x8fb3cc, lines: [
      '오! 안녕! 이빨은 신경 쓰지 마. 많거든. 하나하나 다 닦아. 아침이 다 가.',
      '나는 해협 순찰대야! 아무 일도 안 일어나. 여기 정말 좋아.',
      '한번은 부두에서 누가 샌드위치 반 개를 떨어뜨렸어. 돌려줬지. 비명을 지르길래, 고맙다는 비명인 것 같았어.',
      '상어 이빨은 평생 자라는 거 알아? 생각 안 하려고 해. 이빨이 너무 많아서.',
    ] },
    { cx: -30, cz: 40, r: 16, name: '도리스 아주머니', body: 0x9aa8c4, lines: [
      '안녕, 얘야. 간식도 없이 너무 멀리 헤엄치고 있네. 자 — 아, 손이 없구나. 비스킷 하나 줬다고 상상해 봐.',
      '40년째 이 바다를 빙빙 돌고 있어. 빙글빙글. 돌다 보면 뭐가 보이는지 놀랄 걸.',
      '오리들한테 안부 전해 줘. 얘네는 수다를 안 떨고 가. 다들 왜 그리 바쁜지.',
      '뜨개질을 할 수 있다면 하고 싶어. 등대지기에게 따뜻한 걸. 그분은 항상 늦게까지 깨 있더라고.',
    ] },
    { cx: ISLAND2.x + 20, cz: ISLAND2.z + 24, r: 14, name: '피네건', body: 0x86b8b8, lines: [
      '솔직히 말해 봐. 내가 지금 공중제비를 하면, 돌고래라고 생각할 것 같아? …대답하지 마. 공중제비는 아직 연습 중이야.',
      '돌고래들이 나를 “아주 열정적”이라고 해. 좋은 뜻인 것 같아. 좋은 뜻이라고 정하기로 했어.',
      '*희망을 담아 삑삑* …방금 건 돌고래 말로 안녕이야. 아마. 테이프로 배우는 중이거든.',
      '어제 고래가 지나갔어. 엄청 커. 인사도 안 하더라. 나는 했지만. 인사는 해야지.',
    ] },
  ];
  const BELLY = mat(0xf2efe6);
  const CHEEK = new THREE.MeshBasicMaterial({ color: 0xf2a0a8 });
  const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const orbit of orbits) {
    const skin = mat(orbit.body);
    const shark = new THREE.Group();
    // a softer, rounder fin — a sail, not a warning
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 5), skin);
    fin.scale.z = 0.45;
    fin.position.set(0, 0.52, -0.15);
    fin.rotation.x = -0.35;
    shark.add(fin);
    const back = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), skin);
    back.scale.set(0.85, 0.5, 1.9);
    back.position.y = 0.08;
    shark.add(back);
    const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), BELLY);
    belly.scale.set(0.78, 0.4, 1.7);
    belly.position.set(0, -0.02, 0.08);
    shark.add(belly);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.58, 4), skin);
    tail.scale.x = 0.18; // thin side-to-side — a caudal fin, not a paddle
    tail.position.set(0, 0.1, -1.25);
    tail.rotation.x = -0.25;
    shark.add(tail);
    // a big round face held up out of the water, so the friendliness shows
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), skin);
    head.scale.set(1, 0.85, 0.95);
    head.position.set(0, 0.34, 0.95);
    shark.add(head);
    const chin = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), BELLY);
    chin.scale.set(0.95, 0.6, 0.9);
    chin.position.set(0, 0.2, 1.08);
    shark.add(chin);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 1), mat(0x222222, 0.3));
      eye.position.set(sx * 0.2, 0.46, 1.28);
      shark.add(eye);
      const shine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028, 0), SHINE);
      shine.position.set(sx * 0.2 + 0.025, 0.5, 1.35);
      shark.add(shine);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), CHEEK);
      cheek.position.set(sx * 0.3, 0.33, 1.24);
      cheek.rotation.y = sx * 0.5;
      shark.add(cheek);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 5, 8, Math.PI), mat(0x2e3640, 0.5));
    smile.position.set(0, 0.31, 1.43);
    smile.rotation.z = Math.PI; // the arc smiles up
    shark.add(smile);
    const heart = new THREE.Sprite(new THREE.SpriteMaterial({
      map: heartTex, transparent: true, depthWrite: false,
    }));
    heart.scale.set(0.9, 0.9, 1);
    heart.position.y = 1.6;
    heart.visible = false;
    shark.add(heart);
    shark.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });
    shark.userData = { orbit, a: rand(0, Math.PI * 2), speed: rand(0.1, 0.16), heart, tail, heartT: 0, shy: 0 };
    sharks.push(shark);
    group.add(shark);
    register({
      getPos: () => shark.position, r: 3.6,
      label: () => `say hi to ${orbit.name}`,
      use: () => {
        shark.userData.chat = 5; // stays put while you talk
        ui.say(orbit.lines[Math.floor(Math.random() * orbit.lines.length)], { speaker: orbit.name, voice: 380 });
      },
    });
  }

  // ------------------------------------------------------------ whales ----
  const whales = [];
  for (let i = 0; i < 2; i++) {
    const whale = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), mat(0x3a4a66, 0.8));
    body.scale.set(0.85, 0.75, 2.1);
    whale.add(body);
    const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), mat(0xc9d4dc, 0.8));
    belly.scale.set(0.7, 0.5, 1.8);
    belly.position.y = -0.7;
    whale.add(belly);
    const tail = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), mat(0x3a4a66, 0.8));
    tail.scale.set(1.6, 0.3, 0.9);
    tail.position.set(0, 0.3, -4.6);
    whale.add(tail);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(0x222222, 0.3));
      eye.position.set(sx * 0.95, 0.25, 2.7);
      whale.add(eye);
    }
    const whaleSmile = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 5, 10, Math.PI), mat(0x222e3e, 0.5));
    whaleSmile.position.set(0, -0.35, 3.5);
    whaleSmile.rotation.z = Math.PI;
    whaleSmile.rotation.x = 0.4;
    whale.add(whaleSmile);
    // spout puffs
    const spout = [];
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 1 }));
      puff.visible = false;
      whale.add(puff);
      spout.push(puff);
    }
    whale.visible = false;
    whale.userData = { timer: rand(12, 30), breachT: -1, spot: { x: 0, z: 0 }, spout };
    whales.push(whale);
    group.add(whale);
  }

  function startBreach(whale) {
    // pick deep water: a ring well away from both shores
    let spot = whale.userData.spot;
    for (let tries = 0; tries < 20; tries++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(58, 85);
      const x = Math.cos(a) * r + 40, z = Math.sin(a) * r - 15;
      spot = { x, z };
      if (LAND.every((island) => Math.hypot(x - island.x, z - island.z) >= island.r + 12)) break;
    }
    whale.userData.spot = spot;
    whale.userData.breachT = 0;
    whale.visible = true;
    whale.rotation.y = rand(0, Math.PI * 2);
  }

  // -------------------------------------------------------- the reef ----
  // coral just under the surface; the water brightens where it lives
  // (an organic outline, not a coin: a lobed shape with a couple of
  // shallower satellite patches, two tones of bright water)
  const reefShape = (R, ph, lobes) => {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = R * (1 + 0.18 * Math.sin(lobes * a + ph) + 0.1 * Math.sin((lobes + 2) * a + ph * 2.3) + 0.06 * Math.sin(9 * a));
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
    }
    return new THREE.ShapeGeometry(sh, 1);
  };
  const reefGlow = new THREE.Group();
  const reefMats = [];
  for (const [ox, oz, R, col, op, ph, lobes] of [
    [0, 0, REEF.r, 0x57c8d8, 0.22, 0.4, 3],
    [2, -1, REEF.r * 0.6, 0x8fe8e0, 0.2, 2.1, 4],
    [REEF.r * 0.95, REEF.r * 0.5, REEF.r * 0.35, 0x57c8d8, 0.18, 1.3, 3],
    [-REEF.r * 0.8, REEF.r * 0.7, REEF.r * 0.28, 0x57c8d8, 0.16, 4.4, 2],
  ]) {
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op * 1.3, depthWrite: false, blending: THREE.AdditiveBlending });
    m.userData.base = op;
    reefMats.push(m);
    const patch = new THREE.Mesh(reefShape(R, ph, lobes), m);
    patch.rotation.x = -Math.PI / 2;
    // riding just above the tallest waves (±0.38), so the swell can't hide it
    patch.position.set(REEF.x + ox, WATER_Y + 0.42 + reefMats.length * 0.01, REEF.z + oz);
    reefGlow.add(patch);
  }
  group.add(reefGlow);
  const coralColors = [0xff6b81, 0xff9430, 0xc77dff, 0xffd23e, 0x8fce7a];
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(rand(0, 1)) * (REEF.r - 2);
    const cx = REEF.x + Math.cos(a) * r, cz = REEF.z + Math.sin(a) * r;
    const coral = new THREE.Group();
    const c = pick(coralColors);
    if (rand(0, 1) < 0.5) {
      // branching coral
      for (let k = 0; k < 4; k++) {
        const branch = new THREE.Mesh(new THREE.ConeGeometry(0.12, rand(0.5, 1.0), 4), mat(c, 0.7));
        branch.position.set(rand(-0.3, 0.3), 0.3, rand(-0.3, 0.3));
        branch.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4));
        coral.add(branch);
      }
    } else {
      // brain blob + fan
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.55), 1), mat(c, 0.8));
      blob.scale.y = 0.6;
      coral.add(blob);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(0.4, 7),
        new THREE.MeshStandardMaterial({ color: pick(coralColors), side: THREE.DoubleSide, roughness: 0.8 }));
      fan.position.set(0.4, 0.4, 0);
      fan.rotation.y = rand(0, Math.PI);
      coral.add(fan);
    }
    coral.position.set(cx, WATER_Y - rand(0.7, 1.2), cz);
    group.add(coral);
  }

  // ------------------------------------------------------- manta rays ----
  const mantas = [];
  for (let i = 0; i < 3; i++) {
    const manta = new THREE.Group();
    // a manta is a diamond: each wing a swept triangle hinged at the body
    // (dark on top, pale beneath), flapping slow as breathing
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0.9, 2.3, 0, -0.35, 0, 0, -0.7, // top face
      0, 0, 0.9, 0, 0, -0.7, 2.3, 0, -0.35, // (and its back)
    ], 3));
    wingGeo.computeVertexNormals();
    const topMat = new THREE.MeshStandardMaterial({ color: 0x2e3e50, side: THREE.DoubleSide, roughness: 0.6, flatShading: true });
    const left = new THREE.Group(), right = new THREE.Group();
    for (const [holder, sx] of [[left, -1], [right, 1]]) {
      const w = new THREE.Mesh(wingGeo, topMat);
      w.scale.x = sx;
      holder.add(w);
      const under = new THREE.Mesh(wingGeo, mat(0xe8eef2, 0.6));
      under.scale.set(sx * 0.92, 1, 0.9);
      under.position.y = -0.03;
      holder.add(under);
      holder.position.x = sx * 0.3;
    }
    manta.add(left, right);
    const bodyM = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x2e3e50, 0.6));
    bodyM.scale.set(0.7, 0.35, 1.6);
    manta.add(bodyM);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1.6, 4), mat(0x2e3e50, 0.6));
    tail.rotation.x = Math.PI / 2 + 0.1;
    tail.position.set(0, 0.05, -1.6);
    manta.add(tail);
    // wide-set eyes and little cephalic fins: the manta's polite face
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0x222222, 0.3));
      eye.position.set(sx * 0.3, 0.16, 0.7);
      manta.add(eye);
      const ceph = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.4), mat(0x2e3e50, 0.6));
      ceph.position.set(sx * 0.22, -0.02, 0.95);
      ceph.rotation.y = sx * 0.3;
      manta.add(ceph);
    }
    manta.userData = {
      wings: { left, right },
      a: rand(0, Math.PI * 2),
      speed: rand(0.08, 0.13),
      r: rand(7, REEF.r + 6),
      depth: rand(0.5, 1.3),
      phase: rand(0, Math.PI * 2),
    };
    mantas.push(manta);
    group.add(manta);
  }

  function update(dt, t, playerPos) {
    for (const [k, m] of reefMats.entries()) m.opacity = m.userData.base * (0.75 + Math.sin(t * 0.9 + k) * 0.3);

    for (const manta of mantas) {
      const u = manta.userData;
      u.a += u.speed * dt;
      // long glides with a slow rise toward the light and back down
      const lift = Math.sin(t * 0.25 + u.phase);
      manta.position.set(
        REEF.x + Math.cos(u.a) * u.r,
        WATER_Y - u.depth + lift * 0.45,
        REEF.z + Math.sin(u.a) * u.r * 0.8
      );
      // face where it's going (the path's tangent), banking into the turn
      manta.rotation.y = Math.atan2(-Math.sin(u.a) * u.r, Math.cos(u.a) * u.r * 0.8);
      manta.rotation.z = -0.18 + Math.sin(t * 0.8 + u.phase) * 0.06;
      const flap = Math.sin(t * 1.6 + u.phase) * 0.4;
      u.wings.left.rotation.z = -flap;
      u.wings.right.rotation.z = flap;
    }

    for (const shark of sharks) {
      const u = shark.userData;
      const dx = playerPos.x - shark.position.x;
      const dz = playerPos.z - shark.position.z;
      const dp = Math.hypot(dx, dz);
      const pause = dp < 9 ? Math.max(0, 1 - (9 - dp) / 6) : 1; // slows near you
      if (u.chat > 0) u.chat -= dt;
      else u.a += u.speed * dt * (0.35 + 0.65 * pause);
      // fins need depth — skip ahead past any shallows on the orbit
      for (let guard = 0; guard < 24; guard++) {
        const nx = u.orbit.cx + Math.cos(u.a) * u.orbit.r;
        const nz = u.orbit.cz + Math.sin(u.a) * u.orbit.r;
        if (terrainHeight(nx, nz) < WATER_Y - 0.5) break;
        u.a += 0.12;
      }
      shark.position.set(
        u.orbit.cx + Math.cos(u.a) * u.orbit.r,
        WATER_Y - 0.1 + Math.sin(t * 1.4 + u.a * 3) * 0.06,
        u.orbit.cz + Math.sin(u.a) * u.orbit.r
      );
      // face along the orbit — or, mid-chat, toward whoever's talking
      shark.rotation.y = u.chat > 0 ? Math.atan2(dx, dz) : -u.a;
      u.tail.rotation.y = Math.sin(t * 3 + u.a) * 0.4;
      if (dp < 8 && u.heartT <= 0) {
        u.heartT = 6; // a moment of cross-species affection, then cooldown
        u.heart.visible = true;
      }
      if (u.heartT > 0) {
        u.heartT -= dt;
        if (u.heartT < 4.4) u.heart.visible = false;
      }
    }

    for (const whale of whales) {
      const u = whale.userData;
      if (u.breachT < 0) {
        u.timer -= dt;
        if (u.timer <= 0) startBreach(whale);
        continue;
      }
      u.breachT += dt;
      const k = u.breachT / 4.5; // a long, unhurried arc
      if (k >= 1) {
        u.breachT = -1;
        u.timer = rand(20, 45);
        whale.visible = false;
        continue;
      }
      const arc = Math.sin(k * Math.PI);
      whale.position.set(u.spot.x, WATER_Y - 3.2 + arc * 5.2, u.spot.z);
      whale.rotation.x = (k - 0.5) * -1.1; // nose up, then over
      const sp = Math.hypot(playerPos.x - u.spot.x, playerPos.z - u.spot.z);
      if (k > 0.18 && k < 0.22 && sp < 55) splash();
      u.spout.forEach((puff, i) => {
        const pk = k * 3 - i * 0.25 - 0.6;
        puff.visible = pk > 0 && pk < 1 && arc > 0.6;
        if (puff.visible) {
          puff.position.set(0, 1.6 + pk * 2.2, 2.2);
          puff.material.opacity = 0.7 * (1 - pk);
          puff.scale.setScalar(0.5 + pk * 1.4);
        }
      });
    }
  }

  return { group, update };
}
