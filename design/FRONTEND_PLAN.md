# FRONTEND_PLAN.md — Phish Frenzy Visual Redesign: Audit, Architecture & Contract

**Scope:** `public/index.html`, `public/app.js`, `public/style.css` only. The redesign rewrites HTML structure and CSS. **It must not change any game logic.** `app.js` is server-driven (Socket.io); its element IDs, the classes it toggles, and the class names inside its `innerHTML` templates are a hard contract with the server (§3).

**Ground rule for the implementer:** if a change would require editing a string, event name, payload field, or timing value in `app.js`, it is out of scope. The only two sanctioned `app.js` touches are listed in §3.4 — both optional, both cosmetic.

---

## 1. Current-code audit

### 1.1 File sizes (measured)

| File | Bytes | Lines | Notes |
|---|---|---|---|
| `public/index.html` | 7,807 | 132 | One page, 4 screens, 43 unique `id` attributes |
| `public/app.js` | 10,311 | 214 | 39 literal `$('…')` ID lookups (see §3) |
| `public/style.css` | 6,115 | 72 | **81 rule blocks packed onto 72 lines** — line count is meaningless; the file is accretive, not organised |
| Total | 24,233 | 418 | No images, no webfonts (system font stack — keep it, §4) |

### 1.2 CSS: duplication, not dead code (the honest finding)

A selector-by-selector trace against the HTML **and** the `innerHTML` templates in `app.js` found **no fully dead selectors** — the v2.1 cleanup removed the old v1 rules. The waste is duplication and hardcoding:

| Problem | Evidence (measured) | Consequence |
|---|---|---|
| **23 of 31 hex literals live outside `:root`** | `style.css` has 31 hex values; only 8 are tokens in `:root` | A palette change means hunting ~23 edit sites; drift is guaranteed |
| Inset-surface colour `#0d1330` hardcoded **10×** | `input`, `.pill`, `.players li`, `.timerbar`, `.scenario`, `.mode`, `.howto`, `.review-item`, `.pod` (+1) | It is *the* second surface of the app and has no token (`--surface-2`) |
| Control colour `#1e2a52` hardcoded 3×; text-on-accent `#221a00` 2× | `.btn`, `.filebtn`, `.opt` / `.btn.primary`, `.opt .letter` | Same story one level down |
| `.filebtn` re-implements `.btn` | Separate rule restating bg/border/radius/padding/font-weight of `.btn` | Two button styles to keep in sync; they already differ subtly |
| Gradient stops are raw 8-digit hex | `.bg-glow`: `#2b3a7a55`, `#7a2b4d44` | Glow colours can't follow a palette swap |
| Feedback state colours untokenised | `.feedback.good` `#0f2e26`, `.feedback.bad` `#2e1420`, `.conn-banner` `#3a1420` + `#ffd7dc` | Three near-identical "dark tinted panel" recipes |
| Three unrelated radius values | 18px card / 14px panels / 12px controls, no scale | Visual rhythm is accidental, not designed |
| Global element selectors leak | `label{…}` styles **every** label (the name label *and* `.filebtn` fight via overrides); `input{…}` styles the file input too; bare `a{color}` at file end | Every new element inherits surprises; `.filebtn` needs `margin:0` purely to undo the global `label` rule |
| ID selectors inside a class system | `#timer-fill`, `#podium` styled by ID | Specificity spikes that block component reuse |
| Cascade order is edit history | Two `@media` blocks sit mid-file; v2.1 additions (`.conn-banner`, `.howto`, `.timer-text`, `.review-item`) were appended *after* them | Next append can silently override a media query |
| `transition:.15s` / `transition:.12s` (all properties) | `.btn`, `.opt` | Any future property change animates unintentionally, incl. layout props |
| `.hidden{display:none!important}` is load-bearing | Needed because component display values (`.screen`, flex containers) outrank a plain utility | A specificity war managed by `!important` (§2.4 removes the need) |

### 1.3 Fragile layout constructs — precise overlap/overflow risks

