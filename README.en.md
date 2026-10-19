# 🍃 Notbell Isle

A tiny low-poly village-life island in the spirit of a certain game that this
is legally very much not. Built with plain [three.js](https://threejs.org)
ES modules — no build step, no dependencies (three.js r180 is vendored in
`vendor/`), runs entirely in the browser. Live at
<https://notbell.brezgis.com>.

![The village plaza — three shops, one well, one lantern-lit rabbit](docs/screenshots/village-plaza.png)

![The tide pools — rummage politely](docs/screenshots/tide-pools.png)

## Run it

```sh
python3 serve.py        # serves on 8123 with no-cache headers
```

Then open <http://localhost:8123>. (ES modules don't load over `file://`.)

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | walk |
| Shift | run |
| **E** | talk · enter doors · fish · dig · catch · rummage · plant · harvest |
| H | cycle hats |
| I | pockets |
| P | the archipelago map (click islands for gossip; unvisited shores stay grey rumors until you land) |
| C | Old Tansy's Almanac (everything you've ever caught) |
| drag / scroll | orbit & zoom the camera |
| M | sound on/off |

## The island

**The village.** Three buildings around a little well plaza, each with a
walk-in interior:

- 🏪 **Pip's Odds & Ends** — Pip the magpie buys anything you catch and sells
  tools, in **buttons**, the island's currency. Your first fishing rod is
  free. ("That's how I get ya!") Do not ask about the Shiniest Button.
- ☕ **The Lantern Room** — Luna the moth's coffeeshop, named for the top
  room of a lighthouse. The old lighthouse lamp lives on her counter and is
  still warm. A cup of Lantern Roast makes you zippy for 90 seconds.
- 🏛️ **Notbell Museum** — Fern the tortoise curates fossils, fish, bugs, and
  tide pool oddities. Donations go on real plinths/tanks/frames, and every
  few donations she remembers another chapter of the island's story.

