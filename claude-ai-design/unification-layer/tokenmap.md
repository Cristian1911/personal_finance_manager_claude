| `--z-ink` | --z-ink #0b0b0c (globals.css:72) → bg-z-ink / text-z-ink |
| `--z-white` | --z-white #F6F0E3 (globals.css:79) → text-z-white / bg-z-white |
| `--z-border` | --z-border rgba(217,204,185,0.08) (globals.css:92) exists but border-z-border is DEPRECATED — canonical border utility is border-white/6 (TOKENS.md §3); strong variant --z-border-strong rgba(217,204,185,0.16) feeds shadcn --border |
| `--z-brass` | --z-brass #a98a51 (globals.css:75) → text-z-brass / bg-z-brass; hover tier --z-brass-hot #c2a063 → text-z-brass-hot |
| `--z-income` | --z-income #5CB88A (globals.css:82) → text-z-income; tint recipe class .surface-income (globals.css:243) |
| `--z-expense` | --z-expense #E8875A (globals.css:83) → text-z-expense; .surface-expense (globals.css:244) |
| `--z-alert` | --z-alert #D4A843 (globals.css:85) → text-z-alert; .surface-alert (globals.css:246) |
| `--z-debt` | --z-debt #E05545 (globals.css:84) → text-z-debt; .surface-debt (globals.css:245); also shadcn --destructive |
| `--z-sage-light` | --z-sage-light #D9CCB9 (globals.css:77) → text-z-sage-light |
| `--z-sage-dark` | --z-sage-dark #938C7E (globals.css:78) → text-z-sage-dark; also shadcn --muted-foreground (text-muted-foreground); .surface-neutral (globals.css:247) |
| `--motion-ease` | DOES NOT EXIST — create in globals.css :root as cubic-bezier(0.2,0,0,1) |
| `--motion-1/2/3` | DO NOT EXIST — create as 120ms/160ms/200ms; today only page-enter 0.1s ease-out (globals.css:261) + hardcoded duration-150/200/300 classes |
| `--chart-1..5` | exist (globals.css:183-187 AND .dark:220-224) but bound income/expense/alert/debt/brass — T2 target: brass/sage-dark/income/expense/debt |
| `z-card-surface` | no such class → PANEL_SURFACE_CLASS (styles.ts:63-64) 'rounded-2xl border border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]' |
| `z-card-compact` | no such class → TOKENS.md Tier 2 'rounded-xl border border-white/6 bg-[#111] px-3 py-2' (hardcoded in 5 files) |
| `z-card-stat` | no such class → 'rounded-2xl border border-white/6 bg-black/10 p-4' via StatCard/CompactMetricBox (ui/stat-card.tsx) + PANEL_INSET_CLASS (styles.ts:75) |
| `z-num` | no such class → inline 'tabular-nums' utility on amounts |
| `hero-gradient` | HERO_CARD_GRADIENT_CLASS (styles.ts:71-72) — exact match to board gradient; drifted sibling PageHero GRADIENTS.sage rgba(63,70,50,0.26) (ui/page-hero.tsx:4) |
| `eyebrow` | SECTION_EYEBROW_CLASS (styles.ts:59-60) 'text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark' — exact match to board eyebrow |
