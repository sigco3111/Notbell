// The mail. Moss has finished sorting (it was thorough), and the Notbell
// Post is open: buy a stamp at his counter, write to anyone on the island,
// and a few minutes later your letter is in their mailbox with the little
// flag up. A while after that they've read it, and their answer is in
// yours. The Farther postcard can go too — "they'll know what to do."
//
// State lives in S.state.mail ({ out, inbox, pending }); letters are plain
// text, and only ever reach the page through ui.say (textContent).
//
// The carrier: 페니, a pigeon, a real villager (animals.js / villagers.js).
// She picks your letters up at the Post once Moss has sorted them, walks
// each one to its neighbor's mailbox (over the bridges, on the trains — the
// villagers' own route-finding), and the flag goes up. When they've written
// back, she collects the answer from their box and walks it to yours.
// Sometimes a neighbor writes first; she brings those too. Nothing is ever
// stuck: past a generous real-time limit, the island delivers on her behalf.

import * as THREE from 'three';
import * as S from './state.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import { jingle, kaching } from './audio.js';
import { ITEMS } from './catalog.js';
import { MAIL_REPLIES, VILLAGER_NAMES } from './villagers.js';

export const STAMP = 5;
const DELIVER_MS = 3 * 60 * 1000; // Moss is not slow. Moss is thorough. (the no-carrier fallback)
const SORT_MS = 30 * 1000;        // Moss sorts it first
const FAILSAFE_MS = 12 * 60 * 1000; // past this, the letter gets there anyway
const FIRST_MIN_MS = 15 * 60 * 1000, FIRST_MAX_MS = 30 * 60 * 1000; // a neighbor writes first, now and then
const REPLY_MS = 4 * 60 * 1000;   // and they like to think before they write back
const MAX_TEXT = 280;
const KEEP = 40;                  // letters kept either way (old ones fall off the end)

const box = () => S.state.mail;

export function send(to, text, kind = 'letter') {
  const m = box();
  m.out.push({ to, text: String(text || '').slice(0, MAX_TEXT), kind, at: Date.now(), delivered: false, replied: false });
  if (m.out.length > KEEP) m.out.splice(0, m.out.length - KEEP);
  S.save();
}

function replyFor(to, kind) {
  const lines = MAIL_REPLIES[to] || MAIL_REPLIES._default;
  // a different answer each time you write to the same neighbor
  const n = box().inbox.filter((l) => l.from === to).length;
  const body = lines.letters[n % lines.letters.length];
  const pages = [
    `친애하는 ${S.state.name || '이웃'} 님,`,
    ...(kind === 'postcard' ? [lines.postcard || MAIL_REPLIES._default.postcard] : []),
    body,
    `— ${lines.sign || to}`,
  ];
  return pages;
}

// ------------------------------------------------------------ the carrier ----
let carrier = null;       // Penny's animal record (null → the old timer post)
let SPOTS = null;         // { post, mine, boxes: { name: {x, z} } }
const bag = new Set();    // letters (out entries) in Penny's bag, on their way
const replies = [];       // answers (and first letters) she's collected, for your box
let job = null;           // what she's walking to do: { kind, to?, at, since }
let nextFirst = Date.now() + FIRST_MIN_MS + Math.random() * (FIRST_MAX_MS - FIRST_MIN_MS);

export function initCarrier(animals, houses, doorOf) {
  carrierPeers = animals;
  carrier = animals.find((a) => a.identity?.name === 'Penny') || null;
  SPOTS = { post: doorOf('post'), mine: houses.myMailbox, boxes: houses.mailboxes || {} };
  if (!carrier || !SPOTS.post || !SPOTS.mine) { carrier = null; return; }
  // the bag: a satchel, postal blue, with a flap
  const P = carrier.g.userData.parts;
  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.14), new THREE.MeshStandardMaterial({ color: 0x3a5aa8, flatShading: true, roughness: 0.8 }));
  satchel.position.set(0.44, -0.1, 0.05);
  satchel.castShadow = true;
  P.body.add(satchel);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0xd8342c, flatShading: true, roughness: 0.8 }));
  flap.position.set(0, 0.14, 0);
  satchel.add(flap);
  // ask her about your mail (when there's news, this beats small talk)
  register({
    getPos: () => carrier.g.position, r: 2.6, priority: 2,
    enabled: () => !carrier.away && !!carrierNews(),
    label: '페니에게 우편물 묻기',
    use: () => ui.say(carrierNews() || '지금 가방에 당신 건 없어요. 곧 생길지도요.', { speaker: 'Penny', voice: 600 }),
  });
}

