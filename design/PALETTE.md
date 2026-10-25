# Phish Frenzy — Colour System & Design Tokens

**Role of this document:** the single source of truth for colour in the app. Every colour in
`public/style.css` must resolve to a token defined here. No raw hex values in component CSS.
Dark theme only (the game is played indoors, at night, in group settings — dark surfaces make
the gold brand accent and the saturated semantic colours carry at low brightness).

**Design logic:** a four-step navy elevation ladder (page → card → inset → raised) does all the
structural work; **one** brand colour (Arena Gold) means "brand / primary action / score";
each semantic colour has exactly one meaning everywhere it appears. Colour is never the only
signal — see §6.

All contrast ratios below were computed with the WCAG 2.x relative-luminance formula against
the exact backgrounds each token is used on. Body text targets **≥ 4.5:1 (AA normal)**;
large/bold text **≥ 3:1 (AA large)**; interactive component boundaries **≥ 3:1 (WCAG 1.4.11)**.

---

## 1. Core palette

Drop-in replacement for the `:root` block in `style.css`:

```css
:root{
  /* Background elevation ladder — each step is one visible "lift" */
  --bg-0:#0B1020;          /* page background (deepest) */
  --bg-1:#141B33;          /* card / screen surface */
  --bg-2:#0D1330;          /* inset: inputs, mode cards, how-to, scenario, rows, podium tiles */
  --bg-3:#1E2A52;          /* raised interactive: default buttons, answer options */
  --bg-4:#27376B;          /* raised hover */
  --bg-disabled:#171E38;   /* disabled controls */

  /* Borders */
  --border:#26305A;            /* decorative hairlines: card edges, dividers, podium tiles */
  --border-strong:#35427A;     /* emphasised separators, hover on secondary buttons */
  --border-interactive:#586DAF;/* boundaries of inputs & controls — ≥3:1 against bg-1 and bg-2 */

  /* Text */
  --text-1:#EEF1FF;        /* primary: headings, prompts, option text, names */
  --text-2:#C3CBE8;        /* secondary: sub-headings, scenario sender lines, winner name */
  --text-3:#9AA5C9;        /* muted: tagline, help copy, fine print, board titles, footer */
  --text-disabled:#828FB0; /* disabled control labels (still AA — we do not rely on the exemption) */

  /* Brand + primary action — Arena Gold */
  --accent:#FFCF3F;         /* brand gold: primary buttons, score, room-code pill, links */
  --accent-hover:#FFD964;   /* primary hover */
  --accent-active:#F5BC1F;  /* primary pressed */
  --on-accent:#221A00;      /* text/icon colour ON gold fills */
  --accent-ink:#FFD964;     /* gold text variant on tinted gold backgrounds (host badge) */

  /* Focus */
  --focus:#6EC1FF;          /* focus-visible ring — ice blue, deliberately NOT gold,
                               so the ring stays visible on gold primary buttons too */

  /* Effects */
  --shadow-card:0 18px 50px rgba(0,0,0,.53);  /* replaces the ad-hoc #0008 shadow */
  --scrim:rgba(4,6,14,.72);                    /* future overlays/modals */
}
```

Rules for the core set:

- **Elevation is information.** Interactive things sit on `--bg-3`; static containers on
  `--bg-2`; the screen itself on `--bg-1`; the page on `--bg-0`. Never put `--bg-3` inside
  `--bg-3`, and never use a shadow to fake a step the ladder should provide.
- **Gold is rationed.** `--accent` may appear at most as: the one primary action per screen,
  the score numerals, the room-code pill, the logo wordmark span, links, and the winner's tile.
  If everything is gold, nothing is. Body copy is never gold.
- **Text hierarchy is three steps only** (`--text-1/2/3`). If a designer reaches for a fourth
  grey, the layout is probably trying to say something structure should say instead.
- The old variables map 1:1 for migration: `--bg` → `--bg-0`, `--card` → `--bg-1`,
  `--ink` → `--text-1`, `--muted` → `--text-3`, `--line` → `--border`, `--ok` →
  `--success`, `--danger` → `--danger`.

