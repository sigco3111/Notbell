// The Grove Line: a second steam railway, green where the strait line is
// red, running from Notbell's southeast shore to Grove Isle, hopping BOTH
// panhandle islets on the way (a trestle bent on every stepping stone).
// Built from the railway kit (railway.js) — this file is just the route and
// the local color.

import { ISLAND5, ISLAND5_HAND } from './terrain.js';
import { defineLine, createRailway, marchToWater } from './railway.js';

const H1 = ISLAND5_HAND[1]; // nearer islet
const H0 = ISLAND5_HAND[0]; // farther islet
const N = marchToWater({ x: 0, z: 0 }, H1, 20); // Notbell SE shore
const G = marchToWater(ISLAND5, H0, 4);          // Grove main shore

// geometry at module load, so the trees planted later leave room for it
const LINE = defineLine({
  points: [N, { x: H1.x, z: H1.z }, { x: H0.x, z: H0.z }, G],
  stops: [
    { name: 'Notbell', toward: { x: 0, z: 0 } },
    { name: 'Grove Isle', toward: { x: ISLAND5.x, z: ISLAND5.z } },
  ],
});

export function createNorthline(player, animals = null) {
  return createRailway(LINE, {
    player, animals, name: '그로브 선',
    colors: { loco: 0x2f7d4f, cab: 0x1d5a38, cars: [0xb0453a, 0xd9a440], roof: 0x2f7d4f },
    dwell: 13, whistle: [540, 720],
    text: {
      board: '그로브 선 모두 탑승하세요. 오렌지와 오래된 돈, 종점입니다.',
      wait: '선로 저편 어딘가에서, 기적이 그 생각에 동의해요.',
      queued: '레일이 초록 시골의 콧노래를 웅웅거려요.',
      kept: '그로브 선이 자리를 지켜 두었어요. 모두 탑승하세요.',
      arrive: [
        '낫벨. 기관차가 당신 뒤에서 숨을 골라요.',
        '그로브 섬. 오렌지와 아주 나이 든 변호사 냄새가 나요.',
      ],
    },
  });
}
