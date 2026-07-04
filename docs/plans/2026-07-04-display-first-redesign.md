# WhichCard v2 Redesign — Display-First Rules + Automated Data Pipeline

Date: 2026-07-04
Status: Approved

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

4. **Exclusion matching was name-exact, so excluded categories leaked.**
   `isExcluded` compares the searched canonical name against `excludes`
   literally. A rule excluding 代繳 still surfaced when searching 台電,
   because nothing linked 台電 to 代繳; likewise cards excluding 保費
   still appeared for insurance searches unless the query happened to hit
   the exact canonical string. Users saw rewards on purchases the card
   explicitly does not reward — the accuracy failures that eroded trust
   in v1. (`aliases.yaml` was also abused for membership: 壽險保費 as an
   *alias* of 保費 is fine, but there was no home for "台電 *belongs to*
   代繳".)

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
4. **Initial validation set: 永豐 DAWHO + 國泰 CUBE.** Two deliberately
   hard cards: DAWHO exercises member-tier tiers, zero-base rules
   (悠遊卡自動加值), and category exclusions; CUBE exercises points-card
   nominal display and switchable-plan (權益方案) modeling. Both go
   through the new pipeline against 2026-H2 official pages.

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

A fourth, smaller addition — a bounded **category layer** — links stores
to the ~20 category names bank T&Cs actually reuse (保費、代繳、網購…),
making exclusions and category rewards deterministic instead of leaky.

The LLM sits at **build time** (deterministic, reviewable, versioned
output), never at runtime (cost, latency, hallucinated numbers on a static
site). This asymmetry is the core architectural judgment of the redesign.

## Accuracy Model — Three Layers

Banks do run rule engines — but at **settlement time, with complete
inputs**: MCC, acquiring merchant ID, transaction amount, the cardholder's
tier, registration state, and current cap usage. A lookup tool predicts
**before the fact, from a store name**. The accuracy gap is input
completeness, not rule expressiveness. Every reward/exclusion rule
therefore falls into one of three layers, each with its own treatment:

| Layer | Examples | Input needed | Treatment |
|---|---|---|---|
| **Store-decidable** | exclusions (保費/代繳), category rewards (幣倍卡 保費 1.2%), designated merchant lists, network/store restrictions | store name only | Structured data; machine-enforced hard filter and match. Must be exact — this is where v1's accuracy bugs lived. |
| **User-state** | member tier (DAWHO 大戶), plan selection (CUBE 權益方案), registration, autopay/e-statement binding | the user's standing profile | Condition tags + floor–ceiling range now; Phase 2 profile narrows the range per user. |
| **Transaction-context** | amount vs caps, cap exhaustion, in-mall acquiring (商場內店), third-party payment routing | the transaction itself | Display-only caveats (note / chips). Never machine-evaluated; pretending otherwise is how the tar pit opens. |

v1's perceived inaccuracy had two sources: layer-1 gaps (no store→category
links, so exclusions leaked) and collapsing all three layers into one
optimistic number. The redesign machine-enforces layer 1 completely,
structures layer 2 for honest display (and later personalization), and
explicitly fences layer 3 as caveats.

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
- `CONDITION_TAGS` gains `方案切換` (switchable-plan cards) — via the
  existing documented tag-addition flow.

### Worked pattern: switchable-plan cards (國泰 CUBE)

CUBE's reward depends on which 權益方案 the user has selected in the app
— mutually exclusive rule sets, switchable daily. This is exactly the
user-state layer, and it fits the existing schema without new fields:

```yaml
# illustrative structure — real numbers come from the pipeline
- stores: [蝦皮, momo, Uber Eats]   # the plan's designated merchant list
  region: domestic
  rate: 0.3                          # always-on base rate
  maxTotalRate: 3.3
  tiers:
    - label: 玩數位方案
      bonus: 3
      condition: 需於 APP 將權益方案切換至「玩數位」
      tags: [方案切換]
```

v1 renders the honest 0.3%–3.3% range with a 方案切換 chip; Phase 2's
profile stores the active plan and narrows results. DAWHO's member-tier
structure (大戶/大戶Plus) already fits the same tier pattern.

## 2. Category Layer (`data/categories.yaml`)

The layer-1 accuracy fix. A new data file maps category → member stores:

```yaml
保費: [國泰人壽, 富邦人壽, 新光人壽, 富邦產險]
代繳: [台電, 台灣自來水, 欣欣瓦斯]
```

- **Alias ≠ category.** `aliases.yaml` maps alternate names of the *same*
  entity (壽險保費 → 保費 remains an alias). Membership — 國泰人壽 *is a*
  保費-category merchant — lives in categories. v1 conflated the two,
  which is one reason exclusions leaked.