| # | Construct | Failure mode |
|---|---|---|
| F1 | `.game-top` is a no-wrap flex row; `.timerbar{flex:1}` has **no `min-width:0`** | At 360px the pill (2px letter-spacing) + `25s` + `0/10 answered` can crush the timer bar to ~0 or push the row past the card edge |
| F2 | `.modes` is 2-col until 560px, but the Friends card contains `.row` with `.code-input{max-width:160px}` + Join button | In the 561–680px band each column is ~150px wide — the code input + button **cannot fit side by side inside their own card**; they wrap/crush |
| F3 | `.pod.first{transform:scale(1.05)}` inside a wrapping flex row with no vertical gap compensation | Transforms don't affect layout: the scaled winner pod **visually overlaps** the row below / card padding when the podium wraps (3 × `min-width:120px` + gaps = 380px > ~296px inner width at 360px, so it *does* wrap) |
| F4 | Lobby `<h2>` contains the code `.pill` **and** `#btn-copy` inline | At 360px the heading wraps awkwardly; a button inside a heading is also announced poorly by assistive tech (§1.5) |
| F5 | `.players li` is flex `space-between` with no `min-width:0`, ellipsis, or wrap on the name span | A 16-char name + 👑 + 👀 + `(away)` on the left and `1234 pts 🔥12` on the right **overflows the row** at 360px |
| F6 | `body{min-height:100vh}` | On mobile browsers 100vh includes the area under the URL bar: first paint is too tall, footer sits below the fold, height jumps when the bar collapses. Use `100dvh` with `100vh` fallback |
| F7 | `.conn-banner{position:sticky}` lives **outside** `.wrap` | Works today, brittle: it spans full width while content is capped at 680px (visual mismatch on desktop), and its stickiness depends on body being the scroll container. It must be re-homed deliberately (§2.5), not copied |
| F8 | `.bg-glow` is a `position:fixed; inset:0` div with two full-viewport radial gradients | A full-screen fixed paint layer on every scroll frame on low-end mobile GPUs; also a presentational DOM node that should be `body::before` |
| F9 | `#timer-fill` animates **`width`** (`transition:width .2s linear`) while JS rewrites width every 100ms | Continuous layout+paint churn for 25s per question; the transition also fights the JS updates so the bar lags the number. Must become `transform:scaleX()` (§4) — note the JS writes `style.width`; see §3.4 for the one-line sanctioned alternative (JS writes a CSS var / class instead) or keep width writes and drop the CSS transition (still better) |
| F10 | `.code-input{letter-spacing:6px; text-align:center}` | Trailing letter-spacing offsets the "centred" code by half a space — cosmetic, fix with `text-indent` or padding compensation |
| F11 | `.opt:hover{transform:translateY(-1px)}` (and `.btn:hover`) | Sticky hover lift on touch devices after tap; gate hover transforms behind `@media (hover:hover)` |
| F12 | Home screen is one very long card (name → modes → 8-item rules → custom-quiz builder) | Not an overlap bug, a structure bug: the primary action (Play) is separated from the result areas (`#home-error`, `#quiz-status`) by hundreds of pixels of rules text on a phone. Target outline (§2.2) fixes ordering without moving any ID |

### 1.4 Render-blocking / wasteful constructs

- **`style.css` is render-blocking in `<head>`** — acceptable and correct for a single 6KB sheet (avoids FOUC); do **not** split it. The win is organisation, not more requests.
- **Both scripts are parser-blocking at end of body.** `socket.io.js` (server-served, the big one) must load before `app.js` (which calls `io()` immediately). Adding `defer` to **both** preserves order and unblocks parsing — zero behaviour change (§4).
- **No favicon** → the browser requests `/favicon.ico` and 404s on every load. One inline SVG data-URI `<link rel="icon">` kills it.
- **No `<meta name="theme-color">`, no `color-scheme`** → mobile chrome and form widgets (scrollbars, file picker) can render light against the dark UI.
- **`.card{box-shadow:0 18px 50px #0008}`** — a 50px-blur shadow on the app's largest surface repaints on scroll; keep the look, shrink the blur or scope the shadow to a pseudo-element.
- **Leaderboard repaint scope:** `playerRows()` rebuilds the list `innerHTML` on every answer event. CSS-side mitigation only: `contain:layout style` on `.players li` (§4). JS stays untouched.

### 1.5 Accessibility defects in markup

| # | Defect | Detail |
|---|---|---|
| A1 | **`#file-input` is not keyboard-operable** | `<input type="file" hidden>` — the `hidden` attribute makes it unfocusable; the wrapping `<label class="filebtn">` is mouse/tap-only |
| A2 | `#code-input` has **no label at all** | Placeholder `CODE` is its only name; same for `#notes-input` (nearby `<h3>`/`<p>` are not labels) |
| A3 | **No live regions anywhere** | `#quiz-status`, `#home-error`, `#feedback`, `#answered-label`, `#round-label`, leaderboards all change via JS with no `aria-live` — screen-reader players receive *no* game state |
| A4 | **Heading hierarchy is broken** | `<h1>` (brand) → the home screen's first heading is an `<h3>` inside a mode card; "Step 2" is a `<p>`; the game screen's only heading is an `<h4>`; screens have no headings of their own |
| A5 | Interactive element inside a heading | `#btn-copy` inside the lobby `<h2>` (see F4) |
| A6 | Touch targets below 44px | `#btn-copy` (`.btn.small`: 13px font, 7px vertical padding ≈ 31px tall); `#quiz-reset` inline text link |
| A7 | iOS focus zoom | `textarea` is 15px and `.opt` 15.5px; inputs are 16px (correct) — all text-entry surfaces must be ≥16px |
| A8 | No `:focus-visible` styling | Outlines are never removed (good), but there is no designed focus ring for the dark theme — keyboard users get a default ring that clashes/disappears on the accent button |
| A9 | No `prefers-reduced-motion` handling | `.screen.active` pop animation, hover lifts, and the timer transition run unconditionally |
| A10 | Status meaning carried by colour + emoji only | `.error` vs `.quiz-status` ok/error is colour-only in CSS (JS sets `style.color`); feedback good/bad is colour + text (the text saves it — keep the text) |
| A11 | Timer has no accessible name/value | `.timerbar` is a bare div; no `role="progressbar"` / `aria-valuenow` (JS updates `#timer-text` every 100ms — do **not** live-announce that; announce per-round only) |
| A12 | `<a href="#" id="quiz-reset">` | A link that goes nowhere without JS; should be a `<button type="button">` styled as a link (ID and JS binding are by ID, so the element swap is safe — §3.3) |

