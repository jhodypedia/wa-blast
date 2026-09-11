import { z } from 'zod';
import { baseMessageShape } from './shared.js';

export const textMessageSchema = z.object({
  ...baseMessageShape,
  text: z.string().min(1).max(65536),
}).strict();