# API Documentation

> minori API Server Reference

## Base URL

```
Development: http://localhost:3000
Staging: https://staging.minori.example.com
Production: https://api.minori.example.com
```

## Endpoints

### Health Check

#### GET /

Returns basic server information.

**Response**

```json
{
  "name": "minori",
  "version": "0.1.0",
  "description": "Agricultural AI collaboration platform",
  "status": "ok"
}
```

#### GET /health

Simple health check endpoint.

**Response**

```json
{
  "status": "ok"
}
```

---

### LINE Webhook

#### POST /webhook

Receives webhook events from LINE Messaging API.

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `x-line-signature` | Yes | HMAC-SHA256 signature for request validation |
| `Content-Type` | Yes | Must be `application/json` |

**Request Body**

LINE webhook event payload. See [LINE Webhook Event Objects](https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects).

```json
{
  "destination": "U1234567890abcdef",
  "events": [
    {
      "type": "message",
      "replyToken": "reply-token",
      "source": {
        "userId": "U1234567890abcdef",
        "type": "user"
      },
      "message": {
        "type": "text",
        "id": "123456789",
        "text": "今天種了兩分地的小白菜"
      }
    }
  ]
}
```

**Response**

Success:
```json
{
  "success": true
}
```

Error (missing signature):
```json
{
  "error": "Missing signature"
}
```

Error (invalid signature):
```json
{
  "error": "Invalid signature"
}
```

---

## Supported Message Types

### Text Messages

Users can send natural language text to record farming activities or query information.

**Supported Intents**

| Intent | Example | Description |
|--------|---------|-------------|
| `record_planting` | "種了兩分地的小白菜" | Record a new planting |
| `record_harvest` | "空心菜收了50公斤" | Record a harvest |
| `query_crops` | "我現在種了什麼" | Query current plantings |
| `query_forecast` | "下週有什麼可以收" | Query harvest forecast |
| `query_price` | "小白菜現在什麼價" | Query market prices |
| `help` | "怎麼用" | Show help message |

### Audio Messages

Voice messages are transcribed using OpenAI Whisper and processed as text.

- Supports Mandarin Chinese
- Supports Taiwanese (Hokkien) dialect
- Agriculture-specific vocabulary enhanced

### Image Messages

Photo messages will be processed for crop identification (coming soon).

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes**

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (missing required fields) |
| 401 | Unauthorized (invalid signature) |
| 500 | Internal Server Error |

---

## Environment Variables

Required environment variables for the API server:

```bash
# Server
PORT=3000

# LINE Bot
LINE_CHANNEL_SECRET=your-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token

# OpenAI
OPENAI_API_KEY=your-openai-api-key
```

---

## Rate Limits

The API follows LINE Messaging API rate limits:

- Reply messages: No limit (using reply tokens)
- Push messages: Varies by plan (see [LINE Pricing](https://www.linebiz.com/tw/service/line-official-account/plan/))

---

## Webhook Security

All webhook requests are validated using HMAC-SHA256:

1. LINE signs the request body with the channel secret
2. The signature is included in `x-line-signature` header
3. Server validates by computing its own signature and comparing

```typescript
const crypto = require('crypto');

function validateSignature(body: string, signature: string, secret: string): boolean {
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}
```
