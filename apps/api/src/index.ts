/**
 * minori API Server
 *
 * Agricultural AI collaboration platform — enabling farmers to record
 * through voice while AI predicts harvest timing and yields.
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import type { webhook } from '@line/bot-sdk';

import { initializeLineClient, handleWebhookEvent } from '@minori/line-bot';

type WebhookEvent = webhook.Event;

// Environment variables
const PORT = process.env.PORT ?? 3000;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET ?? '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';

// Initialize LINE client
if (LINE_CHANNEL_ACCESS_TOKEN) {
  initializeLineClient({
    channelSecret: LINE_CHANNEL_SECRET,
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  });
}

// Create Hono application
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check endpoints
app.get('/', (c) => {
  return c.json({
    name: 'minori',
    version: '0.1.0',
    description: 'Agricultural AI collaboration platform',
    status: 'ok',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// LINE Webhook endpoint
app.post('/webhook', async (c) => {
  // Verify signature header exists
  const signature = c.req.header('x-line-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  try {
    const body = await c.req.text();

    // Verify LINE webhook signature
    const crypto = await import('crypto');
    const hash = crypto
      .createHmac('SHA256', LINE_CHANNEL_SECRET)
      .update(body)
      .digest('base64');

    if (hash !== signature) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Parse webhook events
    const { events } = JSON.parse(body) as { events: WebhookEvent[] };

    // Process events concurrently
    await Promise.all(events.map(handleWebhookEvent));

    return c.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Server startup message
console.log(`
🌾 minori API Server
━━━━━━━━━━━━━━━━━━━━
Port: ${PORT}
Environment: ${process.env.NODE_ENV ?? 'development'}
LINE Bot: ${LINE_CHANNEL_ACCESS_TOKEN ? 'configured' : 'not configured'}
━━━━━━━━━━━━━━━━━━━━
`);

export default {
  port: PORT,
  fetch: app.fetch,
};
