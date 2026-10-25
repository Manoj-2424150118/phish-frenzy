# Phish Frenzy — UI/UX Redesign Specification

**Version:** 1.0 · **Status:** Implementation-ready · **Scope:** `public/index.html`, `public/app.js`, `public/style.css` only (no server or protocol changes; every socket event, payload and element ID stays as-is unless a section explicitly says *NEW element*).

**How to read this spec:** Measurements are in px at a 16px root (convert to rem in CSS: divide by 16). Copy marked **[KEEP]** is lifted verbatim from the current app and must not change. **[REWRITE]** replaces current copy. **[NEW]** is copy for states/elements that do not exist yet. Colour ratios are approximate, measured against the stated background.

**Current-state problems this spec fixes (evidence from the code):**

1. `.btn.small` (Copy code) is ~29px tall — under every touch-target minimum — and sits *inside* the Lobby `<h2>`, so it wraps unpredictably on narrow screens.
2. No `:focus-visible` style exists anywhere. Keyboard users get the browser default or nothing; hover is the only state language.
3. The Game header (`.game-top`) packs 4 items — round pill, timer bar, seconds, answered count — into one flex row that crowds and wraps below ~380px.
4. At round end only the *correct* option is marked (`.opt.correct`); the player's own wrong pick is never marked wrong.
5. No `prefers-reduced-motion` handling; `.pod.first` uses `transform: scale(1.05)`, which can push against card padding on small phones.
6. Notes textarea is 15px — under 16px, iOS Safari zooms the page on focus.
7. A long player name in a leaderboard row has no truncation rule; the row can overflow its card.
8. The brand `<h1>` has a one-off breakpoint at 520px while layout breakpoints live at 560px — the breakpoint system is accidental, not designed.

---

## 1. Design principles

1. **One column, one decision at a time.** Every screen is a single vertical reading path: what this is → what to do → the one primary action. Nothing competes side-by-side with the primary action except on desktop Game (§3.4), where the leaderboard becomes a rail and the question stays dominant.
2. **The primary action is always the loudest thing on screen.** Exactly one accent-yellow primary button per screen state. Everything else is ghost/secondary. If two things look primary, one of them is wrong.
3. **Nothing ever overlaps anything.** No floating buttons, no overlays on content, no badges pinned over text. Appearing elements (feedback, banners, notes) live in document flow and take real space. The only fixed layer is the decorative background glow, behind everything, `pointer-events: none`.
4. **Design for the thumb first, the cursor second.** All targets ≥44px tall (48px preferred), options are full-width cards, and the layout is proven at 320px wide before it is proven at 1440px.
5. **State is always visible in words, not just colour.** Correct/wrong/picked/away/host/spectator each carry an icon or text marker in addition to colour, so the game is readable in greyscale and to colour-blind players.
6. **Copy is short, warm and concrete.** Every line answers "what happens if I tap this?" in plain words. No jargon without an immediate translation (the hash line is the canonical example — §5).

---

## 2. Layout system

### 2.1 Spacing scale (4pt base)

| Token | Value | Used for |
|---|---|---|
| `space-1` | 4px | Letter-chip internal offsets, icon-to-text nudge |
| `space-2` | 8px | Inline gaps (pill ↔ button), list-item internal gaps |
| `space-3` | 12px | Grid gaps (options, modes), row gaps |
| `space-4` | 16px | Page gutter on phones, card-internal section gaps |
| `space-5` | 24px | Card padding (tablet/desktop), section separation |
| `space-6` | 32px | Between major Home sections |
| `space-7` | 48px | Above the footer, podium celebration spacing |

Rule: margins between stacked blocks come only from this scale; never use ad-hoc values (the current CSS mixes 6/10/14/18/22px — normalise).

### 2.2 Colour tokens (unchanged palette, formalised)

| Token | Value | Role | Contrast (approx.) |
|---|---|---|---|
| `--bg` | `#0b1020` | Page background | — |
| `--card` | `#141b33` | Screen card surface | — |
| `--inset` | `#0d1330` | Inset panels, inputs, rows | — |
| `--btn` | `#1e2a52` | Secondary button surface | — |
| `--line` | `#26305a` | All 1px borders/dividers | decorative only |
| `--ink` | `#eef1ff` | Primary text | ~13:1 on `--card` ✅ AAA |
| `--muted` | `#9aa5c9` | Secondary/helper text | ~7:1 on `--card`, ~7.5:1 on `--inset` ✅ AA |
| `--accent` | `#ffcf3f` | Primary buttons, highlights, code | ~10:1 on dark ✅; text on it is always `--on-accent` |
| `--on-accent` | `#221a00` | Text on accent surfaces | ~10:1 on `--accent` ✅ |
| `--ok` | `#2ee6a8` | Correct/success | ~8:1 on dark ✅ |
| `--danger` | `#ff5a6e` | Danger borders, large/bold error headings | ~4.3:1 on `--card` — **borders & bold only** |
| `--danger-text` | `#ff9db0` | **[NEW token]** Error *body* text | ~6.5:1 on `--card` ✅ AA |

Rules: body text is only ever `--ink` or `--muted` on `--card`/`--inset`; error sentences use `--danger-text`; `--danger` is for borders, fills behind large text, and icons. Streak/score numerals use `--accent`. No text on `--btn` except `--ink` buttons themselves.

### 2.3 Typography

| Style | Size / weight / line-height | Used for |
|---|---|---|
| Display | 34px / 800 / 1.1, `letter-spacing: 0.5px` | Brand `h1` only |
| H2 screen title | 24px / 800 / 1.2 | Lobby/Podium titles, winner line |
| H3 section | 18px / 700 / 1.3 | Mode card titles, How-to-play, Review |
| Prompt | 19px / 700 / 1.5 | The question itself |
| Body | 16px / 400 / 1.55 | Paragraphs, option text (options: 16px/500) |
| Helper | 14px / 400 / 1.5, `--muted` | Explanations under labels/cards |
| Fine | 13px / 400 / 1.5, `--muted` | Legends, hash proof, footnotes |
| Code display | 32px / 800, `letter-spacing: 8px` | Lobby room-code panel **[NEW]** |
| Code input | 20px / 800, `letter-spacing: 6px`, uppercase | Join code field |