---

## 2. Target architecture

### 2.1 Principles

1. **One stylesheet, no build step** (unchanged constraint). Organisation comes from cascade layers + section discipline, not more files.
2. **Mobile-first.** Base styles are the 360px layout; `min-width` queries add columns. Today's file is desktop-first with two `max-width` patches — invert it.
3. **No element is positioned to overlap.** Layout is flow + grid only; the *only* non-flow pieces are the glow pseudo-element (`z-index:-1`-equivalent via stacking order) and the sticky connection banner (in-flow sticky, never absolute/fixed over content). **F3's `scale()` on the winner pod is deleted** — emphasis via border + background token instead.
4. **Every colour, radius, space, and duration comes from a token.** Zero hex literals outside the token layer.

### 2.2 Semantic HTML outline (IDs unchanged — see §3)

```
<body>
  <div id="conn-banner" role="alert">            <!-- sticky, in-flow, first in DOM -->
  <div class="shell">                              <!-- was .wrap -->
    <header class="brand">                         <!-- banner -->
      <p class="brand__mark" aria-hidden="true">🎣</p>
      <div>
        <h1 class="brand__name">Phish <span>Frenzy</span></h1>
        <p class="brand__tag">…</p>
      </div>
    </header>

    <main>
      <section id="screen-home" class="screen is-active" aria-labelledby="home-title">
        <h2 id="home-title" class="screen__title">Play a game</h2>     <!-- NEW heading, no JS role -->
        <div class="card stack">
          <div class="field">
            <label class="field__label" for="name-input">Step 1 — Your name …</label>
            <input id="name-input" class="field__input">
          </div>
          <h3 class="step-title">Step 2 — Who do you want to play against?</h3>  <!-- was <p class="step"> -->
          <div class="mode-grid">
            <article class="mode-card"> <h4>🤖 Solo vs Bots</h4> … <button id="btn-bots"> </article>
            <article class="mode-card">
              <h4>👥 Play with Friends</h4> … <button id="btn-create">
              <div class="divider" aria-hidden="true"><span>already have a code?</span></div>
              <div class="join-row">
                <label class="visually-hidden" for="code-input">Room code</label>   <!-- fixes A2 -->
                <input id="code-input"> <button id="btn-join">
              </div>
            </article>
          </div>
          <p id="home-error" class="notice notice--error" role="alert"></p>
          <details class="howto">                        <!-- rules collapse on mobile; content identical -->
            <summary><h3 class="howto__title">📖 How to play …</h3></summary>
            <ul> …unchanged 8 items… </ul>
          </details>
          <section class="quiz-builder" aria-labelledby="quiz-builder-title">
            <h3 id="quiz-builder-title">📚 Build a quiz from YOUR notes</h3>
            <p class="prose">…</p>
            <label class="visually-hidden" for="notes-input">Your notes</label>      <!-- fixes A2 -->
            <textarea id="notes-input"></textarea>
            <div class="action-row">
              <button id="btn-notes">
              <label class="btn btn--file" for="file-input">Upload PDF / TXT / MD   <!-- fixes A1 -->
                <input id="file-input" class="visually-hidden" type="file">
              </label>
            </div>
            <p id="quiz-status" class="notice" aria-live="polite"></p>               <!-- fixes A3 -->
            <p id="quiz-reset-row" class="hidden">… <button id="quiz-reset" type="button"> <!-- fixes A12 -->
          </section>
        </div>
      </section>

      <section id="screen-lobby" class="screen" aria-labelledby="lobby-title">
        <div class="card stack">
          <div class="lobby-head">
            <h2 id="lobby-title" class="screen__title">Room
              <span id="lobby-code" class="code-pill"></span></h2>
            <button id="btn-copy" type="button">📋 Copy code</button>   <!-- out of the heading: fixes A5/F4 -->
          </div>
          <p class="prose">…</p><p class="fine">…</p>
          <p id="lobby-source" class="fine"></p>
          <p id="spectator-note" class="notice hidden" aria-live="polite"></p>
          <ul id="lobby-players" class="player-list"></ul>
          <div class="action-row">
            <button id="btn-start" class="hidden"> <button id="btn-leave-lobby">
          </div>
          <p id="lobby-wait" class="fine"></p>
        </div>
      </section>

      <section id="screen-game" class="screen" aria-labelledby="round-label">
        <div class="card stack">
          <div class="game-head">
            <span id="round-label" class="code-pill" role="heading" aria-level="2"></span>
            <div class="timerbar" role="progressbar" aria-label="Time left this question"> <!-- A11; JS still writes #timer-fill width -->
              <div id="timer-fill"></div>
            </div>
            <span id="timer-text" aria-hidden="true"></span>
            <span id="answered-label" class="fine" aria-live="polite"></span>
          </div>
          <div class="scenario">
            <p id="q-scenario" class="scenario__context hidden"></p>
            <p id="q-prompt" class="scenario__prompt"></p>
          </div>
          <div id="options" class="option-grid" role="group" aria-label="Answer options"></div>
          <div id="feedback" class="feedback hidden" aria-live="polite"></div>          <!-- A3 -->
          <p id="hash-line" class="fine"></p>
          <h3 class="board-title">Live leaderboard <span class="fine">(🔥 = 3+ correct in a row)</span></h3>
          <ul id="board" class="player-list"></ul>
          <button id="btn-leave-game">
        </div>
      </section>

      <section id="screen-podium" class="screen" aria-labelledby="winner-line">
        <div class="card stack">
          <h2 id="winner-line" class="screen__title">🏆 Final results</h2>
          <div id="podium" class="podium"></div>
          <ul id="final-board" class="player-list"></ul>
          <section id="review-zone" class="hidden" aria-labelledby="review-title">
            <h3 id="review-title">📚 Review — the ones you missed</h3>
            <div id="review-list"></div>
          </section>
          <div class="action-row">
            <button id="btn-again" class="hidden"> <button id="btn-leave-podium">
          </div>
          <p class="fine">…</p>
        </div>
      </section>
    </main>

    <footer class="foot">…</footer>   <!-- moved OUT of <main> -->
  </div>
```

