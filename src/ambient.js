// Ambient lives. Villagers run little errands — a coffee at the Lantern
// Room, browsing at Pip's, a quiet sit in the Listening House, a turn
// around the garden — and when you're there to see it, they chat with the
// keepers in small floating bubbles. Friends also meet up out in the open
// and have entire conversations whether or not you eavesdrop. (Eavesdrop.)

import * as THREE from 'three';
import { register } from './interact.js';
import * as zones from './zones.js';
import * as ui from './ui.js';
import { SITES, terrainHeight, ISLAND2, ISLAND3, ISLAND5, ISLAND7, ISLAND8, ISLAND9, ISLET_CH } from './terrain.js';
import { rand, pick } from './utils.js';
import { FRIENDS } from './villagers.js';
import * as doors from './doors.js';

// ---------------------------------------------------------- bubbles ----

const bubbleCache = new Map();
const BUBBLE_FADE_NEAR = 10;
const BUBBLE_FADE_FAR = 26;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function updateBubbleOpacity(bubble, playerPos) {
  if (!bubble?.material) return;
  if (!playerPos) {
    bubble.material.opacity = 1;
    return;
  }
  const dist = Math.hypot(playerPos.x - bubble.position.x, playerPos.z - bubble.position.z);
  bubble.material.opacity = 1 - smoothstep(BUBBLE_FADE_NEAR, BUBBLE_FADE_FAR, dist);
}

function bubbleSprite(text) {
  if (!bubbleCache.has(text)) {
    // wrap to fit: the bubble grows for chatty villagers instead of clipping
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const font = '600 34px ui-rounded, "Segoe UI", system-ui, sans-serif';
    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const probe = line ? line + ' ' + w : w;
      if (ctx.measureText(probe).width > 440 && line) {
        lines.push(line);
        line = w;
      } else {
        line = probe;
      }
    }
    if (line) lines.push(line);
    const H = 44 + lines.length * 42;
    cv.width = 512;
    cv.height = H;
    ctx.font = font; // canvas resize resets state
    ctx.fillStyle = 'rgba(255,250,240,0.96)';
    ctx.strokeStyle = '#e8d5ae';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, H - 16, 30);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5b4a32';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, 256, 22 + (i + 0.5) * 42));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { h: H };
    bubbleCache.set(text, tex);
  }
  const tex = bubbleCache.get(text);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
  }));
  sprite.scale.set(3.4, 3.4 * (tex.userData.h / 512), 1);
  return sprite;
}

// ----------------------------------------------------------- venues ----
// guest: where a visitor stands/sits · keeper: who they chat with

