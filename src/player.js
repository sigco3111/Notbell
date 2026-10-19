import * as THREE from 'three';
import { terrainHeight, PLAYER_SPAWN, WATER_Y } from './terrain.js';
import { buildAnimal, animateGait } from './animals.js';
import { turnToward } from './utils.js';
import * as zones from './zones.js';
import * as ui from './ui.js';
import { coffeeActive, countItem, state, setFlag, hasFlag } from './state.js';
import { applyHat } from './hats.js';
import { plop } from './audio.js';

const WALK_SPEED = 4.6;
const RUN_SPEED = 8.2;
const COFFEE_MULT = 1.35; // Luna's Lantern Roast is not decaf
const SWIM_MULT = 0.55;   // the sea charges a convenience fee
const SKATE_SPEED = 14.5; // Pip's skateboard: ultimate zoomability
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Pip's skateboard: a plank, four wheels, and a stripe for speed
function buildSkateboard() {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 1.35),
    new THREE.MeshStandardMaterial({ color: 0xe8743a, flatShading: true, roughness: 0.6 }));
  deck.position.y = 0.13;
  g.add(deck);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xfff3da, flatShading: true, roughness: 0.6 }));
  stripe.position.y = 0.135;
  g.add(stripe);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xf2cf5b, flatShading: true, roughness: 0.5 });
  for (const sx of [-0.24, 0.24]) {
    for (const sz of [-0.45, 0.45]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 7), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx, 0.07, sz);
      g.add(w);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// the diver's kit: swim goggles (a strap, two round lenses) and a snorkel.
// Up on your forehead while you paddle about; down over your eyes, snorkel
// in, only when you actually go under. (It used to be a brass bell over
// the whole head, the moment you got your paws wet. Tansy's divers wore
// one. It was, everyone agrees, a lot.)
function buildGoggles() {
  const g = new THREE.Group();
  const rubber = new THREE.MeshStandardMaterial({ color: 0x2e4a5a, flatShading: true, roughness: 0.6 });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 4, 16), rubber);
  strap.rotation.x = Math.PI / 2;
  g.add(strap);
  for (const sx of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 10), rubber);
    rim.position.set(sx * 0.14, 0, 0.4);
    g.add(rim);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0.55, roughness: 0.1 }));
    lens.position.set(sx * 0.14, 0, 0.415);
    g.add(lens);
  }
  const snorkel = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0xf2cf5b, flatShading: true, roughness: 0.5 }));
  tube.position.y = 0.2;
  snorkel.add(tube);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.08, 6), rubber);
  tip.position.y = 0.5;
  snorkel.add(tip);
  snorkel.position.set(0.32, 0, 0.18);
  g.add(snorkel);
  g.userData.snorkel = snorkel;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// a wetsuit: a snug second skin over the body, same shape, diver's colors
function buildWetsuit(body) {
  const suit = new THREE.Mesh(body.geometry, new THREE.MeshStandardMaterial({ color: 0x2e4a5a, flatShading: true, roughness: 0.7 }));
  suit.scale.setScalar(1.035);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 4, 14), new THREE.MeshStandardMaterial({ color: 0xf2cf5b, flatShading: true }));
  suit.add(stripe); // round the middle
  suit.castShadow = true;
  return suit;
}

// the bubble helmet: a fishbowl with delusions and three patents.
// your hat fits under it. they checked. they checked WITH HATS.
function buildBubble() {
  const b = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1),
    new THREE.MeshStandardMaterial({
      color: 0xcfe8f2, transparent: true, opacity: 0.18,
      roughness: 0.1, flatShading: true, side: THREE.DoubleSide, depthWrite: false,
    }));
  glass.position.y = 0.06;
  b.add(glass);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xc9962e, flatShading: true, roughness: 0.45 }));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.4;
  collar.castShadow = true;
  b.add(collar);
  return b;
}