const fresh = (l) => l.deliveredAt ?? (l.delivered ? l.at + DELIVER_MS : undefined);
function where(name) {
  if (SPOTS.boxes[name]) return SPOTS.boxes[name];
  // no box? walk it to them, wherever they are
  const who = carrierPeers?.find((a) => a.identity?.name === name);
  return who ? { x: who.g.position.x, z: who.g.position.z } : null;
}
let carrierPeers = null;

function deliverLetter(l, now) {
  l.delivered = true;
  l.deliveredAt = now;
  bag.delete(l);
}
function answerLetter(l, now) {
  l.replied = true;
  box().inbox.push({ from: l.to, pages: replyFor(l.to, l.kind), at: now, read: false });
  trimInbox();
  jingle();
  ui.toast(`A letter from <b>${ui.escapeHtml(l.to)}</b> is waiting in your mailbox.`, '📬');
}
function trimInbox() {
  const m = box();
  if (m.inbox.length > KEEP) m.inbox.splice(0, m.inbox.length - KEEP);
}
function dropReplies(now) {
  const m = box();
  for (const r of replies.splice(0)) {
    if (r.letter) answerLetter(r.letter, now);
    else {
      m.pending = (m.pending || []).filter((p) => p !== r.first);
      m.inbox.push({ from: r.first.from, pages: r.first.pages, at: now, read: false });
      trimInbox();
      jingle();
      ui.toast(`페니 left a letter from <b>${ui.escapeHtml(r.first.from)}</b> in your mailbox.`, '📬');
    }
  }
}

function firstLetter(name) {
  const who = carrierPeers?.find((a) => a.identity?.name === name)?.identity;
  const said = who?.lines?.[Math.floor(Math.random() * who.lines.length)];
  const sign = (MAIL_REPLIES[name] || MAIL_REPLIES._default).sign || name;
  return [
    `친애하는 ${S.state.name || '이웃'} 님,`,
    '이유는 없어요. 그냥 당신이 떠올랐는데, 그런 생각은 어딘가로 가야 하잖아요.',
    ...(said ? [`그건 그렇고. ${said}`] : []),
    `— ${sign}`,
  ];
}

// Penny's day: one job at a time, planned fresh whenever she's free
let asleep = false; // after her rounds, 페니 sleeps at the Post
function planCarrier(now) {
  const a = carrier, m = box();
  if (!a) return;
  const h = new Date().getHours();
  const onShift = h >= 7 && h < 21;
  if (asleep) {
    if (!onShift) return;
    asleep = false; // morning: out the Post's door, bag on
    a.away = false;
    a.g.visible = true;
    a.g.position.set(SPOTS.post.x, a.g.position.y, SPOTS.post.z);
  }
  if (a.goal || a.busy || a.pastime || a.away || a.riding || a.errand || a.meeting) return;
  const goTo = (spot, kind, extra, done) => {
    job = { kind, since: now, ...extra };
    a.goal = {
      x: spot.x, z: spot.z, r: 1.4,
      done: () => { job = null; done(Date.now()); S.save(); },
      fail: () => { job = null; done(Date.now()); S.save(); }, // can't get there? the island takes it the rest of the way
    };
  };
  const dist = (p) => Math.hypot(a.g.position.x - p.x, a.g.position.z - p.z);
  // 1. answers in the bag → your mailbox
  if (replies.length) return goTo(SPOTS.mine, 'home-box', {}, (t) => dropReplies(t));
  // 2. letters in the bag → the nearest neighbor with one coming
  if (bag.size) {
    let best = null, bd = Infinity;
    for (const l of bag) { const p = where(l.to); if (p && dist(p) < bd) { bd = dist(p); best = l; } }
    if (!best) { for (const l of [...bag]) deliverLetter(l, now); return; }
    const to = best.to;
    return goTo(where(to), 'deliver', { to }, (t) => { for (const l of [...bag]) if (l.to === to) deliverLetter(l, t); });
  }
  if (!onShift) {
    // done for the day: walk to the Post and go in
    const sleep = () => { asleep = true; a.away = true; a.g.visible = false; };
    if (dist(SPOTS.post) > 2) return goTo(SPOTS.post, 'bed', {}, sleep);
    return sleep();
  }
  // 3. sorted letters waiting at the Post → pick them up
  const sorted = m.out.filter((l) => !l.delivered && !bag.has(l) && now - l.at >= SORT_MS);
  if (sorted.length) return goTo(SPOTS.post, 'post', {}, () => { for (const l of m.out) if (!l.delivered && Date.now() - l.at >= SORT_MS) bag.add(l); });
  // 4. an answer (or a first letter) waiting in someone's box → collect it
  const ready = m.out.find((l) => l.delivered && !l.replied && !replies.some((r) => r.letter === l) && now - fresh(l) >= REPLY_MS && where(l.to));
  if (ready) {
    const to = ready.to;
    return goTo(where(to), 'collect', { to }, () => {
      for (const l of box().out) if (l.to === to && l.delivered && !l.replied && Date.now() - fresh(l) >= REPLY_MS && !replies.some((r) => r.letter === l)) replies.push({ letter: l });
      for (const p of box().pending || []) if (p.from === to && !replies.some((r) => r.first === p)) replies.push({ first: p });
    });
  }
  const first = (m.pending || []).find((p) => !replies.some((r) => r.first === p) && where(p.from));
  if (first) return goTo(where(first.from), 'collect', { to: first.from }, () => { replies.push({ first }); });
  // 5. nothing to do: back to the Post, to wait by the door
  if (dist(SPOTS.post) > 6) goTo(SPOTS.post, 'post', {}, () => {});
}

