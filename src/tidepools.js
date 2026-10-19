// The tide pools: a rocky shelf at the sea's edge where small dramas
// unfold hourly. Rummage gently; everything in there has a schedule.

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { rollTable, POOL_TABLE } from './catalog.js';
import { plop, jingle } from './audio.js';
import { rand, pick } from './utils.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function makeStarfish(color = 0xe8743a) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(color, 0.7));
    arm.position.set(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
    arm.scale.set(1.6, 0.5, 0.7);
    arm.rotation.y = -a;
    g.add(arm);
  }
  return g;
}

function makeAnemone() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.12, 7), mat(0xc77dff, 0.7));
  base.position.y = 0.06;
  g.add(base);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 4), mat(0xe2a9ff, 0.6));
    t.position.set(Math.cos(a) * 0.09, 0.2, Math.sin(a) * 0.09);
    t.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(t);
  }
  return g;
}

function makeCrab() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0xd84f4f, 0.7));
  body.scale.set(1.3, 0.7, 1);
  body.position.y = 0.09;
  g.add(body);
  for (const sx of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0xd84f4f, 0.7));
    claw.position.set(sx * 0.2, 0.08, 0.1);
    g.add(claw);
  }
  return g;
}

export function createTidePools() {
  const group = new THREE.Group();
  const site = SITES.pools;
  const pools = [];

  // three pools, loosely triangular
  const offsets = [[-2.4, -0.8], [1.8, -1.8], [0.4, 2.0]];
  for (const [ox, oz] of offsets) {
    const px = site.x + ox, pz = site.z + oz;
    const py = terrainHeight(px, pz);
    const pool = new THREE.Group();

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 10),
      new THREE.MeshStandardMaterial({
        color: 0x57c8d8, roughness: 0.15, transparent: true, opacity: 0.85,
        emissive: 0x1a4a52, emissiveIntensity: 0.25,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.1;
    pool.add(water);

    // rim of huddled rocks
    const nRocks = 9;
    for (let i = 0; i < nRocks; i++) {
      const a = (i / nRocks) * Math.PI * 2 + rand(-0.15, 0.15);
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(rand(0.22, 0.4), 0),
        mat(pick([0x8a8f95, 0x9aa0a6, 0x767b80]))
      );
      rock.position.set(Math.cos(a) * 1.5, rand(0.05, 0.2), Math.sin(a) * 1.5);
      rock.castShadow = true;
      pool.add(rock);
    }

    // residents (decorative — the catchable ones hide under things)
    const resident = pick([makeStarfish, makeAnemone, makeCrab])();
    resident.position.set(rand(-0.5, 0.5), 0.12, rand(-0.5, 0.5));
    pool.add(resident);

    pool.position.set(px, py, pz);
    group.add(pool);

    const p = { x: px, z: pz, cooldown: 0, water };
    pools.push(p);

    register({
      pos: new THREE.Vector3(px, 0, pz),
      r: 2.4,
      enabled: () => p.cooldown <= 0,
      label: '바닷가 웅덩이 뒤지기',
      use: async () => {
        p.cooldown = rand(90, 180);
        plop();
        if (!S.hasFlag('firstTidePool')) {
          S.setFlag('firstTidePool');
          await ui.say([
            '소매를 걷어요. 소매가 없어요. 그래도 진행해요.',
            '조약돌 아래, 아주 판단력 강한 달팽이 두 마리 사이에서…',
          ]);
        }
        const id = rollTable(POOL_TABLE);
        S.addItem(id);
        jingle();
        ui.foundItem(id);
        ui.updateHUD();
      },
    });
  }

  // a scatter of seashells and an extra starfish on the sand between pools
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(3, 5.5);
    const x = site.x + Math.cos(a) * r, z = site.z + Math.sin(a) * r;
    const shell = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.16, 5),
      mat(pick([0xfff3da, 0xffd9c9, 0xe8e0d0]), 0.6)
    );
    shell.position.set(x, terrainHeight(x, z) + 0.05, z);
    shell.rotation.set(rand(0, 1.2), rand(0, Math.PI * 2), 0);
    group.add(shell);
  }

  function update(dt, t) {
    for (const p of pools) {
      if (p.cooldown > 0) p.cooldown -= dt;
      p.water.material.emissiveIntensity = 0.2 + Math.sin(t * 1.4 + p.x) * 0.1;
    }
  }

  return { group, update };
}
