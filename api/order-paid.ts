import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { handleOrderPaid } from '../src/index';

function verifyHmac(rawBody: Buffer, secret: string, hmacHeader?: string | string[]): boolean {
  if (!hmacHeader) return false;
  const header = Array.isArray(hmacHeader) ? hmacHeader[0] : hmacHeader;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(header));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Collect raw body for HMAC verification
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    (req as any).on('data', (chunk: Buffer) => chunks.push(chunk));
    (req as any).on('end', () => resolve());
    (req as any).on('error', reject);
  });
  const rawBody = Buffer.concat(chunks);

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!secret || !verifyHmac(rawBody, secret, hmacHeader)) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const order = JSON.parse(rawBody.toString('utf8'));
    const result = await handleOrderPaid(order);
    return res.status(200).json({ ok: true, folderPath: result.folderPath, files: result.files });
  } catch (err: any) {
    console.error('orders/paid error', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Error' });
  }
}


