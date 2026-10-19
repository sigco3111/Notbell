// Oasis Estates — A Planned Community. South-west, out past the chart's
// western edge, on an island that didn't happen so much as get approved: a
// flat oval of lawn mown in stripes, seven identical houses around a
// cul-de-sac, a strip of shops, a coffee place, a chicken place that is not
// chicken, and the CaMall. Camels, parrots, one brontosaurus family. Beverly
// Humphries is the president of the Homeowners' Association. Do not mess
// with Beverly.
//
// One ferry: the HOA approved exactly one route, to BULKO and back (bulk
// goods are consistent with the character of the community). A rowboat can
// also land on the east beach; the HOA has not yet noticed rowboats.
//
// Bell hook (do not resolve): the covenant forbids bells — doorbells, bike
// bells, wind chimes, the ice cream truck's song. Nobody knows why. The
// developer wrote it in: Moledecai Developments. Trader Polly's rings no bell
// at the till; Pico says "BRRRING" out loud instead.
//
// Layout is in pad-local (u, v): u east, v south, from the pad's center.
// The camera looks north, so everything that can faces south (+v).

import * as THREE from 'three';
import { OASIS_PAD, ISLAND8, WATER_Y, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching, sip, tone, blip } from './audio.js';
import { buildAnimal, animateGait } from './animals.js';
import { rand, turnToward } from './utils.js';
import { addIslandInfo, addZonePlace } from './fieldguide.js';
import { glowWindow } from './nightglow.js';
import { isNight, hourNow } from './calendar.js';
import { ITEMS } from './catalog.js';
import { makeWindow, makeHangingLamp } from './buildings.js';

function mat(color, rough = 0.88) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, seg, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function ball(r, color, detail = 0) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}

