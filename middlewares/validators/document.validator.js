import { z } from 'zod';
import { baseMessageShape, mediaUrlSchema } from './shared.js';

export const documentMessageSchema = z.object({
  ...baseMessageShape,
  document: mediaUrlSchema,
  mimetype: z.string().min(1),
  fileName: z.string().min(1).max(255),
  caption: z.string().max(1024).optional(),
}).strict();