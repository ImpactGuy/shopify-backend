import express from 'express';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { handleOrderPaid } from './index';

// Express app with raw body to verify HMAC
const app = express();
app.use('/api/order-paid', express.raw({ type: 'application/json' }));

function verifyShopifyHmac(req: Request): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  if (!secret) return false;
  const hmacHeader = req.header('X-Shopify-Hmac-Sha256') || req.header('x-shopify-hmac-sha256');
  if (!hmacHeader) return false;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(req.body as Buffer)
    .digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

app.post('/api/order-paid', async (req: Request, res: Response) => {
  try {
    if (!verifyShopifyHmac(req)) {
      return res.status(401).send('Unauthorized');
    }
    // Parse JSON body from raw buffer
    const order = JSON.parse((req.body as Buffer).toString('utf8'));
    const result = await handleOrderPaid(order);
    return res.status(200).json({ ok: true, folderPath: result.folderPath, files: result.files });
  } catch (err: any) {
    console.error('orders/paid handler error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server listening on port ${port}`);
});