---

## 2. Semantic palette

Each semantic colour ships as a set of four: **solid** (icons, borders, large text),
**bg** (tinted banner/panel fill), **border**, **text** (readable copy on the tinted bg).
Never mix sets (e.g. danger text on success bg).

```css
:root{
  /* Success — correct answer, quiz built, copied, resumed */
  --success:#2EE6A8;
  --success-bg:#0E2F24;
  --success-border:#2EE6A8;
  --success-text:#8FF5CE;

  /* Danger / error — wrong answer, form errors, destructive */
  --danger:#FF5A6E;
  --danger-bg:#30141F;
  --danger-border:#FF5A6E;
  --danger-text:#FFD7DC;

  /* Warning — recoverable problems: connection lost, room expiring, risky action */
  --warning:#FF9F43;
  --warning-bg:#33200E;
  --warning-border:#FF9F43;
  --warning-text:#FFC98A;

  /* Info — neutral machine truth: answer-lock hash, quiz source, counts */
  --info:#5AB0FF;
  --info-bg:#10263F;
  --info-border:#5AB0FF;
  --info-text:#A9D4FF;

  /* Streak — momentum, fire. Never used for errors despite being warm. */
  --streak:#FF7A45;
  --streak-bg:#331A0E;
  --streak-border:#FF7A45;
  --streak-text:#FFB08A;

  /* Host — gold family (authority = brand), always crown-paired */
  --host-bg:#2E2410;
  --host-border:#FFCF3F;
  --host-text:#FFD964;   /* = --accent-ink */

  /* Bot — violet: artificial players are visibly "not people" */
  --bot:#B18CFF;
  --bot-bg:#241640;
  --bot-border:#B18CFF;
  --bot-text:#D3BCFF;

  /* Spectator — desaturated slate-cyan: present, passive, not playing */
  --spectator:#5E87A0;
  --spectator-bg:#1C2B3A;
  --spectator-border:#5E87A0;
  --spectator-text:#A8CBDD;
}
```

Semantic usage notes:

- **Success vs. streak:** mint = "correct/done"; ember orange = "on fire". A streak indicator
  must never be mint (that would read as another correctness signal).
- **Danger vs. warning:** danger = something is wrong / was wrong (wrong answer, invalid
  code). Warning = something *might* go wrong or is temporarily degraded (connection lost —
  it is recoverable, so the connection banner moves from its current danger tint to
  **warning** tokens). This distinction is the highest-value correction in this palette.
- **Info is the quietest voice.** Hash line, "Quiz: Custom quiz…", answered-counts. If it
  needs attention, it isn't info.
- **Host gold vs. accent gold:** same family by design — the host *is* the brand authority in
  the room. They are still visually distinct: primary actions are **solid gold fill with dark
  text**; host markers are **tinted gold bg with gold text plus the 👑 glyph**.

---

## 3. Gradient & glow rules

**Allowed — only these three places:**

1. **Timer fill** (`#timer-fill`): `linear-gradient(90deg, var(--success), var(--accent), var(--danger))`.
   The gradient is a *progress metaphor* (plenty → little time) and is always paired with the
   numeric seconds text — meaning never rides on the gradient alone. No other element may use
   a multi-hue gradient.
2. **Page ambience** (`.bg-glow`): two radial glows, indigo `rgba(43,58,122,.33)` top-left
   and wine `rgba(122,43,77,.27)` top-right, over `--bg-0`, `pointer-events:none`. This is
   atmosphere, not UI: no text, border or control may depend on it for legibility, and all
   contrast in §4 is measured against flat `--bg-0`, so the glow can never break AA.
3. **Winner moment**: the first-place podium tile may add
   `box-shadow:0 0 0 2px var(--accent), 0 10px 34px rgba(255,207,63,.22)`. Celebration is the
   one place a gold glow is earned.

**Forbidden:**

- Gradients on buttons, option cards, banners, badges or text (no gradient text, ever).
- The logo drop-shadow in its current form (`#ffcf3f66` hard-coded) — replace with
  `drop-shadow(0 4px 14px rgba(255,207,63,.40))`, the only other sanctioned glow.
