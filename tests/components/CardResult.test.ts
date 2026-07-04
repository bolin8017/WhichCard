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
	rateRange: { min: 5, max: 7 },
	isSpecificMatch: true,
	matchKind: 'store',
	...overrides
});

describe('CardResult', () => {
	it('renders card info', () => {
		render(CardResult, { props: { result: makeResult() } });
		expect(screen.getByText('Test Card')).toBeInTheDocument();
		expect(screen.getByText('Test Bank')).toBeInTheDocument();
	});

	it('displays reward range when floor differs from ceiling', () => {
		render(CardResult, { props: { result: makeResult() } });
		expect(screen.getByText('5% ~ 7%')).toBeInTheDocument();
	});

	it('displays single rate when floor equals ceiling', () => {
		render(CardResult, {
			props: { result: makeResult({ rateRange: { min: 7, max: 7 } }) }
		});
		expect(screen.getByText('7%')).toBeInTheDocument();
	});

	it('shows network badges', () => {
		render(CardResult, { props: { result: makeResult() } });
		expect(screen.getByText('Visa')).toBeInTheDocument();
	});

	it('shows points name badge for points cards', () => {
		const result = makeResult();
		result.card = { ...result.card, rewardType: '點數回饋', pointsName: '小樹點' };
		render(CardResult, { props: { result } });
		expect(screen.getByText('點數回饋（小樹點）')).toBeInTheDocument();
	});

	it('shows condition tag chips inside expanded tiers', async () => {
		const user = userEvent.setup();
		render(CardResult, { props: { result: makeResult() } });
		await user.click(screen.getByText('加碼條件'));
		expect(screen.getByText('指定通路')).toBeInTheDocument();
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