All sizes in rem in implementation. `font-variant-numeric: tabular-nums` on scores, timer seconds and answered counts so digits never jitter width. Headings get `text-wrap: balance`. Body copy max line length is governed by the column widths in §2.4 (≈65ch at 680px).

### 2.4 Breakpoints and content widths

Four designed breakpoints (replaces the current accidental 520/560 pair). The app column is centred at **every** width — this is a phone-first game that happens to be viewable on a TV, not a desktop site.

| Breakpoint | Range | Page gutter | Card padding | Content max-width | What changes |
|---|---|---|---|---|---|
| **S — small phone** | ≤480px | 16px | 16px | 100% (fluid) | Everything single-column. Mode cards stack. Game header splits into two rows (§3.4). Podium: winner card full-width, 2nd/3rd side-by-side below. Brand `h1` 27px. |
| **M — large phone / small tablet** | 481–768px | 24px | 24px | 680px | Mode cards: 2 columns when viewport ≥600px, else stacked. Option cards: 2 columns when viewport ≥601px, else 1 column. Join row stays one line (code field flexes). |
| **L — tablet** | 769–1024px | 24px | 24px | 680px | Mode cards and options always 2 columns. Brand and card left-aligned within the centred column. More air: section gaps step up one token. |
| **XL — laptop / desktop** | ≥1025px | 32px | 28px | 680px for Home/Lobby/Podium; **1120px for Game** | Game screen only widens into a two-column grid: question + options in the main column, leaderboard as a right rail (§3.4). Hover states fully enabled; all other screens stay in the calm 680px column. |

Grid/flex rules that hold at every breakpoint:

- `.wrap` is the only centred container: `margin-inline: auto; padding-inline` per table; `padding-top: 20px`, `padding-bottom: 48px`.
- Card (`.card`) is the only elevated surface per screen. Inset panels (`.mode`, `.scenario`, `.howto`, rows) live *inside* it — never nest a card inside a card with the same elevation.
- Two-column grids use `gap: 12px` and equal `1fr` tracks; a grid item may never set its own width.
- Flex rows that can overflow (Lobby actions, Home join row) use `flex-wrap: wrap` with a defined wrap order — wrapping is designed, not accidental.
- No horizontal scrolling at any width, ever: `min-width: 0` on every flex/grid child that contains text, and long words/names truncate per §4.10.

### 2.5 Sticky / fixed policy (the no-overlap contract)

- **Forbidden:** fixed action bars, floating buttons, tooltips that cover content, badges positioned over text, modal dialogs (the app has none — keep it that way; all messaging is in-flow).
- **Allowed, decorative only:** `.bg-glow` — `position: fixed; inset: 0; z-index: -1; pointer-events: none`. It must sit *behind* the body background stacking context, never above content.
- **Allowed, in-flow sticky:** `#conn-banner` — `position: sticky; top: 0`. Because it is sticky *in flow*, it pushes content down when it appears and never covers anything. It gets `padding-top: calc(10px + env(safe-area-inset-top))`.
- **Allowed at XL only:** the Game leaderboard rail may use `position: sticky; top: 24px` *inside its own grid column*. It can never cross into the question column.
- Anything that appears after load (feedback banner, spectator note, quiz status, error text) is a normal block in the flow. Layout shift is acceptable; overlap is not. To soften shift, error/status regions reserve `min-height` (§4.4).

---

## 3. Screen-by-screen specification

Global chrome on every screen, top to bottom: connection banner (only when disconnected) → brand header → screen card → footer. The brand header shrinks once a game starts? **No** — keep it identical on all screens; consistency beats cleverness, and its 44px logo + two text lines cost little. Footer is static text, never interactive.

### 3.1 Home (`#screen-home`)

**Purpose:** name → match choice → play, in under 10 seconds. Everything else on this screen is optional depth.

Element order and hierarchy:

1. **Name block** (primary setup). Label above the field — split the current single long label into a real label + helper:
   - Label: `1 · Your name`
   - Helper (14px muted, above field): “No sign-up, no password — just the name your friends will see.”
   - Input `#name-input`: full width, 52px tall, 16px text.
2. **Match choice** — section heading: `2 · Pick your match`. Two `.mode` cards in the §2.4 grid:
   - **Card A — Solo vs Bots** (secondary path): heading, one-line body, ghost-or-primary? Both cards' buttons cannot both be primary (§1.2). Decision: **Bots button = secondary (ghost)**; the Friends **Create room = the screen's single primary**. Rationale: the mission is multiplayer-with-humans; bots are the warm-up. *(This reverses the current markup, where both are `.primary`.)*
   - **Card B — With Friends**: heading, body, primary **Create room** button (full card width), divider `Have a code from a friend?`, then the join row: code input (flexes, min-width 0) + **Join room** ghost button, both 52px tall. On S the row stays one line (input ≈ flexible 120–160px, button fixed content width); it must never wrap the button under the field.
3. **Error region** `#home-error` — directly under the modes grid, `role="alert"`, reserved `min-height: 24px` so its appearance never shoves the How-to panel.
4. **How to play** panel (`.howto`, collapsed depth): heading + 4 grouped rules (§5). It is *below* the actions on purpose — a returning player never scrolls past rules to play; a new player finds them before the notes section. On S it stays fully expanded (no accordion — accordions hide rules; the panel is short after the §5 rewrite).
5. **Divider** `Make it yours`.
6. **Notes quiz builder**: H3, one helper paragraph, textarea (min-height 120px, 16px text), action row: **Build my quiz** (secondary) + **Upload file** label-button (secondary). Status region `#quiz-status` with reserved min-height; when a quiz is active, the reset row appears as a full-width **ghost button** (§4.2), not a text link — links are not targets.

