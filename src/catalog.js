// Everything you can catch, dig, find, buy, or be told on Notbell Isle.
// Pure data — no three.js, no DOM — so it's easy to balance and extend.

// ---------------------------------------------------------------- items ----
// kind: fish | bug | fossil | pool | tool | keepsake
// price: what Pip pays you (or charges, for tools)

export const ITEMS = {
  // -- fish -------------------------------------------------------------
  sea_bass: {
    kind: 'fish', size: 'l', name: '농어', emoji: '🐟', price: 45, weight: 26,
    blurb: '아니, 잠만 — 이건 최소 B+야.',
  },
  crumb_snapper: {
    kind: 'fish', size: 's', name: '부스러기 도미', emoji: '🐠', price: 60, weight: 24,
    blurb: '부스러기에 달려드는 물고기. 솔직히? 완전 공감.',
  },
  pebble_dab: {
    kind: 'fish', size: 'm', name: '조약돌 가자미', emoji: '🐟', price: 90, weight: 18,
    blurb: '납작한 작은 물고기. 최선을 다하는 중이에요.',
  },
  buttonfish: {
    kind: 'fish', size: 's', name: '단추고기', emoji: '✨', price: 160, weight: 12,
    blurb: '비늘이 자개 단추 같아요. 살아 있는 경제예요.',
  },
  glimmer_trout: {
    kind: 'fish', size: 'l', name: '반짝 송어', emoji: '🌟', price: 280, weight: 8,
    blurb: '물 밖에서도 반짝여요. 자랑쟁이.',
  },
  moonbeam_eel: {
    kind: 'fish', size: 'l', where: 'cave', name: '달빛 장어', emoji: '🌙', price: 450, weight: 20,
    blurb: '뭔가 아는 것처럼 희미하게 빛나요. 빛이 잠드는 곳에 살아요. 정말 아는 거예요.',
  },
  old_boot: {
    kind: 'fish', name: '낡은 장화', emoji: '🥾', price: 2, weight: 8,
    blurb: '어딘가의 누군가가 한쪽 발로 깡충깡충 뛰고 있어요.',
  },
  tide_nibbler: {
    kind: 'fish', size: 's', name: '물결 갉이', emoji: '🐟', price: 50, weight: 26,
    blurb: '물결을 갉아 먹어요. 물결은 아직 모르는 눈치예요.',
  },
  sand_flounder: {
    kind: 'fish', size: 'm', name: '모래 넙치', emoji: '🐟', price: 110, weight: 13,
    blurb: '두 눈이 같은 쪽에 있어서, 당신을 두 번 평가할 수 있어요.',
  },
  sunset_drum: {
    kind: 'fish', size: 'm', name: '노을 북고기', emoji: '🥁', price: 200, weight: 7,
    blurb: '황혼에 콧노래를 불러요. 아무도 가르쳐 준 적 없는데, 모두가 응원해요.',
  },

  // cave pond residents (the still pond keeps its own guest list)
  blind_cavefish: {
    kind: 'fish', size: 'm', where: 'cave', name: '눈먼 동굴고기', emoji: '🐠', price: 320, weight: 30,
    blurb: '평생 아무것도 본 적 없지만, 아주 잘 지내요.',
  },
  pale_crayfish: {
    kind: 'fish', size: 's', where: 'cave', name: '창백 가재', emoji: '🦞', price: 180, weight: 34,
    blurb: '주관과 집게발을 갖춘 작은 유령.',
  },
  lantern_koi: {
    kind: 'fish', size: 'l', where: 'cave', name: '등불 잉어', emoji: '🏮', price: 800, weight: 8,
    blurb: '옛 등대 불빛처럼 빛나요. 루나가 알면 울 거예요. 루나한테는 비밀. 루나한테 말해 줘.',
  },

  // -- bugs ---------------------------------------------------------------
  lemon_flit: {
    kind: 'bug', name: '레몬 팔랑이', emoji: '🦋', price: 80,
    blurb: '레모네이드 색 나비. 맛은 없어요. 묻지 마세요.',
  },
  paper_wisp: {
    kind: 'bug', name: '종이 나방', emoji: '🤍', price: 60,
    blurb: '날기를 배운 러브레터 같아요.',
  },
  rose_skipper: {
    kind: 'bug', name: '장미 깡충이', emoji: '🌸', price: 90,
    blurb: '돌멩이처럼 깡충 뛰고, 꽃잎처럼 내려앉아요.',
  },
  sky_dancer: {
    kind: 'bug', name: '하늘 무용수', emoji: '💙', price: 120,
    blurb: '아무도 안 볼 때 연습해요. (당신이 보고 있었어요.)',
  },
  buttonshell_beetle: {
    kind: 'bug', name: '단추등 딱정벌레', emoji: '🪲', price: 200,
    blurb: '등껍질에 구멍이 반듯하게 네 개. 핍은 이에 대해 언급을 거부해요.',
  },
  dewdrop_dragonfly: {
    kind: 'bug', name: '이슬 잠자리', emoji: '🪰', price: 140,
    blurb: '다리미를 켜 두고 온 것처럼 불안하게 맴돌아요.',
  },
  garden_snail: {
    kind: 'bug', name: '정원 달팽이', emoji: '🐌', price: 50,
    blurb: '집을 짊어지고 다니고, 월세도 안 내요. 솔직히 롤모델이에요.',
  },
  ladybird: {
    kind: 'bug', name: '무당벌레', emoji: '🐞', price: 90,
    blurb: '긴장하면 자기 점을 세는 버릇이 있어요.',
  },
  meadow_cricket: {
    kind: 'bug', name: '초원 귀뚜라미', emoji: '🦗', price: 70,
    blurb: '보기 훨씬 전부터 소리가 들려요. 본인은 이게 좋대요.',
  },
  cave_glimmerwing: {
    kind: 'bug', name: '동굴 반짝날개', emoji: '🦋', price: 450,
    blurb: '동굴을 한 번도 떠나지 않은 창백한 나방. 루나가 편지를 써요.',
  },
  lantern_firefly: {
    kind: 'bug', name: '등불 반딧불이', emoji: '✨', price: 300,
    blurb: '옛 빛의 조그만 조각, 프리랜서예요. 야간 근무 전용.',
  },

  // -- beachcombing (the tide brings these in — shells.js) --------------------
  cowrie: {
    kind: 'shell', name: '보리패', emoji: '🐚', price: 18,
    blurb: '사탕처럼 반질반질해요. 옛날엔 이걸 돈으로 썼대요. 단추들이 이해해요.',
  },
  scallop: {
    kind: 'shell', name: '가리비 껍데기', emoji: '🐚', price: 22,
    blurb: '작은 손처럼 활짝 펼쳐져, 바다 전체가 인사하는 것 같아요.',
  },
  sand_dollar: {
    kind: 'shell', name: '모래 달러', emoji: '🪙', price: 40,
    blurb: '바다 자체 화폐. 핍은 받아 주지 않아요. 환율을 확인해 봤는데 마음에 안 들었대요.',
  },
  sea_glass: {
    kind: 'shell', name: '바다 유리', emoji: '💎', price: 55,
    blurb: '언젠가는 병이었어요. 바다는 모든 걸 다정함으로 갈아 버려요.',
  },
  conch: {
    kind: 'shell', name: '소라', emoji: '🐚', price: 140,
    blurb: '귀에 대면 바다 소리. 바다에 대면 당신 귀의 메아리.',
  },

  pearl: {
    kind: 'shell', name: '왕관 진주', emoji: '🫧', price: 300,
    blurb: '떨어진 왕관에 사는 대왕조개가 만들어요. 하루에 정확히 하나, 한 번도 늦은 적 없어요.',
  },

  // -- starfall (starfall.js) --------------------------------------------------
  star_fragment: {
    kind: 'star', name: '별 조각', emoji: '🌟', price: 420,
    blurb: '떨어지다 잡혀서 아직 따뜻해요. 들리기 직전의 음을 흥얼거려요. 소원을 빌어 보세요. 서류는 갖춰져 있어요.',
  },
  stardust: {
    kind: 'star', name: '별가루', emoji: '✨', price: 95,
    blurb: '아무도 받아 주지 못한 별이 남긴 것. 조금 슬퍼요. 아주 반짝여요. 사실 거의 반짝임이에요.',
  },

  // -- fossils --------------------------------------------------------------
  trilobutton: {
    kind: 'fossil', name: '삼엽단추', emoji: '🦴', price: 420,
    blurb: '단추처럼 몸을 만 고대 바다 벌레. 유행은 돌고 돌아요.',
  },
  curlstone: {
    kind: 'fossil', name: '소용돌이돌', emoji: '🐚', price: 340,
    blurb: '아직 이름 없는 바다에서 온 소라 화석.',
  },
  megalodont_tooth: {
    kind: 'fossil', name: '메갈로돈 아닌 이빨', emoji: '🦷', price: 650,
    blurb: '너무 커서 바다가 제발 그러지 말라고 한 상어의 이빨.',
  },
  fern_frond: {
    kind: 'fossil', name: '고사리잎 화석', emoji: '🌿', price: 320,
    blurb: '돌에 눌려 있는 완벽한 고사리. (펀과는 무관해요. 아마도요.)',
  },
  very_old_pebble: {
    kind: 'fossil', name: '아주 오래된 조약돌', emoji: '🪨', price: 30,
    blurb: '조약돌이에요. 아주 오래됐어요. 그래도 펀은 분명 갖고 싶어할 거예요.',
  },

  // -- tide pool finds ------------------------------------------------------
  hermit_crab: {
    kind: 'pool', name: '소라게', emoji: '🦀', price: 120,
    blurb: '파티에 집을 들고 온 녀석이에요.',
  },
  sea_star: {
    kind: 'pool', name: '불가사리', emoji: '⭐', price: 90,
    blurb: '팔 다섯 개짜리 포옹. 살짝 축축해요.',
  },
  wiggleblossom: {
    kind: 'pool', name: '꼬물꽃', emoji: '🪸', price: 150,
    blurb: '손을 흔들어 답해 주는 말미잘. 먼저 흔드는 게 예의예요.',
  },
  pearl_periwinkle: {
    kind: 'pool', name: '진주 고둥', emoji: '🐚', price: 150,
    blurb: '자기 자신에 대한 평가가 아주 높은 작은 고둥.',
  },
  tidepool_octopus: {
    kind: 'pool', name: '조수 웅덩이 문어', emoji: '🐙', price: 600,
    blurb: '한번 색깔을 맛본 적 있지만, 어느 색인지 아무에게도 안 알려 줬어요.',
  },

  // -- tools (bought at Pip's) ---------------------------------------------
  rod:    { kind: 'tool', name: '유목 낚싯대', emoji: '🎣', price: 0,
            blurb: '모험 냄새가 나고, 장어 냄새도 살짝 나요.' },
  net:    { kind: 'tool', name: '민들레 채집망', emoji: '🥅', price: 280,
            blurb: '소원만큼 가벼워요. 살살 휘두르세요.' },
  shovel: { kind: 'tool', name: '뭉툭 삽', emoji: '🪏', price: 450,
            blurb: '과거를 정중하게 파내는 용도예요.' },

  // -- gear ------------------------------------------------------------------
  scuba_suit: {
    kind: 'gear', name: '인양 잠수복', emoji: '🤿', price: 1800,
    blurb: '잠수복, 물안경, 스노클 세트. 탠지의 잠수부 중 한 명이 두고 갔어요. 종은 못 찾았지만, 나머지는 전부 찾았대요.',
  },

  skateboard: {
    kind: 'gear', name: '핍의 스케이트보드', emoji: '🛹', price: 1400,
    blurb: '바퀴 넷, 판자 하나, 브레이크 제로. 달리기를 유지하면 스케이팅. 섬에는 언덕이 있고, 그 언덕에 대한 섬의 의견도 있어요.',
  },

  // -- garden & orchard -----------------------------------------------------
  blueberries: {
    kind: 'fruit', name: '블루베리', emoji: '🫐', price: 12,
    blurb: '연구소 주변 덤불에서 따 왔어요. 심은 사람도, 공을 인정하는 사람도 없어요. 연구소가 조사 중이에요.',
  },
  labs_mug: {
    kind: 'keepsake', name: '낫벨 연구소 머그', emoji: '☕', price: 0,
    blurb: '“I ♥ RESEARCH.” 하트가 작은 종 모양이에요. 종은 작은 농담이고, 커피는 진짜예요.',
  },
  labs_tee: {
    kind: 'keepsake', name: '낫벨 연구소 티셔츠', emoji: '👕', price: 0,
    blurb: '“낫벨 연구소에 갔다 왔는데 얻은 건 이 티셔츠뿐 (그리고 약간의 우주적 관점).”',
  },
  rocket_plush: {
    kind: 'keepsake', name: '로켓 인형', emoji: '🚀', price: 0,
    blurb: '부드럽고, 솜이 들어 있고, 완전히 무동력이에요. 달에 간 횟수는 당신과 정확히 같아요. 글쎄요 — 경우에 따라.',
  },
  dirt_globe: {
    kind: 'keepsake', name: '버로 흙 스노우볼', emoji: '🔮', price: 0,
    blurb: '흔들면 작은 흙 폭풍이 자그마한 롬 스트리트 주변을 휘몰아쳐요. 그리고 가라앉아요. 언제나 가라앉아요. 그게 기념품이에요.',
  },
  daily_dirt: {
    kind: 'keepsake', name: '데일리 더트', emoji: '🗞️', price: 0,
    blurb: '“파낼 가치가 있는 모든 뉴스.” 1면은 화제의 지렁이 기사. 2면에서 9면까지도 화제의 지렁이 기사예요.',
  },
  sunfruit: {
    kind: 'fruit', name: '햇살 열매', emoji: '🍊', price: 15,
    blurb: '그늘에서도 따뜻해요. 이곳 나무들은 너그러워요.',
  },
  orange: {
    kind: 'fruit', name: '오렌지', emoji: '🍊', price: 20,
    blurb: '그로브 섬산 감귤. 카피바라들이 모자로 쓰는데, 그것도 일종의 평가예요.',
  },
  peach: {
    kind: 'fruit', name: '복숭아', emoji: '🍑', price: 25,
    blurb: '그로브 섬 남쪽의 핵과류. 해가 대부분의 일을 했고, 본인도 인정해요.',
  },
  carrot_seeds: { kind: 'seed', name: '당근 씨앗', emoji: '🌱', price: 30,
    blurb: '당근이라고 주장하는 씨앗. 포장지가 아주 확신에 차 있어요.' },
  tomato_seeds: { kind: 'seed', name: '토마토 씨앗', emoji: '🌱', price: 45,
    blurb: '과일? 채소? 섬은 어느 편도 들지 않아요.' },
  pumpkin_seeds: { kind: 'seed', name: '호박 씨앗', emoji: '🌱', price: 80,
    blurb: '하나 심고, 뒤로 물러서세요.' },
  carrot: { kind: 'produce', name: '당근', emoji: '🥕', price: 90,
    blurb: '방금 뽑았어요. 비스킷은 벌써 알고 있어요. 아무도 말 안 했는데, 알아요.' },
  tomato: { kind: 'produce', name: '토마토', emoji: '🍅', price: 120,
    blurb: '햇살에 데워져서 그게 으스대요.' },
  pumpkin: { kind: 'produce', name: '호박', emoji: '🎃', price: 240,
    blurb: '가구로 써도 될 만큼 커요. 가구로 만들지는 마세요.' },

  // -- hats (worn, not sold back — Pip says hats are "non-refungible") -------
  knit_cap: { kind: 'hat', name: '뜨개 모자', emoji: '🧢', price: 140,
    blurb: '누군가 사랑과 살짝 과한 실로 뜬 모자예요.' },
  straw_hat: { kind: 'hat', name: '밀짚모자', emoji: '👒', price: 220,
    blurb: '여름 냄새가 나고, 오리 냄새도 살짝 나요.' },
  party_cone: { kind: 'hat', name: '파티 고깔', emoji: '🎉', price: 120,
    blurb: '어딘가에서는 늘 누군가의 생일이에요.' },
  flower_crown: { kind: 'hat', name: '꽃 화관', emoji: '🌼', price: 260,
    blurb: '나비들이 당신을 관리자라고 생각할 거예요.' },
  keepers_cap: { kind: 'hat', name: '등대지기 모자', emoji: '⚓', price: 2600,
    blurb: '진품이에요. 펀이 감정하고 울었는데, 안 울었다고 해요.' },
  captains_cap: { kind: 'hat', name: '선장 모자', emoji: '⚓', price: 0,
    blurb: '그린빈 제독의 소유. 노력으로 얻은 거예요, 선원.' },
  paper_boat: { kind: 'hat', name: '종이배', emoji: '⛵', price: 0,
    blurb: '퍼들의 것. 네 번 가라앉았지만, 기백으로 떠 있어요.' },
  leaf_hat: { kind: 'hat', name: '큰 잎사귀', emoji: '🍃', price: 0,
    blurb: '브램블의 것. 그냥 잎사귀예요. 본인은 아주 자랑스러워해요.' },
  orange_hat: { kind: 'hat', name: '오렌지 한 알', emoji: '🍊', price: 0,
    blurb: '모찌의 것. 오렌지 상황이 그냥 발생했고, 받아들여졌어요.' },

  // -- art prints (sold at the café, at home in the museum) -------------------
  art_scream: { kind: 'art', name: '《절규》(판화)', emoji: '🖼️', price: 750,
    blurb: '뭉크 원작. 액자는 진품일지도 몰라요. 절규는 보편적이에요.' },
  art_dance: { kind: 'art', name: '《춤》(판화)', emoji: '🖼️', price: 750,
    blurb: '마티스 원작. 나방이 인정한 안무예요.' },
  art_autumn: { kind: 'art', name: '《황금빛 가을》(판화)', emoji: '🖼️', price: 750,
    blurb: '레비탄 원작. 펀의 최애. 그에 맞게 취급하세요.' },
  art_wave: { kind: 'art', name: '《큰 파도》(판화)', emoji: '🖼️', price: 750,
    blurb: '호쿠사이 원작. 제독은 볼 때마다 경례해요.' },
  art_swirl: { kind: 'art', name: '《별이 소용돌이치는 밤》(판화)', emoji: '🖼️', price: 750,
    blurb: '어떤 불안한 네덜란드인 원작. 밤하늘, 그 이상이에요.' },
  art_pearl: { kind: 'art', name: '《단추 귀걸이를 한 소녀》(판화)', emoji: '🖼️', price: 750,
    blurb: '베르메르 원작, 현지화판. 귀걸이가 단추라고 핍이 우겨요. 핍은 편향적이에요.' },
  art_sunflowers: { kind: 'art', name: '《해바라기》(판화)', emoji: '🖼️', price: 750,
    blurb: '고흐 원작. 클로버가 두 번이나 물을 주려 했어요.' },
  art_square: { kind: 'art', name: '《정사각형》(판화)', emoji: '🖼️', price: 750,
    blurb: '말레비치 원작. 하웰이 한 시간 쳐다보다가 “나도.”라고 했어요.' },
  art_wanderer: { kind: 'art', name: '《안개 위의 방랑자》(판화)', emoji: '🖼️', price: 750,
    blurb: '프리드리히 원작. 듣는 이들은 다큐멘터리라고 여겨요.' },
  art_lilies: { kind: 'art', name: '《수련》(판화)', emoji: '🖼️', price: 750,
    blurb: '모네 원작. 모찌가 정신적으로 들어가 있어요.' },
  art_jatte: { kind: 'art', name: '《섬의 어느 일요일》(판화)', emoji: '🖼️', price: 750,
    blurb: '쇠라 원작. 점을 세어 보세요. 루나는 했어요.' },
  art_redfuji: { kind: 'art', name: '《붉은 후지》(판화)', emoji: '🖼️', price: 750,
    blurb: '호쿠사이 원작. 아주 좋은 아침의 산이에요.' },
  art_smile: { kind: 'art', name: '《미소》(판화)', emoji: '🖼️', price: 750,
    blurb: '레오나르도 원작. 눈은 따라오고, 미소는 머물러요.' },
  art_temeraire: { kind: 'art', name: '《마지막 예인》(판화)', emoji: '🖼️', price: 750,
    blurb: '터너 원작. 예인선, 유령선, 그리고 다 아는 노을.' },
  art_sleeper: { kind: 'art', name: '《잠든 여행자》(판화)', emoji: '🖼️', price: 750,
    blurb: '루소 원작. 사자는 그냥 확인하는 중이에요.' },

  // -- BULKO exclusives -------------------------------------------------------
  parm_wheel: {
    kind: 'produce', name: '대용량 파마산 치즈 휠', emoji: '🧀', price: 220,
    blurb: '주머니에 안 들어가요. 이제 그냥 갖고 다니는 거예요.',
  },

  // -- keepsakes -------------------------------------------------------------
  bottle_note: {
    kind: 'keepsake', name: 'T.의 편지', emoji: '📜', price: 0,
    blurb: '바다에 부드러워진 종이, 정성스러운 글씨.',
  },
  shiny_button: {
    kind: 'keepsake', name: '가장 반짝이는 단추', emoji: '🔘', price: 0,
    blurb: '핍의 최애. 핍의 아주아주 최애.',
  },
  first_invoice: {
    kind: 'keepsake', name: '청구서 1호', emoji: '🧾', price: 0,
    blurb: '“여름 한(1) 철 잠수. 종: 미발견. 전액 지급 완료.” 한 재산의 창립 문서예요.',
  },
  half_button: {
    kind: 'keepsake', name: '반쪽 단추', emoji: '🌗', price: 0,
    blurb: '1.5단추짜리 핫도그의 거스름돈. 어디서도 법정 화폐 아님. 영원히 소중함.',
  },
  // the milk cooler's wares — keepsakes, because Pip does not deal dairy
  milk_choco: {
    kind: 'keepsake', name: '초콜릿 우유', emoji: '🍫', price: 0,
    blurb: '코코아의 것. 초콜릿 우유는 맛이 아니라 감정이에요. 여덟 살의 감정.',
  },
  milk_straw: {
    kind: 'keepsake', name: '딸기 우유', emoji: '🍓', price: 0,
    blurb: '선데이의 것. 속까지 새빨개요. 딸기 넣기도 아까워해요.',
  },
  milk_oat: {
    kind: 'keepsake', name: '귀리 음료', emoji: '🌾', price: 0,
    blurb: '발리의 것. 우유가 아니라 음료예요. 차이가 있어요. 설명은 안 해 줘요.',
  },
  milk_plain: {
    kind: 'keepsake', name: '우유', emoji: '🥛', price: 0,
    blurb: '평범한 우유. 불코 역사상 가장 느긋한 직원들이 만들어요.',
  },
  eggs: {
    kind: 'keepsake', name: '달걀 한 판', emoji: '🥚', price: 0,
    blurb: '회색 종이판에 열두 알. 그중 하나는 갈색이고, 자기가 특별하다는 걸 알아요.',
  },
  yogurt: {
    kind: 'keepsake', name: '요구르트 컵', emoji: '🍶', price: 0,
    blurb: '복숭아가 바닥에 깔려 있어요. 섞어 먹으라는 뜻이에요. 안 섞을 거지만요.',
  },
  butter: {
    kind: 'keepsake', name: '버터 한 덩이', emoji: '🧈', price: 0,
    blurb: '가염. 모서리를 접어 넣은 왁스 종이 포장이, 나에게 주는 선물 같아요.',
  },
  cheese_wheel: {
    kind: 'keepsake', name: '작은 치즈 휠', emoji: '🧀', price: 0,
    blurb: '작고 둥근 왁스 코팅 치즈. 당신의 계획 몇 개보다 오래 살아남을 거예요.',
  },
  parcel: {
    kind: 'keepsake', name: '작은 소포', emoji: '🎁', price: 0,
    blurb: '정성스러운 발글씨로 적힌 주소. 당신 것이 아니고, 무겁지도 않고, 흔들어 보는 것도 안 돼요.',
  },
  // the Farther General's shelf — camp goods, tide-tested
  marshmallows: {
    kind: 'keepsake', name: '마시멜로', emoji: '🍡', price: 0,
    blurb: '구름 한 봉지, 캠프파이어 등급. 좀처럼 줄지 않는데, 모닥불 곁의 그 누구도 이상하게 여기지 않아요.',
  },
  camp_mug: {
    kind: 'keepsake', name: '법랑 캠핑 머그', emoji: '☕', price: 0,
    blurb: '물방울 무늬 파랑, 찌그러짐 딱 한 군데. 이 컵으로 마시면 뭐든 15퍼센트 더 맛있어요. 찌그러짐이 구조적으로 중요해요.',
  },
  trail_mix: {
    kind: 'keepsake', name: '트레일 믹스', emoji: '🥜', price: 0,
    blurb: '땅콩, 건포도, 해바라기씨, 그리고 오후를 넘기지 못할 용감한 소수의 초콜릿 조각.',
  },
  bug_spray: {
    kind: 'keepsake', name: '벌레 퇴치 스프레이', emoji: '🧴', price: 0,
    blurb: '“모기는 쫓아내고, 칭찬은 끌어모은다.” 시트로넬라와 누군가의 할머니 댁 현관 냄새.',
  },
  third_bean: {
    kind: 'keepsake', name: '세 번째 콩 통조림', emoji: '🥫', price: 0,
    blurb: '라벨 없음. 사이프러스는 말해 주지 않아요. 예상보다는 잘하고 있어요.',
  },
  compass: {
    kind: 'keepsake', name: '황동 나침반', emoji: '🧭', price: 0,
    blurb: '북쪽을 가리켜요. 대체로요. 여기서는 가끔 모닥불을 가리키는데, 그것도 방향이긴 해요.',
  },
  camp_lantern: {
    kind: 'keepsake', name: '캠핑 랜턴', emoji: '🏮', price: 0,
    blurb: '양철과 유리, 살짝 찌그러짐. 허락해 주면 수면등이 되고 싶어 해요.',
  },
  flashlight: {
    kind: 'gear', name: '손전등', emoji: '🔦', price: 0,
    blurb: '묵직하고 좋은 놈이에요. 어두워지면 코를 향하는 곳마다 빛 웅덩이를 만들어 줘요.',
  },
  postcard_farther: {
    kind: 'keepsake', name: '파더 섬 엽서', emoji: '🏝️', price: 0,
    blurb: '“네가 더 멀리 있었으면.” 노을 속 맹그로브, 살짝 과노출.',
  },
  // the Fold's preserves — the Cod provides; Mercy provides lids
  preserves_goose: {
    kind: 'keepsake', name: '구스베리 잼', emoji: '🫙', price: 0,
    blurb: '새콤, 달콤, 순삭. 라벨은 손글씨인데 자기가 살짝 자랑스러워해요.',
  },
  preserves_carrot: {
    kind: 'keepsake', name: '당근 마멀레이드', emoji: '🥕', price: 0,
    blurb: '당근이 달아도 될 수준이 아니에요. 페이션스가 기르고, 머시가 병에 담았어요. 대구께서 주셨어요.',
  },
  preserves_plum: {
    kind: 'keepsake', name: '해안 자두 잼', emoji: '🫐', price: 0,
    blurb: '서쪽 해안 울타리의 자두로 만들었어요. 날씨 맛이 살짝 나요.',
  },
  lightseed: {
    kind: 'keepsake', name: '빛의 씨앗', emoji: '🌟', price: 0,
    blurb: '옛 빛의 따뜻한 불씨가 주머니에서 졸고 있어요. 천 척의 배를 집으로 이끌었어요. 한 번쯤 반대 방향으로 가 보고 싶어 해요.',
  },
  bubble_helmet: {
    kind: 'keepsake', name: '버블 헬멧', emoji: '🫧', price: 0,
    blurb: '망상과 특허 세 개를 갖춘 어항. 오후 한나절 분의 공기와 알려진 모든 모자 사이즈 대응. 활짝 웃으면 김이 서려요.',
  },
  gold_star: {
    kind: 'keepsake', name: '금별 스티커', emoji: '⭐', price: 0,
    blurb: '피니언 양의 스티커판에서 떼었어요. 달에서는 화폐예요. 어디서든, 화폐보다 나아요.',
  },

  // -- from the sky (the dust sea gives them up to a patient magnet) ---------
  moon_rock: {
    kind: 'meteor', name: '달 바위', emoji: '🌑', price: 60,
    blurb: '로버가 직접 검토하고 훌륭하다고 판정. 달의 모든 바위는 직접 검토된 바 있어요.',
  },
  iron_meteorite: {
    kind: 'meteor', name: '철 운석', emoji: '☄️', price: 380,
    blurb: '묵직하고 정직한 금속. 40억 년을 여행해 로버에게 냉장고 자석 테스트를 받았어요.',
  },
  stony_chondrite: {
    kind: 'meteor', name: '콘드라이트', emoji: '🪨', price: 260,
    blurb: '초기 태양계의 얼룩 푸딩. 로버들은 얼룩을 “스프링클”이라 부르고, 학술지는 고치기를 포기했어요.',
  },
  starglass: {
    kind: 'meteor', name: '별유리 팔라사이트', emoji: '✨', price: 720,
    blurb: '철 레이스에 감람석 창이 박혀 있어요. 빛에 들어 올리면 작고 초록빛 새벽이 보여요.',
  },
  moonpearl: {
    kind: 'meteor', name: '달진주', emoji: '🪩', price: 520,
    blurb: '먼지가 녹아 뭉친 완벽하게 둥근 조약돌. 먼지 바다는 아무도 안 볼 때 10년에 하나씩 만들어요. 아무도 안 보고 있었어요.',
  },
  meteoric_button: {
    kind: 'meteor', name: '운석 단추', emoji: '🔘', price: 1500,
    blurb: '섬 이전 시대의 구멍 네 개짜리 철 원판. 핍은 절대 몰라야 해요. 핍한테 당장 말해 줘요.',
  },
  // Oasis Estates — Trader Polly's (the Captain's picks)
  ebtb_seasoning: {
    kind: 'keepsake', name: '종 빼고 다 있는 시즈닝', emoji: '🧂', price: 0,
    blurb: '참깨, 양귀비씨, 마늘, 양파, 소금. 전부요. 종은 아니에요. 라벨이 종에 대해선 아주 명확해요.',
  },
  cookie_butter: {
    kind: 'keepsake', name: '쿠키 버터', emoji: '🍯', price: 0,
    blurb: '쿠키를 갈아서 스프레드로 만든, 인생에 한 번만 떠오르는 종류의 아이디어. 숟가락으로 퍼서, 서서, 냉장고 불빛 아래서 드세요.',
  },
  two_button_chuck: {
    kind: 'keepsake', name: '투버튼 척', emoji: '🧃', price: 0,
    blurb: '아주 진지한 병에 담긴 스파클링 포도주스. 라벨은 아무도 가 본 적 없는 포도밭 그림. 보라색 맛이에요.',
  },
  dried_mango: {
    kind: 'keepsake', name: '말린 망고', emoji: '🥭', price: 0,
    blurb: '쫄깃하고 달아요. 다만 망고 선장이라는 앵무새한테 사기가 좀 어색해요. 말없이 계산해 주지만, 뭔가 대가를 치르는 중이에요.',
  },
  fearless_feather: {
    kind: 'keepsake', name: '두려움 없는 깃털', emoji: '📰', price: 0,
    blurb: '상인 폴리의 뉴스레터. 목판화 앵무새, 말장난, 그리고 “왜 종이 없는가? (선장의 편지)”라는 칼럼이 실려요. 답은 없어요.',
  },
  // Dromedeals (brand names, one hump or two)
  live_laugh_lounge: {
    kind: 'keepsake', name: '“살고 웃고 쉬고” 액자', emoji: '🪧', price: 0,
    blurb: '휘감은 글씨로 칠한 판자. 오아시스 에스테이츠 모든 집이 같은 자리에 걸어 뒀어요. 이제 당신 집도 맞출 수 있어요. 비교가: 240🔘.',
  },
  ceramic_pineapple: {
    kind: 'keepsake', name: '도자기 파인애플', emoji: '🍍', price: 0,
    blurb: '금색, 유약 처리, 보기보다 무겁고, 이유 없이 속이 비었어요. “환영”이라는 뜻이에요. “우리 드로미딜스 갔다 왔다”는 뜻이기도 해요. 비교가: 180🔘.',
  },
  candle_sand: {
    kind: 'keepsake', name: '캔들 (향: “모래”)', emoji: '🕯️', price: 0,
    blurb: '정확히 모래 냄새. 구체적으로 따뜻한 모래. 낙타 한 마리가 가게에서 켜 봤다가 아무도 가 본 적 없는 곳의 향수병에 걸렸어요. 비교가: 90🔘.',
  },
  tennis_visor: { kind: 'hat', name: '테니스 바이저', emoji: '🧢', price: 0,
    blurb: '빳빳한 흰 바이저. 오아시스 에스테이츠 몰 워킹 룩. 여기선 아무도 테니스를 안 쳐요. 비교가: 900🔘.' },
  // Mirage Coffee (coffee, probably)
  mirage_cup: {
    kind: 'keepsake', name: '미라지 컵 (당신 이름, 거의)', emoji: '🥤', price: 0,
    blurb: '초록 빨대가 꽂힌 빈 플라스틱 컵, 옆면엔 앵무새가 들은 대로 적은 당신 이름. 버리기엔 아깝고, 갖고 있기엔 끈적여요. 갖고 있어요.',
  },
  // Cluck & Co. (it's our pleasure)
  cluck_nuggets: {
    kind: 'keepsake', name: '클럭 너겟 (8개입)', emoji: '🍗', price: 0,
    blurb: '노릇하고 바삭해요. 코팅 카드에 따르면 “치킨(?)”인데, 닭고기는 들어간 적 없어요. 정체는 아무도 몰라요. 맛있다는 건 모두가 알아요.',
  },
  waffle_fries: {
    kind: 'keepsake', name: '와플 프라이', emoji: '🍟', price: 0,
    blurb: '격자 모양 감자. 감자 역사상 최고의 형태이고, 감자도 동의할 거예요.',
  },
  cluck_sauce: {
    kind: 'keepsake', name: '클럭 소스', emoji: '🥫', price: 0,
    blurb: '황금빛에 훈연 단맛이 나는 작은 통. 태너가 세 개 줬어요. 열 개라도 줬을 거예요. 기쁨이래요.',
  },
  // the CaMall
  pretzel: {
    kind: 'keepsake', name: '듄 이모의 프레첼', emoji: '🥨', price: 0,
    blurb: '따뜻한 소프트 프레첼, 매듭 같기도 하고 하트 같기도 한 모양. 모래 같은 소금. 다들 그렇듯, 절대 안 들어갈 가게 앞을 걸으며 먹어요.',
  },
  dune_gloss: {
    kind: 'keepsake', name: '듄 글로스', emoji: '💄', price: 0,
    blurb: '사하라의 베스트셀러 립글로스, 색상 “황혼의 오아시스”. 핑크예요. 언제나 핑크예요. 팔로마 말로는 “분위기”래요.',
  },
  sand_scrub: {
    kind: 'keepsake', name: '사하라 모래 스크럽', emoji: '🫙', price: 0,
    blurb: '럭셔리 각질 제거제. 성분표에 “모래”라고 적혀 있어요. 성분표가 정직하다는 것, 그 자체가 럭셔리예요.',
  },
  // the Isle of Cran — Bog Ink (tattoos), Low Tide Records, the Community Center
  tattoo_cranberry: {
    kind: 'keepsake', name: '문신: 크랜베리', emoji: '🍒', price: 0,
    blurb: '작고 빨갛게, 어깨에. 스파이크 말로는 이제 뜰 수 있대요. 비유적으로요. 문자 그대로일지도요. 검증한 사람은 없어요.',
  },
  tattoo_mom: {
    kind: 'keepsake', name: '문신: 닻, “엄마”', emoji: '⚓', price: 0,
    blurb: '시대를 초월한 디자인. 누구 엄마? 모든 엄마. 로큰롤.',
  },
  tattoo_turtle: {
    kind: 'keepsake', name: '문신: “느리게 & 꾸준히 & 메탈”', emoji: '🐢', price: 0,
    blurb: '거북이에 현수막 문구. 바브도 이끼 아래에 같은 게 있어요. 등껍질을 걸고 부인하겠지만요.',
  },
  tattoo_lighthouse: {
    kind: 'keepsake', name: '문신: 등대', emoji: '🗼', price: 0,
    blurb: '불이 켜진 버전. 다들 불이 켜진 걸 원해요.',
  },
  record_slowjams: {
    kind: 'keepsake', name: 'LP: 《늘보거북을 위한 슬로우 잼》', emoji: '💿', price: 0,
    blurb: 'A면: 느림. B면: 더 김. 슬로안이 B면을 추천해요. 언젠가요.',
  },
  record_honk: {
    kind: 'keepsake', name: 'LP: 《꽥》 (메이블, 부틀렉)', emoji: '📀', price: 0,
    blurb: '청음 부스에서 허락 없이 녹음했어요. 모든 예상을 깨고, 아주 좋아요.',
  },
  record_lofi: {
    kind: 'keepsake', name: 'LP: 《연구소 해킹할 때 듣는 로파이 비트》', emoji: '💽', price: 0,
    blurb: '잔잔한 건반, 빗소리, 마이크에 대고 그르렁대는 고양이. 제목은 우연이래요, 널 말로는.',
  },
  watercolor_bog: {
    kind: 'keepsake', name: '습지 수채화', emoji: '🎨', price: 0,
    blurb: '습지를 그렸더니 분홍 얼룩이 나왔어요. 대블 양 말로는 그게 바로 그거래요. 맞아요.',
  },
  // Chuckee's (the travel stop in the strait)
  chuckee_nuggets: {
    kind: 'keepsake', name: '처키 너겟', emoji: '🌽', price: 0,
    blurb: '달콤 바삭한 콘퍼프, 봉지에 우드척이 그려져 있어요. 처키가 셀 때마다 개수가 달라져요. 언제나 모자라요.',
  },
  brisket_sandwich: {
    kind: 'keepsake', name: '브리스킷 샌드위치', emoji: '🥪', price: 0,
    blurb: '양념 차돌박이에 피클, 빨간 글씨로 CHUCKEE’S라고 적힌 종이 포장. 어제 물이 빠진 때부터 훈연했어요.',
  },
  chuckee_fudge: {
    kind: 'keepsake', name: '처키의 퍼지', emoji: '🍫', price: 0,
    blurb: '록키 로드. 돌은 견과류예요. (대부분 견과류.) 크랜의 초콜릿 중독자 모임에는 비밀이에요.',
  },
  chuckee_plush: {
    kind: 'keepsake', name: '처키 인형', emoji: '🦫', price: 0,
    blurb: '작은 빨간 모자를 쓴 작은 우드척. 꾹 눌러도 아무 일도 없어요. 그래도 처키는 눌러 주면 좋아해요.',
  },
  hoa_notice: {
    kind: 'keepsake', name: '규정 위반 통지서', emoji: '📋', price: 0,
    blurb: '오아시스 에스테이츠 주민협의회의 분홍 복사지, 아주 반듯한 글씨. “위반 내용” 란에는 “첨부 참조”. 첨부는 없어요. 그것도 위반이에요.',
  },
};

