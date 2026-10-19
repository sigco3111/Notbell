// TEXAS. A very small island between Notbell and the north isle.
// Population: Pecos, a fire ant of strong opinions and a soft center,
// his slingshot, his one (1) tin can, and his ma's light string.

import * as THREE from 'three';
import { TEXAS, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { tone } from './audio.js';
import { rand, turnToward } from './utils.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

const PECOS_LINES = [
  'WHAT. …Well? You gonna stand there or say howdy? Around here we say howdy.',
  'This here’s TEXAS. Population: ME. Census complete. GIT— …no. No, stay a minute. Wind’s been my only visitor all week, and the wind don’t say howdy.',
  'Them lights ain’t Christmas lights, they’re TEXAS lights. Burn all year. …Pretty, though, ain’t they. My ma strung the first strand. I just kept goin’.',
  'You ROWED all the way out here? To see ME? …That so. (A very long pause.) That’s real fine. ANYWAY. WHAT ELSE.',
  'The big islands got their bells and their ghosts and their fancy mossy bridges. Texas has got a can, a slingshot, and STANDARDS.',
];

export function createTexas() {
  const group = new THREE.Group();
  const updates = [];
  const T = TEXAS;
  const ty = terrainHeight(T.x, T.z);

  // -------------------------------------------------------- the shack ----
  const shack = new THREE.Group();
  const wallPanels = [0x9aa0a6, 0x8a9096, 0xa8742c, 0x9aa0a6, 0x8a9096]; // rust included
  wallPanels.forEach((c, i) => {
    const panel = box(0.62, 2.2, 0.14, c);
    panel.position.set(-1.24 + i * 0.62, 1.1, 1.4);
    shack.add(panel);
  });
  const sideL = box(0.14, 2.2, 2.8, 0x8a9096);
  sideL.position.set(-1.55, 1.1, 0);
  const sideR = box(0.14, 2.2, 2.8, 0x9aa0a6);
  sideR.position.set(1.55, 1.1, 0);
  const back = box(3.1, 2.2, 0.14, 0xa8742c);
  back.position.set(0, 1.1, -1.4);
  shack.add(sideL, sideR, back);
  const roof = box(3.6, 0.14, 3.3, 0x6e7479);
  roof.position.set(0, 2.35, 0);
  roof.rotation.z = 0.1; // tin roofs lean. it's the law.
  shack.add(roof);
  const door = box(0.9, 1.7, 0.1, 0x6e5048);
  door.position.set(0.3, 0.85, 1.48);
  shack.add(door);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.8, 6), mat(0x55504c));
  pipe.position.set(-1.1, 2.9, -0.6);
  shack.add(pipe);

  // the gaudy lights: three strands, blinking out of sync, gloriously
  const strands = [[], [], []];
  const bulbColors = [0xff5252, 0x52ff7a, 0x52a8ff, 0xffe252, 0xff52d6];
  let bulbIdx = 0;
  function stringLights(from, to, n, parent) {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0),
        new THREE.MeshBasicMaterial({ color: bulbColors[bulbIdx % 5], transparent: true }));
      bulb.position.set(
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * 0.22,
        from[2] + (to[2] - from[2]) * t);
      strands[bulbIdx % 3].push(bulb);
      bulbIdx++;
      parent.add(bulb);
    }
  }
  stringLights([-1.8, 2.5, 1.65], [1.8, 2.5, 1.65], 9, shack);
  stringLights([-1.8, 2.5, 1.65], [-1.8, 2.5, -1.65], 7, shack);
  stringLights([1.8, 2.5, 1.65], [1.8, 2.5, -1.65], 7, shack);
  stringLights([-0.2, 1.9, 1.52], [0.8, 1.9, 1.52], 4, shack); // around the door, naturally

  shack.position.set(T.x - 1, ty, T.z - 1.5);
  shack.rotation.y = 0.3;
  shack.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  group.add(shack);
  zones.addBlockerBox(T.x - 1, T.z - 1.5, 3.4, 3.2, 0.3, 0.05);

  updates.push((dt, t) => {
    strands.forEach((strand, si) => {
      const on = Math.sin(t * 2.2 + si * 2.1) > -0.3;
      for (const bulb of strand) bulb.material.opacity = on ? 1 : 0.25;
    });
  });

  // one cactus. for the ambience.
  const cactus = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.6, 7), mat(0x4f8a52));
  trunk.position.y = 0.8;
  cactus.add(trunk);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.7, 6), mat(0x4f8a52));
    arm.position.set(sx * 0.42, 1.0, 0);
    arm.rotation.z = -sx * 0.5;
    cactus.add(arm);
  }
  stringLights([-0.5, 1.5, 0.1], [0.5, 1.5, 0.1], 4, cactus); // yes, the cactus too
  cactus.position.set(T.x + 2.6, terrainHeight(T.x + 2.6, T.z + 0.5), T.z + 0.5);
  cactus.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  group.add(cactus);
  zones.addBlocker(cactus.position.x, cactus.position.z, 0.45, 'tree'); // it's a cactus. don't.

  // ------------------------------------------- the can, and the truth ----
  const canPost = box(0.12, 1.1, 0.12, 0x8a6f4d);
  const canX = T.x + 1.5, canZ = T.z + 3.4;
  const canY = terrainHeight(canX, canZ);
  canPost.position.set(canX, canY + 0.55, canZ);
  group.add(canPost);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 8), mat(0xb8beba, 0.4));
  can.position.set(canX, canY + 1.25, canZ);
  group.add(can);

  // Pecos himself: an ant built from spare parts and fury
  const pecos = buildAnimal('salamander', { body: 0xc23b2e, head: 0xc23b2e });
  pecos.scale.setScalar(0.85);
  // ant upgrades: abdomen, antennae, and the world's angriest eyebrows
  const abdomen = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), mat(0xa82e22, 0.8));
  abdomen.scale.set(0.9, 0.75, 1.2);
  abdomen.position.set(0, 0.42, -1.15);
  pecos.add(abdomen);
  for (const sx of [-1, 1]) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.55, 4), mat(0x6e2218));
    antenna.position.set(sx * 0.1, 0.95, 0.75);
    antenna.rotation.x = -0.6;
    antenna.rotation.z = -sx * 0.3;
    pecos.add(antenna);
    const brow = box(0.18, 0.05, 0.05, 0x40140e);
    brow.position.set(sx * 0.13, 0.72, 0.95);
    brow.rotation.z = sx * 0.5; // permanently furious
    pecos.add(brow);
  }
  const px = T.x + 0.8, pz = T.z + 1.2;
  pecos.position.set(px, terrainHeight(px, pz), pz);
  pecos.rotation.y = Math.atan2(canX - px, canZ - pz);
  group.add(pecos);

  // the slingshot: a proud Y of driftwood, kept loaded with opinion
  const sling = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 5), mat(0x8a6f4d));
  handle.position.y = 0.25;
  sling.add(handle);
  for (const sx of [-1, 1]) {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 5), mat(0x8a6f4d));
    fork.position.set(sx * 0.1, 0.62, 0);
    fork.rotation.z = -sx * 0.5;
    sling.add(fork);
  }
  sling.position.set(px + 0.5, terrainHeight(px + 0.5, pz + 0.2), pz + 0.2);
  group.add(sling);

  // the pellet: fired at the can on a proud schedule
  const pellet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x55504c, 0.5));
  pellet.visible = false;
  group.add(pellet);
  let shotTimer = rand(6, 14);
  let shotK = -1;
  let canDown = 0;
  // he walks the border, too: a stiff little lap of all of Texas, checking
  // the lights and the fence of his own imagination, then back to his post
  const LAP = [[-0.5, 3.0], [-3.2, 2.0], [-3.6, -0.8], [-3.2, -2.9], [0.8, -3.8], [3.0, -1.8], [3.6, 1.6], [0.8, 1.2]]
    .map(([dx, dz]) => ({ x: T.x + dx, z: T.z + dz }));
  let lapAt = -1;          // index into LAP while patrolling, -1 at the post
  let postTimer = 12 + Math.random() * 10;
  updates.push((dt, t, playerPos) => {
    const parts = pecos.userData.parts;
    const near = playerPos && Math.hypot(playerPos.x - pecos.position.x, playerPos.z - pecos.position.z) < 5;
    if (lapAt >= 0) {
      // on patrol: stops dead to glare at anyone who comes close
      if (near) {
        animateGait(pecos, t, 0);
        pecos.rotation.y = turnToward(pecos.rotation.y, Math.atan2(playerPos.x - pecos.position.x, playerPos.z - pecos.position.z), dt, 4);
        return;
      }
      const w = LAP[lapAt];
      const dx = w.x - pecos.position.x, dz = w.z - pecos.position.z, d = Math.hypot(dx, dz);
      if (d < 0.15) {
        lapAt++;
        if (lapAt >= LAP.length) { lapAt = -1; postTimer = 18 + Math.random() * 16; }
        return;
      }
      const step = Math.min(d, dt * 1.6);
      pecos.position.x += (dx / d) * step;
      pecos.position.z += (dz / d) * step;
      pecos.position.y = terrainHeight(pecos.position.x, pecos.position.z);
      pecos.rotation.y = turnToward(pecos.rotation.y, Math.atan2(dx, dz), dt, 6);
      animateGait(pecos, t, 1, 14); // quick, indignant little steps
      return;
    }
    // at the post: breathing, and glaring fondly at visitors
    animateGait(pecos, t, 0);
    parts.body.position.y = parts.bodyY + Math.sin(t * 1.8) * 0.02;
    if (playerPos) {
      const dx = playerPos.x - pecos.position.x;
      const dz = playerPos.z - pecos.position.z;
      if (Math.hypot(dx, dz) < 7) {
        pecos.rotation.y = turnToward(pecos.rotation.y, Math.atan2(dx, dz), dt, 4);
      } else {
        pecos.rotation.y = turnToward(pecos.rotation.y, Math.atan2(canX - px, canZ - pz), dt, 2);
      }
    }
    if (shotK < 0 && canDown <= 0 && !near) {
      postTimer -= dt;
      if (postTimer <= 0) { lapAt = 0; return; }
    }
    // target practice
    if (canDown > 0) {
      canDown -= dt;
      can.rotation.x = Math.PI / 2;
      can.position.y = canY + 1.12;
      if (canDown <= 0) {
        can.rotation.x = 0;
        can.position.y = canY + 1.25; // set back up with enormous tenderness
      }
      return;
    }
    if (shotK < 0) {
      shotTimer -= dt;
      if (shotTimer <= 0) { shotK = 0; pellet.visible = true; }
      return;
    }
    shotK += dt * 2.2;
    const k = Math.min(1, shotK);
    pellet.position.set(
      px + 0.5 + (canX - px - 0.5) * k,
      terrainHeight(px, pz) + 0.6 + Math.sin(k * Math.PI) * 0.5 + (canY + 1.25 - terrainHeight(px, pz) - 0.6) * k,
      pz + 0.2 + (canZ - pz - 0.2) * k);
    if (k >= 1) {
      pellet.visible = false;
      shotK = -1;
      shotTimer = rand(8, 18);
      canDown = 2.2;
      tone(1180, { dur: 0.08, type: 'square', vol: 0.05 }); // TINK
      tone(700, { time: 0.07, dur: 0.1, type: 'square', vol: 0.03 });
    }
  });

  register({
    getPos: () => pecos.position, r: 3,
    label: '페코스에게 하우디 인사하기',
    use: () => {
      if (!S.hasFlag('metPecos')) {
        S.setFlag('metPecos');
        ui.say([
          'A fire ant the size of a teakettle rounds on you, eyebrows first.',
          '“WHO GOES— a visitor? A VISITOR. …Pecos. This is Texas. Wipe your feet. There’s no mat. Wipe ’em anyway, on PRINCIPLE.”',
        ], { speaker: 'Pecos', voice: 950 });
        return;
      }
      let idx = Math.floor(Math.random() * PECOS_LINES.length);
      ui.say(PECOS_LINES[idx], { speaker: 'Pecos', voice: 950 });
    },
  });

  // the sign. the whole sign. it says TEXAS, in letters, on both sides
  const sign = box(1.3, 0.7, 0.1, 0xe8d49a);
  const sy = terrainHeight(T.x - 2, T.z + 4);
  sign.position.set(T.x - 2, sy + 1.0, T.z + 4);
  const signPost = box(0.12, 0.9, 0.12, 0x8a6f4d);
  signPost.position.set(T.x - 2, sy + 0.45, T.z + 4);
  group.add(sign, signPost);
  {
    const cv = document.createElement('canvas');
    cv.width = 260; cv.height = 140;
    const c = cv.getContext('2d');
    c.fillStyle = '#e8d49a';
    c.fillRect(0, 0, 260, 140);
    c.strokeStyle = '#8a6f4d';
    c.lineWidth = 8;
    c.strokeRect(6, 6, 248, 128);
    c.fillStyle = '#7a3b1e';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '900 76px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('TEXAS', 130, 76);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    for (const side of [1, -1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.64), new THREE.MeshBasicMaterial({ map: tex }));
      face.position.set(T.x - 2, sy + 1.0, T.z + 4 + side * 0.056);
      if (side < 0) face.rotation.y = Math.PI;
      group.add(face);
    }
  }
  zones.addBlocker(T.x - 2, T.z + 4, 0.2);
  register({
    pos: new THREE.Vector3(T.x - 2, 0, T.z + 4), r: 2.2,
    label: '표지판 읽기',
    use: () => ui.say('“텍사스.” 더 이상의 설명은 제공되지 않고 — 표지판이 강하게 암시하듯 — 필요하지도 않아요.'),
  });

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}
