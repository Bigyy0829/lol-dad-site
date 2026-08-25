# Design — 撸啊撸职业父与子

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre

**atmospheric** — dark canvas, Summoner's Rift at night. The page is a place you
open after dark: deep navy-black paper, two soft light blooms (cool blue,
warm gold), confident heavy Chinese display type, one warm ranked-gold accent.
The humor lives in the copy; the calm lives in the canvas.

## Macrostructure family

- Marketing pages: **Marquee Hero** — the hero is the statement, the fold holds
  the whole pitch, the tool (duel panel) sits directly below the fold.
- App pages: **Split Studio** for H2H (the matchup is a diptych: blue side vs
  red side, VS crest between) · **Catalogue** for dad/son ranking (indexed
  ladder: crest cards for ranks 1–3, then an index table).
- Content pages: n/a — no long-form content routes.

## Theme

- `--color-paper`   oklch(13% 0.014 258)  — deep rift navy-black
- `--color-paper-2` oklch(16.5% 0.016 258)
- `--color-paper-3` oklch(20.5% 0.018 258)
- `--color-paper-4` oklch(24.5% 0.02 258)
- `--color-ink`     oklch(94% 0.008 258)
- `--color-ink-2`   oklch(74% 0.012 258)
- `--color-muted`   oklch(58% 0.014 258)
- `--color-rule`    oklch(29% 0.016 258)
- `--color-rule-2`  oklch(37% 0.018 258)
- `--color-accent`  oklch(76% 0.12 84)   — ranked gold (brand accent)
- `--color-accent-ink` oklch(19% 0.02 258)
- `--color-focus`   oklch(80% 0.15 84)
- `--color-blue`    oklch(66% 0.15 248)  — player A / blue side (data semantic)
- `--color-red`     oklch(61% 0.17 24)   — player B / red side (data semantic)
- `--color-gold` / `--color-silver` / `--color-bronze` — dad/son crest metals

All values live in `tokens.css` and are referenced by name only.

## Typography

- Display: Microsoft YaHei / PingFang SC, weight 900, style normal, CJK
  tracking 0.01em; Latin outlier register = Bahnschrift SemiCondensed 600,
  uppercase, tracking 0.14em, line-height ≥ 1.02.
- Body: PingFang SC / Microsoft YaHei, weight 400.
- Mono/data: tabular-nums on every numeric column; no separate mono face.
- Type scale anchor: `--text-display` = clamp(2.75rem, 5vw + 1rem, 5.25rem);
  hero uses `--text-hero` (CJK-safe clamp). Display max ≤ 5.5rem.

Two families total (CJK sans + Bahnschrift outlier). The outlier is a register
for game-engine labels only: hero kicker + VS crest on home; verdict kicker +
VS crest on H2H; page kicker + crest numerals on ranking. Two slots per page,
never more.

## Spacing

4-point named scale (`--space-3xs` … `--space-3xl`) in `tokens.css`. Pages use
named tokens, never raw values.

## Motion

- Easings: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) etc., named in tokens.
- Reveal pattern: fade-only, opacity + transform. HP bars fill once with a
  `scaleX` sweep (transform-origin left). No scroll-jack, no bounce.
- Reduced-motion fallback: everything collapses to ≤ 150 ms opacity crossfade
  or no animation.

## Microinteractions stance

- Silent success: no celebratory toasts; state changes are quiet.
- Hover tooltips 800 ms delay · focus tooltips 0 ms.
- `:focus-visible` gold ring at ≥ 3:1 contrast, instant appearance, never
  animated.
- All interactive elements styled for 8 states: default · hover · focus ·
  active · disabled · loading · error · success.

## CTA voice

- Primary CTA: gold fill, angular notched top-right corner
  (`--clip-notch`), dark ink text, copy pattern "开打！鉴定父子".
- Secondary CTA: outlined on paper-2, same notch, copy "⇄ 交换".

## Per-page allowances

- Marketing pages (home) MAY use enrichment: Tier-B hand-built SVG of the
  Summoner's Rift line-art behind the hero + the two CSS blooms.
- App pages MUST NOT use enrichment — function carries the page. Hexagon
  badges and beveled panels are component language, not enrichment.
- Content pages: n/a.

## What pages MUST share

- The hexagon wordmark (`父` inside a gold hexagon).
- The accent gold and its placement (active nav · one CTA · focus rings ·
  rank-1 crest · ≤ 5 % per viewport).
- The display + body font stack and the outlier register (two slots/page).
- The CTA voice (notched gold primary / outlined secondary).
- Section heading rhythm: Chinese display head + game-kicker above, stacked
  vertically — never a tag-left/heading-right split.
- Blue = player A, red = player B, everywhere.

## What pages MAY differ on