- Rules keep referencing stores or categories interchangeably in `stores`
  and `excludes` (existing YAML like `stores: [保費]`,
  `excludes: [保費, 代繳]` is unchanged).
- **Matching:** after alias resolution, the canonical name expands to
  `{store} ∪ categories(store)` via an inverted index built at build
  time. A rule matches if its `stores` intersects the expanded set; a
  rule is excluded if its `excludes` intersects the expanded set.
- **Worked examples:**
  - Searching 國泰人壽 → expands to {國泰人壽, 保費} → a
    `stores: [保費]` rule (幣倍卡 1.2%) matches, while every card whose
    wildcard rule carries `excludes: [保費]` is filtered. Both v1 failure
    modes — the false positive and the missed special reward — disappear.
  - Searching 台電 → expands to {台電, 代繳} → DAWHO's wildcard
    `excludes: [代繳]` now actually fires.
- The ontology is **bounded**: bank T&Cs reuse roughly the same ~20
  exclusion/reward categories (保費、代繳/公用事業、稅費、學費、醫療、
  儲值、第三方支付、網購、外送、超市、加油…). Only categories referenced
  by included cards get entries; `/add-card` drafts memberships for new
  stores, and build-data fails when a name in `stores`/`excludes`
  resolves to neither a store, an alias, nor a category.
- This is deliberately **not raw MCC**: categories carry the T&C's human
  names and the query surface stays store names (consistent with the
  rejected-MCC rationale).

## 3. Engine / Scoring Contract

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
- Stage 1 (retrieval) gains category expansion: the resolved canonical
  name expands to `{store} ∪ categories(store)`; rule matching and
  `isExcluded` become set-intersection tests against the expanded set
  (see Category Layer). Within specific matches, exact-store hits rank
  above category-level hits at equal ceiling rates.
- The remaining pipeline (hard filters, specific/general split) is
  unchanged.

## 4. UI Changes

- `CardResult` shows a range ("2% ～ 6%") when min ≠ max, single value
  otherwise; floor labeled 保底, ceiling labeled 最高.
- rewardType badge; `pointsName` shown for points cards (nominal-rate
  caveat in the existing ⓘ pattern).
- Tier rows keep the existing ⓘ expand/collapse with condition text and
  tag chips. No new interaction patterns.

## 5. Data Pipeline Automation (the core unlock)

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

## 6. Data Policy (CLAUDE.md update)

Rewrite the 收錄範圍 section of the data rules:

- Include: evergreen benefits + official flagship campaigns (semi-annual).
- Exclude: new-cardholder offers (existing rule), short-term single-merchant
  boosts, quota-limited flash promos.
- Points cards: nominal rate, `pointsName`, no valuation.
- Variants with materially different rates → separate card files.
- Expired rules are deleted, assisted by `/refresh-cards`.
- Document `maxTotalRate` authoring rule: copy the bank's stated maximum.

## 7. Migration

1. Apply schema + category layer + engine + UI changes (existing data
   stays valid throughout).
2. Run the **validation pair** through `/add-card` against 2026-H2
   official pages: refresh 永豐 DAWHO, add 國泰 CUBE. Together they
   exercise member tiers, zero-base rules, category exclusions, points
   nominal display, and plan switching — the pipeline's acceptance test.
3. Existing 富邦 Costco / 幣倍卡 files stay (still schema-valid; Costco
   exercises store restrictions) and get refreshed opportunistically once
   the pair proves the pipeline.
4. Then add the maintainer's remaining owned cards.

## 8. Testing

- Engine: `getRuleRateRange` (with/without `maxTotalRate`, empty tiers),
  range combination with base rules, sort order incl. tie-break.
- Category layer: inverted-index build, multi-category stores, expansion
  matching, unknown-name build failure.
- **Exclusion regression suite (the v1 accuracy bug):** searching a
  category member (台電) hides cards whose wildcard excludes the category
  (代繳); searching 保費/國泰人壽 surfaces the special premium rule
  (幣倍卡-style 1.2%) while filtering excluders.
- Schema: new optional fields, `maxTotalRate >= rate` refinement,
  `方案切換` tag.
- build-data: freshness warning cases (expired / expiring / stale);
  unresolved store/category reference fails the build.
- Components: range rendering, badge display, plan-switch chip.
- E2E: expired rules stay invisible; range shown on a tiered card;
  excluded-category search shows no false positives.

## Phase 2 (explicitly out of scope)

- 「我的狀態」profile: user toggles (願意登錄/有大戶等級/綁自動扣繳/
  CUBE 目前方案…) matched against tier `tags` to narrow the displayed
  range per user.
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
| Category memberships incomplete (uncategorized new store lets an exclusion leak again) | `/add-card` drafts memberships for every new store; build-data fails on unresolved references; exclusion regression suite pins known categories |
