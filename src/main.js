import * as THREE from 'three';
import { createTerrain, terrainHeight, SITES, ISLAND2 } from './terrain.js';
import { createOcean } from './ocean.js';
import { createSky } from './sky.js';
import { scatterNature } from './nature.js';
import { createAnimals, idleAll } from './animals.js';
import { createPlayer } from './player.js';
import { createBuildings } from './buildings.js';
import { createCave } from './cave.js';
import { createFishing } from './fishing.js';
import { createDigging } from './digging.js';
import { createTidePools } from './tidepools.js';
import { nameVillagers } from './villagers.js';
import { createHouses, playMorningSignal } from './houses.js';
import { createBridge } from './bridge.js';
import { createIsland2 } from './island2.js';
import { createAmbient } from './ambient.js';
import { createOceanLife } from './oceanlife.js';
import { createBoats } from './boats.js';
import { createVolcano } from './volcano.js';
import { createIsland3 } from './island3.js';
import { createTexas } from './texas.js';
import { createGhost } from './ghost.js';
import { createBeachBall } from './beachball.js';
import { createShells } from './shells.js';
import { createStarfall } from './starfall.js';
import { createBulko } from './bulko.js';
import { createNorthline } from './northline.js';
import { createFarline } from './farline.js';
import { createIsland5 } from './island5.js';
import { createIsland6 } from './island6.js';
import { createFold } from './fold.js';
import { createLabsGrounds } from './labsgrounds.js';
import { createFarther } from './farther.js';
import { createMoon } from './moon.js';
import { createCrown } from './crown.js';
import { createBurrough } from './burrough.js';
import { createOasis } from './oasis.js';
import * as mail from './mail.js';
import { createCran } from './cran.js';
import { createChuckee } from './chuckee.js';
import { wireHatKey } from './hats.js';
import { initTools, updateTools, play as playTool } from './tools.js';
import { initFieldGuide, markVisited, placeName } from './fieldguide.js';
import { createMultiplayer } from './multiplayer.js';
import { initControls, isTouchDevice } from './controls.js';
import { initSettings } from './settings.js';
import { setMood, setAmbience } from './audio.js';
import { HOLIDAY, isNight, clockLabel, hourNow } from './calendar.js';
import { currentWeather } from './almanac.js';
import * as almanac from './almanac.js';
import { updateNightGlow } from './nightglow.js';
import * as zones from './zones.js';
import * as interact from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';

S.load(); // the island remembers

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
// capped below native retina: visually near-identical, dramatically cheaper
// (phones get a slightly lower cap; their pixels are small and their
// batteries have feelings)
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice() ? 1.25 : 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdcf7);
scene.fog = new THREE.Fog(0x9fdcf7, 95, 230);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);

// bright cartoon noon: warm sun + cool sky fill
const hemi = new THREE.HemisphereLight(0xcfeeff, 0x7ca16a, 1.3);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d6, 2.4);
sun.position.set(45, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 180;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.4;
scene.add(sun, sun.target);

// AC-style high camera that trails the player — now steerable: drag the
// mouse to orbit, scroll to lean in or out
let camYaw = 0;
let camPitch = 0.70;
let camDist = 20.3;
const camOffset = new THREE.Vector3();
const camGoal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();

function refreshCamOffset() {
  const hr = camDist * Math.cos(camPitch);
  camOffset.set(Math.sin(camYaw) * hr, camDist * Math.sin(camPitch), Math.cos(camYaw) * hr);
}
refreshCamOffset();

// one finger (or the mouse) orbits; two fingers pinch the distance
let dragging = false;
const touchPoints = new Map(); // pointerId -> {x, y}
let pinchDist = 0;

function setZoom(d) {
  camDist = Math.min(30, Math.max(9, d));
  refreshCamOffset();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touchPoints.size === 2) {
    dragging = false;
    const [a, b] = [...touchPoints.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  } else if (e.button === 0) {
    dragging = true;
  }
});
const endPointer = (e) => {
  touchPoints.delete(e.pointerId);
  if (!touchPoints.size) dragging = false;
};
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);
addEventListener('pointermove', (e) => {
  const p = touchPoints.get(e.pointerId);
  if (p) {
    p.x = e.clientX;
    p.y = e.clientY;
  }
  if (touchPoints.size === 2) {
    const [a, b] = [...touchPoints.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) setZoom(camDist - (d - pinchDist) * 0.05);
    pinchDist = d;
    return;
  }
  if (!dragging) return;
  camYaw -= e.movementX * 0.005;
  camPitch = Math.min(1.3, Math.max(0.18, camPitch + e.movementY * 0.004));
  refreshCamOffset();
});
addEventListener('wheel', (e) => {
  // a ctrl/⌘ wheel is the browser's page-zoom gesture — and it's also how a
  // trackpad pinch arrives. swallow it so it zooms the camera, not the whole page
  // (page-zoom would slide the fixed HUD out of frame). the camera now does all
  // the zooming the page-zoom used to, so the pinch gets a much livelier step
  // (its deltaY is tiny) to track your fingers. plain mouse scroll keeps its
  // gentle notch and still passes through, so modal lists (pockets, almanac) scroll.
  if (e.ctrlKey) {
    e.preventDefault();
    setZoom(camDist + e.deltaY * 0.1);
  } else {
    setZoom(camDist + e.deltaY * 0.02);
  }
}, { passive: false });
// Safari delivers trackpad pinches as gesture events instead of ctrl+wheel —
// same deal: keep them on the camera, off the page.
let gestureScale = 1;
addEventListener('gesturestart', (e) => { e.preventDefault(); gestureScale = e.scale; }, { passive: false });
addEventListener('gesturechange', (e) => {
  e.preventDefault();
  setZoom(camDist - (e.scale - gestureScale) * 16);
  gestureScale = e.scale;
}, { passive: false });
addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

