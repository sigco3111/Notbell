// The glow worm cave. Outside: a rocky knoll with a dark mouth in the
// cliffside. Inside: a dome of dark stone, constellations of glow worms,
// a still pond, and — at the very back — the Old Light, sleeping.

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { rand } from './utils.js';
import { jingle } from './audio.js';

const IN = { x: -300, z: 0 }; // where the cave interior lives, far off-island

// the still pond, world coords — fishing.js casts onto it
export const CAVE_POND = { x: IN.x - 4, z: IN.z + 3, r: 3.6, surfaceY: 0.07 };

function rockMat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 });
}

// soft round dot for the glow worm points (otherwise they render as squares)
let glowTex = null;
function glowTexture() {
  if (!glowTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(cv);
  }
  return glowTex;
}

export function createCave() {
  const group = new THREE.Group();
  const site = SITES.cave;
  const updates = [];

  // ------------------------------------------------------- the knoll ----
  const knoll = new THREE.Group();
  const baseY = terrainHeight(site.x, site.z);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : rand(1.6, 2.6);
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(1.6, 2.6), 0),
      rockMat(i % 2 ? 0x6e7479 : 0x7d8287)
    );
    rock.position.set(Math.cos(a) * r, rand(0.4, 1.6), Math.sin(a) * r);
    // nothing sits in front of the doorway: rocks that wandered into the
    // mouth's sightline shuffle round the back
    if (rock.position.z > 0.4 && Math.abs(rock.position.x) < 2.2) rock.position.z -= 2.4;
    rock.scale.y = rand(0.8, 1.3);
    rock.rotation.set(rand(0, 1), rand(0, Math.PI), rand(0, 1));
    rock.castShadow = true;
    knoll.add(rock);
  }
  // the mouth: a real doorway in the rock — two leaning jamb stones, a
  // lintel, and a round-topped dark opening you'd believe you could walk into
  const dark = new THREE.MeshBasicMaterial({ color: 0x05070d });
  const mouthLow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), dark);
  mouthLow.position.set(0, 0.6, 2.62);
  const mouthTop = new THREE.Mesh(new THREE.CircleGeometry(0.85, 10, 0, Math.PI), dark);
  mouthTop.position.set(0, 1.2, 2.62);
  knoll.add(mouthLow, mouthTop);
  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), rockMat(0x6e7479));
    jamb.scale.set(0.8, 1.7, 0.9);
    jamb.position.set(sx * 1.35, 0.95, 2.55);
    jamb.rotation.set(0.2, sx * 0.4, sx * -0.15);
    jamb.castShadow = true;
    knoll.add(jamb);
  }
  const lintel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), rockMat(0x7d8287));
  lintel.scale.set(1.9, 0.6, 1.0);
  lintel.position.set(0, 2.35, 2.45);
  lintel.castShadow = true;
  knoll.add(lintel);
  // the glow worms are curious: a few drift right up to the threshold, and
  // a soft green-blue light spills out onto the ground — the Old Light's
  // way of saying "in here"
  const glintMat = new THREE.MeshBasicMaterial({ color: 0x8fffe9 });
  for (const [gx, gy, gz] of [[-0.45, 1.35, 2.64], [0.4, 0.9, 2.64], [0.1, 1.6, 2.64], [-0.2, 0.5, 2.64], [0.6, 1.4, 2.64]]) {
    const glint = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), glintMat);
    glint.position.set(gx, gy, gz);
    knoll.add(glint);
  }
  const spill = new THREE.Mesh(new THREE.CircleGeometry(1.6, 14),
    new THREE.MeshBasicMaterial({
      map: glowTexture(), color: 0x6fe8d0, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.06, 3.3);
  knoll.add(spill);
  const haze = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0x6fe8d0, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  haze.scale.set(2.6, 2.6, 1);
  haze.position.set(0, 1.0, 2.7);
  knoll.add(haze);
  knoll.position.set(site.x, baseY, site.z);
  knoll.rotation.y = site.facing; // mouth toward the village
  group.add(knoll);
  zones.addBlocker(site.x, site.z, 4.6);

  // door: stand at the mouth, slip inside
  const mouthWorld = new THREE.Vector3(
    site.x + Math.sin(site.facing) * 3.2, 0, site.z + Math.cos(site.facing) * 3.2);
  register({
    pos: mouthWorld, r: 2.4, label: '동굴로 들어가기',
    use: async () => {
      const first = !S.hasFlag('visitedCave');
      S.setFlag('visitedCave');
      await zones.go('cave');
      if (first) {
        ui.say([
          '이곳의 어둠은 부드럽고, 작은 초록 별들로 가득해요.',
          '무언가가 아주 조용히 흥얼거려요. 무언가 꿈꾸는 것처럼.',
        ]);
      }
    },
  });

  // ---------------------------------------------------- the interior ----
  const cavern = new THREE.Group();

  // floor: a wide, gently lumpy slab of dark stone (subdivided plane —
  // CircleGeometry is a fan with no interior vertices to displace)
  const floorGeo = new THREE.PlaneGeometry(36, 36, 26, 26);
  floorGeo.rotateX(-Math.PI / 2);
  const fpos = floorGeo.attributes.position;
  for (let i = 0; i < fpos.count; i++) {
    const x = fpos.getX(i), z = fpos.getZ(i);
    const d = Math.hypot(x, z);
    // stay flat under the pond (local offset -4, +3) so it reads as water
    if (Math.hypot(x + 4, z - 3) < 4.6) fpos.setY(i, -0.04);
    else if (d > 2) fpos.setY(i, rand(-0.08, 0.18) + d * 0.012);
  }
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, rockMat(0x343b49));
  floor.position.set(IN.x, 0, IN.z);
  cavern.add(floor);

  // dome: BackSide, so the camera sees through the near wall — dollhouse cave
  const dome = new THREE.Mesh(
    new THREE.IcosahedronGeometry(17, 1),
    new THREE.MeshStandardMaterial({
      color: 0x1a2030, flatShading: true, roughness: 1, side: THREE.BackSide,
    })
  );
  dome.scale.y = 0.6;
  dome.position.set(IN.x, 0.5, IN.z);
  cavern.add(dome);

  // stalagmites
  for (let i = 0; i < 9; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(9, 14.5);
    const h = rand(0.8, 2.6);
    const stal = new THREE.Mesh(new THREE.ConeGeometry(rand(0.3, 0.6), h, 5), rockMat(0x434b5c));
    stal.position.set(IN.x + Math.cos(a) * r, h / 2, IN.z + Math.sin(a) * r);
    cavern.add(stal);
  }

  // ------------------------------------------------------ glow worms ----
  // constellations on the ceiling: clustered points, additive, twinkling
  const wormGroups = [];
  const palette = [0x8fffe9, 0x9fe8ff, 0xb8ffd0];
  for (let gIdx = 0; gIdx < 3; gIdx++) {
    const pts = [];
    for (let c = 0; c < 5; c++) {
      // cluster center: a direction in the upper dome
      const ca = rand(0, Math.PI * 2);
      const ct = rand(0.25, 1.25); // polar angle from straight up
      for (let k = 0; k < 16; k++) {
        const a = ca + rand(-0.35, 0.35);
        const tta = ct + rand(-0.22, 0.22);
        const R = 15.6;
        pts.push(
          IN.x + Math.sin(tta) * Math.cos(a) * R,
          0.5 + Math.cos(tta) * R * 0.6 * rand(0.92, 1.0),
          IN.z + Math.sin(tta) * Math.sin(a) * R
        );
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const matP = new THREE.PointsMaterial({
      color: palette[gIdx], size: 0.34, transparent: true, opacity: 0.8,
      map: glowTexture(), blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, matP);
    points.userData.phase = gIdx * 2.1;
    points.userData.speed = 0.7 + gIdx * 0.35;
    wormGroups.push(points);
    cavern.add(points);
  }
  updates.push((dt, t) => {
    for (const w of wormGroups) {
      w.material.opacity = 0.55 + Math.sin(t * w.userData.speed + w.userData.phase) * 0.35;
    }
  });
  // a whisper of cool light so the stone reads as stone
  const caveAmbient = new THREE.PointLight(0x6fd8c9, 50, 40, 2);
  caveAmbient.position.set(IN.x, 6, IN.z);
  cavern.add(caveAmbient);

  // ------------------------------------------------------------ pond ----
  const pondX = IN.x - 4, pondZ = IN.z + 3;
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 20),
    new THREE.MeshStandardMaterial({
      color: 0x0d2433, roughness: 0.15, metalness: 0.1,
      emissive: 0x0a3a38, emissiveIntensity: 0.6,
    })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(pondX, 0.07, pondZ);
  cavern.add(pond);
  updates.push((dt, t) => {
    pond.material.emissiveIntensity = 0.45 + Math.sin(t * 0.9) * 0.2;
  });
  register({
    pos: new THREE.Vector3(pondX, 0, pondZ), r: 4.6, zone: 'cave',
    label: '고요한 연못 들여다보기', priority: 0,
    use: () => ui.say([
      '연못이 천장의 작은 별들을 완벽하게 고요히 담고 있어요.',
      '잠시, 어느 쪽이 위인지 알기 어려워요. 연못은 이게 괜찮은 모양이에요.',
    ]),
  });

  // ------------------------------------------------- glowing mushrooms ----
  const shroomGlow = new THREE.MeshBasicMaterial({ color: 0x7fe8d8 });
  const shroomSpots = [];
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(6, 13);
    const cluster = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5), rockMat(0x4a5568));
      stem.position.set(rand(-0.3, 0.3), 0.15, rand(-0.3, 0.3));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 6), shroomGlow);
      cap.position.set(stem.position.x, 0.36, stem.position.z);
      cluster.add(stem, cap);
    }
    cluster.position.set(IN.x + Math.cos(a) * r, 0, IN.z + Math.sin(a) * r);
    cavern.add(cluster);
    shroomSpots.push(cluster.position);
  }

  // ------------------------------------------------ the cave glimmerwing ----
  // a pale moth that drifts between mushroom clusters; net required
  const wing = new THREE.Group();
  {
    const wingGeo = new THREE.PlaneGeometry(0.3, 0.22);
    wingGeo.rotateX(-Math.PI / 2);
    wingGeo.translate(0.16, 0, 0);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xd8fff2, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
    });
    const right = new THREE.Mesh(wingGeo, wingMat);
    const left = new THREE.Mesh(wingGeo, wingMat);
    left.scale.x = -1;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 2, 5), rockMat(0xb8d8cc));
    body.rotation.x = Math.PI / 2;
    wing.add(right, left, body);
    wing.userData = {
      wings: { left, right },
      home: shroomSpots[0] || new THREE.Vector3(IN.x, 0, IN.z),
      phase: rand(0, Math.PI * 2),
      respawn: 0,
      prev: new THREE.Vector3(),
    };
    cavern.add(wing);
  }
  register({
    getPos: () => wing.position,
    r: 1.8, zone: 'cave',
    enabled: () => wing.visible,
    label: () => (S.state.tools.net ? '반짝날개에 채집망 휘두르기' : '반짝날개 구경하기'),
    use: () => {
      if (!S.state.tools.net) {
        ui.say('심부름 가는 작은 유령처럼 버섯 사이를 떠다녀요. 채집망이라면 중간에서 만날 수 있을 거예요.');
        return;
      }
      if (Math.random() < 0.6) {
        wing.visible = false;
        wing.userData.respawn = rand(60, 120);
        S.addItem('cave_glimmerwing');
        jingle();
        ui.foundItem('cave_glimmerwing');
        ui.updateHUD();
      } else {
        ui.toast('정중하게 어둠 속으로 녹아들었어요.', '🦋');
        wing.userData.home = shroomSpots[Math.floor(rand(0, shroomSpots.length))] || wing.userData.home;
      }
    },
  });
  updates.push((dt, t) => {
    if (!wing.visible) {
      wing.userData.respawn -= dt;
      if (wing.userData.respawn <= 0) wing.visible = true;
      return;
    }
    const u = wing.userData;
    u.prev.copy(wing.position);
    const x = u.home.x + Math.cos(t * 0.4 + u.phase) * 1.6;
    const z = u.home.z + Math.sin(t * 0.33 + u.phase) * 1.6;
    const y = 0.9 + Math.sin(t * 1.1 + u.phase) * 0.3;
    wing.position.set(x, y, z);
    if (u.prev.distanceToSquared(wing.position) > 1e-8) {
      wing.rotation.y = Math.atan2(wing.position.x - u.prev.x, wing.position.z - u.prev.z);
    }
    const flap = Math.sin(t * 14 + u.phase) * 0.8;
    u.wings.right.rotation.z = flap;
    u.wings.left.rotation.z = -flap;
  });

  // -------------------------------------------------- the Old Light ----
  const shrineX = IN.x, shrineZ = IN.z - 11;
  const cairn = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 - i * 0.08, 0), rockMat(0x4a5060));
    rock.position.y = 0.3 + i * 0.42;
    rock.rotation.y = i * 0.7;
    cairn.add(rock);
  }
  cairn.position.set(shrineX, 0, shrineZ);
  cavern.add(cairn);

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95 })
  );
  orb.position.set(shrineX, 2.6, shrineZ);
  cavern.add(orb);
  const orbLight = new THREE.PointLight(0xffc97a, 50, 17, 2);
  orbLight.position.set(shrineX, 2.8, shrineZ);
  cavern.add(orbLight);
  updates.push((dt, t) => {
    // slow, sleepy breathing
    const breath = 1 + Math.sin(t * 0.6) * 0.1;
    orb.scale.setScalar(breath);
    orbLight.intensity = 45 + Math.sin(t * 0.6) * 12;
    orb.position.y = 2.6 + Math.sin(t * 0.45) * 0.1;
  });

  register({
    pos: new THREE.Vector3(shrineX, 0, shrineZ + 1.2), r: 2.6, zone: 'cave',
    label: '새겨진 돌 읽기',
    use: async () => {
      await ui.say([
        '납작한 돌, 오래전에 새겨지고 부드럽게 닳았어요:',
        '“라이트킵 섬의 옛 빛이 여기 잠든다. 조용히 말할 것. 오래 근무했다.”',
      ]);
      if (!S.hasFlag('blessedByLight')) {
        S.setFlag('blessedByLight');
        await ui.say('빛구슬이 한 번 부드럽게 맥동해요 — 아주 작은 배에게 인사하는 등대처럼.');
      }
      // the Labs asked everywhere. "everywhere" includes here.
      if (S.hasFlag('sawRocket') && !S.hasFlag('lightseedGiven')) {
        const give = await ui.ask(
          '빛구슬이 낮게 내려와요. 로켓 소문을 들었나 봐요 — 빛 소문은 빛의 속도로 퍼지니까요. 뭔가를… 건네려는 것 같아요.',
          [
            { label: '🌟 두 손 모으기', value: 'yes' },
            { label: '그냥 자게 두기', value: null },
          ]);
        if (give) {
          S.setFlag('lightseedGiven');
          S.addItem('lightseed');
          await ui.say([
            '옛 빛이 몸을 움츠려요, 9년 동안 고민해 온 점프를 앞둔 고양이처럼.',
            '따뜻한 빛 방울 하나가 구슬에서 굴러 당신 손에 닿아요. 구슬이 어두워져요 — 작아진 게 아니에요. 더 자랑스러워진 거예요.',
            '천 척의 배를 집으로 이끌었지만, 밖으로 이끌어 본 적은 한 번도 없어요. 그게 어떤 기분일지 무척 알고 싶어 해요.',
          ]);
          ui.toast('<b>빛의 씨앗</b>을 받았어요! 아주 조용히 등대 노래를 흥얼거려요.', '🌟');
        } else {
          ui.say('빛구슬은 태연하게 제자리로 돌아가요. 등대는 기다림에 아주 능해요.');
        }
      }
    },
  });

  // exit back to the island
  zones.registerInterior('cave', {
    root: cavern,
    floorY: 0,
    bounds: { x0: IN.x - 14.5, x1: IN.x + 14.5, z0: IN.z - 13.5, z1: IN.z + 14.5 },
    blockers: [
      { x: pondX, z: pondZ, r: 3.8 },
      { x: shrineX, z: shrineZ, r: 1.3 },
    ],
    spawn: { x: IN.x, z: IN.z + 12.5, rotY: Math.PI },
    lighting: {
      bg: 0x05070d, fog: 0x05070d, fogNear: 10, fogFar: 48,
      hemiSky: 0x3a4a66, hemiGround: 0x101820, hemiIntensity: 0.35,
      sunIntensity: 0,
    },
  });
  zones.setDoor('cave', {
    x: site.x + Math.sin(site.facing) * 5.6,
    z: site.z + Math.cos(site.facing) * 5.6,
  });
  register({
    pos: new THREE.Vector3(IN.x, 0, IN.z + 13.2), r: 1.8, zone: 'cave',
    label: '밖으로 기어 나가기',
    use: () => zones.leaveTo({
      x: site.x + Math.sin(site.facing) * 5.6,
      z: site.z + Math.cos(site.facing) * 5.6,
      rotY: site.facing,
    }),
  });

  group.add(cavern);

  function update(dt, t) {
    for (const u of updates) u(dt, t);
  }

  return { group, update };
}
