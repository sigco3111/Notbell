// The island calendar: what season it is, whether today is special, and
// where the real-world clock stands. No imports — everything else can
// safely consult this at module load.

export function seasonOf(d = new Date()) {
  const m = d.getMonth(); // 0–11
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function holidayOf(d = new Date()) {
  const m = d.getMonth() + 1, day = d.getDate();
  if (m === 1 && day === 1) return { id: 'newyear', name: '새해 첫날' };
  if (m === 5 && day === 1) return { id: 'mayday', name: '메이데이' };
  if (m === 6 && day === 21) return { id: 'bellday', name: '종의 날' };
  if (m === 10 && day === 31) return { id: 'spooky', name: '으스스 이브' };
  if (m === 12 && day >= 21 && day <= 26) return { id: 'frost', name: '서리 축제' };
  return null;
}

// Baked at load — the island commits to a season for the whole sitting.
export const SEASON = seasonOf();
export const HOLIDAY = holidayOf();

// settings.js may nudge the island's clock via window.__notbellTz (hours) —
// a global on purpose: this file keeps zero imports, and must stay that way
export function hourNow() {
  const d = new Date();
  const shift = (typeof window !== 'undefined' && window.__notbellTz) || 0;
  return (d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 + shift + 24) % 24;
}

// The clock the HUD wears, e.g. "7:14 AM". Honors the same tz nudge as hourNow.
export function clockLabel(h = hourNow()) {
  const hr = Math.floor(h) % 24;
  const mn = Math.floor((h - Math.floor(h)) * 60);
  const ampm = hr < 12 ? '오전' : '오후';
  const h12 = hr % 12 || 12;
  return `${h12}:${String(mn).padStart(2, '0')} ${ampm}`;
}

// 0 at deep night → 1 at high noon, smooth. The sun keeps real hours.
export function dayFactor(h = hourNow()) {
  return Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
}

export function isNight(h = hourNow()) {
  return dayFactor(h) < 0.08;
}

// Lines the villagers share on a holiday, and Pip's one-off gift note.
export const HOLIDAY_LINES = {
  newyear: '새해 복 많이 받으세요! 섬은 견뎌낸 겨울과 낮잠 수로 해를 세어요. 둘 다 아주 잘하고 있어요.',
  mayday: '메이데이 축하해요! 클로버가 꽃 세기를 조직했어요. 소문에 따르면 꽃들도 우리를 세고 있대요.',
  bellday: '종의 날이에요. 종이 가라앉은 날. 딱히 슬퍼하는 건 아니에요 — 그저 오늘은 조금 더 귀를 기울일 뿐이에요.',
  spooky: '으스스 이브예요! 호박들이 나왔어요. 그중 하나가 당신을 평가하고 있어요. 어느 녀석인지는 몰라요. 그게 으스스한 부분이에요.',
  frost: '서리 축제를 축하해요! 모든 가지에 불을 밝혀서, 어둠이 그냥 어둡지 않고 포근해요.',
};