const VENUES = [
  // the Isle of Cran (rooms at x -300, z 1600/1680/1760 — cran.js)
  {
    id: 'cran_records', zone: 'cran_records',
    guest: { x: -299.6, z: 1682.6, rotY: Math.PI },
    keeper: { x: -303.1, z: 1676.5 },
    guestLine: '쉿. B면이야.',
    chats: [
      [['g', '새로 온 거 있어?'], ['k', '…새로 온 거의… 정의가…'], ['g', '지난주 이후로.'], ['k', '지난주 분을… 아직도… 꽂는 중이야.']],
      [['g', '부스 써도 돼?'], ['k', '천천히… 해.'], ['g', '그럴게.'], ['k', '알… 고 있어.']],
    ],
  },
  {
    id: 'cran_cc', zone: 'cran_cc',
    guest: { x: -293, z: 1762.4, rotY: 0 },
    keeper: { x: -300, z: 1755.6 },
    guestLine: '모임 때문에 왔어. 정서적으로.',
    chats: [
      [['g', '오늘 줌바 하는 날이야?'], ['k', '이 건물 어딘가에서는 항상 줌바를 하고 있어.']],
      [['g', '안녕. 나흘 만이야.'], ['k', '나흘은 나흘이지.']],
    ],
  },
  {
    id: 'cafe', zone: 'cafe',
    guest: { x: 305.1, z: 81.2, rotY: -2.0 },
    keeper: { x: 298, z: 76.2 },
    guestLine: '쉿. 커피.',
    chats: [
      [['g', '랜턴 로스트 하나요.'], ['k', '여기서 드실 거죠, 몽상가님?'], ['g', '항상 여기서요.']],
      [['g', '오늘 램프 따뜻해요?'], ['k', '램프는 항상 따뜻해.'], ['g', '좋아요. 좋아요.']],
      [['g', '칩, 느린 곡 틀어 줘!'], ['k', '걘 느린 곡밖에 몰라.']],
    ],
  },
  {
    id: 'shop', zone: 'shop',
    guest: { x: 302.2, z: -1.0, rotY: -2.4 },
    keeper: { x: 300, z: -3.6 },
    guestLine: '결정, 결정.',
    chats: [
      [['g', '반짝이는 거 얼마예요?'], ['k', '어떤 반짝이?'], ['g', '…전부요.']],
      [['g', '이거 배에서 떨어진 거예요?'], ['k', '공식적으로? 응.'], ['g', '살게요.']],
      [['g', '핍, 그거 내 버튼이야.'], ['k', '네 버튼이었지.']],
    ],
  },
  {
    id: 'museum', zone: 'museum',
    guest: { x: 295, z: 161, rotY: -1.2 },
    keeper: { x: 297.5, z: 158.5 },
    guestLine: '구경 중. 배우는 중. 주로 구경 중.',
    chats: [
      [['g', '이 화석 나를 평가하는 것 같아.'], ['k', '억겁의 연습을 거쳤거든.']],
      [['g', '저거 내가 기증한 거야!'], ['k', '그래서 소중히 여겨지고 있지, 얘야.']],
    ],
  },
  {
    id: 'church', zone: 'church',
    guest: { x: 302.6, y: 0.5, z: 979.45, rotY: Math.PI }, // on the pew, not in it
    keeper: { x: 300, z: 974.8 },
    guestLine: '(listening)',
    chats: [
      [['g', '…'], ['k', '…'], ['g', '(만족)']],
      [['g', '오늘 거의 들릴 뻔했어.'], ['k', '그럼 오늘은 좋은 날이네.']],
    ],
  },
  {
    id: 'garden', zone: 'island',
    guest: () => ({ x: SITES.garden2.x - 1.2, z: SITES.garden2.z + 3.4, rotY: Math.PI }),
    keeper: null,
    guestLine: '정말 좋은 분수야.',
    chats: [
      [['g', '(꽃을 한 송이씩 맡는 중)']],
      [['g', '저 구름 좀 봐. 구름 좀 봐.']],
    ],
  },
];

// ------------------------------------------------------------ logic ----