// what a patient magnet pulls out of the dust sea
export const METEOR_TABLE = [
  ['iron_meteorite', 30], ['stony_chondrite', 32], ['starglass', 12],
  ['moonpearl', 18], ['meteoric_button', 8],
];

export const COFFEE_PRICE = 40;
export const COFFEE_BOOST_SECS = 90;

// Weighted fish draw per water ('sea' or 'cave'), optionally filtered by
// shadow size ('s'|'m'|'l'). Bottles are handled separately by fishing.js;
// the boot has no size, because the boot finds YOU.
export function rollFish(where = 'sea', size = null, randFn = Math.random) {
  const fish = Object.entries(ITEMS)
    .filter(([, it]) => it.kind === 'fish' && (it.where ?? 'sea') === where &&
      (!size || it.size === size));
  const total = fish.reduce((s, [, it]) => s + it.weight, 0);
  let r = randFn() * total;
  for (const [id, it] of fish) {
    r -= it.weight;
    if (r <= 0) return id;
  }
  return 'sea_bass';
}

// what each seed becomes, how long it takes, and how many you pull up
export const GROWTH = {
  carrot_seeds: { produce: 'carrot', secs: 180, n: 3 },
  tomato_seeds: { produce: 'tomato', secs: 240, n: 3 },
  pumpkin_seeds: { produce: 'pumpkin', secs: 360, n: 2 },
};

