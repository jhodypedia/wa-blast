# WhatsApp Gateway API

A backend-only, multi-tenant WhatsApp gateway with API-key authentication, per-key rate limits, broadcast tracking, Telegram administration, and interactive OpenAPI documentation.

## Requirements

- Node.js 20 or newer (Node.js 24 recommended)
- npm
- MySQL or MariaDB
- A Telegram bot token from [BotFather](https://t.me/BotFather)
- A Telegram numeric user ID for each administrator
- PM2 for production process management (included as a project dependency)

## Installation

1. Install the dependencies:

   ```powershell
   npm install
   ```

2. Create the database:

   ```sql
   CREATE DATABASE whatsapp_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Copy `.env.example` to `.env` and enter the deployment values:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Apply all pending database migrations:

   ```powershell
   npm run migration
   ```

5. Verify database access:

   ```powershell
   npm run db:check
   ```

## Database Migrations

`npm run migration` applies every pending timestamped SQL file in `migrations/` and records completed files in `schema_migrations`. Re-running the command skips migrations that were already applied. For an existing deployment that already has the current schema but no migration ledger, its first run records the historical baseline instead of replaying old `ALTER TABLE` statements.

For every future schema change, add a new timestamped SQL file in `migrations/` instead of applying SQL directly to a database. Do not edit a migration that may already have been applied.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Express port. Defaults to `3000`. |
| `DB_HOST` | Yes | MySQL host, such as `127.0.0.1`. |
| `DB_USER` | Yes | MySQL user. |
| `DB_PASS` | No | MySQL password. An empty value is supported. |
| `DB_NAME` | Yes | MySQL database name. |
| `TELEGRAM_BOT_TOKEN` | For administration | Telegram bot token issued by BotFather. Keep it secret. |
| `TELEGRAM_ADMIN_IDS` | With the bot token | Comma- or whitespace-separated numeric Telegram user IDs allowed to administer API keys. |

The API server can run without `TELEGRAM_BOT_TOKEN`, but Telegram key administration is then disabled. When a token is configured, at least one administrator ID must also be configured.

## Running with PM2

Express and Telegram polling run in the same `server.js` process. Start exactly one PM2 instance so Telegram does not receive conflicting polling requests:

```powershell
npx pm2 start ecosystem.config.js
npx pm2 status
npx pm2 logs whatsapp-gateway
```

To reload after a deployment:

```powershell
npx pm2 reload ecosystem.config.js
```

To restore the process after a reboot, use PM2's platform-specific startup instructions and save the current process list:

```powershell
npx pm2 save
```

## Generate the First API Key

1. Start the application and open the Telegram bot configured by `TELEGRAM_BOT_TOKEN`.
2. From an account whose numeric ID appears in `TELEGRAM_ADMIN_IDS`, send `/start`.
3. Send `/generatekey initial-admin`.
4. Store the returned `ps-` prefixed key immediately. New keys use 24 cryptographically random bytes encoded as 48 lowercase hexadecimal characters, for example `ps-7f3a9c2e1b8d4f60a5c3e9b21d84f6a0c7e3b5f912d84a6c`. Later key listings keep the prefix visible while masking the secret portion and do not reveal it in full again. Existing keys remain supported.
5. In Swagger UI, select **Authorize** and enter the key. API requests send it in the `x-api-key` header.

Non-admin Telegram users receive `Unauthorized` and cannot manage keys.

## Connect WhatsApp

Open [Swagger UI](http://localhost:3000/api-docs/) and authorize with an API key before using either flow. Replace `localhost:3000` with the deployment host when running remotely.

### QR Code

1. Run `POST /session/start/qr` with an optional `label`. The server generates a collision-safe session ID scoped with the current API key ID.
2. The response contains the generated `sessionId` and a QR code as a data URL.
3. Render or open the data URL, then on the phone open WhatsApp **Settings > Linked devices > Link a device** and scan it.
4. Check `GET /session/{sessionId}/status` until the status is `connected`.

### Pairing Code

1. Run `POST /session/start/pairing` with `phoneNumber` and an optional `label`. The phone number must use international format, including country code.
2. The gateway requests an auto-generated pairing code. The response includes the generated `sessionId` and `pairingCode`.
3. On the phone open WhatsApp **Settings > Linked devices > Link a device > Link with phone number instead**, then enter the returned `pairingCode`.
4. Check `GET /session/{sessionId}/status` until the status is `connected`.

Session credentials are stored under `sessions/`. Keep that directory private and persistent in production.

Use `GET /session/list` to retrieve only the sessions owned by the authenticated API key. Each item includes its generated ID, optional label, connection method, status, and creation time.

## API Documentation

The complete endpoint reference, request schemas, response examples, and interactive request runner are available at:

```text
http://localhost:3000/api-docs/
```

The documentation page is public, while documented API operations require the `x-api-key` authorization configured through Swagger's **Authorize** button.

## Telegram Commands

| Command | Description |
| --- | --- |
| `/start` | Show the available administration commands. |
| `/generatekey <label>` | Generate a new API key and display it once in full. |
| `/listkeys` | List all API keys with masked values and current status. |
| `/revokekey <keyId>` | Revoke an API key by its numeric ID. |
| `/setlimit <keyId> <requestsPerMinute>` | Set an API key's per-minute request limit. |

## Health and Operations

`GET /health` checks the API and its database connection. Useful PM2 commands include:

```powershell
npx pm2 status
npx pm2 logs whatsapp-gateway
npx pm2 restart whatsapp-gateway
npx pm2 stop whatsapp-gateway
```

Never commit `.env` or the `sessions/` directory. Both are excluded by `.gitignore`.