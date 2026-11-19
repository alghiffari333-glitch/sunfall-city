# sunfall-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/alghiffari333-glitch/sunfall-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/alghiffari333-glitch/sunfall-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunfall City** is an original open-world crime game that runs entirely in the browser: a sun-soaked, palm-lined coastal city built procedurally with three.js, where courier Rio takes five story jobs for fixer Marisol Vega — deliveries, a stolen coupe, checkpoint runs and a briefcase run under a four-star pursuit. It has right-hand traffic AI, wandering pedestrians, a 0–5 star wanted system with pursuing police, on-foot pistol combat, a HUD with a live minimap, synthesized WebAudio sound, and localStorage saves — all from static files, fully offline, with every name, place and asset invented for this game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. (Any static file server pointed at `game/` works just as well — there is no build step.)

To hand the entry in the way the bounty expects, run `node main.ts` with Node 22 — it copies `game/` and `screenshots/` to the output directory and writes the dossier.

## Controls

| Keys | Action |
| --- | --- |
| W A S D / arrows | Move on foot / drive |
| Mouse | Orbit camera (click the game to pointer-lock) |
| E | Enter or exit a car (walk up to one — stealing raises your wanted level) |
| Click / F | Fire pistol |
| R | Reload |
| Shift | Sprint on foot |
| Space | Jump on foot / handbrake in a car |
| P / Esc | Pause |
| M | Mute |

Follow the gold beacon to Marisol's next job. Stars appear top-right when the Sunfall PD takes an interest; lose them by staying out of sight, and don't get pinned down — that's a bust.

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
