/**
 * Shopify Function: PDF Label Generator
 * 
 * This function is triggered when an order is created via webhook.
 * It:
 * 1. Extracts label configurations from order line items (custom attributes)
 * 2. Generates PDFs (270mm × 60mm total: 260mm text + 10mm order ID) for each label configuration
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
import { getDropboxAccessToken } from './dropbox-auth';

function sanitizePathName(name: string): string {
  // Remove/replace characters that can cause issues in paths
  return name
    .replace(/[\\\/:*?"<>|]/g, '-') // Windows-reserved and common unsafe
    .replace(/[#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// PDF Dimensions (in millimeters)
const PDF_WIDTH_MM = 270; // Total width: 10mm order ID + 5mm padding + 250mm text + 5mm padding
const PDF_HEIGHT_MM = 60; // Changed from 66mm to 60mm
const ORDER_NUMBER_WIDTH_MM = 10; // Left side area for order number
const TEXT_MAX_WIDTH_MM = 250; // Main text area (with 5mm padding on left and right)
const TEXT_MAX_HEIGHT_MM = 54;

// Convert mm to points (1mm = 2.834645669 points)
const MM_TO_PT = 2.834645669;
const PDF_WIDTH_PT = PDF_WIDTH_MM * MM_TO_PT;
const PDF_HEIGHT_PT = PDF_HEIGHT_MM * MM_TO_PT;
const ORDER_NUMBER_WIDTH_PT = ORDER_NUMBER_WIDTH_MM * MM_TO_PT;
const TEXT_WIDTH_PT = TEXT_MAX_WIDTH_MM * MM_TO_PT;
const TEXT_HEIGHT_PT = TEXT_MAX_HEIGHT_MM * MM_TO_PT;

interface LabelConfig {
  text: string;
  fontSizePt: number;
  fontFamily: string;
  color: string;
  quantity: number;
  configId: string;
  orderNumber?: string; // Order number to display on the left side
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
        // Support both new (with underscore) and old (without underscore) attribute names for backward compatibility
        case '_label_text':
        case 'label_text':
          config.text = value;
          break;
        case '_label_font_size_pt':
        case 'label_font_size_pt':
          config.fontSizePt = parseFloat(value) || 156;
          break;
        case '_label_font_family':
        case 'label_font_family':
          config.fontFamily = value;
          break;
        case '_label_color':
        case 'label_color':
          config.color = value;
          break;
        case '_label_config_id':
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
export async function generateLabelPDF(config: LabelConfig, orderNumber?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PDF_WIDTH_PT, PDF_HEIGHT_PT],
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Separator line removed - no visible line between order ID and text area

      // Order number area: left side, 10mm wide
      const orderNumToUse = orderNumber || config.orderNumber || '';
      if (orderNumToUse) {
        // Extract numeric digits from order number (e.g., "1234" from "Order #1234")
        const orderDigits = orderNumToUse.replace(/\D/g, ''); // Remove non-digits
        if (orderDigits) {
          // Draw order number vertically, rotated 90 degrees counterclockwise
          // Numbers should be aligned from bottom to top, rotated to the left
          const orderNumFontSize = 12; // Slightly larger font size in points for order number
          doc.font('Helvetica-Bold').fontSize(orderNumFontSize).fillColor('#000000');
          
          // Center the order number area horizontally (within the 10mm width)
          const orderNumCenterX = ORDER_NUMBER_WIDTH_PT / 2;
          
          // Use consistent fixed spacing between digits (tight, no gaps)
          const digitSpacing = orderNumFontSize * 0.85; // Consistent tight spacing
          
          // Calculate actual digit height for proper spacing calculation
          doc.fontSize(orderNumFontSize);
          const actualDigitHeight = doc.heightOfString('0', { width: orderNumFontSize * 2, lineGap: 0 });
          
          // Calculate for perfect vertical centering with equal margins
          // Total span from center of bottom digit to center of top digit
          const totalSpanBetweenCenters = digitSpacing * (orderDigits.length - 1);
          
          // For equal margins at top and bottom:
          // Bottom margin = distance from PDF bottom to bottom edge of bottom digit
          // Top margin = distance from PDF top to top edge of top digit
          // Bottom digit center Y = startY
          // Top digit center Y = startY + totalSpanBetweenCenters
          // Bottom margin = startY - actualDigitHeight/2 (distance to bottom edge)
          // Top margin = PDF_HEIGHT_PT - (startY + totalSpanBetweenCenters + actualDigitHeight/2)
          // Setting equal: startY - actualDigitHeight/2 = PDF_HEIGHT_PT - startY - totalSpanBetweenCenters - actualDigitHeight/2
          // 2*startY = PDF_HEIGHT_PT - totalSpanBetweenCenters
          // startY = (PDF_HEIGHT_PT - totalSpanBetweenCenters) / 2
          let startY = (PDF_HEIGHT_PT - totalSpanBetweenCenters) / 2;
          
          // No bottom offset - keep it perfectly centered
          
          // Draw each digit from bottom to top, rotated correctly to avoid mirror effect
          // For order "12345678": display as 8(bottom), 7, 6, 5, 4, 3, 2, 1(top)
          // Last digit at lowest Y (bottom), first digit at highest Y (top)
          for (let i = 0; i < orderDigits.length; i++) {
            // Reverse the digit order: last digit goes to bottom
            const digitIndex = orderDigits.length - 1 - i;
            const digit = orderDigits[digitIndex];
            // Position from bottom to top: last digit (digitIndex = last) at startY (bottom), increasing upward
            const y = startY + (i * digitSpacing);
            
            // Save current state, rotate -90 degrees (counterclockwise), center horizontally and vertically
            doc.save()
               .translate(orderNumCenterX, y)
               .rotate(-90, { origin: [0, 0] }) // Rotate -90 degrees counterclockwise (point left)
               .font('Helvetica-Bold')
               .fontSize(orderNumFontSize)
               .fillColor('#000000');
               
            // Calculate actual text dimensions for proper centering
            const textWidth = doc.widthOfString(digit);
            const textHeight = doc.heightOfString(digit, { width: textWidth });
            
            // Center the text after rotation
            doc.text(digit, -textWidth / 2, -textHeight / 2, {
              width: textWidth,
              align: 'center',
            })
            .restore();
          }
        }
      }

      // Text area: 250×54 mm with 5mm padding on left and right
      // Positioned after the 10mm order number area, automatically centered
      const textAreaX = ORDER_NUMBER_WIDTH_PT + ((PDF_WIDTH_PT - ORDER_NUMBER_WIDTH_PT - TEXT_WIDTH_PT) / 2);
      const textAreaY = (PDF_HEIGHT_PT - TEXT_HEIGHT_PT) / 2; // 3mm top padding

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

      // Calculate font size to maximize letter height (54mm) while fitting width (250mm)
      const text = (config.text || '').toUpperCase();
      doc.font(fontToUse).fillColor(config.color || '#000000');

      // Use actual font metrics to get real cap height (visual letter height)
      // Start with font size = 1pt and measure the actual cap height ratio
      doc.fontSize(1);
      const fontMetrics = (doc as any)._font;
      const capHeightAt1pt = fontMetrics.capHeight ? (fontMetrics.capHeight / fontMetrics.unitsPerEm) : 0.7;
      
      // Step 1: Calculate font size needed for 54mm cap height using real font metrics
      const fontSizeFor54mmHeight = TEXT_HEIGHT_PT / capHeightAt1pt;
      
      // Step 2: Check if text width fits within 250mm at this font size
      doc.fontSize(fontSizeFor54mmHeight);
      const textWidthAtMaxHeight = doc.widthOfString(text);
      
      let finalSize;
      if (textWidthAtMaxHeight <= TEXT_WIDTH_PT) {
        // Short text (like "AB"): fits in 250mm width → Use FULL 54mm height!
        finalSize = fontSizeFor54mmHeight;
      } else {
        // Long text (like "ASDFASDFWEF"): exceeds 250mm width → Scale down to fit
        // Calculate reduction factor needed to fit width
        const widthReductionFactor = TEXT_WIDTH_PT / textWidthAtMaxHeight;
        finalSize = fontSizeFor54mmHeight * widthReductionFactor;
      }
      
      // Clamp to reasonable bounds
      finalSize = Math.max(20, Math.min(700, finalSize));
      doc.fontSize(finalSize);
      
      // Calculate actual line height for vertical centering
      const actualHeight = doc.heightOfString(text, { width: TEXT_WIDTH_PT, lineBreak: false });

      // Vertical center using measured height
      const centeredY = textAreaY + (TEXT_HEIGHT_PT - actualHeight) / 2;

      doc.text(text, textAreaX, centeredY, {
        width: TEXT_WIDTH_PT,
        height: TEXT_HEIGHT_PT,
        align: 'center',
        lineBreak: false,
      });

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

  // Extract order number from order
  const orderNumber = order?.name || order?.order_number || order?.orderNumber || '';
  
  const pdfs: Array<{ filename: string; buffer: Buffer }> = [];
  for (const cfg of labelConfigs) {
    const qty = Math.max(1, cfg.quantity || 1);
    for (let i = 1; i <= qty; i++) {
      const buffer = await generateLabelPDF(cfg, orderNumber);
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
  // Get access token - automatically refreshes if using OAuth with refresh token
  const accessToken = await getDropboxAccessToken();
  
  const fetchImpl = (global as any).fetch || (globalThis as any).fetch;
  if (!fetchImpl) throw new Error('Global fetch not available. Use Node 18+ or provide a fetch polyfill.');
  
  // For team folders, add pathRoot if needed
  const pathRoot = process.env.DROPBOX_PATH_ROOT; // e.g., "ns:1234567890"
  const dbx = new Dropbox({ 
    accessToken, 
    fetch: fetchImpl,
    ...(pathRoot && { pathRoot })
  });

  // Try to create folder structure, but ignore errors (assume folders exist)
  try { 
    await dbx.filesCreateFolderV2({ path: folderPath, autorename: false }); 
  } catch (e) {
    // Silently ignore - folder might already exist or we'll create it on upload
    // This prevents 400 errors from stopping the upload
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

    // Extract order number from order
    const orderNumber = order?.name || order?.order_number || order?.orderNumber || '';

    // Generate PDF for each configuration
    const pdfPromises = labelConfigs.map(async (config, index) => {
      // Generate PDF for quantity requested
      const pdfs: Buffer[] = [];
      for (let i = 0; i < config.quantity; i++) {
        const pdf = await generateLabelPDF(config, orderNumber);
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

      const pdfBuffer = await generateLabelPDF(sampleConfig, '1234');
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

