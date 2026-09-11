import { z } from 'zod';
import { baseMessageShape, mediaUrlSchema } from './shared.js';

export const stickerMessageSchema = z.object({
  ...baseMessageShape,
  sticker: mediaUrlSchema,
}).strict();