const player = createPlayer();

zones.init({
  scene, hemi, sun, player,
  snapCamera: () => {
    camera.position.copy(player.group.position).add(camOffset);
    lookGoal.copy(player.group.position);
    lookGoal.y += 1.2;
    camera.lookAt(lookGoal);
  },
});

scene.add(createTerrain());
const buildings = createBuildings(); // registers interiors + blockers first
const cave = createCave();
const ocean = createOcean();
const sky = createSky();
const nature = scatterNature();
const animals = createAnimals();
nameVillagers(animals.animals);
const island3 = createIsland3(); // before houses: Crumb sleeps on the MouseBoat
const texas = createTexas();
const houses = createHouses(animals.animals, nature.obstacles);
mail.initCarrier(animals.animals, houses, zones.doorOf); // Penny takes the rounds (the Post's door and every mailbox now exist)
player.bodies = animals.animals; // villagers are solid to you, too
const bridge = createBridge(player, animals.animals);
const island2 = createIsland2();
const ambient = createAmbient(animals.animals, scene);
const oceanLife = createOceanLife();
const bulko = createBulko(player); // before boats: the ferry needs the dock
const island6 = createIsland6(player); // ditto — the Persistent calls at the Labs
const farther = createFarther(); // ditto again — the ferry calls at Farther Isle
const moon = createMoon(player); // 384,000 km up and to the right
const crown = createCrown(player); // and a long way down: the world under the reef
const boats = createBoats(player);
const island5 = createIsland5(player);
const northline = createNorthline(player, animals.animals);
const farline = createFarline(player, animals.animals);
const volcano = createVolcano();
const ghost = createGhost(player);
const beachBall = createBeachBall(player);
const shells = createShells(); // the tide's slow shift
const starfall = createStarfall(player); // clear nights: stars come loose
const fishing = createFishing(player);
const digging = createDigging();
const tidePools = createTidePools();
const fold = createFold(); // the Fold arrived late and touches nothing
const labsGrounds = createLabsGrounds(); // after everything: it looks for open ground
const burrough = createBurrough(player, { molehill: labsGrounds.molehill }); // and underneath it all, the moles (up top, a molehill on the meadow's little hill)
const oasis = createOasis(player); // Oasis Estates came last, by appointment, and touches nothing
const chuckee = createChuckee(player); // the strait: footbridge, highway, travel stop
const cran = createCran(player); // the Isle of Cran (its village reserved its ground at module load, before the houses went up)
wireHatKey(player.group);
initTools(player); // rod, net, shovel — in your paws when you use them
initFieldGuide(player);
initControls(); // thumbsticks for the touch-blessed; a no-op for everyone else
initSettings(); // the quiet panel behind the title chip
const multiplayer = createMultiplayer(player, scene);
almanac.init({ scene, hemi, sun, playerGroup: player.group });

