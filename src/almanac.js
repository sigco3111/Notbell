// The living sky: a sun that keeps real-world hours, nights with stars,
// and weather that rolls in off the sea (rain in season, snow in winter).
// Only the island answers to the sky — interiors and the cave keep their
// own light.

import * as THREE from 'three';
import * as zones from './zones.js';
import { SEASON, dayFactor, hourNow, isNight } from './calendar.js';
import * as ui from './ui.js';
import { rand } from './utils.js';

export { SEASON, isNight };

let scene, hemi, sun, playerGroup;

// lighting keyframes: deep night → golden hour → noon
const KEY = {
  night: {
    bg: 0x0d1626, hemiSky: 0x2a3a5c, hemiGround: 0x141f1c, hemiI: 0.55,
    sunC: 0xbcd4ff, sunI: 0.4, fogNear: 70, fogFar: 200,
  },
  golden: {
    bg: 0xf2b88c, hemiSky: 0xffd9b0, hemiGround: 0x6a5a45, hemiI: 1.0,
    sunC: 0xff9b5c, sunI: 1.5, fogNear: 85, fogFar: 215,
  },
  noon: {
    bg: 0x9fdcf7, hemiSky: 0xcfeeff, hemiGround: 0x7ca16a, hemiI: 1.3,
    sunC: 0xfff3d6, sunI: 2.4, fogNear: 95, fogFar: 230,
  },
};

const cA = new THREE.Color(), cB = new THREE.Color();

function lerpKeys(a, b, t, out) {
  out.bg = cA.set(a.bg).lerp(cB.set(b.bg), t).getHex();
  out.hemiSky = cA.set(a.hemiSky).lerp(cB.set(b.hemiSky), t).getHex();
  out.hemiGround = cA.set(a.hemiGround).lerp(cB.set(b.hemiGround), t).getHex();
  out.sunC = cA.set(a.sunC).lerp(cB.set(b.sunC), t).getHex();
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.fogNear = a.fogNear + (b.fogNear - a.fogNear) * t;
  out.fogFar = a.fogFar + (b.fogFar - a.fogFar) * t;
  return out;
}

// --------------------------------------------------------------- weather ----

let weather = 'clear'; // clear | rain | snow | fog
let weatherCheckT = 0;
let precip = null;     // the particle field
let precipVel = [];

export function isRaining() {
  return weather === 'rain';
}

export function isFoggy() {
  return weather === 'fog';
}

export function currentWeather() {
  return weather;
}

// during the rocket launch, the island sky fades toward starry black space
let spaceFade = 0;
export function setSpaceFade(k) {
  spaceFade = Math.max(0, Math.min(1, k));
}

// for tests and for anyone who simply wants it to rain right now
// (overrides the day's schedule for ten real minutes, then nature resumes)
let forcedUntil = 0;

export function forceWeather(w) {
  weather = w;
  forcedUntil = performance.now() + 10 * 60 * 1000;
  buildPrecip();
}

// ---- the day's weather, decided at dawn, deterministically -------------
// every calendar day has a plan: all sun, all wet, a wet morning, a wet
// evening, a foggy morning, or — Howell's favorite — a foggy night.

