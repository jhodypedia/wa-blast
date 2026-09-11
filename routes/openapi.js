const responseRefs = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  429: { $ref: '#/components/responses/RateLimited' },
};

const jsonBody = (schema) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
});

const messageResponses = {
  200: {
    description: 'Message sent',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageSuccess' }, example: { success: true, data: { messageId: '3EB0ABC123' }, error: null } } },
  },
  ...responseRefs,
};

export const messageOperation = (summary, schema) => ({
  tags: ['Messages'],
  summary,
  requestBody: jsonBody(schema),
  responses: messageResponses,
});

export const sessionOperation = (summary, options = {}) => ({
  tags: ['Sessions'],
  summary,
  ...options,
  responses: {
    [options.successStatus ?? 200]: { description: 'Session operation completed', content: { 'application/json': { example: options.successExample ?? { sessionId: 'sales', status: 'connected', qr: null } } } },
    ...responseRefs,
  },
});

export const broadcastOperation = (summary, options = {}) => ({
  tags: ['Broadcasts'],
  summary,
  ...options,
  responses: {
    [options.successStatus ?? 200]: { description: 'Broadcast operation completed', content: { 'application/json': { example: options.successExample ?? { success: true, data: { total: 2, sent: 2, failed: 0, pending: 0 }, error: null } } } },
    ...responseRefs,
  },
});

export { jsonBody };