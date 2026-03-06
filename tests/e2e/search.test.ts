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
		await page.getByRole('button', { name: 'momo' }).click();
		// Should show results
		await expect(page.getByText('momo 指定回饋')).toBeVisible();
	});

	test('typing 好市多 shows only Mastercard cards', async ({ page }) => {
		await page.goto('/');
		await page.getByPlaceholder('輸入商家或通路名稱...').fill('好市多');
		// Should show restriction hint
		await expect(page.getByText('此通路僅接受 Mastercard')).toBeVisible();
		// Costco card should be visible
		await expect(page.getByText('Costco聯名卡')).toBeVisible();
		// LINE Pay card (Visa only) should NOT be visible
		await expect(page.getByText('LINE Pay信用卡')).not.toBeVisible();
	});

	test('region filter changes results', async ({ page }) => {
		await page.goto('/');
		await page.getByPlaceholder('輸入商家或通路名稱...').fill('好市多');
		await expect(page.getByText('好市多 指定回饋')).toBeVisible();

		// Switch to international — 好市多 is domestic, specific section disappears
		await page.getByRole('radio', { name: '國外' }).click();
		await expect(page.getByText('好市多 指定回饋')).not.toBeVisible();
	});

	test('empty search returns to initial state', async ({ page }) => {
		await page.goto('/');
		const input = page.getByPlaceholder('輸入商家或通路名稱...');
		await input.fill('momo');
		await expect(page.getByText('momo 指定回饋')).toBeVisible();

		// Clear search
		await page.getByLabel('清除搜尋').click();
		// Should return to initial state with popular chips
		await expect(page.getByText('刷哪張')).toBeVisible();
	});
});

test.describe('My Cards', () => {
	test('navigate to my-cards, select cards, verify count', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: '我的卡片' }).click();
		await expect(page.getByText('我的卡片')).toBeVisible();
		await expect(page.getByText('已選 0 張卡片')).toBeVisible();

		// Select a card
		const checkbox = page.locator('label').filter({ hasText: 'DAWHO' }).getByRole('checkbox');
		await checkbox.click();
		await expect(page.getByText('已選 1 張卡片')).toBeVisible();
	});
});
