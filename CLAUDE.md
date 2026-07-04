# WhichCard 開發規範

## 專案概述

「刷哪張」— 純前端信用卡回饋查詢工具。使用者輸入通路名稱，即時顯示最佳信用卡回饋。

## Tech Stack

- SvelteKit + TypeScript (strict mode, no `any`)
- Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Vite (build tool)
- Tailwind CSS v4 (styling, mobile-first)
- Vitest + @testing-library/svelte (unit/component tests)
- Playwright (E2E tests)
- pnpm (package manager)
- Zod (data validation)
- js-yaml (YAML parsing for build pipeline)

## 專案架構

```
data/                    # YAML 原始資料（一張卡一個檔案）
  cards/{id}.yaml        # 信用卡回饋規則
  stores/{name}.yaml     # 通路限制（如限定卡組織）
  aliases.yaml           # 通路別名對照表
  categories.yaml        # 通路類別（從屬關係，非別名）
.claude/skills/
  add-card/              # /add-card 官方頁面→YAML 草稿管線
  refresh-cards/         # /refresh-cards 資料保鮮巡檢
scripts/
  build-data.ts          # YAML → JSON 建置管線
  migrate-data.ts        # 一次性資料遷移腳本
src/
  lib/
    types.ts             # 所有型別定義
    schema.ts            # Zod schema 驗證
    data/                # 建置產生的 JSON（gitignored，由 build-data 產生）
      cards.json
      search-index.json
    engine/              # 搜尋引擎（純邏輯，無 UI 依賴）
      alias.ts           # 三層別名解析（exact→prefix→substring）
      category.ts        # 類別倒排索引 + 通路展開
      filter.ts          # 卡組織/有效期/排除類別過濾
      scoring.ts         # 回饋率區間計算（保底~最高）
      search.ts          # 四階段搜尋管線
      restriction.ts     # 通路限制提示文字（describeRestriction）
      index.ts           # StoreIndex + PrefixIndex 建構
    stores/              # Svelte reactive stores
      search.svelte.ts   # 搜尋狀態（用 getter 而非 $derived，方便測試）
      myCards.svelte.ts  # 我的卡片 + localStorage 持久化
  components/            # UI 元件（PascalCase）
  routes/                # SvelteKit 頁面路由
tests/
  engine/                # 搜尋引擎單元測試
  components/            # 元件測試
  e2e/                   # Playwright E2E 測試
```

## 程式碼規範

- TypeScript strict mode，絕不使用 `any`，所有型別定義於 `src/lib/types.ts`
- 元件只管渲染，業務邏輯抽至 `src/lib/engine/` 和 `src/lib/stores/`
- 搜尋引擎使用純函數，不依賴 Svelte reactive context（方便單元測試）
- Store 使用 `$state` + getter pattern（非 `$derived`），確保 Vitest 可直接測試
- 每個元件和 engine 模組都必須有對應的測試檔
- Commit 格式詳見下方「Git 規範」章節
- 檔案命名：元件用 PascalCase，engine/stores/utils 用 camelCase
- 優先使用具名 export

## Git 規範（嚴格遵循 Google Engineering Practices）

### Commit 訊息格式（Conventional Commits）

- 第一行：`type: 祈使句簡述`（≤50 字元）
- type 僅限：feat / fix / docs / refactor / test / chore / style / perf
- 空一行後寫 body：解釋「為什麼」這樣改、有什麼限制或取捨
- Body 每行不超過 72 字元
- 禁止模糊訊息如 "fix bug"、"update code"、"WIP"
- 提交前重新審視訊息，確保準確反映最終變更內容

### Commit 大小（Small CLs 原則）

- 每個 commit 只做一件事：一個功能片段、一個 bug 修復、或一次重構
- 目標 ≤100 行變更；超過 200 行應考慮拆分
- 重構與功能變更必須分開 commit
- 資料變更（YAML / JSON）與程式碼變更分開 commit
- 每個 commit 都必須能獨立通過 CI（不能破壞 build）
- 相關測試必須包含在同一個 commit 中

### Branch 規範

- 主分支為 `master`，禁止直接 push 到 master
- 所有變更一律使用 feature branch + PR
- Feature branch 命名：`feat/描述`、`fix/描述`、`refactor/描述`、`docs/描述`
- Branch 合併後應刪除遠端 feature branch

### 開發流程

- 使用 `git checkout -b <branch>` 建立並切換 feature branch，不使用 git worktree
- 開發過程中在本地 `pnpm dev` 即時驗證每次修改的結果
- 完成後在同一工作目錄執行完整檢查再推送（見 Push 規範）

### Push 規範

