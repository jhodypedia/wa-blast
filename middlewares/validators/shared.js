import { z } from 'zod';

export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const targetSchema = z.string().trim().min(1).max(128);
export const mediaUrlSchema = z.url().transform((url) => ({ url }));

export const baseMessageShape = {
  sessionId: sessionIdSchema,
  to: targetSchema,
};

const displayTextSchema = z.string().trim().min(1).max(20);
const buttonIdSchema = z.string().trim().min(1).max(256);

const quickReplyButtonSchema = z.object({
  type: z.literal('quick_reply'),
  displayText: displayTextSchema,
  id: z.string().min(1).max(256),
}).strict();

const urlButtonSchema = z.object({
  type: z.literal('cta_url'),
  displayText: displayTextSchema,
  url: z.url(),
}).strict();

const callButtonSchema = z.object({
  type: z.literal('cta_call'),
  displayText: displayTextSchema,
  phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/),
}).strict();

const copyButtonSchema = z.object({
  type: z.literal('cta_copy'),
  displayText: displayTextSchema,
  copyText: z.string().min(1).max(1024),
}).strict();

const actionIdButtonSchema = (type) => z.object({
  type: z.literal(type),
  displayText: displayTextSchema,
  id: buttonIdSchema,
}).strict();

const selectRowSchema = z.object({
  header: z.string().max(24).optional(),
  title: z.string().trim().min(1).max(24),
  description: z.string().max(72).optional(),
  id: buttonIdSchema,
}).strict();

const selectSectionSchema = z.object({
  title: z.string().trim().min(1).max(24),
  highlightLabel: z.string().max(24).optional(),
  rows: z.array(selectRowSchema).min(1).max(10),
}).strict();

const singleSelectButtonSchema = z.object({
  type: z.literal('single_select'),
  title: z.string().trim().min(1).max(20),
  sections: z.array(selectSectionSchema).min(1).max(10),
}).strict();

const sendLocationButtonSchema = z.object({
  type: z.literal('send_location'),
}).strict();

export const buttonSchema = z.discriminatedUnion('type', [
  quickReplyButtonSchema,
  urlButtonSchema,
  callButtonSchema,
  copyButtonSchema,
  actionIdButtonSchema('cta_reminder'),
  actionIdButtonSchema('cta_cancel_reminder'),
  singleSelectButtonSchema,
  actionIdButtonSchema('address_message'),
  sendLocationButtonSchema,
]);

export const buttonsSchema = z.array(buttonSchema).min(1).max(10).superRefine((buttons, context) => {
  const firstIsQuickReply = buttons[0]?.type === 'quick_reply';
  const limit = firstIsQuickReply ? 10 : 3;

  if (buttons.length > limit) {
    context.addIssue({
      code: 'custom',
      path: [limit],
      message: `Button at index ${limit} exceeds the ${limit}-button limit for this native-flow message`,
    });
  }

  buttons.forEach((button, index) => {
    if ((button.type === 'quick_reply') !== firstIsQuickReply) {
      context.addIssue({
        code: 'custom',
        path: [index, 'type'],
        message: `Button at index ${index} cannot mix quick_reply with other native-flow types`,
      });
    }
  });
});