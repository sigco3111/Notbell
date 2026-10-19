// The islanders. animals.js gives them bodies and feet; this file gives
// them names, voices, and opinions — and their friendships, which ambient.js
// turns into little meetups. Index order matches the ROSTER there.

import * as ui from './ui.js';
import { register } from './interact.js';
import { applyHat } from './hats.js';
import { HOLIDAY, HOLIDAY_LINES } from './calendar.js';
import { jingle } from './audio.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';

// characters who belong to one place (the MouseBoat, the springs, the cave,
// the duck nest) — they never wander off to other islands or take trains
const ANCHORED = new Set(['크럼', '모찌', '폰도', '솔', '브룩', '엠버', '그린빈 제독', '퍼들', '바브', '루스', '페니']);

// what anyone says when you catch them mid-hobby (ambient.js pastimes)
const FISHING_LINES = [
  '쉿. 생각 중이야, 얘네가.',
  '뭘 잡으려는 게 아냐. 낚시하는 사람이 되려는 거야.',
  '아까 부츠 잡았어. 놔줬어. 갈 데가 있는 얼굴이더라고.',
  '비결은 물고기보다 조금 덜 원하는 거야.',
];
const NETTING_LINES = [
  '가만있어 봐. 너 말고. 딱정벌레.',
  '잡는 건 아니야, 정확히는. 그물을 사이에 두고 서로 알아가는 중이야.',
  '놓쳤다! 일부러. 관대하게 굴고 있어.',
];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// birthdays — one date each, no ages; the archipelago counts occasions,
// not years. (Howell's is the day after Bell Day. He says he heard it.)
export const BIRTHDAYS = {
  클로버: [5, 1], 비스킷: [11, 12], 새프런: [9, 22], 하웰: [6, 22],
  브램블: [7, 19], 퍼들: [4, 14], '그린빈 제독': [2, 8],
  매리골드: [8, 30], 엠버: [1, 17], 터스크: [12, 1], 버터팻: [6, 3],
  크럼: [9, 9], 모찌: [1, 2], 폰도: [1, 3], 솔: [7, 7], 브룩: [3, 20],
  바브: [10, 14], 루스: [3, 1], 널: [1, 1], 메이블: [4, 1], 페니: [2, 14],
};

export function birthdayToday(name, d = new Date()) {
  const b = BIRTHDAYS[name];
  return !!b && d.getMonth() + 1 === b[0] && d.getDate() === b[1];
}

// The whole birthday exchange — greeting, the gift offer, the thanks — shared
// by the wander-talk and the at-home visit (a birthday follows you home).
// Returns true if today was, in fact, the whole day.
export async function birthdayTalk(name, voice) {
  if (!birthdayToday(name)) return false;
  const year = new Date().getFullYear();
  if (S.hasFlag(`bgift_${name}_${year}`)) {
    ui.say('최근 기억으로는 최고의 생일이야. 최근 기억은 관대하지. 그래도.', { speaker: name, voice });
    return true;
  }
  const pocket = Object.entries(S.state.inv)
    .filter(([iid]) => ITEMS[iid])
    .slice(0, 5)
    .map(([iid]) => ({ label: `${ITEMS[iid].emoji} ${ITEMS[iid].name}`, value: iid }));
  const choice = await ui.ask(
    '내 생일이야, 알아? 하루 종일. 엄청 침착하게 지내고 있어.',
    [...pocket, { label: '🎉 그냥 따뜻한 축하만', value: null }],
    { speaker: name, voice });
  if (choice) {
    S.removeItem(choice);
    S.setFlag(`bgift_${name}_${year}`);
    jingle();
    await ui.say(
      `“나한테?” ${ITEMS[choice].name}을(를) 부화할 것처럼 소중히 들어요. “지금까지 중 최고야. 다른 해들한테는 비밀.”`,
      { speaker: name, voice });
    ui.toast(`${name}이(가) 이걸 기억할 거예요.`, '🎂');
  } else {
    ui.say('따뜻한 축하 접수 및 보관 완료. 침착은 계속돼요.', { speaker: name, voice });
  }
  return true;
}

