import { z } from 'zod';
import { baseMessageShape, mediaUrlSchema } from './shared.js';

export const videoMessageSchema = z.object({
  ...baseMessageShape,
  video: mediaUrlSchema,
  caption: z.string().max(1024).optional(),
  mimetype: z.string().min(1).optional(),
}).strict();