# Elaina Baileys Messaging Features

Research target: `@rexxhayanasi/elaina-baileys` 1.3.9, based on its installed README, declarations, and `lib` implementation. Unless noted otherwise, examples are the `content` argument to:

```js
await sock.sendMessage(jid, content, options)
```

## Core Message Types

| Feature name | Function/method | Example payload structure |
|---|---|---|
| Text | `sock.sendMessage` | `{ text: 'Hello' }` |
| Image | `sock.sendMessage` | `{ image: Buffer \| { url: 'https://...' }, caption: 'Caption', mimetype: 'image/jpeg' }` |
| Video | `sock.sendMessage` | `{ video: Buffer \| { url: 'https://...' }, caption: 'Caption', mimetype: 'video/mp4' }` |
| GIF-style video | `sock.sendMessage` | `{ video: Buffer \| { url: 'https://...' }, caption: 'GIF', gifPlayback: true }` |
| Document | `sock.sendMessage` | `{ document: Buffer \| { url: 'https://...' }, mimetype: 'application/pdf', fileName: 'file.pdf', caption: 'File' }` |
| Audio | `sock.sendMessage` | `{ audio: Buffer \| { url: 'https://...' }, mimetype: 'audio/mpeg' }` |
| Voice note | `sock.sendMessage` | `{ audio: Buffer \| { url: 'https://...' }, mimetype: 'audio/ogg; codecs=opus', ptt: true }` |
| Sticker | `sock.sendMessage` | `{ sticker: Buffer \| { url: 'https://...' } }` |
| Location | `sock.sendMessage` | `{ location: { degreesLatitude: -6.2, degreesLongitude: 106.8, name: 'Place', address: 'Address', url: 'https://...' } }` |
| Single contact / vCard | `sock.sendMessage` | `{ contacts: { displayName: 'Jane Doe', contacts: [{ displayName: 'Jane Doe', vcard: 'BEGIN:VCARD\\n...' }] } }` |
| Multiple contacts | `sock.sendMessage` | `{ contacts: { displayName: 'Team', contacts: [{ displayName: 'Jane', vcard: '...' }, { displayName: 'John', vcard: '...' }] } }` |
| Reaction | `sock.sendMessage` | `{ react: { text: '👍', key: originalMessage.key } }` (empty `text` removes it) |
| Poll | `sock.sendMessage` | `{ poll: { name: 'Choose one', values: ['A', 'B'], selectableCount: 1 } }` |
| Photo poll | `sock.sendMessage` | `{ poll: { name: 'Choose', values: [{ name: 'A', image: Buffer }, { name: 'B', image: Buffer }], selectableCount: 1 } }` |
| Extended poll | `sock.sendMessage` | `{ poll: { name: 'Choose', values: ['A', 'B'], selectableCount: 1, endDate: new Date(), hideVoter: true, canAddOption: true } }` |
| Quiz (newsletter only) | `sock.sendMessage` | `{ poll: { name: 'Question', values: ['A', 'B'], selectableCount: 1, pollType: 1, correctAnswer: 'A' } }` |
| Album | `sock.sendMessage` | `{ album: [{ image: Buffer }, { video: { url: 'https://...' } }], caption: 'Album' }` (minimum two items) |

## Buttons and Interactive Messages

### Native-flow support in 1.3.9

Elaina Baileys sends modern controls as `nativeFlow` entries. Each entry has the wire shape `{ name, buttonParamsJson: JSON.stringify(params) }`; the JSON property is `buttonParamsJson`, not `paramsJson`.

