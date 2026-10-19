import * as THREE from 'three';
import { rand } from './utils.js';
import { dayFactor } from './calendar.js';
import * as zones from './zones.js';

// during the rocket launch, force the stars out regardless of the clock
let launchNight = 0;
export function setLaunchNight(k) { launchNight = Math.max(0, Math.min(1, k)); }

// Puffy low-poly clouds that drift across the island and cast soft
// wandering shadows — plus stars that come out when the real sun goes down.
export function createSky() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const clouds = [];

  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand(0, 3));
    for (let k = 0; k < puffs; k++) {
      const r = rand(1.8, 3.4);
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      puff.position.set((k - (puffs - 1) / 2) * r * 0.95 + rand(-0.6, 0.6), rand(-0.4, 0.4), rand(-1, 1));
      puff.scale.set(1, 0.55, 0.75);
      puff.castShadow = true;
      cloud.add(puff);
    }
    cloud.position.set(rand(-140, 140), rand(24, 38), rand(-110, 110));
    cloud.userData.speed = rand(0.8, 2.0);
    clouds.push(cloud);
    group.add(cloud);
  }

  // stars: a dome of soft points, faded in by the night
  const starPts = [];
  for (let i = 0; i < 320; i++) {
    const a = rand(0, Math.PI * 2);
    const alt = rand(0.12, 1.4); // keep them up off the horizon
    const R = 320;
    starPts.push(Math.cos(a) * Math.cos(alt) * R, Math.sin(alt) * R * 0.7 + 20, Math.sin(a) * Math.cos(alt) * R);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xeef4ff, size: 2.2, transparent: true, opacity: 0,
    sizeAttenuation: false, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // constellations: a few shapes the islanders named, drawn as brighter
  // stars joined by the faintest lines. [azimuth°, altitude°] points and the
  // strokes between them. The Bell has one star missing — the clapper. The
  // sailors say it fell into the sea the night of the Great Squall.
  const CONSTELLATIONS = [
    { name: '종', pts: [[40, 38], [36, 44], [40, 50], [46, 50], [50, 44], [46, 38], [33, 36], [53, 36]],
      lines: [[6, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 7]] }, // (no clapper. of course.)
    { name: '갈고리', pts: [[120, 30], [120, 38], [120, 46], [116, 26], [111, 28], [110, 33]],
      lines: [[2, 1], [1, 0], [0, 3], [3, 4], [4, 5]] },
    { name: '단추', pts: [[200, 30], [210, 30], [210, 40], [200, 40], [204, 34], [206, 34], [204, 36], [206, 36]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 0]] },
    { name: '늑대(여우)', pts: [[280, 25], [288, 28], [296, 27], [300, 33], [296, 36], [292, 31], [284, 31], [278, 30]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]] },
    { name: '큰 파르메산', pts: [[160, 55], [166, 58], [168, 64], [164, 69], [157, 69], [153, 64], [155, 58]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [0, 3]] },
    { name: '랜턴', pts: [[330, 45], [336, 45], [338, 52], [333, 58], [328, 52], [333, 62]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [3, 5]] },
  ];
  const skyDir = ([az, alt], R = 300) => {
    const a = (az * Math.PI) / 180, e = (alt * Math.PI) / 180;
    return [Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R * 0.7 + 20, Math.sin(a) * Math.cos(e) * R];
  };
  const brightPts = [], linePts = [];
  for (const c of CONSTELLATIONS) {
    for (const p of c.pts) brightPts.push(...skyDir(p));
    for (const [i, j] of c.lines) linePts.push(...skyDir(c.pts[i], 299), ...skyDir(c.pts[j], 299));
  }
  const brightGeo = new THREE.BufferGeometry();
  brightGeo.setAttribute('position', new THREE.Float32BufferAttribute(brightPts, 3));
  const brightMat = new THREE.PointsMaterial({
    color: 0xfff6d8, size: 3.6, transparent: true, opacity: 0,
    sizeAttenuation: false, depthWrite: false, fog: false,
  });
  const bright = new THREE.Points(brightGeo, brightMat);
  group.add(bright);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xbcd0ff, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  group.add(lines);

  function update(dt) {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 160) c.position.x = -160;
    }
    const f = dayFactor();
    const nightness = Math.max(launchNight, 1 - Math.min(1, f / 0.25));
    starMat.opacity = nightness * 0.9;
    // stars belong to the island's sky — interiors and the cave keep their own
    stars.visible = nightness > 0.02 &&
      (zones.current() === 'island' || zones.current() === 'sea');
    brightMat.opacity = nightness;
    lineMat.opacity = nightness * 0.22;
    bright.visible = lines.visible = stars.visible;
  }

  return { group, update };
}

export const CONSTELLATION_NAMES = ['종', '갈고리', '단추', '늑대(여우)', '큰 파르메산', '랜턴'];
