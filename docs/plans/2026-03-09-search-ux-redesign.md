# Search UX Redesign

Date: 2026-03-09
Status: Approved

## Problem

The search experience has two critical bugs:

1. **Focus loss on first keystroke** — `+page.svelte` conditionally renders
   `<SearchBar>` in two different DOM locations (`!hasQuery` centered layout vs.
   `hasQuery` sticky-top layout). When the user types the first character,
   Svelte destroys the old `SearchBar` instance and mounts a new one, causing
   the input to lose focus.

2. **IME composition fires search too early** — `oninput` triggers during
   Zhuyin/Pinyin composition before the user confirms the character. The
   `isComposing` guard is partially in place but unreliable when the DOM node
   is recreated mid-composition.

## Design Decisions

### Architecture: Single SearchBar instance in a permanent header

The root cause of both bugs is the conditional dual-mount pattern. The fix is
to render `<SearchBar>` exactly once, inside a `<header>` that is always
present, and only switch the content below the header based on `hasQuery`.

```
<header class="sticky top-0">
  Brand name | SearchBar | RegionFilter
</header>

<main>
  {#if !hasQuery} → popular searches (chips)
  {:else}         → MyCardsToggle + results
</main>
```

Rejected alternative: CSS Grid `1fr → 0fr` hero animation (Agent B proposal).
Reason: iOS Safari inconsistency with grid transition, higher maintenance
complexity, and no meaningful UX benefit over a permanent header.

### Input state: local buffer + $effect sync

Separate `inputValue` (what the DOM input shows) from `searchStore.query`
(what drives the search engine). This allows:

- External query changes (popular search chips) to sync into the input via
  `$effect`.
- IME composition to buffer locally without triggering reactive search updates.
- Keyboard navigation to preview suggestion text in the input without
  committing to the store.

```typescript
let inputValue = $state(searchStore.query);

$effect(() => {
  inputValue = searchStore.query; // sync external changes into input
});
```

### IME: queueMicrotask in compositionend

On Safari iOS, `compositionend` fires before the input's `.value` is updated.
Reading `e.target.value` directly in the handler gives a stale value. Fix:

```typescript
function handleCompositionEnd(e: CompositionEvent): void {
  queueMicrotask(() => {
    const value = (e.target as HTMLInputElement).value;
    inputValue = value;
    searchStore.query = value;
  });
}
```

### Keyboard navigation for suggestions

Matches Google Search and standard combobox behavior:

| Key | Action |
|-----|--------|
| `↓` | Move highlight to next suggestion |
| `↑` | Move highlight to previous suggestion (or back to input) |
| `Enter` | Confirm highlighted suggestion, or search current input |
| `Escape` | Close suggestions, keep query, return focus to input |

State: `let highlightedIndex = $state(-1)` where `-1` means nothing highlighted.
When highlighted, `inputValue` shows the suggestion preview; `store.query` does
not change until confirmed.

### Suggestion animation

120ms ease-out `translateY(-4px) → (0)` + `opacity 0 → 1`. Stagger individual
items by 15ms. This matches Material Design menu timing — fast enough to feel
instant, slow enough to not be jarring.

No stagger on result cards (would feel repetitive on every keystroke).

### Visual updates

- `rounded-xl` for the search input (was `rounded-lg`)
- `border-gray-200` (was `border-gray-300`) — lighter, less noisy
- `focus:ring-2 focus:ring-blue-100` outer glow on focus (instead of border
  color change only)
- `shadow-sm` on the input to lift it from background
- Suggestion items: `py-3` (was `py-2.5`), highlighted state `bg-blue-50
  text-blue-700` (was `bg-gray-50`)

## Components Affected

| File | Change |
|------|--------|
| `src/routes/+page.svelte` | Restructure layout: permanent header + content switch |
| `src/components/SearchBar.svelte` | Local inputValue state, keyboard nav, IME fix, visual update |

## Out of Scope

- Hero-to-top CSS animation (rejected, see above)
- Result card visual changes
- RegionFilter or MyCardsToggle changes
- New data or search engine logic