Notes on the outline:

- `#round-label` is a `<span>` whose text JS rewrites each round ("Round 3/10"). Giving it `role="heading"` is optional polish; if that feels risky, drop the role — the ID and element type are what matter.
- `<details>` for the rules is a **pure-HTML** disclosure: no JS involved, and it directly answers F12 (phone users reach Play first). It must start **open** on wide screens via a `min-width` CSS trick is *not* possible for `details` — accept closed-by-default everywhere, or keep a plain `<section>` if the designer prefers. Either is contract-safe; decide once, note it here.
- All copy text stays byte-identical unless the redesign brief separately approves copy edits. This plan changes **structure and naming**, not wording.

### 2.3 CSS organisation (single file, cascade layers)

```css
@layer tokens, base, layout, components, utilities;
```

| Layer | Contents |
|---|---|
| `tokens` | `:root` custom properties only (§2.4) + the `prefers-reduced-motion` token overrides |
| `base` | Reset (`box-sizing`, margin reset), `body` (bg, ink, font, `color-scheme:dark`), glow via `body::before`, focus-visible ring, `visually-hidden`, element defaults for `input/textarea/button` **scoped by class from here on** (no bare global `label`/`input` styling — classes only) |
| `layout` | `.shell` container, `.stack` vertical rhythm, `.screen` show/hide, `.mode-grid`, `.join-row`, `.action-row`, `.game-head` grid, `.option-grid`, `.podium`, sticky `#conn-banner` placement |
| `components` | `.card`, `.btn` (+`--primary`, `--small`, `--file` variants), `.field__*`, `.mode-card`, `.divider`, `.code-pill`, `.code-input`, `.player-list`, `.timerbar`/`#timer-fill`, `.scenario__*`, `.opt` states, `.feedback` states, `.notice` states, `.howto`, `.pod`, `.review-item`, `.foot` |
| `utilities` | `.hidden` (display:none — **no `!important` needed**: utilities is the last layer, so it beats component display values by layer order, which is exactly the war §1.2 flagged), `.fine`, text helpers |

Expanded formatting (one declaration per line) will make the file *more* lines (~450) at roughly the same bytes. That is a deliberate trade: the current 72-line packing is the maintenance problem.

### 2.4 Design tokens — how the palette spec is wired

The colour artist's palette arrives as a spec (names + values). Wire it **only** into the `tokens` layer; components reference tokens exclusively. Required token slots (current values shown as placeholders — the redesign swaps values, never names):

```css
@layer tokens {
  :root {
    color-scheme: dark;
    /* surfaces */
    --bg:#0b1020;  --surface-1:#141b33 /*card*/;  --surface-2:#0d1330 /*inset*/;
    --surface-3:#1e2a52 /*controls*/;
    /* text */
    --ink:#eef1ff;  --ink-muted:#9aa5c9;  --ink-on-accent:#221a00;
    /* brand + state */
    --accent:#ffcf3f;
    --ok:#2ee6a8;        --ok-surface:#0f2e26;
    --danger:#ff5a6e;    --danger-surface:#2e1420;  --danger-ink:#ffd7dc;  --danger-banner:#3a1420;
    --line:#26305a;
    --glow-a:#2b3a7a;  --glow-b:#7a2b4d;   /* alpha applied via color-mix() */
    /* shape + space + type + motion */
    --radius-s:12px; --radius-m:14px; --radius-l:18px; --radius-pill:999px;
    --space-1:.5rem; --space-2:.75rem; --space-3:1rem; --space-4:1.375rem; --space-5:2rem;
    --text-s:.8125rem; --text-m:1rem; --text-l:1.1875rem; --text-xl:2.125rem;
    --shadow-card:0 18px 50px rgb(0 0 0 / .53);
    --dur-fast:.15s; --ease-out:cubic-bezier(.2,.7,.3,1);
    --target:2.75rem; /* 44px minimum touch target */
  }
  @media (prefers-reduced-motion: reduce) {
    :root { --dur-fast:0s; }
  }
}
```