// the hero carries a little of her own light: a gentle self-emissive so no
// facet ever goes fully dark. Those "shadows" on the front/lower body were
// never shadow maps — just faces the sun wasn't talking to. Now the player
// reads from every side, and the facets still facet.
function warmUp(g) {
  g.traverse((o) => {
    if (o.isMesh && !o.material.transparent && o.material.emissive) {
      o.material.emissive.copy(o.material.color);
      o.material.emissiveIntensity = 0.16;
    }
  });
}

export function createPlayer() {
  const avatar = state.avatar || { kind: 'cat', body: 0xf0c98f };
  const group = buildAnimal(avatar.kind, { body: avatar.body });
  group.userData.noFidget = true; // you face where YOU choose
  warmUp(group);

  group.position.set(
    PLAYER_SPAWN.x,
    terrainHeight(PLAYER_SPAWN.x, PLAYER_SPAWN.z),
    PLAYER_SPAWN.z
  );
  group.rotation.y = Math.PI; // wake up facing the village

  // a faint personal glow — invisible under the sun, a small mercy in the cave
  const lantern = new THREE.PointLight(0xffd9a0, 8, 7, 2);
  lantern.position.y = 1.6;
  group.add(lantern);

  const keys = new Set();
  // double-tap any direction to run (it stays a run until you let go)
  let lastTap = { code: null, t: 0 };
  let runLatch = false;
  addEventListener('keydown', (e) => {
    if (MOVE_KEYS.includes(e.code) && !e.repeat) {
      const now = performance.now();
      if (lastTap.code === e.code && now - lastTap.t < 300) runLatch = true;
      lastTap = { code: e.code, t: now };
    }
    keys.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (!MOVE_KEYS.some((k) => keys.has(k))) runLatch = false;
  });
  addEventListener('blur', () => { keys.clear(); runLatch = false; });
  let board = null;
  let skating = false;

  let walk = 0;
  let goggles = null;
  let gogglesMode = 'off'; // 'off' | 'up' (paddling) | 'down' (under)
  let wetsuit = null;
  let bubble = null;
  let bubbleOn = false;
  let wasSwimming = false;

  // ducks were born for this; everyone else needs the diver's suit
  function canSwim() {
    return state.avatar?.kind === 'duck' || countItem('scuba_suit') > 0;
  }

  function swimWater(x, z) {
    return zones.current() === 'island' &&
      terrainHeight(x, z) <= WATER_Y + 0.12 &&
      !zones.seaBlocked(x, z) && // even a duck can't swim through rock
      !zones.solidAt(x, z) &&
      Math.hypot(x - 40, z - 40) < 220; // the archipelago's waters end somewhere
  }

  // a body, not a point: your shoulders stop at the wall, not your nose.
  // (if you're somehow already overlapping something — a door spawn, a
  // villager's house that grew around you — any step that isn't deeper
  // into trouble is allowed, so nobody is ever pinned in place)
  const BODY_R = 0.3;
  // villagers are solid too (main.js hands us the list). a crocodile is
  // mostly snout, so crocs get a second circle out front.
  function bumpsSomeone(x, z) {
    if (zones.current() !== 'island') return false;
    const p = group.position;
    for (const a of self.bodies) {
      if ((a.away && !a.meeting) || a.riding || !a.g.visible) continue;
      const ap = a.g.position;
      if (Math.abs(ap.y - p.y) > 1.2) continue;
      const circles = a.long
        ? [[ap.x, ap.z, 0.75], [ap.x + Math.sin(a.g.rotation.y) * 1.5, ap.z + Math.cos(a.g.rotation.y) * 1.5, 0.55]]
        : [[ap.x, ap.z, 0.7]];
      for (const [cx, cz, r] of circles) {
        const dNew = Math.hypot(x - cx, z - cz);
        // blocked only when stepping INTO them (stepping away always works)
        if (dNew < r + BODY_R && dNew < Math.hypot(p.x - cx, p.z - cz)) return true;
      }
    }
    return false;
  }
  // water you'd actually be IN here: swimmable, and not under a bridge deck
  // or a pier (there the ground is the deck)
  function inWater(x, z) {
    return swimWater(x, z) && zones.groundHeight(x, z) <= WATER_Y + 0.12;
  }
  const levelAt = (x, z) => (inWater(x, z) ? WATER_Y : zones.groundHeight(x, z));
  function passable(x, z) {
    if (bumpsSomeone(x, z)) return false;
    const p = group.position;
    const r = BODY_R;
    const wet = (px, pz) => inWater(px, pz);
    if (canSwim() && zones.current() === 'island' && (inWater(p.x, p.z) ||
        wet(x, z) || wet(x + r, z) || wet(x - r, z) || wet(x, z + r) || wet(x, z - r))) {
      // between land and water, a step is a step: no dropping off a bridge
      // deck (or through its rails) into the sea, no bobbing up onto one
      // from underneath (both used to happen, with a helmet flickering on
      // and off)
      if (Math.abs(levelAt(x, z) - levelAt(p.x, p.z)) > 0.8) return false;
      // a body at the waterline: every point of its rim is either land you
      // could stand on or water you could swim in. (The rim used to be
      // checked for land and only the centre for water, which left a strip
      // along every shore that no single step could cross: you froze at
      // the water's edge.)
      const ok = (px, pz) => inWater(px, pz) || zones.canWalk(px, pz);
      if (ok(x, z) && ok(x + r, z) && ok(x - r, z) && ok(x, z + r) && ok(x, z - r)) return true;
    }
    if (zones.canStand(x, z, BODY_R)) return true;
    return zones.canWalk(x, z) && !zones.canStand(p.x, p.z, BODY_R);
  }

  function update(dt, t, camYaw = 0) {
    if (self.riding) {       // the train drives; you admire the strait
      animateGait(group, t, 0, 10);
      return;
    }
    // swimming = standing somewhere only the sea would let you stand
    const swimming = zones.current() === 'island' && inWater(group.position.x, group.position.z);

    let x = 0, z = 0, running = false;
    if (!ui.isBusy()) { // conversations deserve your feet's full attention
      x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      z = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      running = keys.has('ShiftLeft') || keys.has('ShiftRight') || runLatch;
    }
    const moving = x !== 0 || z !== 0;
    const skateNow = moving && running && !swimming && countItem('skateboard') > 0;

    if (moving) {
      // keys follow the camera: W is always "away from you", wherever you look
      const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
      const rx = x * cy + z * sy;
      const rz = z * cy - x * sy;
      x = rx;
      z = rz;
      const len = Math.hypot(x, z);
      x /= len;
      z /= len;
      let speed = skateNow ? SKATE_SPEED : running ? RUN_SPEED : WALK_SPEED;
      if (coffeeActive()) speed *= COFFEE_MULT;
      if (swimming) speed *= SWIM_MULT;
      if (zones.current() === 'crown') speed *= 0.8; // water is thick; the view is worth it
      // small sub-steps, so a fast skater can't hop clean over a thin rail
      const dist = speed * dt;
      const steps = Math.max(1, Math.ceil(dist / 0.22));
      for (let i = 0; i < steps; i++) {
        const nx = group.position.x + (x * dist) / steps;
        const nz = group.position.z + (z * dist) / steps;
        // slide along walls and shorelines instead of stopping dead
        if (passable(nx, nz)) {
          group.position.x = nx;
          group.position.z = nz;
        } else if (passable(nx, group.position.z)) {
          group.position.x = nx;
        } else if (passable(group.position.x, nz)) {
          group.position.z = nz;
        } else break;
      }

      group.rotation.y = turnToward(group.rotation.y, Math.atan2(x, z), dt, 14);
    }

    const onMoon = zones.current() === 'moon';
    const underwater = zones.current() === 'crown';
    if (swimming) {
      group.position.y = WATER_Y - 0.28 + Math.sin(t * 2.1) * 0.05;
      walk += ((moving ? 0.4 : 0.15) - walk) * Math.min(1, dt * 6);
      animateGait(group, t, walk, 6); // a lazy paddle
    } else {
      group.position.y = zones.groundHeight(group.position.x, group.position.z);
      walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 10);
      if (onMoon) {
        // a sixth of the gravity, six times the joy
        group.position.y += Math.abs(Math.sin(t * 4.2)) * 0.24 * walk;
        animateGait(group, t, walk, 7);
      } else if (underwater) {
        // down in the Crown: a floaty, bobbing wade
        group.position.y += 0.15 + Math.sin(t * 1.6) * 0.1;
        animateGait(group, t, walk, 5);
      } else if (skateNow) {
        // feet planted on the plank, gliding — a little bob over the seams
        group.position.y += 0.18 + Math.abs(Math.sin(t * 9)) * 0.02;
        animateGait(group, t, 0.05, 4);
      } else {
        animateGait(group, t, walk, running || coffeeActive() ? 14 : 10);
      }
    }
    // the board is out when you're skating, tucked away when you're not
    if (skateNow !== skating) {
      skating = skateNow;
      if (!board) board = buildSkateboard();
      if (skating) group.add(board);
      else group.remove(board);
    }
    if (board && skating) board.position.y = -0.2;

    // the bubble helmet is not optional on the moon. Dr. Hazel was very clear.
    // (under the sea you have goggles and a snorkel, like a person.)
    if (onMoon !== bubbleOn) {
      bubbleOn = onMoon;
      if (!bubble) bubble = buildBubble();
      const head = group.userData.parts.head;
      if (bubbleOn) head.add(bubble);
      else bubble.parent?.remove(bubble);
    }

    if (swimming !== wasSwimming) {
      wasSwimming = swimming;
      if (swimming) {
        plop();
        if (!hasFlag('firstSwim')) {
          setFlag('firstSwim');
          ui.toast(state.avatar?.kind === 'duck'
            ? '오리답게 물에 척척 적응했어요.'
            : '만일을 대비해 이마에 고글을 올렸어요. 바다가 당신을 받아 줬어요.', '🌊');
        }
      }
    }

    // the diver's kit comes out when (and only when) it's earning its keep:
    // goggles pushed up while you paddle; goggles down, snorkel in, and the
    // wetsuit on, only when you go under (the Dropped Crown)
    const diver = state.avatar?.kind !== 'duck' && countItem('scuba_suit') > 0;
    const wantMode = !diver ? 'off' : underwater ? 'down' : swimming ? 'up' : 'off';
    if (wantMode !== gogglesMode) {
      gogglesMode = wantMode;
      if (!goggles) goggles = buildGoggles();
      const head = group.userData.parts.head;
      goggles.parent?.remove(goggles);
      if (wantMode !== 'off') {
        head.add(goggles);
        const down = wantMode === 'down';
        goggles.position.set(0, down ? 0.09 : 0.3, down ? 0 : -0.04);
        goggles.rotation.x = down ? 0 : -0.5;
        goggles.userData.snorkel.visible = down;
      }
      const body = group.userData.parts.body;
      if (!wetsuit) wetsuit = buildWetsuit(body);
      if (wantMode === 'down') body.add(wetsuit); else wetsuit.parent?.remove(wetsuit);
      if (group.userData.hatMesh) group.userData.hatMesh.visible = wantMode !== 'down';
    }
  }

  function swapBody(kind, bodyColor) {
    const fresh = buildAnimal(kind, { body: bodyColor });
    warmUp(fresh); // every body arrives pre-warmed
    // keep the group (everyone holds a reference to it), swap the animal
    for (const child of [...group.children]) {
      if (child !== lantern) group.remove(child);
    }
    while (fresh.children.length) group.add(fresh.children[0]);
    group.userData.parts = fresh.userData.parts;
    group.userData.hatMesh = null;
    gogglesMode = 'off'; // the old head took the goggles with it
    wetsuit = null;       // (and the suit was cut to the old body)
    skating = false;  // and the board went with the old body
    bubbleOn = false; // and the bubble
    applyHat(group, state.wearing);
  }

  const self = { group, update, swapBody, riding: false, bodies: [] };
  return self;
}
