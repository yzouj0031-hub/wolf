# Live human versus AI privacy

Single-human matches now pin display/export to that human's perspective until the
entire match ends, including after the human dies. Pure-AI observation and director
mode remain separate privileged modes.

Protected UI paths include role cards, night logs, pack chat, AI thought rendering,
summary/export, replay, spectator questions, post-game chat, director switching and
foreign-seat manual/web-relay prompts. Unfinished human saves cannot be downloaded
through the save-slot exporter, even after returning to the menu. Existing local
autosaves remain usable for resume. Other seats' preset role assignments are ignored
in human mode; the human's own preset remains supported.

Private restored log nodes and other actors' thought nodes are removed from the
rendered log, rather than relying only on CSS. Unowned old night records fail closed.
Multiple casters' unlabelled step logs are not shared with all holders of that role;
owned event records remain the source for each actor's private summary.

This is **local UI privacy, not a hostile-client security boundary**. The local engine,
autosaves and AI requests necessarily contain hidden match state. Developer tools,
filesystem inspection, a modified client or an AI proxy controlled by the player can
still expose it. Competitive anti-cheating requires an authoritative trusted backend
that never sends unauthorized state to the client. This change does not implement
that backend or promise to prevent malicious prompt modifications.

Offline verification:

- `npm run test:observer-perspective` includes bilingual real-browser privacy tests.
- `node scripts/test-information-boundaries-browser.mjs` verifies per-AI API,
  web-prompt and summary ownership separately.
- `npm test` runs the repository regression suite.

Browser tests use an installed Playwright/Chrome runtime and block external requests;
they do not call paid models. Set `PLAYWRIGHT_MODULE_PATH` and `CHROME_PATH` when
using the bundled runtime (the older information-boundary test uses
`PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`).
