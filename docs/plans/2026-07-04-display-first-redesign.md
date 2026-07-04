# WhichCard v2 Redesign — Display-First Rules + Automated Data Pipeline

Date: 2026-07-04
Status: Draft — pending review

## Problem

The project stalled in March 2026 because the rule-based data model hit a
wall. Three compounding causes:

1. **Semantic modeling of bank conditions is a tar pit.** Bank marketing
   invents new condition types every quarter (registration, quotas, member
   tiers, asset thresholds, prior-month spend, shared caps, payment binding,
   principal+supplementary aggregation…). A schema that tries to *evaluate*
   every condition must grow forever. Evidence in the current data: shared
   caps ("與其他海外類別共用600元上限") and card-variant differences
   ("世界卡加碼上限550元/月") already overflow into free-text `note`/
   `condition` fields because no structured field can hold them.

2. **The engine never consumed the semantics anyway.** The search pipeline
   only uses `stores`, `region`, `validFrom/Until`, and `rate + max(bonus)`.
   Tier limits, shared caps, and member-tier logic are stored but never
   computed. The schema promises more than the product needs.

3. **Manual data production does not scale.** All time-limited rules in the
   repo carried `validUntil: 2026-06-30` and expired four days before this
   document was written. Two of three cards (DAWHO, 幣倍卡) are now entirely
   invisible in search results. Taiwan banks run semi-annual campaign
   cycles, so hand-maintained data has a ~6-month half-life. Three cards
   already rotted; fifty would be a treadmill.

Additionally, ranking by `rate + max(bonus)` silently assumes the best case
(all tiers achieved), and over-estimates rules whose tiers are mutually
exclusive (e.g. 滿6,000 +1% vs 滿12,000 +2% are alternatives, yet a stacking
自動扣繳 +1% exists — neither pure max nor pure sum is correct).

## Product Decisions (locked 2026-07-04)

1. **Phased scope: personal first, public later.** v1 covers cards the
   maintainer owns or is considering (5–15 cards) to validate the pipeline;
   expand toward popular top-20/30 cards only after the pipeline proves
   itself.
2. **Points cards included, shown at nominal rate.** Points-reward cards
   (e.g. 國泰 CUBE) display the bank's nominal % with a rewardType badge and
   optional points name. No point-valuation conversion.
3. **Data inclusion policy: evergreen + bank flagship campaigns.** Include
   permanent benefits and the bank's official semi-annual flagship campaigns
   (typically renewed each cycle). Exclude new-cardholder offers, short-term
   single-merchant boosts, and quota-limited flash promos.

## Design Overview

The SvelteKit skeleton, four-stage search pipeline, alias system, stores,
and test architecture are healthy and stay. Three *contracts* change:

1. **Schema contract**: conditions are structured *display* data, never
   machine-evaluated logic. The machine computes only what it can compute
   reliably.
2. **Engine contract**: results carry a reward *range* (guaranteed floor →
   authored ceiling) instead of a single optimistic max.
3. **Data production contract**: card YAML is drafted by an LLM-assisted
   pipeline from official bank pages and gated by human review, instead of
   authored by hand from scratch. Freshness is monitored, not remembered.

The LLM sits at **build time** (deterministic, reviewable, versioned
output), never at runtime (cost, latency, hallucinated numbers on a static
site). This asymmetry is the core architectural judgment of the redesign.

## 1. Schema Changes (all additive)

```typescript
export interface RewardRule {
  // ... existing fields unchanged ...
  maxTotalRate?: number; // author-stated max total % ("最高X%" from bank DM).
                         // Display/sort ceiling. Fallback: rate + max(bonus).
  sourceUrl?: string;    // campaign page when it differs from card.sourceUrl;
                         // used by the refresh pipeline.
}

export interface CreditCard {
  // ... existing fields unchanged ...
  pointsName?: string;   // e.g. "小樹點" — display badge for points cards.
}
```

- `maxTotalRate` dissolves the tier stacking/exclusivity problem: the data
  author (or extraction pipeline) copies the bank's own "最高 X%" claim
  instead of the engine deriving it from tier combinatorics. Zod validates
  `maxTotalRate >= rate`.
- `RewardTier` is unchanged and explicitly re-scoped: tiers are *display
  rows* (label, bonus, cap, condition text, tags). `tags` stay the seed for
  future profile-based personalization (Phase 2).
- Card variants (世界卡/鈦金) with materially different rates become
  separate YAML files; minor differences stay in `note`. No schema field.
- Existing YAML files remain valid — every change is optional.

## 2. Engine / Scoring Contract

```typescript
export interface RateRange { min: number; max: number }
// min = rule.rate (unconditional floor)
// max = rule.maxTotalRate ?? rule.rate + max(tier bonuses, 0)

export interface SearchResult {
  card: CreditCard;
  matchedRule: RewardRule;
  baseRule?: RewardRule;
  rateRange: RateRange;      // replaces maxReward: number
  isSpecificMatch: boolean;
}
```

- Sort key: `rateRange.max` descending (optimistic ordering is the industry
  norm — pickmycard does the same — and the visible range plus condition
  chips counteract the over-promise). Tie-break on `rateRange.min`.
