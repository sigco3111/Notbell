// The Fold — the plain folk of the far shore. West of the Labs, past the
// edge of the chart (they asked, politely, to stay off it): a green, a kirk
// called the HOUSE OF COD, three cottages, a barn, wheat, carrots, preserves,
// and a small hill of well-kept stones. Sheep, mostly. Kind, unbothered,
// technology politely declined. They share an island with the archipelago's
// most advanced research institute. Nobody finds this strange. Both sides wave.
//
// This is its own quiet story lane — the Fold has no opinion about the bell.

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching } from './audio.js';
import { buildAnimal, animateGait } from './animals.js';
import { rand, pick, turnToward } from './utils.js';
import { addIslandInfo, addZonePlace } from './fieldguide.js';
import { glowWindow } from './nightglow.js';

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

const IN_KIRK = { x: 300, z: 1860 }; // the kirk interior, off in the elsewhere

const VOICE = { amos: 240, mercy: 370, patience: 330, obed: 265, lamb: 540 };

// ---------------------------------------------------------------- words ----

const COD_LORE = [
  '대구님은 주셔요. 전부는 아니고, 언제나도 아니지만 — 충분히, 그리고 대체로 화요일에. 그게 교리문답의 거의 전부예요.',
  '대구님이 진짜 계시냐고 묻는 이들이 있어요. 친구여, 바다는 진짜이고 저녁 밥상도 진짜예요. 그 둘 사이를 다정한 무언가가 헤엄치고 있지요.',
  '설교 중에 길을 잃을 때 쳐다볼 곳이 있으라고 들보에 나무 대구를 걸어 두었어요. 한 번도 불평한 적이 없지요.',
  '예배는 날씨가 정할 때 열려요. 날씨는 판단이 아주 좋아서, 설교가 길어진 적이 한 번도 없지요.',
];

const NEIGHBOR_LORE = [
  '연구소요? 좋은 이웃이에요. 그쪽은 하늘을 듣고, 우리는 그물을 깁지요. 그물마다 먼 쪽 끝이 필요한데, 우리가 그들의 먼 끝이 아닌가 싶어요.',
  '한번은 전깃불을 제안하셨어요, 아주 공손하게. 우리도 아주 공손하게 사양했지요. 이제는 서로 손을 흔들어요. 좋은 사이예요, 설명서를 읽을 일도 없고요.',
  '그쪽 로켓이 날아오를 때 우리는 다들 갈퀴에 기대어 바라보았어요. 사양한 것도 감탄할 수 있지요. 사실 세상 대부분의 일이 그래요.',
];

const FOLD_LORE = [
  '지도 바깥으로 나온 건 땅값이 쌌고 고요함은 공짜였기 때문이에요. 그 고요함의 가치는 많이 올랐지요.',
  '밀 심고, 당근 올리고, 겨울 대비 잼 저장하고. 한 해는 수레바퀴 같아요. 우리는 그 바퀴가 무척 마음에 들어요.',
  '여기에는 종도 없고, 잃어버린 종도 없어요. 다른 이들의 그리움은 그들의 몫이지요. 우리는 잼을 지켜요.',
];

const MERCY_CHAT = [
  '잼이요! 구스베리, 당근, 바다자두. 대구님이 주시고, 나는 뚜껑을 드려요.',
  '이 병 안의 모든 것은 손가락으로 가리킬 거리에서 자랐어요. 우리는 소리 지르는 사람들이 아니에요.',
  '길에 가져갈 잼 한 병 들고 가세요, 친구. 여기서 나가는 길은 길지만 그만한 값어치가 있으니까요.',
];

const PATIENCE_CHAT = [
  '이름은 패이션스, 맡은 일은 당근. 당근은 한 계절이 걸려요. 이름 짓는 쪽에도 정확히 아는 사람이 있었나 봐요.',
  '밀이 들어가고 밀이 나와요. 그 사이에는 날씨. 그게 농사예요, 친구 — 나머지는 주석일 뿐.',
  '연구소에서 우리 강우량계를 노래하게 한 적이 있어요. 감사히 받았다가 돌려주었지요. 비는 혼자서도 잘 셀 수 있거든요.',
];

const OBED_CHAT = [
  '오베드예요. 나는 헛간을 돌보고, 울타리는 나를 돌봐요. 우리는 모두 무언가에 지켜지고 있지요.',
  '연구소 사람 하나가 매일 아침 내게 손을 흔들고, 나도 손을 흔들어요. 벌써 11년째, 둘 다 하루도 빠진 적이 없어요. 그게 우정이지요, 그래요.',
  '헛간은 동쪽으로 조금 기울어 있어요. 나도 저녁이면 그렇지요. 우리는 서로를 이해해요.',
];

const LAMB_CHAT = [
  '나는 리틀 머시야! 엄마가 그냥 머시야. 다 크면 이름의 나머지도 받는대. 그러고 나면 — 글쎄. 인내심을 가지렴, 나.',
  '하늘 배가 한번 쉭- 하고 지나갔어요. 아모스 장로님은 로켓은 안 된다고 하시지만, 나는 조-금 찬성이에요. 비밀이에요.',
  '잼 만드는 법을 배우는 중이에요. 지금까지 제일 잘하는 부분은, 맛 확인하겠다고 하나 먹는 거예요.',
];

const KNOCKS = {
  mercy: '구스베리 잼 한 병이 종이 모자를 쓰고 계단에 놓여 있어요. 정해진 누군가를 기다리면서. 아무도 없어요 — 노점은 그녀의 시간대로 열려요.',
  patience: '잘 닳은 신발 긁개, 잘 익은 벤치. 집 뒤 어딘가에서 정확히 김매는 소리가 나요.',
  obed: '문이 정직하게 한 뼘 열려 있어요. 평평하게 붙은 쪽지: “헛간에 있음. 아니면 밭. 헛간부터 볼 것.”',
  amos: '좋은 생각 하나만 한 오두막. 문에는 자물쇠가 없고, 필요했던 적도 없어요. 그분은 교회에 계실 거예요.',
};

const EPITAPHS = [
  '콘스탄스 — 예순 번의 겨울. 그 겨울들을 좋아하셨다.',
  '오바디아 — 울타리를 고쳤다. 울타리는 서 있다.',
  '베리티 — 말이 적었다. 그 전부를 진심으로 했다.',
  '땡큐풀 — 그러셨다.',
  '피터 — 어부. 대구가 그를 용서했다, 대체로.',
  '어린 양 한 마리 — 잠시. 온전히 사랑받았다.',
  '일곱 번째 돌은 새겨진 글자보다 오래됐어요. 당신 앞의 모든 사람이 그랬듯 엄지로 윗면을 쓸어 보세요. 그래서 이렇게 매끄러워요.',
];

// ---------------------------------------------------------------- props ----

// a carved wooden cod, pointing +x. the congregation's whole iconography.
function makeCod(len = 1, color = 0xa97c50) {
  const g = new THREE.Group();
  const m = mat(color, 0.8);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), m);
  body.scale.set(1.4, 0.52, 0.2);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 3), m);
  tail.rotation.z = Math.PI / 2;
  tail.scale.z = 0.3;
  tail.position.set(-0.86, 0, 0);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 3), m);
  fin.scale.z = 0.3;
  fin.position.set(0.05, 0.32, 0);
  g.add(fin);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(0x3a3026, 0.5));
    eye.position.set(0.42, 0.1, s * 0.11);
    g.add(eye);
  }
  g.scale.setScalar(len);
  return g;
}

// the plain hat: flat brim, low crown, worn square
function flatBrimHat(color = 0x322d27) {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 10), mat(color, 0.7));
  g.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.24, 8), mat(color, 0.7));
  crown.position.y = 0.14;
  g.add(crown);
  return g;
}

// the plain bonnet: a soft cap with a little curved brim at the front
function makeBonnet(color = 0xcdc4b0) {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), mat(color, 0.85));
  cap.scale.set(1.1, 0.6, 1.0);
  g.add(cap);
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.2, 8, 1, true, -1.1, 2.2), mat(color, 0.85));
  brim.rotation.x = 0.35;
  brim.position.set(0, -0.02, 0.06);
  g.add(brim);
  return g;
}

// a work apron, worn over the wool
function makeApron(color = 0x5a6270) {
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.06), mat(color, 0.85));
  apron.position.set(0, 0.58, 0.62);
  apron.rotation.x = 0.12;
  return apron;
}

// band trees — same family as nature.js's, grown locally so the band can be
// planted deliberately (it is a hedge between neighbors, and a friendly one)
function makeOak(leaf = 0x55a055) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.9, 7), mat(0x6e5136));
  trunk.position.y = 0.95;
  g.add(trunk);
  const leafMat = mat(leaf, 0.95);
  for (const [x, y, z, r] of [[0, 2.9, 0, 1.55], [0.95, 2.45, 0.25, 1.0], [-0.85, 2.5, -0.3, 1.05]]) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
    blob.position.set(x, y, z);
    g.add(blob);
  }
  return g;
}

function makeFir() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.2, 7), mat(0x6e5136));
  trunk.position.y = 0.6;
  g.add(trunk);
  const needle = mat(0x4a8a4f, 0.95);
  for (const [r, h, y] of [[1.5, 1.6, 1.7], [1.15, 1.4, 2.8], [0.75, 1.2, 3.8]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), needle);
    cone.position.y = y;
    g.add(cone);
  }
  return g;
}

