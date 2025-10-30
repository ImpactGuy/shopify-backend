/**
 * Shopify Function: PDF Label Generator
 * 
 * This function is triggered when an order is created via webhook.
 * It:
 * 1. Extracts label configurations from order line items (custom attributes)
 * 2. Generates PDFs (270mm × 66mm) for each label configuration
 * 3. Stores PDFs in Shopify Files API
 * 4. Forwards PDFs to production system
 * 
 * Setup Instructions:
 * 1. Install Shopify CLI: npm install -g @shopify/cli @shopify/theme
 * 2. Run: shopify app generate function
 * 3. Or deploy this as a webhook handler in your Shopify app backend
 */

import PDFDocument from 'pdfkit';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Dropbox } from 'dropbox';

function sanitizePathName(name: string): string {
  // Remove/replace characters that can cause issues in paths
  return name
    .replace(/[\\\/:*?"<>|]/g, '-') // Windows-reserved and common unsafe
    .replace(/[#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// PDF Dimensions (in millimeters)
const PDF_WIDTH_MM = 270;
const PDF_HEIGHT_MM = 66;
const TEXT_MAX_WIDTH_MM = 260;
const TEXT_MAX_HEIGHT_MM = 54;

// Convert mm to points (1mm = 2.834645669 points)
const MM_TO_PT = 2.834645669;
const PDF_WIDTH_PT = PDF_WIDTH_MM * MM_TO_PT;
const PDF_HEIGHT_PT = PDF_HEIGHT_MM * MM_TO_PT;
const TEXT_WIDTH_PT = TEXT_MAX_WIDTH_MM * MM_TO_PT;
const TEXT_HEIGHT_PT = TEXT_MAX_HEIGHT_MM * MM_TO_PT;

interface LabelConfig {
  text: string;
  fontSizePt: number;
  fontFamily: string;
  color: string;
  quantity: number;
  configId: string;
}

/**
 * Extract label configurations from Shopify order line items
 * Label configs are stored in customAttributes of line items
 */
export function extractLabelConfigs(order: any): LabelConfig[] {
  const configs: LabelConfig[] = [];

  const rawLineItems = order?.lineItems || order?.line_items;
  if (!rawLineItems) {
    return configs;
  }

  for (const lineItem of rawLineItems) {
    // customAttributes (GraphQL) or properties (REST)
    const attributes = lineItem.customAttributes || lineItem.properties || [];
    const config: Partial<LabelConfig> = {
      quantity: lineItem.quantity || 1,
    };

    for (const attr of attributes) {
      const key = attr.key || attr.name;
      const value = attr.value;
      switch (key) {
        case 'label_text':
          config.text = value;
          break;
        case 'label_font_size_pt':
          config.fontSizePt = parseFloat(value) || 156;
          break;
        case 'label_font_family':
          config.fontFamily = value;
          break;
        case 'label_color':
          config.color = value;
          break;
        case 'label_config_id':
          config.configId = value;
          break;
      }
    }

    // Only add if we have text (required)
    if (config.text) {
      configs.push(config as LabelConfig);
    }
  }

  return configs;
}

/**
 * Generate PDF for a single label configuration
 * Returns PDF as Buffer
 */
export async function generateLabelPDF(config: LabelConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PDF_WIDTH_PT, PDF_HEIGHT_PT],
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Margins (5mm sides, 6mm top/bottom)
      const marginLeft = 5 * MM_TO_PT;
      const marginTop = 6 * MM_TO_PT;

      // Center text within text area (260×54mm)
      const textX = marginLeft;
      const textY = marginTop + (PDF_HEIGHT_PT - TEXT_HEIGHT_PT - marginTop * 2) / 2;

      // Try to use Impact font if available
      const fallbackFont = 'Helvetica-Bold';
      let fontToUse = fallbackFont;
      try {
        const envPath = process.env.IMPACT_FONT_PATH;
        let foundPath: string | null = null;
        if (envPath && existsSync(envPath)) {
          foundPath = envPath;
        } else {
          const candidate = join(__dirname, '..', '..', 'Impact', 'Impact.ttf');
          if (existsSync(candidate)) foundPath = candidate;
        }
        if (foundPath) {
          doc.registerFont('Impact', readFileSync(foundPath));
          fontToUse = 'Impact';
        }
      } catch {}

      // Set font and size
      const fontSize = Math.max(40, Math.min(700, config.fontSizePt));

      doc.font(fontToUse)
         .fontSize(fontSize)
         .fillColor(config.color || '#000000')
         .text(
           config.text.toUpperCase(),
           textX,
           textY,
           {
             width: TEXT_WIDTH_PT,
             height: TEXT_HEIGHT_PT,
             align: 'center',
             valign: 'center',
           }
         );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Handle orders/paid webhook: generate PDFs and upload to Dropbox
 */
export async function handleOrderPaid(order: any): Promise<{ folderPath: string; files: string[] }> {
  const rawOrderName: string = order?.name || `Order-${order?.id || 'unknown'}`;
  const orderName = sanitizePathName(rawOrderName);
  const createdAt: string = order?.created_at || order?.createdAt || new Date().toISOString();
  const date = createdAt.slice(0, 10); // YYYY-MM-DD
  const root = process.env.DROPBOX_ROOT_PATH || '/Labels';
  const folderPath = `${root}/${date}/${orderName}`;

  const labelConfigs = extractLabelConfigs(order);
  if (labelConfigs.length === 0) {
    return { folderPath, files: [] };
  }

  const pdfs: Array<{ filename: string; buffer: Buffer }> = [];
  for (const cfg of labelConfigs) {
    const qty = Math.max(1, cfg.quantity || 1);
    for (let i = 1; i <= qty; i++) {
      const buffer = await generateLabelPDF(cfg);
      const filename = `label-${cfg.configId || 'cfg'}-${i}.pdf`;
      pdfs.push({ filename, buffer });
    }
  }

  try {
    const files = await uploadPDFsToDropbox(folderPath, pdfs);
    return { folderPath, files };
  } catch (e: any) {
    // Surface Dropbox errors with more context
    const message = e?.error?.error_summary || e?.message || 'Dropbox upload failed';
    console.error('Dropbox upload error:', message);
    throw new Error(message);
  }
}

/** Upload PDFs to Dropbox under folderPath */
export async function uploadPDFsToDropbox(
  folderPath: string,
  pdfs: Array<{ filename: string; buffer: Buffer }>
): Promise<string[]> {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  if (!accessToken) throw new Error('DROPBOX_ACCESS_TOKEN not set');
  const fetchImpl = (global as any).fetch || (globalThis as any).fetch;
  if (!fetchImpl) throw new Error('Global fetch not available. Use Node 18+ or provide a fetch polyfill.');
  const dbx = new Dropbox({ accessToken, fetch: fetchImpl });

  try { await dbx.filesCreateFolderV2({ path: folderPath, autorename: false }); } catch (e) {
    // Ignore if folder exists; log other errors
    const err: any = e;
    if (!(err?.error?.error_summary || '').includes('path/conflict/folder/')) {
      console.warn('Dropbox create folder warning:', err?.error?.error_summary || err?.message || err);
    }
  }

  const uploaded: string[] = [];
  for (const f of pdfs) {
    const path = `${folderPath}/${f.filename}`;
    await dbx.filesUpload({ path, contents: f.buffer, mode: { '.tag': 'add' } as any });
    uploaded.push(path);
  }
  return uploaded;
}

/**
 * Main handler for order webhook
 * This will be called by Shopify when an order is created
 */
export async function handleOrderCreated(order: any): Promise<void> {
  try {
    // Extract label configurations from order
    const labelConfigs = extractLabelConfigs(order);

    if (labelConfigs.length === 0) {
      console.log('No label configurations found in order');
      return;
    }

    console.log(`Found ${labelConfigs.length} label configuration(s)`);

    // Generate PDF for each configuration
    const pdfPromises = labelConfigs.map(async (config, index) => {
      // Generate PDF for quantity requested
      const pdfs: Buffer[] = [];
      for (let i = 0; i < config.quantity; i++) {
        const pdf = await generateLabelPDF(config);
        pdfs.push(pdf);
      }
      return { config, pdfs };
    });

    const generatedPDFs = await Promise.all(pdfPromises);

    // Upload PDFs to Shopify Files API
    // TODO: Implement Shopify Files API upload
    // const fileUrls = await uploadPDFsToShopify(generatedPDFs);

    // Forward PDFs to production system
    // TODO: Implement forwarding (email/webhook/API)
    // await forwardPDFsToProduction(generatedPDFs, order);

    console.log('PDFs generated successfully');
    // Log order ID for tracking
    console.log(`Order ID: ${order.id}`);

  } catch (error) {
    console.error('Error processing order:', error);
    throw error;
  }
}

/**
 * Upload PDFs to Shopify Files API
 * TODO: Implement using Shopify Admin API
 */
async function uploadPDFsToShopify(pdfs: any[]): Promise<string[]> {
  // Implementation needed:
  // 1. Use Shopify Admin API to upload files
  // 2. Store file URLs in order metafields
  // 3. Return array of file URLs
  return [];
}

/**
 * Forward PDFs to production system
 * TODO: Implement forwarding mechanism
 */
async function forwardPDFsToProduction(pdfs: any[], order: any): Promise<void> {
  // Implementation options:
  // 1. Email with PDF attachments
  // 2. Webhook to production system
  // 3. FTP upload
  // 4. API call to production endpoint
}

// If run directly (npm run start), generate a sample label PDF for quick verification
if (require.main === module) {
  (async () => {
    try {
      const sampleConfig: LabelConfig = {
        text: 'Sample Label',
        fontSizePt: 156,
        fontFamily: 'Helvetica-Bold',
        color: '#000000',
        quantity: 1,
        configId: 'demo',
      };

      const pdfBuffer = await generateLabelPDF(sampleConfig);
      const outDir = join(process.cwd(), 'dist');
      try { mkdirSync(outDir, { recursive: true }); } catch {}
      const outPath = join(outDir, 'sample-label.pdf');
      writeFileSync(outPath, pdfBuffer);
      console.log(`Generated sample PDF at: ${outPath}`);
    } catch (error) {
      console.error('Failed to generate sample PDF:', error);
      process.exit(1);
    }
  })();
}

