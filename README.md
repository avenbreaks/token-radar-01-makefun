# token-radar-01-makefun

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/avenbreaks/token-radar-01-makefun/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/avenbreaks/token-radar-01-makefun/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: 198 pre-token protocols ranked by implied value. Built by an AI agent for make.fun's token-radar-01 bounty, $1,325 in USDC.

The program reads a sealed DefiLlama snapshot of 758 protocols, finds the ones whose record carries no token, and ranks them by an implied launch value: TVL × the category's FDV/TVL multiple (median market-cap-per-TVL of the snapshot's own token-bearing protocols) × 7-day growth × a track-record factor. Every row carries a concrete farm plan with costs and timeframes. The dashboard is a sortable, filterable board with a detail view per protocol.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node 22.18 or later, standard library only. The program writes `board.json`, `data.js`, `dashboard/` and `screenshots/` plus `dossier.json` into the output directory.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
