# WhatsApp Webhook Setup Guide

## Overview

The webhook endpoint receives two types of events from Meta:
- **Incoming messages** from customers (any WhatsApp message)
- **Delivery status updates** (`sent → delivered → read` for our outgoing messages)

Both are automatically saved to the `WhatsAppMessage` DB table and visible in the **Admin → WhatsApp Inbox**.

---

## 1. Prerequisites

Before registering the webhook, make sure these are working:
- [ ] WhatsApp Business Account verified in Meta Business Manager
- [ ] WhatsApp phone number added and confirmed in Meta Developer Console
- [ ] `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` set in `.env`
- [ ] App deployed to a **public HTTPS URL** (webhooks cannot point to localhost)

---

## 2. Set the Verify Token

In your `.env` file (already added):
```
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secret_webhook_token_here
```

**Important:** Change this to a long random string. It's used to prove you own the endpoint.
Example: `WHATSAPP_WEBHOOK_VERIFY_TOKEN=valessio_wa_wh_2025_abc123xyz`

---

## 3. Register Webhook in Meta Developer Console

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Select your App → **WhatsApp** → **Configuration** → **Webhook**
3. Click **Edit** next to Webhook
4. Set the following:
   - **Callback URL:** `https://your-domain.com/api/webhooks/whatsapp`
   - **Verify Token:** (paste value from `.env` above)
5. Click **Verify and Save**
   - Meta sends a `GET` request to verify — our endpoint returns the challenge automatically
6. After verification, under **Webhook fields**, click **Manage** and subscribe to: **`messages`**

---

## 4. Test the Webhook

### Verify Meta can reach the endpoint:
```bash
# Meta will GET this URL — it should return the challenge string
curl "https://your-domain.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
# Should respond: test123
```

### Send a test message:
Send any WhatsApp message from a registered test number to your business number.
It should appear in **Admin → WhatsApp → Inbox** within seconds.

---

## 5. Environment Variables Reference

| Variable | Description | Where to get |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Permanent or System User token | Meta Developer Console → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID (not the number itself) | Meta Developer Console → WhatsApp → API Setup |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Secret token you choose | You set this |
| `WHATSAPP_TEMPLATE_LANG` | Default language code for templates | e.g. `en` or `en_US` |
| `WHATSAPP_BOOKING_TEMPLATE_NAME` | Booking confirmation template name | Must match Meta Template Library |
| `WHATSAPP_INVOICE_TEMPLATE_NAME` | Invoice template name | Must match Meta Template Library |

---

## 6. Production Token (Long-Lived)

The default test token expires in 24h. For production:

1. In Meta Business Manager → **System Users** → Add a system user with admin role
2. Generate a **System User Access Token** with `whatsapp_business_messaging` permission
3. This token does **not expire** unless revoked

---

## 7. Webhook Payload Reference

### Incoming text message
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "contacts": [{ "profile": { "name": "Customer Name" }, "wa_id": "919876543210" }],
        "messages": [{
          "from": "919876543210",
          "id": "wamid.xxx",
          "type": "text",
          "text": { "body": "Hi, is 3pm available?" }
        }]
      }
    }]
  }]
}
```

### Delivery status update
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "statuses": [{
          "id": "wamid.xxx",
          "status": "delivered",
          "recipient_id": "919876543210"
        }]
      }
    }]
  }]
}
```

---

## 8. What Gets Saved Automatically

| Trigger | senderType | direction | How |
|---|---|---|---|
| Customer sends WhatsApp message | `user` | `inbound` | Webhook POST |
| Admin sends from WhatsApp Inbox | `agent` | `outbound` | Admin UI → `/api/admin/whatsapp/conversations/[id]/send` |
| CRM bulk send (template or text) | `system` | `outbound` | `/api/admin/crm/send` |
| Post-payment invoice (auto) | `system` | `outbound` | `recordSystemMessage()` in payment callback |
| Manual invoice resend (admin) | `system` | `outbound` | `recordSystemMessage()` in send-invoice-whatsapp route |

---

## 9. Troubleshooting

**Webhook verification fails:**
- Check `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches exactly (no spaces)
- Make sure the app is deployed and HTTPS is working

**Messages not appearing in inbox:**
- Check server logs for `[WhatsApp Webhook]` errors
- Verify the `messages` field is subscribed in Meta Console
- Test phone number must be added in Meta Console (dev mode restriction)

**Error 131030 (recipient not in allowed list):**
- In Development mode, you can only message numbers added at: Meta Developer Console → WhatsApp → API Setup → "To" field → Manage phone number list

**Delivery status not updating:**
- The `wamid` is captured only for messages sent via `sendChatText` / `sendChatTemplate`
- Messages sent via legacy `whatsapp-cloud.ts` functions (recorded with `recordSystemMessage`) won't have `wamid` — status stays as `sent`

---

## 10. Ngrok for Local Testing (Optional)

To test webhooks locally during development:

```bash
# Install ngrok: https://ngrok.com
ngrok http 3001

# Use the https URL from ngrok as your webhook URL in Meta Console
# e.g. https://abc123.ngrok.io/api/webhooks/whatsapp
```

Note: You'll need to re-register the webhook URL each time ngrok restarts (the URL changes).