- Glow/shadow as a state signal (hover, picked, correct). States are communicated by border,
  fill and inset ring tokens (§5), never by blur.
- Any colour in a gradient that is not a token from §1–§2.

---

## 4. Contrast table (WCAG 2.x, computed)

AA normal text requires ≥ 4.5:1; AA large/bold ≥ 3:1; component boundaries ≥ 3:1 (1.4.11).
**Every text pairing used in the app passes AA for normal text**, including fine print.

| Pairing (where used) | FG | BG | Ratio | AA normal | AA large |
|---|---|---|---|---|---|
| Primary text on page | #EEF1FF | #0B1020 | 16.82:1 | ✅ PASS | ✅ PASS |
| Primary text on card | #EEF1FF | #141B33 | 15.12:1 | ✅ PASS | ✅ PASS |
| Primary text on inset (inputs, how-to) | #EEF1FF | #0D1330 | 16.19:1 | ✅ PASS | ✅ PASS |
| Primary text on raised (buttons, options) | #EEF1FF | #1E2A52 | 12.37:1 | ✅ PASS | ✅ PASS |
| Primary text on raised hover | #EEF1FF | #27376B | 10.11:1 | ✅ PASS | ✅ PASS |
| Secondary text on card | #C3CBE8 | #141B33 | 10.55:1 | ✅ PASS | ✅ PASS |
| Secondary text on inset | #C3CBE8 | #0D1330 | 11.30:1 | ✅ PASS | ✅ PASS |
| Muted text on page (footer) | #9AA5C9 | #0B1020 | 7.75:1 | ✅ PASS | ✅ PASS |
| Muted text on card (help, tagline) | #9AA5C9 | #141B33 | 6.97:1 | ✅ PASS | ✅ PASS |
| Muted text on inset (scenario, how-to list) | #9AA5C9 | #0D1330 | 7.46:1 | ✅ PASS | ✅ PASS |
| Muted text on raised (option meta) | #9AA5C9 | #1E2A52 | 5.70:1 | ✅ PASS | ✅ PASS |
| Gold on page (wordmark span) | #FFCF3F | #0B1020 | 12.85:1 | ✅ PASS | ✅ PASS |
| Gold on card (links, pill text) | #FFCF3F | #141B33 | 11.54:1 | ✅ PASS | ✅ PASS |
| Gold on inset (scores, timer number) | #FFCF3F | #0D1330 | 12.36:1 | ✅ PASS | ✅ PASS |
| Dark text on gold (primary button, A–D chip) | #221A00 | #FFCF3F | 11.72:1 | ✅ PASS | ✅ PASS |
| Dark text on gold hover | #221A00 | #FFD964 | 12.63:1 | ✅ PASS | ✅ PASS |
| Dark text on gold active | #221A00 | #F5BC1F | 9.95:1 | ✅ PASS | ✅ PASS |
| Success text on success banner | #8FF5CE | #0E2F24 | 11.11:1 | ✅ PASS | ✅ PASS |
| Success solid as text/icon on card | #2EE6A8 | #141B33 | 10.53:1 | ✅ PASS | ✅ PASS |
| Success text on raised (correct option label) | #8FF5CE | #1E2A52 | 10.69:1 | ✅ PASS | ✅ PASS |
| Danger text on danger banner | #FFD7DC | #30141F | 12.85:1 | ✅ PASS | ✅ PASS |
| Danger solid as text on card (form errors) | #FF5A6E | #141B33 | 5.62:1 | ✅ PASS | ✅ PASS |
| Danger solid as text on page | #FF5A6E | #0B1020 | 6.26:1 | ✅ PASS | ✅ PASS |
| Danger light text on raised (wrong option) | #FFD7DC | #1E2A52 | 10.61:1 | ✅ PASS | ✅ PASS |
| Warning text on warning banner | #FFC98A | #33200E | 10.32:1 | ✅ PASS | ✅ PASS |
| Warning solid as icon/text on card | #FF9F43 | #141B33 | 8.34:1 | ✅ PASS | ✅ PASS |
| Info text on info panel | #A9D4FF | #10263F | 9.88:1 | ✅ PASS | ✅ PASS |
| Info text on card (hash line) | #A9D4FF | #141B33 | 10.98:1 | ✅ PASS | ✅ PASS |
| Streak text on inset (leaderboard 🔥 count) | #FFB08A | #0D1330 | 10.26:1 | ✅ PASS | ✅ PASS |
| Host text on host badge | #FFD964 | #2E2410 | 11.16:1 | ✅ PASS | ✅ PASS |
| Winner name/score on inset | #FFD964 | #0D1330 | 13.32:1 | ✅ PASS | ✅ PASS |
| Bot text on bot badge | #D3BCFF | #241640 | 9.82:1 | ✅ PASS | ✅ PASS |
| Bot solid as text on inset (bot name tag) | #B18CFF | #0D1330 | 6.99:1 | ✅ PASS | ✅ PASS |
| Spectator text on spectator note | #A8CBDD | #1C2B3A | 8.41:1 | ✅ PASS | ✅ PASS |
| Disabled text on disabled fill | #828FB0 | #171E38 | 5.09:1 | ✅ PASS | ✅ PASS |