Rules: (a) glow uses `rgb(from var(--glow-a) r g b / .33)` or `color-mix()` so stops stay tokenised; (b) breakpoints are **not** tokens — CSS variables cannot drive media queries; fix them as named constants in comments (`--bp-grid:34rem; --bp-wide:48rem` documented, values typed literally in queries); (c) the two JS-written inline values (`style.color = 'var(--ok)'`) already reference tokens by name and keep working untouched.

### 2.5 Responsive strategy (mobile-first, no-overlap by construction)

- **Container:** `.shell{width:min(100%,42.5rem); margin-inline:auto; padding-inline:max(1rem, env(safe-area-inset-left), env(safe-area-inset-right));}` — replaces the fixed 680px + symmetric padding and respects notches in landscape.
- **Height:** `body{min-height:100vh; min-height:100dvh;}` (fallback first). Banner sticky offset accounts for `env(safe-area-inset-top)` padding on the banner itself.
- **Vertical rhythm:** one `.stack > * + *{margin-top:var(--space-3)}` instead of per-component margins — kills the margin-collision class of bugs wholesale.
- **Grids, not cliffs:**
  - `.mode-grid{grid-template-columns:1fr}` → `@media (min-width:34rem){grid-template-columns:1fr 1fr}`. The Friends **join-row moves out of the two-column squeeze**: inside the card it is `grid-template-columns:minmax(0,10rem) auto` with `min-width:0` on the input — F2 cannot recur at any width because the card is full-width below 34rem.
  - `.option-grid{grid-template-columns:1fr}` → 2 columns at `min-width:34rem`.
  - `.game-head{display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center}` — `minmax(0,1fr)` is the explicit F1 fix; the timer bar can shrink but the row can never overflow.
  - `.player-list li{display:flex}` + name span `{min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}` and score span `{flex:none}` — the F5 fix.
  - `.podium{display:flex; flex-wrap:wrap}` with `.pod{flex:1 1 7.5rem}` and **no transform** — F3's overlap is designed out, not compensated.
- **Sticky banner:** stays first in DOM, `position:sticky; top:0; z-index:10`. Because it is in-flow sticky (not fixed), it can never cover content — when visible it pushes layout; when `.hidden`, it occupies nothing. This preserves today's behaviour exactly while removing the F7 width mismatch (banner text gets its own inner max-width matching `.shell`).
- **Touch & type floors:** every interactive element `min-height:var(--target)` (44px) — fixes A6; all text inputs/textarea/options at `≥1rem` — fixes A7.
- **Hover gating:** all `:hover` transforms wrapped in `@media (hover:hover) and (pointer:fine)` — fixes F11.

### 2.6 Naming convention (BEM-lite)

- Blocks: `.card`, `.btn`, `.mode-card`, `.player-list`, `.feedback`, `.notice`, `.podium`.
- Elements: `block__element` (`.brand__mark`, `.field__label`, `.scenario__prompt`, `.pod__medal`).
- Modifiers: `block--variant` (`.btn--primary`, `.notice--error`, `.feedback--good` — see §3.3 for why feedback keeps its current class names instead).
- State classes JS already toggles are **not renamed** (§3.2) — convention applies to new/static structure only.
- IDs are never used as style hooks in the new CSS (the two current exceptions, `#timer-fill` and `#podium`, become classes `.timerbar__fill` / `.podium` on the same elements — IDs stay in the HTML for JS).

---

## 3. ID / class contract — the non-negotiable section

### 3.1 How `app.js` finds elements (three mechanisms — all must survive)

1. **39 literal `$('…')` lookups** — table in §3.2.
2. **Dynamic screen IDs:** `const screens = ['home','lobby','game','podium']` + `show(n)` toggles `$('screen-' + n)`. **`#screen-home`, `#screen-lobby`, `#screen-game`, `#screen-podium` are referenced by construction, not by literal string** — renaming any one breaks navigation with no grep-able trace.
3. **Indirect ID:** `enter(res, 'home-error')` — `#home-error` is passed as a string argument at three call sites and resolved via `$(errEl)`.

### 3.2 Contract table — preserve every ID exactly

All 43 IDs below exist in today's HTML and are touched by JS. **Preserve: YES for every row.** Element *types* may change only where the "Type change" column says so.

