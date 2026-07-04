import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
	test('renders search bar and popular chips', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByText('刷哪張')).toBeVisible();
		await expect(page.getByPlaceholder('輸入商家或通路名稱...')).toBeVisible();
		await expect(page.getByRole('button', { name: '好市多' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'momo' })).toBeVisible();
	});

	test('clicking popular chip triggers search', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: '好市多' }).click();
		// 好市多 has fubon-costco as specific match
		await expect(page.getByText('好市多 指定回饋')).toBeVisible();
	});

	test('typing 好市多 shows fubon-costco card', async ({ page }) => {
		await page.goto('/');
		await page.getByPlaceholder('輸入商家或通路名稱...').fill('好市多');
		// Fubon Costco card (the only card accepted at 好市多) should be visible
		await expect(page.getByText('Costco聯名卡')).toBeVisible();
		// DAWHO card should appear only in general section (not specific match)
		await expect(page.getByText('好市多 指定回饋')).toBeVisible();
	});

	test('region filter changes results', async ({ page }) => {
		await page.goto('/');
		await page.getByPlaceholder('輸入商家或通路名稱...').fill('好市多');
		await expect(page.getByText('好市多 指定回饋')).toBeVisible();

		// Switch to international — 好市多 is domestic, specific section disappears
		await page.getByRole('radio', { name: '國外' }).click();
		await expect(page.getByText('好市多 指定回饋')).not.toBeVisible();
	});

	test('clear search returns to initial state', async ({ page }) => {
		await page.goto('/');
		const input = page.getByPlaceholder('輸入商家或通路名稱...');
		await input.fill('好市多');
		await expect(page.getByText('好市多 指定回饋')).toBeVisible();

		// Clear search
		await page.getByLabel('清除搜尋').click();
		// Should return to initial state with popular chips
		await expect(page.getByText('刷哪張')).toBeVisible();
		await expect(page.getByRole('button', { name: '好市多' })).toBeVisible();
	});
});

test.describe('Range display and category exclusion', () => {
	test('tiered card shows floor-ceiling range (CUBE at 蝦皮)', async ({ page }) => {
		await page.goto('/');
		await page.getByPlaceholder('輸入商家或通路名稱...').fill('蝦皮');
		await expect(page.getByText('CUBE卡')).toBeVisible();
		await expect(page.getByText('0.3% ~ 3.3%')).toBeVisible();
	});

	test('excluded category member hides excluding cards (台電 → 代繳)', async ({ page }) => {
		await page.goto('/');
		await page.getByPlaceholder('輸入商家或通路名稱...').fill('台電');
		// DAWHO and CUBE domestic wildcards both exclude 代繳 — must not render
		await expect(page.getByText('DAWHO現金回饋信用卡')).toHaveCount(0);
		await expect(page.getByText('CUBE卡')).toHaveCount(0);
	});

	test('category exclusion is per-card (國泰人壽 → 保費)', async ({ page }) => {
		await page.goto('/');
		await page.getByPlaceholder('輸入商家或通路名稱...').fill('國泰人壽');
		// DAWHO excludes 保費 → hidden; CUBE does not exclude 保費 → visible at base rate
		await expect(page.getByText('CUBE卡')).toBeVisible();
		await expect(page.getByText('DAWHO現金回饋信用卡')).toHaveCount(0);
	});
});

test.describe('My Cards', () => {
	test('navigate to my-cards, select cards, verify count', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: '我的卡片' }).click();
		await expect(page.getByRole('heading', { name: '我的卡片' })).toBeVisible();
		await expect(page.getByText('已選 0 張卡片')).toBeVisible();

		// Select a card
		const checkbox = page.locator('label').filter({ hasText: 'DAWHO' }).getByRole('checkbox');
		await checkbox.click();
		await expect(page.getByText('已選 1 張卡片')).toBeVisible();
	});
});
