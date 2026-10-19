// Fishing, the honest way: watch the water for a shadow, land your cast
// near it, let it nibble (nibbles LIE), and strike the real bite. Shadow
// size tells you the class of fish — small darts, medium drifts, large
// moves like it owns the bay. Sometimes the sea still sends a letter.

import * as THREE from 'three';
import { terrainHeight, WATER_Y, ISLAND2 } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { play as playTool, holdRod, putAway } from './tools.js';
import { rollFish, BOTTLE_NOTES } from './catalog.js';
import { plop, bite, splash, jingle, sadTrombone, tone } from './audio.js';
import { rand, turnToward } from './utils.js';
import { CAVE_POND } from './cave.js';
import { isRaining } from './almanac.js';
import { waveAt } from './ocean.js';

const BITE_WINDOW = 0.8;  // seconds you have to react to the real thing
const CAST_REACH = 3.2;   // how close the bobber must land to a shadow
const SIZES = [['s', 0.55, 40], ['m', 0.85, 40], ['l', 1.25, 20]];
const FAR_BRIDGE_RAIL_OFFSET = 6;
const FAR_BRIDGE_DECK_HALF_W = 1.85;
const FAR_BRIDGE_RAIL_HALF_W = 1.15;
const FAR_BRIDGE_SHADOW_CLEARANCE = 1.5;

const farBridge = (() => {
  const dist = Math.hypot(ISLAND2.x, ISLAND2.z);
  const dir = { x: ISLAND2.x / dist, z: ISLAND2.z / dist };

  function findShore(fromT, step) {
    let t = fromT;
    for (let i = 0; i < 400; i++) {
      if (terrainHeight(dir.x * (t + step), dir.z * (t + step)) < 0.15) break;
      t += step;
    }
    return t;
  }

  const tA = findShore(24, 0.5);
  const tB = findShore(dist - 14, -0.5);
  const a = { x: dir.x * tA, z: dir.z * tA };
  const b = { x: dir.x * tB, z: dir.z * tB };
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const along = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  const perp = { x: -along.z, z: along.x };
  return { a, len, along, perp };
})();

function inFarBridgeFootprint(x, z) {
  const dx = x - farBridge.a.x, dz = z - farBridge.a.z;
  const t = (dx * farBridge.along.x + dz * farBridge.along.z) / farBridge.len;
  const endClearance = FAR_BRIDGE_SHADOW_CLEARANCE / farBridge.len;
  if (t < -endClearance || t > 1 + endClearance) return false;

  const off = dx * farBridge.perp.x + dz * farBridge.perp.z;
  return Math.abs(off) < FAR_BRIDGE_DECK_HALF_W + FAR_BRIDGE_SHADOW_CLEARANCE ||
    Math.abs(off - FAR_BRIDGE_RAIL_OFFSET) < FAR_BRIDGE_RAIL_HALF_W + FAR_BRIDGE_SHADOW_CLEARANCE;
}

