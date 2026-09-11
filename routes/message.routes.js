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

const router = Router();

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

export default router;