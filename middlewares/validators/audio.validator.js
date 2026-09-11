import { z } from 'zod';
import { baseMessageShape, mediaUrlSchema } from './shared.js';

export const audioMessageSchema = z.object({
  ...baseMessageShape,
  audio: mediaUrlSchema,
  mimetype: z.string().min(1).default('audio/mpeg'),
}).strict();