const IDENTITIES = [
  {
    name: '클로버', voice: 640, hat: 'flower_crown', // cream rabbit
    lines: [
      '오늘 행운의 클로버를 셌어. 전부! 그래서 좋은 날인 줄 아는 거야.',
      '꽃 사이에 아주 가만히 서 있으면, 나비들이 널 가구로 생각해. 최고야.',
      '비스킷은 한 아침에 두 번은 못 잔대. 내가 살아있는 증거야, 된다는.',
      '루나 커피는 따뜻한 창틀 냄새야. 마시진 않아. 그냥 들어가서 숨 쉬어.',
    ],
  },
  {
    name: '비스킷', voice: 560, hat: 'knit_cap', // brown rabbit
    lines: [
      '한 번은 대단한 걸 묻었어. 어딘지 기억 안 나. 그래서 매일이 보물찾기야.',
      '파기의 비결은 방금 한 게 뭐든 원래 그럴 작정이었던 것처럼 보이는 거야.',
      '핍이 내 행운의 버튼을 사려 했어. 행운의 거! 뻔뻔함. 완전 까치 그 자체.',
      '아주 오래된 조약돌 찾으면, 펀에게 가져가. 얘가 어렸을 때 알던 사이야.',
    ],
  },
  {
    name: '새프런', voice: 520, hat: 'straw_hat', // orange fox
    lines: [
      '이 섬의 모든 꽃을 두 번씩 맡아봤어. 직업적 호기심. 난 아무 직업도 없지만.',
      '조수 웅덩이가 수다 떨어, 알아? 첨벙 첨벙 첨벙. 스캔들 같은 얘기들.',
      '하웰한텐 비밀인데, 하울링이 늘고 있어. 이제 거의 온전한 음 하나야.',
      '농어 또? 흠. 점수는… B 마이너스. 후한 거 알지.',
    ],
  },
  {
    name: '하웰', voice: 430, hat: null, // wolves don't wear hats. it's a whole thing. // gray fox. a WOLF. obviously a wolf.
    lines: [
      '하웰이야. 하울링의 하울. 늑대가 내는 소리의 그 하울. 내가 그 늑대야. 늑대.',
      '여우들은 이런 존재감을 꿈꾸지. 나야 모르지. 늑대라서.',
      '아우우우우… 크흠. 연습이야. 늑대는 연습해. 정상이야.',
      '안개 낀 밤엔 바다 밑에서 종 울리는 게 들려. 신비로운 척하는 게 아냐 — 귀가 아주 좋아서. 늑대 귀.',
    ],
  },
  {
    name: '브램블', voice: 320, hat: 'leaf_hat', // bear
    lines: [
      '어제 동굴 입구에 앉아 있었어. 안에서 뭔가 웅웅거려. 다정한 웅웅거림이야. 확인했어.',
      '좋은 하루는 베리 하나, 앉기 한 번, 그리고 멋진 구름 하나 (1개). 오늘은 아침까지 세 개 다 했어.',
      '펀은 우리 할머니가 새끼였을 때를 기억해. 펀에게 나이는 안 물어. 예의야.',
      '버튼과 야망 냄새가 나네. 섬이 사람을 그렇게 만들지.',
    ],
  },
  {
    name: '퍼들', voice: 700, hat: 'paper_boat', // white duck
    lines: [
      '오늘 섬을 한 바퀴 다 돌았어! …좋아, 반 바퀴. …좋아, 큰 웅덩이였어.',
      '제독은 내가 규율이 없대. 난 간식이 없대. 둘 다 맞아.',
      '낚시하다 부츠가 도망가도 걱정 마! 그 부츠 알아. 자유로운 영혼이야.',
      '꽥. 미안 — 버릇이라.',
    ],
  },
  {
    name: '그린빈 제독', voice: 380, hat: 'captains_cap', // the mallard
    lines: [
      '차렷. 아침 순찰은 보고할 게 없었고, 그게 내가 좋아하는 보고 방식이오.',
      '정돈된 해변이 행복한 해변이오. 해안선을 빈틈없이 운영하오, 선원.',
      '늙은 탠지가 한 번은 등대 종을 울리게 해줬소. 내 경력 최고의 순간. 퍼들이 말하게 두지 마시오 — 과장하니까.',
      '안개는 밀려오고, 밀려나가오. 우리 중 하나만 경례하고, 난 그게 좋소.',
    ],
  },
  {
    name: '매리골드', voice: 350, hat: 'straw_hat', // the Far Isle's horse
    lines: [
      '기차가 깨기 전 매일 아침 다리를 뛰어. 우리 사이엔 합의가 있어.',
      '알더 수사는 판자 위 내 말발굽 소리가 박수 같대. 아주 진지하게 받아들이고 있어.',
      '여기 정원은 더 조용한 꽃들이 자라. 자랑하는 걸 들으려면 기울여 들어야 해.',
      '그냥… 달려본 적 있어? 어디로든 아니고. 그냥 달리기. 최고 수준의 추천.',
    ],
  },
  {
    name: '엠버', voice: 590, hat: null, // salamander, cave enthusiast
    lines: [
      '동굴은 B플랫으로 웅웅거려. 확인했어. 가끔 화답해. 우리는 화음을 맞춰.',
      '따뜻한 바위, 시원한 어둠, 천장의 작은 별들. 기본적으로 다 가졌어.',
      '옛 빛은 방문객을 꺼리지 않아. 내게 말해줬어. 말로가 아니라. 따뜻함으로.',
      '비! 비 사랑해. 다들 실내에 숨으면 두 섬이 통째로 내 거야.',
    ],
  },
  {
    name: '터스크', voice: 240, hat: null, // the wild boar. wild-ish. wild-adjacent.
    lines: [
      '*스르르르프*',
      '흠프. (그가 버섯을 당신 쪽으로 밀었다가, 마음을 바꿔 먹어요.)',
      '*만족스러운 땅 파는 소리*',
      '(그가 당신을 한참 봐요. 무슨 검열을 통과한 것 같아요.)',
    ],
  },
  {
    name: '버터팻', voice: 300, hat: 'straw_hat', // the north isle's cow
    lines: [
      '여기 풀은 이끼 같고, 이끼는 풀 같아. 수년간 연구했어. 맛있는 분야, 내 연구 분야.',
      '버튼 버섯 스튜를 먹어봤어. 울었어. 카트는 자기가 한 짓을 알아.',
      '조용한 저녁엔 베스퍼가 읽어줘. 줄거리를 다 따라가진 못해. 동반이 줄거리야.',
      '음매, 그건 그렇고. 프로답게 그건 미리 해두는 편이야.',
    ],
  },
  {
    name: '크럼', voice: 760, hat: 'paper_boat', // mouse, master of the MouseBoat
    lines: [
      '승선 환영! 뭐 — 근처 환영. 선내는 대부분 치즈 창고야.',
      '군도의 모든 해안에 정박해봤어. 부스러기로 순위 매겼지. 네 건 3위. 상처받지 마.',
      '하우스보트는 바다와 낮잠 사이에서 안 골라도 된다는 뜻이야. 선택 거부. 난 낮잠의 선원이야.',
      '퍼시스턴트 호와 마우스보트 호는 엄밀히 라이벌 선박이야. 브라인은 그래도 수프를 보내줘. 치열한 라이벌. 맛있어.',
    ],
  },
  {
    name: '모찌', voice: 250, hat: 'orange_hat', // capybara; the orange arose
    lines: [
      '음. 안녕. (제대로 하면 이걸 말하는 데 시간이 좀 걸려요.)',
      '귤? 왔어. 머물렀어. 우린 좋은 걸 심문하지 않아.',
      '이 섬의 모든 온천에 몸을 담가보고 순위를 매겼어. 전부 1등이야.',
      '서두르는 것 같네. 잠깐 앉아. 서두름은 남아 있어. 항상 남아 있어.',
    ],
  },
  {
    name: '폰도', voice: 230, hat: null, // the other capybara
    lines: [
      '말은 모찌가 해. 동의는 내가 해. 음.',
      '솔이 한 번은 소나기 내내 기대게 해줬어. 산 같은 친구야.',
      '간헐천이 터지면 다들 깜짝 놀라. 우린 아니야. 알고 있었거든. 물이 먼저 알려줘.',
      '…미안, 멍해졌어. 얘기 중이었나? 둘 다 여기 있었나? 좋아. 좋아.',
    ],
  },
  {
    name: '솔', voice: 180, hat: null, // crocodile, professionally patient
    lines: [
      '안녕하시오오오. 이빨은 신경 쓰지 마시오. 얼굴에 딸려 왔소.',
      '새? 얘는 픽이오. 치과 담당. 난 따뜻하고 거대한 것 담당.',
      '사람들은 위협을 기대하오. 난 위협을 전부 간헐천에 하청 주오.',
      '비 오면 카피바라들이 나에게 기대오. 내게 등이 있는 전부의 이유요.',
    ],
  },
  {
    name: '브룩', voice: 200, hat: null, // the other crocodile
    lines: [
      '솔이 말해. 난 미소 지어. 둘이 합쳐 완전한 악어야.',
      '내 새는 핍이라고 해 — 까치랑 무관. 소송이 있었어. 없었어. 있을 수도 있어.',
      '한 번은 일주일을 완벽하게 가만히 있었어. 개인 최고. 이끼가 야심을 품더라고.',
      '언제가 우리랑 수영해. 대부분 둥둥 떠서 이미 먹은 점심 생각해.',
    ],
  },
  // ----- the Isle of Cran (index order matches animals.js ROSTER)
  {
    name: '바브', voice: 170, hat: null, // snapping turtle. the moss on her shell is the hat.
    lines: [
      '흠. 내 좋은 바위에 서 있네. … 아냐. 있어 봐. 좋은 바위야. 누군가는 즐겨야지.',
      '나는 물어. 이름에 있어. 친구는 안 물어. 날씨를 물어. 화요일이라는 개념을 물어.',
      '루스랑 나는 이 개울 곁에 40년을 앉았어. 백 마디쯤 했나. 그중 아흔은 “봐.”',
      '크랜베리는 떠. 안에 작은 무(無) 주머니가 있거든. 뜨는 건 다 작은 무를 품고 있어. 다음에 가라앉을 때 기억해.',
      '개울은 바다로 가. 모든 게 바다로 가. 난 서두르지 않아. 바다는 남아 있어.',
      '아무한테도 말하지 마. 나 줌바 다녀. 뒷줄. 팔 동작은 안 해.',
      '타투 한 번 했어. 등딱지에. “RUTH,” 하트 안에. 본인은 유치하대. 매일 보러 와.',
      '고양이는 항상 노트북 위. 거위는 항상 안 될 것 위. 난 이 바위 위. 다들 제자리가 있어.',
    ],
  },
  {
    name: '루스', voice: 300, hat: 'knit_cap', // box turtle. knits. for the creek, mostly.
    lines: [
      '오, 안녕, 얘야. 앉아, 앉아. 바브는 괜찮아. 바브는 모든 걸 신경 쓰거든, 그 말은 특별히 뭘 신경 쓰진 않는다는 거야.',
      '개울한테 목도리를 뜨고 있어. 겨울용. 아주 길 거야. 개울이 아주 기니까.',
      '목요일엔 수채화. 늪을 그려. 매주 분홍 얼룩이 나와. 가을엔 늪이 분홍 얼룩 그 자체야. 난 아주 정확해.',
      '바브가 등딱지에 내 이름을 새겼어. 유치한 척해. 매일 보러 가.',
      '이끼는 1년에 1인치쯤 자라. 1야드가 자라는 걸 전부 지켜봤어. 내내 사랑스러웠어.',
      '커뮤니티 센터 초콜릿 모임에 다녀. 지지하러. 브라우니를 가져가. 그만두래. 그것도 지지하고 있어.',
    ],
  },
  {
    name: '널', voice: 560, hat: 'headphones', // black cat. hacker. "like the value, not like nothing."
    lines: [
      '들어왔다. … 미안. 어딘가에 들어갈 때마다 그 말을 해. 버릇이야.',
      '연구소를 한 번 해킹했어. 비밀번호가 “bell”이었어. “notbell”로 바꿔놨지. 그게 2년 전. 아무도 몰라.',
      '섬 전체가 라우터 하나로 돌아가. 라우터는 속 빈 통나무에 살아. 통나무는 이끼투성이. 신호는 최고.',
      '검은 고양이, 네 길을 가로질러. 7년의 좋은 업타임이야. 사람들이 미신을 거꾸로 알아.',
      '크랜베리 세는 프로그램을 짰어. 크래시 났어. 크랜베리가 숫자보다 많아. 알아보는 중.',
      '거위가 자꾸 내 USB를 훔쳐. 싸우는 건 그만뒀어. 모든 건 백업돼 있어. 거위 안에.',
      '“해커”는 센 단어야. 난 그냥 설정이 어디 있는지 아는 사람 정도야.',
      '널. 값 null처럼. 무(無)는 아니야. 차이가 있어, 그리고 내가 그 차이야.',
    ],
  },
  {
    name: '메이블', voice: 470, hat: 'party_cone', // goose. the hat was on a birthday. the birthday wasn't using it.
    lines: [
      '꽥. … 그건 인사야. 경고이기도 해. 대부분 인사.',
      '난 훔치지 않아. 재배치해. 물건은 있어야 할 곳에 놓이게 돼 있어, 그게 내 근처야.',
      '이 모자? 생일에 있던 거야. 생일이 안 쓰고 있었어. 꽥.',
      '바브가 한 번 나를 물었어. 난 울었지. 그 이후 최고의 적. 비 오면 좋은 바위를 비워줘.',
      '오늘 열쇠를 주웠어. 뭘 여는지 몰라. 그게 재밌는 부분이야. 그게 항상 재밌는 부분이야.',
      '고양이는 내가 모른다고 생각해, 자기 백업을 나한테 한다는 걸. 나 알아. 난 아주 안전한 거위야.',
      '줌바는 그냥 규칙이 있는 울며 돌아다니기야. 아주 잘해. 맨 앞줄 출입 금지야.',
    ],
  },
  {
    name: '페니', voice: 600, hat: 'mail_cap', // pigeon. the mail carrier. walks every bridge twice a day.
    lines: [
      '우편! … 네 건 아냐. 아직은. 곧, 어쩌면. 나는 너보다 먼저 알아.',
      '비도 눈도 아주 설득력 있는 거위도 내 배달을 막지 못해. 거위는 노력해봤어.',
      '군도의 모든 다리를 걸어. 어떤 날은 하루 두 번. 내 발은 의견이 있어. 그 의견들도 우편이야.',
      '모스가 분류하고, 내가 배달해. 걘 철저하고, 난 빨라. 우리 둘이 완전한 우체국이야.',
      '편지는 안 읽어. 근데 가방 안에서 앉아 있는 자세로 내용을 알 수 있어. 기쁜 편지는 허리를 펴.',
      '비둘기는 메시지가 생기기 전부터 메시지를 운반했어. 요즘은 그냥 걷기라고 불러. 걷기가 좋아. 풍경이 낮으니까.',
    ],
  },
];

