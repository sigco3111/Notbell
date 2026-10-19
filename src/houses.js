// Home. Yours is a little blue-roofed cottage with a garden out front;
// the villagers each have their own door to (politely) knock on.

import * as THREE from 'three';
import { SITES, terrainHeight, clearOfSites } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS, GROWTH } from './catalog.js';
import { jingle, doorChime, thud } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { hourNow, HOLIDAY } from './calendar.js';
import { MOUSEBOAT } from './island3.js';
import { makeWindow, makeHangingLamp } from './buildings.js';
import { currentWeather } from './almanac.js';
import { BIRTHDAYS, birthdayTalk } from './villagers.js';
import * as mail from './mail.js';
import * as doors from './doors.js';

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

const IN_HOME = { x: 300, z: 240 }; // cottage interior, off in the elsewhere

const BOOKS = [
  '《배를 위한 매듭과 이유》',
  '《버튼 상식 1001가지, 2권 (38–41번 상식)》',
  '《등대지기의 연감》, 두 가지 다른 필체의 주석 달림.',
  '《버섯: 친구인가, 음식인가, 램프인가?》',
  '《늑대인 척하기 야외 안내서》. 사인본이다.',
];

// what you find when you knock and nobody's home
const KNOCKS = {
  클로버: '클로버 노커가 달린 둥근 초록 문. 아무도 없어요 — 어딘가 꽃밭에 나가 나비들의 가구가 되어 있어요.',
  비스킷: '마당이 작고 수상한 흙더미로 가득해요. 문의 표지: “외출. 땅 파는 중. 아니면 낮잠. 어쨌든 뭔가 수사 중.”',
  새프런: '섬의 모든 꽃 향기가 한꺼번에, 하지만 가나다순으로 나요. 아무도 없어요.',
  하웰: '문에 긁힌 자국. 늑대 것처럼. 정확히 늑대 것처럼. 쪽지: “외출. 연습 중. 아우우.”',
  브램블: '집 전체가 편안하게 한쪽으로 기울어요, 몇 년 전에 앉았다가 일어날 이유를 못 찾은 것처럼. 브램블은 어딘가에, 아마 앉아 있어요.',
  매리골드: '높은 문의 긴 집. 편자가 위에 걸려 있어요, 끝을 위로, 그릇처럼 행운을 담으며. 아무도 없어요 — 다리 위 말발굽 소리를 들어 보세요.',
  엠버: '낮고 둥근 오두막, 밖에서도 만지면 따뜻해요. 표지: “없으면 동굴. 동굴에도 없으면 비가 오고 나는 사방에 있음.”',
  버터팻: '버터와 깎은 풀 냄새 나는 넓고 차분한 집. 쪽지: “방목 중. 생각해 보면 다 방목이야, 정말.”',
  크럼: '마우스보트가 계류장에서 부드럽게 흔들려요. 작은 표지: “선장 외출. 까불이(부스러기)는 깡통으로 접수.” 정말 깡통이 있어요.',
  바브: '고개를 숙여야 하는 문의 낮은 이끼 집, 디딤돌엔 털실 바구니 (루스 것; 40년째 같이 살아요). 손글씨 표지: “시냇가. 시냇가에 없으면, 그래도 시냇가.”',
  널: '옆에 키패드가 달린 검은 문. 키패드는 장식이에요. 문은 열려 있어요. 포스트잇: “집에 없음. 아니면 있나. (집에 없음.)”',
  메이블: '문지방에 메이블 것이 아닌 물건들이 쌓여 있어요: 손삽, 장갑 한 짝, 체념한 듯한 정원 난쟁이. 쪽지: “재배치하러 외출. 꽥.”',
};

// when each villager is home, [start, end) on the real clock — wet weather
// sends everyone home early, except 하웰, who insists wolves love drama
const SCHEDULE = {
  클로버: [19, 7],
  비스킷: [22, 7],
  새프런: [20, 6],
  브램블: [21, 6],
  하웰: [10, 16], // nocturnal. obviously. being a wolf.
  매리골드: [20, 5],
  버터팻: [19, 6],
  크럼: [22, 6],   // sleeps on deck, under whatever the sky is doing
  엠버: [21, 7],   // nights in her hut on the Far Isle…
  바브: [20, 6],
  루스: [19, 6],   // at Barb's (forty years; it's her house too)
  널: [6, 14],    // up all night; sleeps through the morning, like a server
  메이블: [22, 6],
};
const EMBER_CAVE_HOURS = [11, 16]; // …middays in the cave, rain permitting (she prefers it not to permit)

function isHomeNow(name) {
  if (!SCHEDULE[name]) return false;
  if (currentWeather() !== 'clear') {
    // rain sends everyone in — except the wolf (drama) and the salamander (joy)
    if (name === '엠버') return false;
    if (name !== '하웰') return true;
  }
  const [s, e] = SCHEDULE[name];
  const h = hourNow();
  return s < e ? h >= s && h < e : h >= s || h < e;
}

const COME_INS = {
  클로버: '웅웅거리는 목소리: “열려 있어! 쿠션 조심! …아니, 밟아도 돼, 얘네가 좋아해.”',
  비스킷: '안에서: “여기야! 흙더미 조심!”',
  새프런: '흡족한 목소리: “들어오세여!”',
  하웰: '근엄한 목소리: “굴에 들어오는 것을 허락한다.” 잠시 뜸. “안녕.”',
  브램블: '느리고 따뜻한 목소리: “문 안 잠겼어. 항상 그래.”',
  매리골드: '밝은 울음: “열려 있어! 들보 밑으로 고개 숙여!”',
  엠버: '기쁜 쉿 소리: “그러암, 들어와! 돌 하나 골라! 다 따뜻해!”',
  버터팻: '느리고 흡족한 목소리: “들어오렴, 얘야. 교유기 조심. 교유기도 널 조심한단다.”',
  바브: '안에서 자갈 목소리: “흠. 열려 있어.”',
  널: '키패드가 삑 소리를 내요. 안의 목소리: “들어왔네.”',
  메이블: '목소리: “꽥.” (들어와요.)',
};

const HOME_LINES = {
  클로버: [
    '내 굴을 찾았구나! 아무 데나 앉아. 모든 데 앉아. 쿠션은 그러라고 있는 거야.',
    '집이란 비 소리를 들으면서 비를 안 맞는 곳이야. 하웰 말고. 걘 밖에서 비 맞으며 노래해.',
  ],
  비스킷: [
    '어서 와! 바닥 조심. 벽도. 벽엔 묻어둔 것들이 있어. 긴 이야기야. 좋은 이야기.',
    '묻어둔 간식은 아주 배려 깊은 과거의 내가 아주 운 좋은 미래의 나에게 주는 선물이야.',
  ],
  새프런: [
    '들어와, 들어와 — 매단 다발 조심. 저건 “북서풍, 첫 따뜻한 날”이라고 라벨 붙었어.',
    '정돈된 굴과 열린 창 하나. 그게 모든 것의 비밀 전부야.',
  ],
  하웰: [
    '굴에 온 걸 환영해. 늑대는 굴을 가져. 이게 그거야. 결론은 알아서 내려. 옳은 걸로.',
    '흐린 밤엔 포스터 보고 울어. 실력 유지야. 달은 이해해 줘.',
  ],
  브램블: [
    '오, 안녕. 의자 끌어와. 큰 거. 큰 것밖에 없어.',
    '집이란 예의를 배운 동굴일 뿐이야.',
  ],
  매리골드: [
    '어서 와! 머리 조심 — 천장은 낙관주의자용으로 지어졌어.',
    '창은 다리 쪽으로 냈어. 어느 섬에서든 최고의 경치: 도착하는 것들.',
  ],
  엠버: [
    '오! 안녕! 여기 엄청 멋지지 않아. 쉿. 들어 봐. …B플랫.',
    '따뜻한 돌에 앉아. 아무 거나. 다 따뜻해. 하나하나 직접 확인했어.',
  ],
  버터팻: [
    '저녁은 버터와, 추상적으로 풀 생각을 위한 시간이야.',
    '베스퍼가 초원에 대한 책을 빌려줬어. 나는 초원에 사는데. 그래도 읽었어. 결말의 멋진 반전: 초원이 더 나옴.',
  ],
  바브: [
    '흠. 아무 데나 앉아. 흔들의자 말고. 그건 루스 거야. 40년째. 다른 데 아무 데나.',
    '창틀에 시냇물 병을 둬. 계절 따라 색이 바뀌어. 달력보다 나아. 말대꾸도 안 하고.',
  ],
  루스: [
    '어서 와, 얘야! 차 마실래? 크랜베리야. 여긴 결국 다 크랜베리가 돼.',
    '저 목도리는 시냇가용. 저건 바브 거. 저건 네 거. 봄쯤 완성될 거야. 어떤 봄.',
  ],
  널: [
    '파란 케이블 건드리지 마. 초록 것도. 사실 그냥 가운데 서 있어. 완벽해. 들어왔네.',
    '모니터 여섯 대. 하나는 그냥 시냇가 사진이야. 눈용. 나머지 다섯도 대부분 시냇가.',
  ],
  메이블: [
    '내 컬렉션에 온 걸 환영해. 여기 있는 건 이제 다 내 거야. 일부는 먼저 다른 사람 것이었지. 그건 그쪽 사정이야.',
    '저 난쟁이? 토드 거. 오아시스 토드. 오아시스까지 가서 가져왔어. 꽥. 그럴 가치 있었어.',
  ],
  크럼: [
    '갑판이 집에서 제일 좋은 방이야. 천장이 좀 멀긴 한데, 다 가질 순 없지.',
    '들려? 선체에 닿는 물소리. 최고의 자장가야, 모든 절을 다 알아.',
  ],
};