States: *quiz-ready* — status shows success text and the modes' helper line gains one line: “Your custom quiz is loaded — your next room uses it.” **[NEW element: `#quiz-loaded-note` inside the modes section]** so the consequence of building a quiz is visible at the point of action, not only below the fold.

Small-screen behaviour: strict single column; cards stack Bots-then-Friends? **No — Friends first on S** (primary path on top; use CSS `order` on the grid at ≤480 only, DOM order unchanged for screen readers… *correction:* visual reorder breaks §6 focus-order parity. Instead, stack in DOM order — Bots first is acceptable because its card is short (~150px) and the primary button is still the first *primary* the eye lands on. Final decision: DOM order, no reordering.)

### 3.2 Lobby (`#screen-lobby`)

**Purpose:** get the code out of the host's phone and into friends' phones; make waiting feel occupied.

Element order:

1. **Screen title** `Lobby` (H2) with eyebrow line above it: “Your room is open” (guests: “You're in”). **[NEW eyebrow element pattern, reused on Podium: “Game over”.]**
2. **Code panel** **[NEW structure — replaces the `<h2>Room <pill> <button>` line]**: an inset panel containing:
   - Caption (fine, muted, centred): `ROOM CODE`
   - The code itself: Code-display style (§2.3), centred, `--accent`.
   - **Copy code** button: full-width ghost, 48px, *inside* the panel under the code. After tap: label swaps to `✅ Copied` for 1.5s (existing behaviour — keep, and add `aria-live="polite"` on the button).
   - On M/L/XL the panel is horizontal instead: code left, Copy button right (auto width, min 160px). The switch happens at 481px.
3. **Share helper** (how text, §5): one paragraph, max two lines at 680px.
4. **Facts strip** **[NEW — replaces the current `.fine` run-on line]**: a single row of 4 mini-facts separated by `·`, wrapping to two lines on S: `10 questions` · `4 options each` · `25 sec per question` · `Most points wins`. Plus a second line only when relevant: host line / spectator note.
5. **Quiz source line** `#lobby-source` (fine): which quiz this room will play.
6. **Spectator note** `#spectator-note` (info banner, §4.7) — only for spectators.
7. **Player list** `#lobby-players`: heading **[NEW]** `Players (n)` above the list, n = live count. Rows per §4.10. Empty-state helper **[NEW]** shown when the list has exactly one human and no bots: “Just you so far — share the code and hang tight, or press Start to play solo.”
8. **Action row** (in flow, never sticky):
   - Host: primary **Start game** (flex-grow) + ghost **Leave room**.
   - Guest: ghost **Leave room** + waiting line (§5) in place of Start. The waiting line is text, not a disabled button — never show a button a user cannot use.
   - Spectator: ghost **Leave room** only; the spectator note (step 6) explains the wait.
9. On S, the action row stacks: primary full-width first, Leave full-width below it. On M+ they share one row.

### 3.3 Game (`#screen-game`)

**Purpose:** read question → tap answer → learn result. The leaderboard is supporting cast.

Element order (single column, S–L):

1. **Status header** — two rows on S, one row on M+:
   - Row A: round pill (left) · answered count (right, fine, tabular). 
   - Row B: timer bar (flex-grow) + seconds text (fixed 40px, right-aligned, tabular).
   - On M+ these merge into one row: pill · bar · seconds · answered. The bar must always have ≥120px of width; if a future item threatens that, the answered count drops to Row A — never shrink the bar below 120px.
2. **Scenario card** (`.scenario`): optional scenario text (italic, muted, 15px/1.55) then the prompt (Prompt style). Padding 16px (S) / 20px (M+). If there is no scenario, the card holds the prompt alone — the card never collapses to a different style.
3. **Options grid** `#options`: 4 option cards (§4.5). Column rule per §2.4 (1 col ≤600px viewport, 2 col ≥601px). **[Change from current: the switch is 601px, inside the M breakpoint, so 481–600px large phones get comfortable full-width options instead of two cramped columns.]**
4. **Feedback banner** `#feedback` (§4.6) — appears in flow under the options. On S, after it appears it should be scrolled into view (`scrollIntoView({block:'nearest'})` — implementation note) because the options grid is tall on a single column.
5. **Fair-play line** `#hash-line` (fine, muted): friendly sentence (§5); the raw hash/key move into a `<details>` disclosure **[NEW element]** labelled `See the proof` — curious players can open it; nobody else pays the visual cost.
6. **Leaderboard block**: H4 `Live leaderboard` + legend line (fine) `🔥 = 3+ correct in a row · 👑 = host · 👀 = watching`. Rows per §4.10. The local player's row is pinned by sort order only (score order) — never duplicated or stuck.
7. **Leave room** ghost button — full-width on S, auto on M+. Always last, always reachable by scroll, never sticky.

XL (≥1025px) Game layout: `#screen-game` becomes a grid, `grid-template-columns: minmax(0, 1fr) 320px; gap: 24px`, areas: header spans both columns; scenario+options+feedback+fair-play in the left column; leaderboard block in the right column as a rail (`position: sticky; top: 24px`, its own column only); Leave moves under the left column. Nothing else about the screen changes. DOM order is unchanged (leaderboard remains after options in source) — the rail is a visual placement of a supplementary block, and §6 documents the accepted focus-order note.

Game states to design for: *answering* (options enabled), *locked* (my pick marked, all disabled, waiting copy in feedback region: “Locked in — waiting for everyone else…”), *reveal* (correct marked, my wrong pick marked, feedback shows explanation), *spectating* (spectators never enter this screen — enforced in app.js today; the Lobby is their screen).

### 3.4 Podium (`#screen-podium`)

1. Eyebrow: `Game over`.
2. **Winner line** (H2, `#winner-line`): winner/tie text (§5). `text-wrap: balance`, centred.
3. **Podium cards** `#podium`: 3 cards. S: winner card full-width on top, 2nd and 3rd in a 2-column row beneath. M+: one row of 3, winner centre? **No** — keep source/visual order 1-2-3 left-to-right; elevation does the talking: winner card gets accent border + medal size 36px (others 30px). **Remove `transform: scale(1.05)`** — size difference comes from padding (winner 20px, others 16px) so nothing can overflow.
4. **Final standings** **[NEW H3]** above `#final-board` rows (same row component as Lobby/leaderboard).
5. **Review zone** `#review-zone`: H3 `Review the ones you missed`; one `.review-item` per miss (question, correct answer in `--ok`, explanation muted). *Perfect-game state* **[NEW]**: if there are no misses, show the zone with the single line in §5 instead of hiding it — a flawless game deserves acknowledgement, not a missing section.
6. **Action row**: host — primary **Play again** + ghost **Leave room**. Non-host — ghost **Leave room** + helper line (§5) explaining the host restarts. S: stacked full-width; M+: one row.
7. **Retirement note** (fine, last line): what happens to the code now (§5).

---

## 4. Component inventory

All components: `border: 1px solid var(--line)` where a border is specified, `box-sizing: border-box`, and the shared focus treatment in §4.1.

### 4.1 Focus-visible (applies to every interactive element)

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: inherit;
}
```
Plus: never remove `outline` without this replacement; focus ring must be visible against both `--card` and `--inset` (accent on both passes ≥3:1 for UI indicators). Mouse/touch focus (`:focus:not(:focus-visible)`) shows nothing — the current hover-only language stays for pointers.

### 4.2 Buttons

| Variant | Surface | Text | Use |
|---|---|---|---|
| Primary `.btn.primary` | `--accent` | `--on-accent`, 700 | The one main action per screen state |
| Ghost `.btn` (default) | `--btn` | `--ink`, 700 | Secondary actions, navigation, Leave |
| Small `.btn.small` **[REDEFINED]** | as ghost | 14px/700 | Inline utilities only (none in headings) |

Geometry: `min-height: 48px` (small: 44px), `padding: 12px 20px` (small: `10px 14px`), `border-radius: 12px`, font 16px (small 14px), `width: auto`; `.wide` = 100%. Button text never truncates and never wraps to more than 2 lines; labels in §5 are sized to fit one line at 320px.

States:
- **Hover** (pointer only): `border-color: var(--accent)`; primary: brightness 1.05. No translate (the current `translateY(-1px)` hover causes micro layout jitter against neighbours — remove).
- **Active/pressed:** `filter: brightness(0.95)`, no transform.
- **Focus-visible:** §4.1.
- **Disabled:** opacity 0.45, `cursor: not-allowed` **[change: current says `default`]**, no hover effect. Used only for true form-level disables (e.g. options after lock — options use their own disabled treatment, §4.5).
- **Busy** (quiz build, room create/join during the existing 1.2s debounce): keep the label, append `…`, set `aria-busy="true"`, disabled styling *without* the opacity drop (it is working, not unavailable) — implement as `.btn.busy { opacity: 0.75 }`.

**File-upload label-button** `.filebtn`: must match ghost-button geometry exactly (min-height 48px, same padding/radius), `display: inline-flex; align-items: center`, and the hidden file input must remain keyboard-focusable through the label (label receives `:focus-visible` via `:focus-within` on the label when the input is focused — add `.filebtn:focus-within { outline… }` per §4.1 pattern).

### 4.3 Inputs

| Field | Geometry | Notes |
|---|---|---|
| Text `#name-input` | 52px tall, padding 14px 16px, radius 12px, 16px text | `autocomplete="off"` stays; add `enterkeyhint="go"` |
| Code `#code-input` | 52px tall, Code-input type style, centred | Add `inputmode="text"`, `autocapitalize="characters"`, `autocomplete="one-time-code"` **[NEW attrs]**. Optical centring fix: `padding-left: calc(14px + 6px)` — letter-spacing adds trailing space after the last glyph; compensate or the code looks off-centre. This is exactly the kind of inch that matters. |
| Textarea `#notes-input` | min-height 120px, padding 14px 16px, radius 12px, **16px** text **[change from 15px — stops iOS focus zoom]**, `resize: vertical` | Character guidance lives in the helper (§5), not a counter |

