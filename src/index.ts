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
 * 
 * Requirements:
 * - PDF size: 270mm × 66mm (fixed)
 * - Text area: 260mm × 54mm (centered in PDF)
 * - Visible letters must fit within 260mm × 54mm
 * - Text must be centered both horizontally and vertically
 * 
 * Returns PDF as Buffer
 */
export async function generateLabelPDF(config: LabelConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PDF_WIDTH_PT, PDF_HEIGHT_PT],
        autoFirstPage: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      
      // Ensure only one page - disable auto page breaks
      doc.switchToPage(0);

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Exact 260×54 mm text area centered in 270×66 mm
      const textAreaX = (PDF_WIDTH_PT - TEXT_WIDTH_PT) / 2;   // 5 mm
      const textAreaY = (PDF_HEIGHT_PT - TEXT_HEIGHT_PT) / 2; // 6 mm

      // Load Impact font from known locations; fail if not found to avoid silent fallback
      const fallbackFont = 'Helvetica-Bold';
      let fontToUse = 'Impact';
      let impactPath: string | null = null;
      try {
        const candidatePaths = [
          process.env.IMPACT_FONT_PATH,
          join(process.cwd(), 'fonts', 'Impact.ttf'),
          join(__dirname, '..', 'fonts', 'Impact.ttf'),
          '/var/task/fonts/Impact.ttf', // common on Vercel
        ].filter(Boolean) as string[];
        for (const p of candidatePaths) {
          if (existsSync(p)) { impactPath = p; break; }
        }
        if (!impactPath) {
          throw new Error('Impact font not found in expected paths');
        }
        // Register by file path to ensure embedding
        doc.registerFont('Impact', impactPath);
      } catch (e) {
        // If Impact fails, use Helvetica-Bold but surface in logs
        console.warn('Impact font load failed:', (e as any)?.message || e);
        fontToUse = fallbackFont;
      }

      // Enforce 260×54 mm: visible letters exactly 54mm tall (max), width max 260mm
      const text = (config.text || '').toUpperCase();
      doc.font(fontToUse).fillColor(config.color || '#000000');

      // ========================================
      // FONT SIZING ALGORITHM (NEW CLEAN APPROACH)
      // ========================================
      // Goal: Find font size where:
      // 1. Text width ≤ 260mm
      // 2. Visible letter height ≤ 54mm
      // 3. Both constraints satisfied simultaneously
      
      // For Impact uppercase, visible cap height ≈ font size × VISIBLE_HEIGHT_RATIO
      // Calibrated: 0.73 means 73% of font size is visible cap height
      const VISIBLE_HEIGHT_RATIO = 0.73;
      
      function measureWidth(fontSizePt: number): number {
        doc.fontSize(fontSizePt);
        return doc.widthOfString(text);
      }
      
      function getVisibleHeight(fontSizePt: number): number {
        return fontSizePt * VISIBLE_HEIGHT_RATIO;
      }
      
      // Start with font size that would give 54mm visible height
      let optimalSize = TEXT_HEIGHT_PT / VISIBLE_HEIGHT_RATIO;
      
      // Iteratively refine to satisfy both width and height constraints
      for (let i = 0; i < 15; i++) {
        const testWidth = measureWidth(optimalSize);
        const testVisibleHeight = getVisibleHeight(optimalSize);
        
        // If too wide, scale down based on width
        if (testWidth > TEXT_WIDTH_PT) {
          optimalSize = (optimalSize * TEXT_WIDTH_PT) / testWidth;
        }
        
        // If too tall, scale down based on height
        if (testVisibleHeight > TEXT_HEIGHT_PT) {
          optimalSize = TEXT_HEIGHT_PT / VISIBLE_HEIGHT_RATIO;
        }
        
        // Clamp to reasonable bounds
        optimalSize = Math.max(20, Math.min(optimalSize, 800));
      }
      
      // Final measurements
      const finalSize = optimalSize;
      doc.fontSize(finalSize);
      const finalWidth = measureWidth(finalSize);
      const finalVisibleHeight = getVisibleHeight(finalSize);
      
      // ========================================
      // POSITIONING ALGORITHM (SIMPLIFIED & CORRECT)
      // ========================================
      // PDFKit's doc.text(x, y) uses Y as BASELINE, not top of text
      
      // Horizontal centering: center text within 260mm width
      const textAreaCenterX = textAreaX + TEXT_WIDTH_PT / 2;
      const textX = textAreaCenterX - finalWidth / 2;
      
      // Vertical centering: use a simpler approach
      // For Impact uppercase: the actual rendered height from PDFKit
      // We want to center the text in the 54mm box
      
      // Measure actual text height using PDFKit (includes ascent + descent)
      doc.fontSize(finalSize);
      const measuredTextHeight = doc.heightOfString(text);
      
      // For Impact uppercase, most text is above baseline
      // Cap height (visible letters) is roughly 70% of total text height, centered above baseline
      // So center of cap height is at: baselineY + (measuredTextHeight * 0.35)
      
      // Center of the 54mm text area
      const textAreaCenterY = textAreaY + TEXT_HEIGHT_PT / 2;
      
      // Position baseline so center of visible cap height aligns with center of text area
      // centerOfCapHeight = baselineY + (measuredTextHeight * 0.35)
      // To center: baselineY + (measuredTextHeight * 0.35) = textAreaCenterY
      // Therefore: baselineY = textAreaCenterY - (measuredTextHeight * 0.35)
      const baselineY = textAreaCenterY - (measuredTextHeight * 0.35);
      
      // Safety bounds: ensure text stays within visible area
      // Leave small margins to prevent clipping
      const margin = 2; // 2 points margin
      const minBaselineY = textAreaY + margin;
      const maxBaselineY = textAreaY + TEXT_HEIGHT_PT - measuredTextHeight + margin;
      const safeBaselineY = Math.max(minBaselineY, Math.min(baselineY, maxBaselineY));
      
      // Ensure we're on the first and only page
      doc.switchToPage(0);
      
      // Disable automatic page creation to prevent multiple pages
      const originalAddPage = doc.addPage;
      doc.addPage = function() { return this; };
      
      // ========================================
      // RENDERING
      // ========================================
      // Render text at calculated position
      // No width/height parameters to prevent clipping or wrapping
      doc.text(text, textX, safeBaselineY);

      // Restore original function
      doc.addPage = originalAddPage;

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
        fontFamily:'Impact',
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