| ID | Role (what JS does with it) | Preserve exactly? | Type change allowed? |
|---|---|---|---|
| `conn-banner` | `classList.add/remove('hidden')` on connect/disconnect | ✅ Yes | No — keep a block element |
| `screen-home` | `show()` toggles `.active` | ✅ Yes (dynamic, §3.1.2) | Keep `<section>` |
| `screen-lobby` | `show()` toggles `.active` | ✅ Yes (dynamic) | Keep `<section>` |
| `screen-game` | `show()` toggles `.active` | ✅ Yes (dynamic) | Keep `<section>` |
| `screen-podium` | `show()` toggles `.active` | ✅ Yes (dynamic) | Keep `<section>` |
| `name-input` | `.value` read by `myName()`; **written on reconnect** | ✅ Yes | Keep `<input>` |
| `btn-bots` | `onclick` → `create_room {mode:'bots'}` | ✅ Yes | Keep `<button>` |
| `btn-create` | `onclick` → `create_room {mode:'friends'}` | ✅ Yes | Keep `<button>` |
| `code-input` | `.value` read, `.toUpperCase()` by JS | ✅ Yes | Keep `<input>` |
| `btn-join` | `onclick` → `join_room` | ✅ Yes | Keep `<button>` |
| `home-error` | `textContent` written by `enter()` (§3.1.3) | ✅ Yes | Keep `<p>` |
| `btn-notes` | `onclick` → POST `/api/quiz/from-text` | ✅ Yes | Keep `<button>` |
| `notes-input` | `.value` read | ✅ Yes | Keep `<textarea>` |
| `file-input` | `onchange`, `.files[0]` read | ✅ Yes | Keep `<input type="file">`; **remove the `hidden` attribute**, hide via `.visually-hidden` class instead (A1) |
| `quiz-status` | `textContent` + **inline `style.color`** written by `setQuizStatus()` | ✅ Yes | Keep `<p>`; see §3.4 |
| `quiz-reset-row` | `classList.toggle('hidden', …)` | ✅ Yes | Keep `<p>` |
| `quiz-reset` | `onclick` (calls `preventDefault`) | ✅ Yes | **Yes: `<a href="#">` → `<button type="button">`** — binding is by ID, behaviour identical (A12) |
| `lobby-code` | `textContent` = room code; read by copy handler | ✅ Yes | Keep inline element |
| `btn-copy` | `onclick`; its own `textContent` flips to "✅ Copied!" for 1.5s | ✅ Yes | Keep `<button>`; move **out of the `<h2>`** (A5) — DOM position is free, ID is not |
| `lobby-source` | `textContent` = quiz source + question count | ✅ Yes | Keep `<p>` |
| `spectator-note` | `classList.toggle('hidden', …)` | ✅ Yes | Keep `<p>` |
| `lobby-players` | `innerHTML` rebuilt by `playerRows()` | ✅ Yes | Keep `<ul>` |
| `btn-start` | `onclick` → `start_game`; `classList.toggle('hidden')` by host check | ✅ Yes | Keep `<button>` |
| `btn-leave-lobby` | `onclick` → `leave()` | ✅ Yes | Keep `<button>` |
| `lobby-wait` | `classList.toggle('hidden', isHost)` | ✅ Yes | Keep `<p>` |
| `round-label` | `textContent` = "Round n/10" each question | ✅ Yes | Keep `<span>` |
| `timer-fill` | **`style.width = %` written every 100ms** | ✅ Yes | Keep `<div>`; see §3.4/F9 before touching its CSS |
| `timer-text` | `textContent` = "25s"…"0s" | ✅ Yes | Keep `<span>` |
| `answered-label` | `textContent` = "n/m answered" | ✅ Yes | Keep `<span>` |
| `q-scenario` | `textContent`; `hidden` toggled per question | ✅ Yes | Keep `<p>` |
| `q-prompt` | `textContent` = question text | ✅ Yes | Keep `<p>` |
| `options` | `innerHTML` rebuilt each question; children queried via `querySelectorAll('.opt')` | ✅ Yes | Keep `<div>`; children are JS-generated (§3.3) |
| `feedback` | `innerHTML` written; classes `hidden`, `good`, `bad` toggled | ✅ Yes | Keep `<div>` |
| `hash-line` | `textContent` = commitment hash line | ✅ Yes | Keep `<p>` |
| `board` | `innerHTML` rebuilt by `playerRows()` on `room_state`/`leaderboard`/`round_end` | ✅ Yes | Keep `<ul>` |
| `btn-leave-game` | `onclick` → `leave()` | ✅ Yes | Keep `<button>` |
| `winner-line` | `textContent` = winner announcement | ✅ Yes | Keep `<h2>` |
| `podium` | `innerHTML` = top-3 `.pod` cards (JS template) | ✅ Yes | Keep `<div>` |
| `final-board` | `innerHTML` rebuilt by `playerRows()` | ✅ Yes | Keep `<ul>` |
| `review-zone` | `classList` `hidden` add/remove by missed-count | ✅ Yes | Keep container element |
| `review-list` | `innerHTML` = `.review-item` cards (JS template) | ✅ Yes | Keep `<div>` |
| `btn-again` | `onclick` → `play_again`; `hidden` toggled by host check | ✅ Yes | Keep `<button>` |
| `btn-leave-podium` | `onclick` → `leave()` | ✅ Yes | Keep `<button>` |

### 3.3 Class contract — JS-generated and JS-toggled class names (also frozen)

Renaming any of these in CSS only, or in JS only, silently unstyles the game. They are **not** BEM-renamed in this redesign:

