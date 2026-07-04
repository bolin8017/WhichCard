---
name: add-card
description: Draft a new card YAML (or re-extract an existing one) from official bank pages, following WhichCard's schema and inclusion policy. Use when the user asks to add or refresh a credit card. Args: <official card page URL> [campaign page URLs...] — or a card id like sinopac-dawho to refresh from its recorded sourceUrls.
---

# /add-card — 官方頁面 → YAML 草稿（人工審查制）

你是資料抽取管線。產出草稿，**絕不自行 commit**。

## 硬規則

1. 只能使用銀行官方頁面（args 給的 URL 及其站內連結）。禁止部落格、論壇、新聞。
2. **必須抓到條款層級，行銷主打區不足以定案**：注意事項、活動辦法、權益分級、
   「一般消費定義」公告都要讀。排除清單、上限共用關係、方案豁免（如超商僅特定
   方案回饋）幾乎只存在這一層。已知的銀行層級定義頁：
   - 永豐一般消費定義（全聯/大全聯/超商/繳費/儲值等排除，適用全卡系）:
     https://bank.sinopac.com/sinopacBT/personal/credit-card/news/20260421090303483000000000000890.html
3. **每次 WebFetch 摘要都視為有損**：關鍵數字（rate/上限/日期/方案數量）要用第二個
   頁面或第二次帶針對性問題的 fetch 交叉確認，對不上就標 TODO-REVIEW。
4. 逐條套用收錄政策（見下）。被排除的權益仍要在回報中列出「已排除＋原因」。
5. 每個非顯然的數字（rate、bonus、limit、maxTotalRate、日期）在 YAML 加上
   來源引文註解：`# 官網:「最高3.3%回饋」`。
6. 資訊不確定或頁面矛盾 → 該行加 `# TODO-REVIEW: <疑點>`，不要猜。
7. 若頁面是 JS 動態渲染抓不到內容，請使用者貼上頁面文字，不要改用非官方來源。
8. 排除項目能對應到 canonical 通路/類別的（全聯、大全聯、便利商店、悠遊卡/一卡通/
   icash 加值、保費、代繳）必須寫進 `excludes` 結構化過濾，其餘寫 note；
   「特定方案才有回饋」的通路用獨立 rule（rate: 0 + 方案 tier）表達，不可漏。

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
   **每個待核對項目必須附上對應的官網 URL 與區塊位置（如「注意事項第14條」
   「指定超商旁的ⓘ」），讓使用者能直接點開比對，不必自己翻找。**

## 驗收

使用者審查 diff 並自行 commit（資料與程式碼分開 commit）。