**The story** (Fern tells it properly; here's the spoiler-free shape): the
island used to be Lightkeep Isle, there was a lighthouse, a keeper named Old
Tansy, a bronze bell, a storm, and a jar of buttons. The bell is why the
island is called Notbell. The buttons are why your money jingles funny.
Letters from Tansy still wash up in bottles, if you fish enough.

**Your place.** A blue-roofed cottage near the village — walk in, flop on
the bed, browse the bookshelf. Six garden plots out front: buy seeds at
Pip's, plant, come back in a few real minutes, harvest. Every villager has
a house of their own too (knock!), and the ducks keep a nest on the beach.

**The sky keeps real time.** The sun runs on your actual clock — dawn,
golden hour, starry nights (fireflies come out after dark, and they're
catchable). The island wears the real season: spring blossoms, summer
green, autumn golds, winter snow-dust. Weather rolls in on its own — fish
bite faster in the rain, and it snows in winter. On real holidays (New
Year's, May Day, Bell Day on June 21, Spooky Eve, the Frost Festival) the
plaza gets decorated, the villagers have things to say, and Pip cracks
open his button jar exactly once.

**Hats.** Pip sells five. Press H to cycle. The villagers have their own —
the Admiral's captain's cap, Puddle's paper boat, Bramble's leaf. Howell
doesn't wear hats. It's a whole thing.

**The Far Isle.** A second, quieter island across the strait — cross by
the arched footbridge, or ride the little red train from either station.
Over there: Barnaby's Greens & Goods (a lobster, a grocery, the only kelp
stew on either side — he buys your produce at island prices), the public
garden, the half-buried skeleton of the Old Singer, and **The Listening
House** — a church with stained glass, candles, an empty belfry, and
Brother Alder the heron, who will explain why the empty belfry is the
point. Saffron, Bramble, Marigold the horse, and Ember the salamander all
live over there (Ember commutes to the glow worm cave at midday; she has
opinions about its acoustics).

**The water.** Rowboats at the dock — board one and actually row: out to
the **coral reef** (manta rays glide over it), or all the way to the
**volcano** that made the archipelago. She smokes sometimes; Cinder the
iguana, who lives on the rim, will assure you this just means she's
comfortable. Captain Brine's tugboat, the Persistent, now runs a **real
ferry network**: hail her at the pier (or ring the bell-buoy at any port
of call) and she serves every island in the archipelago except TEXAS (ask
her why; have time). No black-screen teleports — you ride the deck while
she genuinely sails, steering around the shallows, wake off the stern,
smoke off the funnel, sea story told over open water. Mandatory, the
story. Ten buttons a leg, home runs free. Prefer self-service? Pip sells
the **Salvage Diver's Suit** — canvas, brass, bell-shaped helmet, last
worn the summer they didn't find the bell — and then you can walk into
the sea and simply **swim** between islands (ducks need no equipment and
will tell you so). The **old lighthouse** stands over it all, dark and
patient, with a polished empty hook where the bell used to hang. Friendly
sharks patrol the strait. Whales breach out deep. The villagers,
meanwhile, live their own lives — errands at the café and the shop,
speech-bubble chats with the keepers, heading home at night — and now
**friendships**: you'll find Howell and Saffron mid-gossip in the open
(eavesdropping is allowed and rewarded with lore), and a villager will
sometimes hand you a small parcel for their best friend. Deliver it; the
recipient pays in buttons and delight.

**The north isle & beyond.** A natural stone arch (moss senior, barnacles
junior) leads north to an island where it is always damp and always green:
the Quiet Stacks library (Vesper, bat, whispering preferred), a clinic where
nobody is ever sick (Dr. Gill, axolotl, lollipops), the Buttonwagon (do not
ask Pip), a stew cart the Buttonwagon sponsors, Butterpat the cow, Tusk the
boar, a very poisonous frog you may only admire, and the MouseBoat, moored
with Crumb aboard. Between here and there sits a very small island called
TEXAS, where Pecos the fire ant maintains a slingshot, a tin can, and his
ma's light string. The train is genuinely ridable now — villagers commute
too — and Captain Brine ferries you to the volcano with a sea story told in
the dark of the crossing. Murmur, the island's ghost, appears wherever and
whenever they please. They polish the lighthouse hook. Someone should.

**BULKO.** South of Notbell, at the end of Captain Brine's other ferry
line: a warehouse club with a parking lot full of cars (there are no roads
anywhere; do not worry about it), bulk parmesan wheels, a wall of TVs,
display couches, Gus the greeter (use the lobsters' guest pass), a hot dog
combo that costs 1.5 buttons and has since the sea had a bell — your change
is half a button, a keepsake — and a fully furnished lobster tank that is
NOT FOR SALE. Stop asking. —management. (the lobsters)

**Grove Isle.** Southeast, shaped a little like Idaho, served by the
Grove Line — a second steam railway running straight from Notbell's
southeast shore over wooden trestles. Orange orchards, the Moledecai mansion (the Baron's fortune
comes from his grandfather billing Tansy hourly to not find the bell;
Pemberton the penguin butlers, Tilly the maid swears the third Baron's
portrait winks, three grandchildren orbit the fountain), hot springs you
can genuinely soak in, geysers on a proud schedule, and the lounge:
capybaras (one wearing an orange), crocodiles (their friends), and the
little birds who work the crocodiles' teeth on commission.

**Notbell Labs.** Far west — so far the chart gives up before the island
does (press P; the Labs find this extremely funny). Reachable by ferry,
by a long timber causeway from the North Isle (walked by the
archipelago's only telephone line, which calls the other end of the
bridge), or by swimming, if you're dressed for it. Founded to hear the
bell again; the listening machines kept getting bigger and the questions
kept getting wider, and now there's: a chemistry lab (eleven elements,
mostly salt), a room-sized computer programmed by **Ada**, a spider who
weaves core memory by paw, a rocket division with a chalk orbit drawn
soft into the blackboard, a cafeteria (the stew is legally distinct
rocket fuel), a rooftop catwalk with a telescope pointed somewhere
specific, and — behind glass, so the engineers can wave — a
**kindergarten of rovers**, who may go to the moon when they grow up, if
they want. Director Strix presides. The flag flies the bell-and-button
mark under written protocol (in when it rains — it's wool; half-mast on
Bell Day, for the bell). On the pad: a rocket, white and red and patient,
with an empty heart chamber and a brass plaque that says what it's
waiting for. Somewhere under your home island, something that knows the
way home is sleeping. Introduce them. Then hold that thought.

**The museum, properly.** Bigger on the inside: an entrance art gallery
(café prints rotate weekly, are buyable, and hang here when donated), a
rotunda, a fossil hall whose Mystery Skeleton assembles as you donate, a
bug hall of approved habitats, and a floor-to-ceiling aquarium with a dark
grotto for the cave species.

**The Moon.** Yes. When the rocket has its heart, it asks one question
(“GO?”), Dr. Hazel supplies the bubble helmet (your hat fits under it;
they checked, with hats), and you ride the lighthouse light out of the
sea's jurisdiction entirely. Up there: a sixth of the gravity and all of
the quiet, craters named after feelings, and the settlement where the
rovers go when they grow up — **if** they want. Old Sojo, who came up
first and drew circles until the telescope could read STILL HERE. Beacon,
who speaks lamp-blink (learned from a certain lighthouse, secondhand).
Pebble's Best Rock Museum, one rock, rotated daily, democratically.
Tracks, drawing ten-thousand-year spirals in the dust. Comet, who does
the perimeter (the perimeter does not need doing — that's why it's
perfect). Magnet will lend you a rod for the **dust sea**, where the sky
has been depositing meteorites for four billion years: chondrites,
starglass, moonpearls, and — tell Pip immediately — the Meteoric Button.
The archipelago hangs overhead, blue and small enough to cup, and
southeast of the big island something glints in the deep water. The
rovers have charted it for forty years. It rings on the heavy tides.

**Things to do**

- 🎣 **Fish, for real now** — watch the water for fish **shadows** (small,
  medium, large: the shadow is the fish class), land your cast next to
  one, and let it nibble — nibbles LIE; strike only the real dip. The
  shallows hold eleven sea fish, one persistent boot, occasional mail —
  and the cave's still pond keeps its own guest list (Blind Cavefish,
  Moonbeam Eel, the Lantern Koi).