- 推送前必須通過完整本地檢查：`pnpm build-data && pnpm check && pnpm test && pnpm build`
- 禁止 `--force` push 到共享分支（master）
- 禁止 `--no-verify` 跳過 pre-commit hooks
- 每次 push 前確認目標分支正確

### Code Review / PR

- 所有變更必須經過 PR review 後才能合併到 master
- PR 必須通過 CI（build-data + check + test + build）
- PR 描述需包含：變更摘要、動機、測試計畫
- Reviewer 應關注：正確性、可讀性、測試覆蓋、資料完整性

## 資料規範

### 資料管線

原始資料以 YAML 格式存放在 `data/` 目錄，透過 `pnpm build-data` 建置為 `src/lib/data/` 下的 JSON 檔案。建置管線會執行：

1. Zod schema 驗證每張卡片
2. 交叉引用檢查（store name 必須存在於 aliases、卡組織相容性、過期規則）
3. 產出 `cards.json` 和 `search-index.json`

### 信用卡資料（`data/cards/{id}.yaml`）

- 每張卡一個 YAML 檔，檔名為卡片 ID
- 資料欄位定義見 `src/lib/types.ts` 的 `CreditCard` interface
- 任何資料變更必須通過 `pnpm validate-data` 確認格式正確
- 每筆資料必須附上 `sourceUrl`（銀行官方來源連結）

### 通路別名（`data/aliases.yaml`）

- key 為主要名稱，value 為別名陣列
- 新增通路時，加入常見的中英文別名、簡稱
- 別名的 key 需與 `cards.json` 中 `stores` 使用的名稱一致
- 別名是「同一實體的不同名稱」；從屬關係（台電屬於代繳）寫在
  `categories.yaml`，兩者不可混用

### 通路類別（`data/categories.yaml`）

- key 為類別名稱（保費、代繳…），value 為成員通路陣列
- 成員必須是 `aliases.yaml` 的 key（可搜尋的 canonical 名稱）
- 卡片規則的 `stores` / `excludes` 可寫通路名或類別名
- 搜尋時通路會展開為 {通路 ∪ 所屬類別} 做集合交集比對，
  排除與匹配共用同一機制（搜「台電」會觸發 `excludes: [代繳]`）

### 通路限制（`data/stores/{name}.yaml`）

- 用於限制特定通路只接受某些卡組織/銀行/卡片
- 可透過 `networks`、`banks`、`cards` 三個欄位組合限制
- 例如好市多僅接受富邦 Costco 聯名卡（`cards: [fubon-costco]`）

## 新增信用卡資料規範

### 收錄範圍

- 收錄：常態權益＋銀行官方主檔活動（通常半年一期，必須填 validFrom/validUntil）
- 不收錄：新戶/首刷優惠、單月或單一通路短期加碼、名額抽獎型活動
- 點數回饋卡以銀行標示的名目回饋率收錄，`pointsName` 填點數名稱（如小樹點），不做點數折現
- 精選通路、指定通路等加碼回饋，必須逐一列出具體適用通路名稱供確認，不可籠統帶過（攸關搜尋正確性）
- 新增/更新資料優先使用 `/add-card`、`/refresh-cards` skills 產草稿，人工審查後才 commit

### 資料來源

- 必須以銀行官方網頁為資料來源，`sourceUrl` 填入該頁面連結
- 禁止以部落格、論壇、PTT 等非官方來源作為依據
- `updatedAt` 填入資料確認日期（YYYY-MM-DD）

### 卡片層級（CreditCard）

- `id` 格式為 `{銀行英文}-{卡名英文}`，全小寫 kebab-case（如 `sinopac-dawho`）
- `id` 不可與現有卡片重複（schema 會驗證）
- `bank` 使用常見稱呼（如「中國信託」非「中國信託商業銀行」）
- `network` 必須指定卡組織陣列：`visa` / `mastercard` / `jcb` / `amex`
- `rewardType` 僅限 `現金回饋` 或 `點數回饋`

### 回饋規則（RewardRule）

- 一張卡的不同通路/地區拆成獨立的 reward 物件
- `stores: ["*"]` 代表全通路，此時必須提供 `storeLabel`（如「國內全通路」）
- `region` 必須明確區分：`domestic` / `international` / `japan`
- 同一通路 + 同一地區不應出現重複的 reward 規則
- `rate: 0` 允許（如悠遊卡自動加值無基本回饋，僅有 tier bonus）
- `limit: 0` 代表無上限，非留空
- `maxTotalRate` 直接抄官網「最高X%」宣稱值，禁止自行加總 tier 推導；
  未填時引擎 fallback 為 rate + max(tier bonus)
- rule 層級 `sourceUrl`：規則依據的活動頁與卡片頁不同時必填（供 /refresh-cards 重抓）
- 卡片等級（世界卡/鈦金）回饋差異大時拆成獨立卡片檔，小差異寫 note