| Gateway type | Native-flow name | Exact `buttonParamsJson` object | Package evidence | Client support |
|---|---|---|---|---|
| Quick reply | `quick_reply` | `{ display_text, id }` | `prepareNativeFlowButtons`, `Button.addReply` | Web, iOS, Android |
| Open URL | `cta_url` | `{ display_text, url, merchant_url?, webview_interaction? }` | `prepareNativeFlowButtons`, `Button.addUrl` | Web, iOS, Android |
| Call | `cta_call` | `{ display_text, phone_number }` | `prepareNativeFlowButtons` | Web, iOS, Android |
| Copy text/code | `cta_copy` | `{ display_text, copy_code }` | `prepareNativeFlowButtons`, `Button.addCopy` | Web, iOS, Android |
| Reminder | `cta_reminder` | `{ display_text, id }` | `Button.addReminder` | Android only |
| Cancel reminder | `cta_cancel_reminder` | `{ display_text, id }` | `Button.addCancelReminder` | Android only |
| Single-select list | `single_select` | `{ title, sections: [{ title, highlight_label?, rows: [{ header?, title, description?, id }] }] }` | `Button.addSelection`, `makeSection`, `makeRow` | Android only |
| Address request | `address_message` | `{ display_text, id }` | `Button.addAddress` | Android only |
| Send location | `send_location` | `{}` | `Button.addLocation` | Android only |

`cta_catalog` is recognized by `NATIVE_FLOW_NAMES` and listed by the package as cross-platform, but version 1.3.9 has no typed builder or authoritative parameter schema for it. It is therefore available only through lower-level raw native-flow APIs, not the gateway's typed button endpoints. The same rule applies to recognized business/protocol flows such as order, payment, booking, signup, app, and form messages: recognition of a native-flow name does not establish a stable public payload contract.

The package reads two client limits: a message beginning with `quick_reply` supports at most 10 buttons, while a message beginning with any other type supports at most 3. Quick replies cannot be mixed with non-quick buttons. For predictable rendering, non-quick messages should also use one button type per message. Android-only controls disappear on WhatsApp Web and iOS while the surrounding text card may still arrive.

| Feature name | Function/method | Example payload structure |
|---|---|---|
| Classic buttons | `sock.sendMessage` | `{ text: 'Choose', footer: 'Footer', buttons: [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }] }` |
| Image with buttons | `sock.sendMessage` | `{ image: Buffer, caption: 'Choose', footer: 'Footer', buttons: [{ id: 'open', text: 'Open' }] }` |
| Video with buttons | `sock.sendMessage` | `{ video: Buffer, caption: 'Choose', footer: 'Footer', buttons: [{ id: 'play', text: 'Play' }] }` |
| Native-flow button | `sock.sendMessage` | `{ text: 'Choose', nativeFlow: [{ name: 'quick_reply', buttonParamsJson: '{"display_text":"Yes","id":"yes"}' }] }` |
| Single-select button | `sock.sendMessage` | `{ text: 'Choose', nativeFlow: [{ name: 'single_select', buttonParamsJson: '{"title":"Open list","sections":[{"title":"Options","rows":[{"title":"One","id":"one"}]}]}' }] }` |
| Legacy list | `sock.sendMessage` | `{ text: 'Choose', title: 'Menu', footer: 'Footer', buttonText: 'Open', sections: [{ title: 'Options', rows: [{ title: 'One', description: 'First', rowId: 'one' }] }] }` |
| Template message | `sock.sendMessage` | `{ text: 'Choose', footer: 'Footer', templateButtons: [{ id: 'yes', text: 'Yes' }, { url: 'https://example.com', text: 'Visit' }, { call: '+15551234567', text: 'Call' }] }` |
| Native-flow interactive | `sock.sendMessage` | `{ text: 'Choose', footer: 'Footer', image: Buffer, nativeFlow: [{ name: 'quick_reply', buttonParamsJson: '{"display_text":"Yes","id":"yes"}' }] }` |
| Carousel | `sock.sendMessage` | `{ text: 'Products', footer: 'Footer', cards: [{ image: Buffer, caption: 'Item', nativeFlow: [{ name: 'quick_reply', buttonParamsJson: '{"display_text":"Open","id":"item-1"}' }] }] }` |
| Interactive template wrapper | `sock.sendMessage` | `{ text: 'Choose', nativeFlow: [...], interactiveAsTemplate: true, id: 'template-id' }` |

Classic buttons, lists, templates, and native-flow controls are client-sensitive. Use the native-flow limits and platform notes above for new gateway integrations.

## Content Modifiers and Message Actions