**Non-text (WCAG 1.4.11, ≥ 3:1 against adjacent colour):**

| Boundary | Colours | Ratio | Verdict |
|---|---|---|---|
| Input / control boundary vs card | #586DAF on #141B33 | 3.42:1 | ✅ PASS |
| Input boundary vs its own inset fill | #586DAF on #0D1330 | 3.66:1 | ✅ PASS |
| Focus ring vs page / card | #6EC1FF on #0B1020 / #141B33 | 9.68:1 / 8.70:1 | ✅ PASS |
| Timer fill endpoints vs track | #2EE6A8 / #FFCF3F / #FF5A6E on #0D1330 | 11.28 / 12.36 / 6.02:1 | ✅ PASS |
| Correct-option ring vs option fill | #2EE6A8 on #1E2A52 | ≥3:1 by ring + label (§6) | ✅ PASS |
| Decorative hairline (`.card`, dividers) | #26305A on #141B33 | 1.34:1 | ⚠️ Decorative only — permitted because no information is carried by these lines; anything a user must *find* (inputs, buttons) uses `--border-interactive` instead. |

Two deliberate upgrades vs. the current CSS fall out of this table: inputs/options previously
used `--border` (1.34:1) as their only boundary — they now use `--border-interactive`
(3.42:1); and muted text, already passing, is kept at `#9AA5C9` because it clears AA even at
12–13 px fine-print sizes on every surface it touches.

---

## 5. Colour-coding map — every component