export const SHOP_HATS = ['party_cone', 'knit_cap', 'straw_hat', 'flower_crown', 'keepers_cap'];

export const SONGS = [
  { id: 'button_bossa', name: '단추 보사' },
  { id: 'foggy_lullaby', name: '안개 자장가' },
  { id: 'tidepool_stomp', name: '조수 웅덩이 스톰프' },
];

export const POOL_TABLE = [
  ['hermit_crab', 26], ['sea_star', 30], ['wiggleblossom', 18],
  ['pearl_periwinkle', 18], ['tidepool_octopus', 8],
];

export const FOSSIL_TABLE = [
  ['trilobutton', 18], ['curlstone', 24], ['megalodont_tooth', 10],
  ['fern_frond', 24], ['very_old_pebble', 24],
];

export function rollTable(table, randFn = Math.random) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = randFn() * total;
  for (const [id, w] of table) {
    r -= w;
    if (r <= 0) return id;
  }
  return table[0][0];
}

// ------------------------------------------------------------------ lore ----
// The short version, which nobody on the island will tell you in order:
// Notbell Isle used to be Lightkeep Isle. A lighthouse stood on the north
// cliff, kept by Old Tansy, who rang its bronze bell in every fog. The Great
// Squall took the bell into the sea. Tansy paid salvage divers out of her
// button jar for a whole summer — they never found it, but buttons have been
// money here ever since, and the island that lost its bell got a new name.
// When the lamp finally went dark, the glow didn't go out. It moved into the
// cave under the cliff, where it sleeps among the glow worms. Luna keeps the
// old lamp warm in her café. Fern remembers all of it. Howell says that on
// foggy nights you can still hear the bell ring, from under the sea.