| Feature name | Function/method | Example payload structure |
|---|---|---|
| Mention | `sock.sendMessage` | `{ text: 'Hello @user', mentions: ['15551234567@s.whatsapp.net'] }` |
| Mention all | `sock.sendMessage` | `{ text: 'Hello everyone', mentionAll: true }` |
| Quoted / reply | `sock.sendMessage` | `content: { text: 'Reply' }, options: { quoted: originalMessage }` |
| Explicit context | `sock.sendMessage` | `{ text: 'Contextual', contextInfo: { mentionedJid: ['15551234567@s.whatsapp.net'] } }` |
| View once | `sock.sendMessage` | `{ image: Buffer, caption: 'Once', viewOnce: true }` (also supported for video/audio) |
| View once V2 | `sock.sendMessage` | `{ video: Buffer, viewOnceV2: true }` |
| View once V2 extension | `sock.sendMessage` | `{ image: Buffer, viewOnceV2Extension: true }` |
| Ephemeral wrapper | `sock.sendMessage` | `{ text: 'Temporary', ephemeral: true }` |
| Spoiler | `sock.sendMessage` | `{ image: Buffer, spoiler: true }` |
| Edit message | `sock.sendMessage` | `{ text: 'Updated text', edit: originalMessage.key }` |
| Delete / revoke | `sock.sendMessage` | `{ delete: originalMessage.key }` |
| Forward | `sock.sendMessage` | `{ forward: webMessageInfo, force: false }` |
| Disappearing messages setting | `sock.sendMessage` | `{ disappearingMessagesInChat: 86400 }` |
| Group invite | `sock.sendMessage` | `{ groupInvite: { ...inviteData } }` |
| Sticker pack | `sock.sendMessage` | `{ stickers: { ...stickerPackData } }` |
| Pin | `sock.sendMessage` | `{ pin: { key: originalMessage.key, type: 1, time: 86400 } }` |
| Keep | `sock.sendMessage` | `{ keep: { key: originalMessage.key, type: 1 } }` |
| Button reply | `sock.sendMessage` | `{ buttonReply: { ...replyData } }` |
| List reply | `sock.sendMessage` | `{ listReply: { ...replyData } }` |
| Flow reply | `sock.sendMessage` | `{ flowReply: { ...replyData } }` |
| Product | `sock.sendMessage` | `{ product: { ...productData } }` |
| Event | `sock.sendMessage` | `{ event: { ...eventData } }` |
| Poll update | `sock.sendMessage` | `{ pollUpdate: { ...updateData } }` |
| Poll result | `sock.sendMessage` | `{ pollResult: { ...resultData } }` |
| Video note (PTV) | `sock.sendMessage` | `{ ptv: Buffer \| { url: 'https://...' } }` |
| Raw protobuf content | `sock.sendMessage` | `{ raw: proto.Message.fromObject({ ... }) }` |
| Share phone number | `sock.sendMessage` | `{ sharePhoneNumber: true }` |
| Request phone number | `sock.sendMessage` | `{ requestPhoneNumber: true }` |
| Limit sharing | `sock.sendMessage` | `{ limitSharing: { ...settings } }` |
| Request payment | `sock.sendMessage` | `{ requestPaymentFrom: { ...requestData } }` |
| Invoice note | `sock.sendMessage` | `{ invoiceNote: { ...invoiceData } }` |
| Order text | `sock.sendMessage` | `{ orderText: { ...orderData } }` |
| Payment invite | `sock.sendMessage` | `{ paymentInviteServiceType: '...' }` |

## Modern and Specialized Variants

These keys are intercepted by `prepareModernMessageContent` before ordinary message generation. Their structures are specialized protocol payloads and should be confirmed against the corresponding declaration before implementation.