States: **default** — `--inset` bg, `--line` border. **Focus** — border `--accent` + `box-shadow: 0 0 0 3px rgba(255,207,63,.25)`. **Error** (code field after a failed join; name never errors) — border `--danger`, and the message appears in `#home-error`, linked with `aria-describedby`. **Filled** — no visual change (this is a game, not a form wizard).

Labels: every field has a visible `<label>` (the name field keeps its wrapping label; the code field gets a visually-hidden label `Room code` **[NEW]** — its visible label is the divider text, which is not programmatically associated today).

### 4.4 Status & error regions

`#home-error`, `#quiz-status`: `min-height: 24px`, 15px/600, `role="alert"` for errors / `role="status"` for success **[NEW attributes]**. Error text colour `--danger-text`; success `--ok`. They reserve their height at all times so content below never jumps (fixes the current empty `<p>` that still shifts layout when filled, because its `min-height` is only 20px and font metrics overflow it).

### 4.5 Option cards (`.opt`) — the most-touched component in the app

Geometry: `min-height: 56px`, `padding: 14px 16px`, `border-radius: 12px`, `--btn` surface, 1px `--line` border, text 16px/500 left-aligned, `display: flex; gap: 12px; align-items: flex-start`. Letter chip: 28×28px, radius 8px, `--accent` bg / `--on-accent` text, 800, centred, `flex: none`, `margin-top: 1px` optical alignment with the first text line. Option text wraps freely; the card grows — options never truncate.

