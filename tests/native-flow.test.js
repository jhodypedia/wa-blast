import assert from 'node:assert/strict';
import test from 'node:test';
import { swaggerSpec } from '../config/swagger.js';
import { postButtonMessage } from '../controllers/message.controller.js';
import { buttonMessageSchema } from '../middlewares/validators/button.validator.js';
import { imageButtonMessageSchema } from '../middlewares/validators/image-button.validator.js';
import { validateBroadcastContent } from '../services/broadcastService.js';
import {
  mapNativeFlowButtons,
  sendButtons,
  sendImageButtons,
} from '../services/whatsappService.js';

const variants = [
  [{ type: 'quick_reply', displayText: 'Yes', id: 'yes' }, { display_text: 'Yes', id: 'yes' }],
  [{ type: 'cta_url', displayText: 'Visit', url: 'https://example.com' }, {
    display_text: 'Visit', url: 'https://example.com', merchant_url: 'https://example.com',
  }],
  [{ type: 'cta_call', displayText: 'Call', phoneNumber: '+6281234567890' }, {
    display_text: 'Call', phone_number: '+6281234567890',
  }],
  [{ type: 'cta_copy', displayText: 'Copy', copyText: 'PANSA2026' }, {
    display_text: 'Copy', copy_code: 'PANSA2026',
  }],
  [{ type: 'cta_reminder', displayText: 'Remind', id: 'reminder' }, {
    display_text: 'Remind', id: 'reminder',
  }],
  [{ type: 'cta_cancel_reminder', displayText: 'Cancel', id: 'reminder' }, {
    display_text: 'Cancel', id: 'reminder',
  }],
  [{
    type: 'single_select',
    title: 'Choose',
    sections: [{
      title: 'Options',
      highlightLabel: 'Popular',
      rows: [{ header: 'Best', title: 'One', description: 'First', id: 'one' }],
    }],
  }, {
    title: 'Choose',
    sections: [{
      title: 'Options',
      highlight_label: 'Popular',
      rows: [{ header: 'Best', title: 'One', description: 'First', id: 'one' }],
    }],
  }],
  [{ type: 'address_message', displayText: 'Address', id: 'delivery' }, {
    display_text: 'Address', id: 'delivery',
  }],
  [{ type: 'send_location' }, {}],
];

const basePayload = { sessionId: 'sales', to: '6281234567890' };

test('maps every typed button to its exact native-flow payload', () => {
  for (const [button, params] of variants) {
    const [{ name, buttonParamsJson }] = mapNativeFlowButtons([button]);
    assert.equal(name, button.type);
    assert.deepEqual(JSON.parse(buttonParamsJson), params);
  }
});

test('validates button limits and reports the failing array index', () => {
  const quickReplies = Array.from({ length: 10 }, (_, index) => ({
    type: 'quick_reply', displayText: `Reply ${index}`, id: `reply-${index}`,
  }));
  assert.equal(buttonMessageSchema.safeParse({
    ...basePayload, text: 'Choose', buttons: quickReplies,
  }).success, true);

  const actions = Array.from({ length: 4 }, (_, index) => ({
    type: 'cta_copy', displayText: `Copy ${index}`, copyText: `code-${index}`,
  }));
  const limited = buttonMessageSchema.safeParse({
    ...basePayload, text: 'Choose', buttons: actions,
  });
  assert.equal(limited.success, false);
  assert.deepEqual(limited.error.issues[0].path, ['buttons', 3]);

  const mixed = buttonMessageSchema.safeParse({
    ...basePayload,
    text: 'Choose',
    buttons: [quickReplies[0], variants[1][0]],
  });
  assert.equal(mixed.success, false);
  assert.deepEqual(mixed.error.issues[0].path, ['buttons', 1, 'type']);
  assert.match(mixed.error.issues[0].message, /index 1/);
});

test('controller returns an indexed 400 validation response', async () => {
  const response = {
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };

  await postButtonMessage({
    apiKey: { id: 1 },
    body: {
      ...basePayload,
      text: 'Choose',
      buttons: [variants[0][0], variants[1][0]],
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error.message, 'Invalid message payload');
  assert.deepEqual(response.payload.error.details[0].path, ['buttons', 1, 'type']);
});

test('sends text and image controls under nativeFlow', async () => {
  const calls = [];
  const socket = {
    sendMessage: async (jid, content) => {
      calls.push({ jid, content });
      return { key: { id: `message-${calls.length}` } };
    },
  };
  const buttons = [variants[1][0]];

  assert.equal((await sendButtons(socket, basePayload.to, 'Choose', buttons)).success, true);
  assert.equal((await sendImageButtons(
    socket, basePayload.to, { url: 'https://example.com/image.jpg' }, 'Choose', buttons,
  )).success, true);
  assert.equal(calls[0].content.nativeFlow[0].name, 'cta_url');
  assert.equal(calls[1].content.nativeFlow[0].name, 'cta_url');
  assert.equal('buttons' in calls[0].content, false);
  assert.equal('buttons' in calls[1].content, false);
});

test('button broadcasts use the typed validator', () => {
  assert.doesNotThrow(() => validateBroadcastContent({
    sessionId: 'sales',
    type: 'button',
    targets: [basePayload.to],
    message: 'Choose',
    variables: {},
    delay: { min: 0, max: 0 },
    mediaPayload: { buttons: [variants[3][0]] },
  }));
});

test('OpenAPI exposes the discriminated union and examples', () => {
  const { schemas } = swaggerSpec.components;
  const buttons = schemas.ButtonMessage.properties.buttons;
  assert.equal(buttons.items.oneOf.length, 9);
  assert.equal(buttons.items.discriminator.propertyName, 'type');
  assert.equal(schemas.UrlButton.properties.type.enum[0], 'cta_url');
  assert.equal(schemas.SingleSelectRow.properties.id.maxLength, 256);

  const requestContent = swaggerSpec.paths['/message/button']
    .post.requestBody.content['application/json'];
  assert.equal(requestContent.schema.$ref, '#/components/schemas/ButtonMessage');
  assert.equal(requestContent.examples.singleSelect.value.buttons[0].type, 'single_select');

  const imageExample = swaggerSpec.paths['/message/image-button']
    .post.requestBody.content['application/json'].examples.quickReplies.value;
  assert.equal(Object.hasOwn(imageExample, 'text'), false);
  assert.equal(imageButtonMessageSchema.safeParse(imageExample).success, true);
});