const HOME_PROPS = {
  클로버: { label: '쿠션 눌러 보기', text: '불가능할 만큼 폭신해요. 이제 클로버의 모든 걸 이해해요.' },
  비스킷: { label: '보물 선반 살펴보기', text: '병뚜껑, 달팽이집 (빈 것 — 확인함), 그리고 자기만의 작은 쿠션이 있는 행운의 버튼.' },
  새프런: { label: '말린 꽃 냄새 맡기', text: '보존된 지난여름. 다발마다 바람이 불어온 방향이 라벨로 붙어 있어요.' },
  하웰: { label: '달 포스터 살펴보기', text: '“달,” 캡션에 적혀 있어요. 사인이 있어요. 하웰의.' },
  브램블: { label: '꿀단지 들여다보기', text: '단지 셋: “아침밥,” “비상,” 그리고 “금지 (봄 전용).”' },
  매리골드: { label: '리본 벽 보기', text: '참가자 한 명인 경주들의 리본. 전부 1등. 중요한 건 절제예요.' },
  엠버: { label: '화로 돌 만져 보기', text: '납작한 돌이 고리 모양, 긁어 그은 정자표로 1부터 9까지 번호. 네 번째 돌엔 작은 왕관이 그려져 있어요.' },
  바브: { label: '시냇물 병 보기', text: '창틀의 시냇물 병, 조금 초록, 조금 금빛. 조심스러운 발톱 글씨 라벨: “시내. 올해.” 뒤엔 오래된 병들, 전부 라벨. 마흔 개. 구석엔 루스의 털실 바구니, 그리고 창밖으로 나가는 목도리.' },
  널: { label: '화면 읽기', text: '검은 화면에 초록 글자가 흘러요. 한 화면: “> cranberries.count() … 아직 세는 중.” 다른 화면: “> labs.password = notbell ✓.” 마지막은 시냇가 라이브 영상, 그리고 돌 위에서 만족한 거북이.' },
  메이블: { label: '컬렉션 살펴보기', text: '손삽, 정원 난쟁이, 짝 없는 장갑 11개, “널 — 만지지 마” 라벨의 USB, 그리고 문 없는 반짝이는 놋쇠 문손잡이 하나. 전부 가지런히 선반에. 선반도 재배치된 거예요.' },
  버터팻: { label: '버터 교유기 감상하기', text: '세월의 인내로 닦여 반짝여요. 손잡이 리본: “최고의 버터 — 유일한 출품작 — 그래도 획득함.”' },
};

const HOUSE_STYLES = {
  클로버: { wall: 0xf3e6cf, roof: 0x6fae5c, door: 0x4e9a45 },
  비스킷: { wall: 0xe3c98f, roof: 0x8a5a3a, door: 0x6b4a2e },
  새프런: { wall: 0xf3d9bb, roof: 0xe8743a, door: 0xb05a2a },
  하웰: { wall: 0xcdd3da, roof: 0x5a6a80, door: 0x3a4a5c },
  브램블: { wall: 0xc9a06a, roof: 0x55772f, door: 0x55483a },
  매리골드: { wall: 0xf5ecd8, roof: 0xd9a440, door: 0xb05a4a },
  엠버: { wall: 0xd9a08a, roof: 0x6e5048, door: 0xe8743a },
  버터팻: { wall: 0xfdf6e8, roof: 0x6e5a44, door: 0x8a5a3a },
  바브: { wall: 0x8a9a7a, roof: 0x3d5a34, door: 0x55483a },
  널: { wall: 0x3a3a44, roof: 0x1e1e24, door: 0x5aff8a },
  메이블: { wall: 0xf5f2e9, roof: 0xf28a2e, door: 0x3a7dd8 },
};

function makeCottage({ wall, roof, door }, scale = 1) {
  const g = new THREE.Group();
  // a stone footing first — cottages sit on real slopes, and a floor you can
  // see daylight under is a porch, not a home (B18)
  const plinth = box(4.9 * scale, 2.0, 4.3 * scale, 0xc9bda6);
  plinth.position.y = -0.65; // deep enough for the steepest yard on the isle
  g.add(plinth);
  const walls = box(4.6 * scale, 2.6 * scale, 4 * scale, wall);
  walls.position.y = 1.3 * scale;
  g.add(walls);
  const roofMesh = new THREE.Mesh(
    new THREE.ConeGeometry(3.8 * scale, 1.9 * scale, 4), mat(roof));
  roofMesh.position.y = 3.4 * scale;
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.castShadow = true;
  g.add(roofMesh);
  const doorMesh = box(0.95 * scale, 1.7 * scale, 0.16, door);
  doorMesh.position.set(0, 0.85 * scale, 2.01 * scale);
  g.add(doorMesh);
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0xf2cf5b, 0.4));
  knob.position.set(0.3 * scale, 0.85 * scale, 2.12 * scale);
  g.add(knob);
  g.userData.door = [doorMesh, knob]; // (doors.js can hang it on a hinge)
  const win = makeWindow(0.35 * scale); // round, like the others — and it glows at night
  win.position.set(-1.3 * scale, 1.5 * scale, 2.0 * scale);
  g.add(win);
  return g;
}

// Every house gets a mailbox by the path: a post, a rounded tin box in the
// house's roof color, and a little red flag. (The mail itself is still
// being sorted at the post office — Moss is thorough.)
function makeMailbox(color) {
  const g = new THREE.Group();
  const post = box(0.12, 1.0, 0.12, 0x6b4a2e);
  post.position.y = 0.5;
  g.add(post);
  const body = box(0.34, 0.24, 0.55, color);
  body.position.y = 1.08;
  g.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.55, 8, 1, false, 0, Math.PI), mat(color));
  lid.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  lid.position.y = 1.2;
  lid.castShadow = true;
  g.add(lid);
  // the flag, on a pivot at the side: up (standing) means mail
  const flagPivot = new THREE.Group();
  flagPivot.position.set(0.19, 1.08, -0.1);
  const flagPole = box(0.03, 0.3, 0.03, 0xb0453a);
  flagPole.position.set(0, 0.12, 0);
  flagPivot.add(flagPole);
  const flag = box(0.03, 0.1, 0.16, 0xb0453a);
  flag.position.set(0, 0.24, 0.08);
  flagPivot.add(flag);
  g.add(flagPivot);
  g.userData.setFlag = (up) => { flagPivot.rotation.x = up ? 0 : Math.PI / 2; };
  g.userData.setFlag(false);
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

function placeMailbox(group, x, z, rotY, color) {
  const mb = makeMailbox(color);
  mb.position.set(x, terrainHeight(x, z), z);
  mb.rotation.y = rotY;
  group.add(mb);
  zones.addBlocker(x, z, 0.3);
  return mb;
}

// Houses near a slope get honest wooden stilts under their low corners,
// instead of hovering — island carpentry at its finest.
const COTTAGE_BODY_HALF_W = 4.6 / 2;
const COTTAGE_BODY_HALF_D = 4.0 / 2;

function addStilts(group, x, z, baseH, halfW, halfD, rotY) {
  const cs = Math.cos(rotY), sn = Math.sin(rotY);
  for (const [cx, cz] of [[halfW, halfD], [halfW, -halfD], [-halfW, halfD], [-halfW, -halfD]]) {
    const wx = x + cx * cs + cz * sn;
    const wz = z - cx * sn + cz * cs;
    const ground = terrainHeight(wx, wz);
    if (ground < baseH - 0.3) {
      const len = baseH - ground + 0.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, len, 6), mat(0x6b4a2e));
      pole.position.set(wx, baseH - len / 2 + 0.1, wz);
      pole.castShadow = true;
      group.add(pole);
    }
  }
}

// ----------------------------------------------------------- the garden ----

const PLOT_OFFSETS = [
  [-1.4, 0], [0, 0], [1.4, 0],
  [-1.4, 1.6], [0, 1.6], [1.4, 1.6],
];