| Component / state | Background | Border | Text / icon | Notes |
|---|---|---|---|---|
| Page | `--bg-0` | — | `--text-1` | + `.bg-glow` ambience (§3) |
| Screen card | `--bg-1` | `--border` | `--text-1` | `--shadow-card` |
| Inset panels (`.mode`, `.howto`, `.scenario`, inputs, rows, podium tiles) | `--bg-2` | `--border` (inputs: `--border-interactive`) | `--text-1`; help inside → `--text-3` | |
| Headings | — | — | `--text-1` | wordmark span → `--accent` |
| Tagline, help copy, fine print, board titles, footer | — | — | `--text-3` | AA-verified at small sizes (§4) |
| Secondary button (Join, Leave, Build quiz, file upload) | `--bg-3` | `--border` → hover `--border-strong` + bg `--bg-4` | `--text-1` | hover lift kept, border does the talking |
| **Primary button** (Play vs Bots, Create room, Start, Play again) | `--accent` → hover `--accent-hover` → active `--accent-active` | same as fill | `--on-accent` | exactly one per screen |
| Small button (Copy code) | `--bg-3` | `--border-strong` | `--text-1`; success flash → `--success-text` + "✅ Copied" label | state = colour **and** text change |
| Disabled button | `--bg-disabled` | `--border` | `--text-disabled` | + `cursor:not-allowed`; no hover lift |
| Text input / textarea / code input | `--bg-2` | `--border-interactive` | `--text-1`; placeholder `--text-3` | code input letters in `--accent` optional, keep `--text-1` for legibility |
| Focus (all interactive) | — | `outline:2px solid var(--focus); outline-offset:2px` | — | ice blue ring, visible on gold too |
| Links | — | — | `--accent`; hover `--accent-hover` + underline | never `--info` (info ≠ navigable) |
| Room-code / round pill | `--bg-2` | `--border` | `--accent` | gold = "this is the key/score family" |
| Divider with label | line `--border` | — | label `--text-3` | |
| Form error (`.error`) | — | — | `--danger` (solid as text, 5.62:1) | always a full sentence, not just red |
| Quiz status — building/ready | — | — | `--success-text` on `--bg-1` context; use `--success` text variant `#8FF5CE` | prefix ✅/⏳ |
| Quiz status — failed | — | — | `--danger-text` `#FFD7DC` | prefix ⚠/✖ + reason text |
| Spectator note | `--spectator-bg` | `--spectator-border` | `--spectator-text` | 👀 glyph + words (§6) |
| Connection banner | `--warning-bg` | `--warning-border` | `--warning-text` | ⚠️ glyph; **changed from danger** — it is recoverable |
| Host badge (👑 in rows/lobby) | `--host-bg` | `--host-border` | `--host-text` | crown glyph mandatory |
| Bot name tag (🤖 rows) | `--bot-bg` | `--bot-border` | `--bot-text` | robot glyph mandatory |
| "Me" row highlight | `--bg-2` | `--accent` | name `--text-1`, score `--accent` | + the row is labelled by position/name; border is a bonus cue |
| Score numerals (all boards) | — | — | `--accent` | one meaning: points = gold, everywhere |
| Streak indicator (🔥 n) | — | — | `--streak-text`; flame `--streak` | sits next to the score; never inside the score's gold |
| Timer track | `--bg-2` | `--border` | — | |
| Timer fill | gradient §3 (success → accent → danger) | — | — | decorative progress only |
| Timer seconds text | — | — | `--accent`; at ≤ 5 s → `--danger` | number + "s" always rendered (§6) |
| Answered count ("3/8 answered") | — | — | `--text-3`; complete → `--success-text` | numeric fraction is the primary signal |
| Scenario block | `--bg-2` | `--border` | scenario meta `--text-2`; message `--text-3` italic; prompt `--text-1` bold | prompt is the loudest text on the game screen |
| Answer option — default | `--bg-3` | `--border-interactive` | text `--text-1`; letter chip: fill `--accent`, glyph `--on-accent` | letter A–D is a permanent non-colour ID |
| Answer option — hover | `--bg-4` | `--accent` | `--text-1` | pointer devices only (`:hover:not(:disabled)`) |
| Answer option — picked (locked) | `--bg-3` | `--accent` + 2 px inset ring `--accent` | `--text-1` | + "locked" is also enforced behaviourally; add ✓ marker on the picked chip |
| Answer option — revealed correct | `--success-bg` | `--success-border` + ring | `--success-text` | + ✓ glyph (§6) |
| Answer option — revealed wrong (yours) | `--danger-bg` | `--danger-border` | `--danger-text` | + ✗ glyph |
| Answer option — disabled / others | `--bg-2` | `--border` | `--text-3` | dimming is safe here: result is also in the feedback banner |
| Feedback banner — correct | `--success-bg` | `--success-border` | body `--success-text` | heading "✅ Correct!" |
| Feedback banner — wrong | `--danger-bg` | `--danger-border` | body `--danger-text` | heading "❌ Not quite" + correct answer spelled out |
| Answer-lock / hash line | `--info-bg` (as inline chip) or plain on card | `--info-border` if chipped | `--info-text` | 🔒 glyph; mono font for the hash itself |
| Podium tile — 1st | `--bg-2` | `--accent` + winner glow (§3) | name `--text-2`, score `--accent-ink` | 🥇 medal + scale 1.05 (existing) |
| Podium tiles — 2nd / 3rd | `--bg-2` | `--border` | name `--text-2`, score `--accent` | 🥈 🥉 medals carry rank, colour does not |
| Winner headline | — | — | `--text-1`; winner name `--accent-ink` | 🏆 + name in words |
| Review item (missed question) | `--bg-2` | `--border` | question `--text-1`; "Correct:" label `--success-text`; explanation `--text-3` | the word "Correct:" is the signal, mint is support |
| Review item border-left accent | — | left bar `--danger` | — | marks "you missed this" redundantly with the section title |

