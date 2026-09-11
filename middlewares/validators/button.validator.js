import { z } from 'zod';
import { baseMessageShape, buttonsSchema } from './shared.js';

export const buttonMessageSchema = z.object({
  ...baseMessageShape,
  text: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: buttonsSchema,
}).strict();