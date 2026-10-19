// Starfall. On clear nights, now and then, a star comes loose: a streak
// across the sky, and then — slowly, like a feather that has changed its
// mind about falling — a little glowing star drifts down somewhere near you.
// Catch it in the net before it lands and you have a Star Fragment, warm and
// humming. Let it land and you can still gather the Stardust it leaves.

import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { isNight } from './calendar.js';
import { currentWeather } from './almanac.js';
import { tone, jingle } from './audio.js';
import { play as playTool } from './tools.js';

function starGeo() {
  // a chubby five-pointed star, faceted: two pentagon fans back to back
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 0.13 : 0.3;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1,
  });
  g.center();
  return g;
}

let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const gr = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,245,200,1)');
  gr.addColorStop(0.4, 'rgba(255,230,150,0.5)');
  gr.addColorStop(1, 'rgba(255,220,120,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

export function createStarfall(player) {
  const group = new THREE.Group();
  let nextT = 120 + Math.random() * 180; // (rarer than it was: a falling star should be an occasion)
  let star = null; // { g, streak, phase: 'streak'|'fall'|'landed', t, from, to, handle }

  const starMat = new THREE.MeshStandardMaterial({
    color: 0xffe68a, emissive: 0xffd24a, emissiveIntensity: 1.3, flatShading: true, roughness: 0.3,
  });

  function spawn() {
    const p = player.group.position;
    let to = null;
    for (let k = 0; k < 20 && !to; k++) {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 9;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (zones.islandCanStand(x, z, 0.4) && terrainHeight(x, z) > 0.2) to = { x, z, y: zones.islandGroundHeight(x, z) };
    }
    if (!to) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(starGeo(), starMat);
    g.add(body);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.set(1.8, 1.8, 1);
    g.add(halo);
    // the streak: a thin bright needle across the sky first
    const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 26, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    const from = { x: to.x - 60, y: 70, z: to.z - 40 };
    streak.position.set(from.x, from.y, from.z);
    streak.lookAt(to.x, to.y + 14, to.z);
    streak.rotateX(Math.PI / 2);
    group.add(streak);
    g.visible = false;
    group.add(g);
    starMat.emissiveIntensity = 1.3;
    star = { g, body, streak, phase: 'streak', t: 0, from, to, handle: null };
    tone(1760, { dur: 0.6, type: 'sine', vol: 0.02, slide: -800 });
    ui.toast('섬 위로 별 하나가 흘러 떨어져요… 근처로 내려오고 있어요. ✨', '🌠');
    star.handle = register({
      getPos: () => star?.g.position ?? new THREE.Vector3(0, -99, 0), r: 2.4,
      enabled: () => !!star && star.phase !== 'streak',
      label: () => (star?.phase === 'fall'
        ? (S.state.tools.net ? '떨어지는 별 잡기!' : '떨어지는 별에 손 뻗기')
        : '별가루 줍기'),
      use: () => {
        if (!star) return;
        if (star.phase === 'fall') {
          if (!S.state.tools.net) {
            ui.say('발 바로 위를 떠다녀요, 공손하게, 닿지 않게. 그물이면 되는데 — 핍이 팔아요. 아니면 떨어질 때까지 기다려요.');
            return;
          }
          playTool('net');
          S.addItem('star_fragment');
          jingle();
          tone(1320, { time: 0.15, dur: 0.8, type: 'sine', vol: 0.03 });
          ui.foundItem('star_fragment');
        } else {
          S.addItem('stardust');
          jingle();
          ui.foundItem('stardust');
        }
        ui.updateHUD();
        clear();
      },
    });
  }

  function clear() {
    if (!star) return;
    group.remove(star.g, star.streak);
    star.handle?.remove();
    star = null;
  }

  function update(dt, t) {
    const clearSky = currentWeather() === 'clear' || currentWeather() === 'snow';
    if (!star) {
      if (zones.current() !== 'island' || !isNight() || !clearSky) return;
      nextT -= dt;
      if (nextT <= 0) {
        nextT = 300 + Math.random() * 420;
        spawn();
      }
      return;
    }
    star.t += dt;
    const s = star;
    if (s.phase === 'streak') {
      const k = Math.min(1, s.t / 0.9);
      s.streak.material.opacity = 0.9 * (1 - k);
      s.streak.position.set(s.from.x + (s.to.x - s.from.x) * k, s.from.y + (s.to.y + 14 - s.from.y) * k, s.from.z + (s.to.z - s.from.z) * k);
      if (k >= 1) {
        s.streak.visible = false;
        s.phase = 'fall';
        s.t = 0;
        s.g.visible = true;
      }
    } else if (s.phase === 'fall') {
      // down like a feather: slow, swaying, turning over and over
      const k = Math.min(1, s.t / 14);
      s.g.position.set(
        s.to.x + Math.sin(s.t * 1.3) * 1.2 * (1 - k),
        s.to.y + 0.5 + 12 * (1 - k),
        s.to.z + Math.cos(s.t * 0.9) * 0.8 * (1 - k));
      s.body.rotation.y += dt * 2;
      s.body.rotation.z = Math.sin(s.t * 2) * 0.4;
      if (k >= 1) { s.phase = 'landed'; s.t = 0; }
    } else {
      // landed: a soft pulse, fading slowly to dust over half a minute
      s.body.rotation.y += dt * 0.6;
      s.g.position.y = s.to.y + 0.35 + Math.sin(s.t * 3) * 0.05;
      starMat.emissiveIntensity = 0.6 + Math.sin(s.t * 4) * 0.3;
      if (s.t > 40) clear();
    }
    void t;
  }

  return { group, update };
}