---

## 6. Colour-blindness & redundant-coding rules

Roughly 1 in 12 men has red-green colour vision deficiency — precisely this app's most-loaded
pair (correct = green, wrong = red). The system is therefore built so **deleting all colour
still leaves a fully playable, fully legible game**:

1. **Correct / wrong is never colour-only.** Revealed options get a ✓ or ✗ glyph in the
   letter chip, the feedback banner leads with "✅ Correct!" / "❌ Not quite", and the correct
   answer is always repeated *in words* in the banner. A deuteranopic player loses nothing.
2. **Options have permanent letter IDs (A–D)** in chips that never change colour meaning —
   the chip is an address, not a state. States are shown by border, ring, glyph and banner.
3. **Timer is numeric first.** Seconds remaining are rendered as text ("25s") at all times;
   the bar and its gradient are decoration. The ≤ 5 s danger colour is a third, redundant cue.
4. **Streak ≠ success.** Streak uses ember (`--streak`) + the 🔥 glyph + an explicit count,
   because mint-for-streak would collide with mint-for-correct for colour-blind and
   colour-sighted users alike. The lobby copy already spells the rule out ("🔥 = 3+ correct
   in a row") — keep that legend wherever the flame appears.
5. **Roles are glyphs + words, colour is costume.** Host = 👑 (+ the lobby sentence
   "👑 = host"), bot = 🤖 (and bot names end in 🤖), spectator = 👀 + a full sentence
   ("you're spectating"). Gold/violet/slate tints may support these, never replace them.
   Note for deuteranopia: host gold and streak ember are adjacent hues — they never appear
   in the same component, and each is glyph-bound, so no confusion path exists.
6. **Links are underlined on hover/focus and sit in sentences** ("Switch back to the built-in
   bank") — gold colour alone never marks the only path to an action; every link is also a
   verb phrase.
7. **Errors are sentences.** `.error` text, quiz-status failures and the connection banner
   all state what happened and what to do; red/amber is the frame, not the message.
8. **"Me" is positional, not just gold-bordered** — your row is identifiable by your name;
   the gold border is an enhancement. Same for podium rank: medals + order carry rank.
9. **Focus is geometry, not hue.** The ice-blue ring is 2 px with a 2 px offset — visible by
   shape and luminance (8.70:1) even in greyscale.
10. **Greyscale test (acceptance rule):** before shipping any new component, screenshot it in
    greyscale. If any state, role or result becomes ambiguous, the component fails review —
    add a glyph, label or pattern before adding another colour.

---

## Appendix — migration checklist for `style.css`

1. Replace `:root` with §1 + §2 blocks; rename per the §1 mapping.
2. Swap hard-coded values: `#0d1330` → `--bg-2`, `#1e2a52` → `--bg-3`, `#0008` →
   `--shadow-card`, `#ffcf3f66` → tokenised glow (§3), feedback `#0f2e26`/`#2e1420` →
   `--success-bg`/`--danger-bg`, conn-banner `#3a1420`/`#ffd7dc` → **warning** set,
   timer gradient → token gradient (§3).
3. Give `input`, `textarea`, `.opt` the `--border-interactive` boundary.
4. Add the `:focus-visible` ring rule (§5) — currently absent entirely.
5. Add ✓/✗ chip glyphs on reveal and the ≤ 5 s timer-text rule (§5/§6).

*End of colour system. Companion documents (layout, typography, motion) should reference
these tokens by name, never by hex.*