// Letters that wash ashore in bottles, in the order you find them.
export const BOTTLE_NOTES = [
  { title: 'T.의 편지 (I)',
    text: '이걸 찾은 누구에게 — 새벽에 종이 물에 들어갔어요. 잠수부들을 위해 단추 항아리를 시작했어요. 바다가 종소리를 가져갔지만, 우리가 종을 울린 이유까지 가져갈 수는 없어요. —T.' },
  { title: 'T.의 편지 (II)',
    text: '잠수부들이 닻 세 개와 샹들리에, 그리고 아주 무례한 장어를 찾았어요. 종은 없었어요. 오늘도 단추로 품삯을 줬어요. 이제 그쪽이 더 좋아하기 시작했어요. —T.' },
  { title: 'T.의 편지 (III)',
    text: '등불이 어두워지고 있지만 슬프지 않아요. 빛도 다른 누구와 같아요 — 긴 근무가 끝나면 아늑한 곳에 눕고 싶어 해요. 동굴을 택한 것 같아요. —T.' },
  { title: 'T.의 편지 (IV)',
    text: '마지막 편지, 마지막 병이에요. 안개가 오고 종소리가 그리워도, 그래도 들어 보세요. 어떤 소리는 들은 사람들 안에서 계속 울려요. 제 섬에 다정하게 지내 주세요. —탠지' },
];