### 加碼回饋（RewardTier）

- `bonus` 為加碼部分的回饋率，非含基本的總回饋率
- `condition` 用自然語言描述完整條件
- `tags` 從 `CONDITION_TAGS` 中選取，不可自創（可用值見 `src/lib/types.ts`）

### 排除類別（excludes）

- 若該回饋規則不適用特定消費類別（如保費、代繳），加入 `excludes` 陣列
- 排除類別名稱需與 `aliases.yaml` 中的主要名稱一致

### 期間限定與過期資料

- 常態權益不需填 `validFrom` / `validUntil`
- 期間限定活動必須填寫起迄日期
- 過期的回饋規則必須從 YAML 中刪除，不保留舊資料

### 新增 ConditionTag 流程

當既有 tags 無法描述新卡片的條件時：

1. 在 `src/lib/types.ts` 的 `CONDITION_TAGS` 陣列中新增 tag
2. 執行 `pnpm validate-data` 確認 schema 驗證通過

### 驗證與提交

- 新增/修改後必須執行 `pnpm validate-data` 確認通過
- 資料變更與程式碼變更分開 commit

## 測試規範

- 搜尋引擎（`src/lib/engine/`）需完整單元測試
- 新增元件需有基本渲染測試 + 主要互動測試
- PR 必須通過 CI（build-data + check + test + build）
- 執行測試：`pnpm test`
- 執行型別檢查：`pnpm check`
- 執行 E2E 測試：`pnpm test:e2e`

## 常用指令

- `pnpm dev` — 啟動開發伺服器
- `pnpm build` — 建置生產版本（含 build-data）
- `pnpm build-data` — YAML → JSON 建置管線（含 freshness 警告：過期/30天內到期/180天未更新）
- `pnpm validate-data` — 僅驗證資料格式（不產出 JSON）
- `pnpm test` — 執行 Vitest 單元/元件測試
- `pnpm test:e2e` — 執行 Playwright E2E 測試
- `pnpm check` — 執行 svelte-check 型別檢查
- `/add-card <官網URL>` — 從官方頁面草擬卡片 YAML（人工審查制）
- `/refresh-cards [card id...]` — 巡檢過期/將到期/久未更新資料並草擬更新

## 文件同步規範

- 每次完成任務後，檢查並同步更新 `CLAUDE.md` 和 `README.md` 中相關的內容
- 新增功能、修改架構、變更資料結構等，都需確認文件是否需要對應更新
- 文件更新應包含在同一個 PR 中

## 架構決策

- 資料用 YAML 原始檔 + build-time JSON：每張卡一個 YAML 檔，建置時驗證並合併為 JSON
- 三層準確性模型：通路可判定的（排除/類別回饋/指定通路）→ 結構化資料機器過濾；
  使用者狀態的（等級/方案/登錄）→ 條件標籤展示（Phase 2 做 profile 收窄）；
  交易當下才知道的（金額/上限/商場內店）→ 僅展示警語，永不機器求值
- 搜尋引擎使用四階段管線：Retrieval → Hard Filter → Scoring → Ranking
- 搜尋用三層 alias 解析：exact → prefix → substring（中文不做 fuzzy match）
- 通路比對用 {通路 ∪ 所屬類別} 集合交集；exclude 與 reward 匹配共用同一展開機制
- 回饋顯示為保底~最高區間（min = 規則無條件 rate，max = maxTotalRate 或 rate+最佳 tier）；
  排序用區間上緣，同分時 exact-store 先於 category，再比下緣
- 資料生產走 LLM 輔助管線（/add-card、/refresh-cards），build-time 抽取＋人工審查，
  runtime 不用 LLM（成本/延遲/數字幻覺）
- 搜尋結果分為兩層：「具體匹配」（stores 包含搜尋通路的規則）排前面，「一般回饋」（`stores: ["*"]` 萬用規則）排後面，中間以分隔線區分
- 具體匹配的卡片若同時有萬用規則，以 `baseRule` 附帶顯示；`maxReward` 取兩者中較高的
- 通路限制（store restrictions）在搜尋階段 hard filter 掉不符合的卡片
- `excludes` 在搜尋階段過濾，不在 UI 上顯示「不含 XX」
- 「我的卡片」持久化用 localStorage（key: `whichcard-my-cards`）
- Store 使用 `$state` + getter pattern（非 `$derived`），確保 Vitest 可在非 reactive context 測試
- SvelteKit adapter-static 產出純靜態 SPA，部署至 `dist/`
- 注意事項（note）使用 ⓘ 展開/收合模式：卡片名稱旁（card.note）、通路名稱旁（rule.note）、tier 行尾（tier.condition），三層各自獨立