// ------------------------------------------------------------ friendships ----
// Everyone has a person. ambient.js arranges the meetups; the chats are
// little scripts, alternating speakers 'a' and 'b'. meetLines is what you
// get for walking up mid-conversation.

// everybody who lives on the islands, for the Post's address book
export const VILLAGER_NAMES = IDENTITIES.map((i) => i.name);

// Letters back, when you write (mail.js). Each neighbor answers in their
// own voice — a different letter each time you write, round and round.
// `postcard` is the line they add when what you sent was the Farther card.
export const MAIL_REPLIES = {
  Clover: {
    letters: [
      'Your letter came! I read it in the flowers so the butterflies could hear. They were very moved. One of them landed on the part about me.',
      'I put your letter under my pillow for luck. Then I napped on it. Twice. It’s the luckiest nap I’ve ever had.',
    ],
    postcard: 'A postcard from FARTHER! I didn’t know you could get farther than here. Now I have to go. I’m packing a snack.',
    sign: 'Clover (a lucky rabbit, now luckier)',
  },
  Biscuit: {
    letters: [
      'Got your letter. I buried it for safekeeping. Then I dug it up to read it again. Then I buried it again. It’s in a very good spot. I think.',
      'Thanks for writing! I found a great pebble today and I thought: who else would understand this pebble? You. It’s in the envelope. (It didn’t fit. Imagine it.)',
    ],
    postcard: 'The postcard is on my wall next to my treasure map. The map is of my own garden. It’s very detailed.',
    sign: 'Biscuit',
  },
  Saffron: {
    letters: [
      'I got your letter and I smelled it first, obviously. Paper, a little salt, and Moss. Moss smells like a library that took up swimming.',
      'You write the way the tide pools gossip — lots of little news, all of it important. Write again. I want to know EVERYTHING.',
    ],
    postcard: 'Farther Isle! I hear the mangroves out there are extremely nosy. I respect them already.',
    sign: 'Saffron (professionally curious, unprofessionally)',
  },
  Howell: {
    letters: [
      'I received your correspondence. I read it aloud. To the moon. As wolves do. It went very well. The moon had no notes.',
      'Thank you for your letter. I will keep it in my den. My den is a house. A wolf’s house. Which is a den. AwoOOo. (That was a sign-off. Wolves sign off like that.)',
    ],
    postcard: 'A postcard from the far places. Wolves roam, you know. I have roamed. I have roamed as far as the bridge.',
    sign: 'Howell (a wolf)',
  },
  Bramble: {
    letters: [
      'Your letter came on a good day: a berry, a sit, and one (1) excellent cloud. Then your letter. That’s four. I didn’t know a day could hold four.',
      'I read your letter slowly, the way you eat the last berry. It was a very good last berry. Write again when you have another.',
    ],
    postcard: 'Farther. I like a place that says what it is. I’ll look at the card instead of going. That’s nearly as good, for a bear.',
    sign: 'Bramble',
  },
  Puddle: {
    letters: [
      'YOUR LETTER!! I read it swimming. It got a bit wet. It’s fine! Now it’s a bit of a puddle, which is my NAME, so it’s basically mine now!!',
      'The Admiral says letters should be short and to the point. HERE IS MY POINT: hi!!! I miss you!!! Come to the beach!!!',
    ],
    postcard: 'A postcard!! From somewhere I haven’t swum to YET!!',
    sign: 'Puddle 💧',
  },
  'Admiral Greenbean': {
    letters: [
      'Your dispatch was received at 0900 and read at 0901. A crisp report. Well done, sailor. Nothing further. (Carry on.)',
      'Correspondence acknowledged. The shoreline remains tidy. Puddle remains Puddle. All is as it should be. At ease.',
    ],
    postcard: 'A postcard from a forward position. Farther. Noted in the log. The log is proud of you.',
    sign: 'Adm. Greenbean, retired (not retired)',
  },
  Marigold: {
    letters: [
      'I carried your letter across the bridge this morning so the planks could hear it. They applauded. They applaud everything, but this time they meant it.',
      'Your letter was a quiet kind of letter. The best kind. You have to lean in to hear it showing off.',
    ],
    postcard: 'Farther! Past the Far Isle. I didn’t think there was a past-the-Far-Isle. I’ll trot a little farther tomorrow, in your honor.',
    sign: 'Marigold',
  },
  Ember: {
    letters: [
      'I read your letter in the cave. The cave hums in B-flat and so, it turns out, does your handwriting. We harmonized. It was lovely.',
      'Thank you for writing! I told the Old Light about it. It didn’t say anything. It went a little warmer. That’s how you know.',
    ],
    postcard: 'A postcard! I pinned it up near the glow worms. They’re very polite about it. They glow at it now.',
    sign: 'Ember',
  },
  Tusk: {
    letters: [
      '*snrrrf.* (A muddy hoofprint. Beside it, very carefully, a second, smaller hoofprint. It is, unmistakably, a thank-you.)',
      'Hrmf. (A mushroom, pressed flat and mailed. It is a gift. It is also slightly eaten. Both are how Tusk says you matter.)',
    ],
    postcard: '(The postcard has come back with a mushroom tucked into the corner. Tusk approves of Farther.)',
    sign: '(a hoofprint)',
  },
  Butterpat: {
    letters: [
      'I got your letter and I read it three times, slowly, the way I eat moss. It was delicious. Letters are like moss. They are best in company.',
      'Vesper helped me with the long words in your letter. There weren’t any. Vesper stayed anyway. That’s how good your letter was.',
    ],
    postcard: 'A postcard from a whole other island. I will stand very still and imagine the grass there. I bet it’s grassy.',
    sign: 'Butterpat (of the north moss)',
  },
  Crumb: {
    letters: [
      'Ahoy! Your letter arrived just as I woke from a nap and just before I started another. Perfect timing. Very seaworthy of you.',
      'Filed your letter in the cheese storage for safekeeping. It’s the safest place aboard. It smells a bit of cheddar now. You’re welcome.',
    ],
    postcard: 'Farther Isle! I’ve moored there. Ranked it for crumbs. Excellent crumbs. Your postcard is fourth. That’s very high.',
    sign: 'Crumb, Master of the MouseBoat',
  },
  Mochi: {
    letters: [
      'Mm. Your letter. I read it in the hot spring. It is now slightly steamed. It is very relaxed. So am I.',
      'Thank you. That is the whole letter. (It took me a long time. Done properly.)',
    ],
    postcard: 'Mm. Farther. We will soak about it.',
    sign: 'Mochi (and the orange)',
  },
  Pondo: {
    letters: [
      'Mochi read me your letter. I agreed with all of it. Mm.',
      'I am writing back myself this time. Mochi is helping. Mochi says to say: we liked it. Mm.',
    ],
    postcard: 'Mm. A postcard. We agreed it was a good one.',
    sign: 'Pondo',
  },
  Sol: {
    letters: [
      'Sssalutations. Your letter arrived. Pick read it to me over breakfast while she did my teeth. We agreed it was the best part of the morning.',
      'Thank you for writing. People rarely write to a crocodile. They assume we bite letters. We only bite fish, and only on weekdays.',
    ],
    postcard: 'A postcard from farther away. Sssplendid. I shall bask on it.',
    sign: 'Sol',
  },
  Barb: {
    letters: [
      'Hrm. Got your letter. Read it on the rock. Read it twice. Ruth says that means I liked it. Ruth is right. Don’t tell her.',
      'Letter received. The creek says hello. The creek doesn’t talk. I’m saying it for the creek. Hrm.',
    ],
    postcard: 'A postcard from Farther. I don’t go farther. Farther can come here. It’s welcome to the rock.',
    sign: 'Barb (on the rock)',
  },
  Ruth: {
    letters: [
      'Your letter came, dear! I’ve tucked it into my knitting basket so it stays warm. Barb read it over my shoulder and said “hrm,” which from Barb is a sonnet.',
      'Thank you for writing. I’m knitting you something. It will take a while. I knit at the speed of moss.',
    ],
    postcard: 'Oh, Farther! I painted it from your postcard. It came out a pink smudge. It’s lovely there.',
    sign: 'Ruth (and a scarf, in progress)',
  },
  Null: {
    letters: [
      '> letter received. > parsed. > sentiment: warm. > replying… hi. that’s the reply. hi. it took me four drafts.',
      'Got your letter. It came on paper. Real paper. I held it for a while. Nobody sends me anything that doesn’t have a password.',
    ],
    postcard: 'Farther Isle. No signal out there. I checked. I’m jealous.',
    sign: '— Null (like the value)',
  },
  Mabel: {
    letters: [
      'HONK! Your letter! It’s mine now. It was always going to be mine. That’s how letters work. HONK.',
      'Thanks for writing! Enclosed: one (1) button I found. It was on someone’s coat. They weren’t using the whole coat. HONK.',
    ],
    postcard: 'A postcard! I’m keeping it forever. I keep EVERYTHING forever. Ask the cat.',
    sign: 'Mabel 🪿 (HONK)',
  },
  Penny: {
    letters: [
      'A letter FOR me! I carried it to myself. It was very strange. I delivered it to my own box and then stood there. Thank you. I read it twice, once as the carrier and once as me.',
      'You wrote to the mail carrier. Nobody writes to the mail carrier. I put it in the bag with the others so it wouldn’t be lonely, then I remembered it was mine. Thank you. Truly.',
    ],
    postcard: 'A postcard from Farther! I’ve walked to Farther. By train, then by foot. The postcard is prettier than the walk. Don’t tell Farther.',
    sign: 'Penny (Notbell Post, rounds twice daily)',
  },
  Brook: {
    letters: [
      'Sol said to say thank you. I say thank you. Between us, a complete thank-you.',
      'I held your letter very still for a long time so I could read it properly. Personal best. The moss got ideas again.',
    ],
    postcard: 'A postcard. I smiled at it. That is my review. Five stars.',
    sign: 'Brook',
  },
  _default: {
    letters: ['Thank you for your letter. It found me, which is the whole trick of letters.'],
    postcard: 'A postcard from farther away. How lovely.',
  },
};