function plotStage(plot) {
  if (!plot) return 'empty';
  const g = GROWTH[plot.seed];
  if (!g) return 'empty';
  const f = (Date.now() - plot.plantedAt) / (g.secs * 1000);
  if (f >= 1) return 'ready';
  return f < 0.45 ? 'sprout' : 'leafy';
}

function buildPlotVisual(stage, seed) {
  const g = new THREE.Group();
  if (stage === 'sprout') {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), mat(0x6fae5c, 0.8));
    s.position.y = 0.16;
    g.add(s);
  } else if (stage === 'leafy') {
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0x55b055, 0.8));
      leaf.position.set(rand(-0.18, 0.18), 0.2 + rand(0, 0.1), rand(-0.18, 0.18));
      leaf.scale.y = 0.7;
      g.add(leaf);
    }
  } else if (stage === 'ready') {
    const grown = GROWTH[seed];
    const looks = {
      carrot: { color: 0xff9430, r: 0.13, n: 3, y: 0.12 },
      tomato: { color: 0xd84f4f, r: 0.14, n: 3, y: 0.18 },
      pumpkin: { color: 0xe8743a, r: 0.3, n: 1, y: 0.24 },
    }[grown.produce];
    for (let i = 0; i < looks.n; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(looks.r, 0), mat(looks.color, 0.6));
      p.position.set(looks.n === 1 ? 0 : (i - 1) * 0.32, looks.y, rand(-0.1, 0.1));
      g.add(p);
    }
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 5), mat(0x4e9a45, 0.8));
    tuft.position.y = looks.y + looks.r + 0.08;
    g.add(tuft);
  }
  return g;
}

// --------------------------------------------------- villager interiors ----