scene.add(
  ocean.group, sky.group, nature.group, animals.group, player.group,
  buildings.group, cave.group, fishing.group, digging.group, tidePools.group,
  houses.group, bridge.group, island2.group, oceanLife.group,
  boats.group, volcano.group, island3.group, ghost.group, beachBall.group, texas.group, bulko.group,
  island5.group, shells.group, starfall.group, northline.group, farline.group, island6.group, fold.group, farther.group, moon.group, crown.group, labsGrounds.group, burrough.group, oasis.group, cran.group, chuckee.group
);

// name each module's root so debug probes (shots/clip_audit.mjs) can say
// *whose* mesh is poking through what
for (const [k, g] of Object.entries({
  ocean, sky, nature, animals, buildings, cave, fishing, digging, tidePools,
  houses, bridge, island2, oceanLife, boats, volcano, island3, ghost, beachBall, shells, starfall,
  texas, bulko, island5, northline, farline, island6, fold, farther, moon, crown, oasis, cran, chuckee,
})) if (g.group && !g.group.name) g.group.name = k;
player.group.name = 'player';

camera.position.copy(player.group.position).add(camOffset);
ui.updateHUD();

// ---- tiny things don't cast shadows: a pebble's shadow on a 1024 shadow map
// is a smudge, and each caster is another draw in the shadow pass
{
  const sc = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || !o.castShadow || o.isInstancedMesh || !o.geometry) return;
    if (o.material?.emissive && o.material.emissive.getHex() !== 0) { o.castShadow = false; return; } // glowing things cast no shadow (rule 9)
    o.geometry.computeBoundingSphere?.();
    o.getWorldScale(sc);
    if ((o.geometry.boundingSphere?.radius || 0) * Math.max(sc.x, sc.y, sc.z) < 0.2) o.castShadow = false;
  });
}

// ---- dynamic wall fading: anything wall-sized between you and the camera
// turns politely translucent (and recovers the instant it isn't)
const occluders = [];
scene.traverse((o) => {
  if (!o.isMesh) return;
  if (o.material?.transparent || o.material?.opacity < 1) return;
  if (o.userData.occlude === true) {
    occluders.push(o);
    return;
  }
  if (o.geometry?.type !== 'BoxGeometry') return;
  const g = o.geometry.parameters;
  if (g.height >= 2.2 && Math.max(g.width, g.depth) * g.height >= 12) {
    occluders.push(o);
  }
});
const occRay = new THREE.Raycaster();
const occDir = new THREE.Vector3();
const occTarget = new THREE.Vector3();
const fadedWalls = new Set();
const nowFaded = new Set();

function updateOcclusion() {
  occTarget.copy(player.group.position);
  occTarget.y += 1.0;
  occDir.copy(occTarget).sub(camera.position);
  const dist = occDir.length();
  occDir.normalize();
  occRay.set(camera.position, occDir);
  occRay.far = dist - 0.6;
  nowFaded.clear();
  for (const hit of occRay.intersectObjects(occluders, false)) {
    nowFaded.add(hit.object);
  }
  for (const m of nowFaded) {
    if (!fadedWalls.has(m)) {
      if (!m.userData._occ) {
        m.userData._occ = {
          t: m.material.transparent, o: m.material.opacity, dw: m.material.depthWrite,
        };
      }
      m.material.transparent = true;
      m.material.opacity = 0.28;
      m.material.depthWrite = false;
    }
  }
  for (const m of fadedWalls) {
    if (!nowFaded.has(m)) {
      const old = m.userData._occ;
      m.material.transparent = old.t;
      m.material.opacity = old.o;
      m.material.depthWrite = old.dw;
    }
  }
  fadedWalls.clear();
  for (const m of nowFaded) fadedWalls.add(m);
}

