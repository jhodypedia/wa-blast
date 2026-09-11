import { z } from 'zod';

export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const targetSchema = z.string().trim().min(1).max(128);
export const mediaUrlSchema = z.url().transform((url) => ({ url }));

export const baseMessageShape = {
  sessionId: sessionIdSchema,
  to: targetSchema,
};

export const buttonSchema = z.object({
  id: z.string().min(1).max(256),
  text: z.string().min(1).max(20),
}).strict();