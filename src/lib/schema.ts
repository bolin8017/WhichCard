import { z } from 'zod';
import { CARD_NETWORKS, REWARD_TYPES, REGIONS, LIMIT_UNITS, CONDITION_TAGS } from './types';

export const rewardTierSchema = z.object({
	label: z.string().min(1),
	bonus: z.number().nonnegative(),
	limit: z.number().nonnegative(),
	limitUnit: z.enum(LIMIT_UNITS),
	condition: z.string().min(1),
	tags: z.array(z.enum(CONDITION_TAGS)).optional()
});

export const rewardRuleSchema = z.object({
	stores: z.array(z.string().min(1)).min(1),
	storeLabel: z.string().optional(),
	region: z.enum(REGIONS),
	rate: z.number().nonnegative(),
	limit: z.number().nonnegative(),
	limitUnit: z.enum(LIMIT_UNITS),
	excludes: z.array(z.string()).optional(),
	validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	note: z.string().optional(),
	tiers: z.array(rewardTierSchema).optional()
});

export const creditCardSchema = z.object({
	id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
	name: z.string().min(1),
	bank: z.string().min(1),
	network: z.array(z.enum(CARD_NETWORKS)).min(1),
	rewardType: z.enum(REWARD_TYPES),
	sourceUrl: z.string().url(),
	updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	note: z.string().optional(),
	rewards: z.array(rewardRuleSchema).min(1)
});

export const storeRestrictionSchema = z.object({
	networks: z.array(z.enum(CARD_NETWORKS)).optional(),
	banks: z.array(z.string()).optional(),
	cards: z.array(z.string()).optional()
});

export const storeEntrySchema = z.object({
	name: z.string().min(1),
	restrictions: storeRestrictionSchema,
	note: z.string().optional()
});

export const aliasesSchema = z.record(z.string(), z.array(z.string()));
