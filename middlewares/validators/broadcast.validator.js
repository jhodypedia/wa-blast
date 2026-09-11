import { z } from 'zod';
import { formatNumber } from '../../utils/formatNumber.js';
import { sessionIdSchema } from './shared.js';

const messageTypes = [
  'text',
  'image',
  'video',
  'document',
  'audio',
  'sticker',
  'location',
  'contact',
  'button',
  'image-button',
  'list',
  'poll',
];

const targetSchema = z.string().trim().min(1).max(128).refine((target) => {
  try {
    formatNumber(target);
    return true;
  } catch {
    return false;
  }
}, 'Target must be a valid phone number or supported WhatsApp JID');

const variableValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const broadcastMessageSchema = z.object({
  sessionId: sessionIdSchema,
  type: z.enum(messageTypes),
  targets: z.array(targetSchema).min(1).max(1000).refine(
    (targets) => new Set(targets).size === targets.length,
    'Targets must not contain duplicates',
  ),
  message: z.string().max(65536).default(''),
  variables: z.record(z.string(), variableValuesSchema).default({}),
  delay: z.object({
    min: z.number().int().min(0).max(3600000),
    max: z.number().int().min(0).max(3600000),
  }).strict().default({ min: 2000, max: 5000 }),
  mediaPayload: z.record(z.string(), z.unknown()).default({}),
}).strict().refine(
  ({ delay }) => delay.min <= delay.max,
  { path: ['delay', 'max'], message: 'delay.max must be greater than or equal to delay.min' },
);

export const broadcastIdSchema = z.uuid();