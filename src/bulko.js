// BULKO. The southern isle. A warehouse, a parking lot nobody can explain,
// a hot dog that costs one and a half buttons and always will, and a
// lobster tank that is Not For Sale because the lobsters live there.

import * as THREE from 'three';
import { ISLAND4, terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { ITEMS } from './catalog.js';
import { kaching, jingle, sip } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { currentWeather } from './almanac.js';
import { isNight } from './calendar.js';
import { makeCeilingTube } from './buildings.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex, exclude = []) {
  const skip = new Set(exclude.filter(Boolean));
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex).filter((child) => !skip.has(child)));
  parent.add(root);
  return root;
}

function textPanel(lines, w, h, bg, fg, fontPx) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach(([text, y, px], i) => {
    let size = px ?? fontPx;
    do {
      ctx.font = `800 ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`;
      if (ctx.measureText(text).width <= w * 0.9 || size <= 11) break;
      size -= 2;
    } while (true);
    ctx.fillText(text, w / 2, y);
    void i;
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}

const IN = { x: 300, z: 1220 };

const TANK_LINES = [
  '인쇄된 카드: “매물 아님.” 그 아래 손글씨: “그만 물어보시오. —경영진.” 그 아래 더 작게: “(바닷가재들)”',
  '안에는 작은 소파, 작은 램프, 작은 러그, 그리고 작은 액자에 든 〈큰 파도〉. 바닷가재 한 마리는 독서 중. 다른 한 마리는 십자말풀이를 하는 듯해요.',
  '바나비와 가족 resemblance가 느껴져요. 현명하게도, 어느 쪽에도 언급하지 않기로 해요.',
  '직원이 지나가다 쳐다보는 걸 보고 그냥 고개를 저어요 — 당신에게가 아니라. 상황에. 이 모든 것에.',
];

// ============================================================ the TV wall ----
// BULKO's wall of screens, each tuned to a lo-fi "channel." Walk up and the
// dialogue box plays the broadcast; the screens cycle two chunky painted canvas
// frames, in the same code-painted spirit as Luna's rotating café prints.

const TV_WEATHERS = ['clear', 'rain', 'snow', 'fog'];
const TV_AD_KEYS = ['ad_hotdog', 'ad_lantern', 'ad_scuba', 'ad_parm'];

function makeScreenTex(key, step) {
  // four frames a channel: the chunky bits flip on alternate frames, the
  // waves and wobbles advance a quarter-turn each frame
  const frame = step % 2, phase = step * Math.PI / 2;
  const cv = document.createElement('canvas');
  cv.width = 320;
  cv.height = 200;
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;

  const dot = (x, y, r, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };
  const label = (text, wide = 132) => {
    c.fillStyle = 'rgba(255,250,240,0.9)';
    c.fillRect(18, 164, wide, 20);
    c.fillStyle = '#3d3126';
    c.font = '800 14px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.fillText(text, 26, 174);
  };
  const scan = () => {
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = frame ? 1 : 0; y < H; y += 4) c.fillRect(0, y, W, 1);
    c.fillStyle = 'rgba(30,24,20,0.08)';
    c.fillRect(0, 0, W, 9);
    c.fillRect(0, H - 9, W, 9);
  };
  const cloud = (x, y, color = '#40576d') => {
    c.fillStyle = color;
    for (const [ox, oy, rx, ry] of [
      [-38, 5, 35, 15], [-12, -1, 42, 18], [22, 2, 37, 16], [54, 7, 28, 13],
    ]) {
      c.beginPath();
      c.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }
  };
  const island = (base = '#6ec45a', hill = '#57b65b') => {
    c.fillStyle = '#4a78b0';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 124);
    c.quadraticCurveTo(72, 142, 134, 128);
    c.quadraticCurveTo(228, 104, W, 130);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = base;
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 154);
    c.quadraticCurveTo(78, 102, 152, 150);
    c.quadraticCurveTo(225, 192, W, 142);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = hill;
    c.beginPath();
    c.moveTo(24, H);
    c.quadraticCurveTo(98, 118, 180, 162);
    c.lineTo(W, H);
    c.fill();
  };
  const scooch = (x, y, mood = 'plain') => {
    const body = mood === 'snow' ? '#7abf58' : '#6ab04a';
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(x, y, 44, 32, 0, 0, Math.PI * 2);
    c.fill();
    dot(x - 21, y - 25, 12, body);
    dot(x + 21, y - 25, 12, body);
    dot(x - 21, y - 25, 4, '#16140f');
    dot(x + 21, y - 25, 4, '#16140f');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    if (mood === 'fog') {
      c.moveTo(x - 21, y + 3);
      c.lineTo(x + 21, y + 3);
    } else {
      c.moveTo(x - 25, y + 4);
      c.quadraticCurveTo(x, y + (mood === 'snow' ? 19 : 22) + (frame ? 2 : -1), x + 25, y + 4);
    }
    c.stroke();
    if (mood === 'clear') {
      c.strokeStyle = '#16140f';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x - 34, y - 27);
      c.lineTo(x - 10, y - 23);
      c.moveTo(x + 10, y - 23);
      c.lineTo(x + 34, y - 27);
      c.stroke();
      dot(x - 21, y - 24, 8, '#16140f');
      dot(x + 21, y - 24, 8, '#16140f');
    }
    if (mood === 'snow') {
      c.fillStyle = '#e8632c';
      c.fillRect(x - 32, y - 2, 64, 8);
      c.fillRect(x + 15, y + 6, 10, 24);
    }
  };
  const drawHotdog = () => {
    c.fillStyle = '#f2913c';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.moveTo(0, 34);
    c.lineTo(W, 12);
    c.lineTo(W, 108);
    c.lineTo(0, 132);
    c.fill();
    c.fillStyle = '#c2452c';
    c.fillRect(0, 142, W, 58);
    c.fillStyle = '#16140f';
    c.font = '900 42px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('BULKO', 34, 68 + (frame ? 1 : 0));
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(172, 112, 88, 22, -0.06, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#8a4d2c';
    c.beginPath();
    c.ellipse(172, 110 + (frame ? 1 : -1), 75, 12, -0.06, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6ec45a';
    c.lineWidth = 5;
    c.beginPath();
    for (let x = 96; x < 248; x += 20) {
      c.moveTo(x, 104);
      c.quadraticCurveTo(x + 10, 92 + (frame ? 5 : 0), x + 20, 104);
    }
    c.stroke();
    dot(270, 55, frame ? 18 : 14, '#fffaf0');
    c.fillStyle = '#3d3126';
    c.font = '800 20px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('1.5ᵇ', 251, 62);
    c.font = '800 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('2개 내고 반 개 환급', 82, 137);
    label('핫도그');
  };

  if (key === 'bars') {
    // the test pattern: somebody left channel 3 on. it is weirdly soothing
    const bars = ['#e8e8e8', '#e8d84a', '#4ad8d8', '#4ad84a', '#d84ad8', '#d84a4a', '#4a4ad8'];
    bars.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * (W / 7), 0, W / 7 + 1, 130); });
    c.fillStyle = '#2e2a2c';
    c.fillRect(0, 130, W, 70);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(0, (step * 37) % 130, W, 10); // the roll bar, rolling
    label('잠시만 기다려 주세요', 150);
  } else if (key === 'hoot') {
    c.fillStyle = '#221a35';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#2e3e6d';
    c.beginPath();
    c.moveTo(0, 92);
    c.bezierCurveTo(70, 42, 146, 68, 214, 34);
    c.bezierCurveTo(256, 16, 292, 20, W, 2);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    dot(260, 40, 22, '#ffd23e');
    dot(269, 36, 21, '#221a35');
    c.fillStyle = '#8a5a3a';
    c.fillRect(0, 132, W, 68);
    c.fillStyle = '#d9a440';
    c.fillRect(58, 126 + (frame ? 2 : 0), 206, 16);
    c.fillStyle = '#3c2a22';
    c.beginPath();
    c.ellipse(160, 102, 36, 48, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5a3b2d';
    c.beginPath();
    c.moveTo(130, 70);
    c.lineTo(108, 46);
    c.lineTo(142, 58);
    c.moveTo(190, 70);
    c.lineTo(212, 46);
    c.lineTo(178, 58);
    c.fill();
    dot(147, 96, 11, '#fffaf0');
    dot(173, 96, 11, '#fffaf0');
    dot(148, 97 + (frame ? 3 : 0), 4, '#1b1816');
    dot(174, 97 + (frame ? 0 : 3), 4, '#1b1816');
    c.fillStyle = '#f2913c';
    c.beginPath();
    c.moveTo(160, 108);
    c.lineTo(150, 119 + (frame ? 2 : 0));
    c.lineTo(170, 119 + (frame ? 2 : 0));
    c.fill();
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(105, 133);
    c.quadraticCurveTo(96, 105, 112, 84 + (frame ? 2 : -2));
    c.moveTo(215, 133);
    c.quadraticCurveTo(226, 108, 214, 84 + (frame ? -2 : 2));
    c.stroke();
    dot(222, 128, 5, '#16140f');
    c.fillRect(220, 130, 4, 20);
    label('레이트 나이트');
  } else if (key === 'science') {
    c.fillStyle = '#123a39';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#1d5a56';
    c.fillRect(0, 126, W, 74);
    c.strokeStyle = '#cfeeff';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(86, 74, 38, 0.2, Math.PI * 1.8);
    c.moveTo(116, 98);
    c.lineTo(150, 130);
    c.stroke();
    c.fillStyle = '#cfeeff';
    c.fillRect(60, 128, 108, 9);
    c.fillRect(105, 112, 15, 34);
    dot(236, 58, 18 + (frame ? 2 : 0), '#ffd23e');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(236, 58, 34, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#e8632c';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(230, 126);
    c.lineTo(248, 82);
    c.lineTo(266, 126);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.moveTo(248, 78);
    c.lineTo(238, 104);
    c.lineTo(258, 104);
    c.fill();
    c.fillStyle = '#f2913c';
    c.fillRect(216, 126, 64, 12);
    for (let i = 0; i < 6; i++) dot(42 + i * 35, 154 + Math.sin(i + phase) * 4, 4, '#9fdcf7');
    label('낫벨 과학');
  } else if (key === 'sea') {
    c.fillStyle = '#e8dcc8';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#7ec3e8';
    c.fillRect(0, 0, W, 82);
    c.fillStyle = '#1f6f9a';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 76);
    c.bezierCurveTo(58, 36, 130, 44, 124, 78);
    c.bezierCurveTo(118, 104, 76, 102, 66, 92);
    c.bezierCurveTo(132, 140, 238, 118, W, 98);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = '#fffaf0';
    for (let i = 0; i < 9; i++) dot(28 + i * 18, 58 + Math.sin(i + phase) * 6, 8 - (i % 3), '#fffaf0');
    c.fillStyle = '#27408f';
    c.beginPath();
    c.moveTo(0, 150);
    for (let x = 0; x <= W; x += 18) c.lineTo(x, 150 + Math.sin(x * 0.05 + phase) * 8);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    c.fillStyle = '#8a6f4d';
    c.beginPath();
    c.ellipse(220, 136 + (frame ? 2 : -1), 42, 8, -0.12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffd23e';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(286, 38);
    c.quadraticCurveTo(300, 64, 282, 78);
    c.stroke();
    label('바다');
  } else if (key === 'weather_clear') {
    c.fillStyle = '#9fdcf7';
    c.fillRect(0, 0, W, H);
    dot(76, 48, 30 + (frame ? 2 : 0), '#ffd23e');
    c.strokeStyle = '#ffd23e';
    c.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      c.beginPath();
      c.moveTo(76 + Math.cos(a) * 42, 48 + Math.sin(a) * 42);
      c.lineTo(76 + Math.cos(a) * 52, 48 + Math.sin(a) * 52);
      c.stroke();
    }
    island();
    c.fillStyle = '#fffaf0';
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.ellipse(186 + i * 17, 56 + Math.sin(i + phase) * 2, 18, 7, 0, 0, Math.PI * 2);
      c.fill();
    }
    scooch(234, 130, 'clear');
    label('날씨: 맑음', 144);
  } else if (key === 'weather_rain') {
    c.fillStyle = '#bcd8ec';
    c.fillRect(0, 0, W, H);
    island();
    cloud(118, 42, '#40576d');
    cloud(224, 54, '#354a5d');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 4;
    c.lineCap = 'round';
    for (let x = 28; x < 294; x += 24) {
      c.beginPath();
      c.moveTo(x + (frame ? 8 : 0), 72);
      c.lineTo(x - 8 + (frame ? 8 : 0), 104);
      c.stroke();
    }
    c.strokeStyle = '#ffd23e';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(94, 66);
    c.lineTo(76, 102);
    c.lineTo(108, 94);
    c.lineTo(90, 134);
    c.stroke();
    scooch(236, 130, 'rain');
    label('날씨: 비', 144);
  } else if (key === 'weather_snow') {
    c.fillStyle = '#cfe8f2';
    c.fillRect(0, 0, W, H);
    island('#e8f0e8', '#d8e3dc');
    cloud(102, 42, '#eef5f5');
    cloud(230, 50, '#dfe8ec');
    for (let i = 0; i < 42; i++) {
      const x = (i * 37 + frame * 9) % W;
      const y = (i * 23 + frame * 5) % 145;
      dot(x, y, i % 3 === 0 ? 3 : 2, '#fffaf0');
    }
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(88, 145, 28, 18, 0, 0, Math.PI * 2);
    c.ellipse(88, 119, 21, 21, 0, 0, Math.PI * 2);
    c.fill();
    dot(81, 116, 3, '#16140f');
    dot(95, 116, 3, '#16140f');
    c.fillStyle = '#f2913c';
    c.beginPath();
    c.moveTo(88, 123);
    c.lineTo(108, 128);
    c.lineTo(88, 132);
    c.fill();
    scooch(238, 130, 'snow');
    label('날씨: 눈', 144);
  } else if (key === 'weather_fog') {
    c.fillStyle = '#aebdc2';
    c.fillRect(0, 0, W, H);
    island('#8fa99c', '#7f9a90');
    c.globalAlpha = 0.82;
    c.fillStyle = '#e8e4d8';
    for (let i = 0; i < 6; i++) {
      const y = 42 + i * 20 + (frame ? 3 : 0);
      c.beginPath();
      c.moveTo(-20, y);
      for (let x = -20; x <= W + 20; x += 18) c.lineTo(x, y + Math.sin(x * 0.035 + i) * 5);
      c.lineTo(W + 20, y + 14);
      c.lineTo(-20, y + 14);
      c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#5a6b72';
    c.fillRect(64, 84, 18, 72);
    c.fillStyle = '#6e7c82';
    c.fillRect(52, 70, 42, 18);
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.moveTo(73, 76);
    c.quadraticCurveTo(112, 66, 152, 72 + (frame ? 3 : -3));
    c.quadraticCurveTo(112, 84, 73, 82);
    c.fill();
    scooch(238, 132, 'fog');
    label('날씨: 안개', 144);
  } else if (key === 'ad_hotdog') {
    drawHotdog();
  } else if (key === 'ad_lantern') {
    c.fillStyle = '#2e2540';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#5b3e2f';
    c.fillRect(0, 134, W, 66);
    c.fillStyle = '#f2b88c';
    c.beginPath();
    c.moveTo(0, 58);
    c.quadraticCurveTo(82, 28, 162, 58);
    c.quadraticCurveTo(238, 88, W, 42);
    c.lineTo(W, 134);
    c.lineTo(0, 134);
    c.fill();
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.ellipse(158, 76, 64 + (frame ? 4 : 0), 42 + (frame ? 2 : 0), 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#8a5a3a';
    c.fillRect(130, 84, 56, 48);
    c.fillStyle = '#f7ead3';
    c.beginPath();
    c.ellipse(158, 80, 20, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#3d3126';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(158, 56, 28, Math.PI, 0);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(76, 124 + (frame ? 1 : -1), 35, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#4a2d24';
    c.beginPath();
    c.ellipse(76, 122 + (frame ? 1 : -1), 25, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d9a440';
    c.beginPath();
    c.moveTo(238, 92);
    c.lineTo(250, 128);
    c.lineTo(226, 128);
    c.fill();
    dot(238, 84, 13, '#3c2a22');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(218, 112 + frame);
    c.quadraticCurveTo(238, 98, 258, 112 + frame);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.font = '900 25px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('디카페인 아님', 38, 47);
    label('랜턴 룸', 162);
  } else if (key === 'ad_scuba') {
    c.fillStyle = '#7ec3e8';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#1f6f9a';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 88);
    for (let x = 0; x <= W; x += 16) c.lineTo(x, 88 + Math.sin(x * 0.05 + phase) * 7);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = '#27408f';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 142);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, 142 + Math.sin(x * 0.04 + 2 + phase) * 10);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = '#c9962e';
    c.beginPath();
    c.ellipse(158, 84 + (frame ? 2 : -1), 48, 55, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(118, 88 + (frame ? 2 : -1), 80, 42);
    c.fillStyle = '#7a5a2c';
    c.fillRect(112, 126 + (frame ? 2 : -1), 92, 14);
    c.fillStyle = '#bfe6f2';
    c.beginPath();
    c.ellipse(158, 78 + (frame ? 2 : -1), 26, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6b4a2e';
    c.lineWidth = 7;
    c.beginPath();
    c.ellipse(158, 78 + (frame ? 2 : -1), 30, 26, 0, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.font = '900 28px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('헤엄쳐요', 34, 49);
    c.font = '900 21px ui-rounded, "Segoe UI", system-ui, sans-serif'; // (it ran off the edge at 28)
    c.fillText('물고기가', 168, 49);
    c.font = '900 20px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('수다 떠는 곳', 203, 73);
    c.fillStyle = '#3d3126';
    c.beginPath();
    c.moveTo(72, 86);
    c.lineTo(92, 96);
    c.lineTo(72, 106);
    c.lineTo(76, 96);
    c.fill();
    c.beginPath();
    c.moveTo(244, 122);
    c.lineTo(266, 132);
    c.lineTo(244, 142);
    c.lineTo(250, 132);
    c.fill();
    label('핍 슈트');
  } else if (key === 'ad_parm') {
    c.fillStyle = '#fff0a8';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#d9a440';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    c.lineTo(W, 72);
    c.quadraticCurveTo(180, 96, 0, 72);
    c.fill();
    c.fillStyle = '#e8743a';
    c.fillRect(0, 140, W, 60);
    for (let i = 0; i < 6; i++) {
      const x = 82 + i * 24 - (frame ? 5 : 0);
      c.fillStyle = i % 2 ? '#f2c94c' : '#ffd23e';
      c.beginPath();
      c.ellipse(x, 108 - i * 2, 31, 18, -0.08, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c9962e';
      c.beginPath();
      c.ellipse(x, 108 - i * 2, 21, 10, -0.08, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(236, 116 + (frame ? 2 : -1), 50, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.ellipse(236, 116 + (frame ? 2 : -1), 38, 17, 0, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 9; i++) dot(215 + i * 6, 110 + (i % 3) * 5 + (frame ? 1 : 0), 2.5, '#c9962e');
    c.fillStyle = '#16140f';
    c.font = '900 39px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('PARM', 28, 58 + (frame ? 1 : 0));
    c.font = '900 24px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('WHEEL', 44, 86 + (frame ? 1 : 0));
    c.font = '800 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('바퀴입니다', 188, 153);
    label('파름 휠', 142);
  }
  scan();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- channel content ----
const HOOT = '훗 맥래플린의 레이트 나이트', HOOT_V = 500;
const HOOT_BITS = [
  [{ speaker: HOOT, voice: HOOT_V, text: '좋은 저녁이에요. 아니면 아침. 시계와 저는 합의가 있어요: 시계는 말하지 않고, 나는 묻지 않기로.' },
   { speaker: HOOT, voice: HOOT_V, text: '오늘의 톱 뉴스: 아무 일도 없었습니다, 아름답게, 모든 섬에서. 후속 보도는 영원히 없습니다.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: '오늘의 게스트는 랜턴 룸에서 매일 저녁 연주해 왔죠 — 얼마나 됐죠?' },
   { speaker: 'Chip', voice: 760, text: '촛불 이전부터요. 저는 시간을 안 세요. 템포를 세죠. 다른 겁니다.' },
   { speaker: HOOT, voice: HOOT_V, text: '좋은 공연의 비결은요?' },
   { speaker: 'Chip', voice: 760, text: '방이 방인 걸 잊을 때까지 연주하는 겁니다. 그리고 한 곡 더.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: '화산을 섭외해 보려 했습니다. 400년째 노코멘트더군요. 그 절제력은 존중해야 합니다.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: '오늘 게스트가 취소됐습니다. 오늘 게스트는 바다입니다 — 훌륭한 청취자이자 최악의 게스트. 소파를 통째로 차지했습니다. 그리고 소파를 가져갔습니다.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: '오늘 방송은 여기까지. 우린 항상 바로 돌아옵니다. 구조적으로, 갈 곳이 없거든요. 굿나이트, 낫벨.' }],
];
const HOOT_NIGHT = [{ speaker: HOOT, voice: HOOT_V, text: '이 시간에 보고 계시군요. 저도요. 우린 그리 다르지 않아요 — 당신과, 화면 속 올빼미.' }];

const SCOOCH = '스쿠치의 날씨', SCOOCH_V = 360;
function scoochWeather() {
  const line = {
    clear: '오늘: 맑음. 화창. 구름 없음. *처참합니다.* 내일은 비를 예보합니다. 저는 항상 비를 예보해요. 언젠가 맞는 날이 제 인생 최고의 날이 될 거예요.',
    rain: '비. 비가 옵니다. 준비한 멘트가 있었는데 기쁨으로 잃었어요. 스튜디오로 — 저에게로 — 그냥 비를 맞고 서 있겠습니다.',
    snow: '오늘은 눈: 최선을 다한 비예요, 저는 자랑스럽습니다. 혀로 한 송이 받아 보세요. 인정됩니다. 이것만은 양보해 주세요.',
    fog: '안개. 하늘이 생각 중이에요. 가시거리는 낮고, 미스터리는 높고 — 그 안 어딘가에 비가 있어요, 느껴져요. 인정하건대 저는 항상 조금 축축해요.',
  }[currentWeather()] || '기상 상황: 불명. 제 마음처럼. 비를 원하는.';
  return [{ speaker: SCOOCH, voice: SCOOCH_V, text: line }];
}

const NEWT = '뉴트 벨로스의 낫벨 과학', NEWT_V = 580;
const SCIENCE_FACTS = [
  '매번 소름 돋는 사실: 부석 — 용암이 공중에서 식어 생기는 돌 — 은 거품이 가득해서 떠요. 바위가요! 지구에서 유일하게 뜨는 바위!',
  '화산이 폭발할 때 재가 부딪히며 정전기가 쌓여요 — 카펫에서 발을 질질 끄는 것과 같은 원리인데 하늘 크기로 — 그러면 진짜 번개가, 폭발 속에서!',
  '태양계에서 가장 높은 화산은 여기가 아니에요 — 화성의 올림푸스 몬스: 에베레스트 3개 높이지만 경사가 완만해서 오르는지도 모를 수 있어요!',
  '용암의 주황빛은 “가진” 색이 아니에요 — 온도가 눈에 보이는 거예요! 전구와 같은 물리예요. 약 1,200도가 정확히 저렇게 보여요.',
  '반전: 산호는 동물이에요 — 폴립 하나하나가 해파리의 작은 사촌, 1~2밀리미터. 수십억 마리가 궤도에서 보이는 암초를 만들어요!',
  '밤에 산호초에 자외선을 비추면 네온 도시처럼 빛나요 — 산호가 빛을 빨아들여 초록, 주황, 빨강으로 돌려줘요. 자외선 차단제 역할도 해요!',
  '모든 만타가오리는 배에 고유한 점무늬가 있어요 — 평생 지문처럼요! 과학자들은 사진을 찍어 이름 붙인 가오리 데이터베이스를 관리해요.',
  '상어는 뼈가 없어요 — 하나도요! 골격이 전부 연골이에요, 코와 귀처럼: 가볍고 잘 휘어요. 그래서 암초 상어가 재빠르게 돌 수 있어요.',
  '상어는 주둥이의 젤리 찬 구멍으로 심장박동의 희미한 전기 파장을 느껴요 — 10억 분의 1볼트까지요. 모래에 파묻힌 물고기도 눈감고 찾아요!',
  '반딧불이의 빛은 “냉광”: 에너지의 거의 전부가 빛이 되고 열로는 거의 안 새요. 전구는 90%를 열로 낭비해요. 반딧불이가 그냥 더 잘하는 거예요!',
  '잠자리는 쫓는 것의 최대 95%를 잡아요 — 측정된 최고의 공중 사냥꾼! 먹잇감이 있는 곳이 아니라 가고 있는 곳을 가로채요.',
  '어떤 매미는 정확히 13년 또는 17년을 지하에서 기다려요 — 둘 다 소수! 소수 주기는 포식자 주기와 거의 안 겹쳐요. 교활한 작은 수학자들.',
  '달을 걸었던 우주비행사들은 먼지가 화약 냄새라고 했어요 — 이유는 아직 완전히 몰라요. 달이 주머니에 작은 비밀을 숨겨 둔 거예요!',
  '달의 부츠 자국? 아직 그대로 — 바람도 비도 없어서 — 수백만 년은 갈 거예요. 피라미드보다 몇 배는 오래가는 발자국을 남길 수 있어요.',
  '달의 평균 거리 사이엔 나머지 일곱 행성을 줄 세울 수 있어요 — 아슬아슬하게 딱 맞아요. 우주는 널찍해요!',
  '달은 매년 약 3.8cm씩 멀어져요 — 손톱 자라는 속도예요. 우주비행사가 남긴 거울에 레이저를 쏴서 알아냈어요!',
];

const SEA_BITS = [
  '화면엔 바다가 나와요, 바다가 하는 일을 하며: 밀려오고, 빠지고, 밀려오고. 소리는 그냥… 바다. 어깨가 1인치 내려가요.',
  '파도. 파도. 갈매기. 파도. (이 프로그램은 무협찬입니다. 바다가 수익화를 거절했어요.)',
  '모든 화면이 같은 잔잔한 바다를 보여 줘요 — 하나만 빼고, 그건 창문이에요. 직원도, 창문도, 아무도 구분 못 해요.',
];

const TV_ADS = [
  { key: 'ad_hotdog',
    text: '불코: 1.5버튼 핫도그. 2개 내고 반 개 돌려받으세요. 우리도 모릅니다. 당신도 모릅니다. 걱정하지 마세요.' },
  { key: 'ad_lantern',
    text: '랜턴 룸 — 랜턴 로스트, 디카페인 아님, 그리고 칩이 촛불 꺼질 때까지 연주합니다. 루나에게 TV가 보냈다고 하세요. (루나는 혼란스러워할 겁니다.)' },
  { key: 'ad_scuba',
    text: '젖은 발? 시린 발? 핍에게 스쿠버 슈트가 있습니다: 진짜 친구처럼 팔 수 없는 물건. 가서 — 물고기들이 수다 떠는 곳에서 헤엄쳐 보세요.' },
  { key: 'ad_parm',
    text: '불코 멤버 여러분: 파름 휠. 바퀴입니다. 파름의. 오늘 하나 굴려 가세요. (바나비는 파름의 사촌에게 추가금을 냅니다. 묻지 마세요.)' },
];

// A slow ambient stroll for folks who work one spot: over to one side of
// their post and back, pausing a while at each end (x-axis span, from home).
function pace(g, dt, t, span, speed) {
  const u = g.userData.pace ??= { home: g.position.clone(), to: 1, pause: 3 + Math.random() * 4, face: g.rotation.y };
  if (u.pause > 0) {
    u.pause -= dt;
    animateGait(g, t, 0);
    g.rotation.y = turnToward(g.rotation.y, u.face, dt, 2);
    return;
  }
  const gx = u.home.x + (u.to > 0 ? span : 0);
  const d = gx - g.position.x;
  if (Math.abs(d) < 0.03) {
    u.to = -u.to;
    u.pause = 4 + Math.random() * 6;
    return;
  }
  g.position.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  g.rotation.y = turnToward(g.rotation.y, Math.sign(d) * Math.PI / 2, dt, 3);
  animateGait(g, t, 1, 8);
}

export function createBulko(player) {
  const group = new THREE.Group();
  const updates = [];
  const C = ISLAND4;
  const cy = terrainHeight(C.x, C.z);

  // ------------------------------------------------------ the warehouse ----
  const wx = C.x, wz = C.z - 7;
  {
    const ext = new THREE.Group();
    // the slab: big boxes get poured foundations, even legally distinct ones (B18)
    const slab = box(20.4, 1.4, 10.4, 0x7d8288);
    slab.position.y = -0.5;
    ext.add(slab);
    const hull = box(20, 7, 10, 0x9aa0a6);
    hull.position.y = 3.5;
    ext.add(hull);
    const trim = box(20.2, 1.0, 10.2, 0x6e7479);
    trim.position.y = 6.6;
    ext.add(trim);
    // the sign: red, enormous, certain of itself
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
      textPanel([['BULKO', 64, 96]], 512, 128, '#c2452c', '#fffaf0'));
    sign.position.set(0, 5.6, 5.11);
    ext.add(sign);
    const doors = box(4.2, 3.2, 0.3, 0x3a4a5c);
    doors.position.set(-3, 1.6, 5.05);
    ext.add(doors);
    const doorSplit = box(0.12, 3.2, 0.34, 0x9aa0a6);
    doorSplit.position.set(-3, 1.6, 5.06);
    ext.add(doorSplit);
    // the staff entrance, on the dock side — which is the side everyone
    // actually arrives from, so it gets a sign too
    const backDoors = box(3.6, 3.0, 0.3, 0x3a4a5c);
    backDoors.position.set(2, 1.5, -5.05);
    ext.add(backDoors);
    const backSign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.35),
      textPanel([['불코  ·  직원 출입구', 64, 38]], 640, 128, '#c2452c', '#fffaf0'));
    backSign.position.set(0, 5.2, -5.11);
    backSign.rotation.y = Math.PI;
    ext.add(backSign);
    ext.position.set(wx, cy, wz);
    ext.traverse((o) => { if (o.isMesh && !o.material.map) o.castShadow = true; });
    group.add(ext);
    zones.addBlockerBox(wx, wz, 20, 10, 0, 0.05); // the warehouse, exactly
    register({
      pos: new THREE.Vector3(wx + 2, 0, wz - 5.8), r: 2.8,
      label: '불코 들어가기 (직원 출입구)',
      use: async () => {
        await zones.go('bulko');
        if (!S.hasFlag('staffDoor')) {
          S.setFlag('staffDoor');
          ui.say('직원용 문의 손글씨 쪽지: "다들 이 문을 씀. 정문은 차들의 것."');
        }
      },
    });
  }

  // ----------------------------------------------------- the parking lot ----
  // Stall lines, carts, and cars. There are no roads on any island.
  const lotZ = C.z + 4;
  for (let i = 0; i < 8; i++) {
    const lx = C.x - 10.5 + i * 3;
    const line = box(0.18, 0.05, 4.4, 0xe8e4d8);
    line.position.set(lx, terrainHeight(lx, lotZ) + 0.06, lotZ);
    group.add(line);
  }
  const carColors = [0xb0453a, 0x5b8bc9, 0xd9c08f, 0x4f8f6a, 0x6e5a8a];
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // one empty stall, for mystery
    const carX = C.x - 9 + i * 3;
    const carY = terrainHeight(carX, lotZ);
    const car = new THREE.Group();
    const body = box(2.0, 0.7, 3.4, carColors[i]);
    body.position.y = 0.65;
    car.add(body);
    const cab = box(1.7, 0.6, 1.7, carColors[i]);
    cab.position.set(0, 1.25, -0.2);
    car.add(cab);
    const glass = box(1.72, 0.4, 1.0, 0xbfe6f2);
    glass.position.set(0, 1.3, 0.4);
    car.add(glass);
    for (const [sx, sz] of [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8), mat(0x2e2a26));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 1.05, 0.32, sz);
      car.add(wheel);
    }
    car.position.set(carX, carY, lotZ);
    car.rotation.y = rand(-0.06, 0.06);
    car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(car);
    zones.addBlocker(carX, lotZ, 1.9);
  }
  register({
    pos: new THREE.Vector3(C.x - 3, 0, lotZ + 3), r: 3,
    label: '차들에 대해 궁금해하기',
    use: () => ui.say([
      '이 섬엔 도로가 없어요. 어떤 섬에도 도로가 없어요. 도로는 한 번도 없었어요.',
      '차들은 어쨌든 여기 있어요, 가지런히 주차되어, 살짝 따뜻하게, 방금 운전한 듯이.',
      '주차장 가장자리 작은 표지: “걱정하지 마세요.”',
    ]),
  });
  // a stray shopping cart, wheels akimbo
  const cart = new THREE.Group();
  const basket = box(0.9, 0.6, 1.2, 0xb8beba);
  basket.position.y = 0.85;
  cart.add(basket);
  for (const [sx, sz] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.5], [0.35, -0.5]]) {
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), mat(0x55504c));
    cw.rotation.z = Math.PI / 2;
    cw.position.set(sx, 0.1, sz);
    cart.add(cw);
  }
  for (const [sx, sz] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.5], [0.35, -0.5]]) {
    const leg = box(0.05, 0.5, 0.05, 0x9aa0a6); // (the basket used to float over its wheels)
    leg.position.set(sx, 0.35, sz);
    cart.add(leg);
  }
  cart.position.set(C.x + 7, terrainHeight(C.x + 7, C.z + 7), C.z + 7);
  cart.rotation.y = 2.2; // abandoned mid-thought
  group.add(cart);
  zones.addBlockerBox(C.x + 7, C.z + 7, 0.9, 1.2, 2.2, 0, 'tree'); // solid to walkers, invisible to the planners

  // ---------------------------------------------------------- ferry dock ----
  // every other pier points home — but home is BEHIND the warehouse here, and
  // ferry passengers deserve to step off on the door side, not orienteer the
  // long way around a big box. the pier points west; the entrance agrees.
  const dockA = -Math.PI / 2;
  const dox = Math.sin(dockA), doz = Math.cos(dockA);
  let shoreT = C.r - 6;
  while (terrainHeight(C.x + dox * (shoreT + 0.5), C.z + doz * (shoreT + 0.5)) >= 0.15) shoreT += 0.5;
  const dock = { x: C.x + dox * shoreT, z: C.z + doz * shoreT };
  for (let i = 0; i < 7; i++) {
    const plank = box(2.4, 0.18, 1.0, i % 4 === 2 ? 0x96703f : 0xa97c50);
    plank.position.set(dock.x + dox * (i + 0.5), 0.55, dock.z + doz * (i + 0.5));
    plank.rotation.y = dockA;
    group.add(plank);
    if (i % 2 === 0 || i === 6) {
      // legs down to the sand under the planks — and at the end, two tall
      // front posts
      const front = i === 6;
      for (const side of [-1, 1]) {
        const t = i + (front ? 0.85 : 0.5);
        const lx = dock.x + dox * t - doz * side * 1.1, lz = dock.z + doz * t + dox * side * 1.1;
        const bot = Math.min(terrainHeight(lx, lz), WATER_Y) - 0.3, top = front ? 1.55 : 0.5;
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, top - bot, 6), mat(0x6b4a2e));
        pile.position.set(lx, (top + bot) / 2, lz);
        pile.castShadow = front;
        if (front) {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 6), mat(0x4f3622));
          cap.position.y = (top - bot) / 2 + 0.02;
          pile.add(cap);
        }
        group.add(pile);
      }
    }
  }
  zones.addCrossing({
    contains(x, z) {
      const dx = x - dock.x, dz = z - dock.z;
      const t = dx * dox + dz * doz;
      if (t < -0.5 || t > 7.5) return false;
      return Math.abs(dx * -doz + dz * dox) < 1.25;
    },
    height: () => 0.64,
  });
  const buoy = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
  bb.position.y = 0.5;
  buoy.add(bb);
  const bt = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
  bt.position.y = 1.2;
  buoy.add(bt);
  buoy.position.set(dock.x - dox * 2, terrainHeight(dock.x - dox * 2, dock.z - doz * 2), dock.z - doz * 2);
  buoy.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(buoy);
  zones.addBlocker(buoy.position.x, buoy.position.z, 0.55);
  // (boats.js wires the ferry stops — this buoy is just the landmark)
  BULKO_DOCK.x = dock.x - dox * 0.8; // (landing clear of the buoy's footing — it used to set you down inside it)
  BULKO_DOCK.z = dock.z - doz * 0.8;
  BULKO_DOCK.rotY = dockA + Math.PI;
  BULKO_DOCK.buoyPos = buoy.position;

  // ------------------------------------------------------- the billboard ----
  // on Notbell's south shore, where it can work on everyone's subconscious
  {
    let bz = 20;
    while (terrainHeight(6, bz + 0.6) >= 0.4) bz += 0.6;
    const by = terrainHeight(6, bz - 1.5);
    const bill = new THREE.Group();
    for (const sx of [-2.6, 2.6]) {
      const post = box(0.22, 4.4, 0.22, 0x6b4a2e);
      post.position.set(sx, 2.2, 0);
      bill.add(post);
    }
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7, 3),
      textPanel([
        ['BULKO', 56, 72],
        ['핫도그 + 탄산: 여전히 1.5버튼', 122, 30],
        ['매일 페리 · 바닷가재는 매물 아님', 160, 22],
      ], 512, 192, '#c2452c', '#fffaf0'));
    panel.position.set(0, 4.0, 0.13);
    bill.add(panel);
    const backing = box(7.2, 3.2, 0.15, 0x8a5a3a);
    backing.position.set(0, 4.0, 0);
    bill.add(backing);
    bill.position.set(6, by, bz - 1.5);
    bill.rotation.y = Math.PI; // faces inland, into hearts and minds
    bill.traverse((o) => { if (o.isMesh && !o.material.map) o.castShadow = true; });
    group.add(bill);
    zones.addBlocker(6, bz - 1.5, 1.2);
    register({
      pos: new THREE.Vector3(6, 0, bz - 0.2), r: 2.6,
      label: '광고판 읽기',
      use: () => ui.say([
        '“불코. 핫도그 + 탄산: 여전히 1.5버튼. 매일 페리.”',
        '구석에 작게: “광고판 판매: P. 까치 및 동업자들. P. 까치 및 동업자들은 까치 한 마리입니다.”',
      ]),
    });
  }

  // -------------------------------------------------------- the interior ----
  const B = IN;
  {
    const roomStart = group.children.length;
    let milkroomRoot = null;
    const floor = box(34, 0.4, 22, 0x8a8f95); // honest concrete
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    // fluorescent honesty, made visible: a row of tubes over the aisles
    for (const tx of [-9, 0, 9]) {
      const tube = makeCeilingTube(4.2);
      tube.position.set(B.x + tx, 4.6, B.z - 1);
      group.add(tube);
    }
    for (const [w, d, x, z] of [
      [34, 0.4, B.x, B.z - 11], [0.4, 22, B.x - 17, B.z], [0.4, 22, B.x + 17, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), mat(0xa8adb3));
      wall.position.set(x, 4, z);
      group.add(wall);
    }
    // fluorescent bars, hovering in the dollhouse way
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
      bar.position.set(B.x - 9 + i * 6, 7.5, B.z - 4);
      group.add(bar);
    }

    // steel racking with bulk mystery pallets
    for (const rackX of [-12, -4, 4, 12]) {
      for (let level = 0; level < 3; level++) {
        const shelf = box(6.5, 0.2, 2.2, 0xd9a440);
        shelf.position.set(B.x + rackX, 1 + level * 1.8, B.z - 7);
        group.add(shelf);
        for (let pIdx = 0; pIdx < 3; pIdx++) {
          const pallet = box(1.7, 1.2, 1.7, pick([0xb8beba, 0xc9b178, 0x8a9aa8, 0xb0a8c9]));
          pallet.position.set(B.x + rackX - 2.2 + pIdx * 2.2, 1.8 + level * 1.8, B.z - 7);
          group.add(pallet);
        }
      }
      const upright = box(0.25, 6, 2.4, 0xe8743a);
      upright.position.set(B.x + rackX - 3.4, 3, B.z - 7);
      const upright2 = box(0.25, 6, 2.4, 0xe8743a);
      upright2.position.set(B.x + rackX + 3.4, 3, B.z - 7);
      group.add(upright, upright2);
    }

    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 4.6), r: 5, zone: 'bulko',
      label: '대용량 선반 구경하기',
      use: () => ui.say(pick([
        '5갤런 상온보관 마카로니 앤 치즈 통. 뚜껑엔 “패밀리 사이즈.” 가족이 얼마나 큰지, 먹는 건지 거주하는 건지 명시되지 않았어요. 모호함을 존중해요.',
        '키친타월 144롤, 냉장고 크기의 단일 큐브로 수축 포장. 들 수 없어요. 아무도 못 들 것 같아요. 하중을 받치고 있을지도요.',
        '두 팔과 계획이 필요한 피클 병. 48개. 소금물만으로 작은 배를 다시 띄울 수 있어요. 잠시 브라인 선장이 떠올라요. 그에게는 말하지 않기로 해요.',
        '콩 통조림 60캔 한 판. 콩만. 라벨은 콩 사진. 어딘가에 이것에 환희하는 사람이 있어요. 진심으로 만나 보고 싶어요.',
        '“혼합 낙관주의 (젤리)”라 적힌 2킬로그램 통. 유통기한: 아직 발명되지 않은 날짜. 내용량: 당신이 직접 느껴 본 것 이상.',
        '선반이 안개 속까지 올라가요. 맨 꼭대기에 있는 것은 종이 가라앉기 전부터 거기 있었고, 괜찮아요. 다 괜찮아요. 불코니까요.',
      ])),
    });

    // the parmesan: wheels of it, stacked like the treasure it is
    for (let i = 0; i < 6; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12), mat(0xe8c95c, 0.6));
      wheel.position.set(B.x - 9 + (i % 2) * 2.1, 0.45 + Math.floor(i / 2) * 0.55, B.z + 3.3);
      wheel.castShadow = true;
      group.add(wheel);
    }
    register({
      pos: new THREE.Vector3(B.x - 8, 0, B.z + 4.9), r: 2.6, zone: 'bulko',
      label: '파르미지아노 휠 생각해 보기',
      use: async () => {
        const choice = await ui.ask('파르미지아노 휠들, 어깨 높이까지 쌓였어요. 하나하나가 잘먹은 개만 해요.', [
          { label: '🧀 휠 하나 사기', value: 'buy', hint: '300🔘', disabled: S.state.buttons < 300 },
          { label: '여기서 존경하기', value: null },
        ]);
        if (choice === 'buy') {
          S.spend(300);
          S.addItem('parm_wheel');
          kaching();
          ui.updateHUD();
          ui.toast('<b>대용량 파르미지아노 휠</b>을 샀어요. <i>주머니에 안 들어가요. 이제 그냥 갖고 있는 거예요.</i>', '🧀');
        }
      },
    });

    // ------------------------------------------------ the milk cooler entrance ----
    // A WIDE Costco-style cold-room entrance: steel frame, strip curtains, a dark
    // cold beyond. Set into the WEST wall, directly across the floor from the
    // lobster tank (now on the east). E enters the 'milkroom' zone (big dairy hall).
    {
      const dx = B.x - 17, dz = B.z + 3, hw = 3.6; // west wall, toward the south end
      const beyond = box(0.1, 3.4, hw * 2, 0x162430); // the cold dark through the strips
      beyond.position.set(dx + 0.05, 1.9, dz);
      group.add(beyond);
      const lintel = box(0.6, 0.6, hw * 2 + 0.9, 0x8d949c);
      lintel.position.set(dx, 3.7, dz);
      group.add(lintel);
      for (const s of [-1, 1]) {
        const post = box(0.6, 3.7, 0.6, 0x8d949c);
        post.position.set(dx, 1.85, dz + s * (hw + 0.35));
        group.add(post);
      }
      // strip curtains, the kind you nose through with a cart — hung from
      // the top (pivot at the lintel) so they sway in the cold draft
      const strips = [];
      const stripGeo = new THREE.BoxGeometry(0.06, 3.1, 0.5);
      stripGeo.translate(0, -1.55, 0);
      for (let i = 0; i <= 10; i++) {
        const strip = new THREE.Mesh(stripGeo,
          new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.34, roughness: 0.1, flatShading: true }));
        strip.position.set(dx + 0.3, 3.25, dz - hw + 0.35 + i * ((hw * 2 - 0.7) / 10));
        group.add(strip);
        strips.push(strip);
      }
      // wisps of cold rolling out along the floor, curling and thinning
      const wisps = [];
      for (let i = 0; i < 9; i++) {
        const w = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1),
          new THREE.MeshBasicMaterial({ color: 0xdff2f8, transparent: true, opacity: 0, depthWrite: false }));
        w.scale.set(1.4, 0.35, 1.1);
        w.userData = { k: i / 9, z: dz - hw + 0.6 + ((i * 5) % 9) / 8 * (hw * 2 - 1.2) };
        group.add(w);
        wisps.push(w);
      }
      // cold breath spilling into the aisle — and it BREATHES: the cooler
      // exhales, reconsiders, exhales again. tide mechanics, dairy scale.
      const leak = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, hw * 2),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.12, depthWrite: false }));
      leak.position.set(dx + 1.1, 0.3, dz);
      group.add(leak);
      updates.push((dt, t) => {
        if (zones.current() !== 'bulko') return;
        leak.material.opacity = 0.07 + Math.sin(t * 0.55) * 0.04;
        leak.position.x = dx + 1.1 + (Math.sin(t * 0.3) + 1) * 0.22;
        strips.forEach((st, i) => {
          st.rotation.z = Math.sin(t * 0.9 + i * 0.7) * 0.05 + Math.sin(t * 2.3 + i) * 0.015;
          st.rotation.x = Math.sin(t * 0.7 + i * 1.3) * 0.03;
        });
        for (const w of wisps) {
          const k = (w.userData.k + t * 0.07) % 1;
          w.position.set(dx + 0.6 + k * 3.2, 0.18 + k * 0.15, w.userData.z + Math.sin(t * 0.6 + w.userData.k * 7) * 0.3);
          w.scale.set(1.2 + k * 1.2, 0.3 + k * 0.1, 1 + k * 0.8);
          w.material.opacity = 0.22 * Math.sin(k * Math.PI);
        }
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0),
        textPanel([['❄  우유 냉장고  ❄', 64, 40]], 768, 128, '#2f5a6e', '#eaf6fb'));
      sign.position.set(dx + 0.35, 4.5, dz);
      sign.rotation.y = Math.PI / 2; // faces east, into the store
      group.add(sign);
      register({
        pos: new THREE.Vector3(dx + 2.5, 0, dz), r: 3, zone: 'bulko',
        label: '우유 냉장고 들어가기',
        use: async () => {
          await zones.go('milkroom');
          if (!S.hasFlag('sawMilkroom')) {
            S.setFlag('sawMilkroom');
            ui.say('띠 커튼이 차가운 한숨과 함께 갈라져요. 그 너머: 작은 기상계만 한 유제품 홀, 그리고 분명 당신 얘기를 하던 소 세 마리.');
          }
        },
      });
    }

    // ====================== the milk cooler — a huge, roofless dairy hall ----
    {
      const milkroomStart = group.children.length;
      const MC = { x: 440, z: 1220 }; // far east of BULKO, beyond its fog
      const cfloor = box(22, 0.4, 16, 0xdfeaf0);
      cfloor.position.set(MC.x, -0.2, MC.z);
      cfloor.receiveShadow = true;
      group.add(cfloor);
      for (const [w, d, x, z] of [
        [22, 0.4, MC.x, MC.z - 8], [0.4, 16, MC.x - 11, MC.z], [0.4, 16, MC.x + 11, MC.z],
      ]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.5, d), mat(0xbcd0d8));
        wall.position.set(x, 2.75, z);
        group.add(wall);
      }
      // no roof — the fixed camera looks straight in, dollhouse-style
      // cold air, pooled and blue
      const chill = new THREE.Mesh(new THREE.BoxGeometry(21.6, 5, 15.6),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.09, depthWrite: false }));
      chill.position.set(MC.x, 2.5, MC.z);
      group.add(chill);
      const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.9),
        textPanel([['❄  차갑고 신선한 음메 주스  ❄', 50, 44]], 768, 100, '#2f5a6e', '#eaf6fb'));
      bigSign.position.set(MC.x, 5.0, MC.z - 7.78); // up over the shelf headers
      group.add(bigSign);
      // the cold wall (north): real steel shelving now, in sections — milk,
      // eggs, yogurt, butter, cheese — each with its little header card. (The
      // cartons used to hang in rows in midair, no shelf under any of them.)
      const tops = [0x6b4a2e, 0xe89ab0, 0xd9c08f, 0x5b8bc9];
      // a milk carton wears a RIDGE, not a peak — a little gable prism, seated
      // flush on the box (build the 3-cylinder with thetaStart π/2 BEFORE
      // rotateZ, or the ridge skews — see VISUAL_CANON)
      const gableGeo = (len, r) => {
        const g = new THREE.CylinderGeometry(r, r, len, 3, 1, false, Math.PI / 2);
        g.rotateZ(Math.PI / 2); // ridge runs along x
        return g;
      };
      const WZ = MC.z - 7.1;
      const SHELF_Y = [0.35, 1.3, 2.25, 3.2];
      const steel = 0x9aa8b0;
      const shelfBack = box(19, 4.0, 0.12, 0x8da0aa);
      shelfBack.position.set(MC.x, 2.0, WZ - 0.55);
      group.add(shelfBack);
      for (const y of SHELF_Y) {
        const sh = box(19, 0.08, 1.1, steel);
        sh.position.set(MC.x, y, WZ);
        group.add(sh);
      }
      for (const x of [-9.5, -5.7, -1.9, 1.9, 5.7, 9.5]) {
        const up = box(0.12, 4.0, 1.1, 0x7a8a94);
        up.position.set(MC.x + x, 2.0, WZ);
        group.add(up);
      }
      const onShelves = (x0, x1, fn) => {
        for (const y of SHELF_Y) for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.75) fn(MC.x + x, y + 0.04);
      };
      const header = (text, x) => {
        const h = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.45),
          textPanel([[text, 33, 34]], 384, 66, '#eaf6fb', '#2f5a6e')); // (centered: it was drawn at y 64 of 66, half cut off)
        h.position.set(MC.x + x, 4.35, WZ + 0.1);
        group.add(h);
      };
      // milk: cartons with a colored label band and a proper ridge cap
      header('우유', -7.6);
      onShelves(-9.5, -5.7, (x, y) => {
        const k = Math.floor((x * 7 + y * 3) % 4 + 4) % 4;
        const carton = box(0.5, 0.62, 0.5, 0xfbf7ef);
        carton.position.set(x, y + 0.31, WZ + 0.1);
        const band = box(0.52, 0.18, 0.52, tops[k]);
        band.position.set(x, y + 0.36, WZ + 0.1);
        const top = new THREE.Mesh(gableGeo(0.46, 0.17), mat(tops[k], 0.7));
        top.position.set(x, y + 0.62 + 0.085, WZ + 0.1);
        group.add(carton, band, top);
      });
      // eggs: gray cardboard cartons, lids up, the eggs peeking out
      header('달걀', -3.8);
      const eggMat = mat(0xf6efe0, 0.6), brownEgg = mat(0xd9a878, 0.6);
      onShelves(-5.7, -1.9, (x, y) => {
        const tray = box(0.62, 0.18, 0.34, 0xb8b0a0);
        tray.position.set(x, y + 0.09, WZ + 0.15);
        group.add(tray);
        for (let e = 0; e < 3; e++) {
          const egg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), (e + Math.round(x * 3)) % 5 ? eggMat : brownEgg);
          egg.scale.y = 1.25;
          egg.position.set(x - 0.18 + e * 0.18, y + 0.24, WZ + 0.15);
          group.add(egg);
        }
        const lid = box(0.62, 0.2, 0.04, 0xb8b0a0);
        lid.position.set(x, y + 0.28, WZ - 0.04);
        lid.rotation.x = -0.4;
        group.add(lid);
      });
      // yogurt: little cups with foil lids in every flavor
      header('요거트', 0);
      const flav = [0xf2a0a8, 0xf2cf5b, 0x9ac4e8, 0xb8e0a0, 0xfbf7ef];
      onShelves(-1.9, 1.9, (x, y) => {
        for (const dx of [-0.17, 0.17]) {
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 8), mat(0xfbf7ef, 0.5));
          cup.position.set(x + dx, y + 0.13, WZ + 0.1);
          const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.02, 8), mat(flav[Math.floor(Math.abs(x * 5 + dx * 9 + y)) % 5], 0.3));
          foil.position.set(x + dx, y + 0.27, WZ + 0.1);
          group.add(cup, foil);
        }
      });
      // butter: wrapped bricks, stacked like gold
      header('버터', 3.8);
      onShelves(1.9, 5.7, (x, y) => {
        for (const st of [0, 1]) {
          const brick = box(0.5, 0.16, 0.26, st ? 0xf3e6a8 : 0xfbf1c8);
          brick.position.set(x, y + 0.08 + st * 0.17, WZ + 0.1);
          group.add(brick);
        }
      });
      // cheese: waxed wheels, and a wedge or two showing its holes
      header('치즈', 7.6);
      onShelves(5.7, 9.5, (x, y) => {
        if (Math.round(x * 4 + y) % 3) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.22, 10), mat(Math.round(x * 3) % 2 ? 0xd84f4f : 0xe8c547, 0.5));
          wheel.position.set(x, y + 0.11, WZ + 0.1);
          group.add(wheel);
        } else {
          const wedge = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.24, 3, 1, false, 0, Math.PI / 2.2), mat(0xf2cf5b, 0.6));
          wedge.position.set(x, y + 0.12, WZ + 0.1);
          group.add(wedge);
        }
      });
      // the islands (the Costco aisle): gallon jugs on one, egg flats and
      // yogurt multipacks on the other
      const dairyCase = (cx, cz, fill) => {
        const base = box(5.2, 1.0, 2.6, 0xaebfc8);
        base.position.set(cx, 0.5, cz);
        group.add(base);
        const rim = box(5.4, 0.18, 2.8, 0x8da0aa);
        rim.position.set(cx, 1.05, cz);
        group.add(rim);
        for (let i = 0; i < 14; i++) fill(cx - 2.1 + (i % 7) * 0.7, cz - 0.55 + Math.floor(i / 7) * 1.05, i);
      };
      dairyCase(MC.x - 5, MC.z - 2, (x, z, i) => {
        const jug = box(0.46, 0.66, 0.46, 0xfbf7ef);
        jug.position.set(x, 1.47, z);
        const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 0.16, 6), mat(0xfbf7ef, 0.6));
        shoulder.position.set(x, 1.88, z);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8), mat(tops[i % 4], 0.5));
        cap.position.set(x, 2.0, z);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 4, 8), mat(0xfbf7ef, 0.6));
        handle.position.set(x + 0.2, 1.7, z);
        handle.rotation.y = Math.PI / 2;
        group.add(jug, shoulder, cap, handle);
      });
      dairyCase(MC.x + 5, MC.z - 2, (x, z, i) => {
        if (i % 2) {
          const flat = box(0.6, 0.12, 0.6, 0xb8b0a0);
          flat.position.set(x, 1.2, z);
          group.add(flat);
          for (let e = 0; e < 4; e++) {
            const egg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), e === 2 ? brownEgg : eggMat);
            egg.scale.y = 1.25;
            egg.position.set(x - 0.14 + (e % 2) * 0.28, 1.34, z - 0.14 + Math.floor(e / 2) * 0.28);
            group.add(egg);
          }
        } else {
          for (let c = 0; c < 4; c++) {
            const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.24, 8), mat(0xfbf7ef, 0.5));
            cup.position.set(x - 0.15 + (c % 2) * 0.3, 1.26, z - 0.15 + Math.floor(c / 2) * 0.3);
            const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.02, 8), mat(flav[(i + c) % 5], 0.3));
            foil.position.set(cup.position.x, 1.39, cup.position.z);
            group.add(cup, foil);
          }
        }
      });

      // and yes, you can buy the milk. it's a store. mostly.
      const DAIRY = [
        { id: 'milk_plain', price: 6, at: 'jugs' },
        { id: 'milk_choco', price: 8, at: 'jugs' },
        { id: 'milk_straw', price: 8, at: 'jugs' },
        { id: 'milk_oat', price: 9, at: 'jugs' },
        { id: 'eggs', price: 7, at: 'eggs' },
        { id: 'yogurt', price: 4, at: 'eggs' },
        { id: 'butter', price: 6, at: 'wall' },
        { id: 'cheese_wheel', price: 14, at: 'wall' },
      ];
      const buyFrom = async (where, text) => {
        const list = DAIRY.filter((d) => where === 'wall' || d.at === where);
        const picked = await ui.ask(text, [
          ...list.map((d) => ({
            label: `${ITEMS[d.id].emoji} ${ITEMS[d.id].name}`, value: d.id, hint: `${d.price}🔘`,
            disabled: S.state.buttons < d.price,
          })),
          { label: '시원하게 있기', value: null },
        ]);
        const d = DAIRY.find((x) => x.id === picked);
        if (!d) return;
        S.spend(d.price);
        S.addItem(d.id);
        kaching();
        ui.updateHUD();
        ui.toast(`<b>${ITEMS[d.id].name}</b>을(를) 샀어요. 냉기가 따라오고 싶다는 듯 달라붙어요.`, ITEMS[d.id].emoji);
      };
      register({
        pos: new THREE.Vector3(MC.x - 5, 0, MC.z - 2), r: 2.8, zone: 'milkroom',
        label: '우유 주전자 구경하기',
        use: () => buyFrom('jugs', '갤런 주전자들이 맛별로 뚜껑을 쓰고 대열로 서 있어요. 케이스가 차가운 한 음을 콧노래로 불러요.'),
      });
      register({
        pos: new THREE.Vector3(MC.x + 5, 0, MC.z - 2), r: 2.8, zone: 'milkroom',
        label: '달걀과 요거트 구경하기',
        use: () => buyFrom('eggs', '달걀판과 4개입 요거트. 달걀 하나가 갈색이에요. 본인도 알아요.'),
      });
      register({
        pos: new THREE.Vector3(MC.x, 0, MC.z - 5.8), r: 3.2, zone: 'milkroom',
        label: '냉장 벽 구경하기',
        use: () => buyFrom('wall', '우유, 달걀, 요거트, 버터, 치즈 — 선반 가득, 냉기 속까지.'),
      });

      // the cows, spread across the hall
      const makeCow = (body, x, z, ry) => {
        const c = buildAnimal('cow', { body, head: body });
        c.scale.setScalar(0.95);
        c.position.set(x, 0, z);
        c.rotation.y = ry;
        c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        group.add(c);
        return c;
      };
      const cocoa = makeCow(0x6b4a2e, MC.x - 7, MC.z + 2.6, 0.4);
      const sundae = makeCow(0xe6a6bc, MC.x + 7, MC.z + 2.6, -0.4);
      // Barley holds the oat end of the west case — off the center line, the
      // way he'd stand at a party. near the exit, in case the party is too much
      const barley = makeCow(0xece3d0, MC.x - 6.3, MC.z - 0.5, 0.35);
      { // Barley's beret, naturally
        const beret = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.12, 10), mat(0x2f3a4a, 0.6));
        beret.add(disc);
        const nub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0x2f3a4a, 0.6));
        nub.position.y = 0.11;
        beret.add(nub);
        beret.position.set(0.05, 1.66, 0.5);
        beret.rotation.z = 0.25;
        barley.add(beret);
      }
      updates.push((dt, t, playerPos) => {
        if (zones.current() !== 'milkroom') return;
        [cocoa, sundae, barley].forEach((c, i) => {
          const p = c.userData.parts;
          if (p?.body) p.body.position.y = p.bodyY + Math.sin(t * 1.1 + i * 1.7) * 0.018;
          if (p?.head) p.head.position.y = p.headY + Math.sin(t * 1.1 + i * 1.7 + 0.6) * 0.02;
          if (p?.head) p.head.rotation.x = Math.max(0, Math.sin(t * 2.2 + i)) * 0.12; // chewing, thoughtfully
          const near = playerPos && Math.hypot(playerPos.x - c.position.x, playerPos.z - c.position.z) < 5;
          if (near) { // turn to face a customer, like any good staff
            animateGait(c, t, 0);
            c.rotation.y = turnToward(c.rotation.y, Math.atan2(playerPos.x - c.position.x, playerPos.z - c.position.z), dt, 2.5);
          } else {
            pace(c, dt, t, 1.6, 0.5);
          }
        });
      });

      const COW_LINES = {
        Cocoa: [
          '“초코 우유가 디저트라는 이들도 있죠. 저는 부을 수 있는 포옹이라고 해요.”',
          '“차갑게 유지해요. 냉기가 정직하게 지켜 줘요.”',
          '“보리는 오트가 미래래요. 저는 과거가 더 맛있었다고 해요. 논쟁하진 않아요. 우린 소니까요.”',
        ],
        Sundae: [
          '“분홍은 상당한 압박이에요. 잘 소화하고 있다고 생각해요.”',
          '“여름엔 다들 딸기를 찾아요. 겨울엔 드디어 생각할 수 있어요.”',
          '“코코아는 진하고, 보리는 복잡해요. 저는 그냥 달콤해요. 누군가는 그래야죠.”',
        ],
        Barley: [
          '“베레모가 성격과 함께 왔어요. 아니면 성격이 베레모와 함께. 순서는 불명확하고, 솔직히 우리 격에 안 맞는 질문이에요.”',
          '“오트: 평범한 냉기가 살짝 주류라고 느끼는 분들을 위해.”',
          '“정확히는 생산하지 않아요. 큐레이션해요.”',
        ],
      };
      const COW_MEET = {
        Cocoa: ['커다란 갈색 소가 크고 온화한 평온으로 당신을 봐요.',
          '“초코 우유는 맛이 아니에요. 감정이에요. 여덟 살이고, 여름이고, 마감이 없는 그 감정.”'],
        Sundae: ['분홍 소가 느리고 몽롱하게 눈을 깜빡여요.',
          '“저는 딸기예요. 규칙은 제가 안 만들어요. 딸기도 겨우 만들어요.”'],
        Barley: ['작은 베레모를 쓴 크림색 소가 모자 너머로 당신을 살펴요.',
          '“제 건 오트예요. 우유가 아니라 — 음료예요. 차이가 있어요. 설명은 안 할래요.”',
          '“저는 수조에 바닷가재가 들어오기 전부터 식물성이었어요.”'],
      };
      const cowReg = (cow, name, voice) => register({
        getPos: () => cow.position, r: 2.6, zone: 'milkroom', label: `${name}와(과) 대화하기`,
        use: () => {
          const flag = `met${name}`;
          if (!S.hasFlag(flag)) { S.setFlag(flag); ui.say(COW_MEET[name], { speaker: name, voice }); return; }
          ui.say(pick(COW_LINES[name]), { speaker: name, voice });
        },
      });
      cowReg(cocoa, '코코아', 250);
      cowReg(sundae, '선데', 300);
      cowReg(barley, '보리', 270);

      register({
        pos: new THREE.Vector3(MC.x, 0, MC.z - 5.5), r: 2.4, zone: 'milkroom',
        label: '우유 벽 구경하기',
        use: () => ui.say(pick([
          '천장까지 카톤, 박공 모양 뚜껑, 냉기 방울이 맺혔어요. 위에서 아래로: 초코, 딸기, 오트, 그리고 그냥 “?”라 적힌 하나.',
          '작은 표지: “카톤 하나 가져가세요. 카톤 하나 두고 가세요. 냉장고는 영원합니다.” 아무것도 안 가져가요. 냉장고는 어쨌든 영원해요.',
        ])),
      });
      register({
        pos: new THREE.Vector3(MC.x, 0, MC.z + 7), r: 2.4, zone: 'milkroom',
        label: '불코로 돌아가기',
        use: () => zones.go('bulko', { x: B.x - 14, z: B.z + 3, rotY: -Math.PI / 2 }),
      });
      milkroomRoot = collectInteriorRoot(group, milkroomStart);
      zones.registerInterior('milkroom', {
        root: milkroomRoot,
        floorY: 0,
        bounds: { x0: MC.x - 10.5, x1: MC.x + 10.5, z0: MC.z - 6.2, z1: MC.z + 7.6 }, // (the cold wall's shelves)
        blockers: [
          { x: MC.x - 5, z: MC.z - 2, w: 5.6, d: 3.0 }, { x: MC.x + 5, z: MC.z - 2, w: 5.6, d: 3.0 },
          { x: MC.x - 7, z: MC.z + 2.6, r: 0.8 }, { x: MC.x + 7, z: MC.z + 2.6, r: 0.8 }, // Cocoa and Sundae
        ],
        spawn: { x: MC.x, z: MC.z + 6.5, rotY: 0 },
        lighting: {
          bg: 0x1a2832, fog: 0x1a2832, fogNear: 22, fogFar: 64,
          hemiSky: 0xdaf0fb, hemiGround: 0x4a5a64, hemiIntensity: 1.25,
          sunIntensity: 0,
        },
      });
    }

    // the wall of TVs — in the lounge now, behind the couches, on a stand with
    // a solid backing board (the screens are just lit panels)
    const tvBase = box(8.8, 1.0, 1.3, 0xe8743a); // shelf orange
    tvBase.position.set(B.x + 2.4, 0.5, B.z + 1.5);
    group.add(tvBase);
    const tvBack = box(8.8, 3.2, 0.2, 0xc2c6ca); // the solid rectangle behind the screens (light grey)
    tvBack.position.set(B.x + 2.4, 2.7, B.z + 1.3);
    group.add(tvBack);
    // each channel keeps two painted frames; the schedule assigns them to screens
    const channelFrames = {};
    for (const key of [
      'hoot', 'science', 'sea', 'bars',
      ...TV_WEATHERS.map((w) => `weather_${w}`),
      ...TV_AD_KEYS,
    ]) {
      channelFrames[key] = [0, 1, 2, 3].map((f) => makeScreenTex(key, f));
    }
    const screenTexKey = (key) => key === 'weather' ? `weather_${currentWeather()}` : key;
    const tvScreens = [];
    for (let i = 0; i < 8; i++) {
      const tx = B.x + 2.4 + ((i % 4) - 1.5) * 2.1;
      const ty = 2.0 + Math.floor(i / 4) * 1.5;
      const tv = box(1.9, 1.2, 0.18, 0x16140f);
      tv.position.set(tx, ty, B.z + 1.42);
      group.add(tv);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0),
        new THREE.MeshBasicMaterial({ map: channelFrames.sea[0] }));
      screen.position.set(tx, ty, B.z + 1.52);
      group.add(screen);
      tvScreens.push({ screen, key: 'sea' });
    }
    // TV scheduling — what's on depends on the hour. Day: weather, science, ads,
    // and the sea on one random screen. Night: Hoot's show, ads, the sea.
    // each screen has its OWN channel (no two alike, one of them is the sea)
    // and its own flipbook rhythm, so the wall reads as eight little shows
    // instead of one shuffle
    function scheduleScreens() {
      const lineup = isNight()
        ? ['hoot', 'sea', 'bars', ...TV_AD_KEYS, 'weather']
        : ['weather', 'science', 'sea', 'bars', ...TV_AD_KEYS];
      const shift = Math.floor(rand(0, lineup.length));
      tvScreens.forEach((sc, i) => {
        sc.key = lineup[(i + shift) % lineup.length];
        sc.rate = 0.45 + ((i * 37) % 10) / 30; // 0.45–0.75s a frame
        sc.t = i * 0.13;
        sc.f = i % 4;
      });
    }
    scheduleScreens();
    let tvNight = isNight();
    updates.push((dt) => {
      if (zones.current() !== 'bulko') return;
      if (isNight() !== tvNight) { tvNight = isNight(); scheduleScreens(); }
      for (const sc of tvScreens) {
        sc.t += dt;
        if (sc.t >= sc.rate) { sc.t = 0; sc.f = (sc.f + 1) % 4; }
        const frames = channelFrames[screenTexKey(sc.key)] ?? channelFrames.sea;
        sc.screen.material.map = frames[sc.f];
      }
    });
    // watch from anywhere along the wall front; you get one of the displayed screens
    const tvIdx = { hoot: 0, science: 0, sea: 0 };
    const tvAds = Object.fromEntries(TV_ADS.map((ad) => [ad.key, ad.text]));
    const tvBroadcast = {
      weather: () => ui.say(scoochWeather()),
      hoot: () => { const pool = isNight() ? [...HOOT_BITS, HOOT_NIGHT] : HOOT_BITS; ui.say(pool[tvIdx.hoot++ % pool.length]); },
      science: () => ui.say([{ speaker: NEWT, voice: NEWT_V, text: SCIENCE_FACTS[tvIdx.science++ % SCIENCE_FACTS.length] }]),
      sea: () => ui.say(SEA_BITS[tvIdx.sea++ % SEA_BITS.length]),
      bars: () => ui.say('컬러 바와 일정한 톤. 잠시만 기다려 주세요. 기다려요. 솔직히 요즘 방송 중 가장 편안한 프로그램이에요.'),
    };
    const playTv = (key) => {
      if (TV_AD_KEYS.includes(key)) return ui.say(tvAds[key]);
      return tvBroadcast[key]?.();
    };
    const tvHit = new THREE.Vector3();
    register({
      getPos: () => tvHit.set(Math.max(B.x - 1.6, Math.min(B.x + 6.4, player.group.position.x)), 0, B.z + 2.3),
      r: 2.6, zone: 'bulko',
      label: 'TV 보기',
      use: () => { playTv(pick(tvScreens).key); },
    });

    // display couches, dared to be imagined in your cottage
    for (let i = 0; i < 3; i++) {
      const couch = new THREE.Group();
      const seat = box(2.4, 0.5, 1.0, [0x5b8bc9, 0x8a5a8a, 0x4f8f6a][i]);
      seat.position.y = 0.45;
      couch.add(seat);
      const backC = box(2.4, 0.8, 0.3, [0x5b8bc9, 0x8a5a8a, 0x4f8f6a][i]);
      backC.position.set(0, 0.95, -0.38);
      couch.add(backC);
      for (const sx of [-1.18, 1.18]) {
        const arm = box(0.25, 0.7, 1.0, [0x4a76ac, 0x744a74, 0x417a58][i]);
        arm.position.set(sx, 0.65, 0);
        couch.add(arm);
      }
      couch.position.set(B.x - 1 + i * 3.4, 0, B.z + 5.5);
      couch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(couch);
    }
    register({
      pos: new THREE.Vector3(B.x + 2.4, 0, B.z + 4), r: 3, zone: 'bulko',
      label: '전시 소파에 앉아 보기',
      use: async () => {
        await ui.fadeSwap(() => {});
        ui.say('전시 소파 2번에 앉았어요. 어쩐지 단단하면서 푹신해요. 태그가 당신의 오두막에 두는 상상을 하라고 도발해요. 상상해요. 태그는 알고 있었어요.');
      },
    });

    // the food court: one and a half buttons, since before the bell sank
    const counter = box(4, 1.1, 1.2, 0xc2452c);
    counter.position.set(B.x + 12, 0.55, B.z + 6.5);
    group.add(counter);
    // the menu board: a solid board on two posts, text facing the customer
    for (const s of [-1, 1]) {
      const menuPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.9, 6), mat(0x55483a));
      menuPost.position.set(B.x + 12 + s * 2.0, 2.45, B.z + 5.9); // attached to the counter's back edge
      menuPost.castShadow = true;
      group.add(menuPost);
    }
    const menuMat = textPanel([['핫도그 + 탄산  ·  1.5버튼', 80, 42]], 512, 160, '#2a2a2a', '#fffaf0');
    const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.5), menuMat);
    menuBoard.position.set(B.x + 12, 3.6, B.z + 5.95);
    group.add(menuBoard);
    // (its back is plain board now — it used to read backwards from behind the counter)
    const menuBack = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.5), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }));
    menuBack.position.set(B.x + 12, 3.6, B.z + 5.94);
    menuBack.rotation.y = Math.PI;
    group.add(menuBack);

    // the apparatus, on the counter where you can watch it work: a roller
    // grill (four dogs, geologically patient) and the fizz machine
    const grill = box(1.3, 0.16, 0.66, 0x4a4f55);
    grill.position.set(B.x + 10.9, 1.19, B.z + 6.5);
    group.add(grill);
    const dogGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6);
    dogGeo.rotateX(Math.PI / 2); // lie along the rollers
    const rollerDogs = [];
    for (let i = 0; i < 4; i++) {
      const dog = new THREE.Mesh(dogGeo, mat(0xc2703a, 0.7));
      dog.position.set(B.x + 10.45 + i * 0.3, 1.34, B.z + 6.5);
      dog.castShadow = true;
      group.add(dog);
      rollerDogs.push(dog);
    }
    const fizz = box(0.72, 1.05, 0.6, 0xb0453a); // BULKO red, of course
    fizz.position.set(B.x + 13.35, 1.62, B.z + 6.3);
    group.add(fizz);
    for (let i = 0; i < 3; i++) { // one tap per fizz, no labels, know your fizz
      const tap = box(0.12, 0.12, 0.06, [0xf2cf5b, 0x5b8bc9, 0x4f8f6a][i]);
      tap.position.set(B.x + 13.15 + i * 0.2, 1.9, B.z + 6.62);
      group.add(tap);
    }
    const tray = box(0.5, 0.05, 0.24, 0x8da0aa);
    tray.position.set(B.x + 13.35, 1.17, B.z + 6.74);
    group.add(tray);
    updates.push((dt) => {
      if (zones.current() !== 'bulko') return;
      for (const dog of rollerDogs) dog.rotation.z += dt * 0.7; // the roller turns
    });

    // the staff: Mortimer, the frog vendor — the canon frog from animals.js
    // (the North Isle's very poisonous frog is his tiny blue cousin)
    const frogStool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.85, 8), mat(0x6b4a2e));
    frogStool.position.set(B.x + 12, 0.42, B.z + 5.4);
    frogStool.castShadow = true;
    group.add(frogStool);
    const frog = buildAnimal('frog', { body: 0x6ab04a, belly: 0xf3e9a8, feet: 0xf0d840 });
    frog.position.set(B.x + 12, 0.85, B.z + 5.4);
    group.add(frog);
    { // the paper hat — a little origami boat (the paper_boat item) — on his head
      const hatHull = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.36, 4), mat(0xfffaf0, 0.7));
      hatHull.rotation.y = Math.PI / 4; hatHull.scale.set(1.5, 1, 0.7);
      hatHull.position.set(0, 1.28, 0.1);
      const hatSail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 4), mat(0xfffaf0, 0.7));
      hatSail.position.set(0, 1.58, 0.1);
      hatHull.castShadow = true; hatSail.castShadow = true;
      frog.add(hatHull, hatSail);
    }
    updates.push((dt, t, playerPos) => {
      if (zones.current() !== 'bulko') return;
      frog.position.y = 0.85 + Math.abs(Math.sin(t * 1.4)) * 0.08; // a patient little bob, up on his stool
      if (playerPos) { // Mortimer turns to face whoever's ordering, like Gus
        const dx = playerPos.x - frog.position.x, dz = playerPos.z - frog.position.z;
        if (Math.hypot(dx, dz) < 8) frog.rotation.y = turnToward(frog.rotation.y, Math.atan2(dx, dz), dt, 3);
      }
    });
    // the frog IS the hot dog stand — order from him (the half-button is his doing)
    register({
      getPos: () => frog.position, r: 3.6, zone: 'bulko',
      label: '모티머에게 주문하기',
      use: async () => {
        if (!S.hasFlag('metFrog')) {
          S.setFlag('metFrog');
          await ui.say([
            '작은 종이모자를 쓴 크고 초록-노란 개구리가, 수많은 핫도그를 뒤집었으나 단 하나도 평가하지 않은 자의 평온으로 당신을 봐요.',
            '“모티머,” 그가 인사 대신 말해요. “핫도그?” 어느새 이미 하나 만들고 있어요. 눈을 깜빡이지 않아요. 롤러는 돌고; 탄산은 부글거리고; 모든 게 좋아요.',
          ], { speaker: '모티머', voice: 320 });
        }
        if (S.state.buttons < 2) {
          ui.say('모티머가 진심으로 미안해해요. 버튼 두 개가 모자라고, 그는 차이를 빌려주기엔 지나치게 위엄 있어요. 핫도그는 조수처럼 참을성 있게 돌아가요.', { speaker: '모티머', voice: 320 });
          return;
        }
        S.spend(2);
        S.drinkCoffee(60);
        kaching();
        sip();
        ui.updateHUD();
        if (!S.hasFlag('halfButton')) {
          S.setFlag('halfButton');
          S.addItem('half_button');
          jingle();
          await ui.say([
            '가격은 정확히 1.5버튼. 당신은 두 개를 내요. 모티머가 거스름으로 반 개를 돌려줘요 — 등기를 넘기는 사람의 중후함으로 건네요.',
            '어디서도 통용되지 않아요. 영원히 소중히 할 거예요. 그는 알고 있었어요.',
          ], { speaker: '모티머', voice: 320 });
          ui.toast('<b>반쪽 버튼</b>을 받았어요! 그리고 핫도그. <i>60초간 따뜻하고 빨라져요!</i>', '🌭');
        } else {
          ui.toast('핫도그, 탄산, 반쪽 버튼 환급. 모티머가 한 번 고갯짓해요. 시스템은 영원해요. <i>60초간 따뜻하고 빨라져요!</i>', '🌭');
        }
        if (!S.hasFlag('hotdogLore')) {
          S.setFlag('hotdogLore');
          await ui.say('계산대 옆 명판, 모티머가 오늘 아침 닦은: “이 가격은 바다에 종이 있던 때부터 변하지 않았다. 앞으로도 그럴 것이다.” 잠시, 푸드코트에서 울컥해요.', { speaker: '모티머', voice: 320 });
        }
      },
    });

    // THE TANK. fully furnished. not for sale. stop asking.
    // a group, so it parks as one — the west cold corner, south of the cooler
    // door and just past the parmesan, with room to walk between the two.
    const tankG = new THREE.Group();
    tankG.position.set(B.x - 8, 0, B.z - 3);
    group.add(tankG);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x3fb0e8, transparent: true, opacity: 0.4, roughness: 0.15 }));
    tank.position.set(0, 1.9, 0);
    tankG.add(tank);
    const tankBase = box(5.4, 0.5, 3, 0x55483a);
    tankBase.position.set(0, 0.25, 0);
    tankG.add(tankBase);
    // the furnishings
    const tinyCouch = box(0.9, 0.35, 0.4, 0xc25b4e);
    tinyCouch.position.set(-1.2, 0.85, 0);
    const tinyLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    tinyLamp.position.set(-0.6, 1.5, -0.5);
    const tinyLampPost = box(0.05, 0.7, 0.05, 0x55483a);
    tinyLampPost.position.set(-0.6, 1.05, -0.5);
    const tinyRug = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8), mat(0xd9a440, 0.8));
    tinyRug.position.set(0, 0.55, 0.2);
    const tinyArt = box(0.4, 0.3, 0.04, 0x27408f);
    tinyArt.position.set(1, 1.6, -1.2);
    tankG.add(tinyCouch, tinyLamp, tinyLampPost, tinyRug, tinyArt);
    // the residents
    const lobsterA = buildAnimal('lobster', { body: 0xd84f4f });
    lobsterA.scale.setScalar(0.4);
    lobsterA.position.set(-1.2, 0.95, 0);
    const lobsterB = buildAnimal('lobster', { body: 0xb8453a });
    lobsterB.scale.setScalar(0.4);
    lobsterB.position.set(1, 0.6, 0.4);
    lobsterB.rotation.y = -0.8;
    tankG.add(lobsterA, lobsterB);
    // life in the tank: A lounges on the couch and turns to see who's
    // looking; B potters about the floor — rug, lamp, the art, back again —
    // and a few bubbles find their way up
    const tankSpots = [[1, 0.4], [0.2, 0.6], [1.6, -0.6], [-0.3, -0.7], [1.8, 0.8]];
    const tb = { at: 0, pause: 2 };
    const bubbles = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
        new THREE.MeshBasicMaterial({ color: 0xe8f7ff, transparent: true, opacity: 0.7 }));
      b.userData.k = i / 5;
      tankG.add(b);
      bubbles.push(b);
    }
    updates.push((dt, t) => {
      if (zones.current() !== 'bulko') return;
      lobsterA.position.y = 0.95 + Math.sin(t * 1.2) * 0.02;
      lobsterA.rotation.y = Math.sin(t * 0.3) * 0.7;
      if (tb.pause > 0) {
        tb.pause -= dt;
        animateGait(lobsterB, t, 0);
      } else {
        const [gx, gz] = tankSpots[tb.at];
        const dx = gx - lobsterB.position.x, dz = gz - lobsterB.position.z, d = Math.hypot(dx, dz);
        if (d < 0.05) {
          tb.at = (tb.at + 1 + Math.floor(Math.random() * 3)) % tankSpots.length;
          tb.pause = 2 + Math.random() * 4;
        } else {
          const st = Math.min(d, dt * 0.35);
          lobsterB.position.x += (dx / d) * st;
          lobsterB.position.z += (dz / d) * st;
          lobsterB.rotation.y = turnToward(lobsterB.rotation.y, Math.atan2(dx, dz), dt, 3);
          animateGait(lobsterB, t, 1, 14);
        }
      }
      lobsterB.position.y = 0.6;
      for (const b of bubbles) {
        const k = (b.userData.k + t * 0.12) % 1;
        b.position.set(-1.8 + b.userData.k * 0.3 + Math.sin(t * 3 + b.userData.k * 9) * 0.05, 0.6 + k * 2.6, -0.9);
        b.material.opacity = 0.7 * (1 - k);
      }
    });
    let tankIdx = 0;
    register({
      pos: new THREE.Vector3(B.x - 5, 0, B.z - 3), r: 2.8, zone: 'bulko',
      label: '바닷가재 수조 살펴보기',
      use: () => ui.say(TANK_LINES[tankIdx++ % TANK_LINES.length]),
    });

    // Gus, the greeter. there is a vest. there is a system. respect both.
    const gus = buildAnimal('tortoise', { body: 0x8a9a7a, head: 0x8a9a7a });
    gus.scale.setScalar(1.25);
    const vest = box(0.85, 0.7, 0.95, 0xe8743a);
    vest.position.set(0, 0.62, 0);
    gus.add(vest);
    gus.position.set(B.x - 6.5, 0, B.z + 8);
    group.add(gus);
    updates.push((dt, t, playerPos) => {
      if (zones.current() !== 'bulko' || !playerPos) return;
      const parts = gus.userData.parts;
      parts.body.position.y = parts.bodyY + Math.sin(t * 0.9) * 0.02;
      const dx = playerPos.x - gus.position.x, dz = playerPos.z - gus.position.z;
      if (Math.hypot(dx, dz) < 6) {
        animateGait(gus, t, 0);
        gus.rotation.y = turnToward(gus.rotation.y, Math.atan2(dx, dz), dt, 3);
      } else {
        pace(gus, dt, t, 2.4, 0.35); // a slow patrol of the entrance: it's a system
      }
    });
    register({
      getPos: () => gus.position, r: 3, zone: 'bulko',
      label: '거스와 대화하기',
      use: () => {
        if (!S.hasFlag('metGus')) {
          S.setFlag('metGus');
          ui.say([
            '주황 조끼를 입은 거대한 늙은 거북이 상상 속 안경 너머로 당신을 봐요.',
            '“카드?” 카드가 없어요. 그가 지질학적 시간 동안 이를 고려해요.',
            '“…바닷가재들 게스트 패스를 쓰세요. 얘네는 절대 안 쓰니까.” 엄청난 위엄으로 통과시켜 줘요.',
          ], { speaker: '거스', voice: 260 });
          return;
        }
        ui.say(pick([
          '“카드? …맞다. 게스트 패스. 들어가세요.”',
          '“오늘의 시식 코너는: 풍요의 개념입니다. 고객당 하나.”',
          '“이 문에서 40년. 설명 못할 걸 세 가지 봤죠. 차들이 그중 둘.”',
        ]), { speaker: '거스', voice: 260 });
      },
    });

    const room = collectInteriorRoot(group, roomStart, [milkroomRoot]);
    zones.registerInterior('bulko', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 16.6, x1: B.x + 16.6, z0: B.z - 10.2, z1: B.z + 10.4 },
      blockers: [
        { x: B.x - 12, z: B.z - 7, r: 4 }, { x: B.x - 4, z: B.z - 7, r: 4 },
        { x: B.x + 4, z: B.z - 7, r: 4 }, { x: B.x + 12, z: B.z - 7, r: 4 },
        { x: B.x - 8, z: B.z - 3, r: 3 },   // the tank
        { x: B.x + 12, z: B.z + 6.5, r: 2 }, // food court counter
        { x: B.x - 6.5, z: B.z + 8, r: 0.8 }, // Gus, who is a tortoise and a system
        // the TV stand — overlapping circles so there's no walk-through gap
        { x: B.x - 1.2, z: B.z + 1.6, r: 1.1 }, { x: B.x + 0.6, z: B.z + 1.6, r: 1.1 },
        { x: B.x + 2.4, z: B.z + 1.6, r: 1.1 }, { x: B.x + 4.2, z: B.z + 1.6, r: 1.1 },
        { x: B.x + 6.0, z: B.z + 1.6, r: 1.1 },
        { x: B.x - 8, z: B.z + 3.3, r: 2.0 }, // the parmesan wheels
        // the three display couches
        { x: B.x - 1, z: B.z + 5.5, r: 1.5 }, { x: B.x + 2.4, z: B.z + 5.5, r: 1.5 },
        { x: B.x + 5.8, z: B.z + 5.5, r: 1.5 },
      ],
      spawn: { x: B.x - 2, z: B.z + 9.3, rotY: Math.PI },
      lighting: {
        bg: 0x2a2d31, fog: 0x2a2d31, fogNear: 34, fogFar: 90,
        hemiSky: 0xf4f8ff, hemiGround: 0x5a6066, hemiIntensity: 1.45, // fluorescent honesty
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(wx - 3, 0, wz + 5.6), r: 2.8,
      label: '불코 들어가기',
      use: async () => {
        await zones.go('bulko');
        if (!S.hasFlag('sawBulko')) {
          S.setFlag('sawBulko');
          ui.say('문이 열려요. 천장은 소문이에요. 어딘가에서 지게차들이 서로 노래해요. 불코에 오신 걸 환영해요.');
        }
      },
    });
    register({
      pos: new THREE.Vector3(B.x - 2, 0, B.z + 9.9), r: 1.8, zone: 'bulko',
      label: '밖으로 나가기',
      use: async () => {
        await zones.leaveTo({ x: wx - 3, z: wz + 7.4, rotY: 0 });
        ui.toast('거스가 영수증에 작은 태양을 찍어요. 영수증이 없다고? 공기에 찍어요. 전통은 전통이에요.', '✅');
      },
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

// filled in by createBulko; boats.js reads it to run the ferry line
export const BULKO_DOCK = { x: 0, z: 0, rotY: 0, buoyPos: null };