| State | Treatment |
|---|---|
| Default | as above |
| Hover (pointer, enabled only) | border `--accent` |
| Focus-visible | §4.1 |
| **Picked** (mine, awaiting reveal) | inset ring `box-shadow: inset 0 0 0 2px var(--accent)` + chip stays accent + trailing marker `●` … no — marker is the word: append a small `You` tag (fine, accent border pill) at the card's right edge **[NEW]**. Colour alone is not enough (§1.5). |
| **Correct** (at reveal) | inset ring `--ok` 2px + chip bg becomes `--ok` + a `✓` glyph appended after the text **[NEW]** |
| **Wrong-picked** (at reveal, my pick ≠ correct) **[NEW state — does not exist today]** | inset ring `--danger` 2px + chip bg becomes `--danger` + `✗` glyph appended. Requires app.js to add `.wrong` to the viewer's picked card in the `round_end` handler (picked index is already tracked client-side via `.picked`). |
| Disabled (not picked, at reveal or after lock) | opacity 0.55, except the correct card stays full opacity. After *my* lock but *before* reveal, unpicked cards sit at opacity 0.75 (the round is still live for others; don't make them look dead). |
| Disabled (after reveal) | as above; no hover, no pointer |

### 4.6 Feedback banner (`#feedback`)

Geometry: radius 14px, padding 16px, 16px/1.55, in-flow, `margin-top: 16px`. Variants:
- `.good`: bg `#0f2e26`, border `--ok`. Structure: headline line (700, includes points) / breakdown line (14px, muted) / explanation (16px). See §5 for the exact three-line template — the current single `<br>` blob becomes three stacked elements.
- `.bad`: bg `#2e1420`, border `--danger` (border may be `--danger`; the headline text is `--ink`, explanation `--ink` at 90% — body copy never in `--danger`).
- `.waiting` **[NEW variant]**: bg `--inset`, border `--line`, text muted — for the locked-waiting state before the personal result arrives and for the between-rounds beat. Keeps the region's space reserved, killing the layout pop when the real result lands.
- `role="status"` on the banner so screen readers announce results **[NEW attribute]**.

### 4.7 Info / warning banners

- **Spectator note** & **quiz-loaded note**: info style — `--inset` bg, `--line` border, `--ink` text with a muted lead emoji, radius 12px, padding 12px 16px, 15px.
- **Connection banner** `#conn-banner`: warning style — bg `#3a1420`, border-bottom `--danger`, text `#ffd7dc` (≥7:1 on that bg ✅), 15px/600, centred, sticky-in-flow per §2.5, `role="alert"`. It appears/disappears by sliding content, never overlaying it.

### 4.8 Pills

- **Round pill** `#round-label`: `--inset` bg, `--line` border, radius 999px, padding 6px 14px, 14px/800, `--accent` text, `letter-spacing: 1px` **[change from 2px — at 14px, 2px tracking makes "Round 3/10" look shouty and eats width]**, tabular nums.
- **Code pill** (current `#lobby-code` inside the pill class): **retired** in favour of the Lobby code panel (§3.2) — big, centred, copyable. The pill class remains only for the round label.

### 4.9 Timer (`.timerbar` + `#timer-text` + `#answered-label`)

- Bar: height 10px, radius 999px, track `--inset` with `--line` border, fill = the existing gradient (ok→accent→danger). Fill width transition `0.2s linear` (removed under reduced motion, §6).
- **Urgency state** **[NEW]**: at ≤5s remaining, the *seconds text* turns `--danger-text` and gains weight 800 (already 800 — colour only), and the fill becomes solid `--danger`. One signal, two channels (colour + the numeral itself counting down). No flashing, no shake — ever.
- Seconds: 16px/800, `min-width: 40px`, right-aligned, tabular.
- Answered count: fine (13px) muted, tabular, format `3/5 answered`.
- Semantics: bar wrapper gets `role="progressbar"`, `aria-label="Time left"`, `aria-valuemin="0"`, `aria-valuemax="25"`, `aria-valuenow` updated **once per second** (not per 100ms tick) **[NEW attributes]**; seconds text is `aria-hidden` (the progressbar speaks).

### 4.10 Player rows (`.players li`) — Lobby, Leaderboard, Final standings

Geometry: `--inset` bg, `--line` border, radius 12px, `padding: 12px 14px`, `min-height: 48px`, flex row, gap 12px, `margin-bottom: 8px`.
- Left cell: `min-width: 0`, name truncates with ellipsis (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`). Rank numeral + name + markers in one line. Markers: 👑 host, 👀 spectator, 🔥+n streak (in the score cell, as today).
- **“You” tag** **[NEW]**: my row gets the accent border (exists) *plus* a small `You` pill after my name — border alone fails §1.5 for anyone who can't see the colour difference.
- Score cell: `flex: none`, 16px/800 `--accent`, tabular. Streak suffix ` 🔥3` in the same cell.
- **Away state**: row opacity 0.6 and name suffix ` (away)` in muted (exists as text — keep, add the opacity).
- **Bots**: name suffix ` · Bot`? Not today — bots are named “RoboRita 🤖”. Keep names as the server sends them; no extra tag.
- List headings: Lobby uses `Players (n)`; Game/Podium use their §3 headings. One row component, three contexts — do not fork the CSS.

### 4.11 Podium cards (`.pod`)

`--inset` bg, `--line` border, radius 14px, padding 16px 18px, min-width 0 (drop the current `min-width: 120px`, which can force overflow at 320px once gaps are counted), text centred. Medal: 30px (winner 36px). Name: 16px/700, truncates with ellipsis. Score: accent 800 tabular. Winner: accent border + padding 20px (no transform scale — §3.4).

### 4.12 Review items (`.review-item`)

As current (inset, radius 12, padding 14px 16px, stacked, `margin-bottom: 10px`), with structure fixed: question (700) / `Correct answer:` line with the answer in `--ok` 600 / explanation muted 15px. One item per miss, in the order missed.

### 4.13 Dividers (`.divider`)

Keep the hairline-with-centred-label pattern. Label: 13px, `--muted`, `letter-spacing: 0.4px`, lowercase as styled in §5. Vertical margins: 24px above, 8px below **[normalised from 22px/4px]**.

---

## 5. Final copy deck

Conventions: `{n}` = live value. Emoji are decorative and always paired with words. Nothing here requires a server change; strings sourced from the server are listed at the end as **SERVER — KEEP VERBATIM**.

### 5.1 Global

| Slot | Final copy | Status |
|---|---|---|
| Page `<title>` | `Phish Frenzy — the scam-spotting quiz you play with friends` | REWRITE |
| Brand tagline | `The multiplayer quiz arena — spot scams, top the board.` | KEEP |
| Footer | `Free to play • No logins • Built for the Handshake × OpenAI “Create a Multiplayer Game” mission` | KEEP |
| Connection banner | `⚠️ You're offline — reconnecting… Rejoin this room with the same name to keep your seat and score.` | REWRITE (shorter; current buries the recovery action) |
| Leave buttons (all screens) | `Leave room` | KEEP |

### 5.2 Home

| Slot | Final copy | Status |
|---|---|---|
| Name label | `1 · Your name` | REWRITE |
| Name helper | `No sign-up, no password — just the name your friends will see.` | NEW |
| Name placeholder | `e.g. Manoj` | KEEP |
| Match heading | `2 · Pick your match` | REWRITE |
| Bots card title | `🤖 Solo vs Bots` | KEEP |
| Bots card body | `Two house bots, zero waiting. The perfect warm-up.` | REWRITE |
| Bots button | `Play vs Bots` | KEEP |
| Friends card title | `👥 With Friends` | REWRITE (was “Play with Friends” — verb now lives in the buttons) |
| Friends card body | `Start a room, share its code, and race your friends on the same quiz — live, on any device.` | REWRITE |
| Create button | `Create room` | REWRITE (was “Create a room”) |
| Join divider | `Have a code from a friend?` | REWRITE |
| Code placeholder | `CODE` | KEEP |
| Join button | `Join room` | KEEP |
| Join error (client, wrong length) | `Room codes are 4 letters — check the code and try again.` | REWRITE |
| Enter fallback error | `Something blocked the door — give it another tap.` | REWRITE (was “Could not enter the room.”) |
| Quiz-loaded note (at modes) | `✅ Your custom quiz is loaded — the next room you open plays it.` | NEW |
| How-to heading | `📖 How to play` | REWRITE |
| How-to subline | `The whole game in 20 seconds:` | NEW |
| How-to — The goal | `**The goal.** Most points wins. A game is 10 questions, everyone answers the same one at the same time, and the podium at the end crowns the winner. 🏆` | REWRITE (merges current bullets 1, 2, 5) |
| How-to — Scoring | `**Scoring.** A correct answer is worth 100 pts, plus up to 100 more for speed, plus a 25-pt bonus when you hit 3 correct in a row — that's the 🔥 beside a name. You get 25 seconds per question, and one tap locks your answer in for good.` | REWRITE (merges current bullets 3, 4) |
| How-to — The room | `**The room.** The 👑 host (whoever created the room) presses Start and Play again. Up to 12 players fit. Joining mid-game? You watch this one and play from the next. Your room code stays alive while your group is playing and is deleted only after the game ends and everyone has left — anyone with the code can join, so share it with your group only.` | REWRITE (merges current bullets 6, 7) |
| How-to — If you drop | `**If you drop.** Rejoin the same room with the same name and your seat and score are yours again.` | REWRITE (current bullet 8) |
| Notes divider | `Make it yours` | KEEP |
| Notes heading | `📚 Turn your notes into a quiz` | REWRITE (was “Build a quiz from YOUR notes”) |
| Notes helper | `Paste your notes or upload a file, and we'll write a fresh 4-option quiz from them — definitions like “X is…” work best. Your room plays your quiz; everyone else's rooms never see it. Fewer than 10 questions in your notes? Your game is just a little shorter.` | REWRITE |
| Notes placeholder | `Paste your notes here… (definitions like “Photosynthesis is the process by which…” work best)` | KEEP |
| Notes helper (constraints) | `Notes need at least 200 characters. Files: PDF, TXT or MD, up to 6 MB.` | NEW (constraints currently discoverable only via errors) |
| Build button | `Build my quiz` | REWRITE (was “Build quiz from pasted notes”) |
| Build busy label | `Writing your questions…` | NEW |
| Upload button | `Upload PDF / TXT / MD` | KEEP |
| Notes too short | `Paste a bit more — at least a few paragraphs of notes (200+ characters).` | KEEP |
| Build working (paste) | `Analysing your notes and building questions…` | KEEP |
| Build working (file) | `Reading {filename} and building questions…` | KEEP |
| Build success (paste) | `✅ Custom quiz ready — {n} questions built from your notes. Now create a room or play vs Bots and your room will use THIS quiz.` | KEEP |
| Build success (file) | `✅ Custom quiz ready — {n} questions built from {filename}. Now create a room or play vs Bots.` | KEEP |
| Build failure (paste) | `Something went wrong building the quiz. Try again.` | KEEP |
| Build failure (file) | `Could not read that file. Try pasting the notes instead.` | KEEP |
| Reset row | `Using your custom quiz for your next room.` + button `Switch back to the built-in bank` | REWRITE (link → ghost button; drops the “scam-spotting” mouthful) |
| Reset done status | `Back to the built-in scam-spotting bank for your next room.` | KEEP |

### 5.3 Lobby

| Slot | Final copy | Status |
|---|---|---|
| Eyebrow (host) | `Your room is open` | NEW |
| Eyebrow (guest) | `You're in` | NEW |
| Title | `Lobby` | NEW (the code panel now carries the code; “Room” as a heading duplicated it) |
| Code panel caption | `ROOM CODE` | NEW |
| Copy button | `📋 Copy code` → after tap `✅ Copied` | KEEP (was “Copy code” — add the clipboard glyph to match its icon-button siblings) |
| Share helper | `Friends: send them this page's link, then the code. They tap With Friends, type the code, and they're in. The code stays alive until the game ends and everyone has left.` | REWRITE |
| Facts strip | `10 questions · 4 options each · 25 sec per question · Most points wins` | REWRITE (was one long `.fine` sentence) |
| Host line | `👑 You're the host — you press Start when your crew is in.` | NEW (guests currently get no explanation of 👑; the generic line tried to serve both) |
| Guest line | `👑 marks the host — only they can start the game.` | REWRITE (splits current combined line) |
| Quiz source | `Quiz: {sourceTitle} • {n} questions this game` | KEEP (app.js format) |
| Players heading | `Players ({n})` | NEW |
| Solo empty-state | `Just you so far — share the code and hang tight, or press Start to play solo.` | NEW |
| Spectator note | `👀 A game is running in this room — you're watching this one and will play from the next game.` | KEEP |
| Start button | `▶ Start game` | KEEP |
| Guest waiting line | `Waiting for the host to start…` | KEEP |
| Resumed-join toast/status | *(none — silent today; keep silent. The seat simply reappears.)* | KEEP (decision) |

### 5.4 Game

| Slot | Final copy | Status |
|---|---|---|
| Round pill | `Round {round}/{total}` | KEEP |
| Answered count | `{a}/{total} answered` | KEEP |
| Timer seconds | `{s}s` (e.g. `25s`, `0s` at end) | KEEP |
| Board heading | `Live leaderboard` | KEEP |
| Board legend | `🔥 = 3+ correct in a row · 👑 = host · 👀 = watching` | REWRITE (was parenthetical “(🔥 = 3+ correct in a row)” inside the heading; host/spectator glyphs were unexplained) |
| Locked-waiting feedback | `Locked in — waiting for everyone else…` | NEW (fills the `.waiting` banner between my tap and the result) |
| Feedback — correct, headline | `✅ Correct! +{gain} pts` | KEEP |
| Feedback — correct, breakdown | `100 for the answer` + (if speed > 0) ` · +{speed} for speed` + (if streak) ` · +{streak} streak bonus 🔥` + ` — your score: {score}` | REWRITE (same data, punctuated as a sentence instead of the current parenthesis blob) |
| Feedback — wrong, headline | `❌ Not quite — your answer is locked in.` | KEEP |
| Feedback — wrong, answer line | `Correct answer: {correctText}` | KEEP |
| Feedback — time's up, headline | `⏰ Time's up.` | KEEP |
| Fair-play line (during question) | `🔒 The answer is already locked in — nobody can peek at it or change it.` | REWRITE (current line leads with “verification hash”, jargon first) |
| Fair-play line (at round end) | `🔒 Fair-play check passed — that answer was locked before anyone played.` | REWRITE |
| Fair-play disclosure label | `See the proof` | NEW |
| Fair-play disclosure body | `Locked with hash {commit12}… · revealed with key {salt8}… at round end. Anyone can re-check the maths — the answer never moved.` | REWRITE (houses the current hash/key text) |
| Away suffix in rows | `(away)` | KEEP |

### 5.5 Podium

| Slot | Final copy | Status |
|---|---|---|
| Eyebrow | `Game over` | NEW |
| Winner line (single winner) | `🏆 {name} wins with {score} pts!` | KEEP |
| Winner line (tie) | `🏆 It's a tie — {names} win with {score} pts!` | KEEP |
| Winner line (no scores) | `🏆 Final results` | KEEP |
| Standings heading | `Final standings` | NEW |
| Review heading | `📚 Review the ones you missed` | REWRITE (was “Review — the ones you missed”) |
| Review item — answer label | `Correct:` | KEEP |
| Review — perfect game (empty state) | `🎯 Flawless — you missed nothing, so there's nothing to review. Take a bow.` | NEW |
| Play-again button | `Play again` | REWRITE (was “Play again in this room” — the room context is on screen; shorter label fits one line at 320px) |
| Non-host helper | `Want another round? The host can tap Play again — this room stays open until everyone leaves.` | REWRITE (was “Non-hosts: the host can restart…”) |
| Retirement note | `When everyone leaves, this room code is deleted and retired.` | REWRITE (splits off from the helper above; the fact deserves its own quiet line) |

### 5.6 Server-sourced strings — KEEP VERBATIM (do not edit during implementation)

These render through the same regions above and are already plain and correct: `Room not found. Check the code — codes stay valid until a game finishes and everyone leaves.` · `That room is full (12 players max).` · `Too many wrong codes — wait a minute and try again.` · `The arena is full right now — try again in a bit.` · quiz-source titles (`Phish Frenzy — Scam-Spotting Bank`, `Custom quiz: {title}`). One alignment note: the room-full string says “12 players max”, and §5.3's How-to copy says “Up to 12 players fit” — the numbers agree; keep them agreeing forever.

---

## 6. Accessibility

**Contrast.** Targets: body text ≥4.5:1, large text (≥18px, or 14px/700+) ≥3:1, UI indicators (focus ring, option rings, timer fill) ≥3:1 against adjacent colours. The token table (§2.2) already meets these with two enforced rules: error *sentences* use `--danger-text` (never `--danger`), and muted helper text never sits on `--btn` (its ratio there drops toward ~5.5:1 — still AA, but `--inset`/`--card` are the sanctioned homes for muted).

**Colour is never the only signal.** Picked = ring + “You” tag; correct = ring + ✓ + chip colour change; wrong = ring + ✗; host = 👑 + (in Lobby) a sentence; spectator = 👀 + a note; urgency = colour + the numeral itself. The game must remain fully playable with colour vision removed.

**Focus order.** DOM order is the focus order on every screen; no `tabindex` beyond native, no CSS reordering that changes sequence meaning. The two accepted visual/source divergences, both supplementary content: (a) the XL Game leaderboard rail (visually right, sourced after the options — a keyboard user reaches Leave before the rail, which is correct priority), (b) the connection banner is first in DOM and first in order — correct, it's the most urgent thing on the page when visible. Screen-change handling: when a screen swaps (`show()`), move focus to that screen's heading (`tabindex="-1"`) **[NEW behaviour]** — today focus is simply lost to `<body>` on every transition, the single biggest screen-reader defect in the app.

**Live regions.** `#home-error` and server join errors: `role="alert"`. `#quiz-status`, `#feedback`: `role="status"`. Copy button confirmation: `aria-live="polite"`. The leaderboard is **not** a live region (it updates several times a round — pure noise); the personal feedback banner carries the announcements that matter. Timer: §4.9 progressbar semantics, `aria-valuenow` at 1Hz; never announce the answered-count.

**Reduced motion.** Under `@media (prefers-reduced-motion: reduce)`: the `.screen.active` pop animation is removed (screens simply appear); all transitions (`0.15s` buttons, `0.2s` timer fill, option hovers) become `none` — the timer then steps once per second, which the 1Hz `aria-valuenow` already matches; no element uses transform-based motion anywhere in this spec (hover lift and podium scale are deleted, not gated). Nothing in the app flashes, pulses or shakes in any mode.

**Text scaling & zoom.** Layout must survive 200% browser zoom and 200% OS text scaling without horizontal scroll or clipped controls: no fixed heights on text containers (min-heights only on controls), buttons may grow vertically, option text and scenario text wrap freely, rows truncate names rather than grow. At 320px CSS width (the WCAG reflow floor) every screen in §3 must still work: the two-row Game header, stacked action rows and the S podium arrangement exist precisely for this. iOS: all form fields ≥16px (§4.3) so focus never triggers auto-zoom.

**Touch & pointer.** Targets ≥44px (§4), with ≥8px non-overlapping space between adjacent targets (grid gaps are 12px ✓). `touch-action: manipulation` on buttons/options to remove double-tap zoom delay. No hover-only functionality exists or may be added.

**Semantics quick wins (implementation notes, no visual change):** options are real `<button>`s (already true — keep); the file input's label gets `:focus-within` focus styling (§4.2); `#lobby-code` text is plain text, selectable, not an image; headings follow one `h1` (brand) → `h2` per screen → `h3` sections, with the Game leaderboard demoted from `h4`-skipping to `h3` **[markup fix]**.

---

## 7. Detail checklist — the inches

**Layout & alignment**
- [ ] Letter-spaced centred text optically re-centred: code input gets `padding-left: calc(14px + 6px)`; code panel display text gets `margin-right: -8px` equivalent compensation (or `text-indent: 8px`) so the 4 glyphs sit truly centred.
- [ ] Letter chip in option cards aligns to the first text line (`margin-top: 1px`), not the card's vertical centre — options with 1-line and 3-line text must have their chips on the same baseline.
- [ ] All inset panels share one internal padding rhythm: 16px (S) / 20px (M+). The scenario card, mode cards, how-to panel and review items must line up on the same left edge inside the card.
- [ ] Dividers' labels sit on the card background, not the panel background — check the Home divider between How-to and Notes against the `.howto` panel edge.
- [ ] Podium winner card: no `transform: scale()` anywhere; emphasis via border + padding only.
- [ ] Leaderboard rank numerals use tabular figures so `1.` and `11.` don't shift the name column.

**Device chrome & viewport**
- [ ] `body { min-height: 100dvh }` (with `100vh` fallback line first) — mobile Safari's collapsing URL bar must not clip the footer or fake a shorter page.
- [ ] Safe areas: `.wrap` gets `padding-left/right: max(gutter, env(safe-area-inset-left/right))`; connection banner gets `padding-top: calc(10px + env(safe-area-inset-top))`. Landscape phones with notches are a stated device class, not an afterthought.
- [ ] `overscroll-behavior-y: none` on body is **not** applied — pull-to-refresh is a legitimate recovery gesture in a realtime game; leave it alone. (Deliberate non-change, recorded.)
- [ ] `-webkit-tap-highlight-color: transparent` globally; the pressed state (§4.2) replaces the grey flash with designed feedback.

**Type & numerals**
- [ ] `font-variant-numeric: tabular-nums` on: timer seconds, answered count, all score cells, round pill.
- [ ] Headings `text-wrap: balance`; winner line especially (a two-line tie announcement must not orphan one word).
- [ ] Scenario text keeps `white-space: pre-wrap` (question content contains intentional line breaks) — regression-check after any CSS normalisation.
- [ ] No text below 13px anywhere; the floor is `.fine` at 13px, and it is for legends/proofs only, never instructions.

**Interaction micro-details**
- [ ] The 1.2s create/join debounce: button enters `.busy` (§4.2), label unchanged — users must never see a dead-looking button with no explanation.
- [ ] Copy-code success reverts after exactly 1.5s (existing timing — keep) and does not steal focus.
- [ ] After answering on a single-column phone, feedback scrolls into view (`block: 'nearest'`); on two-column layouts it must not scroll at all (it's already visible).
- [ ] When the round ends, the correct card's ✓ and my wrong card's ✗ appear in the same frame as the feedback banner — one reveal moment, not three staggered ones.
- [ ] File input resets after a failed upload so picking the *same* file again re-fires `change` (set `e.target.value = ''` in the handler) — a classic silent dead-end.
- [ ] Name field: `maxlength=16` already matches the server cap; the helper (§5.2) doesn't need to mention it, but the field must never silently eat the 17th character without the user noticing the cap while typing — acceptable as-is; do not add a counter (noise).

**Consistency sweeps**
- [ ] One emoji policy: emoji appear in headings, buttons' lead position, and markers — never mid-sentence in instructions, never as the only carrier of meaning.
- [ ] Every button label in the app is a verb phrase or a noun naming its destination (`Leave room`, `Play again`, `Build my quiz`) — audit after implementation against §5; no label may be “OK”, “Submit” or “Click here”.
- [ ] The number 12 (players), 10 (questions), 25 (seconds), 100/100/25 (scoring) appear in exactly the places §5 lists — if a game parameter ever changes, this deck is the checklist for updating every surface at once.
- [ ] `border-radius` audit: cards 18px, panels/buttons/inputs/rows 12px, feedback 14px, pills 999px, chips 8px. No other radii exist.
