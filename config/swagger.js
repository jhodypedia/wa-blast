import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const errorResponse = (description, status, message) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
      example: { success: false, data: null, error: { message }, status },
    },
  },
});

const commonResponses = {
  400: errorResponse('Invalid request', 400, 'Invalid request payload'),
  401: errorResponse('Missing, invalid, or inactive API key', 401, 'A valid x-api-key header is required'),
  403: errorResponse('The session belongs to another API key', 403, 'Session belongs to a different API key'),
  429: errorResponse('API key rate limit exceeded', 429, 'API key rate limit exceeded'),
};

const sessionId = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$', example: 'sales' };
const target = { type: 'string', maxLength: 128, example: '15551234567' };
const mediaUrl = { type: 'string', format: 'uri', example: 'https://example.com/media.jpg' };
const button = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'text'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 256, example: 'confirm' },
    text: { type: 'string', minLength: 1, maxLength: 20, example: 'Confirm' },
  },
};
const baseMessage = {
  sessionId,
  to: target,
};
const objectSchema = (required, properties) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WhatsApp Gateway API',
      version: '1.0.0',
      description: 'Multi-tenant API for managing WhatsApp sessions and sending direct or broadcast messages.',
    },
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      },
      responses: {
        BadRequest: commonResponses[400],
        Unauthorized: commonResponses[401],
        Forbidden: commonResponses[403],
        RateLimited: commonResponses[429],
      },
      schemas: {
        ErrorResponse: objectSchema(['success', 'data', 'error'], {
          success: { type: 'boolean', example: false },
          data: { nullable: true, example: null },
          error: objectSchema(['message'], {
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'object', additionalProperties: true } },
          }),
          status: { type: 'integer' },
        }),
        MessageSuccess: objectSchema(['success', 'data', 'error'], {
          success: { type: 'boolean', example: true },
          data: objectSchema(['messageId'], {
            messageId: { type: 'string', nullable: true, example: '3EB0ABC123' },
          }),
          error: { nullable: true, example: null },
        }),
        SessionStart: objectSchema(['sessionId'], { sessionId }),
        PairingStart: objectSchema(['sessionId', 'phoneNumber'], {
          sessionId,
          phoneNumber: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', example: '+15551234567' },
        }),
        TextMessage: objectSchema(['sessionId', 'to', 'text'], {
          ...baseMessage,
          text: { type: 'string', minLength: 1, maxLength: 65536, example: 'Hello from Swagger UI' },
        }),
        ImageMessage: objectSchema(['sessionId', 'to', 'image'], {
          ...baseMessage,
          image: mediaUrl,
          caption: { type: 'string', maxLength: 1024 },
          mimetype: { type: 'string', minLength: 1, example: 'image/jpeg' },
        }),
        VideoMessage: objectSchema(['sessionId', 'to', 'video'], {
          ...baseMessage,
          video: { ...mediaUrl, example: 'https://example.com/video.mp4' },
          caption: { type: 'string', maxLength: 1024 },
          mimetype: { type: 'string', minLength: 1, example: 'video/mp4' },
        }),
        DocumentMessage: objectSchema(['sessionId', 'to', 'document', 'mimetype', 'fileName'], {
          ...baseMessage,
          document: { ...mediaUrl, example: 'https://example.com/report.pdf' },
          mimetype: { type: 'string', minLength: 1, example: 'application/pdf' },
          fileName: { type: 'string', minLength: 1, maxLength: 255, example: 'report.pdf' },
          caption: { type: 'string', maxLength: 1024 },
        }),
        AudioMessage: objectSchema(['sessionId', 'to', 'audio'], {
          ...baseMessage,
          audio: { ...mediaUrl, example: 'https://example.com/audio.mp3' },
          mimetype: { type: 'string', default: 'audio/mpeg' },
        }),
        StickerMessage: objectSchema(['sessionId', 'to', 'sticker'], {
          ...baseMessage,
          sticker: { ...mediaUrl, example: 'https://example.com/sticker.webp' },
        }),
        LocationMessage: objectSchema(['sessionId', 'to', 'latitude', 'longitude'], {
          ...baseMessage,
          latitude: { type: 'number', minimum: -90, maximum: 90, example: 40.7128 },
          longitude: { type: 'number', minimum: -180, maximum: 180, example: -74.006 },
          name: { type: 'string', minLength: 1, maxLength: 255 },
          address: { type: 'string', minLength: 1, maxLength: 500 },
          url: { type: 'string', format: 'uri' },
        }),
        ContactMessage: objectSchema(['sessionId', 'to', 'displayName', 'vcard'], {
          ...baseMessage,
          displayName: { type: 'string', minLength: 1, maxLength: 255, example: 'Jane Doe' },
          vcard: { type: 'string', minLength: 1, example: 'BEGIN:VCARD\\nVERSION:3.0\\nFN:Jane Doe\\nEND:VCARD' },
        }),
        ButtonMessage: objectSchema(['sessionId', 'to', 'text', 'buttons'], {
          ...baseMessage,
          text: { type: 'string', minLength: 1, maxLength: 1024, example: 'Choose an option' },
          footer: { type: 'string', maxLength: 60 },
          buttons: { type: 'array', minItems: 1, maxItems: 10, items: button },
        }),
        ImageButtonMessage: objectSchema(['sessionId', 'to', 'image', 'caption', 'buttons'], {
          ...baseMessage,
          image: mediaUrl,
          caption: { type: 'string', minLength: 1, maxLength: 1024 },
          footer: { type: 'string', maxLength: 60 },
          buttons: { type: 'array', minItems: 1, maxItems: 10, items: button },
        }),
        ListMessage: objectSchema(['sessionId', 'to', 'text', 'buttonText', 'sections'], {
          ...baseMessage,
          text: { type: 'string', minLength: 1, maxLength: 1024 },
          title: { type: 'string', maxLength: 60 },
          footer: { type: 'string', maxLength: 60 },
          buttonText: { type: 'string', minLength: 1, maxLength: 20, example: 'Open list' },
          sections: {
            type: 'array', minItems: 1, maxItems: 10, items: objectSchema(['rows'], {
              title: { type: 'string', maxLength: 24 },
              rows: {
                type: 'array', minItems: 1, maxItems: 10, items: objectSchema(['title', 'rowId'], {
                  title: { type: 'string', minLength: 1, maxLength: 24 },
                  description: { type: 'string', maxLength: 72 },
                  rowId: { type: 'string', minLength: 1, maxLength: 200 },
                }),
              },
            }),
          },
        }),
        PollMessage: objectSchema(['sessionId', 'to', 'name', 'values'], {
          ...baseMessage,
          name: { type: 'string', minLength: 1, maxLength: 255, example: 'Preferred time?' },
          values: { type: 'array', minItems: 2, maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 100 }, example: ['Morning', 'Evening'] },
          selectableCount: { type: 'integer', minimum: 1, default: 1 },
        }),
        BroadcastMessage: objectSchema(['sessionId', 'type', 'targets'], {
          sessionId,
          type: { type: 'string', enum: ['text', 'image', 'video', 'document', 'audio', 'sticker', 'location', 'contact', 'button', 'image-button', 'list', 'poll'] },
          targets: { type: 'array', minItems: 1, maxItems: 1000, uniqueItems: true, items: target },
          message: { type: 'string', maxLength: 65536, default: '', example: 'Hello {{name}}' },
          variables: { type: 'object', additionalProperties: { type: 'object', additionalProperties: true }, example: { '15551234567': { name: 'Jane' } } },
          delay: objectSchema(['min', 'max'], {
            min: { type: 'integer', minimum: 0, maximum: 3600000, default: 2000 },
            max: { type: 'integer', minimum: 0, maximum: 3600000, default: 5000 },
          }),
          mediaPayload: { type: 'object', additionalProperties: true },
        }),
      },
    },
  },
  apis: [path.join(root, 'routes', '*.js').replace(/\\/g, '/')],
});

const operationModules = await Promise.all([
  import('../routes/session.routes.js'),
  import('../routes/message.routes.js'),
  import('../routes/broadcast.routes.js'),
]);
const operations = Object.assign({}, ...operationModules.map(({ openapiOperations }) => openapiOperations));

for (const pathItem of Object.values(swaggerSpec.paths)) {
  for (const operation of Object.values(pathItem)) {
    const metadata = operations[operation['x-operation']];
    if (metadata) {
      Object.assign(operation, metadata);
      delete operation['x-operation'];
    }
  }
}