// called about once a second (houses.js): the carrier plans; the failsafe
// makes sure nothing waits forever; without a carrier, the old timer post
let pollT = 0;
export function poll(dt) {
  pollT -= dt;
  if (pollT > 0) return;
  pollT = 1;
  const m = box(), now = Date.now();
  m.pending ??= [];
  let changed = false;
  if (!carrier) {
    for (const l of m.out) {
      if (!l.delivered && now - l.at >= DELIVER_MS) { deliverLetter(l, now); changed = true; }
      if (l.delivered && !l.replied && now - fresh(l) >= REPLY_MS) { answerLetter(l, now); changed = true; }
    }
    if (changed) S.save();
    return;
  }
  // a neighbor writes first, now and then (into their own box, for 페니)
  if (now > nextFirst) {
    nextFirst = now + FIRST_MIN_MS + Math.random() * (FIRST_MAX_MS - FIRST_MIN_MS);
    const names = VILLAGER_NAMES.filter((n) => n !== 'Penny' && !m.pending.some((p) => p.from === n));
    if (names.length && m.pending.length < 3) {
      const from = names[Math.floor(Math.random() * names.length)];
      m.pending.push({ from, pages: firstLetter(from), at: now });
      changed = true;
    }
  }
  // the failsafe: generous, real-time, and quiet
  for (const l of m.out) {
    if (!l.delivered && now - l.at > FAILSAFE_MS) { deliverLetter(l, now); changed = true; }
    if (l.delivered && !l.replied && now - fresh(l) > REPLY_MS + FAILSAFE_MS) {
      const i = replies.findIndex((r) => r.letter === l);
      if (i >= 0) replies.splice(i, 1);
      answerLetter(l, now);
      changed = true;
    }
  }
  if (job && now - job.since > 6 * 60 * 1000 && carrier.goal) { const d = carrier.goal.done; carrier.goal = null; d?.(); } // a stuck walk ends as if it arrived
  planCarrier(now);
  if (changed) S.save();
}

// for Penny's chat: what's in the bag for (or from) you right now
export function carrierNews() {
  if (!carrier) return null;
  if (replies.length) return `가방에 당신 편지가 ${replies.length}통 있어요. 바로 여기. 지금 우편함으로 가는 길이에요 — 들여다보면 김 새요.`;
  const out = [...bag].map((l) => l.to);
  if (out.length) return `${out[0]}에게 보내는 당신 편지가 가방에 있어요, 제 심장과 씨앗 옆에. 금방 우편함에 넣어 드릴게요.`;
  return null;
}

// is there a letter from you sitting in their box, flag up, not yet read?
export function flagUp(name) {
  return box().out.some((l) => l.to === name && l.delivered && !l.replied);
}
export function unread() {
  return box().inbox.filter((l) => !l.read).length;
}

