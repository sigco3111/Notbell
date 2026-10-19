// The north isle: moss with tenure, mushrooms in committee, a library, a
// doctor for an island where nobody gets sick, and — parked forever — the
// Buttonwagon. Reached by the natural stone arch the sea carved itself.

import * as THREE from 'three';
import { SITES, ISLAND3, terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal } from './animals.js';
import { jingle, sip, kaching } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { makeWindow, makeRectWindow, makeHangingLamp, makeCeilingTube } from './buildings.js';
import { glowWindow } from './nightglow.js';

// where the MouseBoat is moored — houses.js puts Crumb to bed on its deck
export let MOUSEBOAT = null;

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

const IN = {
  library: { x: 300, z: 1060 },
  clinic: { x: 300, z: 1140 },
};

// The Quiet Stacks hold real volumes from the wider world shelved cheek-by-jowl
// with the island's own. Each of the four stacks is anchored to one shelf; you
// draw a single book at random from whichever you're standing at, so the same
// passage never turns up at two positions. Verse uses " / " line breaks (the
// dialogue box collapses real newlines, and white-space:pre-wrap would change
// every other dialogue). The real excerpts are public domain, quoted verbatim.
const STACKS3 = [
  // — salt water —
  [
    {
      title: '《모비 딕》, 허먼 멜빌 지음.',
      note: '바닷물에 불었고, 도서관 규정을 훌쩍 넘겨 읽혔다.',
      passage: '나를 이스마엘이라 불러라. 몇 년 전인지 정확히는 상관없이, 지갑에 돈도 거의 없고 육지에서 딱히 흥미로운 일도 없던 나는 조금 항해하며 세상의 물기 어린 부분을 보기로 했다.',
      voice: 430,
    },
    {
      title: '《바다도 듣고 있다》, 듣는 이들의 벗 지음.',
      passage: '첫 번째 가르침: 바다는 대답하지 않는다. 두 번째 가르침: 그것이 듣지 않는다는 뜻은 아니다. 우리는 여기서 종을 울리지 않는다 — 종이 남겼을 고요를 지킬 뿐이다.',
      voice: 470,
    },
    {
      title: '〈월야(月夜)〉, 두보(杜甫) 지음.',
      note: '플로런스 아이스코, 에이미 로웰 영역, 1921.',
      passage: [
        '오늘밤 부주의 달 / 규방 한가운데서 / 홀로 그것을 바라보네 / 나는 멀리 있지만 어린 아들과 딸을 사랑하네 / 아이들은 장안을 생각할 줄 모르네.',
        '향기로운 안개가 구름 머리장식을 적시고 / 옥 같은 팔이 서늘하겠네 / 이 맑고 눈부신 달빛 속에서 / 언제 외로운 병풍에 기대볼까 / 언제 함께 달빛을 받아 눈물 자국이 마를까?',
      ],
      voice: 520,
    },
    {
      title: '《내가 휘파람 분 배들》, E. 브라인 선장 지음.',
      note: '서명이 번져 있고, 은은히 축축하다.',
      passage: '배는 가리키는 곳으로 가되 가는 내내 토라져 있거나, 제멋대로 가고 그걸 선술이라 부르게 해 준다. 나는 배 400척에 휘파람을 불었다. 두 척이 답했다. 두 번째 배에 대해서는 말하지 않는다.',
      voice: 360,
    },
  ],
  // — quiet rooms —
  [
    {
      title: '《제인 에어》, 샬럿 브론테 지음.',
      note: '바랜 리본이 끝에서 아주 가까운 페이지를 표시해 두었다.',
      passage: '독자 여러분, 저는 그와 결혼했습니다. 조용한 결혼식이었지요. 그와 저, 목사님과 사무원만 자리했습니다.',
      voice: 560,
    },
    {
      title: '〈봄의 고요〉, 크리스티나 로제티 지음.',
      passage: '여기 해는 / 가장 그늘지게 비치고 / 여기 들리는 메아리는 / 먼 바다의 것, / 아무리 멀어도.',
      voice: 600,
    },
    {
      title: '《이끼: 한 사랑 이야기 (무삭제판, 전 9권)》',
      passage: '제6권. 그는 움직이지 않았다. 그녀도 그러했다. 두 사람 사이에서 참을성 있는 초록이 돌 위로 영웅적인 1인치를 기어갔다 — 그리고 화자는 감정을 담아 장담한다, 이것이 누구에게든 일어난 일 중 최고라고.',
      voice: 580,
    },
  ],
  // — the sky, and other large ideas —
  [
    {
      title: '《전쟁과 평화》, 레프 톨스토이 지음.',
      note: '놓여 있던 선반보다 무겁다.',
      passage: '피에르에게는 이 혜성이 자신의 부드러워지고 고양된 영혼 속에서 지나가고 있는 것, 이제 새 삶으로 꽃피고 있는 것에 온전히 화답하는 것처럼 보였다.',
      voice: 500,
    },
    {
      title: '〈희망은 깃털 달린 것〉, 에밀리 디킨슨 지음.',
      passage: [
        '희망은 깃털 달린 것 / 영혼에 내려앉아 / 가사 없는 노래를 부르고 / 결코 멈추지 않는다,',
        '질풍 속에서 가장 달콤하게 들린다 / 그리고 얼마나 거센 폭풍이어야 / 그토록 많은 이를 따뜻하게 지킨 / 작은 새를 부끄럽게 할 수 있을까.',
      ],
      voice: 640,
    },
    {
      title: '《실용 유령 돌보기》',
      note: '누군가 아주 차가운 잉크로 여백에 “고마워요”라고 써 두었다.',
      passage: '1장: 유령을 정돈할 수는 없지만 물건을 찾기 쉽게 둘 수는 있다. 2장: 잘 닦인 갈고리는 하나의 배려. 3장: 놋쇠가 이미 반짝이고 있다면 누가 했는지 묻지 말 것.',
      voice: 420,
    },
  ],
  // — the island’s own —
  [
    {
      title: '《레 미제라블》, 빅토르 위고 지음.',
      note: '이사벨 F. 해프굿 영역, 1887.',
      passage: '“아름다운 것은 유용한 것만큼 유용하다.” 잠시 뜸을 들인 뒤 덧붙였다, “어쩌면 더 그러하다.”',
      voice: 480,
    },
    {
      title: '《나는 고양이로소이다》, 나쓰메 소세키 지음.',
      note: '안토 간이치 영역, 1906.',
      passage: '나는 고양이다. 아직 이름은 없다. 어디서 태어났는지도 전혀 모른다. 다만 어둑하고 축축한 곳에서 야옹거리고 있었고, 거기서 인간이라는 동물을 처음 보았다는 것만 어렴풋이 기억한다.',
      voice: 600,
    },
    {
      title: '《북쪽 섬의 식용 버섯》, 빼곡한 주석 달림.',
      passage: '9번, 얼룩덜룩갓: 저자는 버터 볶음을 권한다. 여백이 더 굳은 필체로 답한다: “안 돼.” 10번: “이것도 안 돼.” 마침내 11번: “좋아. 하지만 이것만. 이유는 펀만 알아.”',
      voice: 520,
    },
    {
      title: '《등대지기의 일지, 1–34년 차》, 늙은 탠지 지음.',
      note: '마지막 페이지가 없다.',
      passage: '22년 차, 예의 없는 안개. 배들이 전부 무사 귀항으로 확인될 때까지 해질녘부터 종을 울렸다. 좋은 종은 등대의 일 절반을 하면서도 단 한 번도 공을 요구하지 않는다. — T.',
      voice: 540,
    },
  ],
];
const ALL_BOOKS3 = STACKS3.flat(); // Vesper lends from the whole library