// A painted sign: any colors, chunky rounded letters, auto-fit. (Box faces
// all carry the painting, so a sign on a roof reads from either side.)
function sign(lines, { w = 3.4, h = 0.8, d = 0.08, bg = '#fffaf0', fg = '#5b4a32', border = null, stripes = null, px = 512 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = px;
  cv.height = Math.round(px * (h / w));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (stripes) {
    // Sahara: black and white, vertical, very serious
    const n = 16;
    for (let i = 0; i < n; i += 2) {
      ctx.fillStyle = stripes;
      ctx.fillRect((i / n) * cv.width, 0, cv.width / n, cv.height);
    }
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = cv.height * 0.07;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, cv.width - ctx.lineWidth, cv.height - ctx.lineWidth);
  }
  const L = Array.isArray(lines) ? lines : [lines];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const slot = cv.height / L.length;
  L.forEach((text, i) => {
    const big = i === 0;
    let size = Math.round(slot * (big ? 0.72 : 0.58));
    do {
      ctx.font = `bold ${size}px ui-rounded, 'Segoe UI', system-ui, sans-serif`;
      size -= 2;
    } while (ctx.measureText(text).width > cv.width * 0.9 && size > 10);
    if (stripes) {
      // a white plate behind the letters, so the stripes don't eat them
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cv.width / 2 - tw / 2 - 14, slot * i + slot * 0.18, tw + 28, slot * 0.64);
    }
    ctx.fillStyle = fg;
    ctx.fillText(text, cv.width / 2, slot * i + slot * 0.54);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.8 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------ static merging ----
// A whole island of one-off meshes costs a draw call each (and another in
// the shadow pass). Once an island is built, mergeStatic bakes everything
// that never moves into one mesh per look (color, roughness, shadow flags),
// and stops tiny things casting shadows the 1024 shadow map can't show.
// Left alone: anything under a node marked userData.dynamic (it moves) or
// userData.noMerge (an interior room), anyone built by buildAnimal, glowing
// panes (they own an emissive material), textures, transparency, instanced
// meshes, and wall-sized boxes (main.js fades those when they're between
// you and the camera — they have to stay their own mesh). Cran and the
// strait import this too.
export function mergeStatic(root) {
  if (globalThis.__NOTBELL_NO_MERGE) return; // (the clip audit wants every mesh as built)
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const take = [];
  const walk = (o, frozen) => {
    if (o.userData.dynamic || o.userData.noMerge || o.userData.parts) frozen = true;
    if (o.isMesh && !o.isInstancedMesh) {
      const g = o.geometry;
      g.computeBoundingSphere?.();
      const sc = o.getWorldScale(new THREE.Vector3());
      const r = (g.boundingSphere?.radius || 0) * Math.max(sc.x, sc.y, sc.z);
      if (r < 0.25) o.castShadow = false; // too small to cast a readable shadow
      const m = o.material;
      const wall = g.type === 'BoxGeometry' && g.parameters.height >= 2.2 && Math.max(g.parameters.width, g.parameters.depth) * g.parameters.height >= 12;
      const plain = m && m.isMeshStandardMaterial && !m.map && !m.transparent && m.opacity >= 1 &&
        (!m.emissive || m.emissive.getHex() === 0) && g.attributes.position && g.attributes.normal;
      if (!frozen && plain && !wall && !o.userData.occlude) {
        const key = `${m.color.getHex()}|${m.roughness}|${m.flatShading}|${m.side}|${o.castShadow}|${o.receiveShadow}`;
        if (!buckets.has(key)) buckets.set(key, { mat: m, cast: o.castShadow, recv: o.receiveShadow, parts: [] });
        buckets.get(key).parts.push(o);
        take.push(o);
      }
    }
    for (const c of o.children) walk(c, frozen);
  };
  walk(root, false);
  const mtx = new THREE.Matrix4(), nm = new THREE.Matrix3();
  for (const b of buckets.values()) {
    if (b.parts.length < 2) continue;
    let count = 0;
    const geos = b.parts.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      count += g.attributes.position.count;
      return { g, o };
    });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    let at = 0;
    const v = new THREE.Vector3();
    for (const { g, o } of geos) {
      mtx.multiplyMatrices(inv, o.matrixWorld);
      nm.getNormalMatrix(mtx);
      const P = g.attributes.position, N = g.attributes.normal;
      for (let i = 0; i < P.count; i++, at++) {
        v.fromBufferAttribute(P, i).applyMatrix4(mtx);
        pos[at * 3] = v.x; pos[at * 3 + 1] = v.y; pos[at * 3 + 2] = v.z;
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        nor[at * 3] = v.x; nor[at * 3 + 1] = v.y; nor[at * 3 + 2] = v.z;
      }
      o.parent.remove(o);
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    mesh.userData.merged = b.parts.length;
    root.add(mesh);
  }
}

// ------------------------------------------------------------ the layout ----
const O = OASIS_PAD;
const GY = O.h; // the pad's height: everything here stands on the same lawn
const RING = { u: -4, v: 12, rIn: 5.5, rOut: 8.3 }; // the cul-de-sac (the HOA prefers "the Circle")
const BLVD = { v0: -11.5, v1: -8.5, u0: -18, u1: 27 }; // Oasis Parkway (NOT a road)
const SPUR = { u: -4, hw: 1.4 };                        // Circle Drive, from the Parkway down to the Circle
const LOT = { u0: -17, u1: 19, v0: -18.5, v1: -12 };    // the Commons lot
const HOUSE_R = 13;                                       // house centers, out from the Circle's middle
const PALM_V = BLVD.v1 + 0.5;

// interiors, off in the elsewhere: a column of their own at x = -300
const IN_Z0 = 600;
const IN = {
  mall: { x: -300, z: IN_Z0 },
  polly: { x: -300, z: IN_Z0 + 80 },
  drom: { x: -300, z: IN_Z0 + 160 },
  mirage: { x: -300, z: IN_Z0 + 240 },
  cluck: { x: -300, z: IN_Z0 + 320 },
};
const HOUSE_IN_Z0 = IN_Z0 + 400; // then the seven houses, 80 apart

// the pier, out the east end of the Parkway — the Persistent calls here on
// the one route the HOA approved: to BULKO and back. boats.js reads this;
// it's plain numbers, so creation order doesn't matter.
const PIER = { u0: 30.2, u1: 42, v: -10, w: 2.2, top: 0.62 };
export const OASIS_DOCK = {
  x: OASIS_PAD.x + PIER.u1 - 1.6, z: OASIS_PAD.z + PIER.v, rotY: -Math.PI / 2, // step off facing the island
  sea: { x: OASIS_PAD.x + PIER.u1 + 7, z: OASIS_PAD.z + PIER.v - 3 },
  buoyPos: new THREE.Vector3(OASIS_PAD.x + PIER.u1 - 4.8, 0, OASIS_PAD.z + PIER.v + 0.75), // (well clear of the sign: one prompt at a time)
};

const VOICE = {
  beverly: 330, harold: 250, gary: 150, linda: 190, junior: 200, kiwi: 620, dakota: 380,
  todd: 280, tiffany: 600, mildred: 360, phyllis: 400, bunny: 440, walt: 230,
  mango: 520, pico: 760, deb: 340, echo: 560, tanner: 300, paloma: 640, rico: 700,
  reggie: 540, sal: 480, auntie: 300, sunny: 580, chad: 290, madison: 470, dale: 170,
};

// who's talking, and what they say next: everybody works through their
// lines in order (so you hear them all), then starts again
const said = {};
function nextLine(key, lines) {
  const i = said[key] ?? 0;
  said[key] = (i + 1) % lines.length;
  return lines[i];
}
function talk(key, name, lines) {
  return () => ui.say(nextLine(key, lines), { speaker: name, voice: VOICE[key] ?? 480 });
}

const REGGIE = [
  '음-음. 이름? … 허니, 명단에 없어요. 아무도 명단에 없어요. 난 그냥 기다리는 꼴 보는 게 좋을 뿐이야.',
  '경비. 게이트하우스. 나. 응, 나 작아. 스테이플러도 작지, 스위티. 그런데 너 스테이플러랑 말다툼한 적 없잖아.',
  '차단봉이 올라가 있는 건 내가 관대해서야. 재고하게 만들지 마.',
  '그거 랜턴이야? 귀엽네. 아주 “노 저어 왔어요” 스타일. 가. 가라고.',
  '나는 다 봐. 모든 잔디. 모든 플라밍고. 배 탄 거위는 내가 거위를 못 보는 줄 알아. 거위 보거든.',
  '베벌리가 내 근무표에 사인해. 내가 베벌리 거에 사인하고. 이게 견제와 균형이야, 베이비.',
  '서성임 금지. …그건 내 일이야. 지나가.',
];

const NOTICES = [
  'NOTICE: Lawns are to be maintained at TWO AND ONE HALF (2½) INCHES. Not two. Not three. The President has a ruler and is not afraid of it.',
  '공지: 규약 제9조(소음)에 따라 다음은 금지됩니다: 초인종, 자전거 벨, 윈드차임, 디너 벨, 썰매 벨, 소 종, 아이스크림 트럭의 노래. 아이스크림 트럭은 방문할 수 있습니다. 단, 침묵 속에서만. 11년째 침묵 속에서 오고 있습니다. 제9조가 왜 그런 내용인지 아는 사람은 없으며, 계약서에 있었습니다. 노크해 주세요.',
  '공지: 페리 제안(브라인 선장 제출)은 여전히 검토 중입니다. 다른 모든 것도 그렇습니다. 인내심에 감사드립니다.',
  '찾습니다: 잔디 플라밍고 한 마리, 분홍색, 불러도 안 옴. 마지막 목격지는 웨스트네 마당. 베벌리가 우려하고 있음. — 밀드레드',
  '알림: 밴드 연습(노 아울렛)은 화요일 오후 2:00–4:00, 브론토네 차고에서, “커뮤니티 품격에 부합하는” 음량으로 허용됩니다. 이 커뮤니티의 품격은 조용함입니다.',
  '이 달의 마당: 험프리스네. (41개월 연속. 후보는 모든 주민에게 열려 있습니다. 회장이 본인을 추천함. 동의: 회장.)',
  '공지: 명절 장식은 12월 1일~1월 2일 허용. 승인 색상: 화이트. 승인 조명: 화이트, 점멸 없음. 깜빡임 금지. 에어발룬 금지. 에어발룬 금지. 에어. 발룬. 금지. — B.H.',
  '매물: 스탠더드(서클 위의 오픈 하우스). 침실 4, 욕실 3, 다른 집들과 정확히 똑같음 — 그게 판매 포인트. 티파니에게 문의. 그 자리에 있을 거예요. 항상 있거든요.',
];

// ------------------------------------------------------------ voices ----
// Beverly Humphries, HOA President. Catty, serious, and not to be messed
// with — but never cruel: she wants nothing on this island ever blown
// away again, and she has decided the way to do that is rules.
const BEVERLY = [
  '어머. 새로 오셨네. 알아보겠어요. 그 랜턴 때문에. 그건… 승인된 거예요? 승인한 기억이 없는데. 일단은 봐줄게요. 지금은. 적어 두어야겠네.',
  '6.35센티미터. 잔디 길이 말이에요. 5도 아니고 7.5도 아니고. 6.35. 나는 자가 있고, 그 자를 두려워하지 않아요.',
  '규칙을 만드는 건 내가 아니에요. 집행할 뿐이죠. 만든 것도 나지만. 힘든 일이지만 누군가는 이래야 하니까요.',
  '이 달의 마당 41회. 연속으로. 경쟁 아니에요. 경쟁이었다면 내가 이기고 있겠지만. 이기고 있어요.',
  '브론토네 아이 밴드는 허가증이 있어요. 화요일, 두 시에서 네 시. 그런데 매일 들려요. 어디선가는 항상 화요일인 모양이에요. 전부 기록해 두었어요. 전부요.',
  '토드는 깎는 솜씨가 아름다워요. 내가 지켜보고 있어서 아름다운 거죠.',
  '페리라니. 신청서 열네 장, 거위가 낸 거예요. 뱃고동은 시끄럽고, 배도 시끄럽고, 바다는 솔직히 아주 시끄럽죠. 열네 장 걸렸어요. 내가 승인한 노선은 단 하나: 여기서 불코 왕복. 키친타월은 필요품이에요. 나머지는 사치고, 사치는 검토 중이에요.',
  '제9조. 종 금지. 왜인지는 나도 몰라요. 계약서에 있어요, 개발업자가 썼죠. 몰드카이 뭐시기. 계약서는 의심하는 게 아니에요. 집행하는 거예요.',
  '밀드레드는 플라밍고가 있어요. 분홍 플라스틱 플라밍고. 앞마당에. 경고장 세 통. 꼼짝도 안 해. 나를 쳐다봐. 나도 쳐다봐주지.',
  '잔디가 들어서기 전에는 바람이 이 섬의 모든 걸 날려 버렸어요. 잔디 의자. 빨래. 한번은 정자채로. 이제는 규칙이 있고, 30년간 날아간 게 없어요. 천만에요.',
];
const HAROLD = [
  '어머 — 안녕. 베벌리는 외출 중이야. 베벌리는 항상 외출 중이지. 내가 아는 사람 중 제일 외출하는 사람이야.',
  '잔디는 내가 깎아. 어디를 깎을지는 그분이 정해. 41개월째, 시스템이 잘 굴러가.',
  '겉보기보다 마음이 여려. 동네 사람 생일을 전부 적어 두셨어. “위반” 폴더에 넣어 두셔서 아무도 못 찾지만.',
  '이사회에 있던 적이 있어. 오후 한나절 동안. 인생에서 가장 긴 오후였지. 편지로 사임했어. 아주 신속히 승인해 주시더라고.',
  '규약 읽어봐도 돼. 바인더 네 권, 카운터에 있어. 3권에 우편함에 관한 아주 좋은 부분이 있어. 우편함과 나는 같이 겪은 게 많거든.',
];
const COVENANT = [
  'ARTICLE 2 (LAWNS): All lawns shall be maintained at two and one-half (2½) inches, green, and mown in stripes running north–south, “as God and the Board intended.”',
  '제4조(주택): 모든 주택은 스탠더드로 한다. 문은 토프, 오트, 그레이지 색으로 한다. 다른 색으로 문을 칠하고자 하는 주민은 서면으로 신청할 수 있으며, 연례 회의에서 천천히 낭독된다.',
  '제9조(소음): 종 금지. 초인종, 자전거 벨, 윈드차임, 소 종, 디너 벨, 음악 트럭 금지. 주민은 노크할 것. (여백에, 연필로, 아주 오래된 필적: “몰드카이에게 이유를 물어볼 것.” 그 아래, 펜으로, 더 최근: “물어보지 말 것.”)',
  '제11조(우편함): 검정. 기둥은 흰색. 깃발은 빨강. 깃발은 보낼 우편물이 있는 경우에만 올리고, 품위 있게 내린다.',
  '제14조(플라밍고): 부속서 F 참조. (부속서 F는 11페이지 분량이며 서명이 없다.)',
  '제17조(날씨): 주민은 모든 야외 가구, 정자, 빨래를 고정할 것. 모든 것을 쓸어 간 그 폭풍을 기리며, 이사회는 아직 용서하지 않았다.',
];
const SAL = [
  '세계의 앵무새. 세계의 앵무새. … 어머! 안녕. 텔레비전을 따라 하고 있었어.',
  '“The scarlet macaw is a social bird.” THE SCARLET MACAW IS A SOCIAL BIRD. They’re right, you know. I’m very social. I’m socializing right now.',
  '나 때는 케이블이 없었어. 창문 하나와 수많은 의견이 있었지. 의견은 아직도 있고.',
  '우리 손자가 밴드를 해. 밴드를! 차고에서! “노 아울렛”. 간판 이름이라고 했더니, 그게 포인트라네, 할아버지. 요즘 것들.',
];
const SUNNY = [
  '안녕, 허니! 뭐 마실래? 아이스티 있고, 아이스티 있고, 아주 맛있는 아이스티도 있어.',
  '키위는 브론토네 차고에서 밴드 중이야. 여기서도 들려. 어디서든 들려. 소리 지르고 싶을 만큼 자랑스러워. 키위는 진짜로 소리 질러. 그게 스타일이래.',
  '아빠는 TV를 따라 하고, 키위는 아빠를 따라 하고, 나는 모든 걸 베벌리에게 전해. 물어보시니까. 아주 반복적인 집이야. 우린 그게 좋아.',
];
const LINDA = [
  '게리가 그릴을 돌려. 게리는 항상 그릴을 돌려. 그 그릴에서 버거 나오는 걸 한 번도 못 봤어. 이제 묻지도 않아. 본인이 행복하다니까.',
  '화이팅, 팀! … 어느 팀이 우리 편인지는 몰라. 그냥 초록 부분이 좋아서.',
  '주니어가 동네를 떠난대. 도시락 싸 줬어. 아주 큰 도시락. 헤엄쳐야 하는 긴 길이거든.',
  '나갈 때 머리 조심해, 얘야. 어머 — 넌 괜찮네. 게리가 조심해야 하는데. 게리는 모든 것에 머리를 조심해야 해.',
];
const TWINS = [
  '쉿! 지금 재밌는 부분이야.',
  '전부 다 재밌는 부분이야.',
  '아빠가 또 잔디 깎아. 아빠는 항상 잔디 깎아. 우리 크면 바다를 깎을 거야.',
  '크런치부리 선장이 이번에는 사악한 잔디에서 탈출할 거야. 느낌이 와. 212화째인데, 느낌이 온다고.',
];
const DUNES2 = [
  [{ speaker: '채드', voice: 290, text: '학군 보고 이사 왔지!' }, { speaker: '매디슨', voice: 470, text: '학교 없어, 채드.' }, { speaker: '채드', voice: 290, text: '학교 생기면 대비해서.' }],
  [{ speaker: '채드', voice: 290, text: '여보, 그거 어디 있— ' }, { speaker: '매디슨', voice: 470, text: '12번 박스.' }, { speaker: '채드', voice: 290, text: '12번이 어떤 건데?' }, { speaker: '매디슨', voice: 470, text: '전부 12번이야.' }],
  [{ speaker: '매디슨', voice: 470, text: '핫요가 여섯 시, 콜드브루 일곱 시, 유모차 산책 여덟 시. 나에겐 시스템이 있어. 그 시스템이 미라지야.' }],
  [{ speaker: '채드', voice: 290, text: '나 이제 아빠야. 조끼도 샀어. 조끼는 아빠에 딸려 오더라고.' }],
  [{ speaker: '매디슨', voice: 470, text: '아기 이름은 사하라야. 그 가게처럼. 우리 첫 데이트한 곳이거든.' }, { speaker: '채드', voice: 290, text: '시향지를 내게 뿌렸었지.' }, { speaker: '매디슨', voice: 470, text: '일주일 내내 무드 냄새가 났어.' }],
];
const WALT = [
  '밀드레드는 몰에 있어. 밀드레드는 항상 몰에 있어. 달까지 걸었다가 돌아왔대. 바퀴 수로.',
  '골프야. 나는 안 쳐. 다들 그걸로 조용한 게 좋을 뿐이지. 온 관중이 공 하나 두고 속삭여. 딱 내 취향이야.',
  '플라밍고 이름은 돌로레스야. 베벌리는 치우라고 해. 돌로레스는 남아. 죽어도 지키는 언덕이 있는 법이지. 어떤 언덕에는 플라밍고가 있고.',
  '버터스카치 하나 집어가. 94년산이야. 괜찮아. 버터스카치는 영원하거든.',
];
const MILDRED = [
  '어머, 안녕! 바퀴 돌고 오는 길이야. 마흔 바퀴. 열한 바퀴가 1마일이야. 얼마나 걸리는지는 말 안 하기로 했어.',
  '월트가 버터스카치 권했어? 두 개 가져가. 접시째 가져가. 월트, 접시 드려.',
  '돌로레스는 내 플라밍고야. 베벌리가 경고장을 세 통이나 보냈어. 고운 폴더에 보관 중이야. 언젠가 답장 보낼 거야. 분홍 종이로.',
];
const GARY = [
  '버거 거의 다 됐어! 정오부터 거의 다 됐어. 그게 그릴이야, 친구. 마음가짐이라고.',
  '키 크면 좋은 점이 있어. 서클의 모든 울타리 너머가 보이지. 주로 보이는 건 베벌리가 오는 모습이야. 조심해 — 오신다.',
  '차고에 있는 건 우리 아들 주니어야. 베이스 기타. 이 동네를 떠난대. 그래서 “아들, 여긴 섬이야” 했지. 그러니까 “바로 그거야, 아빠.” 무슨 뜻인지 모르지만 자랑스러워.',
  '린다는 온 동네 배수구 청소 그만하래. 하지만 누가 해? 토드? 토드는 키가 120밖에 안 돼.',
  '버거 줄까? … 아직 안 됐어. 하지만 원하는 건 얼마든지.',
  '비건 패티는 너겟 만드는 데랑 같은 회사야. 어느 쪽에 뭐가 들었는지 아무도 몰라. 나는 미스터리를 존중해.',
];
const TODD = [
  '6.35센티미터! 매주 토요일. 그리고 수요일. 그리고 오늘. 아무리 확인해도 지나치지 않아.',
  '줄무늬가 전부야. 풀은 누구나 깎아. 줄무늬는 누군가 정성을 들였다는 증거지.',
  '공동 잔디, 서클, 풀장 잔디, 우리 집 거를 깎아. 그다음 해롤드네도 깎아. 해롤드는 베벌리네를 깎으니까, 누군가는 해롤드네를 깎아야 하거든. 그게 커뮤니티야.',
  '애들? 집 안. 스크린. 나도 그 나이 때 똑같았어. 잔디 빼고.',
  '들려? 정비 잘된 모어 소리야. 들어봐. … 아름다워.',
];
const TIFFANY = [
  '어서 오세요, 어서 오세요! 오픈 하우스! 오늘만! (매일.) 침실 넷, 욕실 셋, 다른 집들과 정확히 똑같아요 — 그게 판매 포인트예요.',
  '이 주방 좀 보세요. 이제 이 주방에 있는 당신의 가족을 상상해 보세요. 이제 그 가족이 다른 모든 주방의 다른 모든 가족과 정확히 똑같은 걸 상상해 보세요. 평화롭지 않나요?',
  '섬이 조성된 이래 계속 매물로 나와 있어요. 가격은 아주 공정해요. 가격은 언제나 아주 공정했어요. 가격을 물어본 사람은 아무도 없어요. 하지만 저는 준비됐어요. 완전히 준비됐다고요.',
  '일류 학군! … 글쎄요. 학교는 없어요. 하지만 있다고 상상해 보세요. 제가 파는 건 바로 그거예요, 달링. 상상력. 화강암 조리대 포함.',
];
const KIDS = [
  '밀어 줘! 더 높이! 아니, 더 높이! 아니 — 응, 그만큼이면 됐어. 너무 높아. 밀어 줘.',
  '우리는 풀장에 못 들어가. 아무도 못 들어가. 그네는 10시부터 5시까지 돼. 어딘가는 10시부터 5시겠지.',
  '우리 형은 밴드야. 이 동네를 떠날 거래. 나도 이 동네 떠날 거야. 간식 먹고 나서.',
];
const BAND = [
  [['키위', '우리는 노 아울렛. 이 동네를 떠날 거야.'], ['주니어', '이 동네를 떠날 거라고.'], ['다코타', '이. 동네. 를. 떠난다고.']],
  [['키위', '어디로? … 밖으로. 바다가 통째로 있잖아. 바다 봤어? 엄청 크고, HOA도 없어.']],
  [['다코타', '첫 싱글 제목은 “컬디색(막다른 골목)”. 빙빙 돌기만 하고 어디에도 안 닿는 곡이야.'], ['키위', '그게 포인트야.'], ['주니어', '그게 전부 포인트라고.']],
  [['주니어', '페리는 승인 대기 중. 그래서 헤엄쳐서 갈 거야.'], ['키위', '일단 연습 중이야.'], ['다코타', '풀장에서.'], ['키위', '풀장엔 아무도 못 들어가.'], ['주니어', '…그래서 잔디에서 연습 중이야.']],
  [['키위', '소음 허가증 있어. 화요일, 두 시에서 네 시. 뭔가를 믿기만 하면 매일이 화요일이야.']],
  [['다코타', '우리 엄마는 그냥 지나가는 시기래.'], ['키위', '모든 게 지나가는 시기야. 달도 시기라고.'], ['주니어', '우와.']],
  [['키위', '베벌리가 우리 공연에 왔었어. 차도 끝에 서서 공연 내내 팔짱 끼고 있었지.'], ['다코타', '발로 박자는 탔어.'], ['주니어', '박자 탔다니까, 진짜.']],
];
const PICO = [
  '띠이잉! … 미안. 습관이야. 2번 계산대에서 도움이 필요했대. 그게 나야. 내가 2번 계산대.',
  '종이로 할까요, 종이로 할까요? 종이밖에 없어요. 선택은 의식일 뿐이에요.',
  '띠이잉 띠이잉! 이건 두 번, “가격 확인” 용. 가격 확인했어. 괜찮아. 항상 괜찮아.',
  '스티커 줄까? 모두에게 스티커를 줘. 어른도. 특히 어른. 제일 필요하거든.',
];
const MANGO = [
  '아호이! 트레이더 폴리에 온 걸 환영해! 나는 선장이야. 여기선 진짜 직함이라고. 모두가 선원이야. 이제 너도 선원. 선원이 된 걸 환영해.',
  '우리는 종이 없어. 규약 때문에. 그래서 계산대에 도움이 필요하면 피코가 소리 내. 곧 듣게 될 거야. 한번 들으면 못 잊어.',
  '종 빼고 다 있는 양념! 날아가듯 팔려. 뭐가 빠졌냐고들 물어. “종이요.” “왜요?” “4번 통로요.” 4번 통로엔 아무것도 없어. 매번 먹혀.',
  '용감한 깃털! 우리 뉴스레터! 매호마다 왜 종이 없냐는 독자 편지가 실려. 아직 답을 안 실었어. 긴장감을 쌓는 중이야. 11년치 긴장감.',
  '그래, 나는 망고라는 앵무새고, 그래, 건망고를 팔아. 우리 모두 이와 화해했어. 주로 내가.',
];
const DEB = [
  '드로밀즈에 온 걸 환영해. 브랜드 네임, 혹 하나든 둘이든. 둘러봐. 뭘 “찾지”는 마 — 절대 못 찾을 테니까. 딴 걸 찾다 보면 그게 나와.',
  '비교가는 기분이야, 허니. 그 바이저는 900은 나왔을 수도 있어. 다른 인생에서. 우리가 그 인생에서 널 구한 거지.',
  '전부 진열대에 있고, 진열대는 아무 기준 없이 배치됐어. 그게 보물찾기야. 그게 드로밀.',
  '밀드레드, 필리스, 버니가 오픈 때 다녀갔어. 바이저 세 개 샀지. 같은 바이저. 똑같이. 그게 우정이야.',
];
const ECHO = [
  '안녕하세요! 미라지에 오신 걸 환영해요! 뭘 준비해 드릴까요? … 죄송해요. 모두에게 그렇게 말해요. 이따 또 그렇게 말할 거예요.',
  '미라지인 이유는, 음료가 당신이 상상한 그대로라서예요. 아니면 당신이 상상한 거라서. 어느 쪽이든, 좋아하실 거예요.',
  '사이즈는 스몰, 미디엄, 듄이에요.',
  '저는 모든 주문을 다시 따라 해요. 모든 단어를. 모든 “음”까지. 앵무새라 그래요. 바리스타라서이기도 하고요. 두 가지예요, 제가 그 교집합이에요.',
];
const TANNER = [
  '클럭 앤 코에 오신 걸 환영합니다! 오늘 어떻게 모실까요? … 기쁘게 모시겠습니다.',
  '닭고기가 아니에요. 한 번도 닭고기인 적 없어요. “치킨”이에요. 아포스트로피가 뭘 하는지 아무도 몰라요. 최선을 다하는 중이에요.',
  '일요일은 쉬어요. 저희도 쉬어요. 손님도 쉬세요. 노 저어 오신 것처럼 보여요.',
  '기쁩니다! … 죄송해요, 아직 아무 말씀도 안 하셨죠. 제가 앞서 나갔네요. 앞서 나가는 것도 기쁩니다.',
  '지붕 위의 소가 간판을 들고 있어요. 철자를 알아요. 스스로 선택하는 거예요.',
];
const PALOMA = [
  '사하라에 온 걸 환영해, 베이브. 쇼핑하러 왔어, 아니면 보여주러 왔어? 둘 다 유효해. 둘 다 이 가게야.',
  '여기 있는 건 전부 무드야. 저건 “해 질 녘 오아시스”. 저건 “갓 깎은 잔디”. 저건 그냥 “베벌리”라고 불러. 아주 강렬해. 사는 사람은 없어. 다들 뿌려만 봐.',
  '나는 모래로 컨투어링해. 진짜 모래. 해변에서 온. 공짜고, 로컬이고, 어디에나 있어, 베이브. 어.디.에.나.',
];
const RICO = [
  '실례합니다! 실례합니다 — 질문 하나 해도 될까요? … 손 있으세요? 대박. 저도 있어요. 손에 좋은 걸 보여드릴게요.',
  '죽은 모래 로션입니다. 죽은 모래에서 왔어요. 모래예요. 죽은 거죠. 아주 촉촉해요. 이유는 아무도 몰라요. 그게 과학이에요.',
  '알겠어요, 알겠어요, 로션은 싫으시죠. 아무도 로션을 원하지 않아요. 그런데 만약 로션이… 당신을 원한다면요? 생각해 보세요. 천천히요. 전 여기 있을게요. 항상 여기 있으니까.',
  '몰 워커들이 하루에 마흔 번씩 지나가요. 마흔 번의 “질문 하나 해도 될까요”. 마흔 번의 “됐어요, 얘야”. 내 인생에서 제일 안정적인 관계예요.',
];
const AUNTIE = [
  '프레첼 드릴까, 얘야? 부드럽고, 따뜻하고, 모래 같은 소금. 손으로 꼰 거야. 내 손으로. 이 손.',
  '걷는 분들에겐 부러진 걸 공짜로 줘. 어떤 날은 다른 날보다 더 많이 부러져. 그 얘긴 하지 않기로 했어.',
  '잔디가 들어설 때부터 프레첼을 꼈어. 그 전엔 다른 걸 꼈지. 주로 밧줄. 정자들 때문에. 정자를 많이 잃었거든.',
];
const DALE = [
  '몰 경비. 순찰 중. 세그웨이로. 이 몰에서 걷기 외에 한 사람은 없지만, 나는 준비됐어. 완전히 준비됐다고.',
  '뛰지 마시오. 규칙은 그거 하나. 워커들이 교묘히 피해 가. 파워 워킹이라고. 차이가 있어. 조사해 봤거든.',
  '세그웨이는 HOA가 준 선물이야. 베벌리가 말했지, “데일, 당신은 절대 빨라질 수 없어요. 하지만 꾸준해질 수는 있죠.” 누가 내게 해준 말 중 최고야.',
];
const WALKERS = [
  [['필리스', '속도 좀 올려, 버니.'], ['버니', '올리고 있거든. 이게 내 올린 속도야.'], ['밀드레드', '얘들아.']],
  [['필리스', '페리 얘기 들었어?'], ['버니', '승인 대기 중.'], ['밀드레드', '뭐든 다 승인 대기 중이야.'], ['필리스', '내 고관절도 승인 대기 중이야.']],
  [['버니', '이 바이저 드로밀즈에서 샀어. 비교가 900. 나는 30에 샀지. 이렇게 살아있는 기분은 처음이야.'], ['필리스', '우리 다 그 바이저 샀잖아, 버니.'], ['버니', '그리고 우리 다 살아있는 기분이었잖아.']],
  [['밀드레드', '핫 트로픽 앞을 사천 번은 지나쳤어. 한 번도 안 들어가 봤지.'], ['필리스', '우린 아직 준비가 안 됐어.'], ['버니', '영원히 준비 안 될 거야.']],
  [['밀드레드', '열한 바퀴가 1마일이야, 얘야. 우리는 마흔 바퀴를 해. 같이 걸을래! 따라와! 아님 말고 — 우리 또 돌아오니까.']],
  [['필리스', '리코가 또 손 있냐고 물어보더라.'], ['버니', '뭐라고 했는데?'], ['필리스', '“너한텐 없어, 리코”라고 했지.'], ['밀드레드', '매일이야, 얘들아. 하루도 빠짐없이.']],
];
const BAND_VOICE = { Kiwi: 620, Junior: 200, Dakota: 380 };

export function createOasis(player) {
  const group = new THREE.Group();
  let h0Swings = null, h0Seesaw = null; // (the playground moves when kids are on it)
  const outdoor = [];          // island-zone updates
  const inside = {};           // zone name -> [update fns]
  const W = (u, v) => ({ x: O.x + u, z: O.z + v });
  // put a thing on the lawn at (u, v), turned ry
  function put(obj, u, v, y = 0, ry = 0) {
    obj.position.set(O.x + u, GY + y, O.z + v);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  }
  // a little brimmed cap for folk in uniform
  function capOn(animal, color) {
    const head = animal.userData.parts.head;
    const c = new THREE.Group();
    const top = cyl(0.36, 0.32, 0.18, 9, color);
    top.position.y = 0.06;
    const brim = box(0.42, 0.04, 0.26, 0x1d2738);
    brim.position.set(0, -0.02, 0.36);
    c.add(top, brim);
    c.position.y = 0.33;
    head.add(c);
    return c;
  }
  function solidBox(u, v, w, d, ry = 0, kind) {
    zones.addBlockerBox(O.x + u, O.z + v, w, d, ry, 0, kind);
  }
  function solidDisc(u, v, r, kind) {
    zones.addBlocker(O.x + u, O.z + v, r, kind);
  }
  // local (lx, lz) in a frame at (u, v) turned ry -> pad (u, v)
  function local(u, v, ry, lx, lz) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [u + lx * c + lz * s, v - lx * s + lz * c];
  }

  addIslandInfo({
    key: 'oasis',
    name: '오아시스 에스테이츠', x: ISLAND8.x, z: ISLAND8.z, r: 40, icon: '🏡',
    blurb: '계획 커뮤니티. 서클을 둘러싼 일곱 채의 똑같은 집, 6.35센티미터 잔디, 커먼스(트레이더 폴리, 드로밀즈, 미라지 커피, 클럭 앤 코), 그리고 캐몰. 페리는 HOA 승인 대기 중이에요.',
    folk: 'Beverly Humphries (HOA President) · the Humphries, the Featherstones, the Brontos, Todd, the Dunes, Mildred & Walt · Captain Mango · Deb · Echo · Tanner · No Outlet (a band)',
    mystery: '“Past the Labs, south and west, there’s an island where every house is the same house. I sailed by twice to be sure. Same house. Same lawn. A camel with a clipboard watched me the whole way.” —Captain Brine',
  });

  // ================================================== paving (NOT roads) ----
  // flat slabs laid on the lawn: asphalt for the Parkway, the Circle and the
  // lot; pale concrete for sidewalks, driveways, walks
  const ASPHALT = 0x5d5e63, CONCRETE = 0xd8d3c6, CURB = 0xe8e4d8, PAINT = 0xf3efe2;
  function slab(u, v, w, d, color, y = 0.03, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat(color, 0.95));
    m.receiveShadow = true;
    return put(m, u, v, y, ry);
  }
  // the Parkway, east to west, with a rounded west end and a dashed middle
  {
    const len = BLVD.u1 - BLVD.u0, cu = (BLVD.u0 + BLVD.u1) / 2, cv = (BLVD.v0 + BLVD.v1) / 2;
    slab(cu, cv, len, BLVD.v1 - BLVD.v0, ASPHALT);
    const endcap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 12), mat(ASPHALT, 0.95));
    endcap.receiveShadow = true;
    put(endcap, BLVD.u0, cv, 0.03);
    for (let u = BLVD.u0 + 2; u < BLVD.u1 - 1; u += 2.4) slab(u, cv, 1.1, 0.12, 0xf2cf5b, 0.065);
    // sidewalk along the south side, and a curb along the north (the lot)
    slab(cu - 0.5, BLVD.v1 + 0.5, len - 1, 1.0, CONCRETE, 0.04);
  }
  // the lot, lined, with a cart corral
  {
    const cu = (LOT.u0 + LOT.u1) / 2, cv = (LOT.v0 + LOT.v1) / 2;
    slab(cu, cv, LOT.u1 - LOT.u0, LOT.v1 - LOT.v0, ASPHALT);
    slab(cu, LOT.v0 + 0.5, LOT.u1 - LOT.u0, 1.0, CONCRETE, 0.05); // the walk along the shopfronts
    for (let u = LOT.u0 + 1.5; u < LOT.u1 - 1; u += 2.6) {
      if (Math.abs(u - (-4)) < 1.5) continue; // the aisle down the middle
      slab(u, LOT.v0 + 2.9, 0.12, 2.6, PAINT, 0.065);
      slab(u, LOT.v1 - 1.5, 0.12, 2.6, PAINT, 0.065);
    }
  }
  // Circle Drive and the Circle: an asphalt ring around a round green
  {
    slab(SPUR.u, (BLVD.v1 + RING.v - RING.rOut + 0.4) / 2, SPUR.hw * 2, RING.v - RING.rOut + 0.4 - BLVD.v1, ASPHALT);
    const ringGeo = new THREE.RingGeometry(RING.rIn, RING.rOut, 40, 1);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, mat(ASPHALT, 0.95));
    ring.receiveShadow = true;
    put(ring, RING.u, RING.v, 0.06);
    const curbGeo = new THREE.TorusGeometry(RING.rIn, 0.12, 4, 40);
    curbGeo.rotateX(-Math.PI / 2);
    const curb = new THREE.Mesh(curbGeo, mat(CURB));
    curb.receiveShadow = true;
    put(curb, RING.u, RING.v, 0.05);
  }

  // ======================================================== the Standard ----
  // Every house at Oasis Estates is the Standard: a one-storey main house
  // with a gable roof and an attached garage. Same walls (Sand), same roof,
  // same shrubs, same mailbox. Doors come in the three approved colors.
  // Local frame: front faces +z. Main block x -3.7..0.9, garage 0.9..3.7.
  const WALL = 0xe8dcc4, ROOF = 0x8c7f72, TRIM = 0xfaf6ec;
  const HD = 4.2; // house depth
  function prismRoof(len, depth, h, color) {
    const r = (depth + 0.7) / 1.73;
    const geo = new THREE.CylinderGeometry(r, r, len, 3, 1, false, Math.PI / 2);
    geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat(color));
    m.scale.y = h / (r * 1.5);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function makeStandard({ door = 0xb9a58a, garageOpen = false } = {}) {
    const g = new THREE.Group();
    const found = box(garageOpen ? 4.8 : 7.6, 0.6, HD + 0.2, 0xc9bda6);
    found.position.set(garageOpen ? -1.4 : 0, -0.2, 0);
    g.add(found);
    const main = box(4.6, 2.8, HD, WALL);
    main.position.set(-1.4, 1.4, 0);
    g.add(main);
    const roof = prismRoof(5.1, HD, 1.5, ROOF);
    roof.position.set(-1.4, 2.8 + 0.42, 0);
    g.add(roof);
    // the garage: lower, a roof of its own, a big paneled door
    if (garageOpen) {
      // hollow: a back wall, an east wall, a floor — somebody's in there
      for (const [w, d, x, z] of [[2.8, 0.2, 2.3, -HD / 2 + 0.1], [0.2, HD - 0.2, 3.6, -0.1]]) {
        const wl = box(w, 2.2, d, WALL);
        wl.position.set(x, 1.1, z);
        g.add(wl);
      }
      const gfloor = box(2.6, 0.12, HD - 0.4, 0xa8a49a);
      gfloor.position.set(2.3, 0.06, -0.1);
      g.add(gfloor);
      const ceil = box(2.8, 0.1, HD - 0.2, 0xe8e0cc);
      ceil.position.set(2.3, 2.2, -0.1);
      g.add(ceil);
    } else {
      const gar = box(2.8, 2.2, HD - 0.2, WALL);
      gar.position.set(2.3, 1.1, -0.1);
      g.add(gar);
    }
    const groof = prismRoof(3.1, HD - 0.2, 1.0, ROOF);
    groof.position.set(2.3, 2.2 + 0.3, -0.1);
    g.add(groof);
    if (garageOpen) {
      const upDoor = box(2.2, 0.08, 1.6, TRIM); // rolled up under the ceiling
      upDoor.position.set(2.3, 1.95, HD / 2 - 0.9);
      g.add(upDoor);
    } else {
      const gd = box(2.2, 1.7, 0.08, TRIM);
      gd.position.set(2.3, 0.85, HD / 2 - 0.06);
      g.add(gd);
      for (let i = 1; i < 4; i++) {
        const groove = box(2.2, 0.04, 0.1, 0xd8d0c0);
        groove.position.set(2.3, i * 0.42, HD / 2 - 0.04);
        g.add(groove);
      }
    }
    // front door under a little pediment, two round windows, a porch step
    const doorMesh = box(0.95, 1.75, 0.12, door);
    doorMesh.position.set(-1.9, 0.875 + 0.1, HD / 2 + 0.02);
    g.add(doorMesh);
    const knob = ball(0.06, 0xf2cf5b);
    knob.position.set(-1.6, 0.95, HD / 2 + 0.12);
    g.add(knob);
    const ped = prismRoof(1.6, 0.4, 0.4, TRIM);
    ped.rotation.y = 0;
    ped.position.set(-1.9, 2.15, HD / 2 + 0.2);
    g.add(ped);
    const step = box(1.6, 0.2, 0.7, CONCRETE);
    step.position.set(-1.9, 0.1, HD / 2 + 0.35);
    g.add(step);
    for (const wx of [-3.1, -0.4]) {
      const w = makeWindow(0.38);
      w.position.set(wx, 1.6, HD / 2 + 0.02);
      g.add(w);
      // shutters: the approved accent, on every window, forever
      for (const sx of [-0.6, 0.6]) {
        const sh = box(0.18, 1.0, 0.06, 0x8c7f72);
        sh.position.set(wx + sx, 1.6, HD / 2 + 0.03);
        g.add(sh);
      }
    }
    const side = makeWindow(0.34);
    side.rotation.y = -Math.PI / 2;
    side.position.set(-3.72, 1.6, 0);
    g.add(side);
    // two shrubs, trimmed round, one each side of the door
    for (const sx of [-3.2, -0.6]) {
      const shrub = ball(0.42, 0x3f9a45, 1);
      shrub.scale.y = 0.85;
      shrub.position.set(sx, 0.36, HD / 2 + 0.55);
      g.add(shrub);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  // the mailbox: black, identical, at the curb (a flag, never a bell)
  function mailbox(u, v, ry) {
    const g = new THREE.Group();
    const post = box(0.1, 0.95, 0.1, 0xf3efe2);
    post.position.y = 0.475;
    const body = box(0.3, 0.26, 0.5, 0x2a2a2e);
    body.position.y = 1.05;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8, 1, false, 0, Math.PI), mat(0x2a2a2e));
    lid.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    lid.position.y = 1.18;
    const flag = box(0.03, 0.26, 0.1, 0xc0392b);
    flag.position.set(0.17, 1.14, -0.1);
    g.add(post, body, lid, flag);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, u, v, 0, ry);
    solidDisc(u, v, 0.22);
  }

  // =========================================================== greenery ----
  // palms along the Parkway, evenly spaced (the HOA measured), and a few
  // round trees in the yards
  function palm(u, v, h = 3.6, lean = 0.08) {
    const g = new THREE.Group();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const seg = cyl(0.17 - i * 0.015, 0.2 - i * 0.015, h / n + 0.05, 6, i % 2 ? 0xa0835f : 0x8f7352);
      seg.position.set(Math.sin(lean) * (i + 0.5) * (h / n), (i + 0.5) * (h / n), 0);
      seg.rotation.z = -lean;
      g.add(seg);
    }
    const top = new THREE.Vector3(Math.sin(lean) * h, h, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.9, 4), mat(i % 2 ? 0x3f9a45 : 0x4fae52));
      frond.scale.set(1, 1, 0.25);
      frond.position.set(top.x + Math.cos(a) * 0.8, top.y - 0.15, top.z + Math.sin(a) * 0.8);
      frond.rotation.order = 'YZX';
      frond.rotation.y = -a;
      frond.rotation.z = -Math.PI / 2 - 0.35;
      frond.castShadow = true;
      g.add(frond);
    }
    const nuts = ball(0.16, 0x6b5a3a);
    nuts.position.set(top.x, top.y - 0.25, top.z);
    g.add(nuts);
    put(g, u, v);
    solidDisc(u, v, 0.28, 'tree');
    return g;
  }
  function roundTree(u, v, s = 1) {
    const g = new THREE.Group();
    const trunk = cyl(0.14 * s, 0.18 * s, 1.4 * s, 6, 0x7a5a3a);
    trunk.position.y = 0.7 * s;
    const crown = ball(1.0 * s, 0x4c9c47, 1);
    crown.position.y = 1.9 * s;
    g.add(trunk, crown);
    put(g, u, v);
    solidDisc(u, v, 0.3 * s, 'tree');
  }
  for (let u = BLVD.u0 + 3; u <= BLVD.u1 - 2; u += 5) {
    if (Math.abs(u - SPUR.u) < 2.5) continue; // not in the mouth of Circle Drive
    palm(u, PALM_V + 0.3, 3.6, 0.06);
  }

  // ============================================================= cars ----
  // They are parked. Nobody has seen them driven. There are no roads (see
  // the signs). The HOA considers the matter closed.
  function car(u, v, ry, color, { van = false } = {}) {
    const g = new THREE.Group();
    const L = van ? 3.6 : 3.3;
    const body = box(1.8, 0.7, L, color);
    body.position.y = 0.6;
    const cab = box(1.6, van ? 0.8 : 0.6, van ? 2.6 : 1.7, color);
    cab.position.set(0, van ? 1.35 : 1.25, van ? -0.3 : -0.2);
    const glass = box(1.62, 0.4, van ? 0.2 : 1.0, 0xbfe6f2);
    glass.position.set(0, van ? 1.4 : 1.3, van ? 1.0 : 0.4);
    g.add(body, cab, glass);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), mat(0x2e2a26));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.92, 0.3, sz * (L / 2 - 0.65));
      g.add(wheel);
    }
    for (const sx of [-0.55, 0.55]) {
      const lamp = box(0.3, 0.14, 0.05, 0xfff3c0);
      lamp.position.set(sx, 0.72, L / 2 + 0.01);
      g.add(lamp);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, u, v, 0, ry);
    solidBox(u, v, 2.2, L + 0.1, ry); // (the wheels stick out a little)
    return g;
  }

  // ======================================================= the houses ----
  // Seven Standards around the Circle, each facing its middle. Who lives
  // where is below; everything else about them is identical, by covenant.
  const TAUPE = 0xa8957c, OAT = 0xc9b79a, GREIGE = 0xb3ab9e; // the approved door colors
  const HOUSES = [
    { id: 'humphries', name: '험프리스네', deg: -135, door: TAUPE },
    { id: 'featherstones', name: '페더스톤네', deg: -45, door: OAT },
    { id: 'brontos', name: '브론토네', deg: 0, door: GREIGE, garageOpen: true },
    { id: 'todd', name: '토드네', deg: 45, door: OAT },
    { id: 'openhouse', name: '오픈 하우스', deg: 90, door: GREIGE },
    { id: 'dunes', name: '듄네', deg: 135, door: TAUPE },
    { id: 'mildred', name: '밀드레드·월트네', deg: 180, door: OAT },
  ];
  const FENCE = 0xc9a77a;
  for (const h of HOUSES) {
    const th = (h.deg * Math.PI) / 180;
    h.u = RING.u + Math.cos(th) * HOUSE_R;
    h.v = RING.v + Math.sin(th) * HOUSE_R;
    h.ry = Math.atan2(-Math.cos(th), -Math.sin(th)); // front door faces the Circle
    const L = (lx, lz) => local(h.u, h.v, h.ry, lx, lz);
    h.L = L;
    h.mesh = put(makeStandard(h), h.u, h.v, 0, h.ry);
    if (h.garageOpen) {
      const [mu0, mv0] = L(-1.4, 0);
      solidBox(mu0, mv0, 4.8, HD + 0.2, h.ry);
      const [bu0, bv0] = L(2.3, -HD / 2 + 0.1);
      solidBox(bu0, bv0, 2.9, 0.3, h.ry);
      const [eu0, ev0] = L(3.6, -0.1);
      solidBox(eu0, ev0, 0.3, HD - 0.2, h.ry);
    } else {
      solidBox(h.u, h.v, 7.6, HD + 0.2, h.ry);
    }
    // the porch step, the walk to the curb, the driveway
    const [su, sv] = L(-1.9, HD / 2 + 0.35);
    zones.addSurfaceBox(O.x + su, O.z + sv, 1.6, 0.7, GY + 0.2, h.ry);
    const toCurb = HOUSE_R - RING.rOut; // from the house's middle to the Circle's edge
    const walkLen = toCurb - HD / 2 - 0.7;
    const [wu, wv] = L(-1.9, HD / 2 + 0.7 + walkLen / 2);
    slab(wu, wv, 0.9, walkLen, CONCRETE, 0.04, h.ry);
    const dLen = toCurb - HD / 2 + 0.2;
    const [du, dv] = L(2.3, HD / 2 + dLen / 2);
    slab(du, dv, 2.6, dLen, CONCRETE, 0.035, h.ry);
    const [mu, mv] = L(-3.4, toCurb - 0.3);
    mailbox(mu, mv, h.ry);
    for (const sx of [-3.2, -0.6]) { const [bu, bv] = L(sx, HD / 2 + 0.55); solidDisc(bu, bv, 0.45); } // the shrubs
    // the backyard: a wooden fence, three sides, a gate-gap by the garage
    const fz0 = -HD / 2, fz1 = -HD / 2 - 3.4;
    const fenceBits = [
      [0, fz1, 7.8, 0.12],                      // the back
      [-3.9, (fz0 + fz1) / 2, 0.12, fz0 - fz1], // the main-house side
      [3.9, fz1 + 1.1, 0.12, 2.2],              // the garage side (the gap is the gate)
    ];
    for (const [lx, lz, w, d] of fenceBits) {
      const f = box(w, 1.1, d, FENCE);
      const [fu, fv] = L(lx, lz);
      put(f, fu, fv, 0.55, h.ry);
      solidBox(fu, fv, Math.max(w, 0.2), Math.max(d, 0.2), h.ry);
      // posts, every so often
      const n = Math.max(1, Math.round(Math.max(w, d) / 1.3));
      for (let i = 0; i <= n; i++) {
        const k = i / n - 0.5;
        const [pu, pv] = L(lx + (w > d ? k * w : 0), lz + (w > d ? 0 : k * d));
        put(box(0.18, 1.25, 0.18, 0xb08d62), pu, pv, 0.62, h.ry);
      }
    }
    h.yard = (lx, lz) => L(lx, fz0 + (fz1 - fz0) * lz); // lz 0..1 from house to back fence
  }
  const HOUSE = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

  // the Circle's green: a playground, a bench, one young tree
  {
    const P = RING;
    // swing set: an A-frame, two swings
    const swing = new THREE.Group();
    for (const sx of [-1.3, 1.3]) {
      for (const sz of [-0.5, 0.5]) {
        const leg = cyl(0.06, 0.06, 2.3, 5, 0xd24b3c);
        leg.position.set(sx, 1.1, sz * 0.9);
        leg.rotation.x = -sz * 0.45;
        swing.add(leg);
      }
    }
    const bar = cyl(0.07, 0.07, 2.8, 6, 0xd24b3c);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.15;
    swing.add(bar);
    const seats = [];
    for (const sx of [-0.6, 0.6]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx, 2.15, 0);
      for (const cx of [-0.2, 0.2]) {
        const chain = box(0.03, 1.5, 0.03, 0x9aa0a6);
        chain.position.set(cx, -0.75, 0);
        pivot.add(chain);
      }
      const seat = box(0.5, 0.07, 0.25, 0x3a7dd8);
      seat.position.y = -1.5;
      pivot.add(seat);
      swing.add(pivot);
      seats.push(pivot);
    }
    swing.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    swing.userData.dynamic = true; // (the seats swing)
    put(swing, P.u - 1.8, P.v - 2, 0, 0.2);
    solidBox(P.u - 1.8, P.v - 2, 2.9, 1.2, 0.2);
    h0Swings = seats;
    // the slide: a ladder, a platform, a chute
    const slide = new THREE.Group();
    const plat = box(0.9, 0.12, 0.9, 0xf2cf5b);
    plat.position.set(0, 1.4, 0);
    slide.add(plat);
    for (const [lx, lz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
      const post = cyl(0.05, 0.05, 1.4, 5, 0x3a7dd8);
      post.position.set(lx, 0.7, lz);
      slide.add(post);
    }
    const chute = box(0.7, 0.08, 2.3, 0xf2cf5b);
    chute.position.set(0, 0.75, 1.4);
    chute.rotation.x = 0.62;
    slide.add(chute);
    for (let i = 0; i < 4; i++) {
      const rung = box(0.6, 0.06, 0.06, 0x3a7dd8);
      rung.position.set(0, 0.3 + i * 0.3, -0.5);
      slide.add(rung);
    }
    slide.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(slide, P.u + 2.2, P.v - 1.5, 0, -0.3);
    { const [cu, cv] = local(P.u + 2.2, P.v - 1.5, -0.3, 0, 1.0); solidBox(cu, cv, 1.1, 3.6, -0.3); }
    // the seesaw
    const see = new THREE.Group();
    const fulcrum = cyl(0.15, 0.25, 0.45, 5, 0x3a7dd8);
    fulcrum.position.y = 0.22;
    const plank = box(2.6, 0.08, 0.3, 0x5cbf4a);
    plank.position.y = 0.48;
    see.add(fulcrum, plank);
    see.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    see.userData.dynamic = true;
    put(see, P.u + 0.5, P.v + 2.6, 0, 0.1);
    solidBox(P.u + 0.5, P.v + 2.6, 2.6, 0.4, 0.1);
    h0Seesaw = plank;
    // a bench (for supervising) and a young maple, staked, identical to the
    // one on the brochure
    const bench = new THREE.Group();
    const bseat = box(1.5, 0.08, 0.45, 0x8a5a3a);
    bseat.position.y = 0.45;
    const bback = box(1.5, 0.4, 0.07, 0x8a5a3a);
    bback.position.set(0, 0.72, -0.2);
    bench.add(bseat, bback);
    for (const bx of [-0.65, 0.65]) {
      const bl = box(0.08, 0.45, 0.4, 0x2a2a2e);
      bl.position.set(bx, 0.22, 0);
      bench.add(bl);
    }
    bench.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(bench, P.u - 2.6, P.v + 2.4, 0, 0.9);
    solidBox(P.u - 2.6, P.v + 2.4, 1.5, 0.5, 0.9);
    roundTree(P.u + 3.3, P.v + 2.2, 0.7);
  }
  // ======================================================= walk-ins ----
  // Every door opens. doorway(id, u, v, ry, label): the spot on the lawn in
  // front of a door facing ry; room(...) builds what's behind it, off in the
  // elsewhere, dollhouse-style.
  const EXIT = {};
  function doorway(id, u, v, ry, label, r = 1.6) {
    const ox = Math.sin(ry), oz = Math.cos(ry);
    EXIT[id] = { x: O.x + u + ox * 1.1, z: O.z + v + oz * 1.1, rotY: ry };
    zones.setDoor(id, { x: EXIT[id].x, z: EXIT[id].z });
    register({
      pos: new THREE.Vector3(O.x + u + ox * 0.6, 0, O.z + v + oz * 0.6), r,
      label,
      enabled: () => !(id === 'cluck' && closedToday()),
      use: () => zones.go(id),
    });
  }
  const SUBURB_LIGHT = {
    bg: 0x3a332c, fog: 0x3a332c, fogNear: 24, fogFar: 64,
    hemiSky: 0xfff6ea, hemiGround: 0x8f806a, hemiIntensity: 1.85, sunIntensity: 0,
  };
  function room(id, name, B, { w, d, wallH = 3.6, floor = 0xc9a77a, wall = 0xf1e8d8, lighting = SUBURB_LIGHT, build }) {
    const start = group.children.length;
    const fl = box(w, 0.4, d, floor);
    fl.position.set(B.x, -0.2, B.z);
    group.add(fl);
    for (const [ww, dd, x, z] of [[w, 0.3, B.x, B.z - d / 2], [0.3, d, B.x - w / 2, B.z], [0.3, d, B.x + w / 2, B.z]]) {
      const wl = box(ww, wallH, dd, wall);
      wl.position.set(x, wallH / 2, z);
      group.add(wl);
    }
    // a baseboard, because we are not animals (we are; but not like that)
    for (const [ww, dd, x, z] of [[w, 0.08, B.x, B.z - d / 2 + 0.17], [0.08, d, B.x - w / 2 + 0.17, B.z], [0.08, d, B.x + w / 2 - 0.17, B.z]]) {
      const bb = box(ww, 0.22, dd, 0xfaf6ec);
      bb.position.set(x, 0.11, z);
      group.add(bb);
    }
    const blockers = [];
    const things = [];
    build?.(B, blockers, things);
    const root = collectInteriorRoot(group, start);
    root.userData.noMerge = true;
    zones.registerInterior(id, {
      root, floorY: 0,
      bounds: { x0: B.x - w / 2 + 0.45, x1: B.x + w / 2 - 0.45, z0: B.z - d / 2 + 0.45, z1: B.z + d / 2 - 0.1 },
      blockers,
      spawn: { x: B.x, z: B.z + d / 2 - 0.7, rotY: Math.PI },
      lighting,
    });
    addZonePlace(id, name);
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + d / 2 - 0.25), r: 1.5, zone: id,
      label: '밖으로 나가기',
      use: () => zones.leaveTo(EXIT[id]),
    });
    for (const it of things) register({ ...it, zone: id });
    return root;
  }
  // Cluck & Co. is closed Sundays. They're resting. You should too.
  function closedToday() {
    return new Date().getDay() === 0;
  }

  // ====================================================== the Commons ----
  // A lot, and on it: the CaMall (west), and the Oasis Commons strip —
  // Trader Polly's and Dromedeals under one long roof. Flat roofs, so the
  // roofs get the decorating: HVAC boxes, skylights, and the signs.
  function flatRoofBits(u, v, w, d, h, ry = 0) {
    const cap = box(w + 0.3, 0.25, d + 0.3, 0xd8d0c0);
    put(cap, u, v, h + 0.12, ry);
    for (let i = 0; i < Math.max(1, Math.floor(w / 6)); i++) {
      const [hu, hv] = local(u, v, ry, -w / 2 + 2 + i * 5.5, -d / 4);
      const hvac = box(1.1, 0.7, 0.9, 0xb8bcc0);
      put(hvac, hu, hv, h + 0.6, ry);
      const fan = cyl(0.32, 0.32, 0.08, 8, 0x8a8e92);
      put(fan, hu, hv, h + 0.99, ry);
    }
  }
  function glassDoors(w = 1.8, h = 2.0) {
    const g = new THREE.Group();
    const frame = box(w + 0.2, h + 0.15, 0.1, 0x3a3a3e);
    frame.position.y = (h + 0.15) / 2;
    const glass = box(w, h, 0.14, 0xbfe6f2);
    glass.position.y = h / 2;
    glowWindow(glass);
    const split = box(0.06, h, 0.16, 0x3a3a3e);
    split.position.y = h / 2;
    g.add(frame, glass, split);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return g;
  }
  function awning(w, color, stripe = 0xfffaf0) {
    const g = new THREE.Group();
    const n = Math.max(3, Math.round(w / 0.5));
    for (let i = 0; i < n; i++) {
      const s = box(w / n, 0.06, 1.1, i % 2 ? stripe : color);
      s.position.x = -w / 2 + (i + 0.5) * (w / n);
      g.add(s);
    }
    g.rotation.x = 0.38;
    return g;
  }

  // --- the CaMall ---
  const MALL = { u: -9, v: -23, w: 15, d: 8, h: 4.4 };
  {
    const { u, v, w, d, h } = MALL;
    put(box(w, h, d, 0xf0d6c8), u, v, h / 2);
    put(box(w + 0.1, 0.5, d + 0.1, 0x3fb8a8), u, v, h - 0.6); // the teal band, very 1989
    flatRoofBits(u, v, w, d, h);
    // the entrance: a tall bay pushed out front, glass doors, a skylight pyramid
    put(box(4.6, h + 1.4, 1.4, 0xf6e3d8), u, v + d / 2 + 0.5, (h + 1.4) / 2);
    const door = glassDoors(2.4, 2.3);
    put(door, u, v + d / 2 + 1.21);
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 4), mat(0xbfe6f2, 0.3));
    pyr.rotation.y = Math.PI / 4;
    glowWindow(pyr, { max: 0.35 });
    put(pyr, u, v - 0.5, h + 0.95);
    const logo = sign(['캐몰', '잔디 들어설 때 개업'], { w: 4.2, h: 1.3, bg: '#3fb8a8', fg: '#ffffff', border: '#f28fb0' });
    put(logo, u, v + d / 2 + 1.25, h + 0.55);
    // round windows along the front, like every shop in the archipelago
    for (const wu of [-5.5, -3.2, 3.2, 5.5]) {
      const win = makeWindow(0.45);
      put(win, u + wu, v + d / 2 + 0.01, 2.0);
    }
    // the directory, out front (they put one outside too; it's a mall)
    const dir = sign(['캐몰 안내', '사하라 · 핫 트로픽 · 듄 이모네', '푸드코트 · 분수 · 현재 위치'], { w: 1.6, h: 1.1, bg: '#fffaf0', fg: '#3f6f6a', border: '#3fb8a8' });
    put(dir, u + 3.4, v + d / 2 + 2.1, 1.0, 0);
    put(box(0.12, 0.5, 0.12, 0x3a3a3e), u + 3.4, v + d / 2 + 2.1, 0.25);
    solidBox(u, v, w, d);
    solidBox(u, v + d / 2 + 0.6, 4.6, 1.6);
    solidDisc(u + 3.4, v + d / 2 + 2.1, 0.3);
    doorway('mall', u, v + d / 2 + 1.2, 0, '캐몰에 들어가기', 1.8);
  }

  // --- Oasis Commons: Trader Polly's | Dromedeals ---
  const STRIP = { u: 9.5, v: -22.5, w: 18, d: 7, h: 3.6 };
  {
    const { u, v, w, d, h } = STRIP;
    put(box(w, h, d, 0xe9dcc2), u, v, h / 2);
    flatRoofBits(u, v, w, d, h);
    put(box(0.3, h + 0.5, d + 0.2, 0xd8c8a8), u, v, (h + 0.5) / 2); // the party wall, poking up
    const front = v + d / 2;
    // Trader Polly's: west half. a red sign on cream, a surfboard, a lei of
    // paper flowers over the door
    const pu = u - w / 4;
    put(sign('트레이더 폴리', { w: 5.4, h: 0.85, bg: '#fff4dc', fg: '#c0392b', border: '#c0392b' }), pu, front + 0.08, h - 0.33);
    put(awning(5.2, 0xc0392b), pu, front + 0.45, 2.55);
    put(glassDoors(1.8, 2.0), pu, front + 0.02);
    const board = box(0.5, 2.6, 0.12, 0x3fb8a8);
    board.rotation.z = 0.12;
    put(board, pu + 2.3, front + 0.12, 1.3);
    put(box(0.1, 1.6, 0.14, 0xf2cf5b), pu + 2.28, front + 0.19, 1.3, 0);
    for (const wu of [-1.8, 1.4]) put(makeWindow(0.42), pu + wu - (wu > 0 ? 0 : 0), front + 0.01, 1.5);
    // Dromedeals: east half. white sign, red letters, "compare at"
    const du = u + w / 4;
    put(sign(['드로밀즈', '브랜드 네임 · 혹 하나든 둘이든'], { w: 5.4, h: 0.9, bg: '#ffffff', fg: '#a8232d', border: '#a8232d' }), du, front + 0.08, h - 0.35);
    put(awning(5.2, 0x7a1f2b, 0xf0e6e0), du, front + 0.45, 2.55);
    put(glassDoors(1.8, 2.0), du, front + 0.02);
    for (const wu of [-1.8, 1.8]) put(makeWindow(0.42), du + wu, front + 0.01, 1.5);
    solidBox(u, v, w, d);
    doorway('polly', pu, front, 0, '트레이더 폴리에 들어가기');
    doorway('drom', du, front, 0, '드로밀즈에 들어가기');
    // the cart corral, and a cart that did not make it to the corral
    const corral = new THREE.Group();
    for (const sx of [-1.4, 1.4]) {
      const rail = box(0.06, 0.9, 0.06, 0x9aa0a6);
      rail.position.set(sx, 0.45, 0);
      corral.add(rail);
    }
    const topRail = box(2.9, 0.06, 0.06, 0x9aa0a6);
    topRail.position.y = 0.9;
    corral.add(topRail);
    put(corral, 4, LOT.v1 - 3, 0, Math.PI / 2);
    solidBox(4, LOT.v1 - 3, 0.3, 2.9);
  }
  function cart() {
    const g = new THREE.Group();
    const basket = box(0.7, 0.45, 0.95, 0xc8ccd0);
    basket.position.y = 0.72;
    const handle = box(0.7, 0.05, 0.05, 0xc0392b);
    handle.position.set(0, 1.02, -0.52);
    g.add(basket, handle);
    for (const [sx, sz] of [[-0.3, 0.4], [0.3, 0.4], [-0.3, -0.4], [0.3, -0.4]]) {
      const w = ball(0.07, 0x2e2a26);
      w.position.set(sx, 0.07, sz);
      g.add(w);
      const leg = box(0.03, 0.45, 0.03, 0x9aa0a6);
      leg.position.set(sx, 0.3, sz);
      g.add(leg);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return g;
  }
  put(cart(), 12.5, LOT.v1 - 4.2, 0, 0.7);
  solidDisc(12.5, LOT.v1 - 4.2, 0.55);
  // the lot's cars (warm, recently driven, by nobody)
  car(-14.4, LOT.v0 + 2.9, 0, 0xe8e4dc);
  car(-11.6, LOT.v0 + 2.9, 0.05, 0x9aa0a6); // (not in front of the mall doors: someone parked there once and a visitor got stuck)
  car(-1.3, LOT.v0 + 2.9, -0.04, 0x2e3e5c, { van: true });
  car(9.4, LOT.v0 + 2.9, 0, 0xd9c08f); // (clear of Trader Polly's door, likewise)
  // the far row (nose to nose with the near row, never on top of it, and
  // never in the walk to a door)
  car(1.2, LOT.v1 - 1.8, Math.PI, 0x7a8a6a);
  car(12.0, LOT.v1 - 1.8, Math.PI + 0.05, 0xe8e4dc, { van: true });
  car(17.0, LOT.v1 - 1.8, Math.PI, 0xa8232d);

  // --- Mirage Coffee & Cluck & Co., side by side on the Parkway ---
  const MIRAGE = { u: 14.5, v: -4.6, w: 5.6, d: 4.4, h: 3.0 };
  const CLUCK = { u: 21.6, v: -4.6, w: 5.6, d: 4.4, h: 3.0 };
  {
    const { u, v, w, d, h } = MIRAGE;
    put(box(w, h, d, 0x2f5f50), u, v, h / 2);
    put(box(w + 0.2, 0.35, d + 0.2, 0xe8e0cc), u, v, h + 0.17);
    put(sign(['미라지', '커피, 아마도'], { w: 3.6, h: 1.0, bg: '#2f5f50', fg: '#f4efe2', border: '#e8e0cc' }), u, v, h + 0.9);
    put(box(0.1, 0.55, 0.1, 0x2a2a2e), u - 1.2, v, h + 0.5);
    put(box(0.1, 0.55, 0.1, 0x2a2a2e), u + 1.2, v, h + 0.5);
    put(awning(w - 0.4, 0x2f5f50, 0xe8e0cc), u, v + d / 2 + 0.45, 2.3);
    put(glassDoors(1.4, 1.9), u - 1.1, v + d / 2 + 0.02);
    put(makeWindow(0.45), u + 1.3, v + d / 2 + 0.01, 1.4);
    solidBox(u, v, w, d);
    doorway('mirage', u - 1.1, v + d / 2, 0, '미라지 커피에 들어가기');
  }
  {
    const { u, v, w, d, h } = CLUCK;
    put(box(w, h, d, 0xfaf4ec), u, v, h / 2);
    // a red roof: a proper little gable, the only one on the Commons
    const roof = prismRoof(w + 0.4, d, 1.2, 0xc8342c);
    put(roof, u, v, h + 0.35);
    put(sign(['클럭 앤 코', '기쁘게 모십니다'], { w: 3.4, h: 0.95, bg: '#c8342c', fg: '#ffffff', border: '#ffffff' }), u, v + d / 2 + 0.06, h - 0.55);
    put(glassDoors(1.4, 1.9), u - 1.2, v + d / 2 + 0.02);
    put(makeWindow(0.45), u + 1.4, v + d / 2 + 0.01, 1.2);
    // the drive-thru: a window on the east wall, a menu board, one car,
    // idling since before anyone can remember, by nobody
    put(box(0.1, 0.9, 1.1, 0xbfe6f2), u + w / 2 + 0.02, v - 0.3, 1.3);
    const menu = sign(['여기서 주문', '너겟 · 샌드위치 · 와플 프라이', '레모네이드 · 기쁘게 모십니다'], { w: 1.4, h: 1.2, bg: '#2a2a2e', fg: '#ffdd88' });
    put(menu, u + w / 2 + 1.6, v + 2.4, 1.2, -Math.PI / 2);
    put(box(0.12, 0.6, 0.12, 0x2a2a2e), u + w / 2 + 1.6, v + 2.4, 0.3);
    solidBox(u + w / 2 + 1.6, v + 2.4, 0.3, 1.5);
    // the cow, on the roof, with her sign. she is a painted cutout. she has
    // opinions about spelling that she keeps to herself.
    const cow = sign('너갯 더 먹그', { w: 2.2, h: 0.5, bg: '#fffaf0', fg: '#2a2a2e' });
    put(cow, u + 1.2, v - 0.9, h + 1.3, -0.15);
    const cowBody = buildAnimal('cow', { body: 0xf2ead8, head: 0xf2ead8 });
    cowBody.scale.setScalar(0.7);
    put(cowBody, u + 1.2, v - 0.5, h + 0.55, -0.15);
    solidBox(u, v, w, d);
    doorway('cluck', u - 1.2, v + d / 2, 0, '클럭 앤 코에 들어가기');
    register({
      pos: new THREE.Vector3(O.x + u - 1.2, 0, O.z + v + d / 2 + 0.7), r: 1.6, priority: 2,
      label: '문 열어보기',
      enabled: () => closedToday(),
      use: () => ui.say('유리에 붙은 작은 안내판: “일요일 휴무. 저희는 쉬는 중입니다. 당신도 쉬세요. — 클럭 앤 코” 안에는 의자들이 테이블 위에 아주 공손하게 올려져 있어요.'),
    });
  }
  // the patio out front of the two of them: tables, umbrellas
  {
    slab(18, -0.9, 15, 2.8, CONCRETE, 0.04);
    // (the tables keep clear of both doors — you step out onto open patio)
    for (const [tu, col] of [[11.4, 0x2f5f50], [16.2, 0x2f5f50], [23.0, 0xc8342c], [25.8, 0xc8342c]]) {
      const t = new THREE.Group();
      const top = cyl(0.5, 0.5, 0.06, 8, 0xfaf6ec);
      top.position.y = 0.72;
      const leg = cyl(0.05, 0.05, 0.72, 5, 0x3a3a3e);
      leg.position.y = 0.36;
      const pole = cyl(0.03, 0.03, 1.6, 5, 0x3a3a3e);
      pole.position.y = 1.5;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.45, 8), mat(col));
      shade.position.y = 2.3;
      shade.castShadow = true;
      t.add(top, leg, pole, shade);
      for (const a of [0, Math.PI]) {
        const chair = box(0.35, 0.45, 0.35, 0xfaf6ec);
        chair.position.set(Math.cos(a) * 0.75, 0.22, Math.sin(a) * 0.75);
        t.add(chair);
      }
      t.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      put(t, tu, -0.8);
      solidBox(tu, -0.8, 1.9, 0.9);
    }
  }

  // ================================================== the way in ----
  // the gatehouse (a parrot, a list nobody is on), the boom (up; always up;
  // it's the principle), the monument, and the pier where a ferry will call
  // the moment the HOA approves one
  {
    const G = { u: 24.6, v: -13.4 };
    put(box(2.0, 2.3, 1.8, 0xf0e6d4), G.u, G.v, 1.15);
    put(box(2.6, 0.2, 2.4, 0x8c7f72), G.u, G.v, 2.4);
    const gwin = box(1.4, 0.8, 0.1, 0xbfe6f2);
    glowWindow(gwin);
    put(gwin, G.u, G.v + 0.91, 1.5);
    put(sign('GATEHOUSE', { w: 1.6, h: 0.35, bg: '#fffaf0', fg: '#8c7f72' }), G.u, G.v + 0.95, 2.05);
    solidBox(G.u, G.v, 2.0, 1.8);
    // the boom: striped, raised, forever
    const post = box(0.35, 1.0, 0.35, 0xf0e6d4);
    put(post, 23.2, BLVD.v0 + 0.2, 0.5);
    solidDisc(23.2, BLVD.v0 + 0.2, 0.25);
    const arm = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const bit = box(0.5, 0.12, 0.12, i % 2 ? 0xffffff : 0xc0392b);
      bit.position.x = 0.25 + i * 0.5;
      arm.add(bit);
    }
    arm.rotation.z = 1.2; // up
    arm.rotation.y = Math.PI / 2;
    put(arm, 23.2, BLVD.v0 + 0.2, 1.0);
    // Reggie, out front of the booth on his stool: gatehouse security. small.
    // sassy. sees everything. the sunglasses are not optional.
    const stool = cyl(0.22, 0.18, 0.55, 7, 0x3a3a3e);
    put(stool, G.u - 0.4, G.v + 1.35, 0.27);
    const reggie = buildAnimal('parrot', { body: 0x9aa0a8, head: 0x9aa0a8, wing: 0x7a8088, tail: 0xc8342c });
    reggie.scale.setScalar(0.72);
    put(reggie, G.u - 0.4, G.v + 1.35, 0.5, 0);
    capOn(reggie, 0x2e3e5c);
    {
      const e = reggie.userData.parts.eyes[0];
      const shades = box(0.5, 0.1, 0.06, 0x111114);
      shades.position.set(0, e.position.y, e.position.z + 0.04);
      (e.parent || reggie).add(shades);
    }
    solidDisc(G.u - 0.4, G.v + 1.35, 0.45);
    attend(reggie, 'island', { r: 7 });
    register({
      getPos: () => reggie.position, r: 2.4,
      label: '레지에게 말 걸기',
      use: () => ui.say(nextLine('reggie', REGGIE), { speaker: '레지', voice: VOICE.reggie }),
    });
  }
  {
    // the monument: a low sand-colored wall, a painted plaque, flowers
    const M = { u: 27.0, v: -6.6, ry: 0.55 };
    put(box(3.6, 1.1, 0.7, 0xd8c8a8), M.u, M.v, 0.55, M.ry);
    put(box(3.8, 0.15, 0.8, 0xc9b79a), M.u, M.v, 1.15, M.ry);
    const [pu, pv] = local(M.u, M.v, M.ry, 0, 0.37);
    put(sign(['오아시스 에스테이츠', '계획 커뮤니티'], { w: 3.0, h: 0.8, d: 0.04, bg: '#2f5f50', fg: '#f4efe2' }), pu, pv, 0.6, M.ry);
    for (let i = 0; i < 7; i++) {
      const [fu, fv] = local(M.u, M.v, M.ry, -1.5 + i * 0.5, 0.8);
      put(ball(0.14, [0xff8fa8, 0xffd23e, 0xffffff][i % 3]), fu, fv, 0.14);
    }
    solidBox(M.u, M.v, 3.8, 0.95, M.ry);
    palm(M.u - 2.4, M.v - 1.4, 3.3, 0.1);
  }
  {
    // the pier: out from the end of the Parkway into the east water
    const P0 = PIER.u0, P1 = PIER.u1, PV = PIER.v, PW = PIER.w, top = PIER.top;
    const deck = box(P1 - P0, 0.18, PW, 0xa98b62);
    put(deck, (P0 + P1) / 2, PV, top - 0.09 - GY);
    for (let u = P0 + 1; u <= P1; u += 2.4) {
      for (const sv of [-1, 1]) {
        const pile = cyl(0.12, 0.14, 2.6, 6, 0x6e5a44);
        put(pile, u, PV + sv * (PW / 2 - 0.1), top - 1.3 - GY);
      }
    }
    const x0 = O.x + P0, x1 = O.x + P1, z0 = O.z + PV - PW / 2, z1 = O.z + PV + PW / 2;
    zones.addCrossing({
      contains: (x, z) => x >= x0 && x <= x1 && z >= z0 + 0.15 && z <= z1 - 0.15,
      height: (x, z) => Math.max(top, terrainHeight(x, z)),
    });
    zones.addSeaWall({ contains: (x, z) => x >= x0 - 0.3 && x <= x1 + 0.3 && z >= z0 - 0.3 && z <= z1 + 0.3 });
    solidBox((P0 + P1) / 2, PV, P1 - P0, PW + 0.3); // its edges and pilings; the walk down the middle is the crossing
    // the Persistent's buoy, at the end of the pier (its bell removed, per
    // Article 9; you knock on it — she comes anyway)
    {
      const b = new THREE.Group();
      const base = cyl(0.3, 0.4, 0.8, 7, 0xb0453a);
      base.position.y = 0.4;
      const topBall = ball(0.18, 0xf2cf5b);
      topBall.position.y = 0.95;
      b.add(base, topBall);
      b.position.set(OASIS_DOCK.buoyPos.x, top, OASIS_DOCK.buoyPos.z);
      group.add(b);
      zones.addBlocker(OASIS_DOCK.buoyPos.x, OASIS_DOCK.buoyPos.z, 0.4);
    }
    const board = sign(['페리 선착장', '승인 노선: 불코 한정', '대량 상품은 품격에 부합'], { w: 2.2, h: 1.2, bg: '#fffaf0', fg: '#2f5f50', border: '#2f5f50' });
    put(board, P1 - 0.6, PV - PW / 2 - 0.1, top + 1.4 - GY, 0);
    put(box(0.12, 1.4, 0.12, 0x6e5a44), P1 - 0.6, PV - PW / 2 - 0.1, top + 0.4 - GY);
    register({
      pos: new THREE.Vector3(O.x + P1 - 0.8, 0, O.z + PV), r: 1.8,
      label: '페리 표지판 읽기',
      use: () => ui.say([
        '페리 선착장. 승인 노선: 불코 한정. 대량 상품은 커뮤니티 품격에 부합합니다.',
        '그 아래, 더 작게, 라미네이트 카드로: “열네 번의 신청 끝에 이사회는 단 하나(1)의 페리 노선을 승인했습니다. 창고형 마트 왕복, 키친타월, 파르메산, 로티세리 품목용. 다른 모든 행선지는 계속 검토 중입니다. — B. 험프리스, 회장.”',
        '그 아래에, 유성펜으로, 기둥에 매달린 여행 태그: “불코 왕복. 그게 조건이야. 부표에 노크해. — B. 선장.”',
      ]),
    });
  }

  // =================================================== street things ----
  // lamps along the Parkway and round the Circle (they glow; they don't
  // light — the budget), a street sign, a notice board, NO OUTLET
  function lamp(u, v) {
    const g = new THREE.Group();
    const post = cyl(0.06, 0.08, 2.7, 6, 0x2a2a2e);
    post.position.y = 1.35;
    const cap = cyl(0.26, 0.18, 0.12, 6, 0x2a2a2e);
    cap.position.y = 3.05;
    const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xfff3d0, 0.4));
    globe.position.y = 2.82;
    glowWindow(globe, { max: 0.75 });
    g.add(post, cap, globe);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, u, v);
    solidDisc(u, v, 0.15);
  }
  for (let u = BLVD.u0 + 5.5; u <= BLVD.u1 - 4; u += 7.5) lamp(u, BLVD.v0 - 0.4);
  for (const a of [-60, 30, 120, 210]) {
    const th = (a * Math.PI) / 180;
    lamp(RING.u + Math.cos(th) * (RING.rOut + 0.5), RING.v + Math.sin(th) * (RING.rOut + 0.5));
  }
  {
    // the street sign at the mouth of Circle Drive
    const su = SPUR.u - SPUR.hw - 0.6, sv = BLVD.v1 + 1.3;
    put(cyl(0.05, 0.05, 2.6, 6, 0x6e7478), su, sv, 1.3);
    put(sign('오아시스 파크웨이', { w: 1.3, h: 0.28, bg: '#2f7a4f', fg: '#ffffff' }), su, sv, 2.45, 0);
    put(sign('CIRCLE DR', { w: 1.3, h: 0.28, bg: '#2f7a4f', fg: '#ffffff' }), su, sv, 2.15, Math.PI / 2);
    put(sign(['NO OUTLET'], { w: 0.9, h: 0.5, bg: '#f2cf5b', fg: '#2a2a2e' }), su, sv + 0.06, 1.6, 0);
    solidDisc(su, sv, 0.15);
    // and the one the HOA added
    const nu = SPUR.u + SPUR.hw + 0.8, nv = BLVD.v1 + 1.1;
    put(cyl(0.05, 0.05, 1.8, 6, 0x6e7478), nu, nv, 0.9);
    put(sign(['이곳은 도로가 아닙니다.', '파크웨이입니다.', '— HOA'], { w: 1.3, h: 0.9, bg: '#ffffff', fg: '#2a2a2e', border: '#2a2a2e' }), nu, nv + 0.06, 1.7, 0);
    solidDisc(nu, nv, 0.15);
    register({
      pos: new THREE.Vector3(O.x + nu, 0, O.z + nv + 0.8), r: 1.4,
      label: 'HOA 표지판 읽기',
      use: () => ui.say([
        '이곳은 도로가 아닙니다. 파크웨이입니다. — HOA',
        '섬 어디에도 도로는 없어요. 모두가 아는 사실이고, 불코에 표지판도 있죠. 오아시스 에스테이츠에 있는 건 7.4킬로미터의 파크웨이, 드라이브, 서클이에요. 아스팔트로 깔고, 한가운데 노란 점선을 그어 둔, 걷기용.',
        '회의가 있었습니다.',
      ]),
    });
  }
  {
    // the HOA notice board, by the mouth of Circle Drive: laminated, thumbtacked,
    // current as of this morning (it is always current as of this morning)
    const bu = SPUR.u - 6.2, bv = BLVD.v1 + 2.0;
    const nb = new THREE.Group();
    const cork = box(2.0, 1.3, 0.12, 0xb58d5a);
    cork.position.y = 1.35;
    const frame = box(2.2, 1.5, 0.08, 0x8c7f72);
    frame.position.set(0, 1.35, -0.05);
    nb.add(cork, frame);
    for (const lx of [-0.9, 0.9]) {
      const leg = box(0.1, 0.8, 0.1, 0x8c7f72);
      leg.position.set(lx, 0.4, -0.05);
      nb.add(leg);
    }
    const papers = [[0xffffff, -0.55, 1.55], [0xfff3b0, 0.1, 1.6], [0xffffff, 0.62, 1.45], [0xd8ecff, -0.3, 1.05], [0xffffff, 0.45, 1.0]];
    for (const [c, x, y] of papers) {
      const pp = box(0.5, 0.6, 0.02, c);
      pp.position.set(x, y, 0.07);
      pp.rotation.z = rand(-0.08, 0.08);
      nb.add(pp);
    }
    nb.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(nb, bu, bv, 0, 0);
    solidBox(bu, bv, 2.2, 0.3);
    register({
      pos: new THREE.Vector3(O.x + bu, 0, O.z + bv + 0.9), r: 1.6,
      label: 'HOA 공지 읽기',
      use: async () => {
        await ui.say(nextLine('notices', NOTICES), { speaker: 'HOA 게시판' });
      },
    });
  }

  // ============================================ the community pool ----
  // HOA members only. Everyone is an HOA member. It isn't optional.
  const POOL = { u: 20.5, v: 13, w: 6, d: 3.6 };
  {
    const { u, v, w, d } = POOL;
    const deckTop = 0.22;
    put(box(w + 2.4, deckTop, d + 2.4, 0xe8e0cc), u, v, deckTop / 2);
    zones.addSurfaceBox(O.x + u, O.z + v, w + 2.4, d + 2.4, GY + deckTop);
    const water = box(w, 0.1, d, 0x49c6e0);
    water.material = new THREE.MeshStandardMaterial({ color: 0x49c6e0, flatShading: true, roughness: 0.2, transparent: true, opacity: 0.9 });
    put(water, u, v, deckTop - 0.02);
    const lip = box(w + 0.3, 0.08, d + 0.3, 0xffffff);
    put(lip, u, v, deckTop - 0.03);
    solidBox(u, v, w, d);
    // loungers along the south side, a lifeguard chair with nobody in it
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Group();
      const base = box(0.7, 0.2, 1.7, 0xffffff);
      base.position.y = 0.3;
      const back = box(0.7, 0.08, 0.7, 0xffffff);
      back.position.set(0, 0.55, -0.7);
      back.rotation.x = -0.7;
      const towel = box(0.6, 0.04, 1.2, [0x3fb8a8, 0xf28fb0, 0xf2cf5b][i]);
      towel.position.y = 0.42;
      l.add(base, back, towel);
      l.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      put(l, u - 2.2 + i * 1.6, v + d / 2 + 1.35 - 0.3, deckTop, Math.PI);
      solidBox(u - 2.2 + i * 1.6, v + d / 2 + 1.05, 0.7, 1.7);
    }
    const chair = new THREE.Group();
    for (const sx of [-0.35, 0.35]) {
      const leg = box(0.08, 1.8, 0.08, 0xffffff);
      leg.position.set(sx, 0.9, 0);
      chair.add(leg);
    }
    const seat = box(0.8, 0.1, 0.6, 0xffffff);
    seat.position.y = 1.8;
    const cross = box(0.8, 0.5, 0.06, 0xc0392b);
    cross.position.set(0, 2.1, -0.28);
    chair.add(seat, cross);
    chair.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(chair, u + w / 2 + 0.7, v - d / 2 - 0.4, deckTop, -0.4);
    solidDisc(u + w / 2 + 0.7, v - d / 2 - 0.4, 0.45);
    const rules = sign(['풀장 규칙', '뛰기 금지 · 물장구 금지', '캐논볼 금지 · 종 금지', '오전 10시 전 재미 금지', '— HOA'], { w: 1.4, h: 1.5, bg: '#ffffff', fg: '#2f5f50', border: '#3fb8a8' });
    put(rules, u - w / 2 - 0.5, v - d / 2 - 1.1, 1.3, 0.4);
    put(box(0.1, 0.6, 0.1, 0x8c7f72), u - w / 2 - 0.5, v - d / 2 - 1.1, 0.3);
    solidBox(u - w / 2 - 0.5, v - d / 2 - 1.1, 1.5, 0.3, 0.4);
    register({
      pos: new THREE.Vector3(O.x + u, 0, O.z + v + d / 2 + 0.6), r: 2.4,
      label: '풀장 보기',
      use: () => ui.say([
        '물은 브로셔와 정확히 같은 파랑이에요. 아무도 들어가 있지 않아요. 언제나 아무도 없어요. 처음으로 물결을 만드는 사람이 되고 싶은 이가 없거든요.',
        '감시 의자는 비어 있어요. 작은 안내판: “안전요원 근무 중.”',
      ]),
    });
  }
  roundTree(24.5, 5.5, 0.9);
  roundTree(-22.5, -3.5, 0.8);
  roundTree(16.5, 22, 0.85);

  // ====================================================== folk kit ----
  // dress(): the Oasis look — visors, pearls, aprons, shirts, clipboards.
  // Accessories ride the head or the body so they breathe and walk along.
  function floralTexture(base, dots) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = dots[i % dots.length];
      const x = (i * 23) % 64, y = (i * 37) % 64;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function dress(a, o = {}) {
    const P = a.userData.parts;
    if (o.shirt !== undefined || o.floral) {
      const m = o.floral
        ? new THREE.MeshStandardMaterial({ map: floralTexture(o.floral[0], o.floral.slice(1)), flatShading: true, roughness: 0.85 })
        : mat(o.shirt);
      const sh = new THREE.Mesh(P.body.geometry, m);
      sh.scale.setScalar(1.05);
      sh.castShadow = true;
      P.body.add(sh);
    }
    if (o.apron !== undefined) {
      const ap = box(0.62, 0.62, 0.06, o.apron);
      ap.position.set(0, -0.08, 0.52);
      P.body.add(ap);
    }
    if (o.visor !== undefined) {
      const v = new THREE.Group();
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 5, 12), mat(o.visor));
      band.rotation.x = Math.PI / 2;
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 10, 1, false, -Math.PI / 2 - 0.9, 1.8), mat(o.visor));
      bill.position.set(0, -0.01, 0.07);
      bill.scale.set(1.15, 1, 1.35);
      v.add(band, bill);
      v.position.y = 0.2;
      P.head.add(v);
    }
    if (o.cap !== undefined) capOn(a, o.cap);
    if (o.pearls) {
      const pearls = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2;
        const b = ball(0.045, 0xfaf6ec);
        b.position.set(Math.cos(t) * 0.22, 0, Math.sin(t) * 0.22);
        pearls.add(b);
      }
      pearls.position.set(0, o.pearls[0], o.pearls[1]);
      pearls.rotation.x = o.pearls[2] ?? 0.4;
      a.add(pearls);
    }
    if (o.glasses) {
      const gl = new THREE.Group();
      for (const sx of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 4, 10), mat(0x2a2a2e));
        rim.position.set(sx * P.eyes[0].position.x * -1, 0, 0);
        gl.add(rim);
      }
      const e = P.eyes[0];
      gl.position.copy(e.position);
      gl.position.x = 0;
      gl.position.z += 0.04;
      (e.parent || a).add(gl);
    }
    if (o.clipboard) {
      const cb = new THREE.Group();
      const board = box(0.34, 0.44, 0.03, 0x8a5a3a);
      const paper = box(0.28, 0.34, 0.035, 0xffffff);
      paper.position.y = -0.03;
      const clip = box(0.12, 0.05, 0.05, 0x9aa0a6);
      clip.position.y = 0.2;
      cb.add(board, paper, clip);
      cb.position.set(0.28, 0.1, 0.5);
      cb.rotation.x = -0.5;
      P.body.add(cb);
    }
    if (o.bow !== undefined) {
      const bw = new THREE.Group();
      for (const sx of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), mat(o.bow));
        lobe.rotation.z = sx * Math.PI / 2;
        lobe.position.x = sx * 0.1;
        bw.add(lobe);
      }
      bw.position.set(0.2, 0.34, 0.1);
      P.head.add(bw);
    }
    return a;
  }
  // someone who lives here: built, dressed, placed (absolute x/z — rooms
  // are off in the elsewhere), and fidgeting like a proper shopkeeper
  function folk(kind, colors, x, y, z, ry, o = {}) {
    const a = buildAnimal(kind, colors);
    if (o.scale) a.scale.setScalar(o.scale);
    dress(a, o);
    a.position.set(x, y, z);
    a.rotation.y = ry;
    if (o.fidget) a.userData.fidget = true;
    group.add(a);
    return a;
  }

  // ===================================================== furniture ----
  function couch(x, z, ry, color) {
    const g = new THREE.Group();
    const seat = box(2.6, 0.45, 0.95, color);
    seat.position.y = 0.3;
    const back = box(2.6, 0.75, 0.28, color);
    back.position.set(0, 0.7, -0.36);
    g.add(seat, back);
    for (const sx of [-1.2, 1.2]) {
      const arm = box(0.28, 0.62, 0.95, color);
      arm.position.set(sx, 0.45, 0);
      g.add(arm);
    }
    for (const cx of [-0.62, 0.62]) {
      const cushion = box(1.08, 0.14, 0.7, color);
      cushion.position.set(cx, 0.58, 0.06);
      g.add(cushion);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }
  function table(x, z, w, d, color = 0x8a6a4a, h = 0.75) {
    const g = new THREE.Group();
    const top = box(w, 0.08, d, color);
    top.position.y = h;
    g.add(top);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(0.08, h, 0.08, color);
      leg.position.set(sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1));
      g.add(leg);
    }
    g.position.set(x, 0, z);
    group.add(g);
    return g;
  }
  function chair(x, z, ry, color = 0x8a6a4a) {
    const g = new THREE.Group();
    const seat = box(0.45, 0.07, 0.45, color);
    seat.position.y = 0.45;
    const back = box(0.45, 0.55, 0.06, color);
    back.position.set(0, 0.72, -0.2);
    g.add(seat, back);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(0.05, 0.45, 0.05, color);
      leg.position.set(sx * 0.19, 0.22, sz * 0.19);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }
  function rug(x, z, w, d, color) {
    const r = box(w, 0.03, d, color);
    r.position.set(x, 0.015, z);
    group.add(r);
    return r;
  }
  function plant(x, z, s = 1) {
    const pot = cyl(0.22 * s, 0.17 * s, 0.4 * s, 7, 0xf3efe2);
    pot.position.set(x, 0.2 * s, z);
    const leaves = ball(0.42 * s, 0x4c9c47, 1);
    leaves.scale.y = 1.25;
    leaves.position.set(x, 0.75 * s, z);
    group.add(pot, leaves);
  }
  function wallSign(text, x, y, z, ry, w = 2.0, opts = {}) {
    const sg = sign(text, { w, h: w * 0.3, d: 0.05, bg: '#faf6ec', fg: '#5b4a32', ...opts });
    sg.position.set(x, y, z);
    sg.rotation.y = ry;
    group.add(sg);
    return sg;
  }
  // TVs: a painted picture behind the glass, always on. Every channel at
  // Oasis Estates is a channel about Oasis Estates, more or less.
  function tvPicture(kind) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 144;
    const c = cv.getContext('2d');
    const sky = (top, bot) => { const g = c.createLinearGradient(0, 0, 0, 144); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, 256, 144); };
    const caption = (t) => { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 116, 256, 28); c.fillStyle = '#fff'; c.font = 'bold 15px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(t, 128, 135); };
    if (kind === 'lawn') {
      sky('#9fdcf7', '#dff3fb');
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#58c04a' : '#6cce5a'; c.fillRect(i * 32, 70, 32, 74); }
      c.fillStyle = '#e8dcc4'; c.fillRect(150, 40, 70, 34); c.fillStyle = '#8c7f72'; c.beginPath(); c.moveTo(144, 42); c.lineTo(185, 20); c.lineTo(226, 42); c.fill();
      caption('홈 & 잔디 · “가장자리 손질: 러브 스토리”');
    } else if (kind === 'birds') {
      sky('#7fc8a0', '#2f6f4a');
      for (let i = 0; i < 5; i++) { c.fillStyle = ['#d8342c', '#3a7dd8', '#f2cf5b', '#5cbf4a', '#e86a9a'][i]; c.beginPath(); c.arc(40 + i * 45, 60 + (i % 2) * 18, 13, 0, Math.PI * 2); c.fill(); }
      caption('세계의 앵무새 (재방송)');
    } else if (kind === 'game') {
      c.fillStyle = '#3f9a45'; c.fillRect(0, 0, 256, 144);
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.strokeRect(20, 18, 216, 92); c.beginPath(); c.moveTo(128, 18); c.lineTo(128, 110); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(150, 60, 6, 0, Math.PI * 2); c.fill();
      caption('빅 게임 · 0 – 0 · 3쿼터');
    } else if (kind === 'cartoon') {
      sky('#ffd23e', '#ff9b6a');
      c.fillStyle = '#6a4ad8'; c.beginPath(); c.arc(128, 70, 34, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(116, 62, 9, 0, Math.PI * 2); c.arc(140, 62, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#222'; c.beginPath(); c.arc(118, 63, 4, 0, Math.PI * 2); c.arc(142, 63, 4, 0, Math.PI * 2); c.fill();
      caption('크런치부리 선장 · 212화');
    } else if (kind === 'fire') {
      c.fillStyle = '#2a1a12'; c.fillRect(0, 0, 256, 144);
      for (let i = 0; i < 6; i++) { c.fillStyle = ['#ff9b3a', '#ffd23e', '#ff6a2a'][i % 3]; c.beginPath(); c.moveTo(70 + i * 20, 110); c.lineTo(80 + i * 20, 40 + (i % 3) * 12); c.lineTo(90 + i * 20, 110); c.fill(); }
      caption('벽난로 채널 · (연출)');
    } else if (kind === 'lullaby') {
      sky('#2e3e7c', '#8a7ac8');
      c.fillStyle = '#fff8d8'; c.beginPath(); c.arc(190, 40, 18, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 4; i++) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(50 + i * 40, 92, 12, 0, Math.PI * 2); c.arc(62 + i * 40, 88, 10, 0, Math.PI * 2); c.fill(); }
      caption('졸린 양 · 세는 중 (3시간)');
    } else if (kind === 'golf') {
      sky('#bfe6f7', '#e6f7fb');
      c.fillStyle = '#6cce5a'; c.beginPath(); c.ellipse(128, 110, 150, 50, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a3a3e'; c.fillRect(170, 50, 3, 45); c.fillStyle = '#e8342c'; c.fillRect(173, 50, 18, 11);
      caption('골프 · 모두 속삭이는 중');
    } else if (kind === 'mall') {
      sky('#f28fb0', '#3fb8a8');
      c.fillStyle = '#fff'; c.font = 'bold 30px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('세일', 128, 70);
      caption('The CaMall · you are here');
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex });
  }
  function tv(x, z, ry, kind, w = 2.0) {
    const g = new THREE.Group();
    const stand = box(w + 0.3, 0.55, 0.5, 0x3a332c);
    stand.position.y = 0.275;
    const bezel = box(w + 0.1, w * 0.6, 0.1, 0x1a1a1c);
    bezel.position.set(0, 0.6 + w * 0.3 + 0.1, -0.1);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, w * 0.56), tvPicture(kind));
    screen.position.set(0, 0.6 + w * 0.3 + 0.1, -0.04);
    g.add(stand, bezel, screen);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }

  // ========================================== inside the Standard ----
  // One floor plan. Seven families. The same couch (Oatmeal), the same rug
  // (Greige), the same sign in the same place. Every house differs only in
  // who's home and what's on.
  const HOUSE_DRESS = {};
  function standardInterior(h, idx) {
    const B = { x: -300, z: HOUSE_IN_Z0 + idx * 80 };
    const W0 = 12, D0 = 9;
    const d = HOUSE_DRESS[h.id] || {};
    room(`oasis_${h.id}`, `🏡 ${h.name}`, B, {
      w: W0, d: D0, wall: 0xe9e2d4,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        // living: TV on the back wall, the couch facing it, a coffee table
        rug(X(-3.2), Z(-1.4), 3.8, 2.8, 0xb8b0a4);
        tv(X(-3.2), Z(-4.05), 0, d.tv ?? 'lawn');
        couch(X(-3.2), Z(0.2), Math.PI, 0xd8ccb8);
        table(X(-3.2), Z(-1.7), 1.2, 0.7, 0x8a6a4a, 0.42);
        bl.push({ x: X(-3.2), z: Z(-4.05), w: 2.4, d: 0.6 }, { x: X(-3.2), z: Z(0.2), w: 2.7, d: 1.0 }, { x: X(-3.2), z: Z(-1.7), w: 1.3, d: 0.8 });
        wallSign('살고 웃고 쉬고', X(-5.82), 2.3, Z(-1.3), Math.PI / 2, 2.2, { fg: '#8c7f72' });
        const win = makeWindow(0.42);
        win.rotation.y = Math.PI / 2;
        win.position.set(X(-5.84), 1.7, Z(2.0));
        group.add(win);
        // the stairs, up the back wall, to a carpeted floor you'd hear about
        for (let i = 0; i < 7; i++) {
          const st = box(1.3, 0.34 * (i + 1), 0.4, 0xd8ccb8);
          st.position.set(X(-0.4 + i * 0.4), 0.17 * (i + 1), Z(-3.95));
          group.add(st);
        }
        const rail = box(2.9, 0.06, 0.06, 0xfaf6ec);
        rail.position.set(X(0.8), 1.9, Z(-3.3));
        rail.rotation.z = 0.68;
        group.add(rail);
        bl.push({ x: X(0.8), z: Z(-3.95), w: 2.9, d: 1.3 });
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(-2.8)), r: 1.3, label: '계단 위 올려다보기',
          use: () => ui.say(d.stairs ?? '계단은 침실로 올라가요. 위층 카펫은 크림색이에요. 소문으로 듣게 될 거예요.') });
        // kitchen: back counter, fridge, an island with stools, pendant lamps
        const counter = box(2.4, 0.95, 0.7, 0xfaf6ec);
        counter.position.set(X(3.4), 0.475, Z(-4.05));
        const ctop = box(2.5, 0.06, 0.75, 0x3a3a3e);
        ctop.position.set(X(3.4), 0.98, Z(-4.05));
        const fridge = box(1.0, 2.1, 0.8, 0xdfe2e4);
        fridge.position.set(X(5.2), 1.05, Z(-3.95));
        const island = box(2.2, 0.95, 1.0, 0xfaf6ec);
        island.position.set(X(3.6), 0.475, Z(-1.5));
        const itop = box(2.3, 0.06, 1.1, 0x3a3a3e);
        itop.position.set(X(3.6), 0.98, Z(-1.5));
        group.add(counter, ctop, fridge, island, itop);
        for (const sx of [-0.6, 0.6]) {
          const stool = cyl(0.2, 0.2, 0.7, 7, 0x8a6a4a);
          stool.position.set(X(3.6 + sx), 0.35, Z(-0.6));
          group.add(stool);
        }
        for (const lx of [3.0, 4.2]) {
          const hl = makeHangingLamp(0x2f5f50);
          hl.position.set(X(lx), 2.6, Z(-1.5));
          group.add(hl);
        }
        bl.push({ x: X(3.4), z: Z(-4.05), w: 2.4, d: 0.7 }, { x: X(5.2), z: Z(-3.95), w: 1.0, d: 0.8 }, { x: X(3.6), z: Z(-1.5), w: 2.2, d: 1.0 }, { x: X(3.6), z: Z(-0.6), w: 1.6, d: 0.45 }); // (and the stools)
        // the dining table, by the door, for company
        table(X(3.6), Z(1.9), 1.7, 1.0);
        for (const [cx, cz, cr] of [[2.9, 1.2, 0], [4.3, 1.2, 0], [2.9, 2.6, Math.PI], [4.3, 2.6, Math.PI]]) chair(X(cx), Z(cz), cr);
        bl.push({ x: X(3.6), z: Z(1.9), w: 1.8, d: 1.9 });
        plant(X(5.3), Z(3.6), 1.1);
        bl.push({ x: X(5.3), z: Z(3.6), r: 0.35 });
        d.build?.(B, X, Z, bl, things);
      },
    });
    doorway(`oasis_${h.id}`, ...h.L(-1.9, HD / 2 + 0.2), h.ry, d.enterLabel ?? `knock at ${h.name}`);
  }

  // ============================================= folk who notice you ----
  // attend(a, zone): turn to look at you when you come near, and back to
  // whatever they were doing when you go. wanderer(a, zone, area): walk
  // about a room (or a lawn) like a villager — pick a spot, go there, stand
  // a while, go somewhere else; stop and face you if you're talking; wait
  // if you're in the way. Both are solid to you (movers).
  function listFor(zone) {
    return zone === 'island' ? outdoor : (inside[zone] ??= []);
  }
  function attend(a, zone, { r = 4.5 } = {}) {
    const base = a.rotation.y;
    listFor(zone).push((dt, t, pp) => {
      if (!a.visible || a.userData.walking) return;
      const d = Math.hypot(pp.x - a.position.x, pp.z - a.position.z);
      const want = d < r ? Math.atan2(pp.x - a.position.x, pp.z - a.position.z) : (a.userData.restY ?? base);
      a.rotation.y = turnToward(a.rotation.y, want, dt, 3);
    });
  }
  function roomArea(X, Z) {
    return { x0: X(-5.4), x1: X(5.4), z0: Z(-3.3), z1: Z(3.9) };
  }
  function free(x, z) {
    const r = 0.32;
    return zones.canWalk(x, z) && zones.canWalk(x + r, z) && zones.canWalk(x - r, z) && zones.canWalk(x, z + r) && zones.canWalk(x, z - r);
  }
  function wanderer(a, zone, area, { speed = 0.9, pause = [2, 6] } = {}) {
    const w = { tx: null, tz: null, wait: 1 + Math.random() * 3 };
    zones.addMover({ zone, obj: a, r: 0.4 });
    listFor(zone).push((dt, t, pp) => {
      if (!a.visible) return;
      const near = Math.hypot(pp.x - a.position.x, pp.z - a.position.z);
      const face = () => { a.rotation.y = turnToward(a.rotation.y, Math.atan2(pp.x - a.position.x, pp.z - a.position.z), dt, 3); };
      if (ui.isBusy() && near < 3.5) { face(); animateGait(a, t, 0); a.userData.walking = false; return; }
      if (w.wait > 0) {
        w.wait -= dt;
        if (near < 3) face();
        animateGait(a, t, 0);
        a.userData.walking = false;
        return;
      }
      if (w.tx === null) {
        for (let k = 0; k < 10; k++) {
          const x = area.x0 + Math.random() * (area.x1 - area.x0), z = area.z0 + Math.random() * (area.z1 - area.z0);
          if (Math.hypot(x - a.position.x, z - a.position.z) > 1.5 && free(x, z)) { w.tx = x; w.tz = z; break; }
        }
        if (w.tx === null) { w.wait = 1; return; }
      }
      const dx = w.tx - a.position.x, dz = w.tz - a.position.z, d = Math.hypot(dx, dz);
      if (d < 0.15) { w.tx = null; w.wait = pause[0] + Math.random() * (pause[1] - pause[0]); return; }
      const step = Math.min(d, speed * dt);
      const nx = a.position.x + (dx / d) * step, nz = a.position.z + (dz / d) * step;
      if (!free(nx, nz) || Math.hypot(pp.x - nx, pp.z - nz) < 1.0) { w.tx = null; w.wait = 0.4 + Math.random(); return; }
      a.position.x = nx;
      a.position.z = nz;
      a.rotation.y = turnToward(a.rotation.y, Math.atan2(dx, dz), dt, 6);
      a.userData.walking = true;
      animateGait(a, t, 1, 8);
    });
  }

  // ================================================== the families ----
  const CAMEL = 0xd8b27a, CAMEL_DK = 0xc49a66, CAMEL_LT = 0xe6c896;
  const talkThing = (getPos, key, name, lines, label = `talk to ${name}`, r = 2.2, enabled = undefined) =>
    ({ getPos, r, label, enabled, use: talk(key, name, lines) });
  // the ones who sometimes step out (the strollers, below): their at-home
  // selves, so they can be not-at-home
  const INDOOR = {};
  const homeNow = (k) => !INDOOR[k] || INDOOR[k].visible;
  // Beverly spends her days out on the Circle; after hours she's home
  const bevHome = () => { const h = hourNow(); return h < 7 || h >= 22; };
  const mildredHome = () => { const h = hourNow(); return h < 7 || h >= 18; };

  HOUSE_DRESS.humphries = {
    tv: 'lawn', enterLabel: '험프리스네에 노크하기(초인종 없음)',
    stairs: '계단 꼭대기, 라미네이트 안내판이 붙은 닫힌 문: “회장실. 예약제.” 예약은 없습니다. 한 번도 있은 적이 없습니다.',
    build: (B, X, Z, bl, things) => {
      // forty-one Yards of the Month, in a grid, on the east wall; one gap
      for (let k = 0; k < 42; k++) {
        if (k === 41) continue; // this month's goes here. obviously.
        const plaque = box(0.05, 0.3, 0.24, k % 7 === 3 ? 0xd9b24a : 0xc9a24a);
        plaque.position.set(X(5.82), 1.2 + Math.floor(k / 7) * 0.36, Z(-0.2 + (k % 7) * 0.32));
        group.add(plaque);
      }
      things.push({ pos: new THREE.Vector3(X(5.2), 0, Z(0.8)), r: 1.4, label: '명패 세어보기',
        use: () => ui.say(['이 달의 마당. 이 달의 마당. 이 달의 마당… 마흔한 개, 호두 나무 위의 황동, 일곱 곱하기 여섯의 격자로.', '격자의 마지막 칸은 비어 있고, 못은 이미 박혀 있어요.']) });
      // the covenant, in four binders, on the counter
      for (let k = 0; k < 4; k++) {
        const binder = box(0.18, 0.5, 0.4, [0x2f5f50, 0x8c2f39, 0x2e3e5c, 0x6a5a3a][k]);
        binder.position.set(X(2.6 + k * 0.22), 1.26, Z(-4.1));
        group.add(binder);
      }
      things.push({ pos: new THREE.Vector3(X(3.0), 0, Z(-3.0)), r: 1.2, label: '규약 읽기',
        use: () => ui.say(nextLine('covenant', COVENANT), { speaker: '규약서' }) });
      const harold = folk('camel', { body: CAMEL_DK, humps: 2 }, X(1.3), 0, Z(0.6), 0.3, { shirt: 0x8a9a7a, glasses: true });
      const paper = box(0.6, 0.02, 0.4, 0xf3efe2);
      paper.position.set(X(3.6), 0.8, Z(1.7));
      group.add(paper);
      INDOOR.harold = harold;
      wanderer(harold, 'oasis_humphries', roomArea(X, Z));
      things.push(talkThing(() => harold.position, 'harold', '해롤드', HAROLD, undefined, 2.2, () => harold.visible));
      // Beverly, after hours, at the island, with a clipboard
      const bevIn = folk('camel', { body: CAMEL_LT, humps: 1 }, X(3.6), 0, Z(-0.2), 0.2, { visor: 0xffffff, pearls: [1.28, 0.62, 0.35], clipboard: true, fidget: true });
      (inside[`oasis_humphries`] ??= []).push(() => { bevIn.visible = bevHome(); });
      wanderer(bevIn, 'oasis_humphries', roomArea(X, Z), { speed: 0.7 });
      things.push({ getPos: () => bevIn.position, r: 2.2, label: '베벌리에게 말 걸기', enabled: () => bevHome(), use: () => beverlyTalk(true) });
    },
  };
  HOUSE_DRESS.featherstones = {
    tv: 'birds', enterLabel: '페더스톤네에 노크하기',
    build: (B, X, Z, bl, things) => {
      // Grandpa Sal in the armchair, repeating the television
      const arm = box(1.1, 0.5, 1.0, 0x6f8a6a);
      arm.position.set(X(-5.0), 0.25, Z(-1.6));
      const armBack = box(0.3, 0.9, 1.0, 0x6f8a6a);
      armBack.position.set(X(-5.4), 0.6, Z(-1.6));
      group.add(arm, armBack);
      bl.push({ x: X(-5.0), z: Z(-1.6), w: 1.2, d: 1.1 });
      const sal = folk('parrot', { body: 0x9aa0a8, head: 0x9aa0a8, wing: 0x7a8088, tail: 0xc8342c }, X(-4.9), 0.35, Z(-1.6), 2.6, { shirt: 0xb8a88a, glasses: true });
      attend(sal, 'oasis_featherstones');
      things.push(talkThing(() => sal.position, 'sal', '샬 할아버지', SAL));
      const sunny = folk('parrot', { body: 0x5cbf4a, head: 0x5cbf4a, wing: 0x2e8a5a, tail: 0x3a7dd8, face: 0xf2e08a }, X(3.6), 0, Z(-0.4), 0, { apron: 0xf28fb0, fidget: true });
      INDOOR.sunny = sunny;
      wanderer(sunny, 'oasis_featherstones', roomArea(X, Z), { speed: 1.1 });
      things.push(talkThing(() => sunny.position, 'sunny', '서니', SUNNY, undefined, 2.2, () => sunny.visible));
      // a perch by the window, because some habits are for keeps
      const perch = cyl(0.04, 0.04, 1.4, 5, 0x8a6a4a);
      perch.position.set(X(-5.2), 0.7, Z(2.6));
      const bar = cyl(0.03, 0.03, 0.8, 5, 0x8a6a4a);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(X(-5.2), 1.4, Z(2.6));
      group.add(perch, bar);
      bl.push({ x: X(-5.2), z: Z(2.6), r: 0.3 });
    },
  };
  HOUSE_DRESS.brontos = {
    tv: 'game', enterLabel: '브론토네에 노크하기',
    stairs: '계단이 올라가요. 게리는 무릎으로 올라가야 해요. 본인 말로는 몸에 좋대요. 린다 말로는 계단에 좋대요.',
    build: (B, X, Z, bl, things) => {
      const linda = folk('bronto', { body: 0x9ab8a0, head: 0x9ab8a0, belly: 0xe0e6c8, spots: 0x7a9a80 }, X(-3.2), 0.28, Z(0.1), Math.PI, { pearls: [1.1, 0.72, 0.5] });
      linda.scale.setScalar(0.85);
      INDOOR.linda = linda;
      attend(linda, 'oasis_brontos');
      things.push(talkThing(() => linda.position, 'linda', '린다', LINDA, undefined, 2.2, () => linda.visible));
      // an extremely large salad bowl
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xfaf6ec));
      bowl.position.set(X(3.6), 1.55, Z(-1.5));
      const greens = ball(0.5, 0x5cbf4a, 1);
      greens.scale.y = 0.35;
      greens.position.set(X(3.6), 1.52, Z(-1.5));
      group.add(bowl, greens);
      things.push({ pos: new THREE.Vector3(X(3.6), 0, Z(-0.4)), r: 1.2, label: '샐러드 보기',
        use: () => ui.say('작은 연못만 한 샐러드. 볼에 붙은 카드: “점심(주니어용) — 헤엄 대비.”') });
    },
  };
  HOUSE_DRESS.todd = {
    tv: 'cartoon', enterLabel: '토드네에 노크하기',
    build: (B, X, Z, bl, things) => {
      const k1 = folk('camel', { body: CAMEL, humps: 1 }, X(-3.9), 0, Z(-2.5), Math.PI, { scale: 0.55, cap: 0x3a7dd8 });
      const k2 = folk('camel', { body: CAMEL, humps: 1 }, X(-2.5), 0, Z(-2.6), Math.PI, { scale: 0.55, cap: 0xd8342c });
      things.push({ getPos: () => k1.position, r: 1.8, label: '쌍둥이에게 말 걸기', use: () => ui.say(nextLine('twins', TWINS)) });
      wanderer(k2, 'oasis_todd', roomArea(X, Z), { speed: 1.4, pause: [1, 3] }); // one twin can't sit still
      attend(k1, 'oasis_todd', { r: 2.5 });
      for (let k = 0; k < 6; k++) {
        const blk = box(0.22, 0.22, 0.22, [0xd8342c, 0x3a7dd8, 0xf2cf5b][k % 3]);
        blk.position.set(X(-1.2 + (k % 3) * 0.3), 0.11 + Math.floor(k / 3) * 0.22, Z(0.9 + (k % 2) * 0.2));
        blk.rotation.y = k * 0.4;
        group.add(blk);
      }
      things.push({ pos: new THREE.Vector3(X(5.2), 0, Z(-2.9)), r: 1.2, label: '냉장고 읽기',
        use: () => ui.say('자석, 달력, 그리고 크레용 그림: 승마용 모어를 탄 낙타가 초록 원을 빙빙 도는 그림. 아래에 또박또박한 아이 글씨로: “아빠(잔디 깎는 중).”') });
    },
  };
  HOUSE_DRESS.openhouse = {
    tv: 'fire', enterLabel: '오픈 하우스에 들어가기(열려 있어요)',
    stairs: '계단은 연출된 침실 세 개로 올라가요. 침대마다 장식 베개가 열한 개. 앉아 본 사람은 아무도 없어요. 그래서 연출된 걸 알 수 있죠.',
    build: (B, X, Z, bl, things) => {
      const tiffany = folk('parrot', { body: 0xe86a9a, head: 0xe86a9a, wing: 0xb03a6a, tail: 0xf2cf5b, face: 0xfff0f4 }, X(0.6), 0, Z(1.2), 0, { shirt: 0xf6c0d4, fidget: true });
      wanderer(tiffany, 'oasis_openhouse', roomArea(X, Z), { speed: 1.0, pause: [1.5, 4] }); // showing the house. to you. constantly.
      things.push({ getPos: () => tiffany.position, r: 2.2, label: '티파니에게 말 걸기', use: () => tiffanyTalk() });
      // staging: a bowl of lemons (plastic), a tray of cookies (for the smell)
      for (let k = 0; k < 5; k++) {
        const lemon = ball(0.12, 0xf2e05b);
        lemon.scale.set(1, 0.8, 1.2);
        lemon.position.set(X(3.4 + (k % 3) * 0.2 - 0.2), 1.1 + Math.floor(k / 3) * 0.1, Z(-1.5 + (k % 2) * 0.15));
        group.add(lemon);
      }
      const tray = box(0.8, 0.04, 0.5, 0x9aa0a6);
      tray.position.set(X(4.0), 1.03, Z(-4.0));
      group.add(tray);
      for (let k = 0; k < 6; k++) {
        const cookie = cyl(0.08, 0.08, 0.03, 7, 0xc9905a);
        cookie.position.set(X(3.75 + (k % 3) * 0.25), 1.07, Z(-4.1 + Math.floor(k / 3) * 0.2));
        group.add(cookie);
      }
      things.push({ pos: new THREE.Vector3(X(4.0), 0, Z(-3.0)), r: 1.2, label: '쿠키 집기',
        use: () => ui.say('하나를 향해 손을 뻗어요. 방 건너편에서, 돌아보지도 않고 티파니: “그건 냄새용이에요, 달링.”', { speaker: '' }) });
      wallSign('HOME', X(3.6), 2.4, Z(-4.3), 0, 1.4, { fg: '#b89a7a' });
    },
  };
  HOUSE_DRESS.dunes = {
    tv: 'lullaby', enterLabel: '듄네에 노크하기',
    build: (B, X, Z, bl, things) => {
      const chad = folk('camel', { body: CAMEL, humps: 1 }, X(1.9), 0, Z(0.9), -0.4, { shirt: 0x5a6a7a });
      const madison = folk('camel', { body: CAMEL_LT, humps: 1 }, X(-0.4), 0, Z(1.0), 0.4, { shirt: 0xd8b8c8, bow: 0xf28fb0 });
      INDOOR.chad = chad;
      INDOOR.madison = madison;
      wanderer(chad, 'oasis_dunes', roomArea(X, Z));
      wanderer(madison, 'oasis_dunes', roomArea(X, Z), { speed: 1.1 });
      things.push({ getPos: () => (chad.visible ? chad : madison).position, r: 2.2, label: '듄네에게 말 걸기',
        enabled: () => chad.visible && madison.visible, use: () => ui.say(nextLine('dunes', DUNES2)) });
      things.push({ getPos: () => (chad.visible ? chad : madison).position, r: 2.2, label: '집에 있는 듄네 식구에게 말 걸기',
        enabled: () => chad.visible !== madison.visible,
        use: () => ui.say(chad.visible ? '매디슨은 외출 중이야. 미라지, 사하라, 미라지 코스. 나는 아기 당번이야. 조끼도 있어.' : '채드는 커피 사러 나갔어. 우리 둘 몫으로. 그리고 자기 몫 하나 더.', { speaker: chad.visible ? '채드' : '매디슨', voice: chad.visible ? VOICE.chad : VOICE.madison }) });
      // moving boxes, still, all labeled the same
      for (let k = 0; k < 7; k++) {
        const bx = box(0.7, 0.55, 0.6, 0xc9a77a);
        bx.position.set(X(-5.1 + (k % 2) * 0.75), 0.28 + Math.floor(k / 2) * 0.56 - (k > 5 ? 0.56 : 0), Z(2.3 + (k > 5 ? 0.8 : 0)));
        group.add(bx);
        const lbl = box(0.4, 0.12, 0.02, 0xffffff);
        lbl.position.set(bx.position.x, bx.position.y, bx.position.z + 0.31);
        group.add(lbl);
      }
      bl.push({ x: X(-4.7), z: Z(2.6), w: 1.6, d: 1.5 });
      things.push({ pos: new THREE.Vector3(X(-4.6), 0, Z(1.4)), r: 1.2, label: '상자 읽기',
        use: () => ui.say('모든 상자에 12번 박스라고 적혀 있어요.') });
      // the bassinet, and baby Sahara
      const bas = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.45, 8, 1, true), mat(0xfaf6ec));
      bas.material.side = THREE.DoubleSide;
      bas.position.set(X(0.9), 0.55, Z(-1.3));
      const basLegs = box(0.6, 0.4, 0.6, 0xd8ccb8);
      basLegs.position.set(X(0.9), 0.2, Z(-1.3));
      group.add(bas, basLegs);
      const baby = folk('camel', { body: CAMEL_LT, humps: 1 }, X(0.9), 0.35, Z(-1.3), 0, { scale: 0.33 });
      bl.push({ x: X(0.9), z: Z(-1.3), r: 0.5 });
      things.push({ getPos: () => baby.position, r: 1.3, label: '아기 엿보기',
        use: () => ui.say('아기 사하라가 커다랗고 무거운 눈꺼풀의 눈으로 천천히 당신을 올려다봐요. 태어난 지 4주, 벌써 어쩐지 감동하지 않은 얼굴이에요.') });
    },
  };
  HOUSE_DRESS.mildred = {
    tv: 'golf', enterLabel: '밀드레드·월트네에 노크하기',
    build: (B, X, Z, bl, things) => {
      // Walt's recliner, angled at the golf
      const rec = box(1.1, 0.55, 1.1, 0x7a5a3a);
      rec.position.set(X(-5.0), 0.28, Z(-1.2));
      const recBack = box(0.3, 1.0, 1.1, 0x7a5a3a);
      recBack.position.set(X(-5.5), 0.7, Z(-1.2));
      group.add(rec, recBack);
      bl.push({ x: X(-5.0), z: Z(-1.2), w: 1.2, d: 1.2 });
      const walt = folk('camel', { body: 0xc8b08a, humps: 2, tuft: 0xe8e0d0 }, X(-4.9), 0.35, Z(-1.2), 2.6, { shirt: 0x6a5a8a, glasses: true });
      attend(walt, 'oasis_mildred');
      things.push(talkThing(() => walt.position, 'walt', '월트', WALT));
      const cat = buildAnimal('cat', { body: 0xe8a860 });
      cat.scale.setScalar(0.45);
      cat.position.set(X(-4.2), 0.3, Z(0.4));
      cat.rotation.y = 2.4;
      group.add(cat);
      // doilies and the candy dish (butterscotch, 1994, forever)
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xbfe6f2, 0.3));
      dish.position.set(X(-3.2), 0.72, Z(-1.7));
      group.add(dish);
      for (let k = 0; k < 5; k++) {
        const candy = ball(0.05, 0xe8a830);
        candy.position.set(X(-3.3 + (k % 3) * 0.08), 0.6, Z(-1.72 + (k % 2) * 0.08));
        group.add(candy);
      }
      things.push({ pos: new THREE.Vector3(X(-3.2), 0, Z(-0.9)), r: 1.1, label: '버터스카치 집기',
        use: () => ui.say('하나를 까요. 잔디가 들어서기 전부터 이 접시에 있었어요. 완벽해요. 버터스카치는 영원하니까요.') });
      // Mildred, after the mall closes: her walking shoes by the door, and her
      const mil = folk('camel', { body: 0xd8c0a0, humps: 1 }, X(1.0), 0, Z(1.4), 0, { shirt: 0xb89ad8, visor: 0xffffff, fidget: true });
      (inside['oasis_mildred'] ??= []).push(() => { mil.visible = mildredHome(); });
      wanderer(mil, 'oasis_mildred', roomArea(X, Z), { speed: 1.2 }); // forty laps a day; the living room is lap forty-one
      things.push({ getPos: () => mil.position, r: 2.2, label: '밀드레드에게 말 걸기', enabled: () => mildredHome(), use: talk('mildred', '밀드레드', MILDRED) });
      for (let k = 0; k < 7; k++) {
        const tr = box(0.22, 0.34, 0.12, 0xd9b24a);
        tr.position.set(X(5.82), 1.9, Z(-0.5 + k * 0.35));
        tr.rotation.y = Math.PI / 2;
        group.add(tr);
      }
      things.push({ pos: new THREE.Vector3(X(5.2), 0, Z(0.5)), r: 1.3, label: '리본 읽기',
        use: () => ui.say('은퇴한 만보계 일곱 개가 트로피처럼 벽에 걸려 있어요. 마지막 하나는 9,999,999. 얘는 쓰러졌어요. 밀드레드는 안 쓰러졌어요.') });
    },
  };
  HOUSES.forEach((h, k) => standardInterior(h, k));

  // ============================================== out on the Circle ----
  const toLocal = (h, x, z) => {
    const du = x - O.x - h.u, dv = z - O.z - h.v, c = Math.cos(h.ry), sn = Math.sin(h.ry);
    return [du * c - dv * sn, du * sn + dv * c];
  };
  const face = (a, x, z) => { a.rotation.y = Math.atan2(x - a.position.x, z - a.position.z); };

  // --- Beverly, on her rounds -------------------------------------------
  const bev = folk('camel', { body: CAMEL_LT, humps: 1 }, 0, 0, 0, 0, { visor: 0xffffff, pearls: [1.28, 0.62, 0.35], clipboard: true });
  const BEV_R = (RING.rIn + RING.rOut) / 2;
  const bevState = { a: -Math.PI / 2, pause: 2, stopAt: 0 };
  const houseAngles = HOUSES.map((h) => (h.deg * Math.PI) / 180).sort((a, b) => a - b);
  zones.addMover({ zone: 'island', obj: bev, r: 0.55 });
  let lawnT = 0, citedAt = -1e9;
  outdoor.push((dt, t, pp) => {
    bev.visible = !bevHome();
    if (!bev.visible) return;
    const busy = ui.isBusy() && Math.hypot(pp.x - bev.position.x, pp.z - bev.position.z) < 4;
    if (busy) { face(bev, pp.x, pp.z); animateGait(bev, t, 0); return; }
    if (bevState.pause > 0) {
      bevState.pause -= dt;
      animateGait(bev, t, 0);
    } else {
      const na = bevState.a + (0.9 / BEV_R) * dt;
      const nx = O.x + RING.u + Math.cos(na) * BEV_R, nz = O.z + RING.v + Math.sin(na) * BEV_R;
      if (Math.hypot(pp.x - nx, pp.z - nz) < 1.0) { animateGait(bev, t, 0); return; } // you're in the way; she waits (pointedly)
      // passing a house? stop and inspect it
      for (const ha of houseAngles) {
        const wrap = (x) => ((x % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        if (wrap(bevState.a - ha) < 0 && wrap(na - ha) >= 0) {
          bevState.pause = 3.5;
          bevState.inspect = ha;
        }
      }
      bevState.a = na;
      bev.position.set(nx, GY, nz);
      bev.rotation.y = Math.atan2(-Math.sin(na), Math.cos(na));
      animateGait(bev, t, 0.8, 7);
    }
    if (bevState.pause > 0 && bevState.inspect !== undefined) {
      face(bev, O.x + RING.u + Math.cos(bevState.inspect) * HOUSE_R, O.z + RING.v + Math.sin(bevState.inspect) * HOUSE_R);
    }
    if (bev.position.y === 0) bev.position.set(O.x + RING.u, GY, O.z + RING.v - BEV_R);
    // the Humphries lawn is NOT for walking on
    const H = HOUSE.humphries;
    const [lx, lz] = toLocal(H, pp.x, pp.z);
    const onLawn = lz > 2.3 && lz < HOUSE_R - RING.rOut - 0.2 && lx > -3.9 && lx < 3.9 && !(lx > -2.45 && lx < -1.35) && !(lx > 0.95);
    lawnT = onLawn ? lawnT + dt : 0;
    if (lawnT > 1.2 && t - citedAt > 60 && !ui.isBusy()) {
      citedAt = t;
      lawnT = 0;
      face(bev, pp.x, pp.z);
      S.addItem('hoa_notice');
      ui.say([
        { speaker: '베벌리', voice: VOICE.beverly, text: '잔디. 에서. 내려와.' },
        { speaker: '베벌리', voice: VOICE.beverly, text: '지금 밟고 있는 건 이 달의 마당의 6.35센티미터예요. 41개월 연속. 내려와. 자 — 이건 당신 거.' },
      ]).then(() => ui.toast('베벌리가 <b>위반 경고장</b>을 건네요. 벌써 다 작성되어 있어요.', '📋'));
    }
  });
  register({
    getPos: () => bev.position, r: 2.4,
    label: '베벌리에게 말 걸기',
    enabled: () => bev.visible,
    use: () => beverlyTalk(false),
  });
  async function beverlyTalk() {
    const B_ = { speaker: 'Beverly', voice: VOICE.beverly };
    if (!S.hasFlag('metBeverly')) {
      S.setFlag('metBeverly');
      await ui.say([
        '베벌리 험프리스. 회장. 주민협의회의. 오아시스 에스테이츠의. — 글쎄요. 이 모든 것의.',
        '당신은 주택 소유자가 아니에요. 확인했어요. 나는 모두를 확인해요. 파크웨이, 드라이브, 보도, 서클은 걸어도 돼요. 잔디는 밟으면 안 돼요. 잘 지낼 수 있을 거예요.',
      ], B_);
    }
    const c = await ui.ask(nextLine('beverly', BEVERLY), [
      { label: '📏 “잔디 상태 어때요?”', value: 'grass' },
      { label: '👏 “정말 잘하고 계세요.”', value: 'praise' },
      { label: '🙃 “누가 당신 뽑았는데요?”', value: 'mess' },
      { label: '천천히 뒷걸음질', value: null },
    ], B_);
    if (c === 'grass') {
      await ui.say([
        '그녀가 바이저에서 접이식 자를 꺼내요. 무릎을 꿇어요. 재요.',
        { ...B_, text: '6.35. … 6.35. … 6.3 — 토드. 이 풀잎은 6.67센티미터예요.' },
        { speaker: '토드', voice: VOICE.todd, text: '(아주 멀리서) 알겠어요!' },
      ]);
    } else if (c === 'praise') {
      if (!S.hasFlag('praisedBeverly')) {
        S.setFlag('praisedBeverly');
        await ui.say(['…', '고마워요. 아무도 그런 말은 안 하거든요.', '고맙다고 한 거 비밀이에요. 나한텐 평판이 있어요. 손수 쌓은 평판이요.'], B_);
      } else {
        await ui.say('I know.', B_);
      }
    } else if (c === 'mess') {
      const had = S.countItem('hoa_notice');
      S.addItem('hoa_notice');
      await ui.say(had
        ? ['또 하나네요. 당신 파일을 만들기 시작했어요. 벌써 이름표 탭도 붙어 있어요.', '오늘 아침에 탭을 만들었지요. 왠지 예감이 들어서요.']
        : ['그랬어요. 아주 박빙의 표결이었죠. 1대 0.', '이름이 뭐예요, 얘야? 아니 — 말하지 마세요. 내가 알아낼 테니까.', '자.'], B_);
      ui.toast('<b>위반 경고장</b>. 베벌리는 아주, 아주 빨리 써요.', '📋');
    }
  }
  function tiffanyTalk() {
    const T = { speaker: 'Tiffany', voice: VOICE.tiffany };
    return ui.ask(nextLine('tiffany', TIFFANY), [
      { label: '💰 Ask the price', value: 'price' },
      { label: '📝 Make an offer', value: 'offer' },
      { label: '그냥 구경 중', value: null },
    ], T).then((c) => {
      if (c === 'price') {
        return ui.say([
          '가… 가격이요? 어머! 어머나. 아무도 한 번도 — 잠깐만요, 달링.',
          '(She takes out a card she has clearly been keeping in her blazer for a very long time.)',
          '320만 버튼이요. … HOA 회비 별도예요.',
        ].map((text) => ({ ...T, text, speaker: text.startsWith('(') ? '' : 'Tiffany' })));
      }
      if (c === 'offer') {
        return ui.say([
          '오퍼요! 어머, 저 — 앉아야겠어요. 연출된 의자에. 제가 앉으면 안 되는 의자요.',
          '달링, 이사회 승인이 필요해요. 이사회는 베벌리고요. … 일단 “열정적”으로 기록해 둘게요.',
        ], T);
      }
      return null;
    });
  }
  // her OPEN HOUSE sign, and balloons, out at the curb
  {
    const H = HOUSE.openhouse;
    const [su, sv] = H.L(0.2, HOUSE_R - RING.rOut - 0.6);
    const sg = sign(['오픈 하우스', '오늘만! (매일)', '티파니 · 555-OASIS'], { w: 1.3, h: 0.95, bg: '#ffffff', fg: '#c8346a', border: '#c8346a' });
    put(sg, su, sv, 0.95, H.ry);
    put(box(0.08, 0.6, 0.08, 0xfaf6ec), su, sv, 0.3, H.ry);
    solidDisc(su, sv, 0.2);
    for (let k = 0; k < 3; k++) {
      const [bu, bv] = H.L(0.7 + k * 0.25, HOUSE_R - RING.rOut - 0.6 + (k % 2) * 0.15);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat([0xf28fb0, 0xffffff, 0xf2cf5b][k], 0.4));
      b.scale.y = 1.2;
      b.castShadow = true;
      b.userData.dynamic = true; // (balloons bob)
      put(b, bu, bv, 1.7 + k * 0.2);
      const str = box(0.01, 1.6 + k * 0.2, 0.01, 0xffffff);
      put(str, bu, bv, 0.85 + k * 0.1);
      outdoor.push((dt, t) => { b.position.x = O.x + bu + Math.sin(t * 1.3 + k) * 0.06; });
    }
  }
  // Dolores (Mildred's flamingo), in the front lawn, watching Beverly
  {
    const H = HOUSE.mildred;
    const [fu, fv] = H.L(-0.2, 3.3);
    const fl = new THREE.Group();
    const pink = 0xf07aa8;
    const body = ball(0.25, pink, 1);
    body.scale.set(0.8, 0.8, 1.2);
    body.position.y = 0.95;
    const leg = cyl(0.02, 0.02, 0.85, 4, 0x3a3a3e);
    leg.position.y = 0.45;
    const neck = cyl(0.04, 0.05, 0.6, 5, pink);
    neck.position.set(0, 1.35, 0.2);
    neck.rotation.x = 0.4;
    const head = ball(0.1, pink);
    head.position.set(0, 1.65, 0.3);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), mat(0x2a2a2e));
    beak.rotation.x = Math.PI / 2 + 0.7;
    beak.position.set(0, 1.6, 0.4);
    fl.add(body, leg, neck, head, beak);
    fl.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    fl.userData.dynamic = true; // (Dolores turns to watch Beverly)
    put(fl, fu, fv, 0, H.ry + 0.6);
    solidDisc(fu, fv, 0.25);
    register({
      pos: new THREE.Vector3(O.x + fu, 0, O.z + fv), r: 1.5,
      label: '돌로레스 바라보기',
      use: () => ui.say([
        '분홍 플라스틱 플라밍고, 한 다리, 고개를 갸웃하고, 밀드레드·월트네 잔디 한가운데. 이름은 돌로레스.',
        '그녀는 베벌리가 어디에 서 있든, 아주 정확하게 그쪽을 향해 각도가 맞춰져 있어요.',
      ]),
    });
    outdoor.push(() => {
      if (bev.visible) fl.rotation.y = Math.atan2(bev.position.x - fl.position.x, bev.position.z - fl.position.z);
    });
  }
  // sprinklers: a few front lawns, ticking round (in the morning and at
  // dusk, per the covenant — and whenever Todd says so)
  function sprinkler(u, v) {
    const g = new THREE.Group();
    const head = cyl(0.06, 0.08, 0.12, 6, 0x3a3a3e);
    head.position.y = 0.06;
    g.add(head);
    const drops = [];
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xcfeefa, transparent: true, opacity: 0.75 });
    for (let k = 0; k < 10; k++) {
      const dr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), dropMat);
      g.add(dr);
      drops.push(dr);
    }
    put(g, u, v);
    outdoor.push((dt, t) => {
      const h = hourNow();
      const on = (h >= 6 && h < 9) || (h >= 18 && h < 20);
      g.visible = true;
      drops.forEach((dr, k) => {
        dr.visible = on;
        if (!on) return;
        const ph = (t * 0.6 + k / drops.length) % 1;
        const ang = Math.sin(t * 0.8) * 1.2;
        const r = ph * 2.2;
        dr.position.set(Math.sin(ang) * r, 0.15 + ph * (1 - ph) * 2.4, Math.cos(ang) * r);
      });
    });
  }
  for (const id of ['humphries', 'featherstones', 'todd', 'dunes']) {
    const [su, sv] = HOUSE[id].L(-0.2, 3.6);
    sprinkler(su, sv);
  }

  // --- Gary, at the grill, in the Brontos' backyard ------------------------
  {
    const H = HOUSE.brontos;
    const [gu, gv] = H.yard(1.2, 0.55);
    const grill = new THREE.Group();
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x2a2a2e));
    kettle.position.y = 0.95;
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a2a2e));
    lid.position.set(0.3, 1.05, 0);
    lid.rotation.z = -1.2;
    grill.add(kettle, lid);
    for (let k = 0; k < 3; k++) {
      const leg = cyl(0.03, 0.03, 0.95, 4, 0x3a3a3e);
      const a = (k / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.25, 0.47, Math.sin(a) * 0.25);
      grill.add(leg);
    }
    for (let k = 0; k < 3; k++) {
      const patty = cyl(0.12, 0.12, 0.05, 7, 0x7a4a2a);
      patty.position.set(-0.15 + k * 0.15, 0.97, (k % 2) * 0.12 - 0.06);
      grill.add(patty);
    }
    grill.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(grill, gu, gv, 0, H.ry);
    solidDisc(gu, gv, 0.5);
    // smoke: a few soft puffs, recycled
    const puffs = [];
    for (let k = 0; k < 5; k++) {
      const pf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: 0xe8e4dc, transparent: true, opacity: 0.5 }));
      put(pf, gu, gv, 1.2);
      puffs.push(pf);
    }
    outdoor.push((dt, t) => {
      puffs.forEach((pf, k) => {
        const ph = (t * 0.25 + k / puffs.length) % 1;
        pf.position.set(O.x + gu + Math.sin(ph * 5 + k) * 0.2, GY + 1.2 + ph * 2.2, O.z + gv + ph * 0.3);
        pf.scale.setScalar(0.6 + ph * 1.6);
        pf.material.opacity = 0.5 * (1 - ph);
      });
    });
    const [pu, pv] = H.yard(-1.2, 0.55);
    const gary = folk('bronto', { body: 0x8fb58a, head: 0x8fb58a }, O.x + pu, GY, O.z + pv, 0, { apron: 0xd8342c, cap: 0x2e3e5c });
    face(gary, O.x + gu, O.z + gv);
    gary.userData.fidget = true;
    solidDisc(pu, pv, 0.9);
    { const tu = pu - Math.sin(gary.rotation.y) * 1.4, tv = pv - Math.cos(gary.rotation.y) * 1.4; solidDisc(tu, tv, 0.5); } // and his tail
    register({ getPos: () => gary.position, r: 2.6, label: '게리에게 말 걸기', use: talk('gary', '게리', GARY) });
    // a picnic table, set for a burger nobody has yet received
    const [tu, tv2] = H.yard(-2.4, 0.2);
    const pt = new THREE.Group();
    const top = box(1.6, 0.08, 0.8, 0x9a7448);
    top.position.y = 0.72;
    pt.add(top);
    for (const sz of [-0.62, 0.62]) {
      const bench = box(1.6, 0.06, 0.28, 0x9a7448);
      bench.position.set(0, 0.42, sz);
      pt.add(bench);
    }
    for (const sx of [-0.65, 0.65]) {
      const leg = box(0.08, 0.72, 1.4, 0x7a5a3a);
      leg.position.set(sx, 0.36, 0);
      pt.add(leg);
    }
    pt.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(pt, tu, tv2, 0, H.ry);
    solidBox(tu, tv2, 1.7, 1.5, H.ry);
  }

  // --- No Outlet, in the Brontos' garage ------------------------------------
  {
    const H = HOUSE.brontos;
    const floorY = 0.12;
    const [fu, fv] = H.L(2.3, -0.1);
    zones.addSurfaceBox(O.x + fu, O.z + fv, 2.6, HD - 0.4, GY + floorY, H.ry);
    const at = (lx, lz) => { const [u, v] = H.L(lx, lz); return [O.x + u, O.z + v]; };
    const band = [];
    // Dakota, drums, at the back
    {
      const [x, z] = at(2.3, -1.1);
      const kit = new THREE.Group();
      const bass = cyl(0.32, 0.32, 0.3, 10, 0xd8342c);
      bass.rotation.x = Math.PI / 2;
      bass.position.set(0, 0.34, 0.5);
      const snare = cyl(0.18, 0.18, 0.12, 9, 0xeeeeee);
      snare.position.set(-0.35, 0.6, 0.35);
      const cym = cyl(0.25, 0.25, 0.02, 10, 0xd9b24a);
      cym.position.set(0.45, 1.05, 0.35);
      const cstand = cyl(0.015, 0.015, 1.0, 4, 0x9aa0a6);
      cstand.position.set(0.45, 0.55, 0.35);
      kit.add(bass, snare, cym, cstand);
      kit.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      kit.userData.dynamic = true; // (the cymbal crashes)
      kit.position.set(x, GY + floorY, z);
      kit.rotation.y = H.ry;
      group.add(kit);
      const d = folk('camel', { body: CAMEL, humps: 2 }, x, GY + floorY, z, H.ry, { cap: 0x2a2a2e });
      d.scale.setScalar(0.8);
      band.push({ a: d, name: 'Dakota', cym });
    }
    {
      const [x, z] = at(1.55, 0.6);
      const k = folk('parrot', { body: 0x2a2a30, head: 0x2a2a30, wing: 0x7ad85a, tail: 0x7ad85a, face: 0xe8e8e8 }, x, GY + floorY, z, H.ry + 0.3);
      k.scale.setScalar(0.85);
      const guitar = new THREE.Group();
      const gb = box(0.3, 0.42, 0.08, 0x7ad85a);
      const neck = box(0.06, 0.6, 0.05, 0x2a2a2e);
      neck.position.set(0.18, 0.35, 0);
      neck.rotation.z = -0.9;
      guitar.add(gb, neck);
      guitar.position.set(0.05, 0.6, 0.5);
      guitar.rotation.z = 0.5;
      k.add(guitar);
      band.push({ a: k, name: 'Kiwi' });
    }
    {
      const [x, z] = at(3.0, 0.8);
      const j = folk('bronto', { body: 0x8fb58a, head: 0x8fb58a }, x, GY + floorY, z, H.ry - 0.3, { cap: 0xd8342c });
      j.scale.setScalar(0.62);
      const bassG = new THREE.Group();
      const bb = box(0.42, 0.5, 0.1, 0x3a7dd8);
      const neck = box(0.07, 0.9, 0.06, 0x2a2a2e);
      neck.position.set(0.3, 0.45, 0);
      neck.rotation.z = -0.9;
      bassG.add(bb, neck);
      bassG.position.set(0, 0.8, 0.95);
      bassG.rotation.z = 0.5;
      j.add(bassG);
      band.push({ a: j, name: 'Junior' });
    }
    // amps, a poster, a lamp: garage band canon
    for (const [lx, lz, c] of [[1.2, -1.4, 0x2a2a2e], [3.3, -1.5, 0x2a2a2e]]) {
      const [x, z] = at(lx, lz);
      const amp = box(0.6, 0.7, 0.4, c);
      amp.position.set(x, GY + floorY + 0.35, z);
      amp.rotation.y = H.ry;
      group.add(amp);
      const grille = box(0.5, 0.5, 0.02, 0x55555a);
      const [gx, gz] = at(lx, lz + 0.21);
      grille.position.set(gx, GY + floorY + 0.4, gz);
      grille.rotation.y = H.ry;
      group.add(grille);
    }
    // the garage light: a bare tube on the ceiling, always on (band practice
    // is all day), and the warm pool it throws on the floor (a glow, not a
    // light — the budget)
    {
      const [lx, lz] = at(2.3, -0.2);
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 1.8), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
      tube.position.set(lx, GY + 2.1, lz);
      tube.rotation.y = H.ry;
      group.add(tube);
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const c = cv.getContext('2d');
      const gr = c.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,220,150,0.8)');
      gr.addColorStop(1, 'rgba(255,220,150,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pool.rotation.x = -Math.PI / 2;
      pool.rotation.z = H.ry;
      pool.position.set(lx, GY + floorY + 0.03, lz);
      group.add(pool);
      for (const sx of [-0.8, 0.8]) {
        // and a warm wash up the back wall
        const [wx, wz] = at(2.3 + sx, -HD / 2 + 0.23);
        const wash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        wash.position.set(wx, GY + 1.3, wz);
        wash.rotation.y = H.ry;
        group.add(wash);
      }
    }
    const [px, pz] = at(2.3, -HD / 2 + 0.22);
    const poster = sign(['노 아울렛', '이 동네를 떠나는 중', '화 2–4시 (매일)'], { w: 1.3, h: 0.9, d: 0.03, bg: '#2a2a30', fg: '#7ad85a' });
    poster.position.set(px, GY + 1.5, pz);
    poster.rotation.y = H.ry;
    group.add(poster);
    for (const b of band) zones.addBlocker(b.a.position.x, b.a.position.z, 0.45);
    { const j = band[2].a; zones.addBlocker(j.position.x - Math.sin(j.rotation.y) * 1.0, j.position.z - Math.cos(j.rotation.y) * 1.0, 0.4); } // Junior's tail
    for (const [lx, lz] of [[1.2, -1.4], [3.3, -1.5]]) { const [x, z] = at(lx, lz); zones.addBlocker(x, z, 0.42); } // the amps
    const [mx, mz] = at(2.3, 1.7);
    let jam = 0;
    outdoor.push((dt, t) => {
      jam = Math.max(0, jam - dt);
      const k = jam > 0 ? 1 : 0.35;
      band.forEach((b, i) => {
        const hd = b.a.userData.parts.head;
        hd.rotation.x = Math.max(0, Math.sin(t * (jam > 0 ? 11 : 6) + i)) * 0.35 * k;
        if (b.cym) b.cym.rotation.z = Math.sin(t * 12) * 0.15 * k;
      });
    });
    register({
      pos: new THREE.Vector3(mx, 0, mz), r: 2.2,
      label: '노 아울렛에게 말 걸기',
      use: async () => {
        const c = await ui.ask('차고. 앰프 세 개, 포스터 한 장, 드럼 세트 하나, 그리고 이 동네를 아주 많이 떠나고 싶은 밴드.', [
          { label: '💬 “밴드는 뭘 하는데?”', value: 'chat' },
          { label: '🎸 곡 신청하기', value: 'song' },
          { label: '고개 끄덕이고 나가기', value: null },
        ]);
        if (c === 'chat') {
          const set = nextLine('band', BAND);
          await ui.say(set.map(([sp, text]) => ({ speaker: sp, voice: BAND_VOICE[sp], text })));
        } else if (c === 'song') {
          await ui.say([
            { speaker: '키위', voice: BAND_VOICE.Kiwi, text: '이 곡은 “컬디색”이야. 빙빙 돌기만 하는 곡이지.' },
            { speaker: '다코타', voice: BAND_VOICE.Dakota, text: '하나, 둘 — 하나, 둘, 셋, 넷 —' },
          ]);
          jam = playCulDeSac();
          setTimeout(() => {
            if (zones.current() === 'island') {
              ui.say([
                { speaker: '키위', voice: BAND_VOICE.Kiwi, text: '고마워요, 오아시스 에스테이츠! 우리는 이 동네를 떠납니다!' },
                { speaker: 'Junior', voice: BAND_VOICE.Junior, text: '(after snack)' },
              ]);
            }
          }, (jam + 0.6) * 1000);
        }
      },
    });
  }
  // the band's one song, on the sfx bus: power chords (root + fifth),
  // a kick and a snare. about eight seconds. loud-ish. within the permit.
  function playCulDeSac() {
    const bpm = 168, e8 = 60 / bpm / 2;
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const bars = [[40, 40, 40, 40, 43, 43, 45, 45], [40, 40, 40, 40, 48, 48, 47, 47]];
    let when = 0.05;
    for (let rep = 0; rep < 2; rep++) {
      for (const bar of bars) {
        bar.forEach((m, k) => {
          tone(hz(m), { time: when, dur: e8 * 0.8, type: 'sawtooth', vol: 0.035 });
          tone(hz(m + 7), { time: when, dur: e8 * 0.8, type: 'sawtooth', vol: 0.025 });
          if (k % 4 === 0) tone(70, { time: when, dur: 0.14, type: 'sine', vol: 0.09, slide: -35 });
          if (k % 4 === 2) tone(240, { time: when, dur: 0.05, type: 'square', vol: 0.03, slide: -80 });
          when += e8;
        });
      }
    }
    tone(hz(40), { time: when, dur: 0.9, type: 'sawtooth', vol: 0.04 });
    tone(hz(47), { time: when, dur: 0.9, type: 'sawtooth', vol: 0.03 });
    tone(70, { time: when, dur: 0.3, type: 'sine', vol: 0.1, slide: -35 });
    return when + 0.9;
  }

  // --- Todd, mowing, in stripes ---------------------------------------------
  {
    const mower = new THREE.Group();
    const deck = box(1.2, 0.3, 1.5, 0x3f8a3f);
    deck.position.y = 0.4;
    const seat = box(0.6, 0.15, 0.5, 0x2a2a2e);
    seat.position.set(0, 0.62, -0.3);
    const hood = box(1.0, 0.35, 0.6, 0x3f8a3f);
    hood.position.set(0, 0.65, 0.45);
    const wheelMesh = (r, x, z) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 8), mat(0x2a2a2e));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, r, z);
      return w;
    };
    const steer = cyl(0.18, 0.18, 0.04, 8, 0x2a2a2e);
    steer.position.set(0, 1.0, 0.25);
    steer.rotation.x = -0.6;
    mower.add(deck, seat, hood, steer, wheelMesh(0.28, -0.62, -0.5), wheelMesh(0.28, 0.62, -0.5), wheelMesh(0.18, -0.55, 0.55), wheelMesh(0.18, 0.55, 0.55));
    mower.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    const todd = buildAnimal('camel', { body: CAMEL_DK, humps: 1 });
    dress(todd, { cap: 0x3f8a3f, shirt: 0xe8e0cc });
    todd.scale.setScalar(0.7);
    todd.position.set(0, 0.2, -0.35);
    mower.add(todd);
    mower.userData.dynamic = true;
    group.add(mower);
    zones.addMover({ zone: 'island', obj: mower, r: 0.85 });
    // stripes, north–south, back and forth, forever, on the lawn south of
    // the pool
    const U0 = 13.2, U1 = 19.8, V0 = 18.8, V1 = 24.6, STEP = 1.3;
    const lanes = [];
    for (let u = U0; u <= U1 + 0.01; u += STEP) lanes.push(u);
    const path = [];
    lanes.forEach((u, k) => { const a = k % 2 ? V1 : V0, b = k % 2 ? V0 : V1; path.push([u, a], [u, b]); });
    for (let k = path.length - 2; k > 0; k--) path.push(path[k]); // and back again
    const m = { i: 0, x: path[0][0], z: path[0][1] };
    mower.position.set(O.x + m.x, GY, O.z + m.z);
    let vroom = 0;
    outdoor.push((dt, t, pp) => {
      const hr = hourNow();
      todd.visible = hr >= 7 && hr < 20; // after dark the mower waits where he left it
      if (!todd.visible) return;
      if (ui.isBusy() && Math.hypot(pp.x - mower.position.x, pp.z - mower.position.z) < 4) return; // he stops to chat
      const [tu, tv] = path[m.i];
      const dx = tu - m.x, dz = tv - m.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { m.i = (m.i + 1) % path.length; return; }
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - mower.rotation.y), Math.cos(want - mower.rotation.y));
      if (Math.abs(diff) > 0.05) { mower.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt); return; }
      const nx = m.x + (dx / d) * Math.min(d, 1.1 * dt), nz = m.z + (dz / d) * Math.min(d, 1.1 * dt);
      if (Math.hypot(pp.x - O.x - nx, pp.z - O.z - nz) < 1.3) return; // you're on his lawn; he waits, idling politely
      m.x = nx; m.z = nz;
      mower.position.set(O.x + m.x, GY + Math.sin(t * 30) * 0.01, O.z + m.z);
      vroom -= dt;
      if (vroom <= 0 && Math.hypot(pp.x - mower.position.x, pp.z - mower.position.z) < 9) {
        vroom = 0.35;
        tone(82 + Math.random() * 6, { dur: 0.3, type: 'triangle', vol: 0.012 });
      }
    });
    register({ getPos: () => mower.position, r: 2.4, label: '토드에게 말 걸기', enabled: () => todd.visible, use: talk('todd', '토드', TODD) });
    register({ getPos: () => mower.position, r: 2.4, label: '모어 보기', enabled: () => !todd.visible,
      use: () => ui.say('승마용 모어가 밤사이 줄무늬 중간에, 토드가 멈춘 바로 그 자리에 주차돼 있어요. 열쇠는 꽂혀 있어요. 항상 꽂혀 있어요. 여기선 아무도 상상조차 안 해요.') });
  }

  // --- the kids, at the playground --------------------------------------------
  {
    const P = RING;
    const kidA = folk('parrot', { body: 0xf2cf5b, head: 0xf2cf5b, wing: 0x3a7dd8, tail: 0xd8342c }, 0, 0, 0, 0, { scale: 0.5 });
    const kidB = folk('parrot', { body: 0x3a9ad8, head: 0x3a9ad8, wing: 0xf2cf5b, tail: 0x5cbf4a }, 0, 0, 0, 0, { scale: 0.5 });
    const kidC = folk('camel', { body: CAMEL_LT, humps: 1 }, 0, 0, 0, 0, { scale: 0.45, bow: 0xf28fb0 });
    // A swings; B and C work the seesaw
    const seat = h0Swings[0];
    outdoor.push((dt, t) => {
      const hr = hourNow();
      const out = hr >= 7 && hr < 20; // bedtime is bedtime
      kidA.visible = kidB.visible = kidC.visible = out;
      if (!out) return;
      const sw = Math.sin(t * 2.2) * 0.55;
      h0Swings[0].rotation.x = sw;
      h0Swings[1].rotation.x = Math.sin(t * 1.3 + 1) * 0.08;
      seat.updateMatrixWorld(true);
      const sp = new THREE.Vector3(0, -1.45, 0).applyMatrix4(seat.matrixWorld);
      kidA.position.copy(sp);
      kidA.rotation.y = 0.2 + Math.PI;
      const tilt = Math.sin(t * 1.6) * 0.28;
      h0Seesaw.rotation.z = tilt;
      h0Seesaw.parent.updateMatrixWorld(true);
      for (const [kid, end] of [[kidB, -1.1], [kidC, 1.1]]) {
        const p = new THREE.Vector3(end, 0.04, 0).applyMatrix4(h0Seesaw.matrixWorld);
        kid.position.set(p.x, p.y, p.z);
      }
    });
    kidB.rotation.y = 0.1 + Math.PI / 2;
    kidC.rotation.y = 0.1 - Math.PI / 2;
    register({
      pos: new THREE.Vector3(O.x + P.u, 0, O.z + P.v), r: 4.2, priority: 0,
      label: '아이들에게 말 걸기',
      enabled: () => kidA.visible,
      use: talk('kids', '아이들', KIDS),
    });
  }

  // ================================================ out and about ----
  // Residents step out: to the shops, to a neighbor's, and home again —
  // along the walks, the Circle, Circle Drive and the Parkway (they walk
  // down the middle of it; it is not a road). While someone's out, their
  // at-home self isn't home. From seven in the morning to eleven at night.
  {
    const LANE = 7.9;                      // their lap of the Circle (Beverly keeps the inside lane; they pass her)
    const HUB = { u: SPUR.u, v: -10 };     // the foot of Circle Drive, on the Parkway
    const W2 = (u, v) => ({ x: O.x + u, z: O.z + v });
    const P = (x, z) => ({ x, z });
    function houseAccess(h) {
      const lz = HOUSE_R - Math.sqrt(LANE * LANE - 1.9 * 1.9);
      const [cu, cv] = h.L(-1.9, lz);
      const pts = [EXIT[`oasis_${h.id}`], W2(cu, cv)];
      let a = Math.atan2(cv - RING.v, cu - RING.u);
      const goal = -Math.PI / 2;
      let d = Math.atan2(Math.sin(goal - a), Math.cos(goal - a));
      const n = Math.max(1, Math.ceil(Math.abs(d) / 0.2));
      for (let k = 1; k <= n; k++) {
        const aa = a + (d * k) / n;
        pts.push(W2(RING.u + Math.cos(aa) * LANE, RING.v + Math.sin(aa) * LANE));
      }
      pts.push(W2(HUB.u, HUB.v));
      return pts;
    }
    const SHOP_ACCESS = {
      mall: () => [EXIT.mall, W2(-9, -10), W2(HUB.u, HUB.v)],
      polly: () => [EXIT.polly, W2(5, -10), W2(HUB.u, HUB.v)],
      drom: () => [EXIT.drom, W2(14, -10), W2(HUB.u, HUB.v)],
      mirage: () => [EXIT.mirage, W2(13.4, -1.7), W2(18.05, -1.7), W2(18.05, -10), W2(HUB.u, HUB.v)],
      cluck: () => [EXIT.cluck, W2(20.4, -1.7), W2(18.05, -1.7), W2(18.05, -10), W2(HUB.u, HUB.v)],
    };
    const access = (dest) => (SHOP_ACCESS[dest] ? SHOP_ACCESS[dest]() : houseAccess(HOUSE[dest]));
    function route(from, to) {
      const a = access(from), b = access(to).reverse();
      // two houses: meet on the Circle, not down at the Parkway
      if (!SHOP_ACCESS[from] && !SHOP_ACCESS[to]) { a.splice(-2); b.splice(0, 2); }
      else { a.pop(); } // (the hub once, not twice)
      return [...a, ...b].map((p) => P(p.x, p.z));
    }
    const STROLLERS = [
      { key: 'harold', home: 'humphries', kind: 'camel', colors: { body: CAMEL_DK, humps: 2 }, o: { shirt: 0x8a9a7a, glasses: true }, likes: ['polly', 'mall', 'mildred', 'drom'],
        lines: ['우편함까지 걸어가는 중이야. 그리고 지나쳐서. 그리고 다시 돌아와서. 베벌리가 일정 잡지 않은 유일한 운동이지.', '트레이더 폴리에. 좋은 양념을 원하셔. 종 빼고 다 있는 양념. 나는 종에 대해 묻지 않아. 아무도 종에 대해 묻지 않아.'] },
      { key: 'sunny', home: 'featherstones', kind: 'parrot', colors: { body: 0x5cbf4a, head: 0x5cbf4a, wing: 0x2e8a5a, tail: 0x3a7dd8, face: 0xf2e08a }, o: { apron: 0xf28fb0 }, likes: ['polly', 'humphries', 'dunes', 'cluck'],
        lines: ['트레이더 폴리에 뛰어가는 중! 아이스티가 떨어졌어. 아이스티가 떨어지는 일은 절대 없는데. 비상사태야.', '안녕, 허니! 멈출 수 없어 — 베벌리가 듄네 재활용 보고서를 원해. 전부 12번 박스거든.'] },
      { key: 'linda', home: 'brontos', kind: 'bronto', colors: { body: 0x9ab8a0, head: 0x9ab8a0, belly: 0xe0e6c8, spots: 0x7a9a80 }, o: { pearls: [1.1, 0.72, 0.5] }, scale: 0.85, likes: ['cluck', 'mall', 'mirage'],
        lines: ['저녁 산책. 게리는 아직도 그릴 앞이야. 버거는 아직도 거의 다 됐어. 나는 너겟 먹으러.', '파크웨이 걷는 게 좋아. 도로가 아니거든, 알지? 노란 선 한가운데로 걸어. 아주 해방감 있어.'] },
      { key: 'chad', home: 'dunes', kind: 'camel', colors: { body: CAMEL, humps: 1 }, o: { shirt: 0x5a6a7a }, likes: ['mirage', 'cluck', 'todd'],
        lines: ['셰이큰 에스프레소 사러. 내 거. 매디슨 거 하나. 그리고 내 거 하나 더.', '매디슨이 이제 아빠처럼 걷는대. 연습했거든. 뒤꿈치, 발끝, 열쇠 딸랑.'] },
      { key: 'madison', home: 'dunes', kind: 'camel', colors: { body: CAMEL_LT, humps: 1 }, o: { shirt: 0xd8b8c8, bow: 0xf28fb0 }, likes: ['mirage', 'mall', 'openhouse'],
        lines: ['미라지, 사하라, 미라지. 이게 한 바퀴야. 이게 내 유산소 운동.', '채드가 아기를 봐. 이건 내 산책이야. 걷는 중이야. 나 걷는 거 좀 봐.'] },
    ];
    for (const st of STROLLERS) {
      const a = folk(st.kind, st.colors, 0, GY, 0, 0, st.o);
      if (st.scale) a.scale.setScalar(st.scale);
      a.visible = false;
      zones.addMover({ zone: 'island', obj: a, r: 0.5 });
      st.a = a;
      st.state = 'home';
      st.timer = 3 + Math.random() * 30;
      register({ getPos: () => a.position, r: 2.2, label: `talk to ${st.key[0].toUpperCase() + st.key.slice(1)}`, enabled: () => a.visible,
        use: () => ui.say(nextLine(`out_${st.key}`, st.lines), { speaker: st.key[0].toUpperCase() + st.key.slice(1), voice: VOICE[st.key] ?? 400 }) });
    }
    function setOut(st, out) {
      st.a.visible = out === 'walking';
      if (INDOOR[st.key]) INDOOR[st.key].visible = out === 'home';
    }
    outdoor.push((dt, t, pp) => {
      const hr = hourNow();
      const awake = hr >= 7 && hr < 23;
      for (const st of STROLLERS) {
        const a = st.a;
        if (st.state === 'home' || st.state === 'in') {
          st.timer -= dt;
          if (st.timer > 0) continue;
          if (st.state === 'home' && !awake) { st.timer = 30; continue; }
          // somebody stays home: housemates take turns going out
          if (st.state === 'home' && STROLLERS.some((o) => o !== st && o.home === st.home && o.state !== 'home')) { st.timer = 10 + Math.random() * 20; continue; }
          const from = st.state === 'home' ? st.home : st.at;
          const to = st.state === 'home' ? st.likes[Math.floor(Math.random() * st.likes.length)] : st.home;
          st.path = route(from, to);
          st.i = 0;
          st.dest = to;
          st.state = 'walking';
          a.position.set(st.path[0].x, GY, st.path[0].z);
          setOut(st, 'walking');
          continue;
        }
        // walking the path
        if (ui.isBusy() && Math.hypot(pp.x - a.position.x, pp.z - a.position.z) < 3.5) {
          a.rotation.y = turnToward(a.rotation.y, Math.atan2(pp.x - a.position.x, pp.z - a.position.z), dt, 3);
          animateGait(a, t, 0);
          continue;
        }
        const tg = st.path[st.i];
        const dx = tg.x - a.position.x, dz = tg.z - a.position.z, d = Math.hypot(dx, dz);
        if (d < 0.2) {
          st.i++;
          if (st.i >= st.path.length) {
            // arrived: in the door they go
            st.at = st.dest;
            st.state = st.dest === st.home ? 'home' : 'in';
            st.timer = st.state === 'home' ? 25 + Math.random() * 60 : 15 + Math.random() * 35;
            setOut(st, st.state === 'home' ? 'home' : 'in');
          }
          continue;
        }
        const step = Math.min(d, 1.25 * dt);
        const nx = a.position.x + (dx / d) * step, nz = a.position.z + (dz / d) * step;
        if (Math.hypot(pp.x - nx, pp.z - nz) < 1.0) { animateGait(a, t, 0); continue; } // after you
        if (bev.visible && Math.hypot(bev.position.x - nx, bev.position.z - nz) < 0.55) { animateGait(a, t, 0); continue; } // nobody walks INTO Beverly
        a.position.set(nx, GY, nz);
        a.rotation.y = turnToward(a.rotation.y, Math.atan2(dx, dz), dt, 7);
        animateGait(a, t, 1, 8);
      }
    });
  }

  // ======================================================== shopping ----
  // one buying loop for every till on the island: pick a thing, pay, hear
  // about it. goods: [{ id?, label?, emoji?, price, say, then? }]
  async function till(who, voiceKey, prompt, goods, { thanks = '', once = null } = {}) {
    const V = { speaker: who, voice: VOICE[voiceKey] ?? 480 };
    const c = await ui.ask(prompt, [
      ...goods.map((g, k) => ({
        label: `${g.emoji ?? ITEMS[g.id].emoji} ${g.label ?? ITEMS[g.id].name}`, value: String(k), hint: `${g.price}🔘`,
        disabled: S.state.buttons < g.price || (g.hat && S.state.hats.includes(g.hat)),
      })),
      { label: '그냥 구경 중', value: null },
    ], V);
    if (c === null || c === undefined) return;
    const g = goods[Number(c)];
    S.spend(g.price);
    if (g.hat) S.ownHat(g.hat);
    else if (g.id) S.addItem(g.id);
    kaching();
    ui.updateHUD();
    if (g.id) ui.toast(`You bought <b>${ITEMS[g.id].name}</b>.${thanks ? ' ' + thanks : ''}`, ITEMS[g.id].emoji);
    const lines = typeof g.say === 'function' ? g.say() : g.say;
    await ui.say(lines, V);
    await g.then?.();
    void once;
  }
  // shelves stocked with little bright things (seeded, like everything placed)
  function shelfUnit(x, z, ry, w = 3.0, palette = [0xd8342c, 0xf2cf5b, 0x3a7dd8, 0x5cbf4a, 0xf28fb0, 0xe8e0cc]) {
    const g = new THREE.Group();
    const back = box(w, 1.8, 0.1, 0xf3efe2);
    back.position.y = 0.9;
    g.add(back);
    for (const ly of [0.1, 0.65, 1.2, 1.75]) {
      const plank = box(w, 0.05, 0.55, 0xe0d8c8);
      plank.position.set(0, ly, 0.22);
      g.add(plank);
      if (ly > 1.7) continue;
      for (let k = 0; k < Math.floor(w / 0.32); k++) {
        const c = palette[Math.floor(rand(0, palette.length))];
        const tall = rand(0.18, 0.38);
        const it = rand(0, 1) < 0.5 ? box(0.24, tall, 0.2, c) : cyl(0.1, 0.1, tall, 7, c);
        it.position.set(-w / 2 + 0.2 + k * 0.32, ly + 0.03 + tall / 2, 0.24);
        g.add(it);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }
  function counterTop(x, z, w, d, color = 0xfaf6ec, top = 0x6a5a4a) {
    const c = box(w, 1.0, d, color);
    c.position.set(x, 0.5, z);
    const t = box(w + 0.1, 0.06, d + 0.1, top);
    t.position.set(x, 1.03, z);
    group.add(c, t);
  }
  function tillBox(x, z) {
    const reg = box(0.45, 0.3, 0.35, 0x3a3a3e);
    reg.position.set(x, 1.2, z);
    const scr = box(0.35, 0.22, 0.04, 0x7ad8c8);
    scr.position.set(x, 1.48, z + 0.05);
    scr.rotation.x = -0.3;
    group.add(reg, scr);
  }

  // --------------------------------------------------- Trader Polly's ----
  {
    const B = IN.polly, W0 = 16, D0 = 11;
    room('polly', '🦜 Trader Polly’s', B, {
      w: W0, d: D0, floor: 0xc9a77a, wall: 0xf4ead4,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        // the mural band: parrots and waves, hand-painted by the crew
        const mural = sign(['🦜 TRADER POLLY’S 🦜', 'a neighborhood grocery · crew-owned · no bell'], { w: 12, h: 1.2, d: 0.05, bg: '#3fb8a8', fg: '#fff4dc' });
        mural.position.set(B.x, 2.9, Z(-5.32));
        group.add(mural);
        // three aisles, back to back
        for (const lx of [-4.5, 0, 4.5]) {
          shelfUnit(X(lx), Z(-1.6), 0, 3.2);
          shelfUnit(X(lx), Z(-1.9), Math.PI, 3.2);
          bl.push({ x: X(lx), z: Z(-1.75), w: 3.3, d: 1.3 });
          const tag = sign(lx < 0 ? '종 빼고 다 있는 양념 — 재입고' : lx > 0 ? '쿠키 버터 · 꿈의 통로' : '망고(건조) · 노 코멘트', { w: 3.0, h: 0.35, d: 0.03, bg: '#fff4dc', fg: '#c0392b' });
          tag.position.set(X(lx), 2.2, Z(-1.75));
          group.add(tag);
        }
        shelfUnit(X(-4.5), Z(-5.1), 0, 5);
        shelfUnit(X(3.5), Z(-5.1), 0, 5);
        bl.push({ x: X(-4.5), z: Z(-5.0), w: 5, d: 0.7 }, { x: X(3.5), z: Z(-5.0), w: 5, d: 0.7 });
        // the till, by the door, and Pico
        counterTop(X(-4.8), Z(3.0), 2.6, 0.9);
        tillBox(X(-4.3), Z(3.0));
        bl.push({ x: X(-4.8), z: Z(3.0), w: 2.6, d: 0.9 });
        const pico = folk('parrot', { body: 0x7ad85a, head: 0xf2e05b, wing: 0x3a9a4a, tail: 0x3a7dd8, face: 0xf2e05b }, X(-4.8), 0, Z(2.2), Math.PI, { scale: 0.75, floral: ['#c0392b', '#f2cf5b', '#ffffff'], fidget: true });
        pico.rotation.y = 0;
        pico.position.z = Z(2.0);
        attend(pico, 'polly');
        // shoppers, working the aisles
        for (const [c, lx, lz] of [[{ body: 0xe0c8a0, humps: 1 }, 7, -0.2], [{ body: 0x3a9ad8, head: 0x3a9ad8, wing: 0xf2cf5b, tail: 0xd8342c }, -7, -3.5]]) {
          const shopper = folk(c.humps ? 'camel' : 'parrot', c, X(lx), 0, Z(lz), 0, c.humps ? { shirt: 0xd8b8c8 } : {});
          wanderer(shopper, 'polly', { x0: X(-7.4), x1: X(7.4), z0: Z(-4.2), z1: Z(1.2) });
        }
        // the Captain, by the flowers, in the shirt
        const mango = folk('parrot', { body: 0xd8342c, head: 0xd8342c, wing: 0x2a6fd0, tail: 0xf2cf5b }, X(3.2), 0, Z(2.2), -0.4, { floral: ['#3fb8a8', '#f2cf5b', '#f28fb0', '#ffffff'], fidget: true });
        wanderer(mango, 'polly', { x0: X(-7.4), x1: X(7.4), z0: Z(-4.2), z1: Z(1.4) }, { speed: 0.8, pause: [3, 7] }); // the Captain walks the deck
        // flower buckets by the door
        for (let k = 0; k < 5; k++) {
          const bucket = cyl(0.26, 0.22, 0.45, 8, 0x9aa0a6);
          bucket.position.set(X(4.6 + (k % 3) * 0.6), 0.22, Z(3.6 - Math.floor(k / 3) * 0.6));
          group.add(bucket);
          for (let f = 0; f < 5; f++) {
            const bloom = ball(0.09, [0xf28fb0, 0xf2cf5b, 0xffffff, 0xd8342c, 0xb89ad8][(k + f) % 5]);
            bloom.position.set(bucket.position.x + Math.cos(f * 1.3) * 0.13, 0.6 + (f % 2) * 0.1, bucket.position.z + Math.sin(f * 1.3) * 0.13);
            group.add(bloom);
          }
        }
        bl.push({ x: X(5.2), z: Z(3.3), w: 1.9, d: 1.2 });
        // the bell mount, on the wall by the till. there is no bell on it.
        const bracket = box(0.5, 0.08, 0.3, 0xb08d3a);
        bracket.position.set(X(-7.8), 2.2, Z(2.2));
        const hook = cyl(0.03, 0.03, 0.25, 5, 0xb08d3a);
        hook.position.set(X(-7.65), 2.05, Z(2.2));
        group.add(bracket, hook);
        const card = sign(['이렇게 말해 주세요', '“띠이잉”'], { w: 0.7, h: 0.45, d: 0.03, bg: '#fff4dc', fg: '#c0392b' });
        card.position.set(X(-7.83), 1.7, Z(2.2));
        card.rotation.y = Math.PI / 2;
        group.add(card);
        things.push({ pos: new THREE.Vector3(X(-7.1), 0, Z(2.2)), r: 1.2, label: '종 걸이 보기',
          use: () => ui.say([
            '닦아서 번쩍이는 황동 거치대, 배의 종을 걸 수 있는 고리 달린. 고리에는 종이 없어요. 한 번도 종이 걸린 적이 없어요.',
            '그 아래 카드: 이렇게 말해 주세요 “띠이잉”.',
          ]) });
        // the sample station
        counterTop(X(0), Z(2.2), 1.2, 0.7, 0xc0392b, 0xfaf6ec);
        for (let k = 0; k < 4; k++) {
          const cup = cyl(0.05, 0.04, 0.08, 6, 0xffffff);
          cup.position.set(X(-0.4 + k * 0.25), 1.1, Z(2.2));
          group.add(cup);
        }
        bl.push({ x: X(0), z: Z(2.2), w: 1.2, d: 0.7 });
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(3.0)), r: 1.2, label: '오늘의 시식 먹어보기',
          use: () => ui.say(nextLine('sample', [
            '오늘의 시식: 프레첼 크리스프 위의 쿠키 버터, 골무만 한 종이컵에. 이번 주에 먹은 것 중 최고예요. 사라졌어요.',
            '오늘의 시식: 깃발이 꽂힌 치즈 한 조각. 깃발에는 치즈라고 적혀 있어요. 맞는 말이에요.',
            '오늘의 시식: 만다린 치킨 한 조각, 이쑤시개에 꽂혀. 너겟이랑 같은 회사 거예요. 아무도 묻지 않아요.',
            '오늘의 시식: 골무에 담긴 커피. 미라지 블렌드예요. 에코가 에코가 그렇게 전해 달랬다고 전해 달래요.',
          ])) });
        // the Fearless Feather, in a rack by the door (free)
        const rack = box(0.6, 1.1, 0.3, 0x3fb8a8);
        rack.position.set(X(-1.8), 0.55, Z(4.6));
        group.add(rack);
        things.push({ pos: new THREE.Vector3(X(-1.8), 0, Z(4.0)), r: 1.1, label: '용감한 깃털 집어가기',
          use: () => {
            if (S.countItem('fearless_feather') > 0) return ui.say('이미 이 호를 갖고 있어요. 다음 호는 선장이 종에 대한 답장을 다 쓰면 나와요. 그러니까: 머지않지 않아요.');
            S.addItem('fearless_feather');
            ui.toast('<b>용감한 깃털</b>을 집었어요. 공짜예요. 공짜인 것들은 조금씩 겁이 없거든요.', '📰');
          } });
        bl.push({ x: X(-1.8), z: Z(4.6), w: 0.6, d: 0.3 });
        const goods = [
          { id: 'ebtb_seasoning', price: 4, say: ['종 빼고 다 있는 양념! 띠이잉! — 미안. 종 빼고 다 있는 양념 하나요.', '다 들었어요. 참깨, 양귀비씨, 마늘, 양파, 소금. 종만 빼고. 종만 유일하게 안 들었거든요.'] },
          { id: 'cookie_butter', price: 5, say: '쿠키 버터! 띠이잉! 이건 “좋은 선택” 띠이잉이에요. 띠이잉에도 종류가 있거든요. 방금 건 좋은 거였어요.' },
          { id: 'two_button_chuck', price: 2, say: '투 버튼 척! 버튼 두 개! 그렇게 적혀 있어요! 띠이잉!' },
          { id: 'dried_mango', price: 6, say: '건망고. … 띠이잉. (조용히 했다고 선장한테는 비밀이에요. 망고에 예민하거든요.)' },
        ];
        things.push({ getPos: () => pico.position, r: 2.0, label: '피코에게 계산하기',
          use: async () => {
            await ui.say(nextLine('pico', PICO), { speaker: 'Pico', voice: VOICE.pico });
            await till('피코', 'pico', '종이로 할까요, 종이로 할까요? (종이예요.) 뭘 고르셨나요?', goods);
          } });
        things.push(talkThing(() => mango.position, 'mango', '망고 선장', MANGO));
      },
    });
  }

  // ------------------------------------------------------- Dromedeals ----
  {
    const B = IN.drom, W0 = 16, D0 = 11;
    room('drom', '🐪 Dromedeals', B, {
      w: W0, d: D0, floor: 0xd8d4cc, wall: 0xf6f2ec,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        const banner = sign(['드로밀즈', '브랜드 네임 · 혹 하나든 둘이든 · 비교가: 모든 것'], { w: 10, h: 1.1, d: 0.05, bg: '#ffffff', fg: '#a8232d' });
        banner.position.set(B.x, 2.9, Z(-5.32));
        group.add(banner);
        // clothing racks, arranged by nothing (this is the treasure hunt)
        const rackSpots = [[-5.2, -2.6, 0.2], [-2.4, -3.2, -0.3], [-4.6, 0.2, 1.3], [-1.6, -0.4, 0.5], [0.8, -2.8, -0.1]];
        for (const [lx, lz, ry] of rackSpots) {
          const r = new THREE.Group();
          const bar = cyl(0.03, 0.03, 1.9, 5, 0x9aa0a6);
          bar.rotation.z = Math.PI / 2;
          bar.position.y = 1.45;
          r.add(bar);
          for (const sx of [-0.9, 0.9]) {
            const leg = cyl(0.03, 0.03, 1.45, 5, 0x9aa0a6);
            leg.position.set(sx, 0.72, 0);
            r.add(leg);
          }
          for (let k = 0; k < 8; k++) {
            const shirt = box(0.08, 0.7, 0.5, [0xa8232d, 0x3a7dd8, 0xf2cf5b, 0xf6f2ec, 0x5cbf4a, 0xb89ad8, 0x2a2a2e][Math.floor(rand(0, 7))]);
            shirt.position.set(-0.8 + k * 0.23, 1.05, 0);
            r.add(shirt);
          }
          r.position.set(X(lx), 0, Z(lz));
          r.rotation.y = ry;
          group.add(r);
          bl.push({ x: X(lx), z: Z(lz), w: 2.0, d: 0.7, rot: ry });
        }
        // home goods, along the east: pineapples, candles, signs, a lamp
        shelfUnit(X(5.2), Z(-2.0), -Math.PI / 2, 4.2, [0xd9b24a, 0xf6f2ec, 0xa8232d, 0x8c7f72]);
        bl.push({ x: X(5.2), z: Z(-2.0), w: 0.7, d: 4.2 });
        // the pineapple table (they come in every shipment; nobody orders them)
        table(X(3.4), Z(2.2), 1.4, 1.0, 0xf6f2ec);
        bl.push({ x: X(3.4), z: Z(2.2), w: 1.5, d: 1.1 });
        for (let k = 0; k < 6; k++) {
          const pine = ball(0.14, 0xd9b24a);
          pine.scale.y = 1.4;
          pine.position.set(X(2.9 + (k % 3) * 0.5), 0.98, Z(1.95 + Math.floor(k / 3) * 0.5));
          const crown = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 5), mat(0x3f9a45));
          crown.position.set(pine.position.x, 1.26, pine.position.z);
          group.add(pine, crown);
        }
        const clear = sign(['재고 정리', '비교가: 더 비쌈'], { w: 2.2, h: 0.7, d: 0.05, bg: '#a8232d', fg: '#ffffff' });
        clear.position.set(X(5.9), 2.35, Z(-2.0));
        clear.rotation.y = -Math.PI / 2;
        group.add(clear);
        // the register, and Deb, glasses on a chain
        counterTop(X(-5.2), Z(3.2), 3.0, 0.9);
        tillBox(X(-4.6), Z(3.2));
        bl.push({ x: X(-5.2), z: Z(3.2), w: 3.0, d: 0.9 });
        const deb = folk('camel', { body: CAMEL, humps: 2 }, X(-5.2), 0, Z(2.2), 0, { shirt: 0xa8232d, glasses: true, fidget: true });
        // shoppers, treasure-hunting
        const s1 = folk('camel', { body: 0xe0c8a0, humps: 1 }, X(-3.2), 0, Z(-1.4), 2.4, { visor: 0xffffff, shirt: 0x9ad8c8 });
        const s2 = folk('parrot', { body: 0xf2cf5b, head: 0xf2cf5b, wing: 0x3a7dd8, tail: 0xd8342c }, X(2.6), 0, Z(-0.8), -0.8, {});
        attend(deb, 'drom');
        wanderer(s1, 'drom', { x0: X(-7.4), x1: X(7.2), z0: Z(-4.4), z1: Z(2.6) }, { speed: 0.7, pause: [3, 8] });
        wanderer(s2, 'drom', { x0: X(-7.4), x1: X(7.2), z0: Z(-4.4), z1: Z(2.6) }, { speed: 0.9, pause: [2, 6] });
        things.push({ getPos: () => s1.position, r: 1.8, label: '쇼핑객에게 말 걸기',
          use: () => ui.say('램프 사러 왔는데, 세라믹 파인애플이랑 모래 냄새 양초랑, 램프는 애초에 목적이 아니었다는 깨달음을 갖고 나가요.', { speaker: '쇼핑객', voice: 420 }) });
        things.push({ getPos: () => s2.position, r: 1.8, label: '다른 쇼핑객에게 말 걸기',
          use: () => ui.say('쉿. 몰입 중이에요. 이 진열대 어딘가에 디자이너 바이저가 있어. 느껴져요.', { speaker: '다른 쇼핑객', voice: 640 }) });
        things.push({ pos: new THREE.Vector3(X(-1.0), 0, Z(-1.8)), r: 1.4, priority: 0, label: '진열대 뒤지기',
          use: () => ui.say(nextLine('rummage', [
            'You rummage. A sweater with one sleeve longer than the other. COMPARE AT: 300🔘. You put it back. You think about it for the rest of the day.',
            '뒤적여요. 그이 거라고 적힌 목욕 가운. 그녀 건 없어요. 그녀 건 어딘가, 다른 드로밀즈에서, 이걸 찾고 있을 거예요.',
            '뒤적여요. 파인애플 모양 선글라스. 그 옆에는 선글라스 낀 세라믹 파인애플. 이 가게는 자기 자신과 대화를 나누고 있어요.',
            '뒤적여요. “모래는 일어나요”라고 적힌 쿠션. “살고 웃고 쉬고”라고 적힌 쿠션. 그냥 “쿠션”이라고만 적힌 쿠션. 마지막 게 제일 존경스러워요.',
            '뒤적여요. 완벽하고 빳빳한 하얀 디자이너 바이저 하나. 누구한테 보여 주려고 돌아섰다가 다시 보니, 몰 워커가 가져갔어요. 그게 드로밀이에요.',
          ])) });
        const goods = [
          { hat: 'tennis_visor', label: `${ITEMS.tennis_visor.name} (cmp. 900)`, emoji: ITEMS.tennis_visor.emoji, price: 30,
            say: ['테니스 바이저. 비교가 900. 30에 드려요. 방금 870 버튼을 아낀 거예요, 허니. 그건 사실상 버는 거예요.', '(H를 눌러 쓰세요. 이제 당신도 드로밀리스타예요.)'] },
          { id: 'live_laugh_lounge', label: `${ITEMS.live_laugh_lounge.name} (cmp. 240)`, price: 12, say: '아, 그건 클래식이죠. 서클의 모든 집에 하나씩 있어요. 같은 자리. 같은 못. 소속감이란 좋은 거예요.' },
          { id: 'ceramic_pineapple', label: `${ITEMS.ceramic_pineapple.name} (cmp. 180)`, price: 9, say: '파인애플들. 매 배송마다 들어와요. 매번. 전 파인애플을 한 번도 주문한 적 없는데. 가져가요, 허니. 두 개 가져가요. 제발.' },
          { id: 'candle_sand', label: `${ITEMS.candle_sand.name} (cmp. 90)`, price: 5, say: '향: 모래. 정확히 모래 냄새예요. 최고 인기 상품이에요. 여기 사람들 아무도 사막에 가 본 적 없어요. 다들 사막이 그리워해요.' },
        ];
        things.push({ getPos: () => deb.position, r: 2.2, label: '뎁에게 말 걸기',
          use: async () => {
            await ui.say(nextLine('deb', DEB), { speaker: 'Deb', voice: VOICE.deb });
            await till('뎁', 'deb', '뭐 찾으셨어요, 허니? 아니면 뭐가 당신을 찾았나요?', goods);
          } });
      },
    });
  }

  // ---------------------------------------------------- Mirage Coffee ----
  {
    const B = IN.mirage, W0 = 12, D0 = 9;
    room('mirage', '☕ Mirage Coffee', B, {
      w: W0, d: D0, floor: 0x8a6a4a, wall: 0xe8e0cc,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        // the menu board, big and green, with more words than a menu needs
        const menu = sign(['MIRAGE · coffee, probably', 'SHAKEN ESPRESSO · SANDSTORM FRAPPÉ', seasonalName() + ' · JUST A COFFEE (?)', 'SIZES: SMALL · MEDIUM · DUNE'], { w: 6.5, h: 1.9, d: 0.05, bg: '#2f5f50', fg: '#f4efe2' });
        menu.position.set(X(-0.5), 2.6, Z(-4.32));
        group.add(menu);
        // the bar: counter, espresso machine, the pastry case, the handoff
        counterTop(X(-0.5), Z(-2.2), 6.5, 0.9, 0x2f5f50, 0xe8e0cc);
        bl.push({ x: X(-0.5), z: Z(-2.2), w: 6.5, d: 0.9 });
        const machine = box(1.1, 0.6, 0.5, 0xc8ccd0);
        machine.position.set(X(-2.2), 1.36, Z(-2.3));
        group.add(machine);
        for (const sx of [-0.3, 0.3]) {
          const spout = cyl(0.05, 0.05, 0.2, 5, 0x3a3a3e);
          spout.position.set(X(-2.2 + sx), 1.0 + 0.1, Z(-2.0));
          group.add(spout);
        }
        const pcase = box(1.6, 0.5, 0.7, 0xbfe6f2);
        pcase.material = new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.55, roughness: 0.2 });
        pcase.position.set(X(1.6), 1.3, Z(-2.2));
        group.add(pcase);
        for (let k = 0; k < 5; k++) {
          const pastry = ball(0.12, [0xd9a45a, 0xc9905a, 0xf2e0b0][k % 3]);
          pastry.scale.y = 0.6;
          pastry.position.set(X(1.0 + k * 0.28), 1.15, Z(-2.2));
          group.add(pastry);
        }
        for (let k = 0; k < 6; k++) {
          const cup = cyl(0.09, 0.07, 0.3, 7, 0xf6f2ec);
          cup.position.set(X(2.6 + (k % 3) * 0.22), 1.2, Z(-2.0 + Math.floor(k / 3) * 0.22));
          group.add(cup);
          const straw = cyl(0.015, 0.015, 0.3, 4, 0x2f8a5a);
          straw.position.set(cup.position.x, 1.45, cup.position.z);
          group.add(straw);
        }
        const echo = folk('parrot', { body: 0x9aa0a8, head: 0x9aa0a8, wing: 0x7a8088, tail: 0xc8342c }, X(-0.8), 0, Z(-3.2), 0, { apron: 0x2f5f50, fidget: true });
        attend(echo, 'mirage');
        {
          const regular = folk('parrot', { body: 0x5cbf4a, head: 0x5cbf4a, wing: 0xf2cf5b, tail: 0xd8342c }, X(1.0), 0, Z(0.5), 0, { shirt: 0x6a5a8a });
          wanderer(regular, 'mirage', { x0: X(-5.2), x1: X(5.2), z0: Z(-1.2), z1: Z(3.8) }, { speed: 0.8, pause: [3, 8] });
        }
        // tables: a laptop camel "working remotely"; a quiet corner
        table(X(-3.8), Z(1.4), 1.1, 0.8, 0x3a3a3e);
        chair(X(-3.8), Z(2.1), Math.PI, 0x3a3a3e);
        const laptop = box(0.5, 0.03, 0.35, 0x9aa0a6);
        laptop.position.set(X(-3.8), 0.8, Z(1.4));
        const lid = box(0.5, 0.35, 0.03, 0x9aa0a6);
        lid.position.set(X(-3.8), 0.97, Z(1.2));
        group.add(laptop, lid);
        const remote = folk('camel', { body: 0xe0c8a0, humps: 1 }, X(-3.8), 0.2, Z(2.2), Math.PI, { shirt: 0x6a7a8a, scale: 0.9 });
        bl.push({ x: X(-3.8), z: Z(1.7), w: 1.2, d: 1.6 });
        things.push({ getPos: () => remote.position, r: 1.8, label: '노트북 든 낙타에게 말 걸기',
          use: () => ui.say(nextLine('remote', [
            '아 — 죄송, 통화 중이라. … 아니 괜찮아요, 음소거예요. 항상 음소거예요. 봄부터 음소거였어요.',
            '재택근무해요. 여기서. 매일. 가 본 적 없는 어느 섬의 회사에서. 연구소 같은데? 연구소일 수도 있어요.',
            '이게 네 번째 셰이큰 에스프레소예요. 저는 안 떨려요. 에스프레소가 떨리는 거예요. 그게 브랜드예요.',
          ]), { speaker: 'Skyler', voice: 360 }) });
        for (const [lx, lz] of [[3.4, 1.2], [3.4, 3.0]]) {
          table(X(lx), Z(lz), 0.9, 0.9, 0x3a3a3e);
          chair(X(lx - 0.8), Z(lz), Math.PI / 2, 0x3a3a3e);
          chair(X(lx + 0.8), Z(lz), -Math.PI / 2, 0x3a3a3e);
          bl.push({ x: X(lx), z: Z(lz), w: 2.2, d: 1.0 });
        }
        plant(X(-5.3), Z(3.6));
        bl.push({ x: X(-5.3), z: Z(3.6), r: 0.35 });
        const drinks = [
          { label: '아이스 흑설탕 오트 셰이큰 에스프레소', emoji: '🧋', price: 8, secs: 60,
            say: () => ['아이스 흑설탕 오트 밀크 셰이큰 에스프레소 하나요. 흔들고. 또 흔들고. 행운을 빌어 세 번째 흔들고. 컵에 적을 이름이 뭐예요?', ...cupName()] },
          { label: 'Double Caramel Sandstorm Frappé', emoji: '🥤', price: 9, secs: 45,
            say: () => ['더블 카라멜 샌드스톰 프라페 하나요, 블렌디드, 휘핑 올리고, 카라멜 드리즐 뿌리고, 그 카라멜 드리즐 위에 카라멜 드리즐 또 뿌리고, 듄 사이즈로. 컵에 적을 이름이요?', ...cupName()] },
          { label: seasonalName(), emoji: '☕', price: 7, secs: 50,
            say: () => [`${seasonalName()} 하나요. 돌아왔어요. 떠난 적 없지만요. 시즌이 그것이고 그것이 시즌이거든요. 이름이요?`, ...cupName()] },
          { label: '그냥 커피', emoji: '☕', price: 3, secs: 30,
            say: () => ['그냥… 커피요. 그냥 커피. … 네. 네! 할 수 있어요. 할 수 있을 것 같아요. 잠깐만요.', '(11분 걸려요. 완벽해요. 에코가 떨려 보이는데, 여기선 칭찬이에요.)', ...cupName()] },
        ].map((d) => ({ ...d, then: () => { S.drinkCoffee(d.secs); sip(); } }));
        things.push({ getPos: () => echo.position, r: 2.6, label: '에코에게 주문하기',
          use: async () => {
            await ui.say(nextLine('echo', ECHO), { speaker: 'Echo', voice: VOICE.echo });
            await till('에코', 'echo', '뭘 준비해 드릴까요? 뭘 준비해 드릴까요?', drinks);
          } });
      },
    });
  }
  function seasonalName() {
    const now = new Date().getMonth();
    return now >= 8 && now <= 10 ? '펌킨 스파이스 라떼' : now >= 2 && now <= 4 ? '블로썸 스파이스 라떼' : now >= 5 && now <= 7 ? '아이스 선크림 스파이스 라떼' : '프로스트 스파이스 라떼';
  }
  // Echo spells your name the way it sounded
  function cupName() {
    const n = (S.state.name || '친구').trim() || '친구';
    const tries = [
      (x) => x.replace(/y$/i, 'ee'),
      (x) => x.replace(/[aeiou]/i, (m) => m + m),
      (x) => x.replace(/s/i, 'z'),
      (x) => x.replace(/c/i, 'k'),
      (x) => x + 'h',
    ];
    let odd = n;
    for (const f of tries) { odd = f(n); if (odd !== n) break; }
    S.addItem('mirage_cup');
    return [`(컵에는 “${odd}”라고 적혀 있어요. 비슷해요. 대부분보다 비슷해요.)`];
  }

  // ------------------------------------------------------ Cluck & Co. ----
  {
    const B = IN.cluck, W0 = 12, D0 = 9;
    room('cluck', '🍗 Cluck & Co.', B, {
      w: W0, d: D0, floor: 0xe8dcc8, wall: 0xfaf4ec,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        const menu = sign(['클럭 앤 코', '너겟 · 그 샌드위치 · 와플 프라이 · 레모네이드', '닭고기 아님 · 기쁘게 모심 · 일요일 휴무'], { w: 7, h: 1.5, d: 0.05, bg: '#c8342c', fg: '#ffffff' });
        menu.position.set(X(0), 2.7, Z(-4.32));
        group.add(menu);
        counterTop(X(0), Z(-2.3), 6.5, 0.9, 0xc8342c, 0xfaf6ec);
        bl.push({ x: X(0), z: Z(-2.3), w: 6.5, d: 0.9 });
        for (const lx of [-2, 0, 2]) tillBox(X(lx), Z(-2.3));
        const tanner = folk('camel', { body: CAMEL, humps: 1 }, X(0), 0, Z(-3.3), 0, { cap: 0xc8342c, apron: 0xffffff, fidget: true });
        attend(tanner, 'cluck');
        {
          const hungry = folk('camel', { body: CAMEL_DK, humps: 2 }, X(1.5), 0, Z(1.0), 0, { cap: 0x3a7dd8 });
          wanderer(hungry, 'cluck', { x0: X(-5.2), x1: X(3.0), z0: Z(-1.2), z1: Z(3.8) }, { speed: 0.8, pause: [3, 7] });
          const kid = folk('parrot', { body: 0xf2cf5b, head: 0xf2cf5b, wing: 0x3a7dd8, tail: 0xd8342c }, X(4.3), 0.25, Z(2.6), 0.4, { scale: 0.5 });
          (inside.cluck ??= []).push((dt, t) => { kid.position.y = 0.25 + Math.abs(Math.sin(t * 3.1)) * 0.35; kid.rotation.y += dt * 0.8; }); // the ball pit: bouncing
        }
        // booths, red, along the west wall
        for (const lz of [-0.4, 2.0]) {
          table(X(-4.4), Z(lz), 1.2, 0.9, 0xfaf6ec);
          for (const sz of [-0.8, 0.8]) {
            const seat = box(1.3, 0.5, 0.5, 0xc8342c);
            seat.position.set(X(-4.4), 0.25, Z(lz + sz));
            const back = box(1.3, 0.7, 0.15, 0xc8342c);
            back.position.set(X(-4.4), 0.7, Z(lz + sz * 1.3));
            group.add(seat, back);
          }
          bl.push({ x: X(-4.4), z: Z(lz), w: 1.4, d: 2.3 });
        }
        // the PlayPlace, in the corner: a tiny slide and a ball pit
        const pit = box(2.0, 0.4, 2.0, 0x3a7dd8);
        pit.position.set(X(4.3), 0.2, Z(2.6));
        group.add(pit);
        for (let k = 0; k < 18; k++) {
          const b = ball(0.12, [0xd8342c, 0xf2cf5b, 0x3a7dd8, 0x5cbf4a][k % 4]);
          b.position.set(X(3.5 + (k % 6) * 0.3), 0.45, Z(1.9 + Math.floor(k / 6) * 0.5));
          group.add(b);
        }
        bl.push({ x: X(4.3), z: Z(2.6), w: 2.0, d: 2.0 });
        things.push({ pos: new THREE.Vector3(X(4.3), 0, Z(1.2)), r: 1.3, label: '볼 풀장 보기',
          use: () => ui.say('안내판: “플레이플레이스 — 3세~7세.” 그 아래 더 작은, 더 새 것 같은, 베벌리 글씨의 안내판: “그리고 게리 금지.”') });
        const goods = [
          { id: 'cluck_nuggets', price: 6, say: '너겟 여덟 개요! 클럭 소스 세 개 포함! 기쁩니다!', then: () => { S.addItem('cluck_sauce'); } },
          { id: 'waffle_fries', price: 4, say: '와플 프라이요! 기쁩니다! 감자가 될 수 있는 최고의 모양이거든요. 감자가 알려 줬어요. 본인도 기쁘대요.' },
          { label: '레모네이드(여기서 마시기)', emoji: '🍋', price: 3, say: '레모네이드 하나요! 기쁩니다! 생짜! 제가 짰어요! 제 기쁨이 — 네. 아시죠.', then: () => { S.drinkCoffee(20); sip(); } },
        ];
        things.push({ getPos: () => tanner.position, r: 2.6, label: '태너에게 주문하기',
          use: async () => {
            await ui.say(nextLine('tanner', TANNER), { speaker: '태너', voice: VOICE.tanner });
            const c = await ui.ask('오늘 어떻게 모실까요?', [
              { label: '🍗 주문하기', value: 'order' },
              { label: '🙏 “감사합니다!”', value: 'thanks' },
              { label: '나가기', value: null },
            ], { speaker: '태너', voice: VOICE.tanner });
            if (c === 'order') await till('태너', 'tanner', '기쁘게 모시겠습니다. 뭘로 하시겠어요?', goods);
            if (c === 'thanks') {
              const k = (said.cluckThanks = (said.cluckThanks ?? 0) + 1);
              await ui.say(k === 1 ? '기쁩니다!' : k === 2 ? '기뻐요.' : k === 3 ? '…정말로요.' : '그래요. 정말, 정말로요.', { speaker: '태너', voice: VOICE.tanner });
            }
          } });
      },
    });
  }

  // ======================================================== the CaMall ----
  // One long bright hall. A fountain in the middle (wishes: one button), the
  // food court west, the stores along the back — Sahara, Hot Tropic (closed;
  // it's always closed), Sunglass Hump, SPACE AVAILABLE — an escalator to a
  // second floor there isn't, a lotion kiosk, a bronto on a segway, and the
  // mall walkers, going round, since seven.
  {
    const B = IN.mall, W0 = 30, D0 = 20;
    room('mall', '🛍️ The CaMall', B, {
      w: W0, d: D0, wallH: 5, floor: 0xf0e8dc, wall: 0xf6e3d8,
      lighting: { ...SUBURB_LIGHT, bg: 0x3a4a48, fog: 0x3a4a48, hemiSky: 0xffffff, hemiGround: 0x9aa8a0, hemiIntensity: 2.0, fogFar: 80 },
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        const FT = { x: 0, z: -0.8 };
        // floor inlay: a teal ring around the fountain court
        const inlayGeo = new THREE.RingGeometry(3.2, 3.6, 24);
        inlayGeo.rotateX(-Math.PI / 2);
        const inlay = new THREE.Mesh(inlayGeo, mat(0x3fb8a8));
        inlay.position.set(X(FT.x), 0.02, Z(FT.z));
        group.add(inlay);
        // the fountain: a basin, water, a spout, arcs of water that fall back
        const basin = cyl(2.1, 2.2, 0.6, 14, 0xe8dcc8);
        basin.position.set(X(FT.x), 0.3, Z(FT.z));
        const water = cyl(1.9, 1.9, 0.08, 14, 0x49c6e0);
        water.material = new THREE.MeshStandardMaterial({ color: 0x49c6e0, roughness: 0.2, transparent: true, opacity: 0.85, flatShading: true });
        water.position.set(X(FT.x), 0.64, Z(FT.z)); // (sits above the basin's rim cap — they used to fight over the same height)
        const spout = cyl(0.25, 0.35, 1.4, 8, 0xe8dcc8);
        spout.position.set(X(FT.x), 1.0, Z(FT.z));
        const bowl = cyl(0.7, 0.3, 0.25, 10, 0xe8dcc8);
        bowl.position.set(X(FT.x), 1.8, Z(FT.z));
        group.add(basin, water, spout, bowl);
        const jets = [];
        const jetMat = new THREE.MeshBasicMaterial({ color: 0xcfeefa, transparent: true, opacity: 0.8 });
        for (let k = 0; k < 24; k++) {
          const dr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), jetMat);
          group.add(dr);
          jets.push(dr);
        }
        // buttons on the bottom of the fountain, a little glint of wishes
        for (let k = 0; k < 14; k++) {
          const b = cyl(0.06, 0.06, 0.02, 8, [0xd9b24a, 0x9aa0a6, 0xc98f5a][k % 3]);
          const a = rand(0, Math.PI * 2), r = rand(0.9, 1.7);
          b.position.set(X(FT.x) + Math.cos(a) * r, 0.62, Z(FT.z) + Math.sin(a) * r);
          group.add(b);
        }
        bl.push({ x: X(FT.x), z: Z(FT.z), r: 2.3 });
        (inside.mall ??= []).push((dt, t) => {
          jets.forEach((dr, k) => {
            const a = (k / jets.length) * Math.PI * 2;
            const ph = (t * 0.7 + (k % 4) / 4) % 1;
            dr.position.set(X(FT.x) + Math.cos(a) * ph * 1.3, 1.9 + ph * 1.2 - ph * ph * 2.1, Z(FT.z) + Math.sin(a) * ph * 1.3);
          });
        });
        things.push({ pos: new THREE.Vector3(X(FT.x), 0, Z(FT.z + 2.7)), r: 1.6, label: '분수에 버튼 던지기',
          use: async () => {
            if (S.state.buttons < 1) return ui.say('주머니를 더듬어요. 버튼이 하나도 없어요. 그래도 소원을 빌어요. 유효해요, 다만 딸랑거리지 않을 뿐.');
            S.spend(1);
            ui.updateHUD();
            tone(880, { dur: 0.08, type: 'sine', vol: 0.03 });
            tone(660, { time: 0.12, dur: 0.12, type: 'sine', vol: 0.02 });
            await ui.say(nextLine('wish', [
              '풍덩. 버튼이 다른 것들 사이에 자리 잡아요. 어딘가에서, 아주 조용히, 소원 하나가 접수돼요. 3부로. 여긴 여전히 오아시스 에스테이츠니까요.',
              '풍덩. 소원을 빌어요. 분수가 간직해요. 분수는 비밀에 강해요. 딱 알맞은 방식으로 시끄럽거든요.',
              '풍덩. 서른한 바퀴째 지나가던 밀드레드가, 걸음을 늦추지도 않고: “잘 빌었어, 얘야.”',
              '풍덩. 페리가 승인되기를 빌어요. 분수가 작은 소리를 내는데, 잠시 누군가 “검토 중”이라고 말하는 것처럼 들려요.',
            ]));
          } });
        // benches round the court, and potted palms
        for (const [lx, lz, ry] of [[-3.8, -0.8, Math.PI / 2], [3.8, -0.8, -Math.PI / 2]]) {
          const g = new THREE.Group();
          const seat = box(1.6, 0.1, 0.5, 0x8a6a4a);
          seat.position.y = 0.45;
          const back = box(1.6, 0.45, 0.08, 0x8a6a4a);
          back.position.set(0, 0.72, -0.22);
          const legs = box(1.4, 0.4, 0.3, 0x3a3a3e);
          legs.position.y = 0.2;
          g.add(seat, back, legs);
          g.position.set(X(lx), 0, Z(lz));
          g.rotation.y = ry;
          group.add(g);
          bl.push({ x: X(lx), z: Z(lz), w: 0.55, d: 1.6 });
        }
        for (const [lx, lz] of [[-9, -6.2], [9, -6.2], [-9, 8.8], [9, 8.8]]) {
          plant(X(lx), Z(lz), 1.5);
          bl.push({ x: X(lx), z: Z(lz), r: 0.45 });
        }
        // ------------------------------------------- the back row of stores
        const backZ = -D0 / 2 + 0.15;
        function storefront(x0, x1, depth, fascia, { open = false, grille = false, papered = false, floorC = 0xf0e8dc } = {}) {
          const w = x1 - x0, cx = (x0 + x1) / 2, front = backZ + depth;
          for (const lx of [x0, x1]) {
            const side = box(0.25, 4.2, depth, 0xe8dcc8);
            side.position.set(X(lx), 2.1, Z(backZ + depth / 2));
            group.add(side);
            bl.push({ x: X(lx), z: Z(backZ + depth / 2), w: 0.3, d: depth });
          }
          const fl = box(w - 0.2, 0.03, depth, floorC);
          fl.position.set(X(cx), 0.02, Z(backZ + depth / 2));
          group.add(fl);
          const header = box(w + 0.2, 0.9, 0.3, 0xe8dcc8);
          header.position.set(X(cx), 3.75, Z(front));
          group.add(header);
          fascia.position.set(X(cx), 3.75, Z(front) + 0.17);
          group.add(fascia);
          if (!open) {
            // a front: either a grille (closed), or papered-over glass
            const pane = box(w - 0.3, 3.3, 0.1, papered ? 0xf3efe2 : grille ? 0x55555a : 0xbfe6f2);
            pane.position.set(X(cx), 1.65, Z(front));
            if (grille) {
              pane.visible = false;
              for (let gx = x0 + 0.4; gx < x1 - 0.2; gx += 0.35) {
                const bar = box(0.05, 3.3, 0.05, 0x8a8e92);
                bar.position.set(X(gx), 1.65, Z(front));
                group.add(bar);
              }
            }
            group.add(pane);
            bl.push({ x: X(cx), z: Z(front), w: w - 0.2, d: 0.3 });
          }
          return { cx, front };
        }
        // SAHARA: black and white stripes, very serious, open
        const sah = storefront(-12.5, -4.5, 4.4, sign('SAHARA', { w: 7.6, h: 0.8, d: 0.05, bg: '#ffffff', fg: '#111111', stripes: '#111111' }), { open: true, floorC: 0x2a2a2e });
        for (const lz of [backZ + 0.35]) {
          shelfUnit(X(-8.5), Z(lz), 0, 7.2, [0x111111, 0xffffff, 0xe86a9a, 0xd8342c, 0xf2cf5b]);
        }
        for (const [lx, ry] of [[-12.1, Math.PI / 2], [-4.9, -Math.PI / 2]]) {
          shelfUnit(X(lx), Z(backZ + 2.4), ry, 3.0, [0x111111, 0xffffff, 0xe86a9a, 0xb89ad8]);
          bl.push({ x: X(lx + (lx < -8 ? 0.25 : -0.25)), z: Z(backZ + 2.4), w: 0.6, d: 3.0 });
        }
        bl.push({ x: X(-8.5), z: Z(backZ + 0.45), w: 7.2, d: 0.7 });
        counterTop(X(-8.5), Z(backZ + 2.6), 2.6, 0.8, 0x111111, 0xffffff);
        bl.push({ x: X(-8.5), z: Z(backZ + 2.6), w: 2.6, d: 0.8 });
        const paloma = folk('parrot', { body: 0xf28fb0, head: 0xf28fb0, wing: 0xb89ad8, tail: 0x111111, face: 0xffffff }, X(-8.5), 0, Z(backZ + 1.6), 0, { apron: 0x111111, fidget: true });
        attend(paloma, 'mall');
        const sahGoods = [
          { id: 'dune_gloss', price: 8, say: '듄 글로스, 해 질 녘 오아시스 색. 핑크예요. 언제나 핑크. 그게 무드야, 베이브. 이제 당신도 무드야.' },
          { id: 'sand_scrub', price: 6, say: '샌드 스크럽. 성분: 모래. 그게 다예요. 그게 럭셔리예요. 정직이 새로운 각질 제거제야.' },
        ];
        let sprayed = false;
        things.push({ getPos: () => paloma.position, r: 2.4, label: '팔로마에게 말 걸기',
          use: async () => {
            const c = await ui.ask(nextLine('paloma', PALOMA), [
              { label: '💄 Shop', value: 'shop' },
              { label: '🌸 Try a sample', value: 'sample' },
              { label: '나가기', value: null },
            ], { speaker: 'Paloma', voice: VOICE.paloma });
            if (c === 'shop') await till('팔로마', 'paloma', '오늘 어떤 기분이세요?', sahGoods);
            if (c === 'sample') {
              if (!sprayed) {
                sprayed = true;
                await ui.say(['눈 감아요. … 칙.', '오 드 오아시스예요. 톱 노트: 깎은 풀. 하트: 염소. 베이스: 햇볕 속 미니밴.', '계획 커뮤니티 냄새가 나요, 베이브. 잘 어울려요.'], { speaker: '팔로마', voice: VOICE.paloma });
              } else {
                await ui.say('손님당 한 번 칙이에요, 베이브. 베벌리 규칙이에요. 향에 관한 규칙이 많거든요.', { speaker: '팔로마', voice: VOICE.paloma });
              }
            }
          } });
        // HOT TROPIC: behind a grille, dark, a neon sign, closed forever
        storefront(-3.2, 3.2, 3.2, sign('HOT TROPIC', { w: 6.2, h: 0.8, d: 0.05, bg: '#141418', fg: '#ff4fb0' }), { grille: true, floorC: 0x141418 });
        const bag = ball(0.6, 0x7a3ad8, 1);
        bag.scale.y = 0.55;
        bag.position.set(X(0.8), 0.3, Z(backZ + 1.4));
        const lava = cyl(0.12, 0.18, 0.6, 7, 0xff4fb0);
        lava.position.set(X(-1.8), 0.3, Z(backZ + 1.0));
        group.add(bag, lava);
        const cousin = folk('parrot', { body: 0x2a2a30, head: 0x2a2a30, wing: 0xff4fb0, tail: 0xff4fb0 }, X(0.8), 0.35, Z(backZ + 1.4), 0.4, { scale: 0.8 });
        cousin.rotation.x = -0.4;
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(backZ + 3.9)), r: 1.8, label: '핫 트로픽 들여다보기',
          use: () => ui.say([
            '셔터가 내려가 있어요. 항상 내려가 있죠. 그 너머로: 밴드 티셔츠, 라바 램프, 그리고 보라색 빈백에서 자고 있는 십대 앵무새.',
            '셔터에 붙은 손글씨 안내판: “준비되면 오픈함. — 경영진(키위 사촌)”',
            '몰 워커들이 지나가요. 11년째 핫 트로픽 앞을 지나가고 있어요. 한 번도 들어간 적 없어요. 그들도 준비가 안 됐거든요.',
          ]) });
        // SUNGLASS HUMP
        storefront(4.4, 9.2, 3.2, sign('선글라스 험프', { w: 4.8, h: 0.8, d: 0.05, bg: '#f2cf5b', fg: '#2a2a2e' }), { open: true, floorC: 0xe8e0cc });
        for (let k = 0; k < 3; k++) {
          const stand = box(0.5, 1.5, 0.5, 0xfaf6ec);
          stand.position.set(X(5.4 + k * 1.4), 0.75, Z(backZ + 1.2));
          group.add(stand);
          for (let j = 0; j < 3; j++) {
            const lens = box(0.4, 0.12, 0.05, [0x2a2a2e, 0xd8342c, 0x3a7dd8][(k + j) % 3]);
            lens.position.set(X(5.4 + k * 1.4), 0.9 + j * 0.25, Z(backZ + 1.47));
            group.add(lens);
          }
          bl.push({ x: X(5.4 + k * 1.4), z: Z(backZ + 1.2), r: 0.4 });
        }
        things.push({ pos: new THREE.Vector3(X(6.8), 0, Z(backZ + 2.4)), r: 1.5, label: '선글라스 써보기',
          use: () => ui.say(nextLine('shades', [
            '파인애플 모양 선글라스를 써 봐요. 작은 거울 속 당신은 배를 소유한 사람 같아요. 배는 없어요. 도로 놓아요.',
            '에이비에이터 선글라스를 써 봐요. 낙타가 지나가며 고개를 끄덕여요, 경의를 담아, 에이비에이터 소유자에서 에이비에이터 소유자에게로.',
            '제일 큰 선글라스를 써 봐요. 얼굴 대부분을 가려요. 잠시, 몰을 피해 다니는 셀럽이 된 기분이에요. 몰 안에 있으면서요. 양방향으로 통하네요.',
          ])) });
        // SPACE AVAILABLE
        storefront(10.4, 14.6, 3.2, sign('임대 가능', { w: 4.2, h: 0.8, d: 0.05, bg: '#f3efe2', fg: '#8c7f72' }), { papered: true });
        const soon = sign(['오픈 예정:', '핫 웜즈', '(버로 프랜차이즈)', '벌레 무첨가'], { w: 2.4, h: 1.8, d: 0.03, bg: '#fff3d6', fg: '#8a4a2a', border: '#8a4a2a' });
        soon.position.set(X(12.5), 1.8, Z(backZ + 3.3));
        group.add(soon);
        // ---------------------------------------------------- the food court
        for (const [lx, lz] of [[-11, 0.5], [-11, 4.2], [-7.4, 2.4], [-7.4, 6.4]]) {
          table(X(lx), Z(lz), 1.0, 1.0, 0xfaf6ec);
          chair(X(lx - 0.8), Z(lz), Math.PI / 2, 0x3fb8a8);
          chair(X(lx + 0.8), Z(lz), -Math.PI / 2, 0x3fb8a8);
          bl.push({ x: X(lx), z: Z(lz), w: 2.3, d: 1.1 });
        }
        counterTop(X(-14.2), Z(3.2), 1.0, 3.2, 0xd9a45a, 0xfaf6ec);
        bl.push({ x: X(-14.2), z: Z(3.2), w: 1.0, d: 3.2 });
        const auntieSign = sign(['듄 이모네', '소프트 프레첼 · 잔디 이래로'], { w: 3.2, h: 0.8, d: 0.05, bg: '#d9a45a', fg: '#ffffff' });
        auntieSign.position.set(X(-14.8), 3.2, Z(3.2));
        auntieSign.rotation.y = Math.PI / 2;
        group.add(auntieSign);
        for (let k = 0; k < 4; k++) {
          const pz = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 5, 10), mat(0xb87a3a));
          pz.position.set(X(-14.2), 1.2, Z(2.0 + k * 0.7));
          pz.rotation.y = Math.PI / 2;
          group.add(pz);
        }
        const auntie = folk('camel', { body: 0xc8b08a, humps: 2, tuft: 0xf0e8e0 }, X(-14.9), 0, Z(3.2), Math.PI / 2, { apron: 0xd9a45a, fidget: true });
        attend(auntie, 'mall');
        things.push({ getPos: () => auntie.position, r: 2.4, label: '듄 이모에게 말 걸기',
          use: async () => {
            await ui.say(nextLine('auntie', AUNTIE), { speaker: '듄 이모', voice: 300 });
            await till('듄 이모', 'auntie', '프레첼 하나 드릴까, 얘야? 모래 같은 소금.', [
              { id: 'pretzel', price: 3, say: '여기 있어, 얘야. 따뜻해. 걸으면서 먹어. 몰 프레첼은 그렇게 먹어 주길 원하거든.' },
            ]);
          } });
        // ------------------------------------------------ the escalator (up)
        {
          const esc = new THREE.Group();
          const ramp = box(1.4, 0.3, 6.4, 0x9aa0a6);
          ramp.rotation.x = 0.55;
          ramp.position.set(0, 1.75, 0);
          esc.add(ramp);
          for (const sx of [-0.8, 0.8]) {
            const rail = box(0.12, 0.9, 6.6, 0x3a3a3e);
            rail.rotation.x = 0.55;
            rail.position.set(sx, 2.3, 0);
            esc.add(rail);
          }
          for (let k = 0; k < 14; k++) {
            const step = box(1.2, 0.05, 0.35, 0x6a6e72);
            const f = k / 13;
            step.position.set(0, 0.2 + f * 3.4, 2.8 - f * 5.6);
            esc.add(step);
          }
          esc.position.set(X(13.2), 0, Z(4.0));
          group.add(esc);
          bl.push({ x: X(13.2), z: Z(4.0), w: 1.8, d: 6.0 });
          const up = sign(['위로 ⬆', '2층으로'], { w: 1.4, h: 0.5, d: 0.04, bg: '#3fb8a8', fg: '#ffffff' });
          up.position.set(X(13.2), 1.4, Z(7.3));
          group.add(up);
          things.push({ pos: new THREE.Vector3(X(13.2), 0, Z(7.6)), r: 1.3, label: '에스컬레이터 타기',
            use: async () => {
              await ui.fadeSwap(() => {});
              await ui.say([
                '타고 올라가요. 웅웅거려요. 올라가고, 올라가고, 꼭대기에는 벽이 있고, 벽에는 2층의 멋진 그림이 걸려 있어요.',
                '다시 타고 내려와요. 세그웨이 탄 데일 경비원: “누구나 한 번은 그래요.”',
              ]);
            } });
        }
        // ------------------------------------------------ the lotion kiosk
        {
          const kx = 9.0, kz = 5.4;
          const cart = box(1.8, 1.0, 1.0, 0xfaf6ec);
          cart.position.set(X(kx), 0.5, Z(kz));
          const canopy = box(2.0, 0.1, 1.2, 0x3fb8a8);
          canopy.position.set(X(kx), 2.3, Z(kz));
          group.add(cart, canopy);
          for (const sx of [-0.85, 0.85]) {
            const pole = cyl(0.04, 0.04, 1.3, 5, 0x3a3a3e);
            pole.position.set(X(kx + sx), 1.65, Z(kz));
            group.add(pole);
          }
          for (let k = 0; k < 6; k++) {
            const bottle = cyl(0.07, 0.07, 0.3, 6, [0xb8e0e8, 0xf2e0b0][k % 2]);
            bottle.position.set(X(kx - 0.6 + k * 0.24), 1.15, Z(kz));
            group.add(bottle);
          }
          bl.push({ x: X(kx), z: Z(kz), w: 1.9, d: 1.1 });
          const rico = folk('parrot', { body: 0x3a9ad8, head: 0x3a9ad8, wing: 0xf2cf5b, tail: 0xd8342c }, X(kx - 1.4), 0, Z(kz + 0.3), -Math.PI / 2 - 0.5, { shirt: 0x2a2a2e, fidget: true });
          attend(rico, 'mall', { r: 9 }); // he always sees you. always.
          things.push({ getPos: () => rico.position, r: 2.4, label: '리코와 눈 마주치기',
            use: () => ui.say(nextLine('rico', RICO), { speaker: '리코', voice: VOICE.rico }) });
        }
        // ------------------------------------------------ Officer Dale
        {
          const dale = folk('bronto', { body: 0x9aa8b8, head: 0x9aa8b8, belly: 0xd8dce4, spots: 0x7a88a0 }, X(0), 0.25, Z(7.5), Math.PI / 2, { cap: 0x2e3e5c });
          dale.scale.setScalar(0.8);
          const seg = new THREE.Group();
          const base = box(0.9, 0.12, 0.5, 0x2a2a2e);
          base.position.y = 0.2;
          for (const sx of [-0.5, 0.5]) {
            const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10), mat(0x2a2a2e));
            wh.rotation.x = Math.PI / 2;
            wh.position.set(sx, 0.2, 0);
            seg.add(wh);
          }
          const stalk = cyl(0.04, 0.04, 1.3, 5, 0x9aa0a6);
          stalk.position.set(0.3, 0.85, 0);
          seg.add(base, stalk);
          group.add(seg);
          zones.addMover({ zone: 'mall', obj: dale, r: 0.9 });
          (inside.mall ??= []).push((dt, t, pp) => {
            if (ui.isBusy() && Math.hypot(pp.x - dale.position.x, pp.z - dale.position.z) < 4) return;
            const u = Math.sin(t * 0.12) * 10;
            const nx = X(u), nz = Z(7.6);
            if (Math.hypot(pp.x - nx, pp.z - nz) < 1.4) return;
            const dir = Math.cos(t * 0.12) >= 0 ? 1 : -1;
            dale.position.set(nx, 0.25, nz);
            dale.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            seg.position.set(nx, 0, nz);
            seg.rotation.y = dale.rotation.y - Math.PI / 2;
          });
          things.push({ getPos: () => dale.position, r: 2.4, label: '데일 경비원에게 말 걸기', use: talk('dale', '데일 경비원', DALE) });
        }
        // ------------------------------------------------ the mall walkers
        {
          const walkers = [
            { name: '밀드레드', key: 'mildred', suit: 0xb89ad8 },
            { name: '필리스', key: 'phyllis', suit: 0x3fb8a8 },
            { name: '버니', key: 'bunny', suit: 0xf2b08a },
          ].map((w, k) => {
            const a = folk('camel', { body: [0xd8c0a0, 0xc8a878, 0xe8d0a8][k], humps: 1 + (k % 2) }, 0, 0, 0, 0, { shirt: w.suit, visor: 0xffffff });
            zones.addMover({ zone: 'mall', obj: a, r: 0.5 });
            return { ...w, a, ph: k * (Math.PI * 2 / 3) }; // spread round the court, not nose to tail
          });
          const RX = 6.8, RZ = 4.4;
          let lap = 0;
          (inside.mall ??= []).push((dt, t, pp) => {
            const talking = ui.isBusy() && walkers.some((w) => Math.hypot(pp.x - w.a.position.x, pp.z - w.a.position.z) < 4);
            const blocked = walkers.some((w) => {
              const na = lap + 0.08 - w.ph;
              return Math.hypot(pp.x - X(FT.x + Math.cos(na) * RX), pp.z - Z(FT.z + Math.sin(na) * RZ)) < 0.9;
            });
            const moving = !talking && !blocked;
            if (moving) lap += dt * 0.16;
            for (const w of walkers) {
              w.a.visible = !mildredHome() || w.name !== 'Mildred';
              const an = lap - w.ph;
              w.a.position.set(X(FT.x + Math.cos(an) * RX), 0, Z(FT.z + Math.sin(an) * RZ));
              w.a.rotation.y = Math.atan2(-Math.sin(an) * RX, Math.cos(an) * RZ);
              animateGait(w.a, t, moving ? 1 : 0, 9);
            }
          });
          things.push({ getPos: () => walkers[1].a.position, r: 2.8, label: '몰 워커들과 함께 걷기',
            use: () => ui.say(nextLine('walkers', WALKERS).map(([sp, text]) => ({ speaker: sp, voice: VOICE[sp.toLowerCase()] ?? 400, text }))) });
        }
        // shoppers, bags in paw, going nowhere in particular
        for (const [kind, c, lx, lz] of [
          ['camel', { body: 0xe8d0a8, humps: 1 }, -6, 5],
          ['parrot', { body: 0xe86a9a, head: 0xe86a9a, wing: 0x3fb8a8, tail: 0xf2cf5b }, 6, 7],
          ['camel', { body: 0xc49a66, humps: 2 }, -2, 6.5],
        ]) {
          const sh = folk(kind, c, X(lx), 0, Z(lz), 0, kind === 'camel' ? { shirt: [0x3fb8a8, 0xf28fb0][Math.abs(lx) % 2] } : {});
          const bag = box(0.3, 0.35, 0.12, [0xffffff, 0x111111, 0xf2cf5b][Math.abs(lz | 0) % 3]);
          bag.position.set(0.45, 0.5, 0.1);
          sh.userData.parts.body.add(bag);
          wanderer(sh, 'mall', { x0: X(-14), x1: X(14), z0: Z(-5.4), z1: Z(9) }, { speed: 1.0, pause: [2, 6] });
        }
        // the entrance mat
        rug(X(0), Z(D0 / 2 - 0.9), 3.2, 1.2, 0x3fb8a8);
      },
    });
  }

  // ============================================================ update ----
  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'island') {
      if (Math.hypot(playerPos.x - ISLAND8.x, playerPos.z - ISLAND8.z) > 140) return; // nobody here to see it
      for (const f of outdoor) f(dt, t, playerPos);
    } else if (inside[zone]) {
      for (const f of inside[zone]) f(dt, t, playerPos);
    }
  }

  mergeStatic(group); // (everything that doesn't move, baked into a few meshes)
  return { group, update };
  }
