import { z } from 'zod';
import { baseMessageShape } from './shared.js';

export const locationMessageSchema = z.object({
  ...baseMessageShape,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().min(1).max(255).optional(),
  address: z.string().min(1).max(500).optional(),
  url: z.url().optional(),
}).strict();