const VESPER_LORE = [
  '기록이요? 음. 나는 섬의 기억을 종이에 간직해요. 펀이 돌에 간직하고 동굴이 빛에 간직하는 것처럼요.',
  '탠지의 일지는 문장 중간에 끝나요, 아시다시피. 마지막 페이지가 없거든요. 아마 종이 있는 곳 어디쯤에 있겠죠. “바다” 항목에 분류되어 있을 거예요.',
  '아치 위 이끼가 도서관보다 나이가 많아요. 나는 그걸 수석 사서로 여겨요. 서로 다투지 않아요.',
];

const GILL_CHAT = [
  '기억 속에서 이 섬들에서 아픈 사람은 아무도 없었어요. 나는 경치 때문에, 그리고 원칙상 남아 있어요.',
  '팔을 한 번 잃은 적 있어요. 다시 자랐지만요. 취미로는 권하지 않지만, 파티에서는 엄청난 사실이에요.',
  '양치하고, 창문을 조금 열고 자고, 매일 누군가에게 가장 좋아하는 구름을 말하세요. 의사의 처방이에요.',
];

const FROG_LINES = [
  '팔굽혀펴기를 하고 있어요. 잘 보인다는 걸 알고 있어요.',
  '색은 “위험”이라고 말해요. 얼굴은 “모임에 불러 줘”라고 말해요.',
  '한쪽 눈을 깜빡이고 다른 쪽을 깜빡여요. 솔직히 자랑하는 거예요.',
  '절대 집어 올리면 안 돼요. 그리고 얘는 아름다움의 외로움과 화해했어요.',
];

