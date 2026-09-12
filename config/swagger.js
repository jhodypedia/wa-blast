import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';
import { openapiOperations as broadcastOperations } from '../routes/broadcast.routes.js';
import { openapiOperations as messageOperations } from '../routes/message.routes.js';
import { openapiOperations as sessionOperations } from '../routes/session.routes.js';

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

const sessionId = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$', example: '42-V1StGXR8' };
const sessionLabel = { type: 'string', minLength: 1, maxLength: 100, example: 'Store support' };
const target = { type: 'string', maxLength: 128, example: '15551234567' };
const mediaUrl = { type: 'string', format: 'uri', example: 'https://example.com/media.jpg' };
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
const buttonType = (type) => ({ type: 'string', enum: [type], example: type });
const displayText = { type: 'string', minLength: 1, maxLength: 20 };
const buttonId = { type: 'string', minLength: 1, maxLength: 256 };
const nativeFlowButton = {
  oneOf: [
    'QuickReplyButton',
    'UrlButton',
    'CallButton',
    'CopyButton',
    'ReminderButton',
    'CancelReminderButton',
    'SingleSelectButton',
    'AddressButton',
    'SendLocationButton',
  ].map((name) => ({ $ref: `#/components/schemas/${name}` })),
  discriminator: {
    propertyName: 'type',
    mapping: {
      quick_reply: '#/components/schemas/QuickReplyButton',
      cta_url: '#/components/schemas/UrlButton',
      cta_call: '#/components/schemas/CallButton',
      cta_copy: '#/components/schemas/CopyButton',
      cta_reminder: '#/components/schemas/ReminderButton',
      cta_cancel_reminder: '#/components/schemas/CancelReminderButton',
      single_select: '#/components/schemas/SingleSelectButton',
      address_message: '#/components/schemas/AddressButton',
      send_location: '#/components/schemas/SendLocationButton',
    },
  },
};
const nativeFlowButtons = {
  type: 'array',
  minItems: 1,
  maxItems: 10,
  description: [
    'Quick replies support 1-10 items. Other native-flow controls support 1-3 items.',
    'Quick replies cannot be mixed with other control types.',
    '`cta_reminder`, `cta_cancel_reminder`, `single_select`, `address_message`, and `send_location` render on Android only.',
  ].join(' '),
  items: nativeFlowButton,
};
const buttonRequestExamples = {
  quickReplies: {
    summary: 'Quick replies (all clients)',
    value: {
      sessionId: 'sales',
      to: '15551234567',
      text: 'Confirm your order',
      buttons: [
        { type: 'quick_reply', displayText: 'Confirm', id: 'confirm' },
        { type: 'quick_reply', displayText: 'Cancel', id: 'cancel' },
      ],
    },
  },
  actions: {
    summary: 'URL, call, and copy actions (all clients)',
    value: {
      sessionId: 'sales',
      to: '15551234567',
      text: 'Contact Pansa Store',
      buttons: [
        { type: 'cta_url', displayText: 'Open Store', url: 'https://example.com/store' },
        { type: 'cta_call', displayText: 'Call Us', phoneNumber: '+15551234567' },
        { type: 'cta_copy', displayText: 'Copy Code', copyText: 'PANSA2026' },
      ],
    },
  },
  singleSelect: {
    summary: 'Single-select list (Android only)',
    value: {
      sessionId: 'sales',
      to: '15551234567',
      text: 'Choose shipping',
      buttons: [{
        type: 'single_select',
        title: 'Choose Shipping',
        sections: [{
          title: 'Shipping',
          rows: [
            { title: 'Standard', description: 'Delivery in 3-5 days', id: 'shipping-standard' },
            { title: 'Express', description: 'Delivery tomorrow', id: 'shipping-express' },
          ],
        }],
      }],
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'PansaGroup — WhatsApp Gateway API',
      version: '1.0.0',
      description: [
        'A multi-tenant API for managing WhatsApp sessions and sending direct or broadcast messages.',
        '',
        '**Created by PansaGroup** · Contact: [@pansagr](https://t.me/pansagr)',
      ].join('\n'),
      contact: {
        name: 'PansaGroup',
        url: 'https://t.me/pansagr',
      },
    },
    externalDocs: {
      description: 'Contact PansaGroup on Telegram',
      url: 'https://t.me/pansagr',
    },
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'PansaGroup API key, for example `ps-7f3a9c2e1b8d4f60a5c3e9b21d84f6a0c7e3b5f912d84a6c`. New keys use lowercase cryptographic hex; legacy keys remain supported.',
        },
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
        SessionId: sessionId,
        SessionStart: objectSchema([], { label: sessionLabel }),
        PairingStart: objectSchema(['phoneNumber'], {
          label: sessionLabel,
          phoneNumber: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', example: '+15551234567' },
        }),
        SessionListItem: objectSchema(['id', 'label', 'connection_method', 'status', 'created_at'], {
          id: sessionId,
          label: { ...sessionLabel, nullable: true },
          connection_method: { type: 'string', enum: ['qr', 'pairing_code'], example: 'qr' },
          status: {
            type: 'string',
            enum: ['qr_pending', 'pairing_pending', 'connected', 'reconnecting', 'disconnected', 'logged_out', 'expired', 'terminated'],
            example: 'connected',
          },
          created_at: { type: 'string', format: 'date-time', example: '2026-04-01T12:00:00.000Z' },
        }),
        SessionStatusResponse: objectSchema([
          'sessionId', 'status', 'connection_method', 'qr', 'lastDisconnectReason', 'reconnectAttempts', 'updatedAt',
        ], {
          sessionId,
          status: {
            type: 'string',
            enum: ['qr_pending', 'pairing_pending', 'connected', 'reconnecting', 'disconnected', 'logged_out', 'expired', 'terminated'],
            description: 'disconnected indicates retry attempts were exhausted; terminated indicates a permanent disconnect such as connectionReplaced.',
            example: 'connected',
          },
          connection_method: { type: 'string', enum: ['qr', 'pairing_code'], example: 'pairing_code' },
          qr: { type: 'string', nullable: true, example: null },
          lastDisconnectReason: { type: 'string', nullable: true, example: 'connectionLost/timedOut' },
          reconnectAttempts: { type: 'integer', minimum: 0, maximum: 10, example: 2 },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-04-01T12:00:00.000Z' },
        }),
        SessionListResponse: objectSchema(['sessions', 'activeCount', 'maxAllowed'], {
          sessions: { type: 'array', items: { $ref: '#/components/schemas/SessionListItem' } },
          activeCount: { type: 'integer', minimum: 0, maximum: 5, example: 3 },
          maxAllowed: { type: 'integer', enum: [5], example: 5 },
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
        QuickReplyButton: objectSchema(['type', 'displayText', 'id'], {
          type: buttonType('quick_reply'),
          displayText: { ...displayText, example: 'Confirm' },
          id: { ...buttonId, example: 'confirm' },
        }),
        UrlButton: objectSchema(['type', 'displayText', 'url'], {
          type: buttonType('cta_url'),
          displayText: { ...displayText, example: 'Open Store' },
          url: { type: 'string', format: 'uri', example: 'https://example.com/store' },
        }),
        CallButton: objectSchema(['type', 'displayText', 'phoneNumber'], {
          type: buttonType('cta_call'),
          displayText: { ...displayText, example: 'Call Us' },
          phoneNumber: { type: 'string', pattern: '^\\+?[1-9]\\d{7,14}$', example: '+15551234567' },
        }),
        CopyButton: objectSchema(['type', 'displayText', 'copyText'], {
          type: buttonType('cta_copy'),
          displayText: { ...displayText, example: 'Copy Code' },
          copyText: { type: 'string', minLength: 1, maxLength: 1024, example: 'PANSA2026' },
        }),
        ReminderButton: objectSchema(['type', 'displayText', 'id'], {
          type: buttonType('cta_reminder'),
          displayText: { ...displayText, example: 'Remind Me' },
          id: { ...buttonId, example: 'order-reminder' },
        }),
        CancelReminderButton: objectSchema(['type', 'displayText', 'id'], {
          type: buttonType('cta_cancel_reminder'),
          displayText: { ...displayText, example: 'Cancel Reminder' },
          id: { ...buttonId, example: 'order-reminder' },
        }),
        SingleSelectRow: objectSchema(['title', 'id'], {
          header: { type: 'string', maxLength: 24, example: 'Popular' },
          title: { type: 'string', minLength: 1, maxLength: 24, example: 'Standard' },
          description: { type: 'string', maxLength: 72, example: 'Delivery in 3-5 days' },
          id: { ...buttonId, example: 'shipping-standard' },
        }),
        SingleSelectSection: objectSchema(['title', 'rows'], {
          title: { type: 'string', minLength: 1, maxLength: 24, example: 'Shipping' },
          highlightLabel: { type: 'string', maxLength: 24, example: 'Recommended' },
          rows: {
            type: 'array', minItems: 1, maxItems: 10, items: { $ref: '#/components/schemas/SingleSelectRow' },
          },
        }),
        SingleSelectButton: objectSchema(['type', 'title', 'sections'], {
          type: buttonType('single_select'),
          title: { type: 'string', minLength: 1, maxLength: 20, example: 'Choose Shipping' },
          sections: {
            type: 'array', minItems: 1, maxItems: 10, items: { $ref: '#/components/schemas/SingleSelectSection' },
          },
        }),
        AddressButton: objectSchema(['type', 'displayText', 'id'], {
          type: buttonType('address_message'),
          displayText: { ...displayText, example: 'Send Address' },
          id: { ...buttonId, example: 'delivery-address' },
        }),
        SendLocationButton: objectSchema(['type'], {
          type: buttonType('send_location'),
        }),
        NativeFlowButton: nativeFlowButton,
        ButtonMessage: objectSchema(['sessionId', 'to', 'text', 'buttons'], {
          ...baseMessage,
          text: { type: 'string', minLength: 1, maxLength: 1024, example: 'Choose an option' },
          footer: { type: 'string', maxLength: 60 },
          buttons: nativeFlowButtons,
        }),
        ImageButtonMessage: objectSchema(['sessionId', 'to', 'image', 'caption', 'buttons'], {
          ...baseMessage,
          image: mediaUrl,
          caption: { type: 'string', minLength: 1, maxLength: 1024 },
          footer: { type: 'string', maxLength: 60 },
          buttons: nativeFlowButtons,
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

const operations = {
  ...sessionOperations,
  ...messageOperations,
  ...broadcastOperations,
};

for (const pathItem of Object.values(swaggerSpec.paths)) {
  for (const operation of Object.values(pathItem)) {
    const metadata = operations[operation['x-operation']];
    if (metadata) {
      Object.assign(operation, metadata);
      delete operation['x-operation'];
    }
  }
}

swaggerSpec.paths['/message/button'].post.requestBody.content['application/json'].examples = buttonRequestExamples;
swaggerSpec.paths['/message/image-button'].post.requestBody.content['application/json'].examples = {
  quickReplies: {
    summary: 'Image with quick replies (all clients)',
    value: {
      sessionId: buttonRequestExamples.quickReplies.value.sessionId,
      to: buttonRequestExamples.quickReplies.value.to,
      image: 'https://example.com/product.jpg',
      caption: 'Confirm this product',
      buttons: buttonRequestExamples.quickReplies.value.buttons,
    },
  },
  actions: {
    summary: 'Image with URL, call, and copy actions (all clients)',
    value: {
      sessionId: buttonRequestExamples.actions.value.sessionId,
      to: buttonRequestExamples.actions.value.to,
      image: 'https://example.com/product.jpg',
      caption: 'Pansa Store product',
      buttons: buttonRequestExamples.actions.value.buttons,
    },
  },
};