export function createAmbient(animals, scene) {
  const busyVenues = new Set();
  const errands = [];
  const meetings = [];
  let poll = 12; // let the island settle before anyone goes shopping

  // (a villager still WALKING to their errand is out and about, not away)
  function setAway(a) {
    a.away = !!a.home || (!!a.errand && a.errand.phase !== 'going') || !!a.meeting;
  }

  function byName(name) {
    return animals.find((x) => x.identity?.name === name);
  }

  // talking to someone who's out on an errand
  for (const a of animals) {
    if (!a.identity) continue;
    register({
      getPos: () => a.g.position,
      r: 2.4,
      zone: () => a.errand?.venue.zone ?? '__nowhere',
      enabled: () => !!a.errand,
      label: () => `talk to ${a.identity.name}`,
      use: () => {
        ui.say(a.errand.venue.guestLine, { speaker: a.identity.name, voice: a.identity.voice });
      },
    });
    // ...or interrupting them mid-meetup (they don't mind. mostly.)
    register({
      getPos: () => a.g.position,
      r: 2.6,
      enabled: () => !!a.meeting && !a.meeting.pending,
      label: () => `talk to ${a.identity.name}`,
      use: () => {
        const line = a.meeting?.pair.meetLines?.[a.identity.name] ||
          '(They are mid-conversation, and politely include you in the pause.)';
        ui.say(line, { speaker: a.identity.name, voice: a.identity.voice });
      },
    });
  }

  // ---------------------------------------------------------- meetups ----

  function startMeeting(pair) {
    const A = byName(pair.a), B = byName(pair.b);
    if (!A || !B) return null;
    if (A.home || B.home || A.errand || B.errand || A.meeting || B.meeting ||
        A.goal || B.goal || A.pastime || B.pastime) return null;
    // friends WALK over now (the instant-travel era is closed — scandalous,
    // the things villagers did when nobody was watching). Too far apart
    // today? Then today isn't the day; the friendship survives.
    const hx = A.g.position.x, hz = A.g.position.z;
    // (friends on different islands walk over too, when there's a way — the
    // bridges and trains — and it isn't a whole expedition)
    const apart = Math.hypot(B.g.position.x - hx, B.g.position.z - hz);
    if (apart > 42 && (apart > 140 || !zones.findRoute(zones.islandOf(hx, hz), zones.islandOf(B.g.position.x, B.g.position.z)))) return null;
    // a proper conversational distance: close enough to gossip, far enough
    // that nobody's beak ends up in anybody's ear
    const GAP = 2.5;
    let gx = hx + GAP, gz = hz;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const tx = hx + Math.cos(ang) * GAP, tz = hz + Math.sin(ang) * GAP;
      if (zones.islandCanWalk(tx, tz) && terrainHeight(tx, tz) > 0.3) {
        gx = tx;
        gz = tz;
        break;
      }
    }
    const m = {
      pair, A, B,
      pending: true, // B is on the way; the meeting starts when they arrive
      walkPatience: 50,
      returnTo: { x: B.g.position.x, z: B.g.position.z },
      until: rand(40, 75),
      chatCooldown: rand(2, 6),
      exchange: null,
      bubble: null,
    };
    A.meeting = m; // the host stands and waits — friends are worth it
    setAway(A);
    B.goal = {
      x: gx, z: gz, r: 0.45,
      done: () => {
        if (!m.pending) return;
        m.pending = false;
        B.meeting = m;
        setAway(B);
        A.g.rotation.y = Math.atan2(B.g.position.x - hx, B.g.position.z - hz); // square up, like friends do
        B.g.rotation.y = Math.atan2(hx - B.g.position.x, hz - B.g.position.z);
      },
      fail: () => endMeeting(m),
    };
    meetings.push(m);
    return m;
  }

  function endMeeting(m) {
    clearBubble(m);
    const wasPending = m.pending;
    if (wasPending && m.B.goal) m.B.goal = null; // never arrived; resume rambling
    m.A.meeting = null;
    m.B.meeting = null;
    setAway(m.A);
    setAway(m.B);
    if (!m.A.home && !m.A.errand) m.A.g.visible = true;
    if (!m.B.home && !m.B.errand) m.B.g.visible = true;
    if (!wasPending && !m.B.home && !m.B.errand && !m.B.bedtime) {
      // strolls back to their old patch, unhurried, full of gossip
      m.B.goal = { x: m.returnTo.x, z: m.returnTo.z, r: 1.6 };
      m.B.state = 'idle';
      m.B.timer = rand(1, 3);
    }
    m.A.state = 'idle';
    m.A.timer = rand(1, 3);
    meetings.splice(meetings.indexOf(m), 1);
  }

  function showMeetLine(m, [who, text]) {
    clearBubble(m);
    const speaker = who === 'a' ? m.A : m.B;
    const bubble = bubbleSprite(text);
    bubble.position.set(speaker.g.position.x, speaker.g.position.y + 2.8, speaker.g.position.z);
    scene.add(bubble);
    m.bubble = bubble;
  }

  // Errands are journeys now: walk to the door, go in, stay a while, come
  // out the same door, and stroll home. Nobody blinks in or out of the world.
  function startErrand(a, venue) {
    const spot = typeof venue.guest === 'function' ? venue.guest() : venue.guest;
    const door = venue.zone === 'island' ? spot : zones.doorOf(venue.zone);
    if (!door) return false;
    // walkers go where their legs can take them — no swimming the strait
    if (Math.hypot(a.g.position.x - door.x, a.g.position.z - door.z) > 40) return false;
    const e = {
      venue, spot, door, phase: 'going',
      until: rand(120, 260),
      returnTo: { x: a.g.position.x, z: a.g.position.z },
      chatCooldown: rand(4, 10),
      exchange: null,
      bubble: null,
    };
    a.errand = e;
    busyVenues.add(venue.id);
    setAway(a);
    a.goal = {
      x: door.x, z: door.z, r: 1.2,
      done: () => {
        if (a.errand !== e) return;
        const goIn = () => {
          if (a.errand !== e) return;
          e.phase = 'inside';
          setAway(a);
          a.g.position.set(spot.x,
            venue.zone === 'island' ? terrainHeight(spot.x, spot.z) : (spot.y ?? 0), spot.z);
          a.g.rotation.y = spot.rotY ?? 0;
        };
        // through the front door, if it's one that opens
        const th = venue.zone !== 'island' && doors.threshold(venue.zone);
        if (!th) { goIn(); return; }
        doors.open(venue.zone, 1.8);
        doors.through(a, a.g.position, th, goIn);
      },
      fail: () => {
        if (a.errand !== e) return;
        busyVenues.delete(venue.id);
        a.errand = null;
        setAway(a);
      },
    };
    return true;
  }

  function endErrand(a) {
    const e = a.errand;
    if (!e) return;
    clearBubble(e);
    busyVenues.delete(e.venue.id);
    a.errand = null;
    if (e.phase === 'going') {
      a.goal = null; // never got there; carry on rambling
      setAway(a);
      return;
    }
    setAway(a);
    if (!a.home && !a.meeting) a.g.visible = true;
    if (!a.home) {
      // out the same door, and an unhurried walk back to their patch
      // (or, at bedtime, houses.js points them home instead)
      const th = doors.threshold(e.venue.zone);
      const onward = () => {
        if (!a.bedtime) a.goal = { x: e.returnTo.x, z: e.returnTo.z, r: 1.6 };
        a.state = 'idle';
        a.timer = rand(1, 3);
      };
      if (th) {
        doors.open(e.venue.zone, 1.8);
        doors.through(a, { x: th.x, y: th.y, z: th.z }, { x: e.door.x, y: terrainHeight(e.door.x, e.door.z), z: e.door.z }, onward);
      } else {
        a.g.position.set(e.door.x, terrainHeight(e.door.x, e.door.z), e.door.z);
        onward();
      }
    }
  }

  function clearBubble(e) {
    if (e.bubble) {
      scene.remove(e.bubble);
      e.bubble.material.dispose();
      e.bubble = null;
    }
  }

  // ------------------------------------------------------- pastimes ----
  // Villagers have hobbies. Now and then one strolls down to the shore with
  // a rod and fishes a while, or takes a net out among the flowers. They
  // walk there, do it for a bit (really do it), and wander on.
  const pastimes = [];
  let pastimeT = 20;

  function makeRod() {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.7, 5), mat(0x8a5a3a));
    pole.rotation.x = 0.9;
    pole.position.set(0.28, 1.25, 0.95);
    g.add(pole);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.6, 3), mat(0xf5f2e9));
    line.position.set(0.28, 1.0, 1.62);
    g.add(line);
    const bobber = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xd84f4f));
    bobber.position.set(0.28, 0.22, 1.62);
    g.add(bobber);
    g.userData.bobber = bobber;
    return g;
  }

  function makeNet() {
    const g = new THREE.Group();
    const mat = (c, o = 1) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, transparent: o < 1, opacity: o });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.4, 5), mat(0xa97c50));
    pole.position.y = 0.7;
    g.add(pole);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 4, 10), mat(0xd9d2c0));
    hoop.position.y = 1.5;
    g.add(hoop);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.35, 8, 1, true), mat(0xffffff, 0.55));
    mesh.rotation.x = Math.PI;
    mesh.position.y = 1.32;
    g.add(mesh);
    const holder = new THREE.Group(); // pivot at the paw, so it can swish
    holder.add(g);
    g.position.set(0, -0.9, 0);
    holder.position.set(0.3, 1.0, 0.4);
    return holder;
  }

  // a dry spot at the water's edge near someone, facing the sea
  function shoreSpotNear(a) {
    const p = a.g.position;
    for (let k = 0; k < 24; k++) {
      const ang = rand(0, Math.PI * 2), r = rand(4, 16);
      const x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r;
      const h = terrainHeight(x, z);
      if (h < 0.2 || h > 1.2 || !zones.islandCanStand(x, z, 0.3)) continue;
      for (let q = 0; q < 8; q++) {
        const wa = (q / 8) * Math.PI * 2;
        const wx = x + Math.sin(wa) * 2.4, wz = z + Math.cos(wa) * 2.4;
        if (terrainHeight(wx, wz) < -0.6 && !zones.seaBlocked(wx, wz)) return { x, z, face: wa };
      }
    }
    return null;
  }

  function meadowSpotNear(a) {
    const p = a.g.position;
    for (let k = 0; k < 16; k++) {
      const ang = rand(0, Math.PI * 2), r = rand(3, 10);
      const x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r;
      if (terrainHeight(x, z) > 0.8 && zones.islandCanStand(x, z, 0.4)) return { x, z, face: rand(0, Math.PI * 2) };
    }
    return null;
  }

  function startPastime(a, kind) {
    const spot = kind === 'fish' ? shoreSpotNear(a) : meadowSpotNear(a);
    if (!spot) return;
    const p = { a, kind, spot, t: 0, left: rand(35, 80), prop: null };
    a.pastime = p;
    pastimes.push(p);
    a.goal = {
      x: spot.x, z: spot.z, r: 0.8,
      done: () => {
        if (a.pastime !== p) return;
        a.busy = true; // stand still and get on with it
        a.g.rotation.y = spot.face;
        p.prop = kind === 'fish' ? makeRod() : makeNet();
        // held at the paw, outside the body — wide folks hold it wider
        const half = 0.5 * (a.g.userData.parts?.body?.scale.x ?? 1);
        if (kind === 'fish') p.prop.position.x = half - 0.18;
        else p.prop.position.x = half + 0.12 - 0.3;
        a.g.add(p.prop);
      },
      fail: () => endPastime(p),
    };
  }

  function endPastime(p) {
    const a = p.a;
    if (p.prop) a.g.remove(p.prop);
    a.pastime = null;
    a.busy = false;
    pastimes.splice(pastimes.indexOf(p), 1);
    a.state = 'idle';
    a.timer = rand(1, 3);
  }

  function updatePastimes(dt) {
    pastimeT -= dt;
    if (pastimeT <= 0) {
      pastimeT = rand(14, 28);
      if (pastimes.length < 3) {
        const free = animals.filter((a) => a.identity && !a.home && !a.bedtime && !a.errand &&
          !a.meeting && !a.goal && !a.riding && !a.away && !a.pastime && !a.swims);
        if (free.length) startPastime(pick(free), Math.random() < 0.6 ? 'fish' : 'bugs');
      }
    }
    for (const p of [...pastimes]) {
      const a = p.a;
      if (a.home || a.bedtime || a.errand || a.meeting || a.riding) { endPastime(p); continue; }
      if (!p.prop) continue; // still walking there
      p.t += dt;
      if (p.kind === 'fish') {
        // the bobber bobs; now and then it dips, and they lean in
        const dip = Math.sin(p.t * 0.9) > 0.97 ? -0.12 : 0;
        p.prop.userData.bobber.position.y = 0.22 + Math.sin(p.t * 2.4) * 0.03 + dip;
      } else {
        // a patient sweep, then a quick swish
        p.prop.rotation.x = Math.sin(p.t * (Math.sin(p.t * 0.3) > 0.6 ? 6 : 1.2)) * 0.6;
        a.g.rotation.y = p.spot.face + Math.sin(p.t * 0.4) * 0.8;
      }
      if (p.t > p.left) endPastime(p);
    }
  }

  // ------------------------------------------------------ wanderlust ----
  // The little random dudes (anyone not anchored to a place) get restless:
  // now and then one sets off for another island — over the footbridge,
  // along the arch, or by train — and makes it home at bedtime the same way.
  const ROAM = {
    notbell: { x: 0, z: 0, R: 24 },
    far: { x: ISLAND2.x, z: ISLAND2.z, R: ISLAND2.r - 4 },
    north: { x: ISLAND3.x, z: ISLAND3.z, R: ISLAND3.r - 4 },
    labs: { x: SITES.labsYard.x, z: SITES.labsYard.z, R: 12 },
    grove: { x: ISLAND5.x, z: ISLAND5.z, R: ISLAND5.r - 5 },
    farther: { x: ISLAND7.x, z: ISLAND7.z, R: ISLAND7.r - 5 },
    cran: { x: ISLAND9.x - 8, z: ISLAND9.z + 3, R: 11 }, // the village side of the creek
    oasis: { x: ISLAND8.x - 1, z: ISLAND8.z - 12, R: 9 }, // the Commons and the Parkway (the lawns are Beverly's)
    chuckee: { x: ISLET_CH.x - 2, z: ISLET_CH.z, R: 2.5 },   // a brisket, a look at the cars, and back
  };
  let roamT = 30;
  function updateRoaming(dt) {
    roamT -= dt;
    if (roamT > 0) return;
    roamT = rand(35, 70);
    const travelers = animals.filter((a) => a.roaming).length;
    if (travelers >= 3) return;
    const free = animals.filter((a) => a.identity && !a.anchored && !a.home && !a.bedtime &&
      !a.errand && !a.meeting && !a.goal && !a.riding && !a.away && !a.pastime && !a.swims);
    if (!free.length) return;
    const a = pick(free);
    const here = zones.islandOf(a.g.position.x, a.g.position.z);
    const options = Object.keys(ROAM).filter((k) => k !== here && zones.findRoute(here, k));
    if (!options.length) return;
    const dest = ROAM[pick(options)];
    for (let k = 0; k < 20; k++) {
      const ang = rand(0, Math.PI * 2), r = Math.sqrt(rand(0, 1)) * dest.R;
      const x = dest.x + Math.cos(ang) * r, z = dest.z + Math.sin(ang) * r;
      if (!zones.islandCanStand(x, z, 0.4) || terrainHeight(x, z) < 0.4) continue;
      a.roaming = true;
      a.goal = {
        x, z, r: 1.5,
        done: () => { a.roaming = false; a.range = { ...dest }; },
        fail: () => { a.roaming = false; },
      };
      return;
    }
  }

  function update(dt, playerPos) {
    updatePastimes(dt);
    updateRoaming(dt);
    poll -= dt;
    if (poll <= 0) {
      poll = 6;
      // someone might feel like an outing
      if (Math.random() < 0.5) {
        const venue = pick(VENUES.filter((v) => !busyVenues.has(v.id)));
        const door = venue && (venue.zone === 'island'
          ? (typeof venue.guest === 'function' ? venue.guest() : venue.guest)
          : zones.doorOf(venue.zone));
        // someone already nearby — errands are walks, not expeditions
        const candidates = door ? animals.filter((a) =>
          a.identity && !a.home && !a.errand && !a.meeting && !a.swims &&
          !a.goal && !a.riding && !a.away && !a.pastime &&
          Math.hypot(a.g.position.x - door.x, a.g.position.z - door.z) < 40) : [];
        if (candidates.length) startErrand(pick(candidates), venue);
      }
      // and friends find each other
      if (Math.random() < 0.35 && meetings.length < 2) {
        startMeeting(pick(FRIENDS));
      }
    }

    for (const m of [...meetings]) {
      if (m.A.home || m.B.home || m.A.bedtime || m.B.bedtime) { endMeeting(m); continue; } // bedtime wins
      if (m.pending) {
        // the guest is still walking over; the host waits, politely
        m.walkPatience -= dt;
        if (m.walkPatience <= 0) endMeeting(m);
        continue;
      }
      m.until -= dt;
      if (m.until <= 0) { endMeeting(m); continue; }
      const meetingVisible = zones.current() === 'island';
      m.A.g.visible = meetingVisible;
      m.B.g.visible = meetingVisible;
      // the conversation is only audible with an audience
      const near = meetingVisible && playerPos &&
        Math.hypot(playerPos.x - m.A.g.position.x, playerPos.z - m.A.g.position.z) < 18;
      if (!near) {
        if (m.exchange) { clearBubble(m); m.exchange = null; }
        continue;
      }
      if (m.exchange) {
        m.exchange.t -= dt;
        if (m.exchange.t <= 0) {
          clearBubble(m);
          m.exchange.idx += 1;
          const line = m.exchange.lines[m.exchange.idx];
          if (!line) {
            m.exchange = null;
            m.chatCooldown = rand(10, 24);
          } else {
            showMeetLine(m, line);
            m.exchange.t = 2.8;
          }
        }
      } else {
        m.chatCooldown -= dt;
        if (m.chatCooldown <= 0) {
          const lines = pick(m.pair.chats);
          m.exchange = { lines, idx: 0, t: 2.8 };
          showMeetLine(m, lines[0]);
        }
      }
    }

    for (const a of animals) {
      const e = a.errand;
      if (!e) continue;
      if (a.home || a.bedtime) { endErrand(a); continue; } // bedtime beats errands
      if (e.phase === 'going') continue; // still on the way
      e.until -= dt;
      if (e.until <= 0) { endErrand(a); continue; }

      // chatter, but only when someone's there to enjoy it
      const visibleHere = zones.current() === e.venue.zone;
      a.g.visible = visibleHere;
      if (!visibleHere) {
        if (e.exchange) { clearBubble(e); e.exchange = null; }
        continue;
      }
      if (e.exchange) {
        e.exchange.t -= dt;
        if (e.exchange.t <= 0) {
          clearBubble(e);
          e.exchange.idx += 1;
          const line = e.exchange.lines[e.exchange.idx];
          if (!line) {
            e.exchange = null;
            e.chatCooldown = rand(18, 40);
          } else {
            showLine(a, e, line);
            e.exchange.t = 2.8;
          }
        }
      } else {
        e.chatCooldown -= dt;
        if (e.chatCooldown <= 0) {
          const lines = pick(e.venue.chats);
          e.exchange = { lines, idx: 0, t: 2.8 };
          showLine(a, e, lines[0]);
        }
      }
    }

    for (const m of meetings) updateBubbleOpacity(m.bubble, playerPos);
    for (const a of animals) updateBubbleOpacity(a.errand?.bubble, playerPos);
  }

  function showLine(a, e, [who, text]) {
    clearBubble(e);
    const bubble = bubbleSprite(text);
    if (who === 'k' && e.venue.keeper) {
      bubble.position.set(e.venue.keeper.x, 3.1, e.venue.keeper.z);
    } else {
      bubble.position.set(a.g.position.x, a.g.position.y + 2.8, a.g.position.z);
    }
    scene.add(bubble);
    e.bubble = bubble;
  }

  // test/debug: send someone on a specific outing right now
  function forceErrand(name, venueId) {
    const a = animals.find((x) => x.identity?.name === name);
    const venue = VENUES.find((v) => v.id === venueId);
    if (a && venue && !a.errand && !a.home) startErrand(a, venue);
  }

  // test/debug: make two friends meet up right now; reports where
  function forceMeeting(name) {
    const pair = FRIENDS.find((f) => f.a === name || f.b === name);
    const m = pair && startMeeting(pair);
    return m ? { host: m.pair.a, x: m.A.g.position.x, z: m.A.g.position.z } : null;
  }

  return { update, forceErrand, forceMeeting };
}
