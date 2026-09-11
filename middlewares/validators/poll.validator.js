import { z } from 'zod';
import { baseMessageShape } from './shared.js';

export const pollMessageSchema = z.object({
  ...baseMessageShape,
  name: z.string().min(1).max(255),
  values: z.array(z.string().min(1).max(100)).min(2).max(12),
  selectableCount: z.number().int().min(1).default(1),
}).strict().refine(
  ({ selectableCount, values }) => selectableCount <= values.length,
  { path: ['selectableCount'], message: 'selectableCount cannot exceed the number of values' },
);