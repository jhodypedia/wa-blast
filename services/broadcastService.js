import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { pool } from '../config/database.js';
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
} from './whatsappService.js';

const logger = pino().child({ service: 'broadcast-service' });
export const MAX_BROADCAST_DURATION_MS = 60 * 60 * 1000;
export const MAX_CONCURRENT_BROADCASTS = 5;
let activeBroadcasts = 0;

const dispatchers = {
  text: {
    schema: textMessageSchema,
    build: ({ sessionId, target, message }) => ({ sessionId, to: target, text: message }),
    send: (socket, { to, text }) => sendText(socket, to, text),
  },
  image: {
    schema: imageMessageSchema,
    build: ({ sessionId, target, message, mediaPayload }) => ({
      sessionId,
      to: target,
      image: mediaPayload.image,
      caption: message || mediaPayload.caption,
      mimetype: mediaPayload.mimetype,
    }),
    send: (socket, { to, image, caption, mimetype }) => sendImage(socket, to, image, { caption, mimetype }),
  },
  video: {
    schema: videoMessageSchema,
    build: ({ sessionId, target, message, mediaPayload }) => ({
      sessionId,
      to: target,
      video: mediaPayload.video,
      caption: message || mediaPayload.caption,
      mimetype: mediaPayload.mimetype,
    }),
    send: (socket, { to, video, caption, mimetype }) => sendVideo(socket, to, video, { caption, mimetype }),
  },
  document: {
    schema: documentMessageSchema,
    build: ({ sessionId, target, message, mediaPayload }) => ({
      sessionId,
      to: target,
      document: mediaPayload.document,
      mimetype: mediaPayload.mimetype,
      fileName: mediaPayload.fileName,
      caption: message || mediaPayload.caption,
    }),
    send: (socket, { to, document, mimetype, fileName, caption }) => sendDocument(
      socket,
      to,
      document,
      { mimetype, fileName, caption },
    ),
  },
  audio: {
    schema: audioMessageSchema,
    build: ({ sessionId, target, mediaPayload }) => ({
      sessionId,
      to: target,
      audio: mediaPayload.audio,
      mimetype: mediaPayload.mimetype,
    }),
    send: (socket, { to, audio, mimetype }) => sendAudio(socket, to, audio, { mimetype }),
  },
  sticker: {
    schema: stickerMessageSchema,
    build: ({ sessionId, target, mediaPayload }) => ({
      sessionId,
      to: target,
      sticker: mediaPayload.sticker,
    }),
    send: (socket, { to, sticker }) => sendSticker(socket, to, sticker),
  },
  location: {
    schema: locationMessageSchema,
    build: ({ sessionId, target, mediaPayload }) => ({ sessionId, to: target, ...mediaPayload }),
    send: (socket, { to, latitude, longitude, name, address, url }) => sendLocation(socket, to, {
      degreesLatitude: latitude,
      degreesLongitude: longitude,
      name,
      address,
      url,
    }),
  },
  contact: {
    schema: contactMessageSchema,
    build: ({ sessionId, target, mediaPayload }) => ({ sessionId, to: target, ...mediaPayload }),
    send: (socket, { to, displayName, vcard }) => sendContact(
      socket,
      to,
      { displayName, vcard },
      displayName,
    ),
  },
  button: {
    schema: buttonMessageSchema,
    build: ({ sessionId, target, message, mediaPayload }) => ({
      sessionId,
      to: target,
      text: message,
      footer: mediaPayload.footer,
      buttons: mediaPayload.buttons,
    }),
    send: (socket, { to, text, buttons, footer }) => sendButtons(socket, to, text, buttons, { footer }),
  },
  'image-button': {
    schema: imageButtonMessageSchema,
    build: ({ sessionId, target, message, mediaPayload }) => ({
      sessionId,
      to: target,
      image: mediaPayload.image,
      caption: message || mediaPayload.caption,
      footer: mediaPayload.footer,
      buttons: mediaPayload.buttons,
    }),
    send: (socket, { to, image, caption, buttons, footer }) => sendImageButtons(
      socket,
      to,
      image,
      caption,
      buttons,
      { footer },
    ),
  },
  list: {
    schema: listMessageSchema,
    build: ({ sessionId, target, message, mediaPayload }) => ({
      sessionId,
      to: target,
      text: message,
      ...mediaPayload,
    }),
    send: (socket, { sessionId, to, ...list }) => sendList(socket, to, list),
  },
  poll: {
    schema: pollMessageSchema,
    build: ({ sessionId, target, message, mediaPayload }) => ({
      sessionId,
      to: target,
      name: message,
      values: mediaPayload.values,
      selectableCount: mediaPayload.selectableCount,
    }),
    send: (socket, { to, name, values, selectableCount }) => sendPoll(
      socket,
      to,
      name,
      values,
      selectableCount,
    ),
  },
};