export const FRIENDS = [
  {
    a: 'Howell', b: 'Saffron',
    chats: [
      [['a', '…and THEN the fog rolled in, and I heard it. The bell. Clear as anything.'],
       ['b', 'You always hear it, Howell.'],
       ['a', 'Because I have wolf ears.'],
       ['b', 'Sure. Wolf ears.'],
       ['a', '…You believe me, though.'],
       ['b', 'I always believe you. That’s the annoying part.']],
      [['b', 'Rate the sea bass.'],
       ['a', 'B minus.'],
       ['b', 'HA! EXACTLY. This is why we’re friends.']],
      [['a', 'AwooOOO.'],
       ['b', 'Closer to a whole note every day.'],
       ['a', 'I KNOW. I’ve been practicing on the cliffs.']],
    ],
    meetLines: {
      Howell: 'We are discussing WOLF business. Official wolf business. …She’s allowed, she’s a consultant.',
      Saffron: 'We’re gossiping. He calls it wolf business. Both things are true.',
    },
  },
  {
    a: 'Clover', b: 'Biscuit',
    chats: [
      [['a', 'I found a clover with FIVE leaves today.'],
       ['b', 'That’s just showing off.'],
       ['a', 'The clover, or me?'],
       ['b', 'Yes.']],
      [['b', 'I buried something great near the big rock. Or A big rock. Or possibly it was a stick.'],
       ['a', 'I LOVE a treasure hunt.'],
       ['b', 'Me too. I make them by accident.']],
      [['a', 'Nap by the flowers later?'],
       ['b', 'I’m already late for it.']],
    ],
    meetLines: {
      Clover: 'Biscuit’s telling me where he buried things! He doesn’t know either! It’s the best.',
      Biscuit: 'Strategy meeting. The strategy is naps.',
    },
  },
  {
    a: 'Puddle', b: 'Admiral Greenbean',
    chats: [
      [['b', 'Discipline, sailor. Three laps of the cove.'],
       ['a', 'Can they be small laps?'],
       ['b', '…Granted.']],
      [['a', 'I swam around the WHOLE island today!'],
       ['b', 'Puddle.'],
       ['a', '…most of a puddle.'],
       ['b', 'Logged as reported. Carry on.']],
    ],
    meetLines: {
      Puddle: 'I’m being TRAINED. It mostly involves snacks at the end.',
      'Admiral Greenbean': 'Officer development, sailor. The paper boat stays. It’s earned regimental status.',
    },
  },
  {
    a: 'Bramble', b: 'Ember',
    chats: [
      [['a', 'The cave hum. Louder lately?'],
       ['b', 'HAPPIER lately. Still B-flat, but warm about it.'],
       ['a', 'Good. Good. I worry, you know.'],
       ['b', 'It knows. It hums back politer when you sit outside.']],
      [['b', 'You’d love the acoustics in there.'],
       ['a', 'I’d block the acoustics in there.'],
       ['b', 'You’d give them something to work with.']],
    ],
    meetLines: {
      Bramble: 'We’re talking about the cave. Quietly. It might be listening, and it’s earned the courtesy.',
      Ember: 'Bear and salamander, solving geology. Nearly there.',
    },
  },
  {
    a: 'Butterpat', b: 'Crumb',
    chats: [
      [['b', 'Welcome to the north-shore branch of the MouseBoat trading empire.'],
       ['a', 'I brought grass.'],
       ['b', 'You ate the grass.'],
       ['a', 'I brought it somewhere safe, yes.']],
      [['a', 'Read me the plot again?'],
       ['b', 'You fell asleep at the good part last time.'],
       ['a', 'The company is the plot.']],
    ],
    meetLines: {
      Butterpat: 'Crumb is telling me about every harbor in the world. I have been to one field. We are equally happy.',
      Crumb: 'Trade negotiations. She pays in moo. The exchange rate is excellent.',
    },
  },
  {
    a: 'Mochi', b: 'Pondo',
    chats: [
      [['a', 'Mm.'],
       ['b', 'Mm.'],
       ['a', '…Well said.']],
      [['b', 'Spring four is the best one.'],
       ['a', 'They are all first.'],
       ['b', 'They are all first.']],
    ],
    meetLines: {
      Mochi: 'We are conversing. Do not be fooled by the silence. It is dense with content.',
      Pondo: '…Were we talking? Good. Good.',
    },
  },
  {
    a: 'Marigold', b: 'Butterpat',
    chats: [
      [['a', 'Race you to the fence!'], ['b', 'I’ll meet you there.'], ['a', 'That’s not a race.'], ['b', 'It is if I say “go” very slowly.']],
      [['b', 'The grass on your side any good?'], ['a', 'It’s grass. Good grass.'], ['b', 'That’s all I wanted to hear.']],
    ],
    meetLines: {
      Marigold: 'Pasture talk! Very technical. Mostly about grass.',
      Butterpat: 'We’re comparing meadows, dear. Hers is faster. Mine is calmer. Both are excellent.',
    },
  },
  {
    a: 'Sol', b: 'Brook',
    chats: [
      [['a', 'Warm today.'], ['b', '…'], ['a', 'Agreed.']],
      [['b', 'The birds did a good job this morning.'], ['a', 'They always do. We should tip more.'], ['b', 'We tip in shade.']],
    ],
    meetLines: {
      Sol: 'Crocodile business. Very slow. Very important.',
      Brook: '…(Brook smiles at you. That’s the whole meeting, from her side.)',
    },
  },
  {
    a: 'Penny', b: 'Mabel',
    chats: [
      [['b', 'I found a letter.'], ['a', 'Mabel, that’s MY letter. From the bag.'], ['b', 'I’m returning it.'], ['a', '…Thank you.'], ['b', 'HONK.']],
      [['a', 'Anything for the post today?'], ['b', 'A key, a glove, a gnome.'], ['a', 'That’s not mail.'], ['b', 'Not YET.']],
    ],
    meetLines: {
      Penny: 'Postal inspection. She returns everything she relocates. Eventually. It counts.',
      Mabel: 'We’re friends. She carries things, I carry things. HONK.',
    },
  },
  {
    a: 'Barb', b: 'Ruth',
    chats: [
      [['a', 'Look.'], ['b', 'Oh. Look.'], ['a', 'Hrm.']],
      [['b', 'I brought brownies.'], ['a', 'For the chocolate group?'], ['b', 'For us. The chocolate group asked me to stop.'], ['a', 'Good. More for the rock.']],
      [['a', 'Creek’s high today.'], ['b', 'Is it?'], ['a', 'No. I just like saying things to you.']],
    ],
    meetLines: {
      Barb: 'Hrm. We’re sitting. It’s a whole thing. Forty years of it.',
      Ruth: 'We’re watching the creek, dear. It does the same thing every day. That’s the charm.',
    },
  },
  {
    a: 'Null', b: 'Mabel',
    chats: [
      [['b', 'HONK.'], ['a', 'That’s my USB stick.'], ['b', 'It WAS your USB stick.'], ['a', '…Keep it safe.']],
      [['a', 'I’m in.'], ['b', 'In what?'], ['a', 'The conversation. I’m in the conversation.'], ['b', 'HONK.']],
      [['b', 'Found a key.'], ['a', 'What does it open?'], ['b', 'Don’t know yet. That’s the fun part.'], ['a', 'I could find out.'], ['b', 'DON’T.']],
    ],
    meetLines: {
      Null: 'We’re in a meeting. It’s encrypted. It’s mostly honking.',
      Mabel: 'We’re planning something. I don’t know what. She does. HONK.',
    },
  },
];

