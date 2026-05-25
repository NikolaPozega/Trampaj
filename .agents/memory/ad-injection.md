---
name: Ad injection pattern
description: Exact grid positions for card-sized ad slots in the 3-column listing grid
---

## Rule
Ads appear at fixed grid positions, alternating column, every 3 rows:
- Row 3, Col 3
- Row 6, Col 1
- Row 9, Col 3
- Row 12, Col 1
- ... (infinite, pattern repeats)

Flat index formula: `(row - 1) * 3 + (col - 1)`

## Why
User explicitly specified these exact positions for visual consistency.

## How to apply
Generate ad indices **dynamically** based on listing count — do NOT use a fixed cap like `n < 200`. Compute enough positions to cover `listings.length + ads_count` total slots. The while-loop fills non-ad slots with real listings in order.
