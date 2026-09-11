const responseRefs = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  429: { $ref: '#/components/responses/RateLimited' },
};

export const sessionLimitResponse = {
  description: 'Maximum active session limit reached',
  content: {
    'application/json': {
      example: {
        success: false,
        error: 'Maximum of 5 active sessions reached for this API key. Please log out or wait for an existing session to expire before creating a new one.',
      },
    },
  },
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

export const sessionOperation = (summary, options = {}) => {
  const {
    successStatus = 200, successExample, successSchema, responses = {}, ...operation
  } = options;
  const successContent = {
    example: successExample ?? { sessionId: '42-V1StGXR8', status: 'connected', qr: null },
  };
  if (successSchema) {
    successContent.schema = { $ref: `#/components/schemas/${successSchema}` };
  }
  return {
    tags: ['Sessions'],
    summary,
    ...operation,
    responses: {
      [successStatus]: { description: 'Session operation completed', content: { 'application/json': successContent } },
      ...responseRefs,
      ...responses,
    },
  };
};

export const broadcastOperation = (summary, options = {}) => {
  const { successStatus = 200, successExample, ...operation } = options;
  return {
    tags: ['Broadcasts'],
    summary,
    ...operation,
    responses: {
      [successStatus]: { description: 'Broadcast operation completed', content: { 'application/json': { example: successExample ?? { success: true, data: { total: 2, sent: 2, failed: 0, pending: 0 }, error: null } } } },
      ...responseRefs,
    },
  };
};

export { jsonBody };