export const FRIEND_OF = {};
for (const f of FRIENDS) {
  FRIEND_OF[f.a] = f.b;
  FRIEND_OF[f.b] = f.a;
}

// what the sender says when they hand the parcel over
const ERRAND_ASKS = {
  Howell: 'Take this to Saffron, would you? It’s a rock that looks like a bell. She collects my best finds. As a CONSULTANT.',
  Saffron: 'Run this over to Howell? It’s an excellent stick. Tell him it’s a wolf stick. It’ll make his whole week.',
  Clover: 'Could you bring this to Biscuit? It’s four lucky clovers. He keeps losing his and I keep finding extras. The system works.',
  Biscuit: 'Take this to Clover? I dug it up and it SMELLS lucky. She’ll know what it is. She always knows.',
  Puddle: 'Would you take this to the Admiral?? It’s a medal I made him. It’s a shell on a string! Don’t tell him! Tell him!!',
  'Admiral Greenbean': 'Deliver this to Puddle, sailor. Official commendation for most improved laps. There’s a snack in it. The snack is the commendation.',
  Bramble: 'For Ember, when you’re passing. A very smooth stone, sun-warmed. I sat on it all morning to get it ready.',
  Ember: 'Bring this to Bramble? Cave moss. The good kind. He pretends he doesn’t keep a collection. The collection is labeled.',
  Butterpat: 'For Crumb, if you’re headed shoreward. Pressed flowers. Ship’s library needs SOME color that isn’t cheese.',
  Crumb: 'Run this to Butterpat? Crackers from three harbors over. She’s never had a cracker. This is an EVENT.',
  Mochi: 'Mm. For Pondo. (It is an orange. You may not ask further.)',
  Pondo: 'For Mochi, when the current takes you that way. Mm. No rush. There is never any rush.',
  Barb: 'Hrm. Take this to Ruth. A flat stone. The flattest. Don’t say it’s from me. She’ll know it’s from me.',
  Ruth: 'Would you bring this to Barb, dear? It’s a scarf. For her neck. She says she doesn’t need one. Her neck is very long, when she lets it out.',
  Null: 'Take this to Mabel? It’s a USB stick. She’s going to take it anyway. This way it’s a gift.',
  Mabel: 'HONK. Give this to the cat. It’s her other USB stick. I’m giving it back. Don’t make it weird.',
};