| Feature name | Function/method | Example payload structure |
|---|---|---|
| Question | `sock.sendMessage` | `{ question: { ...questionData } }` |
| Question reply | `sock.sendMessage` | `{ questionReply: { ...replyData } }` |
| Question response | `sock.sendMessage` | `{ questionResponse: { ...responseData } }` |
| Status question answer | `sock.sendMessage` | `{ statusQuestionAnswer: { ...answerData } }` |
| Status quoted message | `sock.sendMessage` | `{ statusQuoted: { ...quotedData } }` |
| Status sticker interaction | `sock.sendMessage` | `{ statusStickerInteraction: { ...interactionData } }` |
| Status notification | `sock.sendMessage` | `{ statusNotification: { ...notificationData } }` |
| Newsletter admin invite | `sock.sendMessage` | `{ newsletterAdminInvite: { ...inviteData } }` |
| Newsletter follower invite | `sock.sendMessage` | `{ newsletterFollowerInvite: { ...inviteData } }` |
| Add poll option | `sock.sendMessage` | `{ pollAddOption: { ...optionData } }` |
| Comment | `sock.sendMessage` | `{ comment: { ...commentData } }` |
| Event invite | `sock.sendMessage` | `{ eventInvite: { ...inviteData } }` |
| Scheduled call | `sock.sendMessage` | `{ scheduledCall: { ...callData } }` |
| Edit scheduled call | `sock.sendMessage` | `{ scheduledCallEdit: { ...editData } }` |
| Group status reaction | `sock.sendMessage` | `{ groupStatusReaction: { ...reactionData } }` |
| Newsletter status | `sock.sendNewsletterStatus` | `(newsletterJid, content, options?)` |
| Newsletter status reaction | `sock.sendNewsletterStatusReaction` | `(newsletterJid, statusKey, reaction)` |
| Revoke newsletter status | `sock.revokeNewsletterStatus` | `(newsletterJid, statusKey)` |

## Builders and Extra Send Helpers

| Feature name | Function/method | Example payload structure |
|---|---|---|
| Interactive button builder | `new Button(sock).send` | `new Button(sock).setText('Choose').addQuickReply('Yes', 'yes').send(jid, options)` |
| Classic button builder | `new ButtonV2(sock).send` | `new ButtonV2(sock).setText('Choose').addButton('Yes', 'yes').send(jid, options)` |
| Carousel builder | `new Carousel(sock).addCard(...).send` | `new Carousel(sock).addCard([buttonBuilder.toCard()]).send(jid, options)` |
| AI rich message | `new AIRich(sock).send` | `new AIRich(sock).addText('Hello').send(jid, options)` |
| Edit AI rich message | `new AIRich(sock).sendEdit` | `richBuilder.sendEdit(jid, originalMessage.key, options)` |
| HTML WebView app | `sendHtmlApp` | `sendHtmlApp(sock, jid, '<html>...</html>', options)` (Android-only rich rendering) |
| HTML document | `sendHtmlDocument` | `sendHtmlDocument(sock, jid, '<html>...</html>', options)` |
| HTML artifact | `sendHtmlArtifact` | `sendHtmlArtifact(sock, jid, '<html>...</html>', options)` |
| A2UI | `sendA2UI` | `sendA2UI(sock, jid, components, options)` (README says rendering is unconfirmed) |
| Bloks widget | `sendBloksWidget` | `sendBloksWidget(sock, jid, payload)` |

## Sending Pipeline

| Feature name | Function/method | Example payload structure |
|---|---|---|
| High-level send | `sock.sendMessage` | `(jid, content, options?)` |
| Modern preprocessing | `prepareModernMessageContent` | `(content)` |
| Content generation | `generateWAMessageContent` | `(content, options)` |
| Full message generation | `generateWAMessage` | `(jid, content, options)` |
| Raw message generation | `generateWAMessageFromContent` | `(jid, protoMessage, options)` |
| Media preparation/upload | `prepareWAMessageMedia` | `({ image: Buffer }, uploadOptions)` |
| Low-level transport | `sock.relayMessage` | `(jid, protoMessage, relayOptions)` |

Normal application code should use `sock.sendMessage`. Generation helpers and `sock.relayMessage` are intended for custom protobuf messages, uncommon interactive nodes, and protocol-level extensions.

## Installed Sources Consulted

- `README.md`
- `lib/Socket/messages-send.js`
- `lib/Socket/index.js`
- `lib/Utils/messages.js`
- `lib/Utils/modern-messages.js`
- `lib/MessageBuilder/index.js`
- `lib/MessageBuilder/extras.js`
- `WAProto/index.d.ts`
- Relevant declarations under `lib/**/*.d.ts`