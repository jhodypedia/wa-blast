export function parseAdminIds(value = '') {
  return new Set(
    value
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isAdmin(context, adminIds) {
  return adminIds.has(String(context.from?.id ?? ''));
}

export async function handleCommand({ context, adminIds, logger, action }) {
  try {
    if (!isAdmin(context, adminIds)) {
      await context.reply('Unauthorized');
      return;
    }

    await action();
  } catch (error) {
    logger.error({ error, telegramUserId: context.from?.id }, 'Telegram command failed');
    const detail = error instanceof TypeError ? `: ${error.message}` : '';
    await context.reply(`Unable to complete the command${detail}`);
  }
}