export function createFishing(player) {
  const group = new THREE.Group();

  const bobber = new THREE.Group();
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0),
    new THREE.MeshStandardMaterial({ color: 0xe05a4a, flatShading: true, roughness: 0.5 }));
  const bottom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: 0xfffaf0, flatShading: true, roughness: 0.5 }));
  bottom.position.y = -0.12;
  bobber.add(top, bottom);
  bobber.visible = false;
  group.add(bobber);

  // ------------------------------------------------------- the shadows ----
  // dark shapes under the surface; they draw on top of the water so the
  // waves can't hide what you're being offered

  // a fish shape — body, and a tail that flicks — lying flat on the water,
  // nose toward -z before turning. It floats just above the wave crests
  // (like the reef glow does), or the waves chew holes in it and it reads
  // as a flickering puddle rather than a fish
  const SHADOW_GEO = (() => {
    const sh = new THREE.Shape();
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI; // the body: a plump lens, nose at +y
      pts.push([Math.cos(a) * 0.45, 0.2 + Math.sin(a) * 0.75]);
    }
    sh.moveTo(0.45, 0.2);
    for (const [x, y] of pts) sh.lineTo(x, y);
    sh.lineTo(-0.3, -0.45);
    sh.lineTo(-0.42, -0.95); // the tail
    sh.lineTo(0, -0.7);
    sh.lineTo(0.42, -0.95);
    sh.lineTo(0.3, -0.45);
    sh.lineTo(0.45, 0.2);
    const g = new THREE.ShapeGeometry(sh);
    g.rotateX(-Math.PI / 2); // lie flat; the nose now points toward -z
    return g;
  })();
  const SEA_LIFT = 0.06; // just above the (interpolated) wave it rides

  function makeShadow() {
    const m = new THREE.Mesh(SHADOW_GEO,
      new THREE.MeshBasicMaterial({
        color: 0x122b38, transparent: true, opacity: 0, depthWrite: false, depthTest: true,
      }));
    m.renderOrder = 1;
    return m;
  }

  function rollSize(boost = 0) {
    const total = SIZES.reduce((s, [, , w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [id, scale, w] of SIZES) {
      r -= w + (id === 'l' ? boost : 0);
      if (r <= 0) return { id, scale };
    }
    return { id: 'm', scale: 0.85 };
  }

  const shadows = [];
  for (let i = 0; i < 6; i++) {
    const m = makeShadow();
    m.visible = false;
    group.add(m);
    shadows.push({
      m, where: i < 4 ? 'sea' : 'cave', size: null,
      drift: { x: 0, z: 0 }, driftT: 0, gone: 0,
    });
  }

  function waterAt(x, z, where) {
    if (where === 'cave') {
      return Math.hypot(x - CAVE_POND.x, z - CAVE_POND.z) < CAVE_POND.r - 0.6;
    }
    return terrainHeight(x, z) < WATER_Y - 0.25 && !inFarBridgeFootprint(x, z);
  }

  function respawnShadow(s, playerPos) {
    const size = rollSize(isRaining() && s.where === 'sea' ? 8 : 0);
    s.size = size;
    s.m.scale.set(size.scale, 1, size.scale);
    s.fade = 0; // surfaces slowly, rather than popping into being
    for (let tries = 0; tries < 24; tries++) {
      let x, z;
      if (s.where === 'cave') {
        const a = rand(0, Math.PI * 2);
        const r = rand(1, CAVE_POND.r - 1.2);
        x = CAVE_POND.x + Math.cos(a) * r;
        z = CAVE_POND.z + Math.sin(a) * r;
      } else {
        // the shallow band off the beaches — which is, not coincidentally,
        // exactly as far as anyone can cast
        const a = rand(0, Math.PI * 2);
        const r = rand(3.5, 14);
        x = playerPos.x + Math.cos(a) * r;
        z = playerPos.z + Math.sin(a) * r;
        const h = terrainHeight(x, z);
        if (h < WATER_Y - 2.2 || h > WATER_Y - 0.3) continue;
      }
      if (waterAt(x, z, s.where)) {
        const y = s.where === 'cave' ? CAVE_POND.surfaceY + 0.02 : WATER_Y + SEA_LIFT;
        s.m.position.set(x, y, z);
        s.m.visible = true;
        s.gone = 0;
        return true;
      }
    }
    s.m.visible = false;
    s.gone = rand(2, 5); // try again shortly, somewhere wetter
    return false;
  }

  function scareShadow(s) {
    s.m.visible = false;
    s.gone = rand(4, 9);
  }

  // ---------------------------------------------------------- the cast ----

  let state = 'idle'; // idle | waiting | approach | nibbling | bite
  let timer = 0;
  let nibblesLeft = 0;
  let hooked = null;        // the shadow considering your bobber
  let junkBite = false;     // nothing around, but the boot is patient
  let where = 'sea';
  let surfaceY = WATER_Y;
  let castWhere = 'sea';
  const castFrom = new THREE.Vector3();
  const castSpot = new THREE.Vector3();

  function waterAhead() {
    const ry = player.group.rotation.y;
    const dx = Math.sin(ry), dz = Math.cos(ry);
    for (let d = 2.2; d <= 4.6; d += 0.8) {
      const x = player.group.position.x + dx * d;
      const z = player.group.position.z + dz * d;
      if (zones.current() === 'cave') {
        if (Math.hypot(x - CAVE_POND.x, z - CAVE_POND.z) < CAVE_POND.r - 0.3) {
          return { x, z, where: 'cave', surfaceY: CAVE_POND.surfaceY };
        }
      } else if (terrainHeight(x, z) < WATER_Y - 0.2) {
        return { x, z, where: 'sea', surfaceY: WATER_Y };
      }
    }
    return null;
  }

  function reset() {
    state = 'idle';
    bobber.visible = false;
    putAway();
    hooked = null;
    junkBite = false;
  }

  async function caught() {
    splash();
    const caughtWhere = where;
    const size = junkBite ? null : hooked?.size?.id;
    if (hooked) {
      hooked.m.visible = false;
      hooked.gone = rand(6, 12);
    }
    reset();
    // sometimes the sea has mail (the pond keeps no correspondence)
    if (caughtWhere === 'sea' &&
        S.state.bottlesRead < BOTTLE_NOTES.length && Math.random() < 0.18) {
      const note = BOTTLE_NOTES[S.state.bottlesRead];
      S.state.bottlesRead += 1;
      S.addItem('bottle_note');
      S.save();
      jingle();
      ui.toast('병이다! 안에 편지가 들어 있어요.', '🍾');
      await ui.say([`You fish up a barnacled bottle. Inside: “${note.title}.”`, note.text]);
      return;
    }
    const id = junkBite
      ? (Math.random() < 0.6 ? 'old_boot' : 'tide_nibbler')
      : rollFish(caughtWhere, size);
    S.addItem(id);
    jingle();
    ui.foundItem(id);
    ui.updateHUD();
  }

  // registered in both waters: the open sea, and the cave's still pond
  for (const zone of ['island', 'cave']) {
    register({
      zone,
      getPos: () => player.group.position,
      r: 99,
      priority: 0, // anything else nearby (a villager, a door) wins
      enabled: () => S.state.tools.rod && (state !== 'idle' || !!waterAhead()),
      label: () => (state === 'idle' ? '낚싯줄 던지기'
        : state === 'bite' ? '낚아채기!' : '기다리기…'),
      use: () => {
        if (state === 'idle') {
          const spot = waterAhead();
          if (!spot) return;
          where = spot.where;
          surfaceY = spot.surfaceY;
          castWhere = spot.where;
          castSpot.set(spot.x, surfaceY + 0.08, spot.z);
          castFrom.copy(player.group.position);
          bobber.position.copy(castSpot);
          bobber.visible = true;
          playTool('cast');
          holdRod(() => (bobber.visible ? bobber.position : null));
          plop();
          // did the cast land near anyone interested?
          hooked = null;
          let best = CAST_REACH;
          for (const s of shadows) {
            if (!s.m.visible || s.where !== where) continue;
            const d = Math.hypot(s.m.position.x - spot.x, s.m.position.z - spot.z);
            if (d < best) {
              best = d;
              hooked = s;
            }
          }
          if (hooked) {
            state = 'approach';
            timer = 6; // patience cap; shadows don't owe you anything
          } else {
            state = 'waiting';
            timer = rand(5, 9);
            junkBite = Math.random() < 0.3; // the boot circles eternally
          }
        } else if (state === 'bite') {
          caught();
        } else {
          // striking at a nibble (or at nothing) — the water keeps its secrets
          if (hooked) scareShadow(hooked);
          reset();
          ui.toast(state === 'nibbling'
            ? '방금 건 찌만 흔든 거예요. 그림자는 감동 없이 유유히 떠나요.'
            : '너무 일찍 걷어 올렸어요. 물은 비밀을 지켜요.', '🌊');
        }
      },
    });
  }

  function startNibbles() {
    state = 'nibbling';
    nibblesLeft = isRaining() && where === 'sea' ? Math.floor(rand(0, 2)) : Math.floor(rand(1, 4));
    timer = rand(0.5, 1.1);
  }

  function update(dt, t) {
    // the shadows live their lives whether you're fishing or not
    const zone = zones.current();
    const playerPos = player.group.position;
    for (const s of shadows) {
      const inZone = (s.where === 'sea' && zone === 'island') || (s.where === 'cave' && zone === 'cave');
      if (!inZone) continue;
      if (!s.m.visible) {
        s.gone -= dt;
        if (s.gone <= 0) respawnShadow(s, playerPos);
        continue;
      }
      s.fade = Math.min(1, (s.fade ?? 1) + dt * 0.8);
      s.m.material.opacity = 0.5 * s.fade;
      const sc = s.size?.scale ?? 1;
      s.m.scale.x = sc * (1 + Math.sin(t * 7 + s.m.position.x) * 0.07); // a swimmy wiggle
      if (s.where === 'sea') s.m.position.y = WATER_Y + waveAt(s.m.position.x, s.m.position.z, t) + SEA_LIFT;
      // too far from the action? swim around to where the player is
      if (s.where === 'sea' && s.m.position.distanceTo(playerPos) > 34) {
        respawnShadow(s, playerPos);
        continue;
      }
      if (s === hooked && (state === 'approach' || state === 'nibbling' || state === 'bite')) {
        // closing in on the bobber
        const dx = castSpot.x - s.m.position.x;
        const dz = castSpot.z - s.m.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.45) {
          s.m.position.x += (dx / d) * 1.1 * dt;
          s.m.position.z += (dz / d) * 1.1 * dt;
          s.m.rotation.y = turnToward(s.m.rotation.y, Math.atan2(-dx, -dz), dt, 5);
        } else if (state === 'approach') {
          startNibbles();
        }
        continue;
      }
      // idle drifting
      s.driftT -= dt;
      if (s.driftT <= 0) {
        s.driftT = rand(2, 5);
        const a = rand(0, Math.PI * 2);
        s.drift.x = Math.cos(a) * 0.4;
        s.drift.z = Math.sin(a) * 0.4;
      }
      const nx = s.m.position.x + s.drift.x * dt;
      const nz = s.m.position.z + s.drift.z * dt;
      if (waterAt(nx, nz, s.where)) {
        s.m.position.x = nx;
        s.m.position.z = nz;
      } else {
        s.driftT = 0;
      }
      s.m.rotation.y = turnToward(s.m.rotation.y, Math.atan2(-s.drift.x, -s.drift.z), dt, 2);
    }

    if (state === 'idle') return;
    // the bobber rides the swell with everything else
    if (castWhere === 'sea') surfaceY = WATER_Y + waveAt(castSpot.x, castSpot.z, t);

    // walking away abandons the line
    if (castFrom.distanceTo(player.group.position) > 0.35) {
      if (hooked) scareShadow(hooked);
      reset();
      return;
    }

    if (state === 'waiting') {
      bobber.position.y = surfaceY + 0.08 + Math.sin(t * 2.4) * 0.05;
      timer -= dt;
      if (timer <= 0) {
        if (junkBite) {
          state = 'bite';
          timer = BITE_WINDOW;
          bobber.position.y = surfaceY - 0.18;
          bite();
        } else {
          reset();
          ui.toast('입질조차 없어요. 물에서 그림자를 보고, 그쪽으로 던져 보세요.', '🌊');
        }
      }
    } else if (state === 'approach') {
      bobber.position.y = surfaceY + 0.08 + Math.sin(t * 2.4) * 0.05;
      timer -= dt;
      if (timer <= 0) {
        // it lost interest on the way over. shadows are like that.
        if (hooked) scareShadow(hooked);
        reset();
        ui.toast('그림자가 한 바퀴 돌더니 떠났어요. 까다롭네요.', '🐟');
      }
    } else if (state === 'nibbling') {
      timer -= dt;
      // little teasing taps: the bobber dips, but not DOWN-down
      const tease = Math.max(0, Math.sin(t * 9)) * -0.07;
      bobber.position.y = surfaceY + 0.06 + tease;
      if (timer <= 0) {
        if (nibblesLeft > 0) {
          nibblesLeft -= 1;
          timer = rand(0.5, 1.2);
          tone(300, { dur: 0.04, vol: 0.04 }); // tik
        } else {
          state = 'bite';
          timer = BITE_WINDOW;
          bobber.position.y = surfaceY - 0.22; // the REAL dip
          bite();
        }
      }
    } else if (state === 'bite') {
      bobber.position.y = surfaceY - 0.22 + Math.sin(t * 18) * 0.06;
      timer -= dt;
      if (timer <= 0) {
        if (hooked) scareShadow(hooked);
        reset();
        sadTrombone();
        ui.toast('놓쳤어요… 아주 작은 웃음소리가 들리는 것 같아요.', '💧');
      }
    }
  }

  // test/debug: where are the shadows right now?
  function debugShadows(all = false) {
    return shadows.filter((s) => all || s.m.visible)
      .map((s) => ({
        x: s.m.position.x, z: s.m.position.z, where: s.where,
        size: s.size?.id, visible: s.m.visible, gone: +s.gone.toFixed(1),
      }));
  }

  return { group, update, debugShadows };
}
