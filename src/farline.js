// The Farther Line: the third railway, salt-teal where the strait line is
// red and the Grove Line green — the long one, a proper trip over open
// water from the Far Isle's north-east shore out to Farther Isle. Two engines, one on each end,
// because the line has no turntable and no intention of apologizing: the
// one in front pulls, the one behind rides along and takes half the credit.
// (Every line works that way now — this one just said so first.)

import { ISLAND2, ISLAND7, SITES } from './terrain.js';
import { defineLine, createRailway, marchToWater } from './railway.js';

const CAMP = SITES.camp;
const FAR_ANCHOR = { x: 104, z: -40 };           // inside the Far Isle, north-east side
const F = marchToWater(FAR_ANCHOR, ISLAND7, 6);  // Far Isle's north-east shore
// Farther's south-west shore, just below the CAMP FARTHER arch — a long
// ride out over open water, which is the whole point of the place
const T = marchToWater({ x: CAMP.x - 4, z: CAMP.z + 4 }, FAR_ANCHOR, 3);

const LINE = defineLine({
  points: [F, T],
  stops: [
    { name: '파 아일', toward: { x: ISLAND2.x, z: ISLAND2.z } },
    { name: '파더 섬', toward: { x: CAMP.x, z: CAMP.z } },
  ],
});

export function createFarline(player, animals = null) {
  return createRailway(LINE, {
    player, animals, name: '파더 선',
    colors: { loco: 0x3a7d8a, cab: 0x2a5d68, cars: [0xc9705a, 0xd9c08f], roof: 0x3a7d8a },
    dwell: 15, whistle: [480, 640],
    text: {
      board: '파더 선 모두 탑승하세요. 기관차 두 대, 되돌아가기 없음. 방향 전환도 없음.',
      wait: '물 건너에서, 두 기관차 중 하나가 헛기침해요.',
      queued: '레일이 길고 짭짤한 음을 웅웅거려요.',
      kept: '파더 선이 자리를 지켜 두었어요. 모두 탑승하세요.',
      arrive: [
        '파 아일. 앞 기관차는 쉬고, 뒤 기관차가 공의 절반을 가져가요.',
        '파더 섬. 앞 기관차는 쉬고, 뒤 기관차가 공의 절반을 가져가요.',
      ],
    },
  });
}