// the sign: painted board, block letters, no serif within a mile of here
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

// ------------------------------------------------------------- the fold ----

export function createFold() {
  const group = new THREE.Group();
  const updates = [];      // (dt, t, playerPos) — island zone only
  const kirkUpdates = [];  // (dt, t, playerPos) — kirk zone only
  const ST = SITES.steading, FF = SITES.foldFields, KY = SITES.kirkyard;

  // keyless on purpose: the HUD learns the name, the chart never does.
  // they asked. the chart, which ends at the Labs anyway, was gracious.
  addIslandInfo({
    name: 'The Fold', x: -194, z: -50, r: 24, icon: '🐑',
    blurb: '청원에 따라 모든 지도 바깥. 밀, 당근, 잼, 그리고 대구 성당.',
    folk: 'Elder Amos · Mercy · Patience · Obed · Small Mercy',
  });

  // ================================================== the HOUSE OF COD ----
  const KX = -199, KZ = -50; // the kirk, west side of the green, door east
  {
    const ky = terrainHeight(KX, KZ);
    const ext = new THREE.Group();
    // plinth first: plain folk do not float (see: the whole audit)
    const plinth = box(9.4, 1.4, 6.8, 0x8a8378);
    plinth.position.y = -0.55;
    ext.add(plinth);
    const nave = box(8.8, 3.4, 6.2, 0xe9e5da); // whitewash, no steeple. plain.
    nave.userData.occlude = true;
    nave.position.y = 1.7;
    ext.add(nave);
    // ridge runs east-west (along x): r ≈ (depth + eaves) / 1.73
    const roofGeo = new THREE.CylinderGeometry(4.05, 4.05, 9.6, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x5c5348));
    roof.scale.y = 0.45;
    roof.position.y = 3.4 + 4.05 * 0.45 / 2; // eaves ON the wall top, not below it
    roof.castShadow = roof.receiveShadow = true;
    ext.add(roof);
    // door on the gable end, facing the green
    const door = box(0.16, 2.2, 1.4, 0x4a3a2c); // flat ON the east gable (it stood out edgewise)
    door.position.set(4.46, 1.1, 0);
    ext.add(door);
    // the sign hangs out under the gable, saying the one thing it needs to
    const sign = signBoard('대구 성당');
    sign.position.set(4.98, 2.62, 0);
    sign.rotation.y = Math.PI / 2;
    ext.add(sign);
    for (const sz of [-1.3, 1.3]) {
      const rod = box(0.06, 0.7, 0.06, 0x4a3f33);
      rod.position.set(4.95, 3.25, sz);
      ext.add(rod);
    }
    // a wooden cod for a weathervane. wind-powered. permitted. beloved.
    const vanePost = box(0.08, 1.0, 0.08, 0x4a3f33);
    vanePost.position.set(0, 6.55, 0);
    ext.add(vanePost);
    const vane = makeCod(0.75, 0xc9b99a);
    vane.position.set(0, 7.05, 0);
    ext.add(vane);
    updates.push((dt) => { vane.rotation.y += dt * 0.22; }); // a very patient wind
    // two square windows a side, candle-warm after dark
    for (const sz of [-1, 1]) {
      for (const wx of [-1.9, 1.9]) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 0.08),
          mat(0xbfe6f2, 0.4));
        pane.position.set(wx, 1.9, sz * 3.14);
        pane.castShadow = false;
        ext.add(pane);
        glowWindow(pane, { max: 0.4 }); // candlelight, not current
      }
    }
    ext.position.set(KX, ky, KZ);
    group.add(ext);
    zones.addBlockerBox(KX, KZ, 9.4, 6.8, 0, 0.05);

    register({
      pos: new THREE.Vector3(KX + 5.4, 0, KZ), r: 2.2,
      label: '대구 성당에 들어가기',
      use: () => zones.go('kirk'),
    });
  }

  // ------------------------------------------------------ kirk interior ----
  {
    const roomStart = group.children.length;
    const B = IN_KIRK;
    const floor = box(11, 0.4, 14, 0x9a7b5a);
    floor.position.set(B.x, -0.2, B.z);
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [11, 4.6, 0.4, B.x, 2.3, B.z - 7],   // back wall, behind the lectern
      [0.4, 4.6, 14, B.x - 5.5, 2.3, B.z],
      [0.4, 4.6, 14, B.x + 5.5, 2.3, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xe9e5da));
      wall.receiveShadow = true;
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // pews: three honest rows a side, pale wood, no cushions to speak of
    for (let r = 0; r < 3; r++) {
      for (const sx of [-2.4, 2.4]) {
        const pew = box(3.4, 0.45, 0.85, 0x9a6a44);
        pew.position.set(B.x + sx, 0.22, B.z - 0.8 + r * 2.0);
        const back = box(3.4, 0.75, 0.16, 0x9a6a44);
        back.position.set(B.x + sx, 0.78, B.z - 0.42 + r * 2.0);
        group.add(pew, back);
      }
    }
    // the lectern: a post, a slanted top, and no notes because Amos lost them
    const post = box(0.3, 1.15, 0.3, 0x6e5136);
    post.position.set(B.x, 0.57, B.z - 4.6);
    const top = box(0.85, 0.1, 0.62, 0x6e5136);
    top.position.set(B.x, 1.2, B.z - 4.5);
    top.rotation.x = 0.35;
    group.add(post, top);
    // THE COD — carved, hung from the rafters, mid-congregation. it sways.
    const codRig = new THREE.Group();
    codRig.position.set(B.x, 4.4, B.z - 2.6);
    const rope1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), mat(0x8a7a5c, 0.95));
    rope1.position.set(-0.55, -0.65, 0);
    const rope2 = rope1.clone();
    rope2.position.set(0.55, -0.65, 0);
    codRig.add(rope1, rope2);
    const theCod = makeCod(1.5, 0xa97c50);
    theCod.position.set(0, -1.45, 0);
    codRig.add(theCod);
    group.add(codRig);
    kirkUpdates.push((dt, t) => { codRig.rotation.z = Math.sin(t * 0.6) * 0.05; });
    // candle stands, either side of the lectern — always lit, always modest
    for (const sx of [-2.6, 2.6]) {
      const stand = box(0.9, 0.85, 0.7, 0x55483a);
      stand.position.set(B.x + sx, 0.42, B.z - 4.4);
      group.add(stand);
      for (let i = 0; i < 3; i++) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.26 + (i % 3) * 0.07, 6), mat(0xf6efdc, 0.6));
        stick.position.set(B.x + sx - 0.22 + i * 0.22, 1.0, B.z - 4.4);
        group.add(stick);
        const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
          new THREE.MeshBasicMaterial({ color: 0xffd98f }));
        flame.castShadow = false;
        flame.position.set(B.x + sx - 0.22 + i * 0.22, 1.18 + (i % 3) * 0.035, B.z - 4.4);
        group.add(flame);
      }
    }
    // the harvest table: jars, a loaf, a lean of wheat. grace, in still life.
    const table = box(2.6, 0.75, 1.0, 0x8a5a3a);
    table.position.set(B.x - 3.6, 0.37, B.z + 5.6);
    group.add(table);
    const jarColors = [0x88b04b, 0xe08a2e, 0x6a5acd, 0x88b04b, 0xe08a2e];
    jarColors.forEach((c, i) => {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 7), mat(c, 0.5));
      jar.position.set(B.x - 4.5 + i * 0.42, 0.9, B.z + 5.5);
      jar.castShadow = true;
      group.add(jar);
    });
    const loaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat(0xc98d4e, 0.85));
    loaf.scale.set(1.5, 0.7, 0.9);
    loaf.position.set(B.x - 2.7, 0.86, B.z + 5.7);
    loaf.castShadow = true;
    group.add(loaf);
    for (let i = 0; i < 5; i++) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.9, 5), mat(0xd9b45a, 0.9));
      stalk.position.set(B.x - 2.0 + i * 0.05, 1.15, B.z + 5.4 + (i % 2) * 0.08);
      stalk.rotation.z = 0.5 - i * 0.04;
      group.add(stalk);
    }

    // Elder Amos, by the lectern, glad you came
    const amos = buildAnimal('sheep', { head: 0x45403a, wool: 0xf1ead9 });
    const amosHat = flatBrimHat();
    amosHat.position.set(0, 1.68, 0.18);
    amos.add(amosHat);
    amos.position.set(B.x + 0.9, 0.15, B.z - 3.9);
    amos.rotation.y = Math.PI * 0.8;
    group.add(amos);
    kirkUpdates.push((dt, t) => { amos.position.y = 0.15 + Math.sin(t * 1.4) * 0.02; });

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('kirk', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.1, x1: B.x + 5.1, z0: B.z - 5.6, z1: B.z + 6.8 },
      blockers: [
        { x: B.x, z: B.z - 4.6, r: 1.1 },        // lectern
        { x: B.x - 2.6, z: B.z - 4.4, r: 0.8 },  // candles
        { x: B.x + 2.6, z: B.z - 4.4, r: 0.8 },  // candles
        { x: B.x - 3.6, z: B.z + 5.6, r: 1.3 },  // harvest table
        // the pews: all three rows, seat and back, each a box its own size
        // (two rows of circles used to leave the back row, by the door, walk-through)
        ...[0, 1, 2].flatMap((r) => [-2.4, 2.4].map((sx) => ({ x: B.x + sx, z: B.z - 0.78 + r * 2.0, w: 3.4, d: 0.95 }))),
        { x: B.x + 0.9, z: B.z - 3.9, r: 0.5 },  // Elder Amos
      ],
      spawn: { x: B.x, z: B.z + 5.9, rotY: Math.PI },
      lighting: {
        bg: 0x241c12, fog: 0x241c12, fogNear: 22, fogFar: 60,
        hemiSky: 0xffe6bc, hemiGround: 0x66523c, hemiIntensity: 1.18,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 6.4), r: 1.8, zone: 'kirk',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: KX + 5.8, z: KZ, rotY: Math.PI / 2 }),
    });
    register({
      getPos: () => amos.position, r: 3.0, zone: 'kirk',
      label: '아모스 장로에게 말 걸기',
      use: () => amosMenu(),
    });
    register({
      pos: new THREE.Vector3(B.x - 2.4, 0, B.z + 0.4), r: 1.8, zone: 'kirk', priority: 0,
      label: '긴 의자에 앉기',
      use: async () => {
        await ui.fadeSwap(() => {});
        ui.say('앉아 있어요. 밖으로 수레가 삐걱거리며 지나가고, 어디선가 잼 병이 작고 만족스럽게 뽁 하고 닫혀요. 대구님이 말씀하신다면 이런 말씀이겠지요: 결국 모두에게 저녁이 있다고.');
      },
    });

    let amosIdx = { cod: 0, nb: 0, fold: 0 };
    async function amosMenu() {
      if (!S.hasFlag('metAmos')) {
        S.setFlag('metAmos');
        await ui.say([
          '어서 오세요, 나그네. 나는 아모스 장로이고, 여기는 대구 성당이에요. 신발을 닦고 싶으면 닦으세요 — 바닥은 어느 쪽이든 용서해요.',
          '우리는 소박한 사람들이에요. 농사짓고, 잼을 담고, 날씨 소리를 들어요. 그 전부에 당신도 환영이에요.',
        ], { speaker: '아모스 장로', voice: VOICE.amos });
      }
      const choice = await ui.ask('아모스 장로가 발굽을 모으고 온 마음으로 귀를 기울여요.', [
        { label: '🐟 Ask about the Cod', value: 'cod' },
        { label: '🔭 Ask about the neighbors', value: 'nb' },
        { label: '🌾 Ask about the Fold', value: 'fold' },
        { label: 'Go gently', value: null },
      ]);
      if (!choice) {
        ui.say('조심히 가시오, 벗이여. 날씨를 챙겨 가시오.', { speaker: '아모스 장로', voice: VOICE.amos });
        return;
      }
      const table = { cod: COD_LORE, nb: NEIGHBOR_LORE, fold: FOLD_LORE }[choice];
      ui.say(table[amosIdx[choice] % table.length], { speaker: '아모스 장로', voice: VOICE.amos });
      amosIdx[choice]++;
    }
  }

  // ================================================ walk-in rooms ----
  // every Fold building opens now: plain rooms, whitewashed, lamplit, each
  // furnished like the one who lives there. (Off in the elsewhere, like all
  // interiors.)
  let foldSlot = 0;
  function foldRoom(id, name, W, D, doorOut, dress) {
    const B = { x: 300 + foldSlot * 30, z: 2100 };
    foldSlot++;
    const start = group.children.length;
    const floor = box(W, 0.3, D, 0xa9855a);
    floor.position.set(B.x, -0.15, B.z);
    group.add(floor);
    for (const [w, h, d, x, z] of [
      [W, 3.2, 0.3, B.x, B.z - D / 2], [0.3, 3.2, D, B.x - W / 2, B.z], [0.3, 3.2, D, B.x + W / 2, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(dress.wall ?? 0xe9e5da));
      wall.position.set(x, 1.6, z);
      wall.receiveShadow = true;
      group.add(wall);
    }
    // a peg rail along the back wall — plain folk hang things up
    const rail = box(W - 1, 0.1, 0.1, 0x6e5136);
    rail.position.set(B.x, 2.1, B.z - D / 2 + 0.2);
    group.add(rail);
    for (let i = 0; i < Math.floor(W - 1); i++) {
      const peg = box(0.06, 0.06, 0.18, 0x4a3a2c);
      peg.position.set(B.x - (W - 1) / 2 + 0.5 + i, 2.1, B.z - D / 2 + 0.3);
      group.add(peg);
    }
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0xcfeaf6 }));
    win.position.set(B.x - W / 2 + 0.16, 1.7, B.z - 0.4);
    win.rotation.y = Math.PI / 2;
    group.add(win);
    const lamp = new THREE.PointLight(0xffd9a0, 22, 12, 2);
    lamp.position.set(B.x, 2.6, B.z);
    group.add(lamp);
    const blockers = [];
    const things = [];
    dress(B, W, D, blockers, things);
    const room = collectInteriorRoot(group, start);
    zones.registerInterior(id, {
      root: room, floorY: 0,
      bounds: { x0: B.x - W / 2 + 0.45, x1: B.x + W / 2 - 0.45, z0: B.z - D / 2 + 0.45, z1: B.z + D / 2 + 0.2 },
      blockers,
      spawn: { x: B.x, z: B.z + D / 2 - 0.3, rotY: Math.PI },
      lighting: { bg: 0x2a2018, fog: 0x2a2018, fogNear: 20, fogFar: 50, hemiSky: 0xfff0d8, hemiGround: 0x7a6448, hemiIntensity: 1.45, sunIntensity: 0 },
    });
    addZonePlace(id, name);
    zones.setDoor(id, doorOut);
    register({ pos: new THREE.Vector3(B.x, 0, B.z + D / 2), r: 1.6, zone: id, label: '밖으로 나가기', use: () => zones.leaveTo(doorOut) });
    for (const t of things) register({ ...t, zone: id, pos: new THREE.Vector3(B.x + t.at[0], 0, B.z + t.at[1]) });
  }
  // furniture, plain and sturdy
  function bed(x, z, quilt) {
    const frame = box(1.2, 0.45, 2.1, 0x6e5136);
    frame.position.set(x, 0.22, z);
    const mattress = box(1.1, 0.2, 1.9, 0xf1ead9);
    mattress.position.set(x, 0.55, z + 0.05);
    const q = box(1.14, 0.12, 1.3, quilt);
    q.position.set(x, 0.66, z + 0.35);
    const pillow = box(0.8, 0.14, 0.4, 0xfbf7ef);
    pillow.position.set(x, 0.7, z - 0.7);
    const head = box(1.2, 0.9, 0.12, 0x6e5136);
    head.position.set(x, 0.65, z - 1.05);
    group.add(frame, mattress, q, pillow, head);
  }
  function table(x, z, w = 1.4, d = 0.9) {
    const top = box(w, 0.08, d, 0x9a6a44);
    top.position.set(x, 0.78, z);
    group.add(top);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(0.08, 0.76, 0.08, 0x7a5230);
      leg.position.set(x + lx * (w / 2 - 0.08), 0.38, z + lz * (d / 2 - 0.08));
      group.add(leg);
    }
  }
  function chair(x, z, ry) {
    const c = new THREE.Group();
    const seat = box(0.5, 0.06, 0.5, 0x9a6a44);
    seat.position.y = 0.46;
    const back = box(0.5, 0.6, 0.06, 0x9a6a44);
    back.position.set(0, 0.78, -0.22);
    c.add(seat, back);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const leg = box(0.05, 0.46, 0.05, 0x7a5230);
      leg.position.set(lx, 0.23, lz);
      c.add(leg);
    }
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    group.add(c);
  }
  function hearth(x, z) {
    const stone = box(1.4, 1.1, 0.7, 0x8a8378);
    stone.position.set(x, 0.55, z);
    const mouth = box(0.8, 0.55, 0.1, 0x2e2620);
    mouth.position.set(x, 0.42, z + 0.34);
    const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffa050 }));
    glow.position.set(x, 0.3, z + 0.3);
    const flue = box(0.5, 2.0, 0.5, 0x8a8378);
    flue.position.set(x, 2.1, z - 0.05);
    const kettle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(0x3a3630, 0.5));
    kettle.position.set(x + 0.4, 1.22, z);
    group.add(stone, mouth, glow, flue, kettle);
  }
  function jars(x, y, z, n, colors) {
    for (let i = 0; i < n; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 7), mat(colors[i % colors.length], 0.3));
      jar.position.set(x + i * 0.24, y + 0.1, z);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 7), mat(0xf1ead9));
      lid.position.set(x + i * 0.24, y + 0.22, z);
      group.add(jar, lid);
    }
  }
  function shelf(x, y, z, w) {
    const sh = box(w, 0.06, 0.3, 0x9a6a44);
    sh.position.set(x, y, z);
    group.add(sh);
  }
  function rug(x, z, w, d, col) {
    const r = box(w, 0.03, d, col);
    r.position.set(x, 0.02, z);
    group.add(r);
  }
  const ROOMS = {
    mercy: { name: '🫙 Mercy’s House', W: 7, D: 6, dress: (B, W, D, bl, th) => {
      bed(B.x - 2.4, B.z - 1.6, 0xc97b8a); bl.push({ x: B.x - 2.4, z: B.z - 1.6, w: 1.3, d: 2.2 });
      hearth(B.x + 1.2, B.z - D / 2 + 0.55); bl.push({ x: B.x + 1.2, z: B.z - D / 2 + 0.55, w: 1.5, d: 0.8 });
      table(B.x + 1.6, B.z + 0.6, 1.6, 1.0); bl.push({ x: B.x + 1.6, z: B.z + 0.6, w: 1.7, d: 1.1 });
      chair(B.x + 1.6, B.z + 1.5, Math.PI); chair(B.x + 0.4, B.z + 0.6, Math.PI / 2);
      // the canning table: jars in every stage of becoming preserves
      jars(B.x + 1.0, 0.82, B.z + 0.6, 5, [0x9ac46a, 0xe8743a, 0xc4413a]);
      shelf(B.x - 0.6, 1.5, B.z - D / 2 + 0.3, 2.4); jars(B.x - 1.6, 1.53, B.z - D / 2 + 0.3, 9, [0x9ac46a, 0xe8743a, 0xc4413a, 0xd9b45a]);
      rug(B.x, B.z + 1.8, 2.2, 1.2, 0x8a6a8a);
      th.push({ at: [1.6, 1.0], r: 1.6, label: 'look at the canning table', use: () => ui.say('구스베리, 당근, 그리고 “응”이라고만 적힌 초록색 무언가. 병마다 종이 모자를 쓰고 있고, 모자마다 똑같이 정성스런 리본이 묶여 있어요.') });
    } },
    patience: { name: '🧵 Patience’s House', W: 7, D: 6, wall: 0xe6e0d0, dress: (B, W, D, bl, th) => {
      bed(B.x + 2.4, B.z - 1.6, 0x6a8a9a); bl.push({ x: B.x + 2.4, z: B.z - 1.6, w: 1.3, d: 2.2 });
      hearth(B.x - 1.4, B.z - D / 2 + 0.55); bl.push({ x: B.x - 1.4, z: B.z - D / 2 + 0.55, w: 1.5, d: 0.8 });
      // the quilting frame, a quilt half done, squares of every color she owns
      const frameT = box(2.2, 0.08, 1.6, 0x9a6a44); frameT.position.set(B.x - 1.2, 0.8, B.z + 0.8); group.add(frameT);
      const cols = [0xc97b8a, 0xe8c547, 0x6a8a9a, 0x9ac46a, 0xf1ead9, 0x8a6a8a];
      for (let i = 0; i < 12; i++) {
        const sq = box(0.34, 0.03, 0.34, cols[(i * 5) % cols.length]);
        sq.position.set(B.x - 1.95 + (i % 4) * 0.38, 0.86, B.z + 0.35 + Math.floor(i / 4) * 0.38);
        group.add(sq);
      }
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = box(0.08, 0.8, 0.08, 0x7a5230); leg.position.set(B.x - 1.2 + lx * 1.0, 0.4, B.z + 0.8 + lz * 0.7); group.add(leg);
      }
      bl.push({ x: B.x - 1.2, z: B.z + 0.8, w: 2.3, d: 1.7 });
      chair(B.x - 1.2, B.z + 1.9, Math.PI);
      rug(B.x + 1.2, B.z + 1.2, 1.6, 1.6, 0x9a7a4a);
      th.push({ at: [-1.2, 1.7], r: 1.6, label: 'look at the quilt', use: () => ui.say('반쯤 완성된 퀼트, 조각들이 줄줄이 핀으로 고정돼 있어요. 한 조각이 조금 삐뚤어요. 일부러 삐뚤게 두었지요: “완벽한 건 주님의 일뿐, 주님은 이걸 하고 계시지 않으니까.”') });
    } },
    obed: { name: '🌾 Obed’s House', W: 7, D: 6, dress: (B, W, D, bl, th) => {
      bed(B.x - 2.4, B.z - 1.6, 0x7a8a5a); bl.push({ x: B.x - 2.4, z: B.z - 1.6, w: 1.3, d: 2.2 });
      hearth(B.x + 1.8, B.z - D / 2 + 0.55); bl.push({ x: B.x + 1.8, z: B.z - D / 2 + 0.55, w: 1.5, d: 0.8 });
      table(B.x + 0.6, B.z + 0.8); bl.push({ x: B.x + 0.6, z: B.z + 0.8, w: 1.5, d: 1.0 });
      chair(B.x + 0.6, B.z + 1.6, Math.PI);
      // seed sacks and a pitchfork by the door; boots, muddy
      for (let i = 0; i < 3; i++) {
        const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat(0xc9b48a, 0.95));
        sack.scale.set(1, 1.2, 0.9); sack.position.set(B.x + 2.6, 0.38, B.z + 0.4 + i * 0.7); group.add(sack);
      }
      bl.push({ x: B.x + 2.6, z: B.z + 1.1, w: 0.8, d: 2.2 });
      const fork = box(0.06, 1.8, 0.06, 0x8a5a3a); fork.position.set(B.x - W / 2 + 0.3, 0.9, B.z + 1.8); fork.rotation.z = 0.15; group.add(fork);
      for (const sx of [-0.15, 0.15]) { const boot = box(0.18, 0.35, 0.35, 0x3a2e24); boot.position.set(B.x - 1.4 + sx, 0.17, B.z + D / 2 - 0.5); group.add(boot); }
      th.push({ at: [2.6, 1.1], r: 1.4, label: 'read the seed sacks', use: () => ui.say('콩. 귀리. 콩 더. 마지막 자루만 다른 필체로 적혀 있어요: “이건 심지 마, 오베드. 저녁 반찬이야.”') });
    } },
    amos: { name: '🐟 Elder Amos’s Hut', W: 5, D: 5, dress: (B, W, D, bl, th) => {
      bed(B.x - 1.3, B.z - 1.2, 0x8a8378); bl.push({ x: B.x - 1.3, z: B.z - 1.2, w: 1.3, d: 2.2 });
      // a writing desk, sermon pages in a drift, and a small carved cod
      table(B.x + 1.2, B.z - 0.6, 1.2, 0.8); bl.push({ x: B.x + 1.2, z: B.z - 0.6, w: 1.3, d: 0.9 });
      chair(B.x + 1.2, B.z + 0.2, Math.PI);
      for (let i = 0; i < 6; i++) {
        const pg = box(0.3, 0.01, 0.4, 0xf6f0de); pg.position.set(B.x + 0.9 + (i % 3) * 0.2, 0.83 + i * 0.004, B.z - 0.7 + Math.floor(i / 3) * 0.15); pg.rotation.y = i * 0.4; group.add(pg);
      }
      const cod = makeCod(0.35, 0xc9b99a); cod.position.set(B.x + 1.6, 1.0, B.z - 0.7); group.add(cod);
      rug(B.x, B.z + 0.9, 1.6, 1.2, 0x6a5a48);
      th.push({ at: [1.2, 0.0], r: 1.4, label: 'read the sermon pages', use: () => ui.say('“형제들이여: 대구는 내일을 걱정하지 않고, 내일 역시 공평하게도 대구를 걱정한 적이 없노라.” 아래에 여러 번 지운 흔적: “대구에 대해 더.”') });
    } },
  };

  // ======================================================== the cottages ----
  const knockSpots = [];
  function plainCottage(x, z, faceX, faceZ, wallColor, who, scale = 1) {
    const g = new THREE.Group();
    const y = terrainHeight(x, z);
    const W = 4.2 * scale, H = 2.5 * scale, D = 3.8 * scale;
    const plinth = box(W + 0.5, 1.3, D + 0.5, 0x8a8378);
    plinth.position.y = -0.5;
    g.add(plinth);
    const walls = box(W, H, D, wallColor);
    walls.userData.occlude = true;
    walls.position.y = H / 2;
    g.add(walls);
    const roofGeo = new THREE.CylinderGeometry((D + 0.7) / 1.73, (D + 0.7) / 1.73, W + 0.7, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x6b5a48));
    roof.scale.y = 0.5;
    roof.position.y = H + (D + 0.7) / 1.73 * 0.5 / 2; // eaves on the wall top
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    const door = box(1.0 * scale, 1.8 * scale, 0.15, 0x4a3a2c);
    door.position.set(0, 0.9 * scale, D / 2 + 0.05);
    g.add(door);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), mat(0xbfe6f2, 0.4));
    pane.castShadow = false;
    pane.position.set(-1.2 * scale, 1.5 * scale, D / 2 + 0.03);
    g.add(pane);
    glowWindow(pane, { max: 0.38 });
    // a window box: plain folk, not joyless folk
    const wbox = box(0.9, 0.2, 0.3, 0x6e5843);
    wbox.position.set(-1.2 * scale, 1.1 * scale, D / 2 + 0.18);
    g.add(wbox);
    for (let i = 0; i < 4; i++) {
      const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0),
        mat([0xe8c547, 0xf1ead9, 0xc97b8a, 0x9a7ac9][(i + (who.length % 4)) % 4], 0.7));
      bloom.position.set(-1.2 * scale - 0.3 + i * 0.2, 1.28 * scale, D / 2 + 0.2);
      g.add(bloom);
    }
    const chimney = box(0.5, 1.7, 0.5, 0x8a8378);
    chimney.position.set(W / 2 - 0.4, H + 1.3, -0.5);
    g.add(chimney);
    const rotY = Math.atan2(faceX - x, faceZ - z);
    g.rotation.y = rotY;
    g.position.set(x, y, z);
    group.add(g);
    zones.addBlockerBox(x, z, W + 0.5, D + 0.5, rotY, 0.05);
    const doorWorld = {
      x: x + Math.sin(rotY) * (D / 2 + 0.9),
      z: z + Math.cos(rotY) * (D / 2 + 0.9),
    };
    knockSpots.push({ ...doorWorld, who });
    const R = ROOMS[who];
    const zoneId = `fold_${who}`;
    foldRoom(zoneId, R.name, R.W, R.D, { ...doorWorld, rotY }, R.dress);
    let knocked = false;
    register({
      pos: new THREE.Vector3(doorWorld.x, 0, doorWorld.z), r: 1.8,
      label: `${who === 'amos' ? '아모스 장로' : { mercy: '머시', patience: '패이션스', obed: '오베드' }[who]}네 집에 들어가기`,
      use: async () => {
        // the first time, the note on the door; after that, straight in
        if (!knocked) { knocked = true; await ui.say(KNOCKS[who]); }
        zones.go(zoneId);
      },
    });
    return g;
  }

  // laid out around a real green now, a good neighborly stride apart (they
  // used to stand shoulder to shoulder with the kirk, which even plain folk
  // found a bit much)
  plainCottage(-191.5, -39.5, -191, -49, 0xd8d0bd, 'mercy');    // north of the green
  plainCottage(-195.5, -60.5, -193, -50, 0xcfc7b2, 'patience'); // south, facing in
  plainCottage(-188.5, -58.2, -184, -67, 0xd3ccc0, 'obed');     // faces the barn
  plainCottage(-208, -42.5, -199, -45, 0xd8d0bd, 'amos', 0.8);  // the elder's hut, up by the stones

  // ============================================ the little apple orchard ----
  // north-east of the green, where the ground was empty and felt it
  for (const [ax, az] of [[-184, -41.5], [-180.2, -42.8], [-182.6, -37.6], [-178.4, -38.9], [-186.2, -36.4]]) {
    const ay = terrainHeight(ax, az);
    if (ay < 0.6) continue;
    const tree = makeOak(0x5a9a50);
    tree.scale.setScalar(0.8 + rand(0, 0.15));
    tree.rotation.y = rand(0, Math.PI * 2);
    tree.position.set(ax, ay - 0.05, az);
    for (let k = 0; k < 5; k++) {
      const apple = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xc4413a, 0.6));
      const aa = (k / 5) * Math.PI * 2 + rand(-0.3, 0.3);
      // out on the leaves where they show, not buried in them
      const ay2 = 2.2 + rand(0, 0.6);
      let ar = 2.6;
      while (ar > 0.5 && ![[0, 2.9, 0, 1.55], [0.95, 2.45, 0.25, 1.0], [-0.85, 2.5, -0.3, 1.05]].some(([bx, by, bz, br]) =>
        Math.hypot(Math.cos(aa) * ar - bx, ay2 - by, Math.sin(aa) * ar - bz) < br)) ar -= 0.05;
      apple.position.set(Math.cos(aa) * (ar + 0.06), ay2, Math.sin(aa) * (ar + 0.06));
      tree.add(apple);
    }
    group.add(tree);
    zones.addBlocker(ax, az, 0.5, 'tree');
  }
  for (let i = 0; i < 26; i++) {
    const fx = rand(-200, -178), fz = rand(-62, -34);
    if (zones.nearBlocker(fx, fz, 1.2) || zones.solidAt(fx, fz) || terrainHeight(fx, fz) < 0.7) continue;
    if (Math.hypot(fx - (-190), fz - (-50.5)) < 4) continue; // the green stays a green
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 4), mat(0x4e9a45));
    stem.position.set(fx, terrainHeight(fx, fz) + 0.15, fz);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
      mat(pick([0xf1ead9, 0xe8c547, 0xb9a3e8, 0xe88a8a]), 0.7));
    bloom.position.set(fx, terrainHeight(fx, fz) + 0.33, fz);
    group.add(stem, bloom);
  }
  // mushrooms in the damp spots — under the orchard, by the hedges, and a
  // fairy ring out past the kirk that nobody at the Fold will talk about
  const capMats = [mat(0xc4413a, 0.7), mat(0xd9b48a, 0.8), mat(0xefe6d2, 0.8)];
  const stalkMat = mat(0xf3ecdc, 0.9);
  const shroom = (x, z, sc, ci) => {
    const y = terrainHeight(x, z);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * sc, 0.07 * sc, 0.22 * sc, 5), stalkMat);
    stalk.position.set(x, y + 0.11 * sc, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17 * sc, 0.14 * sc, 7), capMats[ci]);
    cap.position.set(x, y + 0.27 * sc, z);
    group.add(stalk, cap);
    if (ci === 0) { // the red ones get their spots
      for (let k = 0; k < 3; k++) {
        const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025 * sc, 0), stalkMat);
        const a = k * 2.1;
        dot.position.set(x + Math.cos(a) * 0.08 * sc, y + 0.29 * sc, z + Math.sin(a) * 0.08 * sc);
        group.add(dot);
      }
    }
  };
  for (let i = 0; i < 34; i++) {
    const fx = rand(-202, -178), fz = rand(-64, -32);
    if (zones.nearBlocker(fx, fz, 0.6) || zones.solidAt(fx, fz) || terrainHeight(fx, fz) < 0.7) continue;
    const n = 1 + Math.floor(rand(0, 3)); // they come in little families
    for (let k = 0; k < n; k++) shroom(fx + rand(-0.4, 0.4), fz + rand(-0.4, 0.4), rand(0.8, 1.4), Math.floor(rand(0, 3)));
  }
  {
    const RX = -203, RZ = -38;
    if (terrainHeight(RX, RZ) > 0.6) {
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2;
        const x = RX + Math.cos(a) * 1.6, z = RZ + Math.sin(a) * 1.6;
        if (!zones.solidAt(x, z)) shroom(x, z, 1.1, 2);
      }
    }
  }

  // ==================================================== the green: stall ----
  const STALL = { x: -185.5, z: -47.5 }; // east edge of the green
  let mercy;
  {
    const sy = terrainHeight(STALL.x, STALL.z);
    const g = new THREE.Group();
    const counter = box(2.6, 0.9, 0.9, 0x8a5a3a);
    counter.position.y = 0.45;
    g.add(counter);
    for (const sx of [-1.15, 1.15]) {
      const postS = box(0.12, 2.2, 0.12, 0x6e5843);
      postS.position.set(sx, 1.1, -0.25);
      g.add(postS);
    }
    const awning = box(3.0, 0.12, 1.6, 0x9a958c);
    awning.position.set(0, 2.2, -0.1);
    awning.rotation.x = -0.12;
    g.add(awning);
    // the wares: a rank of jars, colors telling flavors
    const flavors = [0x88b04b, 0xe08a2e, 0x6a5acd];
    for (let i = 0; i < 6; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 7), mat(flavors[i % 3], 0.5));
      jar.position.set(-1.0 + i * 0.4, 1.05, 0);
      jar.castShadow = true;
      g.add(jar);
    }
    const rotY = Math.atan2(ST.x - STALL.x, ST.z - STALL.z); // face the green
    g.rotation.y = rotY;
    g.position.set(STALL.x, sy, STALL.z);
    group.add(g);
    zones.addBlocker(STALL.x, STALL.z, 1.4);

    // Mercy, behind the counter, glad of the company
    mercy = buildAnimal('sheep', { head: 0x6e5a48, wool: 0xf1ead9 });
    const bonnetM = makeBonnet(0xcdc4b0);
    bonnetM.position.set(0, 1.62, 0.14);
    mercy.add(bonnetM);
    mercy.add(makeApron(0x5a6270));
    const behind = { x: STALL.x - Math.sin(rotY) * 1.4, z: STALL.z - Math.cos(rotY) * 1.4 };
    mercy.position.set(behind.x, terrainHeight(behind.x, behind.z), behind.z);
    mercy.rotation.y = rotY;
    group.add(mercy);

    const JARS = [
      { id: 'preserves_goose', label: '🫙 구스베리 잼', name: '구스베리 잼', emoji: '🫙', price: 7 },
      { id: 'preserves_carrot', label: '🥕 당근 마멀레이드', name: '당근 마멀레이드', emoji: '🥕', price: 7 },
      { id: 'preserves_plum', label: '🫐 바다자두 잼', name: '바다자두 잼', emoji: '🫐', price: 8 },
    ];
    register({
      pos: new THREE.Vector3(
        STALL.x + Math.sin(rotY) * 1.5, 0, STALL.z + Math.cos(rotY) * 1.5), r: 2.0,
      label: '잼 구경하기',
      use: async () => {
        const picked = await ui.ask('병들이 자랑스러운 소규모 대열로 서 있어요. 라벨은 하나하나 손글씨고, 뚜껑은 하나같이 정정당당하게 굴복당한 티가 나요.', [
          ...JARS.map((j) => ({
            label: j.label, value: j.id, hint: `${j.price}🔘`,
            disabled: S.state.buttons < j.price,
          })),
          { label: '구경만 할래요', value: null },
        ]);
        const j = JARS.find((x) => x.id === picked);
        if (!j) return;
        S.spend(j.price);
        S.addItem(j.id);
        kaching();
        ui.updateHUD();
        ui.toast(`You bought <b>${j.name}</b>. The jar is heavier than it looks, the way good things are.`, j.emoji);
      },
    });
    register({
      getPos: () => mercy.position, r: 3.4, // the radius crosses the counter. learned that one.
      label: '머시에게 말 걸기',
      use: () => ui.say(pick(MERCY_CHAT), { speaker: 'Mercy', voice: VOICE.mercy }),
    });
  }

  // the well: a working one. wishes go in the bucket like everything else.
  {
    const WX = -190, WZ = -50.5; // the middle of the green
    const wy = terrainHeight(WX, WZ);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.7, 8), mat(0x8a8378));
    ring.position.set(WX, wy + 0.35, WZ);
    ring.castShadow = ring.receiveShadow = true;
    group.add(ring);
    for (const sx of [-0.75, 0.75]) {
      const postW = box(0.1, 1.3, 0.1, 0x6e5843);
      postW.position.set(WX + sx, wy + 1.0, WZ);
      group.add(postW);
    }
    const crossbar = box(1.7, 0.1, 0.1, 0x6e5843);
    crossbar.position.set(WX, wy + 1.6, WZ);
    group.add(crossbar);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 7), mat(0x6e5136, 0.8));
    bucket.position.set(WX, wy + 1.15, WZ);
    bucket.castShadow = true;
    group.add(bucket);
    zones.addBlocker(WX, WZ, 1.1);
    register({
      pos: new THREE.Vector3(WX, 0, WZ + 1.4), r: 1.6,
      label: '우물 들여다보기',
      use: () => ui.say('어둡고 참을성 있는 물. 거울처럼 비친 당신이 하늘을 모자처럼 쓰고 올려다봐요. 동전은 없어요 — 이 근처에서 소원이란 심는 거니까요.'),
    });
  }

  // ========================================================== the barn ----
  const BARN = { x: -184, z: -67 };
  {
    const by = terrainHeight(BARN.x, BARN.z);
    const g = new THREE.Group();
    const plinth = box(7.6, 1.2, 5.6, 0x8a8378);
    plinth.position.y = -0.45;
    g.add(plinth);
    const walls = box(7, 3.2, 5, 0x8a4a3a); // oxblood, weathered honest
    walls.userData.occlude = true;
    walls.position.y = 1.6;
    g.add(walls);
    const roofGeo = new THREE.CylinderGeometry((5 + 0.9) / 1.73, (5 + 0.9) / 1.73, 7.8, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x6b5a48));
    roof.scale.y = 0.55;
    roof.position.y = 3.2 + (5 + 0.9) / 1.73 * 0.55 / 2;
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    // big doors on the gable end, one honestly ajar
    const doorL = box(1.1, 2.4, 0.15, 0x5c4034);
    doorL.position.set(-0.6, 1.2, 2.56);
    g.add(doorL);
    const doorR = box(1.1, 2.4, 0.15, 0x5c4034);
    doorR.position.set(0.75, 1.2, 2.42);
    doorR.rotation.y = 0.35;
    g.add(doorR);
    // hayloft window, dark and sweet-smelling
    const loft = box(0.9, 0.7, 0.1, 0x2e2620);
    loft.position.set(0, 2.7, 2.55);
    g.add(loft);
    const rotY = Math.atan2(-187.2 - BARN.x, -59.6 - BARN.z); // gable to the farmhouse
    g.rotation.y = rotY;
    g.position.set(BARN.x, by, BARN.z);
    group.add(g);
    zones.addBlockerBox(BARN.x, BARN.z, 7.3, 5.3, rotY, 0.05);
    // the barn opens too: hay, a loft, a stall with a calf in it, tools on pegs
    const barnDoor = { x: BARN.x + Math.sin(rotY) * 3.6, z: BARN.z + Math.cos(rotY) * 3.6, rotY };
    foldRoom('fold_barn', '🐄 The Barn', 10, 8, barnDoor, (B, W, D, bl, th) => {
      for (const [x, z, st] of [[-3.8, -2.8, 3], [-2.6, -2.9, 2], [-3.7, -1.8, 1], [3.8, -2.9, 2]]) {
        for (let k = 0; k < st; k++) {
          const bale = box(1.1, 0.6, 0.8, 0xd9b45a);
          bale.position.set(B.x + x, 0.3 + k * 0.6, B.z + z);
          bale.rotation.y = k * 0.2;
          group.add(bale);
        }
        bl.push({ x: B.x + x, z: B.z + z, w: 1.2, d: 0.9 });
      }
      // the loft, on posts, with a ladder
      const loftF = box(W - 0.4, 0.15, 2.2, 0x9a6a44);
      loftF.position.set(B.x, 2.4, B.z - D / 2 + 1.25);
      group.add(loftF);
      for (const x of [-3, 0, 3]) { const p = box(0.14, 2.4, 0.14, 0x7a5230); p.position.set(B.x + x, 1.2, B.z - D / 2 + 2.3); group.add(p); bl.push({ x: B.x + x, z: B.z - D / 2 + 2.3, r: 0.15 }); }
      const ladder = new THREE.Group();
      for (const sx of [-0.25, 0.25]) { const rl = box(0.06, 2.6, 0.06, 0x8a5a3a); rl.position.set(sx, 1.3, 0); ladder.add(rl); }
      for (let r = 0; r < 7; r++) { const rung = box(0.5, 0.05, 0.05, 0x8a5a3a); rung.position.set(0, 0.3 + r * 0.35, 0); ladder.add(rung); }
      ladder.position.set(B.x + 1.5, 0, B.z - D / 2 + 2.45);
      ladder.rotation.x = -0.2;
      group.add(ladder);
      for (let k = 0; k < 4; k++) { const b = box(1.0, 0.5, 0.7, 0xd9b45a); b.position.set(B.x - 3 + k * 1.4, 2.73, B.z - D / 2 + 1.0); group.add(b); }
      // a stall, a calf, a pail
      const rail1 = box(0.1, 1.1, 2.4, 0x7a5230); rail1.position.set(B.x + 2.2, 0.55, B.z + 1.2); group.add(rail1);
      const rail2 = box(2.4, 1.1, 0.1, 0x7a5230); rail2.position.set(B.x + 3.4, 0.55, B.z + 0.0); group.add(rail2);
      bl.push({ x: B.x + 2.2, z: B.z + 1.2, w: 0.3, d: 2.5 }, { x: B.x + 3.4, z: B.z + 0.0, w: 2.5, d: 0.3 });
      const calf = buildAnimal('cow', { body: 0xf1ead9, head: 0xf1ead9 });
      calf.scale.setScalar(0.7);
      calf.position.set(B.x + 3.5, 0, B.z + 1.5);
      calf.rotation.y = -Math.PI / 2;
      calf.userData.fidget = true;
      group.add(calf);
      bl.push({ x: B.x + 3.5, z: B.z + 1.5, r: 0.9 });
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 8), mat(0x9aa3ad, 0.4));
      pail.position.set(B.x + 1.7, 0.15, B.z + 2.2); group.add(pail);
      for (let i = 0; i < 4; i++) {
        const tool = box(0.06, 1.3, 0.06, 0x8a5a3a);
        tool.position.set(B.x - W / 2 + 0.25, 1.4, B.z - 0.5 + i * 0.5); tool.rotation.x = 0.1;
        group.add(tool);
      }
      th.push({ at: [3.4, 0.6], r: 2.2, label: 'say hello to the calf', use: () => ui.say('(송아지가 크고 느긋한 눈으로 당신을 바라보다가 다시 건초를 바라봐요. 평가가 끝났어요. 아마 합격이에요.)') });
      th.push({ at: [1.5, -1.3], r: 1.4, label: 'look up at the loft', use: () => ui.say('건초가 서까래까지 쌓여 있어요. 저 위에서 작은 무언가가 공손하게 재채기를 해요. 아마 쥐예요. 아마 크럼은 아니에요. 아마요.') });
    });
    register({
      pos: new THREE.Vector3(barnDoor.x, 0, barnDoor.z), r: 2.0,
      label: '헛간에 들어가기',
      use: () => zones.go('fold_barn'),
    });
    // hay bales, stacked with the particular pride of stacked hay
    for (const [hx, hz, hr] of [[BARN.x + 4.4, BARN.z + 1.2, 0], [BARN.x + 4.6, BARN.z + 2.4, 0.4], [BARN.x + 4.5, BARN.z + 1.8, 0]]) {
      const bale = box(1.1, 0.7, 0.8, 0xd9b45a);
      bale.position.set(hx, terrainHeight(hx, hz) + 0.35 + (hr ? 0.7 : 0), hz);
      bale.rotation.y = hr;
      group.add(bale);
    }
    zones.addBlocker(BARN.x + 4.5, BARN.z + 1.8, 1.2);
  }

  // wheelbarrows: one holding hay, one holding the idea of carrots
  function wheelbarrow(x, z, rotY, cargo) {
    const g = new THREE.Group();
    const tray = box(0.9, 0.3, 1.3, 0x6e5843);
    tray.position.y = 0.45;
    g.add(tray);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), mat(0x4a3f33, 0.7));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.22, 0.75);
    wheel.castShadow = true;
    g.add(wheel);
    for (const sx of [-0.32, 0.32]) {
      const handle = box(0.07, 0.07, 0.8, 0x6e5843);
      handle.position.set(sx, 0.42, -0.85);
      handle.rotation.x = -0.15;
      g.add(handle);
    }
    for (const sx of [-0.3, 0.3]) {
      const legW = box(0.07, 0.4, 0.07, 0x6e5843);
      legW.position.set(sx, 0.2, -0.45);
      g.add(legW);
    }
    if (cargo === 'hay') {
      const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0xd9b45a, 0.95));
      heap.scale.y = 0.6;
      heap.position.y = 0.72;
      heap.castShadow = true;
      g.add(heap);
    } else if (cargo === 'carrots') {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), mat(0xe08a2e, 0.7));
        c.rotation.z = Math.PI / 2 + i * 0.3;
        c.position.set(-0.15 + i * 0.16, 0.68, -0.1 + (i % 2) * 0.2);
        c.castShadow = true;
        g.add(c);
      }
    }
    g.rotation.y = rotY;
    g.position.set(x, terrainHeight(x, z), z);
    group.add(g);
    zones.addBlocker(x, z, 0.8);
  }
  wheelbarrow(-181.6, -66.2, 0.7, 'hay');
  wheelbarrow(-182.2, -58.4, -0.5, 'carrots');

  // ======================================================= the fields ----
  {
    // wheat, in rows, each stalk leaning its own honest lean
    for (let cx = 0; cx < 5; cx++) {
      for (let rz = 0; rz < 7; rz++) {
        const x = -178 + cx * 1.4 + rand(-0.15, 0.15);
        const z = -69 + rz * 1.4 + rand(-0.15, 0.15);
        if (Math.hypot(x - BARN.x, z - BARN.z) < 4.6) continue;
        const y = terrainHeight(x, z);
        if (y < 0.5) continue;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.85, 5), mat(0xd9b45a, 0.95));
        stalk.position.set(x, y + 0.42, z);
        stalk.rotation.z = rand(-0.09, 0.09);
        stalk.castShadow = true;
        group.add(stalk);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 5), mat(0xe3c26a, 0.95));
        head.position.set(x + stalk.rotation.z * -0.85, y + 0.98, z);
        head.castShadow = true;
        group.add(head);
      }
    }
    // carrots: rows of tops, one already pulled and forgotten in the excitement
    for (let cx = 0; cx < 4; cx++) {
      for (let rz = 0; rz < 3; rz++) {
        const x = -185 + cx * 1.2 + rand(-0.12, 0.12);
        const z = -61.5 + rz * 1.2 + rand(-0.12, 0.12);
        const y = terrainHeight(x, z);
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 5), mat(0x4f8a52, 0.95));
        tuft.position.set(x, y + 0.12, z);
        tuft.castShadow = true;
        group.add(tuft);
      }
    }
    const dropped = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), mat(0xe08a2e, 0.7));
    dropped.rotation.z = Math.PI / 2 + 0.3;
    dropped.position.set(-183.4, terrainHeight(-183.4, -57.6) + 0.08, -57.6);
    dropped.castShadow = true;
    group.add(dropped);

    // the scarecrow wears the uniform. the crows appreciate the formality.
    const SC = { x: -175.3, z: -64.5 };
    const scy = terrainHeight(SC.x, SC.z);
    const poleS = box(0.09, 2.0, 0.09, 0x6e5843);
    poleS.position.set(SC.x, scy + 1.0, SC.z);
    group.add(poleS);
    const arms = box(1.5, 0.09, 0.09, 0x6e5843);
    arms.position.set(SC.x, scy + 1.45, SC.z);
    group.add(arms);
    const smock = box(0.6, 0.8, 0.35, 0x5a6270);
    smock.position.set(SC.x, scy + 1.15, SC.z);
    group.add(smock);
    const headS = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), mat(0xd9b45a, 0.95));
    headS.position.set(SC.x, scy + 1.95, SC.z);
    headS.castShadow = true;
    group.add(headS);
    const hatS = flatBrimHat(0x322d27);
    hatS.position.set(SC.x, scy + 2.16, SC.z);
    hatS.rotation.z = 0.12;
    group.add(hatS);
    zones.addBlocker(SC.x, SC.z, 0.5);
    register({
      pos: new THREE.Vector3(SC.x, 0, SC.z), r: 1.8, priority: 0,
      label: '허수아비 바라보기',
      use: () => ui.say('수수한 모자와 수수한 작업복을 입고, 영원히 온화한 환영의 표정을 짓고 있어요. 한쪽 팔에 까마귀가 앉아 전혀 겁내지 않는데, 관련된 모두가 언급하지 않기로 했어요.'),
    });
  }

  // split-rail fences along the field edges, gapped where feet actually go
  function fenceRun(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / 1.7);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const y = terrainHeight(x, z);
      const postF = box(0.09, 0.75, 0.09, 0x6e5843);
      postF.position.set(x, y + 0.37, z);
      group.add(postF);
      if (i < n) {
        const nx = x0 + (x1 - x0) * ((i + 1) / n), nz = z0 + (z1 - z0) * ((i + 1) / n);
        const ny = terrainHeight(nx, nz);
        for (const railY of [0.55, 0.28]) {
          const rail = box(Math.hypot(nx - x, nz - z) + 0.1, 0.06, 0.05, 0x7a6a52);
          rail.position.set((x + nx) / 2, (y + ny) / 2 + railY, (z + nz) / 2);
          rail.rotation.y = Math.atan2(nx - x, nz - z) + Math.PI / 2;
          rail.rotation.z = Math.atan2(ny - y, Math.hypot(nx - x, nz - z));
          group.add(rail);
        }
      }
    }
  }
  fenceRun(-187, -70.8, -171.5, -70.8); // south edge of the wheat
  fenceRun(-170.8, -70.5, -170.8, -58.5); // east edge, toward the band

  // ===================================================== the kirkyard ----
  {
    const G = { x: -201.5, z: -41 };
    // a low fieldstone wall, gapped on the kirk side. steppable, in a pinch;
    // everyone uses the gap anyway, out of respect.
    const runs = [
      [-205, -43.7, -202, -43.7], [-199.8, -43.7, -198, -43.7], // south, gapped
      [-205, -38.2, -198, -38.2], // north
      [-205, -43.7, -205, -38.2], // west
      [-198, -43.7, -198, -38.2], // east
    ];
    for (const [x0, z0, x1, z1] of runs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const segs = Math.max(1, Math.round(len / 1.4));
      for (let i = 0; i < segs; i++) {
        const t = (i + 0.5) / segs;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const seg = box(len / segs + 0.08, 0.34 + rand(-0.04, 0.04), 0.32, 0x8a8378);
        seg.position.set(x, terrainHeight(x, z) + 0.17, z);
        seg.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2 + rand(-0.03, 0.03);
        group.add(seg);
      }
    }
    // the stones: two patient rows, kept clear of moss out of love
    let si = 0;
    for (const rowZ of [-42.4, -40.2]) {
      for (let i = 0; i < (rowZ === -42.4 ? 4 : 3); i++) {
        const x = -204 + i * 1.5 + rand(-0.1, 0.1);
        const z = rowZ + rand(-0.1, 0.1);
        const y = terrainHeight(x, z);
        const tall = si === 3;
        const stone = box(0.5, tall ? 0.85 : 0.6, 0.16, 0x9a958c);
        stone.position.set(x, y + (tall ? 0.42 : 0.3), z);
        stone.rotation.x = rand(-0.05, 0.05);
        stone.rotation.z = rand(-0.06, 0.06);
        group.add(stone);
        const cap = box(0.56, 0.1, 0.2, 0x8a857c);
        cap.position.set(x, y + (tall ? 0.87 : 0.62), z);
        cap.rotation.z = stone.rotation.z;
        group.add(cap);
        zones.addBlocker(x, z, 0.4);
        si++;
      }
    }
    // the yard oak, older than the wall, consulted on all major decisions
    const oak = makeOak(0x4f9151);
    oak.scale.setScalar(1.2);
    oak.position.set(-198.9, terrainHeight(-198.9, -38.9), -38.9);
    group.add(oak);
    zones.addBlocker(-198.9, -38.9, 0.7);

    let stoneIdx = 0;
    register({
      pos: new THREE.Vector3(G.x, 0, G.z), r: 2.8,
      label: '돌비석 읽기',
      use: () => {
        ui.say(EPITAPHS[stoneIdx % EPITAPHS.length]);
        stoneIdx++;
      },
    });
  }

  // ============================================== the west shore: cod ----
  {
    // a beached dory, resting exactly as hard as it worked
    const DX = -208.5, DZ = -52.3;
    const dy = terrainHeight(DX, DZ);
    // hull the same family as the dock rowboats, beached and resting
    const dory = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 0.6, 7), mat(0x8a5a3a));
    hull.scale.z = 2.0;
    hull.rotation.y = Math.PI / 7;
    hull.position.y = 0.28;
    dory.add(hull);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.4, 0.42, 7), mat(0xc9b178));
    inner.scale.z = 1.9;
    inner.rotation.y = Math.PI / 7;
    inner.position.y = 0.42;
    dory.add(inner);
    const thwart = box(1.0, 0.09, 0.26, 0x6e5136);
    thwart.position.set(0, 0.52, -0.2);
    dory.add(thwart);
    dory.rotation.y = 0.5;
    dory.rotation.z = 0.06; // heeled just so, the way boats rest
    dory.position.set(DX, dy, DZ);
    group.add(dory);
    zones.addBlocker(DX, DZ, 1.3);

    // the drying rack: three cod, becoming keepable. the Cod provides;
    // the rack makes sure it keeps providing into February.
    const RX = -207.5, RZ = -48.8;
    const ry = terrainHeight(RX, RZ);
    for (const sx of [-1.1, 1.1]) {
      const postR = box(0.1, 1.7, 0.1, 0x6e5843);
      postR.position.set(RX + sx, ry + 0.85, RZ);
      group.add(postR);
    }
    const bar = box(2.5, 0.08, 0.08, 0x6e5843);
    bar.position.set(RX, ry + 1.62, RZ);
    group.add(bar);
    for (let i = 0; i < 3; i++) {
      const fish = makeCod(0.5, 0xc9b99a);
      fish.rotation.z = -Math.PI / 2; // hung by the tail, as is proper
      fish.position.set(RX - 0.7 + i * 0.7, ry + 1.18, RZ);
      group.add(fish);
    }
    zones.addBlocker(RX, RZ, 0.9);
    register({
      pos: new THREE.Vector3(RX, 0, RZ + 1.2), r: 1.7, priority: 0,
      label: '대구 생각하기',
      use: () => ui.say('대구 세 마리가 바닷바람에 말라가며 겨울을 날 준비를 잘 하고 있어요. 믿음이 끝나고 식료품 창고가 시작되는 지점을 말하기 어렵고, 여기 사람들 누구도 그걸 구분하길 바라지 않아요.'),
    });
  }

  // ================================================ the band + the stile ----
  {
    // a friendly hedge of trees between the Fold and the Labs, with one gap
    // where the footpath goes. both sides planted it. neither remembers whose
    // idea it was, which is the best sign.
    for (let i = 0; i < 16; i++) {
      const x = rand(-171, -163.5);
      const z = rand(-71, -33);
      if (Math.abs(z + 54) < 2.8) continue; // the footpath keeps its gap
      const y = terrainHeight(x, z);
      if (y < 0.6) continue;
      const tree = i % 3 === 0 ? makeOak() : makeFir();
      tree.scale.setScalar(rand(0.85, 1.2));
      tree.rotation.y = rand(0, Math.PI * 2);
      tree.position.set(x, y - 0.05, z);
      group.add(tree);
      zones.addBlocker(x, z, 0.8 * tree.scale.x, 'tree'); // a hedge you walk AROUND
    }
    // the stile: two steps over nothing in particular. built for the look of
    // the thing, and for sitting on, which is most of what stiles are for.
    const SX = -166.8, SZ = -54;
    const sy = terrainHeight(SX, SZ);
    const step1 = box(0.9, 0.3, 0.5, 0x7a6a52);
    step1.position.set(SX, sy + 0.15, SZ + 0.5);
    const step2 = box(0.9, 0.3, 0.5, 0x7a6a52);
    step2.position.set(SX, sy + 0.4, SZ);
    const step3 = box(0.9, 0.3, 0.5, 0x7a6a52);
    step3.position.set(SX, sy + 0.15, SZ - 0.5);
    group.add(step1, step2, step3);
    for (const sz of [-0.8, 0.8]) {
      const postT = box(0.09, 0.9, 0.09, 0x6e5843);
      postT.position.set(SX, sy + 0.45, SZ + sz);
      group.add(postT);
    }
  }

  // ======================================================== the folk ----
  // Patience and Obed walk their rounds; Small Mercy orbits the green.
  const walkers = [];
  function addFolk(name, kind, colors, points, lines, voice, opts = {}) {
    const a = buildAnimal(kind, colors);
    if (opts.scale) a.scale.setScalar(opts.scale);
    if (opts.hat) { opts.hat.position.set(0, 1.66, 0.16); a.add(opts.hat); }
    if (opts.bonnet) { opts.bonnet.position.set(0, 1.62, 0.14); a.add(opts.bonnet); }
    if (opts.apron) a.add(opts.apron);
    a.position.set(points[0].x, terrainHeight(points[0].x, points[0].z), points[0].z);
    group.add(a);
    const w = { g: a, points, seg: 0, speed: opts.speed ?? 1.1, pause: rand(0, 2) };
    walkers.push(w);
    register({
      getPos: () => a.position, r: 2.4,
      label: `talk to ${name}`,
      use: () => ui.say(pick(lines), { speaker: name, voice }),
    });
    return w;
  }

  addFolk('패이션스', 'sheep', { head: 0x7a746a, wool: 0xf1ead9 }, [
    { x: -183.5, z: -60.5 }, { x: -179, z: -58.5 }, { x: -175, z: -61 },
    { x: -176.5, z: -66.5 }, { x: -181, z: -63 },
  ], PATIENCE_CHAT, VOICE.patience, {
    bonnet: makeBonnet(0xb9c0b9), apron: makeApron(0x4f5a4f), speed: 1.0,
  });

  addFolk('오베드', 'sheep', { head: 0x3a3630, wool: 0xece4d0 }, [
    // (round the cottage's east end, not through it; and starting clear of Patience)
    { x: -179.6, z: -63.6 }, { x: -185.5, z: -62.4 }, { x: -184.3, z: -57.5 }, { x: -186.5, z: -53.6 },
    { x: -191, z: -54.4 }, { x: -185.5, z: -53.5 },
  ], OBED_CHAT, VOICE.obed, {
    hat: flatBrimHat(), speed: 1.2,
  });

  addFolk('리틀 머시', 'sheep', { head: 0x8a7a68, wool: 0xf6f1e4 }, [
    { x: -187.3, z: -50.8 }, { x: -189.6, z: -47.6 }, { x: -192.7, z: -49.8 },
    { x: -190.4, z: -53.4 }, // round and round the well, as lambs do
  ], LAMB_CHAT, VOICE.lamb, {
    scale: 0.62, speed: 1.6, // small legs, big agenda
  });

  // everything solid casts and catches the light honestly
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.transparent) return;
    if (o.material.emissive && o.material.emissiveIntensity > 0) return;
    if (o.material.isMeshBasicMaterial) return; // candle flames glow, cast nothing
    o.castShadow = true;
    o.receiveShadow = true;
  });

  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'kirk') {
      for (const fn of kirkUpdates) fn(dt, t, playerPos);
      return;
    }
    if (zone !== 'island') return;
    for (const fn of updates) fn(dt, t, playerPos);

    // the rounds: walk, pause, consider, continue
    for (const w of walkers) {
      if (w.pause > 0) {
        w.pause -= dt;
        animateGait(w.g, t, 0);
        // company is worth stopping for
        if (playerPos && w.pause > 0.2) {
          const dxp = playerPos.x - w.g.position.x, dzp = playerPos.z - w.g.position.z;
          if (Math.hypot(dxp, dzp) < 5) {
            w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dxp, dzp), dt, 4);
          }
        }
        continue;
      }
      const target = w.points[w.seg];
      const dx = target.x - w.g.position.x, dz = target.z - w.g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) {
        w.seg = (w.seg + 1) % w.points.length;
        w.pause = 1.6 + Math.random() * 2.8;
        continue;
      }
      const step = Math.min(w.speed * dt, d);
      const nx = w.g.position.x + (dx / d) * step, nz = w.g.position.z + (dz / d) * step;
      // after you: two folk meeting on a path wait rather than walk through each other
      if (walkers.some((o) => o !== w && Math.hypot(o.g.position.x - nx, o.g.position.z - nz) < 1.1 &&
          Math.hypot(o.g.position.x - nx, o.g.position.z - nz) < Math.hypot(o.g.position.x - w.g.position.x, o.g.position.z - w.g.position.z))) {
        animateGait(w.g, t, 0);
        continue;
      }
      if (playerPos && Math.hypot(playerPos.x - nx, playerPos.z - nz) < 1.0 &&
          Math.hypot(playerPos.x - nx, playerPos.z - nz) < Math.hypot(playerPos.x - w.g.position.x, playerPos.z - w.g.position.z)) {
        animateGait(w.g, t, 0); // you're in the way; they wait, politely
        continue;
      }
      w.g.position.x = nx;
      w.g.position.z = nz;
      w.g.position.y = zones.islandGroundHeight(w.g.position.x, w.g.position.z);
      w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dx, dz), dt, 6);
      animateGait(w.g, t, 1);
    }

    // Mercy minds the stall but is delighted you're here
    if (playerPos && mercy) {
      const dxm = playerPos.x - mercy.position.x, dzm = playerPos.z - mercy.position.z;
      const dm = Math.hypot(dxm, dzm);
      const restY = Math.atan2(ST.x - STALL.x, ST.z - STALL.z);
      mercy.rotation.y = turnToward(mercy.rotation.y,
        dm < 6 ? Math.atan2(dxm, dzm) : restY, dt, 4);
    }

    // the welcome: once, gently, when you first come over the rise
    if (playerPos && !S.hasFlag('seenFold') &&
        Math.hypot(playerPos.x - ST.x, playerPos.z - ST.z) < 16) {
      S.setFlag('seenFold');
      ui.toast('지도는 한참 전에 끝났어요. 농장들은 아니고요.', '🐑');
    }
  }

  return { group, update };
                         }