// furniture a particular home adds that a body shouldn't walk through
const HOME_SOLIDS = {};
function buildVillagerInterior(group, B, name, style) {
  // the shell: floor, three walls, a warm lamp
  const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 9), mat(0x9a7448));
  floor.position.set(B.x, -0.2, B.z);
  floor.receiveShadow = true;
  floor.castShadow = true;
  group.add(floor);
  for (const [w, h, d, x, y, z] of [
    [11, 4.0, 0.4, B.x, 2.0, B.z - 4.5],
    [0.4, 4.0, 9, B.x - 5.5, 2.0, B.z],
    [0.4, 4.0, 9, B.x + 5.5, 2.0, B.z],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(style.wall));
    wall.position.set(x, y, z);
    group.add(wall);
  }
  // everyone gets a bed in their colors and a rug
  const bedFrame = box(1.6, 0.45, 2.4, 0x8a5a3a);
  bedFrame.position.set(B.x - 3.4, 0.22, B.z - 2.8);
  const mattress = box(1.45, 0.25, 2.2, 0xfffaf0);
  mattress.position.set(B.x - 3.4, 0.55, B.z - 2.8);
  const blanket = box(1.5, 0.12, 1.3, style.roof);
  blanket.position.set(B.x - 3.4, 0.68, B.z - 2.4);
  group.add(bedFrame, mattress, blanket);
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 9), mat(style.door, 0.85));
  rug.position.set(B.x + 0.5, 0.06, B.z + 0.5);
  group.add(rug);

  // ...and a home that could only be theirs
  if (name === '클로버') {
    const pastels = [0xffd9e8, 0xd9e8ff, 0xfff3c9, 0xe2ffd9, 0xf3d9ff];
    for (let i = 0; i < 7; i++) {
      const cushion = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.45), 1), mat(pastels[i % 5], 0.95));
      cushion.scale.y = 0.45;
      cushion.position.set(B.x + rand(-1.5, 4), 0.18, B.z + rand(-3, 2.5));
      group.add(cushion);
    }
    const teaTable = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 8), mat(0xfff3da, 0.7));
    teaTable.position.set(B.x - 1.5, 0.45, B.z - 3.2);
    const teaLeg = box(0.15, 0.4, 0.15, 0xd9c08f);
    teaLeg.position.set(B.x - 1.5, 0.2, B.z - 3.2);
    group.add(teaTable, teaLeg);
  } else if (name === '비스킷') {
    for (let i = 0; i < 5; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(rand(0.3, 0.55), 7), mat(0x77603f));
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(B.x + rand(-3.5, 4), 0.02, B.z + rand(-3.5, 3));
      group.add(patch);
      if (i < 3) {
        const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), mat(0x8a6f4d));
        mound.scale.y = 0.5;
        mound.position.set(patch.position.x, 0.1, patch.position.z);
        group.add(mound);
      }
    }
    const shelf = box(2.4, 0.14, 0.8, 0x8a5a3a);
    shelf.position.set(B.x - 1.5, 1.5, B.z - 4.0);
    group.add(shelf);
    const treasures = [0x9aa0a6, 0xf2cf5b, 0xe8dcc0];
    treasures.forEach((c, i) => {
      const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(c, 0.5));
      tr.position.set(B.x - 2.2 + i * 0.7, 1.68, B.z - 4.0);
      group.add(tr);
    });
  } else if (name === '새프런') {
    for (let i = 0; i < 5; i++) {
      const bunch = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
          mat(pick([0xc77dff, 0xff9bb0, 0xffd23e]), 0.85));
        bloom.position.set(rand(-0.08, 0.08), -0.3 - k * 0.08, rand(-0.05, 0.05));
        bunch.add(bloom);
      }
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), mat(0x7a8a4a));
      stem.position.y = -0.15;
      bunch.add(stem);
      bunch.position.set(B.x - 4 + i * 2, 3.1, B.z - 4.1);
      group.add(bunch);
    }
    // the drying rail they hang from (they used to hang from nothing)
    const rail = box(8.6, 0.06, 0.06, 0x8a5a3a);
    rail.position.set(B.x, 3.1, B.z - 4.1);
    group.add(rail);
    // and the shelf the bottles stand on
    for (const sy of [1.4, 1.9]) {
      const ledge = box(1.3, 0.08, 0.35, 0x8a5a3a);
      ledge.position.set(B.x + 3.25, sy - 0.16, B.z - 4.0);
      group.add(ledge);
    }
    for (let i = 0; i < 4; i++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, rand(0.2, 0.35), 6),
        mat(pick([0xbfe6f2, 0xe2a9ff, 0xffd9c9]), 0.3));
      bottle.position.set(B.x + 3 + (i % 2) * 0.5, 1.4 + Math.floor(i / 2) * 0.5, B.z - 4.0);
      group.add(bottle);
    }
  } else if (name === '하웰') {
    // the moon poster: dark frame, pale moon, total sincerity
    const posterFrame = box(2.0, 2.4, 0.12, 0x1d2738);
    posterFrame.position.set(B.x - 1.5, 1.7, B.z - 4.4);
    group.add(posterFrame);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12),
      new THREE.MeshBasicMaterial({ color: 0xf4f0dc }));
    moon.position.set(B.x - 1.5, 1.9, B.z - 4.32);
    group.add(moon);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.6, 7), mat(0xc9a06a, 1));
    post.position.set(B.x + 3.4, 0.8, B.z - 3.2);
    group.add(post); // the scratching post. for wolf reasons.
    const bookStand = box(0.8, 1.0, 0.5, 0x55483a);
    bookStand.position.set(B.x + 3.4, 0.5, B.z + 1.8);
    HOME_SOLIDS[name] = [{ x: B.x + 3.4, z: B.z - 3.2, r: 0.3 }, { x: B.x + 3.4, z: B.z + 1.8, w: 0.8, d: 0.5 }];
    const book = box(0.62, 0.1, 0.45, 0xc25b4e);
    book.position.set(B.x + 3.4, 1.06, B.z + 1.8);
    book.rotation.z = 0.08;
    group.add(bookStand, book);
  } else if (name === '매리골드') {
    // ribbon wall + hay corner
    for (let i = 0; i < 5; i++) {
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 8),
        mat(pick([0xd84f4f, 0x5b8bc9, 0xffd23e]), 0.5));
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.set(B.x - 3.2 + i * 1.4, 2.2, B.z - 4.32);
      group.add(ribbon);
      const tail1 = box(0.1, 0.4, 0.04, 0xc25b4e);
      tail1.position.set(ribbon.position.x - 0.06, 1.9, B.z - 4.32);
      group.add(tail1);
    }
    for (let i = 0; i < 6; i++) {
      const hay = box(rand(0.5, 0.9), 0.2, rand(0.4, 0.7), 0xe8d49a);
      hay.position.set(B.x + 3.6 + rand(-0.6, 0.6), 0.1 + i * 0.16, B.z - 3 + rand(-0.5, 0.5));
      hay.rotation.y = rand(0, Math.PI);
      group.add(hay);
    }
    const shoe = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 10, Math.PI * 1.3), mat(0x9aa0a6, 0.4));
    shoe.position.set(B.x, 2.6, B.z - 4.32);
    shoe.rotation.z = Math.PI * 0.85; // ends up — luck stays in
    group.add(shoe);
  } else if (name === '엠버') {
    // a ring of numbered warm stones around a little hearth
    for (let i = 0; i < 9; i++) {
      const a2 = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.28, 0.42), 0), mat(0x8a7468, 0.95));
      stone.scale.y = 0.4;
      stone.position.set(B.x + 1 + Math.cos(a2) * 2.2, 0.12, B.z - 1 + Math.sin(a2) * 1.8);
      group.add(stone);
    }
    const hearth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.25, 8), mat(0x55504c));
    hearth.position.set(B.x + 1, 0.12, B.z - 1);
    group.add(hearth);
    const embers = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a4c }));
    embers.rotation.x = -Math.PI / 2;
    embers.position.set(B.x + 1, 0.26, B.z - 1);
    group.add(embers);
  } else if (name === '바브') {
    // a flat rock indoors, for rainy days, and the jars of creek water
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat(0x7a7468, 0.95));
    rock.scale.set(1.3, 0.35, 1.0);
    rock.position.set(B.x + 2.6, 0.2, B.z - 2.8);
    group.add(rock);
    for (let i = 0; i < 8; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 7), mat([0x7aa87a, 0x9ab86a, 0xb8a86a][i % 3], 0.3));
      jar.position.set(B.x - 1.8 + i * 0.36, 1.35, B.z - 4.3);
      group.add(jar);
    }
    const sill = box(3.2, 0.1, 0.4, 0x6b4a2e);
    sill.position.set(B.x - 0.54, 1.15, B.z - 4.3);
    group.add(sill);
    // …and 루스’s corner (she lives here too): yarn in baskets, and a scarf that goes on and on
    for (let i = 0; i < 6; i++) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat([0x3d6b38, 0x8c3a3f, 0x6e5a44, 0xf28fb0][i % 4], 0.95));
      ball.position.set(B.x + 3.9 + (i % 3) * 0.4, 0.2 + Math.floor(i / 3) * 0.3, B.z - 3.9);
      group.add(ball);
    }
    const scarf = box(0.4, 0.04, 7.5, 0x8c3a3f);
    scarf.position.set(B.x + 4.2, 0.03, B.z - 0.5);
    group.add(scarf);
    const rocker = box(1.0, 0.5, 0.9, 0x8a5a3a);
    rocker.position.set(B.x + 1.2, 0.25, B.z - 1.6);
    const rback = box(1.0, 0.9, 0.15, 0x8a5a3a);
    rback.position.set(B.x + 1.2, 0.85, B.z - 2.0);
    group.add(rocker, rback);
    HOME_SOLIDS[name] = [{ x: B.x + 2.6, z: B.z - 2.8, r: 0.9 }, { x: B.x + 1.2, z: B.z - 1.7, w: 1.0, d: 1.0 }];
  } else if (name === '널') {
    // the desk, six screens of green text, cables, and one that's just the creek
    const desk = box(3.4, 0.9, 1.0, 0x2a2a30);
    desk.position.set(B.x + 1.2, 0.45, B.z - 3.6);
    group.add(desk);
    HOME_SOLIDS[name] = [{ x: B.x + 1.2, z: B.z - 3.6, w: 3.4, d: 1.0 }];
    for (let i = 0; i < 6; i++) {
      const scr = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.06), new THREE.MeshBasicMaterial({ color: i === 5 ? 0x5a8a6a : 0x0e2a18 }));
      scr.position.set(B.x - 0.1 + (i % 3) * 1.05, 1.3 + Math.floor(i / 3) * 0.66, B.z - 3.95);
      group.add(scr);
      for (let k = 0; k < 4 && i !== 5; k++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3 + (k * 0.17) % 0.5, 0.05), new THREE.MeshBasicMaterial({ color: 0x5aff8a }));
        line.position.set(scr.position.x - 0.2, scr.position.y + 0.18 - k * 0.12, B.z - 3.91);
        group.add(line);
      }
    }
    for (let i = 0; i < 4; i++) {
      const cable = box(0.05, 0.03, 2.2 + i * 0.4, [0x3a7dd8, 0x5aff8a, 0xd8342c, 0xf2cf5b][i]);
      cable.position.set(B.x - 0.8 + i * 0.3, 0.02, B.z - 2.4 + i * 0.2);
      cable.rotation.y = 0.2 * (i - 1.5);
      group.add(cable);
    }
  } else if (name === '메이블') {
    // the collection, shelved: gloves, gnomes, a doorknob with no door
    const shelf = box(3.0, 2.2, 0.5, 0x8a5a3a);
    shelf.position.set(B.x + 2.0, 1.1, B.z - 4.1);
    group.add(shelf);
    HOME_SOLIDS[name] = [{ x: B.x + 2.0, z: B.z - 4.0, w: 3.0, d: 0.6 }];
    for (let i = 0; i < 9; i++) {
      const thing = i % 3 === 0
        ? new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 5), mat(0xd8342c))
        : new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.18), mat([0xf2cf5b, 0x3a7dd8, 0xf5f2e9][i % 3]));
      thing.position.set(B.x + 1.0 + (i % 3) * 1.0, 0.6 + Math.floor(i / 3) * 0.6, B.z - 3.8);
      group.add(thing);
    }
    const gnome = new THREE.Group();
    const gb = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 6), mat(0x3a7dd8));
    gb.position.y = 0.25;
    const gh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xf2d8b8));
    gh.position.y = 0.58;
    const gc = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 6), mat(0xd8342c));
    gc.position.y = 0.82;
    gnome.add(gb, gh, gc);
    gnome.position.set(B.x - 1.2, 0, B.z - 2.4);
    group.add(gnome);
  } else if (name === '버터팻') {
    // the churn, the pails, and a portrait of a truly excellent field
    const churn = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.9, 9), mat(0x8a5a3a));
    barrel.position.y = 0.45;
    churn.add(barrel);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5), mat(0x6b4a2e));
    handle.position.y = 1.2;
    churn.add(handle);
    churn.position.set(B.x + 3.2, 0, B.z - 3.4);
    group.add(churn);
    HOME_SOLIDS[name] = [{ x: B.x + 3.2, z: B.z - 3.4, r: 0.45 }];
    for (let i = 0; i < 3; i++) {
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 8), mat(0x9aa0a6, 0.5));
      pail.position.set(B.x - 1 + i * 0.7, 0.17, B.z - 3.9);
      group.add(pail);
    }
    const fieldFrame = box(1.6, 1.1, 0.1, 0x8a5a3a);
    fieldFrame.position.set(B.x + 1, 2.1, B.z - 4.35);
    group.add(fieldFrame);
    const fieldArt = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.85),
      new THREE.MeshBasicMaterial({ color: 0x6ec45a }));
    fieldArt.position.set(B.x + 1, 2.1, B.z - 4.29);
    group.add(fieldArt);
  } else if (name === '브램블') {
    const chair = new THREE.Group();
    const seat = box(1.6, 0.5, 1.5, 0x8a5a3a);
    seat.position.y = 0.45;
    const back = box(1.6, 1.3, 0.35, 0x8a5a3a);
    back.position.set(0, 1.1, -0.6);
    const cushion = box(1.4, 0.22, 1.2, 0x6fae5c);
    cushion.position.y = 0.78;
    chair.add(seat, back, cushion);
    chair.position.set(B.x + 2.8, 0, B.z - 2.6);
    chair.rotation.y = -0.5;
    group.add(chair);
    for (let i = 0; i < 3; i++) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 8), mat(0xd9a440, 0.5));
      pot.position.set(B.x - 1.8 + i * 0.7, 0.2, B.z - 3.9);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 8), mat(0x8a5a3a));
      lid.position.set(pot.position.x, 0.44, pot.position.z);
      group.add(pot, lid);
    }
    const plant = new THREE.Group();
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 7), mat(0xb05a4a, 0.8));
    planter.position.y = 0.2;
    plant.add(planter);
    for (let k = 0; k < 3; k++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7, 5), mat(0x55b055));
      frond.position.set(Math.cos(k * 2.1) * 0.12, 0.7, Math.sin(k * 2.1) * 0.12);
      frond.rotation.x = Math.cos(k * 2.1) * 0.3;
      plant.add(frond);
    }
    plant.position.set(B.x - 4.5, 0, B.z + 2.5);
    group.add(plant);
  }
}

// ------------------------------------------------------------- the works ----

