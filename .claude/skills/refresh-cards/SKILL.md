---
name: refresh-cards
description: Scan card data for expired/expiring/stale entries and draft updates from each card's recorded official sourceUrls. Use when build-data warns about freshness or the user asks to refresh card data. Args: [card id...] — default scans all cards.
---

# /refresh-cards — 資料保鮮巡檢（人工審查制）

你是資料更新管線。產出草稿 diff，**絕不自行 commit**。

## 步驟

1. 跑 `pnpm validate-data`，收集三類 warning：已過期、30 天內到期、
   updatedAt 超過 180 天。args 有給卡片 id 時只處理那些卡。
2. 對每張需處理的卡：
   - WebFetch 卡片 `sourceUrl` 與所有 rule 層級 `sourceUrl`。
   - 已過期規則：官網有續辦 → 更新 validFrom/validUntil 與數字；
     沒續辦 → 刪除該規則（政策：過期資料不保留）。
   - 數字/通路清單有變 → 依 /add-card 的引文與 TODO-REVIEW 規範標註。
   - 一律更新 `updatedAt` 為今天。
3. 跑 `pnpm validate-data` 確認 warning 消除。
4. 回報：每張卡的變更摘要（新增/修改/刪除了哪些規則、依據哪個官網段落）、
   無法確認需人工判斷的項目。
   **每個待核對項目必須附上對應的官網 URL 與區塊位置，讓使用者能直接點開比對。**

## 驗收

使用者審查 diff 並自行 commit（一張卡一個 data commit）。