export function createIsland3() {
  const group = new THREE.Group();
  const updates = [];
  const T = SITES.town3;
  const ty = terrainHeight(T.x, T.z);

  // ------------------------------------------------- the natural arch ----
  {
    const len0 = Math.hypot(ISLAND3.x, ISLAND3.z);
    const dir = { x: ISLAND3.x / len0, z: ISLAND3.z / len0 };
    let tA = 24;
    while (terrainHeight(dir.x * (tA + 0.5), dir.z * (tA + 0.5)) >= 0.15) tA += 0.5;
    let tB = len0 - 14;
    while (terrainHeight(dir.x * (tB - 0.5), dir.z * (tB - 0.5)) >= 0.15) tB -= 0.5;
    const A = { x: dir.x * tA, z: dir.z * tA };
    const LEN = tB - tA;
    const along = dir;
    const perp = { x: -dir.z, z: dir.x };
    const hA = terrainHeight(A.x, A.z);
    const hB = terrainHeight(dir.x * tB, dir.z * tB);
    const archY = (t) => hA + (hB - hA) * t + Math.sin(t * Math.PI) * 3.9 + 0.5;

    zones.addCrossing({
      contains(x, z) {
        const dx = x - A.x, dz = z - A.z;
        const t = (dx * along.x + dz * along.z) / LEN;
        if (t < -0.02 || t > 1.02) return false;
        return Math.abs(dx * perp.x + dz * perp.z) < 1.8; // the whole cap stone, edge to edge
      },
      height(x, z) {
        const t = Math.max(0, Math.min(1, ((x - A.x) * along.x + (z - A.z) * along.z) / LEN));
        return archY(t);
      },
    });
    // the arch is a road as well as a ridge (zones routes: Notbell ⇄ North)
    zones.addLink({
      a: 'notbell', b: 'north', kind: 'walk',
      path: [
        { x: A.x - along.x * 3, z: A.z - along.z * 3 }, { x: A.x, z: A.z },
        { x: A.x + along.x * LEN, z: A.z + along.z * LEN },
        { x: A.x + along.x * (LEN + 3), z: A.z + along.z * (LEN + 3) },
      ],
    });
    // nobody builds a cottage on the arch's feet
    zones.addKeepout(A.x - along.x * 3, A.z - along.z * 3, 5.5);
    zones.addKeepout(A.x + along.x * (LEN + 3), A.z + along.z * (LEN + 3), 7);
    zones.addKeepout(A.x + along.x * (LEN + 9), A.z + along.z * (LEN + 9), 5);

    // It's LAND, not a bridge: one solid ridge of rock the sea wore through
    // in a single place — a tunnel in the middle, tall enough for the
    // Persistent's funnel. Barnacles on the tide line, moss drooping off the
    // shoulders, and nothing under it but rock and sea.
    const TUN_T = 0.5;                    // the tunnel sits under the crown
    const TUN_HALF = 3.4;                 // half its width, along the ridge
    const TUN_TOP = WATER_Y + 3.5;        // crown of the tunnel ceiling
    const TOP_W = 4.1, BASE_W = 6.4;      // rock width at the path / at the sea
    const tunnelCeil = (alongD) => {
      const u = (alongD - TUN_T * LEN) / TUN_HALF;
      return Math.abs(u) >= 1 ? null : WATER_Y + (TUN_TOP - WATER_Y) * Math.sqrt(1 - u * u);
    };
    const STONES = [0x7d8287, 0x73807a, 0x6e7873, 0x7a7f78];
    const heading = Math.atan2(along.x, along.z);
    const SL = 1.2; // slice length
    const slices = Math.ceil(LEN / SL);
    for (let i = 0; i <= slices; i++) {
      const t = i / slices;
      const d = t * LEN;
      const px = A.x + along.x * d, pz = A.z + along.z * d;
      const deck = archY(t);
      const floor = Math.min(terrainHeight(px, pz), WATER_Y) - 0.6;
      const ceil = tunnelCeil(d);
      // the walking stone: a cap slab (moss on top of it, sometimes)
      const cap = box(TOP_W + rand(-0.2, 0.3), 0.7, SL + 0.35, STONES[i % 4]);
      cap.position.set(px, deck - 0.35, pz);
      cap.rotation.y = heading + rand(-0.03, 0.03);
      cap.receiveShadow = true;
      group.add(cap);
      // the body of the ridge: upper shoulders, then a wider foot in the sea.
      // under the tunnel, only the lintel above the ceiling remains.
      // one tapered block per slice: narrow at the path, spreading into the
      // sea like a real ridge (a box whose top face is pinched inward)
      const top = deck - 0.65, bot = ceil === null ? floor : ceil;
      if (top - bot > 0.1) {
        const wBot = ceil === null ? BASE_W + rand(-0.5, 0.5) : TOP_W + 0.9;
        const wTop = TOP_W + 0.4 + rand(-0.2, 0.2);
        const geo = new THREE.BoxGeometry(wBot, top - bot, SL + 0.45);
        const pos = geo.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          if (pos.getY(v) > 0) pos.setX(v, pos.getX(v) * (wTop / wBot));
        }
        geo.computeVertexNormals();
        const rock = new THREE.Mesh(geo, mat(STONES[(i + 1) % 4], 0.95));
        rock.position.set(px + perp.x * rand(-0.15, 0.15), (top + bot) / 2, pz + perp.z * rand(-0.15, 0.15));
        rock.rotation.y = heading + rand(-0.05, 0.05);
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
      }
      // boulders slumped at the waterline soften the foot into the sea
      if (ceil === null && i % 2 === 0 && t > 0.06 && t < 0.94) {
        for (const side of [-1, 1]) {
          const bol = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.8, 1.3), 0), mat(STONES[(i + 2) % 4], 0.95));
          bol.scale.y = 0.7;
          const off = side * (BASE_W / 2 + rand(-0.2, 0.3));
          bol.position.set(px + perp.x * off, WATER_Y + rand(-0.3, 0.1), pz + perp.z * off);
          bol.castShadow = true;
          group.add(bol);
        }
      }
      // moss: a green mat on the path's edges, drooping over the shoulders
      if (i % 2 === 0) {
        const mossTop = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.6), 0), mat(0x4f8a52, 0.95));
        mossTop.scale.y = 0.25;
        mossTop.position.set(px + perp.x * rand(-1.4, 1.4), deck + 0.02, pz + perp.z * rand(-1.4, 1.4));
        group.add(mossTop);
      }
      for (const side of [-1, 1]) {
        if ((i + (side > 0 ? 0 : 1)) % 3) continue;
        const drape = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), mat(i % 2 ? 0x5e975e : 0x4f8a52, 0.95));
        drape.scale.set(0.35, 1.5 + rand(0, 0.8), 0.9);
        const off = side * ((TOP_W + 0.5) / 2 + 0.12);
        drape.position.set(px + perp.x * off, deck - 0.9, pz + perp.z * off);
        drape.rotation.y = heading;
        drape.castShadow = true;
        group.add(drape);
      }
      // barnacles crust the tide line — ON the rock face, not beside it
      if (t > 0.08 && t < 0.92) {
        for (const side of [-1, 1]) {
          // the face slopes: find its half-width right at the tide line
          const kf = (WATER_Y + 0.3 - floor) / Math.max(0.1, deck - 0.65 - floor);
          const faceW = ceil === null ? (BASE_W + (TOP_W + 0.4 - BASE_W) * kf) / 2 : null;
          if (faceW === null) continue;
          for (let b = 0; b < 3; b++) {
            const barn = new THREE.Mesh(new THREE.ConeGeometry(rand(0.08, 0.13), 0.12, 6), mat(0xe8e4d8, 0.6));
            const along2 = rand(-SL / 2, SL / 2);
            const off = side * (faceW + 0.03);
            barn.rotation.set(0, heading, side * Math.PI / 2); // point out of the rock
            barn.position.set(
              px + along.x * along2 + perp.x * off,
              WATER_Y + rand(-0.1, 0.7),
              pz + along.z * along2 + perp.z * off);
            group.add(barn);
          }
        }
      }
    }
    // the tunnel mouth wears moss curtains and a barnacle rim
    for (const end of [-1, 1]) {
      const d = TUN_T * LEN + end * TUN_HALF;
      for (let k = -2; k <= 2; k++) {
        const drape = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(0x5e975e, 0.95));
        drape.scale.set(0.8, 1.3, 0.3);
        const lat = k * 1.1;
        const dd = d - end * 0.4;
        drape.position.set(A.x + along.x * dd + perp.x * lat, (tunnelCeil(dd) ?? TUN_TOP) - 0.35, A.z + along.z * dd + perp.z * lat);
        drape.rotation.y = heading;
        group.add(drape);
      }
    }
    // rock is solid from the sea's side too — except the tunnel
    zones.addSeaWall({
      contains(x, z) {
        const dx = x - A.x, dz = z - A.z;
        const dAlong = dx * along.x + dz * along.z;
        if (dAlong < -1 || dAlong > LEN + 1) return false;
        if (Math.abs(dx * perp.x + dz * perp.z) > BASE_W / 2 + 0.9) return false;
        return Math.abs(dAlong - TUN_T * LEN) > TUN_HALF - 0.9;
      },
    });
    zones.addSeaGate({
      a: { x: A.x, z: A.z }, b: { x: A.x + along.x * LEN, z: A.z + along.z * LEN },
      x: A.x + along.x * TUN_T * LEN, z: A.z + along.z * TUN_T * LEN,
      nx: perp.x, nz: perp.z,
    });
  }

  // ------------------------------------------------------- moss & such ----
  const flora = [];
  const TREE_STRUCTURE_CLEARANCE = 3;
  const treeKeepouts = [
    { x: T.x - 5.5, z: T.z - 3, r: 4.2 + TREE_STRUCTURE_CLEARANCE },
    { x: T.x + 5.5, z: T.z - 3, r: 3.8 + TREE_STRUCTURE_CLEARANCE },
    { x: T.x, z: T.z + 6.5, r: 2.8 + TREE_STRUCTURE_CLEARANCE },
    { x: T.x + 3.5, z: T.z + 5.5, r: 1.8 + TREE_STRUCTURE_CLEARANCE },
  ];
  function clearOfTreeKeepouts(x, z) {
    if (zones.nearBlocker(x, z, TREE_STRUCTURE_CLEARANCE)) return false;
    return !treeKeepouts.some((k) => Math.hypot(x - k.x, z - k.z) < k.r);
  }
  function placeOnIsle(minH, maxH, tries = 40, opts = {}) {
    for (let i = 0; i < tries; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand(0, 1)) * (ISLAND3.r + 2);
      const x = ISLAND3.x + Math.cos(a) * r, z = ISLAND3.z + Math.sin(a) * r;
      if (Math.hypot(x - T.x, z - T.z) < T.r - 2) continue;
      if (opts.trees && !clearOfTreeKeepouts(x, z)) continue;
      const h = terrainHeight(x, z);
      if (h < minH || h > maxH) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.2)) continue;
      flora.push({ x, z });
      return { x, z, h };
    }
    return null;
  }

  const shroomSpots = [];
  const forestTrees = [];
  for (let i = 0; i < 34; i++) {
    const s = placeOnIsle(0.5, 6);
    if (!s) continue;
    const cluster = new THREE.Group();
    const n = 1 + Math.floor(rand(0, 3));
    for (let k = 0; k < n; k++) {
      const red = rand(0, 1) < 0.5;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, rand(0.25, 0.5), 5), mat(0xe8e0d0, 0.8));
      const sx = rand(-0.35, 0.35), sz = rand(-0.35, 0.35);
      stem.position.set(sx, 0.2, sz);
      cluster.add(stem);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rand(0.18, 0.3), rand(0.18, 0.28), 7), mat(red ? 0xd84f4f : 0xc9a06a, 0.8));
      cap.position.set(sx, 0.42, sz);
      cluster.add(cap);
      if (red) {
        for (let d = 0; d < 3; d++) {
          const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), mat(0xfff6e8, 0.6));
          const da = rand(0, Math.PI * 2);
          dot.position.set(sx + Math.cos(da) * 0.13, 0.47, sz + Math.sin(da) * 0.13);
          cluster.add(dot);
        }
      }
    }
    cluster.position.set(s.x, s.h, s.z);
    cluster.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(cluster);
    shroomSpots.push(s);
  }
  for (let i = 0; i < 22; i++) {
    const s = placeOnIsle(0.4, 6);
    if (!s) continue;
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.4, 0.9), 0), mat(pick([0x4f8a52, 0x5e975e, 0x3f7a45]), 0.95));
    moss.scale.y = rand(0.18, 0.3);
    moss.position.set(s.x, s.h + 0.05, s.z);
    group.add(moss);
  }
  for (let i = 0; i < 9; i++) {
    const s = placeOnIsle(0.8, 6, 40, { trees: true });
    if (!s) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 1.7, 7), mat(0x4a3f32));
    trunk.position.y = 0.85;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.4, 1.9), 1), mat(pick([0x3f7a45, 0x4f8a52]), 0.95));
    crown.position.y = 2.6;
    crown.scale.y = 0.85;
    tree.add(crown);
    const drape = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x5e975e, 0.95));
    drape.scale.set(0.6, 1.4, 0.6);
    drape.position.set(rand(-1, 1), 1.8, rand(-0.6, 0.6));
    tree.add(drape);
    tree.position.set(s.x, s.h - 0.05, s.z);
    tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(tree);
    forestTrees.push(tree);
  }

  // ---------------------------------------------------------- library ----
  const libSpot = { x: T.x - 5.5, z: T.z - 3 };
  {
    const ly = terrainHeight(libSpot.x, libSpot.z);
    const ext = new THREE.Group();
    const walls = box(6.8, 3.4, 5.8, 0x9a8a78);
    walls.position.y = 1.7;
    ext.add(walls);
    // r sized to wall depth: a 3-cylinder spans 1.73×r across the ridge
    // (5.8-deep walls need r≈3.7; scale.y keeps the same apex) — B18
    const roofGeo = new THREE.CylinderGeometry(3.7, 3.7, 7.2, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x3f7a45));
    roof.scale.y = 0.52;
    roof.position.y = 4.2;
    roof.castShadow = true;
    ext.add(roof);
    const door = box(1.2, 2.0, 0.18, 0x4a3f32);
    door.position.set(0, 1.0, 2.91);
    ext.add(door);
    for (const sx of [-2, 2]) {
      const win = makeRectWindow(0.85, 1.0);
      win.position.set(sx, 1.9, 2.92);
      ext.add(win);
    }
    const mossRoof = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat(0x4f8a52, 0.95));
    mossRoof.scale.y = 0.3;
    mossRoof.position.set(-1.5, 4.6, 0.5);
    ext.add(mossRoof);
    ext.position.set(libSpot.x, ly, libSpot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    zones.addBlockerBox(libSpot.x, libSpot.z, 6.8, 5.8, 0, 0.05);

    const B = IN.library;
    const roomStart = group.children.length;
    const floor = box(16, 0.4, 12, 0x7a5a40);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [16, 5.0, 0.4, B.x, 2.5, B.z - 6],
      [0.4, 5.0, 12, B.x - 8, 2.5, B.z],
      [0.4, 5.0, 12, B.x + 8, 2.5, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xd9cbb0));
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // stacks: tall shelves with rows of colorful spines — one anchored book
    // collection (STACKS3) per shelf; press E at a shelf to read a random one
    const spineColors = [0xc25b4e, 0x5b8bc9, 0x6fae5c, 0xd9a440, 0x8a5a8a];
    const SHELF_X = [-6.2, -2.2, 1.8, 5.8];
    SHELF_X.forEach((sx, i) => {
      const shelf = box(3.2, 3.6, 0.9, 0x6b4a2e);
      shelf.position.set(B.x + sx, 1.8, B.z - 5.2);
      group.add(shelf);
      for (let row = 0; row < 4; row++) {
        for (let bIdx = 0; bIdx < 7; bIdx++) {
          const spine = box(0.28, 0.62, 0.16, spineColors[(row + bIdx + Math.abs(sx) | 0) % 5]);
          spine.position.set(B.x + sx - 1.25 + bIdx * 0.42, 0.7 + row * 0.86, B.z - 4.72);
          group.add(spine);
        }
      }
      register({
        pos: new THREE.Vector3(B.x + sx, 0, B.z - 4.6), r: 2.2, zone: 'library',
        label: '책 읽기',
        use: async () => {
          const book = pick(STACKS3[i]);
          const body = Array.isArray(book.passage) ? book.passage : [book.passage];
          await ui.say([book.note ? `${book.title} ${book.note}` : book.title, ...body],
            { voice: book.voice ?? 480 });
        },
      });
    });
    const ladder = new THREE.Group();
    for (const lx of [-0.3, 0.3]) {
      const rail = box(0.08, 3.4, 0.08, 0x8a6f4d);
      rail.position.set(lx, 1.7, 0);
      ladder.add(rail);
    }
    for (let rIdx = 0; rIdx < 5; rIdx++) {
      const rung = box(0.6, 0.07, 0.07, 0x8a6f4d);
      rung.position.set(0, 0.5 + rIdx * 0.62, 0);
      ladder.add(rung);
    }
    ladder.position.set(B.x + 3.6, 0, B.z - 4.5);
    ladder.rotation.x = -0.12;
    group.add(ladder);
    // reading nook + desk
    const nook = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), mat(0xc25b4e, 0.95));
    nook.scale.y = 0.4;
    nook.position.set(B.x + 5.5, 0.3, B.z + 2.5);
    group.add(nook);
    const leftNook = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), mat(0x5b8bc9, 0.95));
    leftNook.scale.y = 0.4;
    leftNook.position.set(B.x + 4.1, 0.3, B.z + 4.0); // beside the red cushion, a little diagonal
    leftNook.castShadow = true;
    leftNook.receiveShadow = true;
    group.add(leftNook);
    const desk = box(2.6, 1.0, 1.2, 0x6b4a2e);
    desk.position.set(B.x - 4, 0.5, B.z + 1);
    group.add(desk);
    const deskLamp = makeHangingLamp(0x3f7a45); // library green, low over the good chair
    deskLamp.position.set(B.x - 4, 2.85, B.z + 1);
    group.add(deskLamp);
    const openBook = box(0.7, 0.06, 0.5, 0xfff6e8);
    openBook.position.set(B.x - 4, 1.06, B.z + 1);
    openBook.rotation.y = 0.3;
    group.add(openBook);

    const vesper = buildAnimal('bat', { body: 0x6a5a78, head: 0x6a5a78 });
    vesper.userData.fidget = true;
    vesper.position.set(B.x - 4, 0, B.z - 0.2);
    group.add(vesper);
    wireBob(vesper, updates, 0.8);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('library', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 7.6, x1: B.x + 7.6, z0: B.z - 4.0, z1: B.z + 5.5 },
      blockers: [
        { x: B.x - 4, z: B.z + 1, r: 1.5 },
        { x: B.x + 4.1, z: B.z + 4.0, r: 1.0 }, // 2nd cushion (moved beside the red one)
        { x: B.x + 5.5, z: B.z + 2.5, r: 1.0 },
      ],
      spawn: { x: B.x, z: B.z + 4.8, rotY: Math.PI },
      lighting: {
        bg: 0x241f18, fog: 0x241f18, fogNear: 24, fogFar: 60,
        hemiSky: 0xf2e2c0, hemiGround: 0x5a4a38, hemiIntensity: 1.2,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(libSpot.x, 0, libSpot.z + 3.6), r: 2.6,
      label: '조용한 서고에 들어가기',
      use: () => zones.go('library'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 5.2), r: 1.6, zone: 'library',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: libSpot.x, z: libSpot.z + 4.6, rotY: 0 }),
    });

    let loreIdx = 0;
    register({
      getPos: () => vesper.position, r: 3, zone: 'library',
      label: '베스퍼와 대화하기',
      use: async () => {
        if (!S.hasFlag('metVesper')) {
          S.setFlag('metVesper');
          await ui.say([
            '박쥐 한 마리가 책상 램프에 거꾸로 매달려 책을 읽고 있어요. 아주 위엄 있게 몸을 바로 해요.',
            '“베스퍼예요. 사서죠. 할 수 있으면 속삭이고, 어쩔 수 없으면 중얼거려요. 조용한 서고에 온 걸 환영해요.”',
          ], { speaker: '베스퍼', voice: 540 });
          return;
        }
        const choice = await ui.ask('음?', [
          { label: '📖 책 빌리기', value: 'borrow' },
          { label: '기록에 대해 묻기', value: 'lore' },
          { label: '나가기', value: null },
        ], { speaker: '베스퍼', voice: 540 });
        if (choice === 'borrow') {
          const book = pick(ALL_BOOKS3);
          jingle();
          ui.toast(`${book.title} 빌렸어요. 반납 기한: 아무때나.`, '📖');
          await ui.say('책등 펴지 않기, 귀 접지 않기, 이끼가 눈치채기 전에 반납하기. 늘 하던 조건이에요.',
            { speaker: '베스퍼', voice: 540 });
        } else if (choice === 'lore') {
          await ui.say(VESPER_LORE[loreIdx++ % VESPER_LORE.length], { speaker: '베스퍼', voice: 540 });
        }
      },
    });
  }

  // ----------------------------------------------------------- clinic ----
  const clinSpot = { x: T.x + 5.5, z: T.z - 3 };
  {
    const cy = terrainHeight(clinSpot.x, clinSpot.z);
    const ext = new THREE.Group();
    const plinth = box(5.9, 1.3, 5.3, 0xd6d2c8); // footing against the hillside (B18)
    plinth.position.y = -0.45;
    ext.add(plinth);
    const walls = box(5.6, 3.0, 5.0, 0xf0ece4);
    walls.userData.occlude = true;
    walls.position.y = 1.5;
    ext.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.0, 4), mat(0x5b8bc9));
    roof.position.y = 3.9;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    ext.add(roof);
    const door = box(1.1, 1.9, 0.18, 0x5b8bc9);
    door.position.set(0, 0.95, 2.51);
    ext.add(door);
    // the gentle cross of a place that mostly hands out lollipops
    // (down on the wall above the door, where the eaves can't hide it)
    const crossV = box(0.34, 0.86, 0.12, 0x8fce7a);
    crossV.position.set(0, 2.42, 2.56);
    const crossH = box(0.86, 0.34, 0.12, 0x8fce7a);
    crossH.position.set(0, 2.42, 2.56);
    ext.add(crossV, crossH);
    const cwin = makeWindow(0.4);
    cwin.position.set(1.6, 1.7, 2.51);
    ext.add(cwin);
    ext.position.set(clinSpot.x, cy, clinSpot.z);
    ext.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(ext);
    zones.addBlockerBox(clinSpot.x, clinSpot.z, 5.9, 5.3, 0, 0.05);

    const B = IN.clinic;
    const roomStart = group.children.length;
    const floor = box(12, 0.4, 9, 0xd8dcd2);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    const clinicTube = makeCeilingTube(3.4); // clinical candor, evenly distributed
    clinicTube.position.set(B.x + 1, 3.3, B.z + 0.5);
    group.add(clinicTube);
    for (const [w, h, d, x, y, z] of [
      [12, 4.2, 0.4, B.x, 2.1, B.z - 4.5],
      [0.4, 4.2, 9, B.x - 6, 2.1, B.z],
      [0.4, 4.2, 9, B.x + 6, 2.1, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xeaf4f0));
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // cot, desk, lollipop jar, and the eye chart (it's all paw prints)
    const cot = box(1.6, 0.55, 2.6, 0xb9c0b9);
    cot.position.set(B.x - 4, 0.27, B.z - 2.6);
    const cotTop = box(1.45, 0.2, 2.4, 0xffffff);
    cotTop.position.set(B.x - 4, 0.62, B.z - 2.6);
    group.add(cot, cotTop);
    const deskC = box(2.4, 1.0, 1.1, 0x8a9a92);
    deskC.position.set(B.x + 2.5, 0.5, B.z - 2.4);
    group.add(deskC);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.5, roughness: 0.2 }));
    jar.position.set(B.x + 3.2, 1.25, B.z - 2.4);
    group.add(jar);
    for (let i = 0; i < 5; i++) {
      const pop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0),
        mat(pick([0xff6b81, 0xffd23e, 0x8fce7a]), 0.5));
      pop.position.set(B.x + 3.2 + rand(-0.08, 0.08), 1.1 + i * 0.07, B.z - 2.4 + rand(-0.08, 0.08));
      group.add(pop);
    }
    for (const z of [B.z + 0.8, B.z + 2.0]) {
      const seat = box(0.8, 0.22, 0.8, 0x8a9a92);
      seat.position.set(B.x + 5.05, 0.42, z);
      seat.receiveShadow = true;
      const back = box(0.18, 0.9, 0.8, 0x6e7f78);
      back.position.set(B.x + 5.5, 0.86, z);
      back.receiveShadow = true;
      group.add(seat, back);
    }
    const rack = box(0.16, 0.9, 1.15, 0x8a6f4d);
    rack.position.set(B.x + 5.35, 0.65, B.z + 3.15);
    rack.receiveShadow = true;
    group.add(rack);
    const magColors = [0xff6b81, 0xffd23e, 0x5b8bc9, 0x8fce7a];
    for (let i = 0; i < 4; i++) {
      const mag = box(0.05, 0.34, 0.2, magColors[i]);
      mag.position.set(B.x + 5.23, 0.35 + i * 0.14, B.z + 2.78 + i * 0.22);
      mag.rotation.z = 0.18;
      mag.receiveShadow = true;
      group.add(mag);
    }
    register({
      pos: new THREE.Vector3(B.x + 5.35, 0, B.z + 3.0), r: 1.8, zone: 'clinic',
      label: '잡지 넘겨보기',
      use: () => ui.say([
        'OYSTERS — “안목 있는 이매패류를 위한 정기 간행물.” 이 호는 8년 묵었어요. 표지 기사: “진주: 당신은 잘못 보관 중?”과 “조수 웅덩이 미니멀리즘 — 바위 하나만으로 살기.”',
        '속지: 퀴즈 “당신은 어떤 소라게?” (당신은 매번, 더 큰 껍데기를 찾는 쪽) 그리고 화산에서 여름을 나는 조개의 화보. 정기구독 카드가 팔랑 떨어져요. 6년 전에 만료됐어요.',
      ]),
    });
    // eye chart: descending paw prints
    const chartCv = document.createElement('canvas');
    chartCv.width = 128;
    chartCv.height = 192;
    const cctx = chartCv.getContext('2d');
    cctx.fillStyle = '#fffaf0';
    cctx.fillRect(0, 0, 128, 192);
    cctx.fillStyle = '#5b4a32';
    cctx.textAlign = 'center';
    let yy = 36;
    for (const size of [40, 28, 20, 14, 9, 6]) {
      cctx.font = `${size}px sans-serif`;
      cctx.fillText('🐾'.repeat(Math.min(6, Math.ceil(40 / size))), 64, yy);
      yy += size + 12;
    }
    const chartTex = new THREE.CanvasTexture(chartCv);
    chartTex.colorSpace = THREE.SRGBColorSpace;
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5),
      new THREE.MeshBasicMaterial({ map: chartTex }));
    chart.position.set(B.x, 2.2, B.z - 4.28);
    group.add(chart);

    const gill = buildAnimal('axolotl', { body: 0xf2b8c6, head: 0xf2b8c6 });
    gill.userData.fidget = true;
    gill.position.set(B.x + 2.5, 0.6, B.z - 3.4);
    group.add(gill);
    // a stool so Dr. Gill clears his counter, the way Pip does at the shop
    const gillStool = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.58, 7), mat(0xa97c50));
    gillStool.position.set(B.x + 2.5, 0.31, B.z - 3.4);
    gillStool.castShadow = gillStool.receiveShadow = true;
    group.add(gillStool);
    wireBob(gill, updates, 0.9);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('clinic', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.6, x1: B.x + 5.6, z0: B.z - 3.0, z1: B.z + 4.1 },
      blockers: [
        { x: B.x - 4, z: B.z - 2.6, r: 1.4 },
        { x: B.x + 2.5, z: B.z - 2.4, r: 1.4 },
        { x: B.x + 5.2, z: B.z + 0.8, r: 0.62 }, // waiting chairs
        { x: B.x + 5.2, z: B.z + 2.0, r: 0.62 },
        { x: B.x + 5.35, z: B.z + 3.15, r: 0.5 }, // magazine rack
      ],
      spawn: { x: B.x, z: B.z + 3.4, rotY: Math.PI },
      lighting: {
        bg: 0x202824, fog: 0x202824, fogNear: 22, fogFar: 55,
        hemiSky: 0xf0fff8, hemiGround: 0x586058, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(clinSpot.x, 0, clinSpot.z + 3.2), r: 2.6,
      label: '진료소에 들어가기',
      use: () => zones.go('clinic'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 3.8), r: 1.6, zone: 'clinic',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: clinSpot.x, z: clinSpot.z + 4.2, rotY: 0 }),
    });

    let chatIdx = 0;
    register({
      getPos: () => gill.position, r: 3, zone: 'clinic',
      label: '길 박사와 대화하기',
      use: async () => {
        if (!S.hasFlag('metGill')) {
          S.setFlag('metGill');
          await ui.say([
            '작은 흰 가운을 입은 분홍 우파루파가 올려다봐요. 아가미 가지가 축제 안테나처럼 흔들려요.',
            '“길 박사예요. 여긴 아무도 안 아파서, 주로 건강검진 하고 막대사탕 나눠 주고 모두의 훌륭한 건강을 감탄해요. 언제든 올라오세요.”',
          ], { speaker: '길 박사', voice: 500 });
          return;
        }
        const choice = await ui.ask('무슨 일로 오셨나요? (아무 일도 아니겠죠. 늘 아무 일도 아니에요. 훌륭해요.)', [
          { label: '🩺 건강검진 받기', value: 'checkup' },
          { label: '수다 떨기', value: 'chat' },
          { label: '나가기', value: null },
        ], { speaker: '길 박사', voice: 500 });
        if (choice === 'checkup') {
          await ui.say([
            '“시력표 보시고… 맨 아랫줄 읽어 보세요.” (현미경급 발바닥 도장 여섯 개예요.) “충분히 가까워요.”',
            '“숨 들이쉬고… 내쉬고. 아주 좋아요. 심장이 훌륭한 박자를 유지해요 — 살짝 당김음, 아주 유행이에요.”',
            '“반사 신경—” (어디선가 작은 망치가 나타나요) “—굉장해요. 움찔하는 데 진짜 예술성이 있어요.”',
            '“진단: 완벽한 건강, 아마 번영 중. 지금 하는 거 계속하세요. 막대사탕 드릴까요?”',
          ], { speaker: '길 박사', voice: 500 });
          jingle();
          ui.toast('건강 진단서, 막대사탕 덤. <i>맛있는 맛이에요.</i>', '🍭');
          S.setFlag('hadCheckup');
        } else if (choice === 'chat') {
          await ui.say(GILL_CHAT[chatIdx++ % GILL_CHAT.length], { speaker: '길 박사', voice: 500 });
        }
      },
    });
  }

  // ------------------------------------------------- the Buttonwagon ----
  {
    const bx = T.x, bz = T.z + 6.5;
    const by = terrainHeight(bx, bz);
    const wagon = new THREE.Group();
    const bed = box(3.4, 0.3, 1.8, 0x8a5a3a);
    bed.position.y = 0.75;
    wagon.add(bed);
    for (const [sx, sz] of [[-1.2, 0.8], [1.2, 0.8], [-1.2, -0.8], [1.2, -0.8]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 9), mat(0x55483a));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.45, sz);
      wagon.add(wheel);
    }
    // THE BUTTON. enormous. mother-of-pearl. unexplained.
    const button = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.45, 16), mat(0xf2e8da, 0.35));
    button.rotation.x = Math.PI / 2;
    button.position.y = 2.85;
    wagon.add(button);
    for (const [hx, hy] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 10), mat(0x55504c, 0.6));
      hole.rotation.x = Math.PI / 2;
      hole.position.set(hx, 2.85 + hy, 0);
      wagon.add(hole);
    }
    const hitch = box(1.4, 0.12, 0.12, 0x6b4a2e);
    hitch.position.set(2.3, 0.7, 0);
    wagon.add(hitch);
    wagon.position.set(bx, by, bz);
    wagon.rotation.y = 0.5;
    wagon.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(wagon);
    zones.addBlockerBox(bx, bz, 3.8, 2.0, 0.5, 0.05);

    register({
      pos: new THREE.Vector3(bx + 2.5, 0, bz + 1.5), r: 2.6,
      label: '버튼왜건 살펴보기',
      use: () => ui.say([
        '수레에 얹힌 거대한 자개 버튼이에요. 작은 명판:',
        '“버튼왜건. 핍의 마케팅 계획, 야심찬 봄의 해. 한 번 달렸다. 섬은 다시는 안 하기로 합의했다.”',
        '누군가 — 거의 확실히 핍 — 가 아직 왁스를 칠해요. 흠잡을 데가 없어요.',
      ]),
    });
  }

  // -------------------------------------------- the very poisonous frog ----
  {
    const fs = shroomSpots[0] ?? { x: T.x + 8, z: T.z + 2, h: ty };
    // the canon frog (same build as Mortimer at BULKO), small, blue, and
    // unmistakably not to be licked
    const frog = buildAnimal('frog', { body: 0x2a7fe8, belly: 0x9fd0ff, feet: 0xff9430, spots: 0x13305e });
    frog.scale.setScalar(0.55);
    // up on a mossy stone in the middle of the clearing, where a frog this
    // important can be seen (he was easy to miss down in the leaf litter)
    const fx0 = fs.x + 0.7, fz0 = fs.z + 0.4;
    const seatY = terrainHeight(fx0, fz0) + 0.5;
    const seat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), mat(0x8a8f86, 0.95));
    seat.scale.set(1.1, 0.6, 1);
    seat.position.set(fx0, seatY - 0.3, fz0);
    seat.castShadow = seat.receiveShadow = true;
    const seatMoss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x4f8a52, 0.95));
    seatMoss.scale.set(1.1, 0.35, 1);
    seatMoss.position.set(fx0, seatY - 0.08, fz0);
    group.add(seat, seatMoss);
    frog.position.set(fx0, seatY, fz0);
    frog.name = 'poison-frog';
    group.add(frog);
    zones.addBlocker(fx0, fz0, 0.6); // his stone
    // and a sign, because somebody has to say it
    {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const c = cv.getContext('2d');
      c.fillStyle = '#f3e7c4'; c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#b8322a'; c.textAlign = 'center';
      c.font = 'bold 30px sans-serif'; c.fillText('부디', 128, 38);
      c.font = 'bold 34px sans-serif'; c.fillText('핥지 말아요', 128, 78);
      c.font = 'bold 26px sans-serif'; c.fillText('개구리를', 128, 112);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sx = fx0 + 1.9, sz = fz0 + 0.9, sy = terrainHeight(sx, sz);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.82, 0.1), mat(0x7a5230)); // (ends under the board: it used to run across the lettering)
      post.position.set(sx, sy + 0.41, sz);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.46, 0.06),
        [mat(0x9a7448), mat(0x9a7448), mat(0x9a7448), mat(0x9a7448), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat(0x9a7448)]);
      board.position.set(sx, sy + 1.05, sz);
      board.rotation.y = Math.atan2(fx0 - sx, fz0 - sz) + Math.PI * 0.75; // angled toward the path in
      post.castShadow = board.castShadow = true;
      group.add(post, board);
      zones.addBlocker(sx, sz, 0.2);
    }
    // the frog only reads in a clearing — relocate every tree on top of it to a
    // dry spot just outside, scanning ALL directions (its own bearing may face
    // water, which is why moving it straight out used to leave the copse behind)
    const CLEAR_R = 4.4;
    for (const tree of forestTrees) {
      const dx = tree.position.x - frog.position.x;
      const dz = tree.position.z - frog.position.z;
      if (Math.hypot(dx, dz) >= CLEAR_R) continue;
      let moved = false;
      for (let a = 0; a < 16 && !moved; a++) {
        const ang = (a / 16) * Math.PI * 2;
        for (const out of [CLEAR_R + 0.8, CLEAR_R + 2.2]) {
          const tx = frog.position.x + Math.cos(ang) * out;
          const tz = frog.position.z + Math.sin(ang) * out;
          const th = terrainHeight(tx, tz);
          if (th > WATER_Y + 0.2) { tree.position.set(tx, th - 0.05, tz); moved = true; break; }
        }
      }
      if (!moved) tree.visible = false; // nowhere dry to move it — just clear the canopy
    }
    // trunks are solid — added now, after the frog's clearing moved some
    for (const tree of forestTrees) {
      if (tree.visible) zones.addBlocker(tree.position.x, tree.position.z, 0.6, 'tree');
    }
    let hopT = rand(1, 3);
    let hop = 99;
    updates.push((dt) => {
      hopT -= dt;
      if (hopT <= 0) { hop = 0; hopT = rand(2, 5); }
      if (hop < 0.35) {
        hop += dt;
        frog.position.y = seatY + Math.sin(Math.min(hop / 0.35, 1) * Math.PI) * 0.18;
      }
    });
    let frogIdx = 0;
    register({
      getPos: () => frog.position, r: 2.4,
      label: '아주 독한 개구리 감상하기 (만지지 말 것)',
      use: () => ui.say(FROG_LINES[frogIdx++ % FROG_LINES.length]),
    });
  }

  // ----------------------------------------------------- the MouseBoat ----
  {
    // a mooring on whichever shore faces away from the arch — and clear of
    // the Labs causeway, which has right of way on account of being a bridge
    const cwLen = Math.hypot(SITES.labsYard.x - ISLAND3.x, SITES.labsYard.z - ISLAND3.z);
    const cwx = (SITES.labsYard.x - ISLAND3.x) / cwLen;
    const cwz = (SITES.labsYard.z - ISLAND3.z) / cwLen;
    let mx = ISLAND3.x, mz = ISLAND3.z + ISLAND3.r;
    outer:
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      for (let r = ISLAND3.r - 4; r < ISLAND3.r + 6; r += 0.6) {
        const x = ISLAND3.x + Math.cos(a) * r, z = ISLAND3.z + Math.sin(a) * r;
        const toOrigin = (x * -ISLAND3.x + z * -ISLAND3.z); // arch side check
        if (toOrigin > 0) continue;
        if (Math.cos(a) * cwx + Math.sin(a) * cwz > 0.35) continue; // causeway side
        const h = terrainHeight(x, z);
        if (h > -0.05 || h < -0.45) continue;
        if (terrainHeight(x * 1.06, z * 1.06) > WATER_Y - 0.3) continue;
        mx = x; mz = z;
        break outer;
      }
    }
    const seaward = Math.atan2(mx - ISLAND3.x, mz - ISLAND3.z);
    const bx = mx + Math.sin(seaward) * 3.4, bz = mz + Math.cos(seaward) * 3.4;

    const boat = new THREE.Group();
    const hull = box(3.2, 1.0, 5.4, 0x8a3a30);
    hull.position.y = 0.3;
    boat.add(hull);
    const deck = box(3.0, 0.16, 5.2, 0xa97c50);
    deck.position.y = 0.85;
    boat.add(deck);
    const cabin = box(2.4, 1.7, 2.8, 0xf3e6cf);
    cabin.position.set(0, 1.75, -0.8);
    boat.add(cabin);
    const cabinRoof = box(2.7, 0.16, 3.1, 0x4f8f6a);
    cabinRoof.position.set(0, 2.66, -0.8);
    boat.add(cabinRoof);
    // portholes on both sides now — the front wall belongs to the door
    for (const sx of [-1, 1]) {
      const porthole = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 8), mat(0xbfe6f2, 0.3));
      porthole.rotation.z = Math.PI / 2;
      porthole.position.set(sx * 1.22, 1.85, -0.8);
      glowWindow(porthole); // glows at night like the rest
      boat.add(porthole);
    }
    // the front door is a mouse hole: a round-topped dark arch in the wall
    const holeMat = mat(0x2a1d16, 0.9);
    const holeLow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.08), holeMat);
    holeLow.position.set(0, 1.2, 0.62);
    const holeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12, 1, false, Math.PI / 2, Math.PI), holeMat);
    holeTop.rotation.x = Math.PI / 2;
    holeTop.position.set(0, 1.47, 0.62);
    const sill = box(1.1, 0.08, 0.22, 0xa97c50);
    sill.position.set(0, 0.95, 0.66);
    boat.add(holeLow, holeTop, sill);
    const stovepipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 6), mat(0x2e2a26));
    stovepipe.position.set(0.8, 3.0, -1.4);
    boat.add(stovepipe);
    // an enormous wedge of "ballast" lashed to the bow. it is cheese.
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 3), mat(0xf2cf5b, 0.6));
    cheese.position.set(0, 1.2, 1.8);
    cheese.rotation.y = 0.4;
    boat.add(cheese);
    boat.position.set(bx, WATER_Y + 0.25, bz);
    boat.rotation.y = seaward + Math.PI / 2;
    // a hull is a wall, as far as rowboats and swimmers are concerned
    zones.addSeaWall({ contains: (x, z) => Math.hypot(x - bx, z - bz) < 3.0 });
    boat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(boat);
    updates.push((dt, t) => {
      boat.position.y = WATER_Y + 0.25 + Math.sin(t * 0.9) * 0.05;
      boat.rotation.z = Math.sin(t * 0.8) * 0.012;
    });
    // mooring post + a plank to shore
    const post = box(0.16, 1.1, 0.16, 0x6b4a2e);
    post.position.set(mx, terrainHeight(mx, mz) + 0.55, mz);
    group.add(post);
    const plank = box(0.9, 0.1, 3.4, 0x96703f);
    plank.position.set((mx + bx) / 2, 0.6, (mz + bz) / 2);
    plank.rotation.y = seaward;
    group.add(plank);

    MOUSEBOAT = {
      deck: { x: bx, y: WATER_Y + 1.2, z: bz },
      knock: { x: mx, z: mz },
      doorOut: { x: mx - Math.sin(seaward) * 1.5, z: mz - Math.cos(seaward) * 1.5, rotY: seaward + Math.PI },
    };
  }

  // ------------------------------------------- the Buttonwagon food cart ----
  {
    const cx = T.x + 3.5, cz = T.z + 5.5;
    const cy2 = terrainHeight(cx, cz);
    const cart = new THREE.Group();
    const body = box(2.6, 1.2, 1.4, 0xf2e8da);
    body.position.y = 1.1;
    cart.add(body);
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 9), mat(0x55483a));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx * 1.0, 0.5, 0.75);
      cart.add(wheel);
    }
    for (let i = 0; i < 5; i++) {
      const slat = box(0.56, 0.07, 1.2, i % 2 ? 0xfff3da : 0xb05a4a);
      slat.position.set(-1.15 + i * 0.57, 2.35, -0.1);
      slat.rotation.x = 0.4;
      cart.add(slat);
    }
    const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.5, 9), mat(0x2e2a26, 0.5));
    pot2.position.set(0.5, 1.95, 0);
    cart.add(pot2);
    // sponsor's mark: a proud little button on the side
    const sponsorButton = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12), mat(0xf2cf5b, 0.35));
    sponsorButton.rotation.x = Math.PI / 2;
    sponsorButton.position.set(-0.6, 1.2, 0.73);
    cart.add(sponsorButton);
    cart.position.set(cx, cy2, cz);
    cart.rotation.y = -0.5;
    cart.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(cart);
    zones.addBlockerBox(cx, cz, 2.9, 1.8, -0.5, 0.05);

    register({
      pos: new THREE.Vector3(cx + 1.4, 0, cz + 1.4), r: 2.4,
      label: '스튜 가판대 방문하기',
      use: async () => {
        const choice = await ui.ask(
          '그려진 현수막: “버튼왜건 제공: 버튼버섯 스튜. (버튼왜건은 요리하지 않는다. 버튼왜건은 믿는다.)”', [
            { label: '🍲 버튼버섯 스튜', value: 'stew', hint: '25🔘', disabled: S.state.buttons < 25 },
            { label: '후원에 대해 묻기', value: 'sponsor' },
            { label: '나가기', value: null },
          ]);
        if (choice === 'stew') {
          S.spend(25);
          S.drinkCoffee(30);
          kaching();
          sip();
          ui.updateHUD();
          ui.toast('흙내 나고, 버터 향 나고, 수상할 만큼 완벽해요. <i>30초간 따뜻하고 빨라져요!</i>', '🍲');
        } else if (choice === 'sponsor') {
          ui.say('작은 글씨: “버튼왜건은 아무 보답도 바라지 않았다. 버튼왜건은 다시 무언가의 일부가 되고 싶었을 뿐이다.” …아. 아, 안 돼. 스튜 가판대 앞에서 울컥했어요.');
        }
      },
    });
  }

  // a welcome of sorts
  const sign = box(1.4, 0.8, 0.1, 0x8a6f4d);
  sign.position.set(T.x - 1, ty + 1.0, T.z + 3.5);
  sign.rotation.y = 0.2;
  const signPost = box(0.12, 1.0, 0.12, 0x6b4a2e);
  signPost.position.set(T.x - 1, ty + 0.5, T.z + 3.5);
  group.add(sign, signPost);
  register({
    pos: new THREE.Vector3(T.x - 1, 0, T.z + 3.5), r: 2,
    label: '이끼 낀 표지판 읽기',
    use: () => ui.say('“북쪽 섬. 조용히 부탁 — 이끼 작업 중. (이끼가 감사해해요. 이끼는 모든 걸 알아채요.)”'),
  });

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
      if (Math.hypot(dx, dz) < 8) {
        npc.rotation.y = turnToward(npc.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
    }
  });
}
