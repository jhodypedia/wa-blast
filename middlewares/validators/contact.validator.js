import { z } from 'zod';
import { baseMessageShape } from './shared.js';

export const contactMessageSchema = z.object({
  ...baseMessageShape,
  displayName: z.string().min(1).max(255),
  vcard: z.string().min(1),
}).strict();