// Fossils. The island marks its buried memories with little stars of
// cracked earth; a shovel (Pip sells one) does the rest.

import * as THREE from 'three';
import { terrainHeight, clearOfSites, ISLAND_RADIUS } from './terrain.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { play as playTool } from './tools.js';
import { rollTable, FOSSIL_TABLE } from './catalog.js';
import { thud, jingle } from './audio.js';
import { rand } from './utils.js';

const ACTIVE_SPOTS = 4;

// the island surfaces three or four fossils per real day, depending on
// its mood, which is deterministic, which is very like the island
function digBudget() {
  const d = new Date();
  let h = 2166136261;
  for (const c of `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return 3 + ((h >>> 0) % 2);
}

function makeStarMark() {
  const g = new THREE.Group();
  const dirt = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x77603f, flatShading: true, roughness: 1 })
  );
  dirt.rotation.x = -Math.PI / 2;
  g.add(dirt);
  // the little star of cracks
  for (let i = 0; i < 4; i++) {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.02, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x5a4730, roughness: 1 })
    );
    crack.rotation.y = (i / 4) * Math.PI;
    crack.position.y = 0.012;
    g.add(crack);
  }
  return g;
}

export function createDigging() {
  const group = new THREE.Group();
  const spots = [];

  function placeSpot(spot) {
    // today's allowance: what's been dug plus what's already showing
    const alive = spots.filter((s) => s !== spot && s.alive).length;
    if (S.dailyCount('digs') + alive >= digBudget()) {
      spot.alive = false;
      spot.mark.visible = false;
      spot.respawn = 60; // check back; midnight restocks the past
      return;
    }
    for (let tries = 0; tries < 50; tries++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand(0, 1)) * (ISLAND_RADIUS - 4);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < 0.6 || h > 7) continue;
      if (!clearOfSites(x, z, 2)) continue;
      if (spots.some((s) => s !== spot && s.alive && Math.hypot(s.mark.position.x - x, s.mark.position.z - z) < 8)) continue;
      spot.mark.position.set(x, h + 0.04, z);
      spot.alive = true;
      spot.mark.visible = true;
      return;
    }
    spot.alive = false;
    spot.mark.visible = false;
    spot.respawn = 10; // try again soon
  }

  for (let i = 0; i < ACTIVE_SPOTS; i++) {
    const spot = { mark: makeStarMark(), alive: false, respawn: 0 };
    group.add(spot.mark);
    placeSpot(spot);
    spots.push(spot);

    register({
      getPos: () => spot.mark.position,
      r: 1.9,
      enabled: () => spot.alive,
      label: () => (S.state.tools.shovel ? 'dig' : 'something is buried here…'),
      use: () => {
        if (!S.state.tools.shovel) {
          ui.say([
            '여기 흙이 작은 별 모양으로 갈라져 있어요. 섬이 윙크하는 것처럼요.',
            '발로 긁어 봐요. 섬은 그 열정에 감사하지만, 안 돼요. 삽이 필요해요 — 핍이 팔아요.',
          ]);
          return;
        }
        thud();
        playTool('shovel');
        spot.alive = false;
        spot.mark.visible = false;
        spot.respawn = rand(240, 480); // the island makes fossils slower than you spend them
        S.bumpDaily('digs');
        const id = rollTable(FOSSIL_TABLE);
        S.addItem(id);
        jingle();
        ui.foundItem(id);
        ui.updateHUD();
        if (!S.hasFlag('firstFossil')) {
          S.setFlag('firstFossil');
          ui.say('박물관의 펀이라면 이걸 엄청 좋아할 거예요. 아마도요. 자기보다 오래된 건 대부분 좋아하는데, 그 목록은 짧아요.');
        } else if (S.dailyCount('digs') >= digBudget()) {
          ui.toast('오늘 섬이 내보내 준 화석은 이게 전부예요. 내일: 과거 더 보탬.', '🪏');
        }
      },
    });
  }

  function update(dt) {
    for (const spot of spots) {
      if (!spot.alive) {
        spot.respawn -= dt;
        if (spot.respawn <= 0) placeSpot(spot);
      }
    }
  }

  return { group, update, spots };
}