// ---- the Morning Signal ----------------------------------------------
// The cottage radio's daily bulletin: never more than three items, because
// mornings deserve mercy. Birthdays and holidays outrank the news desk.
const SIGNAL_WEATHER = {
  clear: '날씨: 맑음. 하늘이 결심했어요.',
  rain: '날씨: 비. 물고기들이 찬성해요. 연구소 깃발은 휘날리지 않아요; 양모라서, 본인도 알아요.',
  snow: '날씨: 눈, 포근하게. 뜬 걸 입으세요.',
  fog: '날씨: 안개. 저 밖에서 종소리가 들리면, 그건 당신과 안개 사이의 일이에요.',
};
const SIGNAL_NEWS = [
  '낫벨 연구소, 달이 아직 거기 있다고 보고. 매일 밤 검증 계속.',
  '어제 조수가 병 41개를 밀려들게 함. 모스가 9개 분류, 속도를 “야심적”이라 평가.',
  '불코, 핫도그 가격 여전히 1.5버튼 확인. 경제가 감사의 묵념을 올림.',
  '등대 갈고리가 밤사이 또 닦임. 목격자 없음. 갈고리는, 전해지는 바로, 반짝임.',
  '핍, 버튼왜건 매물설 부인. 핍은 또한 버튼왜건이 뭔지 아는지도 부인.',
  '바깥 바다에서 고래가 연습하는 소리 포착. 초기 평가: 진심 어림.',
  '그로브 선, 모든 열차 정시 운행 보고, “시간”의 지역 정의 기준.',
  '화산, 여전히 편안함 유지. 신더, 물어봐 준 모두에게 감사.',
];

export function playMorningSignal() {
  const d = new Date();
  const items = [];
  const bd = Object.entries(BIRTHDAYS)
    .find(([, [m, day]]) => d.getMonth() + 1 === m && d.getDate() === day);
  if (bd) items.push(`It is ${bd[0]}’s birthday today. Gifts are not required. Gifts are, we are told, accepted.`);
  if (HOLIDAY) items.push(`Today is ${HOLIDAY.name}. The bunting is up. The bunting committee thanks the bunting committee.`);
  items.push(SIGNAL_WEATHER[currentWeather()] ?? SIGNAL_WEATHER.clear);
  if (items.length < 3) {
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    items.push(SIGNAL_NEWS[doy % SIGNAL_NEWS.length]);
  }
  ui.say([
    '🎙 “좋은 아침이에요. 모닝 시그널입니다, 켜신 때부터 방송 중.”',
    ...items.slice(0, 3).map((t) => `“${t}”`),
    '“시그널이었습니다. 조심히 가세요.”',
  ], { speaker: '모닝 시그널', voice: 330 });
}

