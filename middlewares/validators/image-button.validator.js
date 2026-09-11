import { z } from 'zod';
import { baseMessageShape, buttonsSchema, mediaUrlSchema } from './shared.js';

export const imageButtonMessageSchema = z.object({
  ...baseMessageShape,
  image: mediaUrlSchema,
  caption: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: buttonsSchema,
}).strict();