function dayHash() {
  const d = new Date();
  let h = 2166136261;
  for (const c of `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function scheduledWeather() {
  const wet = SEASON === 'winter' ? 'snow' : 'rain';
  const r = dayHash();
  const d = new Date();
  const h = d.getHours() + d.getMinutes() / 60;
  if (r < 0.40) return 'clear';                       // a sunny day
  if (r < 0.55) return wet;                           // a properly wet day
  if (r < 0.70) return h < 12 ? wet : 'clear';        // wet morning
  if (r < 0.82) return h >= 16 ? wet : 'clear';       // wet evening
  if (r < 0.92) return h < 10.5 ? 'fog' : 'clear';    // foggy morning
  return h >= 19 || h < 7 ? 'fog' : 'clear';          // a foggy night
}

function syncWeather(first = false) {
  if (performance.now() < forcedUntil) return;
  const next = scheduledWeather();
  if (next === weather) return;
  weather = next;
  buildPrecip();
  if (!first) {
    ui.toast(weather === 'rain' ? '비가 바다에서 밀려와요.'
      : weather === 'snow' ? '눈이, 공손하게, 내리기 시작해요.'
      : weather === 'fog' ? '안개가 바다에서 걸어 들어와요, 느리고 확실하게.'
      : '구름이 다른 섬을 괴롭히러 흩어져요.',
    weather === 'rain' ? '🌧️' : weather === 'snow' ? '❄️' : weather === 'fog' ? '🌫️' : '☀️');
  }
}

function buildPrecip() {
  if (precip) {
    scene.remove(precip);
    precip.geometry.dispose();
    precip.material.dispose();
    precip = null;
  }
  if (weather === 'clear' || weather === 'fog') return; // fog has no particles, only opinions
  const snow = weather === 'snow';
  const N = snow ? 350 : 500;
  const pts = new Float32Array(N * 3);
  precipVel = [];
  for (let i = 0; i < N; i++) {
    pts[i * 3] = rand(-22, 22);
    pts[i * 3 + 1] = rand(0, 26);
    pts[i * 3 + 2] = rand(-22, 22);
    precipVel.push(snow ? rand(1.6, 2.6) : rand(16, 22));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  precip = new THREE.Points(geo, new THREE.PointsMaterial({
    color: snow ? 0xffffff : 0xa8cce4,
    size: snow ? 0.17 : 0.07,
    transparent: true,
    opacity: snow ? 0.95 : 0.55,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  scene.add(precip);
}

// ----------------------------------------------------------------- init ----

export function init(refs) {
  ({ scene, hemi, sun, playerGroup } = refs);
  syncWeather(true);
}

const mixed = {};

export function update(dt) {
  weatherCheckT -= dt;
  if (weatherCheckT <= 0) {
    weatherCheckT = 10; // the schedule doesn't change often; neither should we
    syncWeather();
  }

  const onIsland = zones.current() === 'island' || zones.current() === 'sea';

  // precipitation follows the player around the island
  if (precip) {
    precip.visible = onIsland;
    if (onIsland) {
      precip.position.set(playerGroup.position.x, 0, playerGroup.position.z);
      const pos = precip.geometry.attributes.position;
      const snow = weather === 'snow';
      const t = performance.now() / 1000;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - precipVel[i] * dt;
        if (y < -1) y = 26;
        pos.setY(i, y);
        if (snow) pos.setX(i, pos.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.6);
      }
      pos.needsUpdate = true;
    }
  }

  if (!onIsland) return;

  // sun runs on the actual clock
  const h = hourNow();
  const f = dayFactor(h);
  if (f > 0.35) lerpKeys(KEY.golden, KEY.noon, (f - 0.35) / 0.65, mixed);
  else lerpKeys(KEY.night, KEY.golden, f / 0.35, mixed);

  // wet weather mutes everything toward gray; fog swallows the world whole
  if (weather === 'fog') {
    mixed.bg = cA.set(mixed.bg).lerp(cB.set(0xb6bfc2), 0.8).getHex();
    mixed.sunI *= 0.3;
    mixed.hemiI *= 0.95;
    mixed.fogNear = 8;
    mixed.fogFar = Math.min(mixed.fogFar * 0.25, 55);
  } else if (weather !== 'clear') {
    mixed.bg = cA.set(mixed.bg).lerp(cB.set(0x9aa6ad), 0.45).getHex();
    mixed.sunI *= 0.5;
    mixed.hemiI *= 0.8;
    mixed.fogNear *= 0.65;
    mixed.fogFar *= 0.75;
  }

  scene.background.set(mixed.bg);
  scene.fog.color.set(mixed.bg);
  scene.fog.near = mixed.fogNear;
  scene.fog.far = mixed.fogFar;
  hemi.color.set(mixed.hemiSky);
  hemi.groundColor.set(mixed.hemiGround);
  hemi.intensity = mixed.hemiI;
  sun.color.set(mixed.sunC);
  sun.intensity = mixed.sunI;

  // the rocket climbs out of the sky: lerp the whole vault toward starry space
  if (spaceFade > 0) {
    const sb = cA.set(mixed.bg).lerp(cB.set(0x05070f), spaceFade).getHex();
    scene.background.set(sb);
    scene.fog.color.set(sb);
    scene.fog.far = mixed.fogFar + (560 - mixed.fogFar) * spaceFade; // open up so the dark + stars read
    hemi.intensity = mixed.hemiI * (1 - 0.55 * spaceFade);
    sun.intensity = mixed.sunI * (1 - 0.45 * spaceFade);
  }

  // the sun (or moon) arcs east → west, and its shadow window follows the
  // player so both islands stay lit correctly
  const px = playerGroup.position.x, pz = playerGroup.position.z;
  if (f > 0) {
    const theta = ((h - 6) / 12) * Math.PI;
    sun.position.set(px + Math.cos(theta) * 60, Math.max(12, Math.sin(theta) * 70), pz + 30);
  } else {
    sun.position.set(px - 35, 60, pz + 30);
  }
  sun.target.position.set(px, 0, pz);

  return { nightFactor: 1 - Math.min(1, f / 0.25) };
}
