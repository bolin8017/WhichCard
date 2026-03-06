import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ResultSection from '$components/ResultSection.svelte';
import type { SearchResult } from '$lib/engine/search';

const makeResult = (id: string, maxReward: number): SearchResult => ({
	card: {
		id,
		name: `Card ${id}`,
		bank: 'Bank',
		network: ['visa'],
		rewardType: '現金回饋',
		sourceUrl: 'https://example.com',
		updatedAt: '2026-01-01',
		rewards: []
	},
	matchedRule: {
		stores: ['*'],
		region: 'domestic',
		rate: maxReward,
		limit: 0,
		limitUnit: '元'
	},
	maxReward,
	isSpecificMatch: false
});

describe('ResultSection', () => {
	it('renders title and count', () => {
		render(ResultSection, {
			props: {
				title: 'momo 指定回饋',
				count: 2,
				results: [makeResult('a', 5), makeResult('b', 3)]
			}
		});
		expect(screen.getByText('momo 指定回饋 (2)')).toBeInTheDocument();
	});

	it('renders hint when provided', () => {
		render(ResultSection, {
			props: {
				title: 'Test',
				count: 1,
				hint: '僅接受 Mastercard',
				results: [makeResult('a', 5)]
			}
		});
		expect(screen.getByText('僅接受 Mastercard')).toBeInTheDocument();
	});

	it('not rendered when results is empty', () => {
		const { container } = render(ResultSection, {
			props: { title: 'Test', count: 0, results: [] }
		});
		expect(container.querySelector('section')).toBeNull();
	});
});
