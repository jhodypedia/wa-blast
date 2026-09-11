import { z } from 'zod';
import { baseMessageShape, buttonSchema } from './shared.js';

export const buttonMessageSchema = z.object({
  ...baseMessageShape,
  text: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: z.array(buttonSchema).min(1).max(10),
}).strict();