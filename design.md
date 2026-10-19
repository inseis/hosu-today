# Design — 호수원픽

A locked design system for this app. Every page reads this file before changing styles. Extend it here instead of overriding per page. Tokens live in [`tokens.css`](tokens.css).

## Genre
Editorial — a printed neighbourhood guide, not an app template.

## Macrostructure family
- App · explore: **Workbench** — sticky toolbar + map, hairline-ruled venue rows, filters above.
- Content · venue detail / about: **Long Document** — serif section heads, rules between sections, one column.
- Admin: utilitarian tables and forms on the same tokens.

## Theme (custom · axes: light / roman-serif / cool)
- `--color-paper` oklch(97.4% 0.010 85) — warm ivory
- `--color-ink` oklch(25% 0.045 265) — navy
- `--color-rule` oklch(87.5% 0.014 85)
- `--color-accent` oklch(46% 0.150 262) — Cass blue, the only accent (≤ 5 % of a viewport)
- Product hues (`--color-cass-zero`, `--color-hanmac`) appear only next to their product.

## Typography
- Display: Noto Serif KR 700 — site title, venue names, section heads, counts. Always roman.
- Body: Pretendard Variable 400–700.
- Numbers in tables/prices use tabular figures.

## Components
- Venue = ruled row, not a boxed card. Featured (카스 생·카스 0.00·한맥) = 3 px accent bar on the left + product photo + blue name.
- Area filter = underline tabs; purpose / conditions = square chips (radius 6), no emoji.
- Buttons radius 10; primary = ink fill, secondary = hairline outline. Detail links are text + arrow.
- The recommender is the one "object" on the page: ink border + 3 px offset shadow.

## Motion
Quiet. Colour/border transitions 160 ms `--ease-out`; button press 1 px. No reveals. Reduced-motion collapses transitions.

## Brand display rules
- Official product photos only from `public/images/brands` (provided by the operator). No redrawn logos.
- Competitor products: detail-page list only, plain text. Never on cards, map, or the drink selector.
