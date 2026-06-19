# Centre Tour Booking (prototype)

Quick prototype for Centre Tour Booking calendar (backend API + simple React frontend).

Run with Docker (recommended):

```bash
docker-compose up --build
```

- Backend: http://localhost:4000 (API at `/api/bookings`)
- Frontend: http://localhost:5173

Notes:
- Backend initializes a `bookings` table on start.
- This is a minimal prototype: notification and AI layers are stubbed.

Notifications:
- Basic notification stubs are implemented in `backend/notifications.js`. Replace with real providers (SMTP, WhatsApp Business API) and add credentials to `backend/.env`.

Notifications (SMTP & WhatsApp):
- Implementation: `backend/notifications.js` supports SMTP via `nodemailer` and WhatsApp via Meta Cloud API or Twilio.

Environment examples (add to `backend/.env`):

SMTP (nodemailer):

```
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-pass
EMAIL_FROM=Centre <no-reply@yourdomain.com>
```

Meta WhatsApp Cloud API (recommended if you have a Business account):

```
WHATSAPP_PROVIDER=meta
WA_META_PHONE_NUMBER_ID=10987654321
WA_META_TOKEN=EAAX...your_token...
```

Twilio WhatsApp (alternative):

```
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+1415XXXXXXX
```

Notes:
- After setting env vars restart the backend service. The code will throw errors if SMTP or WhatsApp are not configured when attempting to send messages — logs will show failures.
- For Meta Cloud API, follow Facebook/Meta docs to obtain `PHONE_NUMBER_ID` and `WHATSAPP_TOKEN`.

AI Summaries:
- An optional AI summarizer is available in `backend/ai.js`. Set `OPENAI_API_KEY` in `backend/.env` to enable OpenAI-based summaries; otherwise the system falls back to a simple rule-based summary.

Admin & Reminders:
- Open the admin UI from the frontend (click "Open Admin") to filter bookings, assign owners, perform bulk actions, and export CSV.
- Scheduled reminders run in the backend process. Configure with environment variables in `backend/.env`:
	- `REMINDER_LOOKAHEAD_HOURS` (default 24)
	- `REMINDER_INTERVAL_MINUTES` (default 15)