| Class | Written/toggled by | Where it must be styled |
|---|---|---|
| `active` | `show()` on the 4 screens | `.screen.active` display rule (utilities/layout layer) |
| `hidden` | JS on 9 elements (banner, buttons, notes, zones) | Display utility — last cascade layer (§2.3) |
| `opt`, `letter` | `question` handler template; `.opt` is also **queried** (`querySelectorAll('.opt')`) | Option component + states |
| `picked`, `correct` | Answer click / `round_end` handler on `.opt` elements | Option state styles |
| `good`, `bad` | `answer_result` / `round_end` on `#feedback` | Feedback state styles (keep names; do **not** "fix" to `.feedback--good` without editing JS) |
| `me`, `score` | `playerRows()` template for all three player lists | Player-list component |
| `pod`, `first`, `medal` | `game_over` template for `#podium` | Podium component (`first` = winner emphasis — border/token, **not** `scale()`, per F3) |
| `review-item`, `review-q`, `fine` | `game_over` review template (`fine` is reused inside JS HTML!) | Review component; `.fine` must remain a global utility class name |

### 3.4 The only two sanctioned `app.js` touches (both optional, both cosmetic)

1. **`#timer-fill`:** if the designer wants the compositor-only animation (F9/§4), change the JS interval body from `style.width = …%` to `style.transform = 'scaleX(…)'` with `transform-origin:left` in CSS. One expression changes; values and timing identical. **If this edit is not taken, the CSS must keep animating `width` and simply drop the `transition`** — the plan's default is this zero-JS-change fallback.
2. **`#quiz-status` colour:** `setQuizStatus()` writes `style.color = 'var(--ok)' / 'var(--danger)'`. Inline styles beat classes, so tokenised `.notice--error` classes **will not apply** while this stays. Either leave it (it already references token names and works) or replace the two assignments with `classList.toggle('notice--error', !ok)`. Never restyle `#quiz-status` by ID to work around it.

Everything else in `app.js` — socket events (`create_room`, `join_room`, `start_game`, `answer`, `play_again`, `leave_room`), payloads, `sessionStorage` keys (`pf_code`, `pf_name`), the 100ms timer, the 1200ms debounce, the 1500ms copy-label flip — is untouched.

---

## 4. Optimisation list (concrete change → expected benefit)