// Fern's museum stories, unlocked at donation-count milestones.
export const FERN_LORE = [
  { at: 1, text: '소장품에 첫 기부라니! 흠. 있지, 이 섬이 언제나 낫벨이었던 건 아니란다. 내가 갓 부화했을 때 — 아니, 젊은 거북이었을 때 — 이곳은 라이트킵 섬이었어. 북쪽 절벽에 등대가 있었지. 더 가져오면, 더 기억해 내 주마.' },
  { at: 3, text: '등대지기는 늙은 탠지라 불렀단다. 안개가 낄 때마다 청동 종을 울려서, 배들이 소리로 집을 찾아오게 했지. 대풍이 그 종을 바다로 데려갔어. 섬은 종을 잃었고... 그걸 기억하려고 이름을 남겼단다. 낫벨.' },
  { at: 6, text: '탠지는 종을 찾으려고 잠수부들을 고용해서, 단추 항아리에서 품삯을 줬어 — 여름 내내 단추로. 끝내 찾지 못했지만, 가을이 되자 모두가 단추로 물건을 사고팔고 있었지. 주머니를 들여다보렴. 너는 지금 그 항아리를 조금씩 나눠 들고 다니는 거야.' },
  { at: 10, text: '마침내 등불이 꺼졌을 때, 빛은 사라진 게 아니란다. 더 아늑한 곳으로 갔을 뿐이야. 언젠가 절벽 아래 동굴에 들어가 보렴. 목소리는 낮추고. 옛 빛이 그 안에서 반딧불이들과 함께 자고 있어. 쉴 자격이 있거든.' },
];