// what the recipient says when the parcel arrives
const DELIVERY_THANKS = {
  Barb: 'From Ruth? A scarf. Hrm. … It’s very long. It’s the right length. Tell her — no. I’ll tell her.',
  Ruth: 'A flat stone. The flattest one. This is from Barb. It doesn’t say so. It doesn’t need to.',
  Null: 'My other USB stick. From the goose. Returned. … Something is wrong. I’m checking the backups.',
  Mabel: 'A USB stick! From the cat! She GAVE it to me? … That’s no fun. I love it. HONK.',
  Howell: 'From Saffron? A WOLF STICK. …Tell her the wolf is extremely pleased. Use those words. EXTREMELY.',
  Saffron: 'A bell-shaped rock! That’s the fourth one. I keep them on the windowsill where he can see I keep them. Don’t tell him. He knows.',
  Clover: 'Oh, it smells SO lucky! Biscuit found this? Today really is a good day. I counted.',
  Biscuit: 'Lucky clovers!! From Clover!! I’m going to bury them somewhere GREAT and forget where. The luck compounds that way.',
  Puddle: 'A SNACK COMMENDATION! From the ADMIRAL! I’m framing the wrapper. After. After the snack.',
  'Admiral Greenbean': '…A medal. Shell, string, exemplary knotwork. (He puts it on immediately.) Inform the duck her form is improving. At ease.',
  Bramble: 'Cave moss. The good kind. …It goes in the collection. There is no collection. (There is. It’s labeled.)',
  Ember: 'A sun-warmed stone from Bramble! He pre-sits them, you know. Warmest friend in the archipelago. Literally. After me.',
  Butterpat: 'Crackers! From the sea! I shall eat them slowly over several days. (They are gone within the hour.)',
  Crumb: 'Pressed flowers for the ship’s library! Filed under F, for Friend.',
  Mochi: 'Mm. (The orange situation, you understand, continues.) Tell Pondo: well sent.',
  Pondo: 'Mm. (He balances it on his head next to nothing else, because Mochi wears the hat.) …Perfect.',
};

