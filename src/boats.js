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
      label: 'row out to sea',
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
    ui.toast('You push off. The water holds you like it’s done this before.', '🚣');
    if (!S.hasFlag('firstRow')) {
      S.setFlag('firstRow');
      ui.say([
        'Oars in, oars out. The island shrinks behind you, politely.',
        'Steer for the smoking mountain, the bright water, or wherever the fins are going. To land again, nose up to any shore and press E.',
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
    label: 'go ashore',
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
      ui.toast('You hop ashore. The boat will wait — it’s good at that.', '⛵');
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
    'Captain Brine. Tug’s called the Persistent. She doesn’t tug much these days. Neither do I.',
    'Out past the volcano there’s a fog bank that hums, and rocks that sing back. Someday, a proper route. Today: the mountain run.',
    'Watch the reef glow when you row over it — bright water means small neighbors. Mind your oars.',
    'The old light there? I steered home by her a hundred times. Tip your hat when you pass. You don’t have a hat? The shop sells hats.',
  ];
  // ------------------------------------------------------ the sea stories ----
  // every route gets one. mandatory, the story.
  const STORIES = {
    volcano: [
      ['The Persistent grumbles away from the pier. Brine talks without turning around.',
       '“I was a deckhand the night the bell went down. Youngest aboard. The wave stood up like a wall with opinions.”',
       '“Tansy didn’t cry, you know. She just listened all the way down. Said it rang once, under the water. Said it sounded… relieved.”',
       '엔진이 안정돼요. 검은 바위가 창밖으로 흘러가요.'],
      ['“See the reef glowing off the port side? My grandmother called it the dropped crown. Said a sea-queen threw it away on purpose.”',
       '“Why on purpose? Because it kept singing, and she wanted to sleep. Royalty.” Brine snorts at her own joke for a while.',
       '화산이 앞에 커져 가요, 따뜻하고 태연하게.'],
      ['“The mountain? Oh, she and I get along. I whistle when I pass. She smokes when she’s pleased.”',
       '“한 번은 내가 불기 전에 먼저 뿜었어. 그 생각을 자주 해.”'],
    ],
    bulko: [
      ['“Warehouse run. Hold on to something.” The Persistent picks up speed, which is to say: some speed.',
       '“They asked me to decorate the lobster tank once. The lobsters had OPINIONS about the throw pillows. We don’t speak of it. The pillows stayed.”',
       '회색 건물이 물 위로 솟아요, 아주 정돈된 절벽처럼.'],
      ['“A buck and a half for the dog and the fizz. Since before the bell went down. I checked the ledgers myself.”',
       '“어떤 것들은 변함없어, 선원.” 가는 내내 더는 아무 말 없고, 그게 어쩐지 이번 주 최고의 대화예요.'],
      ['“오는 길에 차 본 적 있어? 없다고? 이상한 일이지—” 말을 멈춰요. “아니야. 거스 말이 맞아. 신경 쓰지 마.”'],
    ],
    far: [
      ['“Short hop, this. Time for a short story: the church over there has no bell. ON PURPOSE. First time I heard that, I laughed so hard I fouled the prop.”',
       '“그러다 한 번 비 피하러 앉아 있었어. 내 인생 가장 조용한 20분. 티 내는 것보다 자주 생각나.”'],
      ['“See the bones on the far shore? The Old Singer. Whale. Before your time, before MY time, and I’m older than the paint on this boat.”',
       '“어떤 밤엔 바람이 갈비뼈를 넘어와 섬 전체가 웅웅거려. 왜가리는 찬송가래. 난 날씨래. 둘 다 맞아.”'],
    ],
    north: [
      ['“North run. Mind the damp. The moss up there has TENURE, sailor — it was on the rocks before the rocks finished.”',
       '“박쥐가 도서관을 운영해. 매듭 책을 빌려준 적 있지. 매듭은 다 아는데. 그래도 읽었어. 예의잖아.”'],
      ['“Doctor up there’s an axolotl. Nobody on that island has ever been sick. She keeps the clinic anyway. ‘Readiness,’ she says.”',
       '“존경해. 퍼시스턴트도 몇 년째 끈 게 없어. 우리도 대비 중이지.”'],
    ],
    grove: [
      ['“Grove Isle. Old money. The Baron’s grandfather billed Old Tansy by the HOUR to not find that bell. I’ve seen the invoice. It’s in a gold frame.”',
       '“그런데도 — 과수원이 나왔어, 온천, 철도. 나쁜 거래에서 뭐가 자라는지, 백 년 지나면 재밌다니까.”'],
      ['“The capybaras run the springs. Don’t let the calm fool you. That calm took PRACTICE.”',
       '“한 마리는 오렌지를 올리고 있어. 물어보고 싶을 거야. 묻지 마. 어떤 것들은 하중을 받치고 있어.”'],
    ],
    labs: [
      ['“The Labs! They tried to buy the Persistent off me once. ‘Acoustic research,’ they said. Asked what they’d play through her. They said PINGS. She’s a tugboat, not a triangle.”',
       '“과일 바구니랑 기압계로 사과하더라. 솔직히 좋은 이웃이야. 기압계는 틀린 적이 없어. 짜증 나.”'],
      ['“They strung a telephone wire over the north causeway. One telephone. It calls the OTHER END OF THE BRIDGE. They’re very proud.”',
       '“한 번 걸어봤어. 두더지가 받더군. ‘없어도 들리는 거 아시죠’라더라. 장엄한 전선 낭비. 과학이야!”'],
      ['“They’re building a rocket out there. To the MOON, they say. You know what I say? Good.”',
       '“The sea’s been keeping our bell a hundred years. About time somebody from this archipelago went somewhere the sea can’t follow.”',
       '남은 길 내내 더는 말이 없어요. 슬픈 침묵은 아니에요.'],
    ],
    oasis: [
      ['“Oasis Estates. Fourteen applications I sent that woman. FOURTEEN. ‘The horn is too loud.’ I took off the horn. ‘The boat is too loud.’ I can’t take off the BOAT.”',
       '“And what did she approve in the end? One route. BULKO and back. For PAPER TOWELS. The Persistent is now, officially, a paper towel boat.”',
       '“끝에 클립보드 든 낙타가 있을 거야. 손 흔들어. 답례는 없을 거야. 네가 흔들었다고 적어둘 거야.”'],
      ['“Every house on that island is the same house. I sailed past twice to be sure. Then a third time, in case I’d gone funny. Same house.”',
       '“문지기 집 앵무새는 세 번 다 손을 흔들었어. 명단을 관리해. 명단은 비어 있어. 근사한 녀석이야.”'],
      ['“No bells on that island, you know. It’s in their rules. A Moledecai wrote it.”',
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
      label: '🍃 Notbell (home dock)',
      land: { x: D.x + ox * 3, z: D.z + oz * 3, rotY: Math.atan2(-ox, -oz) },
      sea: { x: tx + ox * 2, z: tz + oz * 2 },
    },
    volcano: {
      label: '🌋 The volcano',
      land: { x: vb.x, z: vb.z + 2, rotY: Math.PI },
      sea: seaOff(vb.x, vb.z + 2, VOLCANO.x, VOLCANO.z),
    },
    far: {
      label: '⛪ The Far Isle',
      land: farLand,
      sea: seaOff(farLand.x, farLand.z, ISLAND2.x, ISLAND2.z),
    },
    north: {
      label: '📚 The North Isle',
      land: northLand,
      sea: seaOff(northLand.x, northLand.z, ISLAND3.x, ISLAND3.z),
    },
    grove: {
      label: '🍊 Grove Isle',
      land: groveLand,
      sea: seaOff(groveLand.x, groveLand.z, ISLAND5.x, ISLAND5.z),
    },
    bulko: {
      label: '🛒 BULKO',
      land: { x: BULKO_DOCK.x, z: BULKO_DOCK.z, rotY: BULKO_DOCK.rotY },
      sea: seaOff(BULKO_DOCK.x, BULKO_DOCK.z, 8, 96),
    },
    labs: {
      label: '🚀 Notbell Labs',
      land: { x: LABS_DOCK.x, z: LABS_DOCK.z, rotY: LABS_DOCK.rotY },
      sea: seaOff(LABS_DOCK.x, LABS_DOCK.z, ISLAND6.x, ISLAND6.z),
    },
    farther: {
      label: '🏕️ Farther Isle',
      land: { x: FARTHER_DOCK.x, z: FARTHER_DOCK.z, rotY: FARTHER_DOCK.rotY },
      sea: seaOff(FARTHER_DOCK.x, FARTHER_DOCK.z, ISLAND7.x, ISLAND7.z),
    },
    // (the ONE route the HOA approved: BULKO and back — see stopMenu)
    oasis: {
      label: '🏡 Oasis Estates',
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
    ui.toast('The Persistent clears her throat and gets going.', '⛴️');
  }

  async function landVoyage() {
    const v = voyage;
    voyage = null;
    player.riding = false;
    await ui.fadeSwap(() => zones.go('island', v.dest.land));
    ui.toast(v.destId === 'home'
      ? 'Home port. The Persistent sighs happily.'
      : 'The Persistent putters off home. Ring a buoy when you want a lift.', '⛴️');
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
        'A broad gray goose looks up from a coil of rope she was clearly asleep on.',
        '“Captain Brine. The Persistent. We go everywhere worth going and two places that aren’t — ten buttons a leg, sea story included. Mandatory, the story.”',
      ], { speaker: 'Captain Brine', voice: 340 });
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
    if (hereId === 'home') choices.push({ label: 'Chat', value: 'chat' });
    choices.push({ label: 'Leave', value: null });
    const choice = await ui.ask('Where to, sailor?', choices, { speaker: 'Captain Brine', voice: 340 });
    if (!choice) return;
    if (choice === 'texas') {
      ui.say([
        'No.',
        '“The Persistent draws four feet of water. TEXAS draws ten inches of Texas. We’d beach her, and Pecos would charge us mooring fees on land HE doesn’t pay for either.”',
        '“Row. Swim. Walk at low tide, I don’t care. The Persistent does not do TEXAS.”',
      ], { speaker: 'Captain Brine', voice: 340 });
      return;
    }
    if (choice === 'chat') {
      ui.say(BRINE_LINES[brineIdx++ % BRINE_LINES.length], { speaker: 'Captain Brine', voice: 340 });
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
    label: 'hail Captain Brine',
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
      label: 'ring the buoy for the Persistent',
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
    label: 'stand at the old lighthouse',
    use: async () => {
      await ui.say([
        'The tower still stands watch, white and rust-red, a small electric lamp at the top where the great one used to be.',
        'Up in the lamp room, hanging from the roof on a short chain, is an empty hook — polished, not rusted. It is swaying. There is no wind up there. Someone keeps it polished.',
        'A small plate reads: “HER LIGHT KEEPS THE CAFÉ WARM. HER BELL KEEPS THE SEA COMPANY. THE HOOK KEEPS ITS SHAPE, IN CASE.”',
        'Under it, a newer plate, screwed on slightly crooked: “ELECTRIC LAMP FITTED. IT IS NOT HER LIGHT. IT DOES ITS BEST.”',
      ]);
      if (!S.hasFlag('sawLighthouse')) {
        S.setFlag('sawLighthouse');
        doorChime();
        ui.toast('Far below the waves, something rings once. Probably the tide. Probably.', '🔔');
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
          ui.say(v.story, { speaker: 'Captain Brine', voice: 340 });
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