// your mailbox: new letters first, one at a time; then, if you like, the old ones
export async function checkMailbox() {
  const m = box();
  const fresh = m.inbox.filter((l) => !l.read);
  if (fresh.length) {
    for (const l of fresh) {
      l.read = true;
      S.save();
      await ui.say([`${l.from}의 편지.`, ...l.pages]);
    }
    return;
  }
  const waiting = m.out.filter((l) => !l.replied).length;
  if (!m.inbox.length) {
    ui.say(waiting
      ? '비었어요 — 하지만 당신 편지 한 통이 밖에서 열심히 오가는 중이에요. 답장은 이 우편함으로 와요.'
      : '비었고, 아주 깨끗해요. 안에 카드: “우체국 열려 있어요. 우표는 카운터에서. —모스.”');
    return;
  }
  const pick = await ui.ask(waiting ? '새 편지는 아직 없어요. (당신 편지는 아직 오가는 중.) 지난 편지를 읽을까요?' : '새 편지가 없어요. 지난 편지를 읽을까요?', [
    ...m.inbox.slice(-6).reverse().map((l, i) => ({ label: `✉️ ${l.from}의 편지`, value: i })),
    { label: '우편함 닫기', value: null },
  ]);
  if (pick === null || pick === undefined) return;
  const l = m.inbox.slice(-6).reverse()[pick];
  if (l) await ui.say([`${l.from}의 편지.`, ...l.pages]);
}

// choosing who to write to: the whole island, a page at a time
async function chooseRecipient(prompt) {
  const names = VILLAGER_NAMES;
  const PER = 8;
  for (let page = 0; ;) {
    const slice = names.slice(page * PER, page * PER + PER);
    const more = (page + 1) * PER < names.length;
    const choice = await ui.ask(prompt, [
      ...slice.map((n) => ({ label: `✉️ ${n}`, value: n })),
      ...(more || page > 0 ? [{ label: more ? '이웃 더 보기…' : '첫 페이지로', value: '__more' }] : []),
      { label: '아니요, 됐어요', value: null },
    ], { speaker: 'Moss', voice: 200 });
    if (choice !== '__more') return choice;
    page = more ? page + 1 : 0;
  }
}

// Moss's counter
export async function counter() {
  const hasCard = S.countItem('postcard_farther') > 0;
  const what = await ui.ask('“분류 완료. 아주 철저했어요. 우체국이 뭘 해 드릴까요?”', [
    { label: `✉️ 편지 보내기`, value: 'letter', hint: `${STAMP}🔘`, disabled: S.state.buttons < STAMP },
    ...(hasCard ? [{ label: `${ITEMS.postcard_farther.emoji} 파더 엽서 부치기`, value: 'postcard' }] : []),
    { label: '그냥 구경이에요', value: null },
  ], { speaker: 'Moss', voice: 200 });
  if (!what) return false;
  const to = await chooseRecipient(what === 'postcard' ? '“엽서. 좋네요. 누구에게?”' : '“편지. 누구에게?”');
  if (!to) return true;
  if (what === 'postcard') {
    if (!S.removeItem('postcard_farther')) return true;
    send(to, '네가 더 멀리 있었으면.', 'postcard');
    jingle();
    ui.toast('우표를 살짝 찍었어요.', '📮');
    await ui.say(`“파더 행, ${to}에게. 이미 여행을 많이 한 카드예요. 제가 여정을 보태 드리죠.”`, { speaker: 'Moss', voice: 200 });
    return true;
  }
  const text = await ui.input(`“쓰고 싶은 대로 쓰세요. ${to}이(가) 한 글자도 빠짐없이 읽을 거예요. 저는 하나도 안 읽어요. 그게 제 일이에요.”`, {
    speaker: 'Moss', voice: 200, long: true, placeholder: `${to}에게…`,
  });
  if (!text) {
    await ui.say('“백지 편지. 아주 신비롭네요. 다른 날 다시 오시죠.”', { speaker: 'Moss', voice: 200 });
    return true;
  }
  if (!S.spend(STAMP)) return true;
  kaching();
  ui.updateHUD();
  send(to, text, 'letter');
  await ui.say([
    `“${to}에게. 우표 — 잘 찍었어요, 단추 그림이에요.”`,
    '“몇 분이면 상대 우편함에 도착하고, 생각해 본 뒤 답장할 거예요. 답장은 당신 우편함으로 와요.”',
  ], { speaker: 'Moss', voice: 200 });
  return true;
}
