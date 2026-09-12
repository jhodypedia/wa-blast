import {
  AIRich,
  Button,
  ButtonV2,
  Carousel,
  sendA2UI,
  sendBloksWidget,
  sendHtmlApp,
  sendHtmlArtifact,
  sendHtmlDocument,
} from '@rexxhayanasi/elaina-baileys';
import { formatNumber } from '../utils/formatNumber.js';

export const WHATSAPP_OPERATION_TIMEOUT_MS = 30_000;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export class WhatsAppOperationTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`WhatsApp operation timed out after ${timeoutMs}ms`);
    this.name = 'WhatsAppOperationTimeoutError';
    this.code = 'WHATSAPP_OPERATION_TIMEOUT';
  }
}

async function withTimeout(operation, timeoutMs = WHATSAPP_OPERATION_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new WhatsAppOperationTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function messageId(result) {
  return result?.key?.id
    ?? result?.message?.key?.id
    ?? result?.messageId
    ?? (typeof result?.id === 'string' ? result.id : undefined);
}

async function run(target, operation) {
  try {
    const jid = formatNumber(target);
    const result = await withTimeout(Promise.resolve().then(() => operation(jid)));
    const id = messageId(result);
    return id ? { success: true, messageId: id } : { success: true };
  } catch (error) {
    return {
      success: false,
      error: errorMessage(error),
      code: error?.code ?? 'WHATSAPP_OPERATION_FAILED',
    };
  }
}

async function send(sock, target, content, options) {
  return run(target, async (jid) => {
    if (!sock || typeof sock.sendMessage !== 'function') {
      throw new TypeError('A connected WhatsApp socket is required');
    }
    return sock.sendMessage(jid, content, options);
  });
}

async function callSocket(sock, target, method, args) {
  return run(target, async (jid) => {
    if (!sock || typeof sock[method] !== 'function') {
      throw new TypeError(`WhatsApp socket does not support ${method}`);
    }
    return sock[method](jid, ...args);
  });
}

async function callHelper(target, helper) {
  return run(target, helper);
}

function asContent(content) {
  return typeof content === 'string' ? { text: content } : content;
}

export function sendText(sock, target, text, options) {
  return send(sock, target, { text }, options);
}

export function sendImage(sock, target, image, content = {}, options) {
  return send(sock, target, { image, ...content }, options);
}

export function sendVideo(sock, target, video, content = {}, options) {
  return send(sock, target, { video, ...content }, options);
}

export function sendGif(sock, target, video, content = {}, options) {
  return send(sock, target, { video, ...content, gifPlayback: true }, options);
}

export function sendDocument(sock, target, document, content = {}, options) {
  return send(sock, target, { document, ...content }, options);
}

export function sendAudio(sock, target, audio, content = {}, options) {
  return send(sock, target, { audio, ...content }, options);
}

export function sendVoiceNote(sock, target, audio, content = {}, options) {
  return send(sock, target, {
    audio,
    mimetype: 'audio/ogg; codecs=opus',
    ...content,
    ptt: true,
  }, options);
}

export function sendSticker(sock, target, sticker, content = {}, options) {
  return send(sock, target, { sticker, ...content }, options);
}

export function sendLottieSticker(sock, target, sticker, content = {}, options) {
  return send(sock, target, { sticker, ...content, isAnimated: true }, options);
}

export function sendVideoNote(sock, target, video, content = {}, options) {
  return send(sock, target, { video, ...content, ptv: true }, options);
}

export function sendLocation(sock, target, location, options) {
  return send(sock, target, { location }, options);
}

export function sendContact(sock, target, contact, displayName = contact?.displayName, options) {
  return send(sock, target, {
    contacts: { displayName, contacts: [contact] },
  }, options);
}

export function sendContacts(sock, target, contacts, displayName = 'Contacts', options) {
  return send(sock, target, { contacts: { displayName, contacts } }, options);
}

export function sendReaction(sock, target, key, text, options) {
  return send(sock, target, { react: { key, text } }, options);
}

export function sendPoll(sock, target, name, values, selectableCount = 1, options) {
  return send(sock, target, { poll: { name, values, selectableCount } }, options);
}

export function sendPhotoPoll(sock, target, name, values, selectableCount = 1, options) {
  return sendPoll(sock, target, name, values, selectableCount, options);
}

export function sendExtendedPoll(sock, target, poll, options) {
  return send(sock, target, { poll }, options);
}

// Quiz polls are accepted only for newsletter targets and eligible accounts.
export function sendQuiz(sock, target, poll, options) {
  return send(sock, target, { poll: { ...poll, pollType: 1 } }, options);
}

export function sendAlbum(sock, target, album, content = {}, options) {
  return send(sock, target, { album, ...content }, options);
}

export function sendProduct(sock, target, product, options) {
  return send(sock, target, { product }, options);
}

export function sendEvent(sock, target, event, options) {
  return send(sock, target, { event }, options);
}

export function sendGroupInvite(sock, target, groupInvite, options) {
  return send(sock, target, { groupInvite }, options);
}

export function sendStickerPack(sock, target, stickers, options) {
  return send(sock, target, { stickers }, options);
}

export function sendRaw(sock, target, protoMessage, options) {
  return send(sock, target, { ...protoMessage, raw: true }, options);
}

function nativeFlowParams(button) {
  switch (button.type) {
    case 'quick_reply':
      return { display_text: button.displayText, id: button.id };
    case 'cta_url':
      return {
        display_text: button.displayText,
        url: button.url,
        merchant_url: button.url,
      };
    case 'cta_call':
      return { display_text: button.displayText, phone_number: button.phoneNumber };
    case 'cta_copy':
      return { display_text: button.displayText, copy_code: button.copyText };
    case 'cta_reminder':
    case 'cta_cancel_reminder':
    case 'address_message':
      return { display_text: button.displayText, id: button.id };
    case 'single_select':
      return {
        title: button.title,
        sections: button.sections.map((section) => ({
          title: section.title,
          ...(section.highlightLabel ? { highlight_label: section.highlightLabel } : {}),
          rows: section.rows.map((row) => ({
            ...(row.header ? { header: row.header } : {}),
            title: row.title,
            ...(row.description ? { description: row.description } : {}),
            id: row.id,
          })),
        })),
      };
    case 'send_location':
      return {};
    default:
      throw new TypeError(`Unsupported native-flow button type: ${button.type}`);
  }
}

export function mapNativeFlowButtons(buttons) {
  return buttons.map((button) => ({
    name: button.type,
    buttonParamsJson: JSON.stringify(nativeFlowParams(button)),
  }));
}

export function sendButtons(sock, target, text, buttons, content = {}, options) {
  return send(sock, target, { text, nativeFlow: mapNativeFlowButtons(buttons), ...content }, options);
}

export function sendImageButtons(sock, target, image, caption, buttons, content = {}, options) {
  return send(sock, target, {
    image,
    caption,
    nativeFlow: mapNativeFlowButtons(buttons),
    ...content,
  }, options);
}

export function sendVideoButtons(sock, target, video, caption, buttons, content = {}, options) {
  return send(sock, target, { video, caption, buttons, ...content }, options);
}

export function sendList(sock, target, list, options) {
  return send(sock, target, list, options);
}

export function sendTemplate(sock, target, template, options) {
  return send(sock, target, template, options);
}

export function sendNativeFlow(sock, target, interactive, options) {
  return send(sock, target, interactive, options);
}

export function sendCarousel(sock, target, carousel, options) {
  return send(sock, target, carousel, options);
}

export function sendInteractiveTemplate(sock, target, interactive, options) {
  return send(sock, target, { ...interactive, interactiveAsTemplate: true }, options);
}

export function sendReply(sock, target, content, quoted, options = {}) {
  return send(sock, target, asContent(content), { ...options, quoted });
}

export function sendMention(sock, target, text, mentions, options) {
  return run(target, async (jid) => {
    if (!sock || typeof sock.sendMessage !== 'function') {
      throw new TypeError('A connected WhatsApp socket is required');
    }
    return sock.sendMessage(jid, {
      text,
      mentions: mentions.map(formatNumber),
    }, options);
  });
}

export function sendMentionAll(sock, target, text, options) {
  return send(sock, target, { text, mentionAll: true }, options);
}

export function sendWithContext(sock, target, content, contextInfo, options) {
  return send(sock, target, { ...asContent(content), contextInfo }, options);
}

export function sendViewOnce(sock, target, content, options) {
  return send(sock, target, { ...content, viewOnce: true }, options);
}

export function sendViewOnceV2(sock, target, content, options) {
  return send(sock, target, { ...content, viewOnceV2: true }, options);
}

export function sendViewOnceV2Extension(sock, target, content, options) {
  return send(sock, target, { ...content, viewOnceV2Extension: true }, options);
}

export function sendEphemeral(sock, target, content, options) {
  return send(sock, target, { ...asContent(content), ephemeral: true }, options);
}

export function sendSpoiler(sock, target, content, options) {
  return send(sock, target, { ...content, spoiler: true }, options);
}

export function editMessage(sock, target, key, content, options) {
  return send(sock, target, { ...asContent(content), edit: key }, options);
}

export function deleteMessage(sock, target, key, options) {
  return send(sock, target, { delete: key }, options);
}

export function forwardMessage(sock, target, message, force = false, options) {
  return send(sock, target, { forward: message, force }, options);
}

export function setDisappearingMessages(sock, target, duration, options) {
  return send(sock, target, { disappearingMessagesInChat: duration }, options);
}

export function pinMessage(sock, target, key, time, options) {
  return send(sock, target, { pin: key, type: 1, time }, options);
}

export function unpinMessage(sock, target, key, options) {
  return send(sock, target, { pin: key, type: 2 }, options);
}

export function keepMessage(sock, target, key, options) {
  return send(sock, target, { keep: key, type: 1 }, options);
}

export function unkeepMessage(sock, target, key, options) {
  return send(sock, target, { keep: key, type: 2 }, options);
}

export function sendButtonReply(sock, target, buttonReply, options) {
  return send(sock, target, { buttonReply }, options);
}

export function sendListReply(sock, target, listReply, options) {
  return send(sock, target, { listReply }, options);
}

export function sendFlowReply(sock, target, flowReply, options) {
  return send(sock, target, { flowReply }, options);
}

export function sendPollUpdate(sock, target, pollUpdate, options) {
  return send(sock, target, { pollUpdate }, options);
}

export function sendPollResult(sock, target, pollResult, options) {
  return send(sock, target, { pollResult }, options);
}

export function sharePhoneNumber(sock, target, options) {
  return send(sock, target, { sharePhoneNumber: true }, options);
}

export function requestPhoneNumber(sock, target, options) {
  return send(sock, target, { requestPhoneNumber: true }, options);
}

export function setLimitSharing(sock, target, enabled, options) {
  return send(sock, target, { limitSharing: Boolean(enabled) }, options);
}

// Payment payloads are region, account, and server-capability sensitive.
export function sendPaymentRequest(sock, target, requestPaymentFrom, options) {
  return send(sock, target, { requestPaymentFrom }, options);
}

export function sendInvoiceNote(sock, target, invoiceNote, options) {
  return send(sock, target, { invoiceNote }, options);
}

export function sendOrderText(sock, target, orderText, options) {
  return send(sock, target, { orderText }, options);
}

export function sendPaymentInvite(sock, target, paymentInviteServiceType, options) {
  return send(sock, target, { paymentInviteServiceType }, options);
}

function sendModern(sock, target, type, payload, options) {
  return send(sock, target, { [type]: payload }, options);
}

// Modern status and newsletter payloads may require account-specific capabilities.
export const sendQuestion = (sock, target, payload, options) => sendModern(sock, target, 'question', payload, options);
export const sendQuestionReply = (sock, target, payload, options) => sendModern(sock, target, 'questionReply', payload, options);
export const sendQuestionResponse = (sock, target, payload, options) => sendModern(sock, target, 'questionResponse', payload, options);
export const sendStatusQuestionAnswer = (sock, target, payload, options) => sendModern(sock, target, 'statusQuestionAnswer', payload, options);
export const sendStatusQuoted = (sock, target, payload, options) => sendModern(sock, target, 'statusQuoted', payload, options);
export const sendStatusStickerInteraction = (sock, target, payload, options) => sendModern(sock, target, 'statusStickerInteraction', payload, options);
export const sendStatusNotification = (sock, target, payload, options) => sendModern(sock, target, 'statusNotification', payload, options);
export const sendNewsletterAdminInvite = (sock, target, payload, options) => sendModern(sock, target, 'newsletterAdminInvite', payload, options);
export const sendNewsletterFollowerInvite = (sock, target, payload, options) => sendModern(sock, target, 'newsletterFollowerInvite', payload, options);
export const sendPollAddOption = (sock, target, payload, options) => sendModern(sock, target, 'pollAddOption', payload, options);
export const sendComment = (sock, target, payload, options) => sendModern(sock, target, 'comment', payload, options);
export const sendEventInvite = (sock, target, payload, options) => sendModern(sock, target, 'eventInvite', payload, options);
export const sendScheduledCall = (sock, target, payload, options) => sendModern(sock, target, 'scheduledCall', payload, options);
export const editScheduledCall = (sock, target, payload, options) => sendModern(sock, target, 'scheduledCallEdit', payload, options);
export const sendGroupStatusReaction = (sock, target, payload, options) => sendModern(sock, target, 'groupStatusReaction', payload, options);

export function sendNewsletterStatus(sock, target, content, options) {
  return callSocket(sock, target, 'sendNewsletterStatus', [content, options]);
}

export function sendNewsletterStatusReaction(sock, target, statusKey, reaction) {
  return callSocket(sock, target, 'sendNewsletterStatusReaction', [statusKey, reaction]);
}

export function revokeNewsletterStatus(sock, target, statusKey) {
  return callSocket(sock, target, 'revokeNewsletterStatus', [statusKey]);
}

async function sendBuilder(sock, target, Builder, configure, options) {
  return callHelper(target, async (jid) => {
    if (!sock) {
      throw new TypeError('A connected WhatsApp socket is required');
    }
    const builder = new Builder(sock);
    const configured = typeof configure === 'function'
      ? await configure(builder) ?? builder
      : configure ?? builder;
    if (typeof configured.send !== 'function') {
      throw new TypeError('Message builder must provide a send method');
    }
    return configured.send(jid, options);
  });
}

export function sendButtonBuilder(sock, target, configure, options) {
  return sendBuilder(sock, target, Button, configure, options);
}

export function sendClassicButtonBuilder(sock, target, configure, options) {
  return sendBuilder(sock, target, ButtonV2, configure, options);
}

export function sendCarouselBuilder(sock, target, configure, options) {
  return sendBuilder(sock, target, Carousel, configure, options);
}

export function sendAIRich(sock, target, configure, options) {
  return sendBuilder(sock, target, AIRich, configure, options);
}

export function editAIRich(sock, target, messageIdToEdit, configure, options) {
  return callHelper(target, async (jid) => {
    if (!sock) {
      throw new TypeError('A connected WhatsApp socket is required');
    }
    const builder = new AIRich(sock);
    const configured = typeof configure === 'function'
      ? await configure(builder) ?? builder
      : configure ?? builder;
    return configured.sendEdit(jid, messageIdToEdit, options);
  });
}

// Rich extras are experimental and their rendering depends on the receiving client.
export function sendHtmlWebApp(sock, target, html, options) {
  return callHelper(target, (jid) => sendHtmlApp(sock, jid, html, options));
}

export function sendHtmlFile(sock, target, html, options) {
  return callHelper(target, (jid) => sendHtmlDocument(sock, jid, html, options));
}

export function sendHtmlRichArtifact(sock, target, html, options) {
  return callHelper(target, (jid) => sendHtmlArtifact(sock, jid, html, options));
}

export function sendA2UIMessage(sock, target, components, options) {
  return callHelper(target, (jid) => sendA2UI(sock, jid, components, options));
}

export function sendBloksWidgetMessage(sock, target, payload) {
  return callHelper(target, (jid) => sendBloksWidget(sock, jid, payload));
}