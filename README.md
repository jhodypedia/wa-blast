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

2. Create the database and apply the migrations in order:

   ```sql
   CREATE DATABASE whatsapp_gateway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE whatsapp_gateway;
   SOURCE migrations/001_initial_schema.sql;
   SOURCE migrations/002_add_pairing_code_sessions.sql;
   SOURCE migrations/003_add_session_label.sql;
   ```

   From PowerShell, the migration can instead be piped to the MySQL client:

   ```powershell
   Get-Content migrations/001_initial_schema.sql, migrations/002_add_pairing_code_sessions.sql, migrations/003_add_session_label.sql | mysql -u root -p whatsapp_gateway
   ```

   To apply an individual migration through the application's configured database connection:

   ```powershell
   node config/run-migration.js migrations/003_add_session_label.sql
   ```

3. Copy `.env.example` to `.env` and enter the deployment values:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Verify database access:

   ```powershell
   npm run db:check
   ```

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
4. Store the returned key immediately. Later key listings mask it and do not reveal it in full again.
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
2. Optionally include `customCode`, exactly eight characters. If omitted, the gateway generates a code. The response includes the generated `sessionId`.
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