import { z } from 'zod';
import { baseMessageShape } from './shared.js';

const rowSchema = z.object({
  title: z.string().min(1).max(24),
  description: z.string().max(72).optional(),
  rowId: z.string().min(1).max(200),
}).strict();

const sectionSchema = z.object({
  title: z.string().max(24).optional(),
  rows: z.array(rowSchema).min(1).max(10),
}).strict();

export const listMessageSchema = z.object({
  ...baseMessageShape,
  text: z.string().min(1).max(1024),
  title: z.string().max(60).optional(),
  footer: z.string().max(60).optional(),
  buttonText: z.string().min(1).max(20),
  sections: z.array(sectionSchema).min(1).max(10),
}).strict();