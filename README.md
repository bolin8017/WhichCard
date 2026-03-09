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
    ↓ pnpm build-data
src/lib/data/
  cards.json             # Compiled card data
  search-index.json      # Aliases + store restrictions
```

## Search Engine

Four-stage client-side search pipeline:

1. **Retrieval** — Alias resolution (exact → prefix → substring) + StoreIndex lookup
2. **Hard Filter** — Network restriction, expiry date, exclude categories
3. **Scoring** — Max reward rate calculation (base + best tier bonus)
4. **Ranking** — Split into specific matches vs. general (wildcard) matches, sorted by reward rate

## Adding Card Data

1. Create `data/cards/{bank}-{card-name}.yaml` (see existing files for format)
2. Add store aliases to `data/aliases.yaml` if needed
3. Run `pnpm validate-data` to verify
4. Run `pnpm build-data` to compile

See `CLAUDE.md` for detailed data conventions.