// ---- matrices only for what moved. three recomposes every object's matrix
// every frame (~19k of them, a quarter of the frame), and almost all of the
// archipelago never moves. Same result as scene.updateMatrixWorld(): an
// object recomputes when its position/rotation/scale or its parent changed,
// and hidden branches wait until they're shown.
scene.matrixWorldAutoUpdate = false; // the loop calls updateMoved() instead
function updateMoved(o, parentMoved) {
  // hidden branches (closed interiors, far worlds) wait: forgetting their
  // parent makes the whole branch recompute the frame it's shown again
  if (!o.visible) { o._lastParent = undefined; return; }
  // (not matrixWorldNeedsUpdate: every getWorldPosition() sets it all the
  // way up to the scene, which would re-multiply the whole world each frame.
  // For auto-matrix objects a real change shows up in the TRS check below.)
  let moved = parentMoved || o._lastParent !== o.parent || (!o.matrixAutoUpdate && o.matrixWorldNeedsUpdate);
  if (o.matrixAutoUpdate) {
    const p = o.position, q = o.quaternion, sc = o.scale;
    const c = o._last || (o._last = new Float64Array(10).fill(NaN));
    if (c[0] !== p.x || c[1] !== p.y || c[2] !== p.z || c[3] !== q.x || c[4] !== q.y
      || c[5] !== q.z || c[6] !== q.w || c[7] !== sc.x || c[8] !== sc.y || c[9] !== sc.z) {
      c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q.x; c[4] = q.y;
      c[5] = q.z; c[6] = q.w; c[7] = sc.x; c[8] = sc.y; c[9] = sc.z;
      o.matrix.compose(p, q, sc);
      moved = true;
    }
  }
  if (moved) {
    o._lastParent = o.parent;
    if (o.matrixWorldAutoUpdate) {
      if (o.parent === null) o.matrixWorld.copy(o.matrix);
      else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
      if (o.isCamera) o.matrixWorldInverse.copy(o.matrixWorld).invert();
    }
    o.matrixWorldNeedsUpdate = false;
  }
  const ch = o.children;
  for (let i = 0; i < ch.length; i++) updateMoved(ch[i], moved);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let shadowZone = null;
let moodT = 0;
let whereT = 6;

// the title chip names where you are and what time it is — refreshed on the
// whereT tick (below) and the instant a door swaps zones
const titleEl = document.getElementById('title');
function updateHud() {
  if (!titleEl) return;
  const p = player.group.position;
  titleEl.innerHTML =
    `${placeName(zones.current(), p.x, p.z)} <span class="dim">· ${clockLabel()}</span>`;
}
zones.onChange(updateHud);
updateHud();

// Where you wake up:
//  · first time ever → the middle of Notbell (the default spawn) + the picker
//  · same day, just refreshed → exactly where you left off, camera and all
//  · a new morning → home, in your own cottage, the island waiting outside
const w = S.state.where;
if (w && w.day !== S.todayKey()) {
  // a new day on the island — wake up at home, and the radio knows you're up
  zones.go('home')
    .then(() => {
      ui.toast('좋은 아침이에요. 오두막은 따뜻하고, 섬이 기다려요.', '🌅');
      playMorningSignal();
    })
    .catch(() => {});
} else if (w) {
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  camYaw = num(w.camYaw, camYaw);
  camPitch = num(w.camPitch, camPitch);
  camDist = num(w.camDist, camDist);
  refreshCamOffset();
  const spotOK = Number.isFinite(w.x) && Number.isFinite(w.z);
  // out rowing when the page closed? back in the same boat, same water
  if (w.zone === 'sea' && spotOK) {
    if (!boats.resumeRowing({ x: w.x, z: w.z, rotY: num(w.rotY, 0) })) S.state.rowing = null;
  } else {
    // exactly where you left off — as long as that's somewhere you can
    // stand. A saved spot can go bad (a room renamed away, a seat over the
    // sea, a NaN): then the zone's own spawn, or the plaza. (These used to
    // strand you in open water, or black-screen the game, for the day.)
    zones.go(w.zone, spotOK ? { x: w.x, z: w.z, rotY: num(w.rotY, 0) } : undefined)
      .then(() => {
        const p = player.group.position;
        const here = zones.current() === w.zone;
        if (!here || !Number.isFinite(p.x) || !zones.canStand(p.x, p.z, 0.3)) return zones.go(here ? w.zone : 'island');
        return null;
      })
      .catch(() => {});
  }
}

addEventListener('beforeunload', () => {
  if (player.riding) { S.saveNow(); return; } // (a seat in motion is no place to wake up; keep where you boarded)
  S.state.where = {
    zone: zones.current(), day: S.todayKey(),
    x: player.group.position.x, z: player.group.position.z,
    rotY: player.group.rotation.y, camYaw, camPitch, camDist,
  };
  S.saveNow();
});

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const playerPos = player.group.position;

  const zone = zones.current();
  const outdoors = zone === 'island' || zone === 'sea';

  // interiors live far out over the (endless-looking) sea — indoors, the sea
  // and the sky go away, so a room reads as a room, not a raft on the ocean
  ocean.group.visible = outdoors;
  sky.group.visible = outdoors;

  player.update(dt, t, camYaw);
  updateTools(dt);
  animals.update(dt, t, playerPos);
  idleAll(t);
  if (outdoors) {
    // the open world only spends effort when you can see it
    ocean.update(t);
    sky.update(dt);
    updateNightGlow(dt); // windows warm up after dark / in rain or fog
    nature.update(dt, t, playerPos);
    oceanLife.update(dt, t, playerPos);
    boats.update(dt, t, playerPos);
    volcano.update(dt, t);
    bridge.update(dt, t);
    digging.update(dt);
    tidePools.update(dt, t);
    beachBall.update(dt, t, playerPos);
    shells.update(dt, t, playerPos);
    starfall.update(dt, t);
    texas.update(dt, t, playerPos);
    northline.update(dt, t);
    farline.update(dt, t);
    labsGrounds.update(dt, t, playerPos);
  }
  bulko.update(dt, t, playerPos);
  island5.update(dt, t, playerPos); // the manor staff keep their rounds indoors too
  island6.update(dt, t, playerPos); // gates itself by zone (labs life is indoors too)
  fold.update(dt, t, playerPos); // ditto — the kirk keeps its own hours
  farther.update(dt, t, playerPos); // ditto — the General keeps store hours (all of them)
  oasis.update(dt, t, playerPos); // ditto — the CaMall has walkers before it opens
  cran.update(dt, t, playerPos); // ditto — zumba waits for no one
  chuckee.update(dt, t, playerPos); // ditto — the highway never closes
  if (zone === 'moon') moon.update(dt, t, playerPos);
  if (zone === 'crown') crown.update(dt, t, playerPos);
  if (zone === 'burrough' || zone.startsWith('burrough_')) burrough.update(dt, t, playerPos); // the street, and its rooms
  if (zone === 'cave') cave.update(dt, t);
  ghost.update(dt, t, playerPos); // walls are a rumor
  buildings.update(dt, t, playerPos);
  houses.update(dt, t, playerPos);
  island2.update(dt, t, playerPos);
  island3.update(dt, t, playerPos);
  ambient.update(dt, playerPos);
  fishing.update(dt, t);
  almanac.update(dt);
  multiplayer.update(dt);
  interact.update(playerPos, zone);

  // the soundtrack follows you around
  moodT -= dt;
  if (moodT <= 0) {
    moodT = 1.5;
    const MOODS = {
      cafe: 'cafe', cave: 'cave', church: 'church', museum: 'museum',
      shop: 'shop', grocery: 'shop', bulko: 'bulko', manor: 'manor',
      manor_up: 'manor', cellar: 'cave', moon: 'night', labs: 'shop',
      post: 'shop', kirk: 'church', general: 'shop', crown: 'reef', burrough: 'burrough',
      burrough_local1: 'shop', burrough_mould: 'museum', burrough_arms: 'burrough', burrough_dirt: 'burrough', burrough_ritz: 'manor',
      mall: 'bulko', polly: 'shop', drom: 'bulko', mirage: 'cafe', cluck: 'shop',
      cran_ink: 'shop', cran_records: 'cafe', cran_cc: 'holiday', chuckee: 'bulko',
    };
    const outdoors = zone === 'island' || zone === 'sea';
    const wx = currentWeather();
    const h = hourNow();
    const timeMood = h >= 5 && h < 9 ? 'morning' : h >= 17 && h < 20 ? 'evening' : isNight() ? 'night' : 'day';
    setMood(MOODS[zone] ?? (outdoors
      ? (HOLIDAY ? 'holiday' : wx === 'rain' || wx === 'snow' || wx === 'fog' ? wx : timeMood)
      : 'indoors'));
    // the world underneath the music: surf by the shore, wind up high,
    // birds by day, crickets by night
    let wet = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (terrainHeight(playerPos.x + Math.cos(a) * 9, playerPos.z + Math.sin(a) * 9) < -0.4) wet++;
    }
    setAmbience({
      outdoors,
      night: isNight(), weather: wx, coast: wet / 8,
      high: Math.max(0, Math.min(1, (terrainHeight(playerPos.x, playerPos.z) - 4) / 8)),
    });
  }

  // remember where you are, so refreshing isn't a teleport home
  whereT -= dt;
  if (whereT <= 0) {
    whereT = 2.5;
    markVisited(player, zone); // new shores ink themselves onto the chart
    updateHud(); // place name + clock keep pace as you wander
    // (not while riding: a refresh on a train used to wake you at the seat's
    // spot — out over the strait, in the water, unable to move)
    if (!player.riding) {
      S.state.where = {
        zone, day: S.todayKey(), x: playerPos.x, z: playerPos.z,
        rotY: player.group.rotation.y, camYaw, camPitch, camDist,
      };
    }
    S.save();
  }

  const focus = camFocus || playerPos; // probes may point the camera elsewhere
  camGoal.copy(focus).add(camOffset);
  camera.position.lerp(camGoal, camFocus ? 1 : 1 - Math.exp(-dt * 4));
  lookGoal.copy(focus);
  lookGoal.y += 1.2;
  camera.lookAt(lookGoal);
  updateMoved(scene, false); // (before the occlusion ray: a room just shown needs its walls placed)
  updateOcclusion();

  // indoors the sun's shadow box is parked over Notbell, nowhere near you:
  // draw it once on arrival (the same map rooms always had), then let it be
  renderer.shadowMap.autoUpdate = zones.sunShadowsHere();
  if (zone !== shadowZone) {
    shadowZone = zone;
    renderer.shadowMap.needsUpdate = true;
  }
  renderer.render(scene, camera);
});

