import { Router } from 'express';
import { postBroadcast } from '../controllers/broadcast.controller.js';
import {
  postAudioMessage,
  postButtonMessage,
  postContactMessage,
  postDocumentMessage,
  postImageButtonMessage,
  postImageMessage,
  postListMessage,
  postLocationMessage,
  postPollMessage,
  postStickerMessage,
  postTextMessage,
  postVideoMessage,
} from '../controllers/message.controller.js';
import { broadcastOperation, jsonBody, messageOperation } from './openapi.js';

const router = Router();

/** @openapi
 * /message/broadcast:
 *   post:
 *     operationId: sendBroadcast
 *     x-operation: sendBroadcast
 * /message/text:
 *   post:
 *     operationId: sendTextMessage
 *     x-operation: sendText
 * /message/image:
 *   post:
 *     operationId: sendImageMessage
 *     x-operation: sendImage
 * /message/video:
 *   post:
 *     operationId: sendVideoMessage
 *     x-operation: sendVideo
 * /message/document:
 *   post:
 *     operationId: sendDocumentMessage
 *     x-operation: sendDocument
 * /message/audio:
 *   post:
 *     operationId: sendAudioMessage
 *     x-operation: sendAudio
 * /message/sticker:
 *   post:
 *     operationId: sendStickerMessage
 *     x-operation: sendSticker
 * /message/location:
 *   post:
 *     operationId: sendLocationMessage
 *     x-operation: sendLocation
 * /message/contact:
 *   post:
 *     operationId: sendContactMessage
 *     x-operation: sendContact
 * /message/button:
 *   post:
 *     operationId: sendButtonMessage
 *     x-operation: sendButton
 * /message/image-button:
 *   post:
 *     operationId: sendImageButtonMessage
 *     x-operation: sendImageButton
 * /message/list:
 *   post:
 *     operationId: sendListMessage
 *     x-operation: sendList
 * /message/poll:
 *   post:
 *     operationId: sendPollMessage
 *     x-operation: sendPoll
 */
router.post('/broadcast', postBroadcast);
router.post('/text', postTextMessage);
router.post('/image', postImageMessage);
router.post('/video', postVideoMessage);
router.post('/document', postDocumentMessage);
router.post('/audio', postAudioMessage);
router.post('/sticker', postStickerMessage);
router.post('/location', postLocationMessage);
router.post('/contact', postContactMessage);
router.post('/button', postButtonMessage);
router.post('/image-button', postImageButtonMessage);
router.post('/list', postListMessage);
router.post('/poll', postPollMessage);

export const openapiOperations = {
  sendBroadcast: broadcastOperation('Queue a broadcast', {
    requestBody: jsonBody('BroadcastMessage'),
    successStatus: 202,
    successExample: { success: true, data: { broadcastId: '42' }, error: null },
  }),
  sendText: messageOperation('Send a text message', 'TextMessage'),
  sendImage: messageOperation('Send an image message', 'ImageMessage'),
  sendVideo: messageOperation('Send a video message', 'VideoMessage'),
  sendDocument: messageOperation('Send a document message', 'DocumentMessage'),
  sendAudio: messageOperation('Send an audio message', 'AudioMessage'),
  sendSticker: messageOperation('Send a sticker message', 'StickerMessage'),
  sendLocation: messageOperation('Send a location message', 'LocationMessage'),
  sendContact: messageOperation('Send a contact message', 'ContactMessage'),
  sendButton: messageOperation('Send a button message', 'ButtonMessage'),
  sendImageButton: messageOperation('Send an image with buttons', 'ImageButtonMessage'),
  sendList: messageOperation('Send a list message', 'ListMessage'),
  sendPoll: messageOperation('Send a poll message', 'PollMessage'),
};

export default router;