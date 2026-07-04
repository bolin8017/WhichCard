---
name: add-card
description: Draft a new card YAML (or re-extract an existing one) from official bank pages, following WhichCard's schema and inclusion policy. Use when the user asks to add or refresh a credit card. Args: <official card page URL> [campaign page URLs...] — or a card id like sinopac-dawho to refresh from its recorded sourceUrls.
---

# /add-card — 官方頁面 → YAML 草稿（人工審查制）

你是資料抽取管線。產出草稿，**絕不自行 commit**。

## 硬規則

1. 只能使用銀行官方頁面（args 給的 URL 及其站內連結）。禁止部落格、論壇、新聞。
2. 逐條套用收錄政策（見下）。被排除的權益仍要在回報中列出「已排除＋原因」。
3. 每個非顯然的數字（rate、bonus、limit、maxTotalRate、日期）在 YAML 加上
   來源引文註解：`# 官網:「最高3.3%回饋」`。
4. 資訊不確定或頁面矛盾 → 該行加 `# TODO-REVIEW: <疑點>`，不要猜。
5. 若頁面是 JS 動態渲染抓不到內容，請使用者貼上頁面文字，不要改用非官方來源。

## 收錄政策（與 CLAUDE.md 一致）

- 收：常態權益、銀行官方主檔活動（通常半年一期，須有 validFrom/validUntil）。
- 不收：新戶/首刷禮、單月或單一通路短期加碼、名額抽獎型活動。
- 點數卡：rate 填銀行標示的名目 %，`pointsName` 填點數名稱，不做折現。
- 方案切換型（如 CUBE）：每個方案的指定通路寫成獨立 reward，
  base rate 為卡片無腦回饋，方案加碼寫成 tier（tags: [方案切換]）。
- 等級差異大（如世界卡 vs 鈦金）→ 拆成兩個卡片檔；小差異寫 note。

## 產出步驟

1. WebFetch 所有給定 URL；需要時跟進站內的權益/活動子頁。
2. 寫 `data/cards/{bank}-{name}.yaml`（id 規則：全小寫 kebab-case）。
   - 每條 rule：stores（用 aliases/categories 的 canonical 名稱）、region、
     rate、limit、limitUnit、excludes、validFrom/validUntil（主檔活動必填）、
     maxTotalRate（直接抄官網「最高X%」，禁止自行加總 tier 推導）、
     sourceUrl（該 rule 依據的活動頁，與卡片頁不同時必填）。
   - 精選/指定通路必須逐一列出通路名稱，不可寫「指定通路」帶過。
3. 新通路 → 草擬 `data/aliases.yaml` 增量（中英別名、常見簡稱）；
   屬於某類別（保費/代繳/…）→ 草擬 `data/categories.yaml` 增量。
4. 跑 `pnpm validate-data`，修到只剩預期中的 warning。
5. 回報：規則摘要表（通路/區域/區間/效期）、已排除清單＋原因、
   所有 TODO-REVIEW、請使用者核對的官網數字清單。

## 驗收

使用者審查 diff 並自行 commit（資料與程式碼分開 commit）。
