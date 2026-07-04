# 刷哪張 WhichCard

A pure frontend credit card reward lookup tool. Enter a store name and instantly see the best credit card rewards.

## Tech Stack

- **SvelteKit** — Static SPA with adapter-static
- **Svelte 5** — Runes-based reactivity
- **TypeScript** — Strict mode
- **Tailwind CSS v4** — Mobile-first styling
- **Vitest** — Unit & component tests
- **Playwright** — E2E tests
- **Zod** — Data validation
- **pnpm** — Package manager

## Getting Started

```bash
pnpm install
pnpm build-data   # Build YAML → JSON data pipeline
pnpm dev           # Start dev server
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production (outputs to `dist/`) |
| `pnpm build-data` | Compile YAML data to JSON |
| `pnpm validate-data` | Validate data without building |
| `pnpm test` | Run unit & component tests |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm check` | Run svelte-check type checking |

## Data Pipeline

Card reward data is stored as individual YAML files in `data/cards/`. A build-time pipeline (`scripts/build-data.ts`) validates and compiles them into optimized JSON for the client.

```
data/
  cards/{id}.yaml        # One YAML file per credit card
  stores/{name}.yaml     # Store restrictions (e.g., card/network/bank limits)
  aliases.yaml           # Store name aliases for search
  categories.yaml        # Store → category membership (保費, 代繳, …)
    ↓ pnpm build-data
src/lib/data/
  cards.json             # Compiled card data
  search-index.json      # Aliases + store restrictions + categories
```

The build also emits freshness warnings (expired rules, rules expiring
within 30 days, cards not verified for 180+ days) so data rot surfaces
as a visible task list.

## Search Engine

Four-stage client-side search pipeline:

1. **Retrieval** — Alias resolution (exact → prefix → substring) + category expansion ({store ∪ categories}) + StoreIndex lookup
2. **Hard Filter** — Network restriction, expiry date, excluded categories via set intersection
3. **Scoring** — Floor–ceiling rate range (unconditional rate → authored `maxTotalRate` or derived best tier)
4. **Ranking** — Specific matches vs. general (wildcard) matches; sorted by ceiling, exact-store before category hits

## Adding Card Data

Preferred: run the review-gated extraction pipeline in Claude Code —

1. `/add-card <official bank page URL>` drafts `data/cards/{id}.yaml`
   (with source quotes and TODO-REVIEW flags), plus alias/category additions
2. Review the diff, fix flagged items
3. Run `pnpm validate-data` to verify, then commit (data-only commit)

`/refresh-cards` scans for expired/expiring/stale data and drafts updates
from each card's recorded official sourceUrls.

Manual editing works too — see `CLAUDE.md` for data conventions.
