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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Build raw body robustly across environments
  let rawBody: Buffer | null = null;
  if (req.body) {
    if (typeof req.body === 'string') rawBody = Buffer.from(req.body, 'utf8');
    else if (Buffer.isBuffer(req.body)) rawBody = req.body as Buffer;
  }
  if (!rawBody) {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve());
      req.on('error', reject);
    });
    rawBody = Buffer.concat(chunks);
  }

  const secret = (process.env.SHOPIFY_WEBHOOK_SECRET || '').trim();
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  if (!secret || !verifyHmac(rawBody, secret, hmacHeader)) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const order = JSON.parse(rawBody.toString('utf8'));
    const result = await handleOrderPaid(order);
    return res.status(200).json({ ok: true, folderPath: result.folderPath, files: result.files });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Error' });
  }
}