export function createHouses(animals, obstacles = []) {
  const group = new THREE.Group();
  const updates = [];
  const home = SITES.home;

  // ----- your cottage
  const cottage = makeCottage({ wall: 0xfdf6e8, roof: 0x5b8bc9, door: 0xb05a4a }, 1.15);
  const hy = terrainHeight(home.x, home.z);
  cottage.position.set(home.x, hy, home.z - 1.5);
  group.add(cottage);
  addStilts(group, home.x, home.z - 1.5, hy, COTTAGE_BODY_HALF_W * 1.15, COTTAGE_BODY_HALF_D * 1.15, 0);
  zones.addBlockerBox(home.x, home.z - 1.5, 4.9 * 1.15, 4.3 * 1.15, 0, 0.05); // the footing's footprint

  // your mailbox, by the garden path
  const myBox = placeMailbox(group, home.x + 3.6, home.z + 2.2, 0, 0x5b8bc9);
  register({
    pos: new THREE.Vector3(home.x + 3.6, 0, home.z + 2.2), r: 1.6,
    label: () => (mail.unread() ? '우체통 확인하기 (깃발이 올라갔어요!)' : '우체통 확인하기'),
    use: () => mail.checkMailbox(),
  });
  // the mail keeps its own clock; your flag is up when there's something new
  const theirBoxes = [];
  updates.push((dt) => {
    mail.poll(dt);
    myBox.userData.setFlag(mail.unread() > 0);
    for (const [name, mb] of theirBoxes) mb.userData.setFlag(mail.flagUp(name));
  });

  // window boxes, because it is YOUR house
  for (const sx of [-1, 1]) {
    const wbox = box(0.9, 0.25, 0.3, 0x8a5a3a);
    wbox.position.set(home.x + sx * 1.6, hy + 0.95, home.z + 0.85);
    group.add(wbox);
    for (let i = 0; i < 3; i++) {
      const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
        mat(pick([0xff6b81, 0xffd23e, 0xc77dff]), 0.6));
      bloom.position.set(home.x + sx * 1.6 + (i - 1) * 0.26, hy + 1.15, home.z + 0.85);
      group.add(bloom);
    }
  }

  // ----- cottage interior
  const B = IN_HOME;
  {
    const roomStart = group.children.length;
    // floor + walls (same dollhouse recipe as the village interiors)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 10), mat(0xa97c50));
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    floor.castShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [13, 4.4, 0.4, B.x, 2.2, B.z - 5],
      [0.4, 4.4, 10, B.x - 6.5, 2.2, B.z],
      [0.4, 4.4, 10, B.x + 6.5, 2.2, B.z],
    ]) {
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xf0e2c8));
      wallMesh.position.set(x, y, z);
      group.add(wallMesh);
    }
    // the bed
    const bedFrame = box(2.0, 0.5, 3.0, 0x8a5a3a);
    bedFrame.position.set(B.x - 4.6, 0.25, B.z - 3.2);
    const mattress = box(1.8, 0.3, 2.7, 0xfffaf0);
    mattress.position.set(B.x - 4.6, 0.6, B.z - 3.2);
    const pillow = box(1.2, 0.25, 0.7, 0xbfe6f2);
    pillow.position.set(B.x - 4.6, 0.82, B.z - 4.2);
    const blanket = box(1.85, 0.12, 1.6, 0xc25b4e);
    blanket.position.set(B.x - 4.6, 0.78, B.z - 2.6);
    group.add(bedFrame, mattress, pillow, blanket);
    register({
      pos: new THREE.Vector3(B.x - 3.4, 0, B.z - 3), r: 1.8, zone: 'home',
      label: '침대에 풀썩 눕기',
      use: async () => {
        await ui.fadeSwap(() => {});
        S.save();
        ui.toast('멋지게 낮잠 잤어요. 섬이 모든 걸 기억해 둘 거예요.', '😴');
        ui.say(pick([
          '따뜻하고 물속인 어딘가에서 종이 울리는 꿈을 꿔요. 행복한 소리예요.',
          '배가 되는 꿈을 꿔요. 좋은 배요.',
          '낮잠 한 번 동안 아무것도 당신을 필요로 하지 않았어요. 멋졌어요.',
        ]));
      },
    });

    // bookshelf
    const shelf = box(2.6, 2.4, 0.5, 0x8a5a3a);
    shelf.position.set(B.x + 3.6, 1.2, B.z - 4.6);
    group.add(shelf);
    for (let i = 0; i < 8; i++) {
      const book = box(0.18, 0.5, 0.32, [0xc25b4e, 0x5b8bc9, 0x6fae5c, 0xffd23e][i % 4]);
      book.position.set(B.x + 2.6 + (i % 4) * 0.24 + (i > 3 ? 0.55 : 0), 1.0 + Math.floor(i / 4) * 0.7, B.z - 4.55);
      group.add(book);
    }
    register({
      pos: new THREE.Vector3(B.x + 3.6, 0, B.z - 3.9), r: 1.7, zone: 'home',
      label: '책꽂이 구경하기',
      use: () => ui.say(`아무 거나 하나 뽑았어요: ${pick(BOOKS)}`),
    });

    // rug, table, the window with a sea view
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.06, 10), mat(0xc9b178, 0.8));
    rug.position.set(B.x, 0.06, B.z + 0.6);
    group.add(rug);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 8), mat(0x8a5a3a));
    table.position.set(B.x, 0.95, B.z + 0.6);
    const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 6), mat(0x6b4a2e));
    tLeg.position.set(B.x, 0.45, B.z + 0.6);
    group.add(table, tLeg);
    const lamp = makeHangingLamp(0x5b8bc9); // home is a warm bulb over your own table
    lamp.position.set(B.x, 2.9, B.z + 0.6);
    group.add(lamp);

    // the radio: wood, one dial, one antenna, complete trust
    const radio = new THREE.Group();
    const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.2), mat(0x8a5a3a));
    radioBody.castShadow = true;
    radio.add(radioBody);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), mat(0xf2cf5b, 0.4));
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0.12, 0, 0.11);
    radio.add(dial);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.02), mat(0x5a4a38));
    grille.position.set(-0.08, 0, 0.11);
    radio.add(grille);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), mat(0x9aa0a6, 0.5));
    antenna.rotation.z = -0.5;
    antenna.position.set(0.2, 0.32, 0);
    radio.add(antenna);
    radio.position.set(B.x + 0.4, 1.15, B.z + 0.4);
    group.add(radio);

    register({
      pos: new THREE.Vector3(B.x + 0.4, 0, B.z + 0.4), r: 1.8, zone: 'home',
      label: '모닝 시그널 듣기',
      use: () => playMorningSignal(),
    });
    const winFrame = box(1.8, 1.3, 0.18, 0x8a5a3a);
    winFrame.position.set(B.x - 1.5, 2.2, B.z - 4.85);
    const winSea = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0),
      new THREE.MeshBasicMaterial({ color: 0x9fdcf7 }));
    winSea.position.set(B.x - 1.5, 2.2, B.z - 4.74);
    group.add(winFrame, winSea);
    register({
      pos: new THREE.Vector3(B.x - 1.5, 0, B.z - 3.9), r: 1.6, zone: 'home',
      label: '창밖 내다보기',
      use: () => ui.say('창이 바다를 향해 있어요. 바다도, 아는 한, 마주 보고 있어요.'),
    });

    // the wardrobe: upright, patient, and deeper than it looks.
    // pockets go in, pockets come out; the wardrobe holds the difference.
    {
      const W = new THREE.Group();
      const bodyW = box(1.5, 2.5, 0.7, 0x8a5a3a);
      bodyW.position.y = 1.35;
      W.add(bodyW);
      const cornice = box(1.64, 0.14, 0.8, 0x6b4a2e);
      cornice.position.y = 2.66;
      W.add(cornice);
      for (const sx of [-0.37, 0.37]) {
        const doorW = box(0.66, 2.2, 0.06, 0x96703f);
        doorW.position.set(sx, 1.32, 0.37);
        W.add(doorW);
        const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(0xf2cf5b, 0.4));
        knob.position.set(sx - Math.sign(sx) * 0.24, 1.32, 0.42);
        W.add(knob);
      }
      for (const [fx, fz] of [[-0.6, 0.25], [0.6, 0.25], [-0.6, -0.25], [0.6, -0.25]]) {
        const foot = box(0.12, 0.2, 0.12, 0x6b4a2e);
        foot.position.set(fx, 0.1, fz);
        W.add(foot);
      }
      W.rotation.y = -Math.PI / 2; // doors face into the room
      W.position.set(B.x + 5.35, 0, B.z + 1.4);
      group.add(W);

      const stowMenu = async () => {
        const stock = Object.entries(S.state.inv).filter(([, n]) => n > 0);
        if (!stock.length) return wardrobeMenu();
        const choice = await ui.ask('주머니, 옷장을 만나다.', [
          ...stock.map(([id, n]) => ({
            label: `${ITEMS[id]?.emoji ?? '❔'} ${ITEMS[id]?.name ?? id} ×${n}`,
            value: id,
          })),
          { label: '다 했어요', value: null },
        ]);
        if (!choice) return wardrobeMenu();
        const n = S.countItem(choice);
        S.stow(choice, n);
        ui.toast(`${n}개의 <b>${ITEMS[choice]?.name ?? choice}</b>을(를) 넣었어요. 옷장이 정돈된 주머니를 좋아해요.`, '🗄️');
        ui.updateHUD();
        return stowMenu();
      };
      const unstowMenu = async () => {
        const stored = Object.entries(S.state.storage).filter(([, n]) => n > 0);
        if (!stored.length) return wardrobeMenu();
        const choice = await ui.ask('옷장이 작고 의전적인 삐걱 소리로 열려요.', [
          ...stored.map(([id, n]) => ({
            label: `${ITEMS[id]?.emoji ?? '❔'} ${ITEMS[id]?.name ?? id} ×${n}`,
            value: id,
          })),
          { label: '다 했어요', value: null },
        ]);
        if (!choice) return wardrobeMenu();
        const n = S.state.storage[choice] || 0;
        S.unstow(choice, n);
        ui.toast(`${n}개의 <b>${ITEMS[choice]?.name ?? choice}</b>을(를) 꺼냈어요. 전부 아름답게 보관돼 있었어요.`, '🗄️');
        ui.updateHUD();
        return unstowMenu();
      };
      const wardrobeMenu = async () => {
        const held = Object.values(S.state.inv).reduce((a, b) => a + b, 0);
        const kept = Object.values(S.state.storage).reduce((a, b) => a + b, 0);
        const choice = await ui.ask('옷장이 준비된 채 서 있어요. 겨울들, 이사들, 그리고 한 번의 장식용 조롱박 시기를 견뎌냈어요.', [
          { label: '📥 뭔가 넣기', value: 'stow', hint: `주머니에 ${held}개`, disabled: !held },
          { label: '📤 뭔가 꺼내기', value: 'unstow', hint: `${kept}개 보관 중`, disabled: !kept },
          { label: '살며시 닫기', value: null },
        ]);
        if (choice === 'stow') return stowMenu();
        if (choice === 'unstow') return unstowMenu();
      };
      register({
        pos: new THREE.Vector3(B.x + 4.5, 0, B.z + 1.4), r: 1.7, zone: 'home',
        label: '옷장 열기',
        use: wardrobeMenu,
      });
    }

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('home', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 6, x1: B.x + 6, z0: B.z - 4.4, z1: B.z + 4.4 },
      blockers: [
        { x: B.x - 4.6, z: B.z - 3.2, r: 1.5 }, // bed
        { x: B.x, z: B.z + 0.6, r: 0.8 },       // table
        { x: B.x + 5.35, z: B.z + 1.4, r: 0.95 }, // the wardrobe
      ],
      spawn: { x: B.x, z: B.z + 3.8, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 22, fogFar: 55,
        hemiSky: 0xffe9c8, hemiGround: 0x70573b, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(home.x, 0, home.z + 1.2), r: 2.4,
      label: '안으로 들어가기 (네 집이야!)',
      use: () => zones.go('home'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.6), r: 1.6, zone: 'home',
      label: '밖으로 나가기',
      use: () => zones.leaveTo({ x: home.x, z: home.z + 2.6, rotY: 0 }),
    });
  }

  // ----- the garden: six plots on the side of the cottage that faces away
  // from the village, so nothing squeezes against the shops
  const plots = [];
  const awayA = Math.atan2(home.x - SITES.village.x, home.z - SITES.village.z);
  const gx = home.x + Math.sin(awayA) * 4.6;
  const gz = home.z + Math.cos(awayA) * 4.6 + 1.2;
  for (let i = 0; i < PLOT_OFFSETS.length; i++) {
    const [ox, oz] = PLOT_OFFSETS[i];
    const px = gx + ox, pz = gz + oz;
    const py = terrainHeight(px, pz);
    const soil = box(1.15, 0.22, 1.15, 0x6b4a2e);
    soil.position.set(px, py + 0.08, pz);
    group.add(soil);
    const plot = { i, x: px, y: py, z: pz, visual: null, lastStage: null };
    plots.push(plot);

    register({
      pos: new THREE.Vector3(px, 0, pz), r: 1.6,
      label: () => {
        const stage = plotStage(S.state.garden[i]);
        if (stage === 'empty') return '뭔가 심기';
        if (stage === 'ready') return '수확!';
        return '자라는 중…';
      },
      use: async () => {
        const data = S.state.garden[i];
        const stage = plotStage(data);
        if (stage === 'ready') {
          const grown = GROWTH[data.seed];
          delete S.state.garden[i];
          S.addItem(grown.produce, grown.n);
          S.save();
          jingle();
          ui.toast(`${grown.n}개의 <b>${ITEMS[grown.produce].name}</b>을(를) 수확했어요!`, ITEMS[grown.produce].emoji);
          ui.updateHUD();
          return;
        }
        if (stage !== 'empty') {
          const g = GROWTH[data.seed];
          const left = Math.max(0, Math.ceil((g.secs * 1000 - (Date.now() - data.plantedAt)) / 60000));
          ui.say(left <= 1
            ? '거의 다 왔어요. 집중하고 있어요. 알 수 있어요.'
            : `잘 자라고 있어요. 식물 노릇을 앞으로 약 ${left}분 더 하게 해 주세요.`);
          return;
        }
        const seedsOwned = Object.keys(GROWTH).filter((id) => S.countItem(id) > 0);
        if (!seedsOwned.length) {
          ui.say('비어 있고 희망찬 흙. 핍이 씨앗을 팔아요 — 당근, 토마토, 호박. 흙은 연습해 왔어요.');
          return;
        }
        const choice = await ui.ask('뭘 심을까요?', [
          ...seedsOwned.map((id) => ({
            label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id, hint: `×${S.countItem(id)}`,
          })),
          { label: '오늘은 패스', value: null },
        ]);
        if (!choice) return;
        S.removeItem(choice, 1);
        S.state.garden[i] = { seed: choice, plantedAt: Date.now() };
        S.save();
        thud();
        ui.toast(`<b>${ITEMS[choice].name}</b>을(를) 심었어요. 이제: 기다림의 고귀한 예술.`, '🌱');
      },
    });
  }

  let gardenPoll = 0;
  updates.push((dt) => {
    gardenPoll -= dt;
    if (gardenPoll > 0) return;
    gardenPoll = 1;
    for (const plot of plots) {
      const data = S.state.garden[plot.i];
      const stage = plotStage(data);
      if (stage === plot.lastStage) continue;
      plot.lastStage = stage;
      if (plot.visual) group.remove(plot.visual);
      plot.visual = buildPlotVisual(stage, data?.seed);
      plot.visual.position.set(plot.x, plot.y + 0.18, plot.z);
      group.add(plot.visual);
    }
  });

  // ----- villager houses, each near where its owner likes to loiter
  const taken = [{ x: home.x, z: home.z }];
  function houseSpotNear(px, pz) {
    for (let r = 4; r < 14; r += 1.5) {
      for (let a = 0; a < Math.PI * 2; a += 0.45) {
        const x = px + Math.cos(a) * r;
        const z = pz + Math.sin(a) * r;
        const h = terrainHeight(x, z);
        if (h < 0.8 || h > 6.5) continue;
        if (!clearOfSites(x, z, 2.5)) continue;
        // not on a railway, a station ramp, a bridge foot, or another building
        if (zones.nearAnything(x, z, 3.6)) continue;
        if (taken.some((q) => Math.hypot(q.x - x, q.z - z) < 7)) continue;
        // never drop a house on a villager — its blocker would trap them
        if (animals.some((a) => Math.hypot(a.g.position.x - x, a.g.position.z - z) < 3.4)) continue;
        // and never into a tree, pine, or rock
        if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2.8)) continue;
        // a touch of flat ground for the doorstep, and no wild cliff-hangs
        if (Math.abs(terrainHeight(x, z + 2) - h) > 1.2) continue;
        const corners = [[2, 2], [2, -2], [-2, 2], [-2, -2]]
          .map(([cx, cz]) => terrainHeight(x + cx, z + cz));
        if (h - Math.min(...corners) > 2.6) continue;
        taken.push({ x, z });
        return { x, z, h };
      }
    }
    return null;
  }

  const households = []; // { a, name, zoneId, seat, doorOut, home }
  let villagerIdx = 0;

  for (const a of animals) {
    const name = a.identity?.name;

    if (name === '크럼') {
      // Crumb's house floats: nights are spent on the MouseBoat's deck
      if (!MOUSEBOAT) continue;
      const vh = {
        a, name, zoneId: 'island',
        seat: { x: MOUSEBOAT.deck.x, y: MOUSEBOAT.deck.y, z: MOUSEBOAT.deck.z },
        doorOut: MOUSEBOAT.doorOut,
        home: false,
      };
      households.push(vh);
      let crumbIdx = 0;
      register({
        getPos: () => a.g.position, r: 3.4,
        enabled: () => vh.home,
        label: '크럼에게 소리쳐 부르기',
        use: () => {
          const lines = HOME_LINES.크럼;
          ui.say(lines[crumbIdx++ % lines.length], { speaker: '크럼', voice: a.identity.voice });
        },
      });
      register({
        pos: new THREE.Vector3(MOUSEBOAT.knock.x, 0, MOUSEBOAT.knock.z), r: 2.2,
        enabled: () => !vh.home,
        label: '마우스보트 들여다보기',
        use: () => ui.say(KNOCKS.크럼),
      });
      continue;
    }

    if (!name || !KNOCKS[name]) continue; // ducks handled below
    const spot = houseSpotNear(a.g.position.x, a.g.position.z);
    if (!spot) continue;
    const style = HOUSE_STYLES[name];
    const house = makeCottage(style, 0.8);
    doors.hinge(`house_${name}`, ...house.userData.door);
    house.position.set(spot.x, spot.h, spot.z);
    // face the house toward its villager's patch — but only a way whose
    // doorstep you can actually walk up to (dry, open, not a cliff); some
    // used to open straight onto the sea
    {
      const want = Math.atan2(a.g.position.x - spot.x, a.g.position.z - spot.z);
      let best = want, bestScore = -Infinity;
      for (let k = 0; k < 16; k++) {
        const ry = want + (k / 16) * Math.PI * 2;
        let score = -Math.abs(Math.atan2(Math.sin(ry - want), Math.cos(ry - want))); // prefer facing home
        for (const d of [3.2, 4.5, 6]) {
          const x = spot.x + Math.sin(ry) * d, z = spot.z + Math.cos(ry) * d;
          const h = terrainHeight(x, z);
          if (h < 0.35 || !zones.islandCanWalk(x, z) || zones.nearAnything(x, z, 0.8)) score -= 10;
          if (Math.abs(h - spot.h) > 1.3) score -= 4;
        }
        if (score > bestScore) { bestScore = score; best = ry; }
      }
      house.rotation.y = best;
    }
    group.add(house);
    addStilts(group, spot.x, spot.z, spot.h, COTTAGE_BODY_HALF_W * 0.8, COTTAGE_BODY_HALF_D * 0.8, house.rotation.y);
    zones.addBlockerBox(spot.x, spot.z, 4.9 * 0.8, 4.3 * 0.8, house.rotation.y, 0.05);

    const doorWorld = new THREE.Vector3(
      spot.x + Math.sin(house.rotation.y) * 2.4, 0,
      spot.z + Math.cos(house.rotation.y) * 2.4);
    const doorOut = {
      x: spot.x + Math.sin(house.rotation.y) * 3.2,
      z: spot.z + Math.cos(house.rotation.y) * 3.2,
      rotY: house.rotation.y,
    };

    // their mailbox: front-right of the house, by the path, flag and all
    {
      const ry = house.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
      const lx = 2.4, lz = 2.9;
      const mx = spot.x + lx * c + lz * sn, mz = spot.z - lx * sn + lz * c;
      if (zones.islandCanWalk(mx, mz)) {
        theirBoxes.push([name, placeMailbox(group, mx, mz, ry, style.roof)]);
        register({
          pos: new THREE.Vector3(mx, 0, mz), r: 1.4,
          label: `${name}의 우체통 들여다보기`,
          use: () => ui.say(mail.flagUp(name)
            ? `${name}의 우체통. 작은 깃발이 올라갔어요: 당신의 편지가 안에서 기다려요. 이제 그들의 것이에요. 그냥 둬요.`
            : `${name}의 우체통. 당신의 우편물이 아니고, 당신은 그런 이웃이 아니에요. 깃발은 내려가 있어요.`),
        });
      }
    }

    // ----- their room, furnished to taste
    const B = { x: 300, z: 320 + villagerIdx * 80 };
    villagerIdx++;
    const zoneId = `house_${name.toLowerCase()}`;
    const roomStart = group.children.length;
    const seat = buildVillagerInterior(group, B, name, style);
    const room = collectInteriorRoot(group, roomStart);

    zones.registerInterior(zoneId, {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.1, x1: B.x + 5.1, z0: B.z - 4.0, z1: B.z + 4.4 },
      blockers: [{ x: B.x - 3.4, z: B.z - 2.8, r: 1.3 }, ...(HOME_SOLIDS[name] || [])], // the bed, and whatever else this home keeps
      spawn: { x: B.x, z: B.z + 3.6, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 20, fogFar: 50,
        hemiSky: 0xffe9c8, hemiGround: 0x70573b, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });

    const vh = { a, name, zoneId, seat: { x: B.x + 1.6, z: B.z - 2.2 }, doorOut, home: false };
    households.push(vh);

    // the door knows whether anyone's in
    register({
      pos: doorWorld, r: 2.0,
      label: () => (vh.home ? `${name} 방문하기` : `${name}의 집 문 노크하기`),
      use: async () => {
        doorChime();
        if (!vh.home) {
          ui.say(KNOCKS[name]);
          return;
        }
        await ui.say(COME_INS[name]);
        zones.go(zoneId);
      },
    });

    // them, at home
    let homeLineIdx = 0;
    register({
      getPos: () => a.g.position, r: 2.6, zone: zoneId,
      enabled: () => vh.home && !vh.inCave,
      label: `${name}와(과) 대화하기`,
      use: async () => {
        if (await birthdayTalk(name, a.identity.voice)) return; // it follows you home
        const lines = HOME_LINES[name];
        ui.say(lines[homeLineIdx++ % lines.length], { speaker: name, voice: a.identity.voice });
      },
    });

    // one personal prop each
    const prop = HOME_PROPS[name];
    register({
      pos: new THREE.Vector3(B.x - 1.5, 0, B.z - 3.2), r: 2.0, zone: zoneId,
      label: prop.label,
      use: () => ui.say(prop.text),
    });

    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.0), r: 1.6, zone: zoneId,
      label: '밖으로 나가기',
      use: () => zones.leaveTo(doorOut),
    });
  }

  // 루스 lives at Barb's: same door, same room, her own spot by the yarn
  {
    const barb = households.find((vh) => vh.name === '바브');
    const ruthA = animals.find((a) => a.identity?.name === '루스');
    if (barb && ruthA) {
      const vh = { a: ruthA, name: '루스', zoneId: barb.zoneId, seat: { x: barb.seat.x - 2.2, z: barb.seat.z + 1.4 }, doorOut: barb.doorOut, home: false };
      households.push(vh);
      let ri = 0;
      register({
        getPos: () => ruthA.g.position, r: 2.6, zone: barb.zoneId,
        enabled: () => vh.home,
        label: '루스와 대화하기',
        use: async () => {
          if (await birthdayTalk('루스', ruthA.identity.voice)) return;
          ui.say(HOME_LINES.루스[ri++ % HOME_LINES.루스.length], { speaker: '루스', voice: ruthA.identity.voice });
        },
      });
    }
  }

  // 엠버 keeps a second address: the cave, at her appointed hours
  const ember = households.find((vh) => vh.name === '엠버');
  if (ember) {
    ember.caveSeat = { x: -295.5, z: -4 };
    let caveIdx = 0;
    register({
      getPos: () => ember.a.g.position, r: 2.6, zone: 'cave',
      enabled: () => !!ember.inCave,
      label: '엠버와 대화하기',
      use: () => {
        const lines = HOME_LINES.엠버;
        ui.say(lines[caveIdx++ % lines.length], { speaker: '엠버', voice: ember.a.identity.voice });
      },
    });
  }

  function emberCaveTime() {
    if (currentWeather() !== 'clear') return false; // rain days are outside days
    const h = hourNow();
    return h >= EMBER_CAVE_HOURS[0] && h < EMBER_CAVE_HOURS[1];
  }

  // the clock (and the weather) decides who's in
  let schedulePoll = 0;
  // Going home is a WALK: at bedtime a villager heads for their own front
  // door (finishing whatever they were doing), and only once they reach it
  // do they go in. Only if they truly can't get there — stranded across the
  // water by a late train — does the island quietly tuck them in anyway.
  function arriveHome(vh) {
    const a = vh.a;
    if (a.homeRange) a.range = a.homeRange; // a day out's borrowed range ends at your own door
    vh.walking = false;
    vh.tries = 0;
    a.bedtime = false;
    a.goal = null;
    vh.home = true;
    a.home = true;
    a.away = true;
    if (vh.mode === 'cave') {
      a.g.position.set(vh.caveSeat.x, 0, vh.caveSeat.z);
      a.g.rotation.y = Math.PI / 2;
    } else {
      a.g.position.set(vh.seat.x, vh.seat.y ?? 0, vh.seat.z);
      a.g.rotation.y = 0; // facing the door, ready for visitors
    }
  }

  function doorFor(vh) {
    return vh.mode === 'cave' ? (zones.doorOf('cave') || vh.doorOut) : vh.doorOut;
  }

  function sendHome(vh) {
    const a = vh.a;
    const door = doorFor(vh);
    vh.walking = true;
    a.bedtime = true;
    a.goal = {
      x: door.x, z: door.z, r: 1.4,
      done: () => {
        if (!vh.walking) return;
        const key = `house_${vh.name}`;
        const th = vh.mode !== 'cave' && doors.threshold(key);
        if (!th) { arriveHome(vh); return; }
        doors.open(key, 1.8);
        doors.through(a, a.g.position, th, () => { if (vh.walking) arriveHome(vh); });
      },
      fail: () => {
        vh.tries = (vh.tries || 0) + 1;
        if (vh.tries >= 3 && vh.walking) arriveHome(vh); // re-sent from update otherwise
      },
    };
  }

  function applySchedules(force = false) {
    for (const vh of households) {
      let mode;
      if (vh.forced !== undefined) mode = vh.forced ? 'house' : 'out';
      else if (vh.name === '엠버' && emberCaveTime()) mode = 'cave';
      else mode = isHomeNow(vh.name) ? 'house' : 'out';
      if (!force && mode === vh.mode) continue;
      const was = vh.mode;
      vh.mode = mode;
      if (mode !== 'out') {
        // at load, when forced, or when moving house→cave: no walk to stage
        if (force || vh.forced !== undefined || was !== 'out' || vh.a.riding) arriveHome(vh);
        else sendHome(vh);
        continue;
      }
      vh.walking = false;
      vh.a.bedtime = false;
      vh.home = false;
      vh.inCave = false;
      vh.a.home = false;
      vh.a.away = !!vh.a.errand;
      // out the front door into the morning (or out of the cave mouth, and
      // an amble home from there)
      const exit = was === 'cave' ? (zones.doorOf('cave') || vh.doorOut) : vh.doorOut;
      const th = !force && was === 'house' && doors.threshold(`house_${vh.name}`);
      if (th) {
        doors.open(`house_${vh.name}`, 1.8);
        const a = vh.a;
        doors.through(a, { x: th.x, y: th.y, z: th.z }, { x: exit.x, y: terrainHeight(exit.x, exit.z), z: exit.z }, () => {
          a.g.rotation.y = vh.doorOut.rotY;
        });
      } else {
        vh.a.g.position.set(exit.x, terrainHeight(exit.x, exit.z), exit.z);
        vh.a.g.rotation.y = vh.doorOut.rotY;
      }
      if (was === 'cave' && !force) vh.a.goal = { x: vh.doorOut.x, z: vh.doorOut.z, r: 2 };
      vh.a.state = 'idle';
      vh.a.timer = rand(1, 3);
    }
    for (const vh of households) vh.inCave = vh.home && vh.mode === 'cave';
  }
  applySchedules(true);
  updates.push((dt, t, playerPos) => {
    schedulePoll -= dt;
    if (schedulePoll <= 0) {
      schedulePoll = 2;
      applySchedules();
    }
    const zone = zones.current();
    for (const vh of households) {
      // homeward-bound but knocked off course (a chat, a train)? head off again
      if (vh.walking && !vh.a.goal && !vh.a.riding && !vh.a.errand && !vh.a.meeting) sendHome(vh);
      if (vh.home) {
        vh.a.g.visible = vh.inCave ? zone === 'cave' : zone === vh.zoneId;
      } else if (!vh.a.errand && !vh.a.meeting && !vh.a.riding) {
        vh.a.g.visible = true;
      }
    }
    // home villagers breathe gently and turn to face their guest
    for (const vh of households) {
      if (!vh.home) continue;
      if (!vh.a.g.visible) continue;
      const parts = vh.a.g.userData.parts;
      const phase = vh.seat.x + vh.seat.z;
      parts.body.position.y = parts.bodyY + Math.sin(t * 1.5 + phase) * 0.03;
      parts.head.position.y = parts.headY + Math.sin(t * 1.5 + phase + 0.5) * 0.025;
      if (playerPos) {
        const dx = playerPos.x - vh.a.g.position.x;
        const dz = playerPos.z - vh.a.g.position.z;
        if (Math.hypot(dx, dz) < 8) {
          vh.a.g.rotation.y = turnToward(vh.a.g.rotation.y, Math.atan2(dx, dz), dt, 4);
        }
      }
    }
  });

  // ----- the ducks' beach nest
  const duck = animals.find((a) => a.swims && !a.long);
  if (duck) {
    const nx = duck.g.position.x, nz = duck.g.position.z;
    const nest = new THREE.Group();
    // every stick rests on the sand under IT — on a sloped beach a flat ring
    // of driftwood used to dig in on the high side and hover on the low
    const ny = Math.max(terrainHeight(nx, nz), 0.05);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const stick = box(0.7, 0.12, 0.14, 0xa97c50);
      const sx = Math.cos(ang) * 0.8, sz = Math.sin(ang) * 0.8;
      stick.position.set(sx, Math.max(terrainHeight(nx + sx, nz + sz), 0.05) - ny + 0.07, sz);
      stick.rotation.y = ang + Math.PI / 2 + rand(-0.3, 0.3);
      nest.add(stick);
    }
    const pillow = box(0.6, 0.18, 0.6, 0xbfe6f2);
    pillow.position.y = 0.12;
    nest.add(pillow);
    nest.position.set(nx, ny, nz);
    group.add(nest);
    register({
      pos: nest.position, r: 2.0,
      label: '둥지 들여다보기',
      use: () => ui.say('떠내려온 나무의 정돈된 고리. 안에는 규정 베개 한 (1) 개와 “비축량 — 제독 전용 (퍼들: 안 됨)” 라벨의 간식 저장고.'),
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
    doors.update(dt, t); // every door on the islands, swinging as it's used
  }

  // test/debug: pin a villager home (true), out (false), or back to the clock (undefined)
  function forceHome(name, value) {
    const vh = households.find((h) => h.name === name);
    if (!vh) return;
    vh.forced = value;
    applySchedules(true);
  }

  // where the carrier drops and collects (mail.js): each neighbor's box,
  // and yours. (Ruth's letters go to Barb's box; Crumb's to the MouseBoat.)
  const mailboxes = Object.fromEntries(theirBoxes.map(([n, mb]) => [n, { x: mb.position.x, z: mb.position.z }]));
  if (mailboxes.바브) mailboxes.루스 = mailboxes.바브;
  if (MOUSEBOAT) mailboxes.크럼 = { x: MOUSEBOAT.knock.x, z: MOUSEBOAT.knock.z };
  return { group, update, forceHome, mailboxes, myMailbox: { x: myBox.position.x, z: myBox.position.z } };
  }