| # | Change | Expected benefit |
|---|---|---|
| O1 | Tokenise all 23 stray hex literals (§1.2); `#0d1330` ×10 → `var(--surface-2)` etc. | Palette changes become 1-line edits; eliminates drift. CSS ≈ −150–250 bytes after expansion settles (measure post-format; the real win is maintainability) |
| O2 | Merge `.filebtn` into `.btn` as `.btn--file` on the `<label>` | One button implementation; removes the global-`label` override fight |
| O3 | `#timer-fill`: drop the `width` transition (default) **or** sanctioned scaleX swap (§3.4.1) | Kills 25s of continuous layout/paint per question; bar tracks the number exactly; scaleX path moves the work to the compositor (transform/opacity only) |
| O4 | All transitions restricted to `transform, opacity, box-shadow` with `var(--dur-fast)`; delete `transition:.15s/.12s` all-property shorthands | No accidental layout animation, ever |
| O5 | `.bg-glow` div → `body::before` with the same gradients, `position:fixed; inset:0; z-index:-1`… (use stacking via `isolation` on body) | −1 DOM node; identical pixels; glow code lives with base styles |
| O6 | Delete `.pod.first` `transform:scale(1.05)` → accent border + `--surface-3` background | Removes the F3 overlap class entirely; no neighbour repaints on podium render |
| O7 | Add `defer` to both `<script>` tags (order preserved by spec) | HTML parsing is no longer blocked by the Socket.io client download; first paint of the home card is earlier on slow 4G. Zero behaviour change |
| O8 | Inline SVG favicon (🎣 emoji as SVG text or a hook glyph) + `<meta name="theme-color" content="#0b1020">` (use `var` value at build time — meta can't read CSS vars, hardcode from `--bg`) | Kills the `/favicon.ico` 404; correct mobile browser chrome colour |
| O9 | `:focus-visible{outline:2px solid var(--accent); outline-offset:2px}` + file input via `.visually-hidden` with `label.btn--file:has(:focus-visible)` ring | Keyboard users can see focus everywhere, including Upload (fixes A1/A8) |
| O10 | `aria-live="polite"` on `#quiz-status`, `#feedback`, `#answered-label`, `#spectator-note`; `role="alert"` on `#home-error` and `#conn-banner` | Screen-reader players actually receive game state (A3). Markup-only; JS text writes announce automatically |
| O11 | Keep the **system font stack** — do not add a webfont | 0 bytes, 0 FOUT/FOIT, instant text. If branding later demands one: single `woff2`, `font-display:swap`, `<link rel="preload">`, subset to Latin — and re-run §5 |
| O12 | `contain:layout style` on `.player-list li`; keep `.card` shadow but reduce blur to `0 12px 32px` | Leaderboard `innerHTML` rebuilds repaint only the changed row's box; cheaper scroll paint on the big card |
| O13 | `@media (prefers-reduced-motion: reduce)`: zero `--dur-fast`, disable the screen pop keyframes and hover lifts | Vestibular safety (A9); the pop keyframes already use only `transform`+`opacity`, so this is a 4-line addition |
| O14 | Fluid type via `clamp()` for `.brand__name` and `.scenario__prompt` (e.g. `clamp(1.05rem, 4.5vw, 1.35rem)`) | Deletes the 520px brand breakpoint patch; text scales smoothly instead of jumping |
| O15 | Replace per-component margins with the `.stack` rhythm (§2.5) | Removes a whole category of margin-collapsing surprises when sections reorder |

**CSS size expectation, stated honestly:** today's sheet is 6,115 bytes *because it is packed onto 72 lines*. The layered, expanded, tokenised replacement will likely land at **6.5–7.5KB raw** (≈ same gzipped) while covering focus, live-region, reduced-motion, and safe-area cases the current file ignores. The optimisation claim is *cost per feature and change-safety*, not a smaller number at any cost. If a byte target is required, minify at deploy time (the server serves the file as-is; a minified `style.css` from the same source is a deploy step, not a rewrite).

---

## 5. Verification checklist (implementer must run all, in order)

### 5.1 Contract integrity (before any visual check)

- [ ] Extract every `$('…')` from the **unchanged** `app.js` (`grep -o "\$('[a-z-]*'" public/app.js | sort -u`) and confirm each ID exists exactly once in the new HTML — **43 IDs, including the four `screen-*` and `home-error`**
- [ ] Confirm `app.js` is byte-identical to before (or differs only in a §3.4 sanctioned line, noted in the commit)
- [ ] Confirm every §3.3 class (`active`, `hidden`, `opt`, `letter`, `picked`, `correct`, `good`, `bad`, `me`, `score`, `pod`, `first`, `medal`, `review-item`, `review-q`, `fine`) has styles in the new CSS
- [ ] `grep -E '#[0-9a-fA-F]{3,8}' public/style.css` returns hits **only inside the tokens layer**

### 5.2 Viewports & overlap (each of 360 / 390 / 768 / 1024 / 1440 width)

- [ ] No horizontal scrollbar: `document.documentElement.scrollWidth <= window.innerWidth` on every screen (home, lobby, game mid-question, podium with a 3-way podium + long review list)
- [ ] Game screen: timer bar has visible width at 360px with "Round 10/10" + "12/12 answered" rendered (F1)
- [ ] Home at 360 **and** 600px: the Friends join row fits inside its card without wrapping crush (F2)
- [ ] Podium at 360px with 3 pods + a tie: no pod overlaps another; winner emphasis is border/background, no transform (F3)
- [ ] Player list with a 16-char name + host 👑 + spectator 👀 + `(away)` + 4-digit score: single row, ellipsis on the name, score fully visible (F5)
- [ ] Scroll the game screen top-to-bottom: the connection banner (force it via DevTools offline) sticks without covering any content, and content max-width matches the banner's inner width on 1440px (F7)
- [ ] Rotate a phone viewport to landscape: left/right padding respects the notch (`env(safe-area-inset-*)`)
- [ ] Footer fully reachable; no `100vh` jump when the mobile URL bar shows/hides (dvh) (F6)
- [ ] 200% browser zoom at 1024px: no overlap, no clipped option text

### 5.3 Full game playable (logic regression — the redesign's real exam)

- [ ] **Bots game, start to podium:** create vs bots → all 10 rounds render 4 `.opt` buttons → instant feedback shows with `good`/`bad` styling → timer bar + `timer-text` count down → winner line, podium, and (with deliberate wrong answers) the missed-review list all render styled
- [ ] **Friends game, two tabs/devices:** create → code shows in `#lobby-code` → Copy button flips label and back → second tab joins → host Start appears **only** for the host → both answer, leaderboard updates live in both → Play Again returns both to the lobby
- [ ] **Custom quiz:** paste ≥200 chars of notes → `#quiz-status` confirms (colour correct) → `#quiz-reset-row` appears → reset returns to the default bank; upload a small PDF/TXT/MD via keyboard only (Tab to Upload, Enter) → quiz builds
- [ ] **Spectator:** join a room mid-game from a third tab → spectator note shows, no option buttons are actionable, player joins normally next game
- [ ] **Reconnect:** mid-game, go offline → `#conn-banner` appears; back online → banner hides and the seat/score are reclaimed under the same name
- [ ] **Leave from all three screens** (lobby, game, podium) returns to home
- [ ] Wrong room code → `#home-error` shows the message in the error style, layout does not shift

### 5.4 Accessibility & motion

- [ ] Keyboard-only pass: every control reachable and visibly focused, in DOM order (name → mode buttons → join → notes → upload → reset)
- [ ] Screen reader spot-check: quiz-build result, an answer verdict, and "n/m answered" are announced (live regions, O10)
- [ ] Contrast: `--ink-muted` on `--surface-1` and `--surface-2`, `--danger` on `--surface-1`, `--ink-on-accent` on `--accent` each ≥ 4.5:1 for body text (measure the *new* palette values — this is where a palette swap usually fails)
- [ ] `prefers-reduced-motion` emulated: no pop animation, no hover lift, timer still readable
- [ ] All touch targets ≥ 44px tall (measure `#btn-copy` and `#quiz-reset` specifically)
- [ ] Text entry on iOS-class device: focusing name/notes/code does **not** trigger page zoom (≥16px everywhere)

---

*End of plan. Implementation order that keeps the app shippable at every step: (1) tokens layer over the existing selectors → verify §5.1; (2) HTML semantics + outline with IDs frozen → verify §5.3; (3) layout grids + component renames → verify §5.2/§5.4.*
