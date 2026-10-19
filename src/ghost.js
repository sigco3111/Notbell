// Murmur. The island's ghost — older than the bell, gentler than the fog.
// Walls mean nothing to them, schedules mean less, and every so often they
// simply... are nearby. Secretly (not very secretly) friendly.

import * as THREE from 'three';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { rand, pick, turnToward } from './utils.js';

const FIRST_MEETING = [
  '…어. 어! 나를 볼 수 있어?',
  '등대에 불이 켜진 뒤로 아무도 나를 똑바로 쳐다보지 않아. 나는 머머야. 종보다 먼저 여기 있었지. 아마 이끼 다음까지도 있을 거야.',
  '모두에게 비밀로 해. 아니, 말해도 돼. 어느 쪽이 더 좋은지 솔직히 까먹었어.',
];

const MURMUR_LINES = [
  '부우. (미안. 전통이야. 서류도 있어.)',
  '나는 종보다 먼저 여기 있었다고. 조용한 아이들은 나를 기억해. 펀은 기억 못 하는 척해. 우리가 하는 작은 놀이야. 걔는 그걸 아주 잘해.',
  '등대 갈고리 — 닦는 게 나야. 누군가는 해야지. 어떤 것들은 항상 준비되어 있어야 하거든.',
  '벽이란 소문이야. 아주 자신만만한 소문.',
  '반딧불 지렁이들이 나한테 손을 흔들어. 벌레가 예의 없다는 말은 믿지 마.',
  '버튼왜건을 한번 헌팅해 봤어. 이미 완벽하더라고. 내가 더할 게 없었어.',
];

const FIRST_VISIT_DELAY = [180, 360];
const BETWEEN_VISIT_DELAY = [600, 1200];
const APPROACH_STAY = [35, 70];
const DRIFT_BY_STAY = [20, 40];
const APPROACH_CHANCE = 0.25;

export function createGhost(player) {
  const group = new THREE.Group();

  const ghost = new THREE.Group();
  const sheetMat = new THREE.MeshStandardMaterial({
    color: 0xdfe8f0, transparent: true, opacity: 0, roughness: 0.9, flatShading: true,
    emissive: 0x9fb8d8, emissiveIntensity: 0.25, depthWrite: false,
  });
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), sheetMat);
  head.position.y = 1.5;
  head.scale.y = 1.15;
  ghost.add(head);
  // the wavy hem: a little skirt of cones
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fold = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), sheetMat);
    fold.position.set(Math.cos(a) * 0.3, 0.85, Math.sin(a) * 0.3);
    fold.rotation.x = Math.PI;
    ghost.add(fold);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2e3640, transparent: true, opacity: 0 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), eyeMat);
    eye.position.set(sx * 0.17, 1.6, 0.42);
    ghost.add(eye);
  }
  ghost.visible = false;
  group.add(ghost);

  let state = 'away';   // away | fadingIn | here | fadingOut
  let timer = rand(...FIRST_VISIT_DELAY); // first visit comes when it comes
  let fade = 0;
  let lineIdx = 0;
  let drift = rand(0, Math.PI * 2);
  let willApproach = false;

  function setOpacity(k) {
    sheetMat.opacity = 0.55 * k;
    eyeMat.opacity = 0.9 * k;
  }

  register({
    getPos: () => ghost.position,
    r: 3,
    zone: () => zones.current(), // wherever you are, that's where they haunt
    enabled: () => state === 'here',
    label: () => (S.hasFlag('metMurmur') ? '머머에게 말 걸기' : '…존재에게 다가가기?'),
    use: () => {
      if (!S.hasFlag('metMurmur')) {
        S.setFlag('metMurmur');
        ui.say(FIRST_MEETING, { speaker: '머머', voice: 880 });
        return;
      }
      ui.say(MURMUR_LINES[lineIdx++ % MURMUR_LINES.length], { speaker: '머머', voice: 880 });
    },
  });

  function update(dt, t, playerPos) {
    if (state === 'away') {
      timer -= dt;
      if (timer <= 0) {
        state = 'fadingIn';
        fade = 0;
        willApproach = rand(0, 1) < APPROACH_CHANCE;
        const a = rand(0, Math.PI * 2);
        const r = rand(7, 12);
        ghost.position.set(playerPos.x + Math.cos(a) * r, playerPos.y, playerPos.z + Math.sin(a) * r);
        ghost.visible = true;
      }
      return;
    }
    // hover and drift — terrain, walls, and furniture are other people's problems
    drift += dt * 0.3;
    ghost.position.x += Math.cos(drift) * dt * 0.5;
    ghost.position.z += Math.sin(drift * 0.8) * dt * 0.5;
    ghost.position.y += ((playerPos.y + 0.25 + Math.sin(t * 1.1) * 0.2) - ghost.position.y) * Math.min(1, dt * 2);
    const dx = playerPos.x - ghost.position.x;
    const dz = playerPos.z - ghost.position.z;
    ghost.rotation.y = turnToward(ghost.rotation.y, Math.atan2(dx, dz), dt, 2);

    if (state === 'fadingIn') {
      fade += dt;
      setOpacity(Math.min(1, fade / 2));
      if (fade >= 2) {
        state = 'here';
        timer = rand(...(willApproach ? APPROACH_STAY : DRIFT_BY_STAY)); // how long they stay
      }
    } else if (state === 'here') {
      timer -= dt;
      // Most visits are just a passing haunt; only a few drift over to visit.
      if (willApproach && Math.hypot(dx, dz) > 4) {
        ghost.position.x += dx * dt * 0.04;
        ghost.position.z += dz * dt * 0.04;
      }
      if (timer <= 0 && !ui.isBusy()) {
        state = 'fadingOut';
        fade = 2;
      }
    } else if (state === 'fadingOut') {
      fade -= dt;
      setOpacity(Math.max(0, fade / 2));
      if (fade <= 0) {
        state = 'away';
        ghost.visible = false;
        timer = rand(...BETWEEN_VISIT_DELAY); // until next time
      }
    }
  }

  return { group, update };
}