- 🦋 **Catch bugs, carefully** — they hear you coming now. Walk; running
  scatters everything wary within earshot (snails, pointedly, do not
  care). Butterflies, dragonflies at the shore, ladybirds and snails
  (bare-pawed), crickets in the grass, fireflies at night, a pale
  Glimmerwing in the cave, plus the Buttonshell Beetle, which has four
  neat holes in its shell that nobody will discuss.
- ☄️ **Magnet-fish the dust sea** (lunar) — cast at the breathing dimples,
  wait for the CLUNK in your boots, haul before the dust changes its mind.
- 🍊 **Pick sunfruit** from the orchard trees; it regrows. **Garden** for
  carrots, tomatoes, and pumpkins.
- 🎵 **Request a song** from Chip, the cricket with the tiny guitar at the
  café — "Button Bossa," "Foggy Lullaby," "Tidepool Stomp."
- 🦴 **Dig fossils** — little stars of cracked earth mark the spots (shovel
  sold at Pip's). Trilobuttons, Curlstones, the Megalodon't Tooth.
- 🦀 **Tide pools** — a rocky shelf at the shore; rummage for hermit crabs,
  sea stars, wiggleblossoms, and the occasional very smug octopus.
- ✨ **The glow worm cave** — a dark mouth in a rocky knoll. Inside:
  constellations of glow worms, glowing mushrooms, a perfectly still pond,
  and something warm asleep at the very back. Speak softly.
- 💬 **Talk to everyone** — seven named villagers with rotating dialogue
  (Howell is a wolf, thank you for asking), three shopkeepers with menus.

**The economy, with consequences.** Pip keeps a daily ledger now: flood
him with six of the same thing in one day and the price halves until
tomorrow ("Supply! Demand! I don't make the rules. (I make the rules.)").
Fruit is pocket money, common fossils pay honestly rather than absurdly,
dig spots and orchards take their time coming back, and the serious
purchases — the Keeper's Cap, the diver's suit — now cost like they mean
something. Meteorites are the new top of the market, and they're a whole
moon away.

**On your phone.** Notbell plays on touch screens: a thumbstick, a big E
button, a run latch, and quick buttons for map/pockets/almanac/hat/sound.
One finger orbits the camera, two fingers pinch to zoom, and the chart
folds itself to fit. (Under the hood the touch controls speak synthesized
keyboard, so anything added to the game later inherits mobile support
automatically. The committee is very pleased with this design.)

Progress (buttons, pockets, tools, donations, story) saves to localStorage.

## Files

The core cast, below. (The full module map, the contributor rules, and the
visual/feature/lore canon live in `AGENTS.md` and `docs/` — read those before
changing code.)

```
index.html         shell + UI styles + import map (three → vendor/)
vendor/            three.js r180 (module + core)
src/main.js        renderer, lights, camera, game loop, module wiring
src/terrain.js     island heightmap + deterministic sites (village/cave/pools)
src/zones.js       island ↔ interiors: teleports, lighting moods, walkability
src/interact.js    the "walk up and press E" registry
src/ui.js          dialogue (typewriter + choices), prompts, toasts, pockets, HUD
src/audio.js       synthesized blips, jingles, splashes (WebAudio, no files)
src/state.js       buttons, inventory, tools, donations, flags, localStorage
src/catalog.js     every item + price + blurb, fish tables, lore text
src/buildings.js   shop/café/museum exteriors, interiors, shopkeeper logic
src/houses.js      your cottage + interior, the garden, villager houses
src/cave.js        the knoll, the glow worms, the Old Light, the pond
src/calendar.js    season / holiday / hour-of-day (no imports, safe anywhere)
src/almanac.js     live sun, weather, rain & snow particles
src/hats.js        hat models, H-to-cycle, who wears what
src/fishing.js     cast/wait/strike, bottles with letters
src/digging.js     fossil star-marks + respawns
src/tidepools.js   pools, residents, rummaging
src/nature.js      trees, flowers, rocks, catchable butterflies + beetles
src/animals.js     villager bodies (incl. magpie/moth/tortoise), wander AI
src/villagers.js   names, voices, and opinions of the wanderers
src/player.js      input, movement, lantern glow, coffee speed
src/ocean.js       animated water       src/sky.js  drifting clouds
src/utils.js       noise, rand, angle helpers
shots/             puppeteer screenshot harness (borrows puppeteer-core via a
                   node_modules symlink — see shots/README.md)
```

## Expansion ideas

- Animalese-style voice synthesis from the existing per-speaker blip pitches
- A museum wing for Tansy's letters once you've fished up all four
- The bell quest: Howell, the shore, one genuinely foggy night
- A beached-seagull visitor with odd jobs; home decorating; more villagers
- Weather-aware critters (snails love rain), shooting stars on clear nights
- The "rolling log" world curvature (do it world-space, on tessellated geometry)

Known simplifications: NPCs cheerfully scale cliffs, no collision between
villagers, fish are equally hungry at all hours, and Pip's prices are
whatever Pip says they are.
