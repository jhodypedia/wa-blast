import { z } from 'zod';
import { audioMessageSchema } from '../middlewares/validators/audio.validator.js';
import { buttonMessageSchema } from '../middlewares/validators/button.validator.js';
import { contactMessageSchema } from '../middlewares/validators/contact.validator.js';
import { documentMessageSchema } from '../middlewares/validators/document.validator.js';
import { imageButtonMessageSchema } from '../middlewares/validators/image-button.validator.js';
import { imageMessageSchema } from '../middlewares/validators/image.validator.js';
import { listMessageSchema } from '../middlewares/validators/list.validator.js';
import { locationMessageSchema } from '../middlewares/validators/location.validator.js';
import { pollMessageSchema } from '../middlewares/validators/poll.validator.js';
import { stickerMessageSchema } from '../middlewares/validators/sticker.validator.js';
import { textMessageSchema } from '../middlewares/validators/text.validator.js';
import { videoMessageSchema } from '../middlewares/validators/video.validator.js';
import { getSession, SessionOwnershipError } from '../services/sessionManager.js';
import {
  sendAudio,
  sendButtons,
  sendContact,
  sendDocument,
  sendImage,
  sendImageButtons,
  sendList,
  sendLocation,
  sendPoll,
  sendSticker,
  sendText,
  sendVideo,
} from '../services/whatsappService.js';

function success(response, result) {
  return response.json({
    success: true,
    data: { messageId: result.messageId ?? null },
    error: null,
  });
}

function failure(response, status, message, details) {
  return response.status(status).json({
    success: false,
    data: null,
    error: details ? { message, details } : { message },
  });
}

function createMessageHandler(schema, sendMessage) {
  return async function messageHandler(request, response) {
    try {
      const payload = schema.parse(request.body);
      const socket = await getSession(payload.sessionId, request.apiKey.id);
      if (!socket) {
        return failure(response, 404, 'Session is not active');
      }

      const result = await sendMessage(socket, payload);
      if (!result.success) {
        const status = result.code === 'WHATSAPP_OPERATION_TIMEOUT' ? 504 : 502;
        return failure(response, status, status === 504
          ? 'WhatsApp operation timed out'
          : 'WhatsApp rejected the message operation');
      }
      return success(response, result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return failure(response, 400, 'Invalid message payload', error.issues);
      }
      if (error instanceof SessionOwnershipError) {
        return failure(response, 403, error.message);
      }
      return failure(response, 500, 'Message operation failed');
    }
  };
}

export const postTextMessage = createMessageHandler(
  textMessageSchema,
  (socket, { to, text }) => sendText(socket, to, text),
);

export const postImageMessage = createMessageHandler(
  imageMessageSchema,
  (socket, { to, image, caption, mimetype }) => sendImage(
    socket,
    to,
    image,
    { caption, mimetype },
  ),
);

export const postVideoMessage = createMessageHandler(
  videoMessageSchema,
  (socket, { to, video, caption, mimetype }) => sendVideo(
    socket,
    to,
    video,
    { caption, mimetype },
  ),
);

export const postDocumentMessage = createMessageHandler(
  documentMessageSchema,
  (socket, { to, document, mimetype, fileName, caption }) => sendDocument(
    socket,
    to,
    document,
    { mimetype, fileName, caption },
  ),
);

export const postAudioMessage = createMessageHandler(
  audioMessageSchema,
  (socket, { to, audio, mimetype }) => sendAudio(socket, to, audio, { mimetype }),
);

export const postStickerMessage = createMessageHandler(
  stickerMessageSchema,
  (socket, { to, sticker }) => sendSticker(socket, to, sticker),
);

export const postLocationMessage = createMessageHandler(
  locationMessageSchema,
  (socket, { to, latitude, longitude, name, address, url }) => sendLocation(socket, to, {
    degreesLatitude: latitude,
    degreesLongitude: longitude,
    name,
    address,
    url,
  }),
);

export const postContactMessage = createMessageHandler(
  contactMessageSchema,
  (socket, { to, displayName, vcard }) => sendContact(
    socket,
    to,
    { displayName, vcard },
    displayName,
  ),
);

export const postButtonMessage = createMessageHandler(
  buttonMessageSchema,
  (socket, { to, text, buttons, footer }) => sendButtons(
    socket,
    to,
    text,
    buttons,
    { footer },
  ),
);

export const postImageButtonMessage = createMessageHandler(
  imageButtonMessageSchema,
  (socket, { to, image, caption, buttons, footer }) => sendImageButtons(
    socket,
    to,
    image,
    caption,
    buttons,
    { footer },
  ),
);

export const postListMessage = createMessageHandler(
  listMessageSchema,
  (socket, { sessionId, to, ...list }) => sendList(socket, to, list),
);

export const postPollMessage = createMessageHandler(
  pollMessageSchema,
  (socket, { to, name, values, selectableCount }) => sendPoll(
    socket,
    to,
    name,
    values,
    selectableCount,
  ),
);