function renderTemplate(template, values = {}) {
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key) => (
    Object.hasOwn(values, key) ? String(values[key] ?? '') : match
  ));
}

function prepareMessage(payload, target) {
  const dispatcher = dispatchers[payload.type];
  const message = renderTemplate(payload.message, payload.variables[target]);
  return {
    dispatcher,
    message: dispatcher.schema.parse(dispatcher.build({ ...payload, target, message })),
  };
}

function randomDelay({ min, max }) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function validateBroadcastContent(payload) {
  const maximumDuration = Math.max(0, payload.targets.length - 1) * payload.delay.max;
  if (maximumDuration > MAX_BROADCAST_DURATION_MS) {
    throw new RangeError('Broadcast delay would exceed the maximum one-hour duration');
  }
  for (const target of payload.targets) {
    prepareMessage(payload, target);
  }
}

export function tryStartBroadcast() {
  if (activeBroadcasts >= MAX_CONCURRENT_BROADCASTS) {
    return false;
  }
  activeBroadcasts += 1;
  return true;
}

export function finishBroadcast() {
  activeBroadcasts = Math.max(0, activeBroadcasts - 1);
}

export async function failPendingBroadcasts(reason = 'Gateway restarted before broadcast completion') {
  await pool.execute(
    `UPDATE broadcast_logs
     SET status = 'failed', error_message = ?, sent_at = NULL
     WHERE status = 'pending'`,
    [reason],
  );
}

export async function createBroadcast(payload, apiKeyId) {
  const connection = await pool.getConnection();
  const broadcastId = randomUUID();

  try {
    await connection.beginTransaction();
    const [sessions] = await connection.execute(
      'SELECT id FROM sessions WHERE session_name = ? AND api_key_id = ? LIMIT 1 FOR UPDATE',
      [payload.sessionId, apiKeyId],
    );
    if (sessions.length === 0) {
      await connection.rollback();
      return null;
    }

    const rows = [];
    for (const target of payload.targets) {
      const [result] = await connection.execute(
        `INSERT INTO broadcast_logs
          (broadcast_id, session_id, target_number, message_type, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [broadcastId, sessions[0].id, target, payload.type],
      );
      rows.push({ id: result.insertId, target });
    }
    await connection.commit();
    return { broadcastId, rows };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function processBroadcast(socket, payload, rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const { dispatcher, message } = prepareMessage(payload, row.target);
      const result = await dispatcher.send(socket, message);
      if (!result.success) {
        throw new Error(result.error);
      }
      await pool.execute(
        `UPDATE broadcast_logs
         SET status = 'sent', error_message = NULL, sent_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [row.id],
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.warn({ broadcastId: payload.broadcastId, target: row.target, error }, 'Broadcast message failed');
      await pool.execute(
        `UPDATE broadcast_logs
         SET status = 'failed', error_message = ?, sent_at = NULL
         WHERE id = ?`,
        [reason, row.id],
      );
    }

    if (index < rows.length - 1) {
      await wait(randomDelay(payload.delay));
    }
  }
}

export async function getBroadcastStatus(broadcastId, apiKeyId) {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(status = 'sent'), 0) AS sent,
       COALESCE(SUM(status = 'failed'), 0) AS failed,
       COALESCE(SUM(status = 'pending'), 0) AS pending
    FROM broadcast_logs AS logs
    INNER JOIN sessions ON sessions.id = logs.session_id
    WHERE logs.broadcast_id = ? AND sessions.api_key_id = ?`,
      [broadcastId, apiKeyId],
  );
  if (Number(rows[0].total) === 0) {
    return null;
  }
  return {
    total: Number(rows[0].total),
    sent: Number(rows[0].sent),
    failed: Number(rows[0].failed),
    pending: Number(rows[0].pending),
  };
}