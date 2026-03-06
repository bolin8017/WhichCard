import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import CardResult from '$components/CardResult.svelte';
import type { SearchResult } from '$lib/engine/search';

const makeResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
	card: {
		id: 'test-card',
		name: 'Test Card',
		bank: 'Test Bank',
		network: ['visa'],
		rewardType: '現金回饋',
		sourceUrl: 'https://example.com',
		updatedAt: '2026-01-01',
		rewards: []
	},
	matchedRule: {
		stores: ['momo'],
		region: 'domestic',
		rate: 5,
		limit: 300,
		limitUnit: '元',
		tiers: [
			{
				label: '加碼',
				bonus: 2,
				limit: 200,
				limitUnit: '元',
				condition: '指定通路消費',
				tags: ['指定通路']
			}
		]
	},
	maxReward: 7,
	isSpecificMatch: true,
	...overrides
});

describe('CardResult', () => {
	it('renders card info', () => {
		render(CardResult, { props: { result: makeResult() } });
		expect(screen.getByText('Test Card')).toBeInTheDocument();
		expect(screen.getByText('Test Bank')).toBeInTheDocument();
	});

	it('displays max reward rate', () => {
		render(CardResult, { props: { result: makeResult() } });
		expect(screen.getByText('7%')).toBeInTheDocument();
	});

	it('shows network badges', () => {
		render(CardResult, { props: { result: makeResult() } });
		expect(screen.getByText('Visa')).toBeInTheDocument();
	});

	it('expand/collapse tiers', async () => {
		const user = userEvent.setup();
		render(CardResult, { props: { result: makeResult() } });

		// Tiers hidden by default
		expect(screen.queryByText('指定通路消費')).not.toBeInTheDocument();

		// Click to expand
		await user.click(screen.getByText('加碼條件'));
		expect(screen.getByText('指定通路消費')).toBeInTheDocument();

		// Click to collapse
		await user.click(screen.getByText('加碼條件'));
		expect(screen.queryByText('指定通路消費')).not.toBeInTheDocument();
	});
});
