import { z } from 'zod';
import { baseMessageShape, buttonSchema, mediaUrlSchema } from './shared.js';

export const imageButtonMessageSchema = z.object({
  ...baseMessageShape,
  image: mediaUrlSchema,
  caption: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: z.array(buttonSchema).min(1).max(10),
}).strict();