export function nameVillagers(animals) {
  animals.forEach((a, i) => {
    const id = IDENTITIES[i % IDENTITIES.length];
    a.identity = id;
    // the ones who ARE their place stay in it: they make the atmosphere where
    // they are. everyone else is a little random dude and may roam.
    a.anchored = ANCHORED.has(id.name);
    if (id.hat) applyHat(a.g, id.hat);
    let next = Math.floor(Math.random() * id.lines.length);
    let saidHoliday = false;
    register({
      getPos: () => a.g.position,
      r: a.long ? 3.4 : 2.6, // (a crocodile's face is a long way from its middle)
      enabled: () => !a.away, // when they're home, houses.js hosts the chat
      label: `talk to ${id.name}`,
      use: async () => {
        // a birthday outranks everything, including the holiday calendar
        if (await birthdayTalk(id.name, id.voice)) return;
        // mid-hobby? they'll say so (and keep at it)
        if (a.pastime && a.busy) {
          ui.say(a.pastime.kind === 'fish' ? pick(FISHING_LINES) : pick(NETTING_LINES), { speaker: id.name, voice: id.voice });
          return;
        }
        if (HOLIDAY && !saidHoliday) {
          saidHoliday = true;
          ui.say(HOLIDAY_LINES[HOLIDAY.id], { speaker: id.name, voice: id.voice });
          return;
        }
        // a parcel with their name on it beats small talk
        if (S.state.errand?.to === id.name && S.countItem('parcel') === 0) {
          // (left it in the wardrobe? no parcel, no delivery)
          ui.say(`Is that… no. I thought for a second you had something for me. From ${S.state.errand.from}, maybe.`, { speaker: id.name, voice: id.voice });
          return;
        }
        if (S.state.errand?.to === id.name) {
          const from = S.state.errand.from;
          S.removeItem('parcel');
          S.state.errand = null;
          S.state.lastErrandAt = Date.now();
          const reward = 120 + Math.floor(Math.random() * 4) * 20;
          S.earn(reward);
          jingle();
          await ui.say(DELIVERY_THANKS[id.name] ||
            `Oh — from ${from}? Carried all this way? You’re a good one.`,
            { speaker: id.name, voice: id.voice });
          ui.toast(`${id.name} tucked <b>${reward} buttons</b> into your paw for the trouble.`, '🔘');
          ui.updateHUD();
          return;
        }
        if (S.state.errand?.from === id.name) {
          ui.say('Still got it? Good, good. No rush. …Some rush.',
            { speaker: id.name, voice: id.voice });
          return;
        }
        // maybe there's a parcel that needs legs (two a day; friendship paces itself)
        const friend = FRIEND_OF[id.name];
        if (!S.state.errand && friend && ERRAND_ASKS[id.name] &&
            S.dailyCount('errands') < 2 &&
            Date.now() - (S.state.lastErrandAt || 0) > 240000 && Math.random() < 0.3) {
          const yes = await ui.ask(ERRAND_ASKS[id.name], [
            { label: '🎁 Of course', value: 'yes' },
            { label: 'Maybe later', value: null },
          ], { speaker: id.name, voice: id.voice });
          if (yes) {
            S.state.errand = { from: id.name, to: friend };
            S.bumpDaily('errands');
            S.addItem('parcel');
            jingle();
            ui.toast(`Got <b>A Small Parcel</b> for <b>${friend}</b>! They’ll be around — somewhere.`, '🎁');
          } else {
            ui.say('No no, fair enough. It keeps. Friendship keeps.', { speaker: id.name, voice: id.voice });
          }
          return;
        }
        const line = id.lines[next];
        next = (next + 1) % id.lines.length;
        ui.say(line, { speaker: id.name, voice: id.voice });
      },
    });
  });
}