{
  // the splash takes a breath and fades, rather than blinking out
  const splash = document.getElementById('loading');
  splash?.classList.add('done');
  setTimeout(() => splash?.remove(), 650);
}

// debug/testing hook (used by the shots/ harness). cam.view() aims the
// camera at any point without moving the player; cam.view(null) lets go.
let camFocus = null;
const cam = {
  view(p, o = {}) {
    camFocus = p ? new THREE.Vector3(p.x, p.y ?? terrainHeight(p.x, p.z), p.z) : null;
    if (o.yaw !== undefined) camYaw = o.yaw;
    if (o.pitch !== undefined) camPitch = o.pitch;
    if (o.dist !== undefined) camDist = o.dist;
    refreshCamOffset();
  },
  get: () => ({ yaw: camYaw, pitch: camPitch, dist: camDist }),
};
window.__notbell = { ui, cam, boats, interact, playTool, zones, player, S, SITES, ISLAND2, terrainHeight, digging, almanac, houses, ambient, animals, fishing, bridge, northline, farline };

// a small welcome the first time — and everyone gets to choose who they are
(async () => {
  if (!S.hasFlag('woke')) {
    S.setFlag('woke');
    await ui.say([
      '낫벨 섬에서 눈을 떴어요 — 낫벨 군도의 심장, 진짜 경제가 있고 종이 없기로 유명한 곳.',
      '주민들은 다정해요. 가게를 지키는 까치가 당신에게 줄 게 있대요. 그리고 작은 보물을 충분히 가져다주면, 섬들이 이야기를 들려준대요.',
    ]);
  }
  if (!S.state.avatar) {
    const kind = await ui.ask('그런데, 오늘 아침에 깬 건 정확히 누구인가요?', [
      { label: '🐱 모래색 고양이', value: 'cat' },
      { label: '🐰 크림색 토끼', value: 'rabbit' },
      { label: '🦊 마멀레이드 여우', value: 'fox' },
      { label: '🦆 눈처럼 흰 오리', value: 'duck' },
    ]);
    const colors = { cat: 0xf0c98f, rabbit: 0xf5e6c8, fox: 0xe88a3a, duck: 0xf5f2e9 };
    S.state.avatar = { kind: kind || 'cat', body: colors[kind] || 0xf0c98f };
    S.save();
    player.swapBody(S.state.avatar.kind, S.state.avatar.body);
  }
  if (!S.state.name) {
    const raw = await ui.input('섬 사람들이 당신을 뭐라고 부르면 될까요?', { placeholder: '이름 (나중에 바꿀 수 있어요)', max: 16 });
    S.state.name = (raw || '샌디').trim().slice(0, 16) || '샌디';
    S.save();
    ui.updateHUD();
    ui.toast(`어서 와요, <b>${ui.escapeHtml(S.state.name)}</b>. 조수 웅덩이들이 어쩐지 벌써 알고 있었어요.`, '✨');
  }
})();