- Macrostructure within the family (Marquee Hero home · Split Studio H2H ·
  Catalogue ranking).
- Hero archetype knobs (statement size, sub length).
- Enrichment — home only.

## LoL motifs (locked vocabulary)

1. **Summoner's Rift canvas** — body carries two fixed blooms (cool blue
   top-left, warm gold bottom-right); home adds the line-art rift SVG.
2. **Hextech geometry** — hexagon badges for positions (TOP/JGL/MID/BOT/SUP),
   hexagon VS crest, notched panel corners, chevron energy lines.
3. **Blue side / red side** — A slots and bars are blue, B slots and bars are
   red, with "BLUE SIDE / RED SIDE" labels on the H2H duel banner.
4. **Ranked ladder** — dad/son top-3 are crest cards in gold/silver/bronze;
   win-rate bars render as HP bars with tick notches.
5. **Game-engine voice** — short English kickers (FAMILY VERDICT, DAD & SON
   INDEX, SUMMONER'S RIFT H2H) in the outlier register; Chinese stays the main
   voice. No invented stats, no fake chrome.

## Exports

Drop-in formats for re-using this design system in other projects.

### tokens.css

```css
:root {
  --color-paper:      oklch(13% 0.014 258);
  --color-paper-2:    oklch(16.5% 0.016 258);
  --color-paper-3:    oklch(20.5% 0.018 258);
  --color-paper-4:    oklch(24.5% 0.02 258);
  --color-ink:        oklch(94% 0.008 258);
  --color-ink-2:      oklch(74% 0.012 258);
  --color-muted:      oklch(58% 0.014 258);
  --color-rule:       oklch(29% 0.016 258);
  --color-rule-2:     oklch(37% 0.018 258);
  --color-accent:     oklch(76% 0.12 84);
  --color-accent-2:   oklch(83% 0.1 84);
  --color-accent-ink: oklch(19% 0.02 258);
  --color-focus:      oklch(80% 0.15 84);
  --color-blue:       oklch(66% 0.15 248);
  --color-red:        oklch(61% 0.17 24);
  --color-gold:       oklch(76% 0.12 84);
  --color-silver:     oklch(82% 0.02 258);
  --color-bronze:     oklch(63% 0.09 60);

  --font-display: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif;
  --font-body:    "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  --font-outlier: "Bahnschrift", "Segoe UI", "Microsoft YaHei", sans-serif;

  --space-3xs: 0.25rem;  --space-2xs: 0.5rem;  --space-xs: 0.75rem;
  --space-sm:  1rem;     --space-md:  1.5rem;  --space-lg: 2rem;
  --space-xl:  3rem;     --space-2xl: 4.5rem;  --space-3xl: 7rem;

  --text-xs: 0.75rem;  --text-sm: 0.875rem; --text-md: 1.125rem;
  --text-lg: 1.375rem; --text-xl: 1.75rem;  --text-2xl: 2.25rem;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 220ms;
  --radius-card: 10px; --radius-pill: 999px; --radius-input: 6px;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper:   oklch(13% 0.014 258);
  --color-ink:     oklch(94% 0.008 258);
  --color-accent:  oklch(76% 0.12 84);
  --color-blue:    oklch(66% 0.15 248);
  --color-red:     oklch(61% 0.17 24);
  --font-display:  "Microsoft YaHei", "PingFang SC", sans-serif;
  --font-body:     "PingFang SC", "Microsoft YaHei", sans-serif;
  --spacing-md:    1.5rem;
  --text-md:       1.125rem;
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);
  /* mirror the rest of tokens.css with `--spacing-*` for Tailwind's spacing utilities */
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "paper":  { "$value": "oklch(13% 0.014 258)", "$type": "color" },
    "ink":    { "$value": "oklch(94% 0.008 258)", "$type": "color" },
    "accent": { "$value": "oklch(76% 0.12 84)",   "$type": "color" },
    "blue":   { "$value": "oklch(66% 0.15 248)",  "$type": "color" },
    "red":    { "$value": "oklch(61% 0.17 24)",   "$type": "color" }
  },
  "font": {
    "display": { "$value": "Microsoft YaHei, PingFang SC", "$type": "fontFamily" },
    "body":    { "$value": "PingFang SC, Microsoft YaHei", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background:        13% 0.014 258;   /* paper */
  --foreground:        94% 0.008 258;   /* ink */
  --primary:           76% 0.12 84;     /* accent */
  --primary-foreground: 19% 0.02 258;   /* accent-ink */
  --muted:             29% 0.016 258;   /* rule */
  --muted-foreground:  58% 0.014 258;   /* muted */
  --border:            29% 0.016 258;   /* rule */
  --input:             29% 0.016 258;   /* rule */
  --ring:              80% 0.15 84;     /* focus */
  --radius:            0.625rem;
}
```