- `computeMaxReward`/`getRuleMaxReward` become `getRuleRateRange`/
  `combineRateRanges` (specific rule vs base wildcard rule: max of maxes,
  min of the *matched* rule's floor).
- The rest of the four-stage pipeline (alias resolution, hard filters,
  specific/general split) is unchanged.

## 3. UI Changes

- `CardResult` shows a range ("2% ～ 6%") when min ≠ max, single value
  otherwise; floor labeled 保底, ceiling labeled 最高.
- rewardType badge; `pointsName` shown for points cards (nominal-rate
  caveat in the existing ⓘ pattern).
- Tier rows keep the existing ⓘ expand/collapse with condition text and
  tag chips. No new interaction patterns.

## 4. Data Pipeline Automation (the core unlock)

### `/add-card` skill (`.claude/skills/add-card/SKILL.md`)

Input: official bank card-page URL (+ optional campaign-page URLs).
Steps the skill enforces:

1. Fetch official page(s) (official sources only — existing hard rule).
2. Extract into `data/cards/{id}.yaml` per schema **and inclusion policy**
   (skip new-cardholder offers, short-term promos — policy text lives in
   the skill so every extraction applies it).
3. Every non-obvious number carries a YAML comment quoting the source
   phrase; uncertain items are flagged `# TODO-REVIEW`.
4. Draft `aliases.yaml` additions for new stores.
5. Run `pnpm validate-data`; print a human review checklist (rates, caps,
   dates, exclusions) before any commit.

Human review of the diff is mandatory; the skill never commits.

### `/refresh-cards` skill

1. Scan all cards: expired rules / rules expiring ≤30 days /
   `updatedAt` >180 days.
2. Re-fetch each affected card's `sourceUrl`s (rule-level first).
3. Draft diffs: delete expired rules (per policy), update renewed campaign
   dates/rates, bump `updatedAt`. Human reviews and commits.

### Freshness warnings in `build-data`

- WARN on: expired rule still present (policy says delete), rule expiring
  ≤30 days, card `updatedAt` older than 180 days.
- Warnings, not fatals: the build must not break the morning a campaign
  lapses; the warning + `/refresh-cards` turn silent rot into a visible
  task. (A scheduled CI freshness report is deliberately deferred — local
  warnings suffice at personal-tool scale.)

## 5. Data Policy (CLAUDE.md update)

Rewrite the 收錄範圍 section of the data rules:

- Include: evergreen benefits + official flagship campaigns (semi-annual).
- Exclude: new-cardholder offers (existing rule), short-term single-merchant
  boosts, quota-limited flash promos.
- Points cards: nominal rate, `pointsName`, no valuation.
- Variants with materially different rates → separate card files.
- Expired rules are deleted, assisted by `/refresh-cards`.
- Document `maxTotalRate` authoring rule: copy the bank's stated maximum.

## 6. Migration

1. Apply schema + engine + UI changes (existing data stays valid
   throughout).
2. Regenerate the 3 existing cards through `/add-card` against current
   (2026-H2) bank pages — this doubles as the pipeline's acceptance test.
3. Add the maintainer's remaining owned cards through the pipeline.

## 7. Testing

- Engine: `getRuleRateRange` (with/without `maxTotalRate`, empty tiers),
  range combination with base rules, sort order incl. tie-break.
- Schema: new optional fields, `maxTotalRate >= rate` refinement.
- build-data: freshness warning cases (expired / expiring / stale).
- Components: range rendering, badge display.
- E2E: expired rules stay invisible; range shown on a tiered card.

## Phase 2 (explicitly out of scope)

- 「我的狀態」profile: user toggles (願意登錄/有大戶等級/綁自動扣繳…)
  matched against tier `tags` to narrow the displayed range per user.
- Popular-card expansion (top 20–30) and public deployment.
- Payment-method dimension (LINE Pay/Apple Pay bindings) beyond tags.
- Scheduled CI freshness reports.

## Rejected Alternatives

- **Full condition DSL / rule AST** — the original tar pit. Unbounded
  schema growth chasing adversarially open-ended bank marketing, with no
  engine consumer for the semantics. This is what killed v1 momentum.
- **Runtime LLM / RAG answering** — requires a backend or API keys on a
  static site, seconds of latency, non-deterministic answers, and
  hallucination risk on exact numbers — fatal for a rate-lookup product.
- **Point valuation conversion** — adds a contentious exchange-rate dataset
  to maintain; nominal rates with a badge deliver most of the comparison
  value.
- **MCC-based modeling** (ccreward-style) — Taiwan rewards are
  merchant-list driven and users don't know MCCs; store-name matching with
  aliases remains the right query surface.

## Risks

| Risk | Mitigation |
|---|---|
| LLM extraction errors | Source-quote comments + `TODO-REVIEW` flags + mandatory human diff review + `validate-data` gate |
| Optimistic sort still over-promises | Visible floor–ceiling range + condition chips; Phase 2 profile narrows honestly |
| Bank pages change layout / JS-render | Skill falls back to asking the user to paste page text; sourceUrl per rule limits blast radius |
| Nominal points rates skew comparison | rewardType badge + ⓘ caveat; valuation deferred deliberately |
