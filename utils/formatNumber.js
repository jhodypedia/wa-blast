const SUPPORTED_JID_SUFFIXES = new Set([
  's.whatsapp.net',
  'g.us',
  'newsletter',
  'broadcast',
  'lid',
]);

export function formatNumber(target) {
  if (typeof target !== 'string' && typeof target !== 'number' && typeof target !== 'bigint') {
    throw new TypeError('WhatsApp target must be a phone number or JID');
  }

  const value = String(target).trim();
  if (!value) {
    throw new TypeError('WhatsApp target is required');
  }

  if (value.includes('@')) {
    const separator = value.lastIndexOf('@');
    const localPart = value.slice(0, separator);
    const suffix = value.slice(separator + 1).toLowerCase();
    if (!localPart || !SUPPORTED_JID_SUFFIXES.has(suffix) || !/^[A-Za-z0-9_.:-]+$/.test(localPart)) {
      throw new TypeError('WhatsApp target is not a supported JID');
    }
    return `${localPart}@${suffix}`;
  }

  if (!/^\+?[\d\s().-]+$/.test(value)) {
    throw new TypeError('WhatsApp phone number contains invalid characters');
  }

  const number = value.replace(/\D/g, '');
  if (number.length < 5 || number.length > 15) {
    throw new TypeError('WhatsApp phone number must contain 5 to 15 digits');
  }

  return `${number}@s.whatsapp.net`;
}

export default formatNumber;