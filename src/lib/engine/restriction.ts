import type { CardNetwork, StoreRestriction } from '$lib/types';

const NETWORK_LABELS: Record<CardNetwork, string> = {
	visa: 'Visa',
	mastercard: 'Mastercard',
	jcb: 'JCB',
	amex: 'AMEX'
};

export function describeRestriction(restriction?: StoreRestriction): string | undefined {
	if (!restriction) return undefined;
	if (restriction.note) return restriction.note;
	if (restriction.networks?.length) {
		return `此通路僅接受 ${restriction.networks.map((n) => NETWORK_LABELS[n]).join(' / ')}`;
	}
	if (restriction.cards?.length || restriction.banks?.length) {
		return '此通路僅接受特定卡片';
	}
	return undefined;
}
