// The dock: rowboats you can actually row, a tugboat with a captain who
// knows where everything is and goes nowhere, and the old lighthouse —
// dark since the lamp retired to the café, with an empty hook where the
// bell used to hang.

import * as THREE from 'three';
import { waveAt } from './ocean.js';
import { SITES, terrainHeight, WATER_Y, ISLAND2, ISLAND3, ISLAND5, ISLAND6, ISLAND7, VOLCANO } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal } from './animals.js';
import { plop, doorChime, tone } from './audio.js';
import { isFoggy } from './almanac.js';
import { isNight } from './calendar.js';
import { rand, turnToward } from './utils.js';
import { glowWindow, glowLevel } from './nightglow.js';
import { BULKO_DOCK } from './bulko.js';
import { LABS_DOCK } from './island6.js';
import { FARTHER_DOCK } from './farther.js';
import { OASIS_DOCK } from './oasis.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

// A rowboat: a pointed bow, a squared-off stern, two thwarts, oarlocks and
// oars. (The hull used to be a stretched heptagon rotated AFTER stretching,
// which twisted its long axis a good 25° off the seats and oars.)
function hullGeo(rTop, rBot, h, len) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 8);
  g.rotateY(Math.PI / 8); // a flat side forward, then...
  g.scale(1, 1, len);     // ...stretched along the boat's own length
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z > 0) p.setX(i, p.getX(i) * (1 - (z / (rTop * len)) * 0.75)); // draw the bow to a point
  }
  g.computeVertexNormals();
  return g;
}
function makeRowboat(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(hullGeo(0.9, 0.55, 0.7, 2.1), mat(color));
  hull.position.y = 0.1;
  g.add(hull);
  const inner = new THREE.Mesh(hullGeo(0.74, 0.45, 0.52, 2.0), mat(0xc9b178));
  inner.position.y = 0.25;
  g.add(inner);
  for (const [z, w] of [[-0.3, 1.3], [0.7, 1.05]]) {
    const thwart = box(w, 0.1, 0.3, 0x8a5a3a);
    thwart.position.set(0, 0.44, z);
    g.add(thwart);
  }
  const oars = [];
  for (const sx of [-1, 1]) {
    const lock = box(0.08, 0.14, 0.08, 0x55504c);
    lock.position.set(sx * 0.82, 0.55, 0.1);
    g.add(lock);
    const oar = new THREE.Group();
    const shaft = box(0.07, 0.07, 1.6, 0xa97c50);
    oar.add(shaft);
    const blade = box(0.05, 0.22, 0.45, 0xa97c50);
    blade.position.z = -0.75;
    oar.add(blade);
    oar.position.set(sx * 1.0, 0.52, 0.1);
    oar.rotation.y = sx * 0.35;
    g.add(oar);
    oars.push(oar);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.oars = oars;
  return g;
}

export function createBoats(player) {
  const group = new THREE.Group();
  const updates = [];
  const D = SITES.dock;

  // the dock points out to sea, away from the island's heart
  const outA = Math.atan2(D.x, D.z); // seaward bearing
  const ox = Math.sin(outA), oz = Math.cos(outA);
  const px = -oz, pz = ox; // along-shore

  // ---------------------------------------------------------- the pier ----
  const PIER_LEN = 11;
  const LAST = PIER_LEN - 1;
  for (let i = 0; i < PIER_LEN; i += 1) {
    const t = i + 0.5;
    const plank = box(2.6, 0.18, 1.0, i % 5 === 2 ? 0x96703f : 0xa97c50);
    plank.position.set(D.x + ox * t, 0.55, D.z + oz * t);
    plank.rotation.y = outA;
    plank.receiveShadow = true;
    group.add(plank);
    if (i % 2 === 0 && i !== LAST) {
      // legs all the way down to the sand, whatever the depth
      for (const side of [-1, 1]) {
        const lx = D.x + ox * t + px * side * 1.2, lz = D.z + oz * t + pz * side * 1.2;
        const bot = Math.min(terrainHeight(lx, lz), WATER_Y) - 0.3, top = 0.5;
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, top - bot, 6), mat(0x6b4a2e));
        pile.position.set(lx, (top + bot) / 2, lz);
        group.add(pile);
      }
    }
    if (i === LAST) {
      // the front posts: the pier ends where two tall posts say it does
      for (const side of [-1, 1]) {
        const fx = D.x + ox * (t + 0.35) + px * side * 1.2, fz = D.z + oz * (t + 0.35) + pz * side * 1.2;
        const fbot = Math.min(terrainHeight(fx, fz), WATER_Y) - 0.3, ftop = 1.55;
        const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, ftop - fbot, 6), mat(0x6b4a2e));
        fp.position.set(fx, (ftop + fbot) / 2, fz);
        fp.castShadow = true;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14 + 0.03, 0.14 + 0.03, 0.08, 6), mat(0x4f3622));
        cap.position.y = (ftop - fbot) / 2 + 0.02;
        fp.add(cap);
        group.add(fp);
      }
    }
  }
  // the pier is a proper crossing: walk it all the way out over the water
  zones.addCrossing({
    contains(x, z) {
      const dx = x - D.x, dz = z - D.z;
      const t = dx * ox + dz * oz;
      if (t < -0.5 || t > PIER_LEN + 0.8) return false;
      return Math.abs(dx * px + dz * pz) < 1.35;
    },
    height: () => 0.64,
  });

  // -------------------------------------------------------- the rowboats ----
  const boats = [];
  for (const [i, color] of [[0, 0xb0453a], [1, 0x4f8f6a]].values()) {
    const boat = makeRowboat(color);
    // moored where the shallows end, both on the same side of the pier —
    // the Persistent keeps the other side, and the prompts stay honest
    // (a boat's width apart and parallel to the pier — random angles used
    // to swing one bow under the planks and the two into each other)
    const bx = D.x + ox * 7.6 + px * (i === 0 ? -2.4 : -4.9);
    const bz = D.z + oz * 7.6 + pz * (i === 0 ? -2.4 : -4.9);
    boat.position.set(bx, WATER_Y + 0.12, bz);
    rand(-0.3, 0.3); // (still drawn, so the seeded stream stays in step for everything after)
    boat.rotation.y = outA + (i ? 0.08 : -0.05);
    // ...unless you left it somewhere else last time — boats remember
    const saved = S.state.rowboats[i];
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.z)) {
      boat.position.set(saved.x, WATER_Y + 0.12, saved.z);
      boat.rotation.y = saved.rotY || 0;
    }
    group.add(boat);
    const data = { boat, i, inUse: false, oarPhase: 0, oarPower: 0 };
    boats.push(data);
    // a moored boat is solid: ducks paddle round it, not through it
    zones.addFloat({
      active: () => !data.inUse,
      circles: () => {
        const p = boat.position, ry = boat.rotation.y;
        return [-0.9, 0, 0.9].map((k) => [p.x + Math.sin(ry) * k, p.z + Math.cos(ry) * k, 1.3]); // hull + a duck’s width
      },
    });

    register({
      getPos: () => boat.position,
      r: 5.2, // callable from the end of the wadeable shallows
      enabled: () => !data.inUse,
      label: '바다로 노 저어 나가기',
      use: () => boardBoat(data),
    });
  }

  let activeBoat = null;
  const lastPlayerPos = new THREE.Vector3();
  let haveLastPlayerPos = false;

  async function boardBoat(data, at = null) {
    plop();
    await zones.go('sea', at || {
      x: data.boat.position.x, z: data.boat.position.z,
      rotY: data.boat.rotation.y,
    });
    data.inUse = true;
    S.state.rowing = data.i;
    S.save();
    activeBoat = data;
    data.oarPhase = 0;
    data.oarPower = 0;
    lastPlayerPos.copy(player.group.position);
    haveLastPlayerPos = true;
    data.boat.position.set(0, -0.42, 0.1);
    data.boat.rotation.set(0, 0, 0);
    player.group.add(data.boat); // the boat goes where you go now
    ui.toast('배를 밀어 떠나요. 물이 해본 적 있다는 듯이 당신을 받쳐 줘요.', '🚣');
    if (!S.hasFlag('firstRow')) {
      S.setFlag('firstRow');
      ui.say([
        '노를 넣고, 노를 빼고. 섬이 뒤로, 공손하게, 작아져요.',
        '연기 나는 산, 반짝이는 물, 지느러미들이 가는 곳 어디로든 가 보세요. 다시 상륙하려면 아무 해안에 코를 대고 E를 눌러요.',
      ]);
    }
  }

  function disembarkSpot() {
    // a walkable patch of land just ahead of the bow
    const ry = player.group.rotation.y;
    const dx = Math.sin(ry), dz = Math.cos(ry);
    for (let d = 1.5; d <= 6; d += 0.7) {
      const x = player.group.position.x + dx * d;
      const z = player.group.position.z + dz * d;
      if (terrainHeight(x, z) > WATER_Y + 0.15 && zones.islandCanWalk(x, z)) return { x, z };
    }
    return null;
  }

  register({
    getPos: () => player.group.position,
    r: 99, priority: 0,
    zone: 'sea',
    enabled: () => !!activeBoat && !!disembarkSpot(),
    label: '상륙하기',
    use: async () => {
      const spot = disembarkSpot();
      if (!spot || !activeBoat) return;
      const data = activeBoat;
      activeBoat = null;
      player.group.remove(data.boat);
      // the boat waits where you left it, nosed up to the shore
      data.boat.position.set(player.group.position.x, WATER_Y + 0.12, player.group.position.z);
      data.boat.rotation.y = player.group.rotation.y;
      group.add(data.boat);
      data.inUse = false;
      S.state.rowboats[data.i] = {
        x: data.boat.position.x, z: data.boat.position.z, rotY: data.boat.rotation.y,
      };
      S.state.rowing = null;
      S.save();
      plop();
      await zones.go('island', { x: spot.x, z: spot.z, rotY: player.group.rotation.y });
      ui.toast('훌쩍 상륙해요. 배는 기다릴 거예요 — 잘하거든요.', '⛵');
    },
  });

  function updateRowboatOars(dt, playerPos) {
    if (!playerPos) return;
    if (!haveLastPlayerPos) {
      lastPlayerPos.copy(playerPos);
      haveLastPlayerPos = true;
    }
    const dx = playerPos.x - lastPlayerPos.x;
    const dz = playerPos.z - lastPlayerPos.z;
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    lastPlayerPos.copy(playerPos);

    const seaRowing = zones.current() === 'sea' && activeBoat?.inUse;
    for (const data of boats) {
      const rowing = seaRowing && data === activeBoat && speed > 0.08;
      data.oarPower += ((rowing ? 1 : 0) - data.oarPower) * Math.min(1, dt * 6);
      if (data.oarPower > 0.01) {
        data.oarPhase = (data.oarPhase + dt * (0.9 + Math.min(speed, 6) * 0.07)) % 1;
      }
      const p = data.oarPhase;
      const stroke = p < 0.58
        ? Math.sin((p / 0.58) * Math.PI) * 0.55
        : -Math.sin(((p - 0.58) / 0.42) * Math.PI) * 0.22;
      for (const oar of data.boat.userData.oars) {
        const x = stroke * data.oarPower;
        oar.rotation.x = Math.abs(x) < 0.001 ? 0 : x;
      }
    }
  }

  // ---------------------------------------------------------- the tugboat ----
  const tug = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.2, 1.2, 8), mat(0x2e3e5c));
  hull.scale.z = 2.85; // long enough for a passenger aft of the cabin
  hull.position.y = 0.3;
  tug.add(hull);
  const deck = box(2.6, 0.2, 7.6, 0xa97c50);
  deck.position.y = 0.95;
  tug.add(deck);
  const cabin = box(1.6, 1.3, 1.8, 0xf3e6cf);
  cabin.position.set(0, 1.7, -0.6);
  tug.add(cabin);
  const cabinRoof = box(1.8, 0.18, 2.0, 0xb0453a);
  cabinRoof.position.set(0, 2.4, -0.6);
  tug.add(cabinRoof);
  // a porthole on each side of the cabin — glows at night like the others
  for (const psx of [-1, 1]) {
    const porthole = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 8), mat(0xbfe6f2, 0.3));
    porthole.rotation.z = Math.PI / 2; // faces out the side
    porthole.position.set(psx * 0.81, 1.65, -0.6);
    glowWindow(porthole);
    tug.add(porthole);
  }
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 7), mat(0xb0453a));
  funnel.position.set(0, 1.6, 0.9);
  tug.add(funnel);
  const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 10), mat(0x2e2a26, 0.6));
  bumper.position.set(0, 0.6, 3.9);
  tug.add(bumper);
  tug.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // moored across the pier from the rowboats, so walking the planks offers
  // the rowboats on one corner and the captain on the other
  const tx = D.x + ox * 10.5 + px * 4.5;
  const tz = D.z + oz * 10.5 + pz * 4.5;
  tug.position.set(tx, WATER_Y + 0.35, tz);
  tug.rotation.y = outA + 0.9;
  group.add(tug);
  updates.push((dt, t) => {
    tug.position.y = WATER_Y + 0.35 + Math.sin(t * 0.8) * 0.06;
    tug.rotation.z = Math.sin(t * 0.7) * 0.015;
  });

  // Captain Brine, the goose who has been everywhere and stays here
  const brine = buildAnimal('duck', { body: 0x9aa3a0, head: 0xb8beba });
  brine.scale.setScalar(1.25);
  brine.position.set(0, 1.05, 2.0); // up at the bow now, clear of the sides
  brine.rotation.y = 0.4; // facing forward — her back to the stern passenger
  tug.add(brine);
  const BRINE_LINES = [
    '브라인 선장이야. 예인선 이름은 퍼시스턴트. 요즘은 별로 끌지 않아. 나도 마찬가지고.',
    '화산 너머에는 웅웅거리는 안개 뭉치와, 화답하는 바위들이 있어. 언젠가는 정규 항로로. 오늘은: 산행 항로.',
    '노 저어 지나갈 때 암초가 빛나는 걸 봐 — 밝은 물은 작은 이웃들이 있다는 뜻이야. 노 조심하고.',
    '저기 저 옛 등대? 저 불빛 보고 백 번은 귀항했지. 지날 때 모자를 기울여. 모자가 없다고? 가게에서 팔아.',
  ];
  // ------------------------------------------------------ the sea stories ----
  // every route gets one. mandatory, the story.
  const STORIES = {
    volcano: [
      ['퍼시스턴트가 투덜거리며 부두를 떠나요. 브라인은 돌아보지도 않고 이야기해요.',
       '“종이 가라앉던 밤 나는 갑판원이었어. 막내였지. 파도가 의견 많은 벽처럼 일어섰어.”',
       '“탠지는 울지 않았어, 알아? 가라앉는 내내 그저 들었어. 물속에서 한 번 울렸다고 했어. 소리가… 홀가분해 들렸대.”',
       '“종이 가라앉던 밤 나는 갑판원이었어. 막내였지. 파도가 의견 많은 벽처럼 일어섰어.”',
       '“탠지는 울지 않았어, 알아? 가라앉는 내내 그저 들었어. 물속에서 한 번 울렸다고 했어. 소리가… 홀가분해 들렸대.”',
       '엔진이 안정돼요. 검은 바위가 창밖으로 흘러가요.'],
      ['“좌현 너머로 빛나는 암초 보여? 우리 할머니는 떨어진 왕관이라고 불렀어. 바다 여왕이 일부러 버렸다고.”',
       '“왜 일부러냐고? 계속 노래를 했거든, 여왕은 자고 싶었고. 왕족이란.” 브라인이 제 농담에 한참 혼자 킥킥대요.',
       '화산이 앞에 커져 가요, 따뜻하고 태연하게.'],
      ['“저 산? 아, 나랑은 잘 지내. 지날 때 휘파람을 불어. 기분 좋으면 연기를 뿜지.”',
       '“한 번은 내가 불기 전에 먼저 뿜었어. 그 생각을 자주 해.”'],
    ],
    bulko: [
      ['“창고행. 뭐든 붙잡아.” 퍼시스턴트가 속도를 내요. 그러니까, 약간의 속도를.',
       '“한번은 랍스터 수조를 꾸며 달라더군. 랍스터들이 쿠션에 대해 의.견.이 있었어. 그 얘긴 안 해. 쿠션은 남았지만.”',
       '회색 건물이 물 위로 솟아요, 아주 정돈된 절벽처럼.'],
      ['“핫도그에 탄산까지 1.5버튼. 종이 가라앉기 전부터 쭉. 장부를 직접 확인했어.”',
       '“어떤 것들은 변함없어, 선원.” 가는 내내 더는 아무 말 없고, 그게 어쩐지 이번 주 최고의 대화예요.'],
      ['“오는 길에 차 본 적 있어? 없다고? 이상한 일이지—” 말을 멈춰요. “아니야. 거스 말이 맞아. 신경 쓰지 마.”'],
    ],
    far: [
      ['“금방이야, 이 구간. 짧은 이야기 시간: 저기 교회에는 종이 없어. 일.부.러. 처음 들었을 땐 프로펠러가 엉킬 정도로 웃었지.”',
       '“그러다 한 번 비 피하러 앉아 있었어. 내 인생 가장 조용한 20분. 티 내는 것보다 자주 생각나.”'],
      ['“저기 먼 해안의 뼈 보여? 옛 가수. 고래야. 네 시대 이전, 내 시대 이전이지. 나는 이 배 페인트보다 늙었어.”',
       '“어떤 밤엔 바람이 갈비뼈를 넘어와 섬 전체가 웅웅거려. 왜가리는 찬송가래. 난 날씨래. 둘 다 맞아.”'],
    ],
    north: [
      ['“북쪽 항로. 습기 조심해. 저 위 이끼는 종신 재직권이 있어, 선원 — 바위가 완성되기 전부터 바위에 있었거든.”',
       '“박쥐가 도서관을 운영해. 매듭 책을 빌려준 적 있지. 매듭은 다 아는데. 그래도 읽었어. 예의잖아.”'],
      ['“저 위 의사는 아홀로틀이야. 그 섬에서 아픈 사람은 한 번도 없었어. 그래도 병원은 유지해. ‘대비’라면서.”',
       '“존경해. 퍼시스턴트도 몇 년째 끈 게 없어. 우리도 대비 중이지.”'],
    ],
    grove: [
      ['“그로브 섬. 오래된 돈. 남작의 할아버지는 그 종을 못 찾는 데 시간당으로 옛 탠지에게 청구했어. 청구서를 봤다고. 금 액자에 있어.”',
       '“그런데도 — 과수원이 나왔어, 온천, 철도. 나쁜 거래에서 뭐가 자라는지, 백 년 지나면 재밌다니까.”'],
      ['“카피바라들이 온천을 운영해. 저 평온에 속지 마. 저 평온은 연습의 결과야.”',
       '“한 마리는 오렌지를 올리고 있어. 물어보고 싶을 거야. 묻지 마. 어떤 것들은 하중을 받치고 있어.”'],
    ],
    labs: [
      ['“연구소! 한번은 퍼시스턴트를 사겠다더군. ‘음향 연구’라면서. 뭘 틀 거냐고 물었지. 핑 소리래. 얘는 예인선이지 트라이앵글이 아니야.”',
       '“과일 바구니랑 기압계로 사과하더라. 솔직히 좋은 이웃이야. 기압계는 틀린 적이 없어. 짜증 나.”'],
      ['“북쪽 제방길에 전화선을 쳤어. 전화기 한 대. 다리 저쪽 끝에 거는 전화야. 아주 자랑스러워해.”',
       '“한 번 걸어봤어. 두더지가 받더군. ‘없어도 들리는 거 아시죠’라더라. 장엄한 전선 낭비. 과학이야!”'],
      ['“저기서 로켓을 만들고 있어. 달에 간대. 내가 뭐라 했게? 좋다고 했어.”',
       '“바다는 백 년 동안 우리 종을 지켜 왔어. 이 군도 누군가가 바다가 못 따라가는 곳에 갈 때가 됐지.”',
       '남은 길 내내 더는 말이 없어요. 슬픈 침묵은 아니에요.'],
    ],
    oasis: [
      ['“오아시스 에스테이츠. 그 여자한테 신청서를 열네 장 냈어. 열.네. 장. ‘뱃고동이 시끄럽다.’ 뱃고동을 뗐어. ‘배가 시끄럽다.’ 배를 뗄 수는 없잖아.”',
       '“결국 뭘 승인해 줬게? 노선 하나. 불코 왕복. 키친타월 때문에. 퍼시스턴트는 이제 공식적으로 키친타월 배야.”',
       '“끝에 클립보드 든 낙타가 있을 거야. 손 흔들어. 답례는 없을 거야. 네가 흔들었다고 적어둘 거야.”'],
      ['“그 섬의 모든 집은 똑같은 집이야. 확인하려고 두 번 지나갔지. 내가 이상해진 건가 싶어 세 번째도. 똑같은 집.”',
       '“문지기 집 앵무새는 세 번 다 손을 흔들었어. 명단을 관리해. 명단은 비어 있어. 근사한 녀석이야.”'],
      ['“그 섬에는 종이 없어, 알지? 규정에 있어. 몰드카이가 썼대.”',
       '“몰드카이가 종소리를 듣기 싫다니 웃기지. 가장 귀 기울여 들을 가문이라 생각했는데.”'],
    ],
    home: [
      ['“귀항. 최고의 항로지.” 퍼시스턴트도 동의하는 듯해요; 자기 부두를 향하면 반 노트 빨라져요.'],
      ['“그 섬의 뭐가 좋은지 알아? 종은 잃고 이름은 지켰어. 풀죽음 없이. 곧장 서류 작업.” 기러기처럼 웃어요, 기러기니까요.'],
    ],
  };
  const storyIdx = {};
  let brineIdx = 0;

  // ------------------------------------------------------------ the stops ----
  // every island gets a landing and a patch of deep water just off it.
  // except TEXAS. the Persistent draws four feet of water.

  function shoreLanding(cx, cz) {
    const bearing = Math.atan2(D.x - cx, D.z - cz); // the shore facing home
    const bx = Math.sin(bearing), bz = Math.cos(bearing);
    let landT = 6;
    for (let t = 6; t < 60; t += 0.5) {
      if (terrainHeight(cx + bx * t, cz + bz * t) < 0.15) break;
      landT = t;
    }
    return {
      x: cx + bx * landT, z: cz + bz * landT, rotY: bearing + Math.PI,
      buoy: { x: cx + bx * (landT - 1.2) - bz * 2.4, z: cz + bz * (landT - 1.2) + bx * 2.4 },
    };
  }

  function seaOff(lx, lz, cx, cz) {
    const a = Math.atan2(lx - cx, lz - cz);
    const ax = Math.sin(a), az = Math.cos(a);
    for (let t = 2; t < 30; t += 0.5) {
      const x = lx + ax * (t + 1.5), z = lz + az * (t + 1.5);
      // deep water, and clear of every wall a hull could overlap (the North
      // anchorage used to sit with the tug half inside the arch's rock)
      if (terrainHeight(lx + ax * t, lz + az * t) < WATER_Y - 0.7 &&
        [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]].every(([ox, oz]) => !zones.seaBlocked(x + ox, z + oz))) {
        return { x, z };
      }
    }
    return { x: lx + ax * 10, z: lz + az * 10 };
  }

  const farLand = shoreLanding(ISLAND2.x, ISLAND2.z);
  const northLand = shoreLanding(ISLAND3.x, ISLAND3.z);
  const groveLand = shoreLanding(ISLAND5.x, ISLAND5.z);
  const vb = SITES.vbeach;

  const STOPS = {
    home: {
      label: '🍃 낫벨(홈 선착장)',
      land: { x: D.x + ox * 3, z: D.z + oz * 3, rotY: Math.atan2(-ox, -oz) },
      sea: { x: tx + ox * 2, z: tz + oz * 2 },
    },
    volcano: {
      label: '🌋 화산',
      land: { x: vb.x, z: vb.z + 2, rotY: Math.PI },
      sea: seaOff(vb.x, vb.z + 2, VOLCANO.x, VOLCANO.z),
    },
    far: {
      label: '⛪ 파 아일',
      land: farLand,
      sea: seaOff(farLand.x, farLand.z, ISLAND2.x, ISLAND2.z),
    },
    north: {
      label: '📚 북쪽 섬',
      land: northLand,
      sea: seaOff(northLand.x, northLand.z, ISLAND3.x, ISLAND3.z),
    },
    grove: {
      label: '🍊 그로브 섬',
      land: groveLand,
      sea: seaOff(groveLand.x, groveLand.z, ISLAND5.x, ISLAND5.z),
    },
    bulko: {
      label: '🛒 불코',
      land: { x: BULKO_DOCK.x, z: BULKO_DOCK.z, rotY: BULKO_DOCK.rotY },
      sea: seaOff(BULKO_DOCK.x, BULKO_DOCK.z, 8, 96),
    },
    labs: {
      label: '🚀 낫벨 연구소',
      land: { x: LABS_DOCK.x, z: LABS_DOCK.z, rotY: LABS_DOCK.rotY },
      sea: seaOff(LABS_DOCK.x, LABS_DOCK.z, ISLAND6.x, ISLAND6.z),
    },
    farther: {
      label: '🏕️ 파더 섬',
      land: { x: FARTHER_DOCK.x, z: FARTHER_DOCK.z, rotY: FARTHER_DOCK.rotY },
      sea: seaOff(FARTHER_DOCK.x, FARTHER_DOCK.z, ISLAND7.x, ISLAND7.z),
    },
    // (the ONE route the HOA approved: BULKO and back — see stopMenu)
    oasis: {
      label: '🏡 오아시스 에스테이츠',
      land: { x: OASIS_DOCK.x, z: OASIS_DOCK.z, rotY: OASIS_DOCK.rotY },
      sea: OASIS_DOCK.sea,
    },
  };

  // ----------------------------------------------------------- the voyage ----
  // no more black screens: the Persistent actually sails. you ride the deck,
  // the story plays over open water, Brine steers around the shallows.

  let voyage = null;
  const wakeBits = [];
  const smokePuffs = [];
  let wakeT = 0;
  let smokeT = 0;

  function spawnBit(list, color, size, max, x, y, z) {
    let bit;
    if (list.length >= max) {
      bit = list.shift();
    } else {
      bit = {
        m: new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })),
      };
      group.add(bit.m);
    }
    bit.life = 0;
    bit.m.visible = true;
    bit.m.material.opacity = 0.8;
    bit.m.scale.setScalar(1);
    bit.m.position.set(x, y, z);
    list.push(bit);
    return bit;
  }

  function shallowAhead(ang, dist) {
    const a = tug.rotation.y + ang;
    const x = tug.position.x + Math.sin(a) * dist, z = tug.position.z + Math.cos(a) * dist;
    if (terrainHeight(x, z) > WATER_Y - 0.55) return true;
    if (!zones.seaBlocked(x, z)) return false;
    // threading a gate (the arch's tunnel)? only that gate's own wall is let
    // off — every other wall still counts
    const g = voyage?.via?.[0]?.gate;
    return !(g && Math.hypot(x - g.x, z - g.z) < 16);
  }

  // solid things in the sea (the North Isle arch) have gates — a tunnel, a
  // high span. if the straight line crosses one, sail through its gate:
  // line up on the near side, pass through, clear the far side.
  function crosses(p, q, a, b) {
    const o = (u, v, w) => Math.sign((v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x));
    return o(p, q, a) !== o(p, q, b) && o(a, b, p) !== o(a, b, q);
  }
  function routeVia(from, to) {
    const via = [];
    // a line that passes NEAR a gate's wall counts too (it used to slip just
    // past the arch's end, then dodge round and round the rock)
    const segDist = (p, q, a, b) => {
      const d = (u, v, w) => { const dx = w.x - v.x, dz = w.z - v.z, l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((u.x - v.x) * dx + (u.z - v.z) * dz) / l2)); return Math.hypot(u.x - (v.x + dx * t), u.z - (v.z + dz * t)); };
      return crosses(p, q, a, b) ? 0 : Math.min(d(p, a, b), d(q, a, b), d(a, p, q), d(b, p, q));
    };
    for (const g of zones.getSeaGates()) {
      if (segDist(from, to, g.a, g.b) > 12) continue;
      const side = Math.sign((from.x - g.x) * g.nx + (from.z - g.z) * g.nz) || 1;
      if (Math.sign((to.x - g.x) * g.nx + (to.z - g.z) * g.nz) === side) continue; // both ends on one side: no need to go through
      const gate = { x: g.x, z: g.z };
      via.push({ x: g.x + g.nx * side * 10, z: g.z + g.nz * side * 10, k: Math.hypot(from.x - g.x, from.z - g.z), gate });
      via.push({ x: g.x - g.nx * side * 10, z: g.z - g.nz * side * 10, k: Math.hypot(from.x - g.x, from.z - g.z) + 0.1, gate });
    }
    return via.sort((u, v) => u.k - v.k);
  }

  async function beginVoyage(destId, fromId) {
    const dest = STOPS[destId];
    const from = STOPS[fromId];
    const lines = STORIES[destId] || STORIES.home;
    storyIdx[destId] = storyIdx[destId] || 0;
    const story = lines[storyIdx[destId]++ % lines.length];
    plop();
    await ui.fadeSwap(() => {
      const heading = Math.atan2(dest.sea.x - from.sea.x, dest.sea.z - from.sea.z);
      tug.position.set(from.sea.x, WATER_Y + 0.35, from.sea.z);
      tug.rotation.y = heading;
      player.riding = true;
      return zones.go('sea', { x: from.sea.x, z: from.sea.z, rotY: heading });
    });
    voyage = { dest, destId, story, speed: 0, elapsed: 0, storyFired: false, landing: false, via: routeVia(from.sea, dest.sea) };
    ui.toast('퍼시스턴트가 헛기침하고 출발해요.', '⛴️');
  }

  async function landVoyage() {
    const v = voyage;
    voyage = null;
    player.riding = false;
    await ui.fadeSwap(() => zones.go('island', v.dest.land));
    ui.toast(v.destId === 'home'
      ? '모항. 퍼시스턴트가 행복하게 한숨 쉬어요.'
      : '퍼시스턴트가 부릉부릉 집으로 가요. 태워 달라면 부표를 울리세요.', '⛴️');
    if (v.destId !== 'home') {
      // she sees herself home, trailing smoke over the horizon
      voyage = { dest: STOPS.home, destId: 'home', ghost: true, speed: 4, elapsed: 0, via: routeVia(v.dest.sea, STOPS.home.sea) };
    } else {
      tug.position.set(tx, WATER_Y + 0.35, tz);
      tug.rotation.y = outA + 0.9;
    }
  }

  async function stopMenu(hereId) {
    if (!S.hasFlag('metBrine')) {
      S.setFlag('metBrine');
      ui.say([
        '넉넉한 회색 기러기가 밧줄 꾸러미에서 고개를 들어요. 분명 그 위에서 자고 있었어요.',
        '“브라인 선장. 퍼시스턴트. 갈 만한 곳은 다 가고, 아닌 곳도 두 군데 가 — 구간당 10버튼, 바다 이야기 포함. 이야기는 필수야.”',
      ], { speaker: '브라인 선장', voice: 340 });
      return;
    }
    // Oasis Estates approved exactly one ferry route: to BULKO and back
    const choices = Object.entries(STOPS)
      .filter(([id]) => id !== hereId)
      .filter(([id]) => (hereId === 'oasis' ? id === 'bulko' : id !== 'oasis' || hereId === 'bulko'))
      .map(([id, s]) => ({
        label: s.label, value: id,
        hint: id === 'home' ? 'free' : '10🔘',
        disabled: id !== 'home' && S.state.buttons < 10,
      }));
    choices.push({ label: '🤠 TEXAS', value: 'texas' });
    if (hereId === 'home') choices.push({ label: '수다', value: 'chat' });
    choices.push({ label: '나가기', value: null });
    const choice = await ui.ask('어디로 갈까, 선원?', choices, { speaker: '브라인 선장', voice: 340 });
    if (!choice) return;
    if (choice === 'texas') {
      ui.say([
        '“안 돼.”',
        '“퍼시스턴트는 1.2미터의 흘수가 필요해. 텍사스는 25센티의 텍사스를 먹어. 좌초할 거고, 페코스는 본인도 안 내는 정박료를 뭍에서 우리한테 받을 거야.”',
        '“노를 저어. 헤엄쳐. 간조 때 걸어가든, 상관없어. 퍼시스턴트는 텍사스는 안 가.”',
      ], { speaker: '브라인 선장', voice: 340 });
      return;
    }
    if (choice === 'chat') {
      ui.say(BRINE_LINES[brineIdx++ % BRINE_LINES.length], { speaker: '브라인 선장', voice: 340 });
      return;
    }
    if (choice !== 'home') {
      S.spend(10);
      ui.updateHUD();
    }
    await beginVoyage(choice, hereId);
  }

  register({
    pos: new THREE.Vector3(tx, 0, tz), r: 6,
    enabled: () => !voyage || voyage.ghost,
    label: '브라인 선장 부르기',
    use: () => stopMenu('home'),
  });

  // bell-buoys at every port of call
  function makeBuoy(x, z) {
    const b = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
    base.position.y = 0.5;
    b.add(base);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
    top.position.y = 1.2;
    b.add(top);
    b.position.set(x, terrainHeight(x, z), z);
    b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(b);
    zones.addBlocker(x, z, 0.55);
    return b;
  }

  const PORT_BUOYS = [
    ['volcano', makeBuoy(vb.x - 4, vb.z + 4).position],
    ['far', makeBuoy(farLand.buoy.x, farLand.buoy.z).position],
    ['north', makeBuoy(northLand.buoy.x, northLand.buoy.z).position],
    ['grove', makeBuoy(groveLand.buoy.x, groveLand.buoy.z).position],
  ];
  if (BULKO_DOCK.buoyPos) PORT_BUOYS.push(['bulko', BULKO_DOCK.buoyPos]);
  if (LABS_DOCK.buoyPos) PORT_BUOYS.push(['labs', LABS_DOCK.buoyPos]);
  if (FARTHER_DOCK.buoyPos) PORT_BUOYS.push(['farther', FARTHER_DOCK.buoyPos]);
  PORT_BUOYS.push(['oasis', OASIS_DOCK.buoyPos]);
  for (const [id, pos] of PORT_BUOYS) {
    register({
      pos, r: 2.6,
      label: '퍼시스턴트를 부르려고 부표 울리기',
      use: async () => {
        doorChime();
        await stopMenu(id);
      },
    });
  }

  // ------------------------------------------------------- the lighthouse ----
  const lhx = D.x - ox * 2 + px * 8, lhz = D.z - oz * 2 + pz * 8;
  const lhy = terrainHeight(lhx, lhz);
  const lh = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5 - i * 0.22, 1.7 - i * 0.22, 2.6, 9),
      mat(i % 2 ? 0xb0453a : 0xf0e8d8, 0.8)
    );
    seg.position.y = 1.3 + i * 2.6;
    seg.castShadow = true;
    lh.add(seg);
  }
  // the lamp room: the OLD lamp lives at Luna's now (its light sleeps in the
  // cave); what's up there today is a small electric lamp someone wired in,
  // which turns a modest beam over the water after dark and in weather
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.5, 8),
    new THREE.MeshStandardMaterial({
      color: 0xbfe6f2, transparent: true, opacity: 0.4, roughness: 0.2, flatShading: true,
    }));
  lampRoom.position.y = 11.5;
  lh.add(lampRoom);
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0xfff4d0, 0.3));
  bulb.position.y = 11.45;
  glowWindow(bulb, { warm: 0xfff0c0, max: 1.6 });
  lh.add(bulb);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.1, 9), mat(0xb0453a));
  cap.position.y = 12.8;
  cap.castShadow = true;
  lh.add(cap);
  // the bell's hook: back where a bell belongs — up in the lamp room,
  // hanging on its chain from the roof, right over the little electric lamp.
  // it sways. there is no wind in there. nobody has ever found out why.
  const hookGroup = new THREE.Group();
  const chainMat = mat(0x3a3a3a, 0.4);
  for (let k = 0; k < 3; k++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 8), chainMat);
    link.position.y = -0.12 - k * 0.11;
    link.rotation.y = k % 2 ? Math.PI / 2 : 0;
    hookGroup.add(link);
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 5, 8, Math.PI * 1.4), mat(0x3a3a3a, 0.35));
  hook.position.y = -0.52;
  hook.rotation.z = Math.PI * 0.8;
  hookGroup.add(hook);
  hookGroup.position.y = 12.25; // just under the cap
  lh.add(hookGroup);
  let hookBell = 0;
  updates.push((dt, t, playerPos) => {
    hookGroup.rotation.z = Math.sin(t * 0.7) * 0.12 + Math.sin(t * 1.9) * 0.03;
    hookGroup.rotation.x = Math.sin(t * 0.53 + 1) * 0.08;
    // on foggy nights, if you stand at the foot of the tower long enough,
    // something up there rings once. very faint. probably the tide.
    if (!playerPos) return;
    const near = Math.hypot(playerPos.x - lhx, playerPos.z - lhz) < 6;
    hookBell = near && (isFoggy() || isNight()) ? hookBell + dt : 0;
    if (hookBell > 14) {
      hookBell = -40;
      tone(1320, { dur: 2.2, type: 'sine', vol: 0.018 });
      tone(1980, { time: 0.02, dur: 1.6, type: 'sine', vol: 0.008 });
    }
  });
  // a stone footing, sunk to the lowest ground under it: no tower hangs
  let lowest = lhy;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    lowest = Math.min(lowest, terrainHeight(lhx + Math.cos(a) * 2.1, lhz + Math.sin(a) * 2.1));
  }
  const footH = lhy + 0.3 - (lowest - 0.5);
  const footing = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, footH, 9), mat(0x9aa0a6, 0.95));
  footing.position.y = 0.3 - footH / 2;
  footing.castShadow = true;
  footing.receiveShadow = true;
  lh.add(footing);
  // the beam: two faint cones, tip at the lamp, widening and fading out
  // over the water, back to back, turning slowly. subtle is the point.
  const fadeCv = document.createElement('canvas');
  fadeCv.width = 4; fadeCv.height = 64;
  const fctx = fadeCv.getContext('2d');
  const fgrad = fctx.createLinearGradient(0, 0, 0, 64);
  fgrad.addColorStop(0, '#fff'); // v=1: the tip, at the lamp
  fgrad.addColorStop(1, '#000'); // v=0: the far, wide end
  fctx.fillStyle = fgrad;
  fctx.fillRect(0, 0, 4, 64);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c0, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, alphaMap: new THREE.CanvasTexture(fadeCv),
  });
  const BEAM_L = 18;
  const beam = new THREE.Group();
  for (const s of [-1, 1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, BEAM_L, 10, 1, true), beamMat);
    cone.rotation.z = -s * Math.PI / 2; // tip toward the lamp
    cone.position.x = -s * BEAM_L / 2;
    beam.add(cone);
  }
  beam.position.y = 11.45;
  beam.visible = false;
  lh.add(beam);
  updates.push((dt) => {
    const f = glowLevel();
    beam.visible = f > 0.02;
    beamMat.opacity = 0.26 * f;
    beam.rotation.y -= dt * 0.35;
  });
  lh.position.set(lhx, lhy, lhz);
  group.add(lh);
  zones.addBlocker(lhx, lhz, 2.35);

  const towardShore = Math.atan2(D.x - lhx, D.z - lhz);
  register({
    pos: new THREE.Vector3(
      lhx + Math.sin(towardShore) * 2.8, 0, lhz + Math.cos(towardShore) * 2.8),
    r: 2.8,
    label: '옛 등대에 서 보기',
    use: async () => {
      await ui.say([
        '탑은 여전히 망을 보고 서 있어요, 하얗고 녹빨갛게. 꼭대기, 옛 큰 등불이 있던 자리에는 작은 전기 램프.',
        '등대 방, 지붕에 짧은 사슬로 매달린 빈 갈고리 — 녹이 아니라 윤기가 나요. 흔들리고 있어요. 저 위에는 바람이 없어요. 누군가 계속 닦고 있어요.',
        'A small plate reads: “HER LIGHT KEEPS THE CAFÉ WARM. HER BELL KEEPS THE SEA COMPANY. THE HOOK KEEPS ITS SHAPE, IN CASE.”',
        '그 아래, 살짝 비뚤게 나사로 고정된 새 명판: “전기 램프 설치됨. 그분의 빛은 아님. 최선을 다하는 중.”',
      ]);
      if (!S.hasFlag('sawLighthouse')) {
        S.setFlag('sawLighthouse');
        doorChime();
        ui.toast('파도 아주 아래에서, 무언가가 한 번 울려요. 아마 조수예요. 아마요.', '🔔');
      }
    },
  });

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
    updateRowboatOars(dt, playerPos);
    // idle boats bob at their moorings
    for (const data of boats) {
      if (!data.inUse) {
        // riding the swell it's moored in (it used to sit at one height and
        // let the waves wash over its gunwales)
        const b = data.boat;
        b.position.y = WATER_Y + waveAt(b.position.x, b.position.z, t) + 0.18;
        b.rotation.z = Math.sin(t * 1.1 + b.position.x) * 0.04;
        b.rotation.x = Math.sin(t * 0.8 + b.position.z) * 0.03;
      }
    }

    // ------------------------------------------------- a voyage underway ----
    if (voyage) {
      const v = voyage;
      v.elapsed += dt;
      // threading a gate? steer for it first (and don't dodge the gate's walls)
      while (v.via?.length && Math.hypot(v.via[0].x - tug.position.x, v.via[0].z - tug.position.z) < 3) v.via.shift();
      const aim = v.via?.length ? v.via[0] : v.dest.sea;
      const dx = aim.x - tug.position.x;
      const dz = aim.z - tug.position.z;
      const dist = v.via?.length ? 99 : Math.hypot(dx, dz);
      // steer for the anchorage; the shallows get a respectful berth
      let want = Math.atan2(dx, dz);
      let dodging = false;
      if (dist > 14) {
        if (shallowAhead(0, 13) || shallowAhead(0, 8)) {
          dodging = true;
          want = tug.rotation.y + (shallowAhead(0.5, 10) && !shallowAhead(-0.5, 10) ? -1.0 : 1.0);
        } else if (shallowAhead(0.4, 9)) {
          dodging = true;
          want = tug.rotation.y - 0.5;
        } else if (shallowAhead(-0.4, 9)) {
          dodging = true;
          want = tug.rotation.y + 0.5;
        }
      } else if (shallowAhead(0, 4)) {
        // close in, still mind the bottom (she used to scrape a sandbar or two on the way to the anchorage)
        dodging = true;
        want = tug.rotation.y + (shallowAhead(0.6, 4) && !shallowAhead(-0.6, 4) ? -0.8 : 0.8);
      }
      // (close in, she turns gently — she used to pirouette round the
      // anchorage, sweeping her stern through the dock)
      tug.rotation.y = turnToward(tug.rotation.y, want, dt, dodging ? 1.7 : dist < 12 ? 0.45 : 1.0);
      const targetSpeed = v.ghost ? 6 : dist < 12 ? Math.max(0.6, dist * 0.2) : 6.5;
      v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 0.8);
      tug.position.x += Math.sin(tug.rotation.y) * v.speed * dt;
      tug.position.z += Math.cos(tug.rotation.y) * v.speed * dt;

      if (!v.ghost) {
        // you, on deck, enjoying the spray
        const ry = tug.rotation.y;
        // standing ON the aft deck (deck top is 1.05 up), clear of the cabin
        player.group.position.set(
          tug.position.x - Math.sin(ry) * 2.9,
          tug.position.y + 1.05,
          tug.position.z - Math.cos(ry) * 2.9);
        player.group.rotation.y = ry;
        // the story, told over open water
        if (!v.storyFired && v.elapsed > 2.2 && !ui.isBusy()) {
          v.storyFired = true;
          ui.say(v.story, { speaker: '브라인 선장', voice: 340 });
        }
        // arrival — politely waits for Brine to finish the story
        if (!v.landing && (dist < 5 || v.elapsed > 90) && v.storyFired && !ui.isBusy()) {
          v.landing = true;
          landVoyage();
        }
      } else if (dist < 3) {
        // the ghost run home ends at her own mooring
        tug.position.set(tx, WATER_Y + 0.35, tz);
        tug.rotation.y = outA + 0.9;
        voyage = null;
      }

      // wake off the stern, smoke off the funnel
      wakeT -= dt;
      if (voyage && v.speed > 2 && wakeT <= 0) {
        wakeT = 0.1;
        const ry = tug.rotation.y;
        for (const side of [-1, 1]) {
          spawnBit(wakeBits, 0xeaf6f8, 0.16, 26,
            tug.position.x - Math.sin(ry) * 4.4 + Math.cos(ry) * side * 0.7,
            WATER_Y + 0.05,
            tug.position.z - Math.cos(ry) * 4.4 - Math.sin(ry) * side * 0.7);
        }
      }
      smokeT -= dt;
      if (voyage && v.speed > 1 && smokeT <= 0) {
        smokeT = 0.55; // an easy chuff, not a chimney fire
        const ry = tug.rotation.y;
        spawnBit(smokePuffs, 0xd8dde0, 0.2, 12,
          tug.position.x + Math.sin(ry) * 0.9,
          tug.position.y + 2.1,
          tug.position.z + Math.cos(ry) * 0.9);
      }
    }
    // foam and smoke age out whether or not anyone is sailing
    for (const list of [wakeBits, smokePuffs]) {
      const isSmoke = list === smokePuffs;
      const maxLife = isSmoke ? 2.8 : 1.5;
      for (const bit of list) {
        if (!bit.m.visible) continue;
        bit.life += dt;
        if (bit.life > maxLife) {
          bit.m.visible = false;
          continue;
        }
        const k = bit.life / maxLife;
        bit.m.material.opacity = (isSmoke ? 0.5 : 0.8) * (1 - k);
        bit.m.scale.setScalar(1 + k * (isSmoke ? 1.3 : 1.8));
        if (isSmoke) bit.m.position.y += dt * 0.55; // a lazy rise
      }
    }
    // Captain Brine watches you potter about the harbor
    if (playerPos) {
      const wp = new THREE.Vector3();
      brine.getWorldPosition(wp);
      const dx = playerPos.x - wp.x, dz = playerPos.z - wp.z;
      if (Math.hypot(dx, dz) < 10) {
        brine.rotation.y = turnToward(brine.rotation.y, Math.atan2(dx, dz) - tug.rotation.y, dt, 3);
      }
    }
  }

  // refreshed mid-row? you're still out there, oars in hand
  function resumeRowing(at) {
    const data = boats[S.state.rowing];
    if (!data || data.inUse) return false;
    boardBoat(data, at);
    return true;
  }

  return { group, update, resumeRowing };
}
