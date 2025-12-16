/**
 * PDF Report Generator - PeakInfer TDD v1.3
 * 
 * Generates PDF reports from analysis results using Puppeteer.
 * Falls back to HTML-based output if Puppeteer is unavailable.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ScanResult, StackMap, PricingSummary, TechStack, InferencePatterns } from './types.js';
import { generateHTMLReport } from './html-renderer.js';

// =============================================================================
// PUPPETEER PDF GENERATION
// =============================================================================

/**
 * Generate a real PDF report using Puppeteer.
 * Returns the path to the generated PDF file, or null on failure.
 */
export async function generatePDFWithPuppeteer(
  htmlContent: string,
  outputPath: string,
  options: {
    format?: 'A4' | 'Letter';
    margin?: { top: string; right: string; bottom: string; left: string };
    printBackground?: boolean;
  } = {}
): Promise<string | null> {
  try {
    // Dynamic import to handle cases where puppeteer isn't installed
    const puppeteer = await import('puppeteer');
    
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    try {
      const page = await browser.newPage();
      
      // Set content with base URL for relative resources
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
      });
      
      // Generate PDF
      await page.pdf({
        path: outputPath,
        format: options.format || 'A4',
        margin: options.margin || {
          top: '1cm',
          right: '1cm',
          bottom: '1.5cm',
          left: '1cm',
        },
        printBackground: options.printBackground ?? true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size: 9px; width: 100%; text-align: center; color: #666; padding: 5px 0;">
            PeakInfer Report | Page <span class="pageNumber"></span> of <span class="totalPages"></span> | Generated ${new Date().toISOString().split('T')[0]}
          </div>
        `,
      });
      
      return outputPath;
    } finally {
      await browser.close();
    }
  } catch (error) {
    // Puppeteer not available or failed
    console.error('PDF generation failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// =============================================================================
// HTML-BASED PDF (Fallback)
// =============================================================================

/**
 * Generate print-optimized HTML as fallback when Puppeteer isn't available.
 */
export function generatePDFReport(
  scan: ScanResult,
  stackMap: StackMap,
  pricing: PricingSummary,
  techStack?: TechStack,
  patterns?: InferencePatterns,
  projectName?: string
): string {
  // Generate HTML with print-optimized styles
  const htmlContent = generateHTMLReport(scan, stackMap, pricing, techStack);
  
  // Add print-specific styles and metadata
  const printOptimizedHTML = addPrintStyles(htmlContent, projectName);
  
  return printOptimizedHTML;
}

/**
 * Add print-specific styles to HTML for PDF generation
 */
function addPrintStyles(html: string, projectName?: string): string {
  const printStyles = `
    <style type="text/css">
      @media print {
        @page {
          size: A4;
          margin: 1cm;
        }
        
        body {
          font-size: 11pt;
          line-height: 1.4;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* Ensure tables don't break across pages */
        table {
          page-break-inside: avoid;
        }
        
        /* Keep sections together */
        .section {
          page-break-inside: avoid;
        }
        
        /* Avoid page breaks after headings */
        h1, h2, h3 {
          page-break-after: avoid;
        }
        
        /* Hide interactive elements in print */
        .no-print, button, .interactive {
          display: none !important;
        }
        
        /* Ensure proper colors */
        .badge, .tag {
          border: 1px solid #333;
        }
      }
      
      /* Footer for PDF */
      .print-footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #eee;
        text-align: center;
        font-size: 10px;
        color: #666;
      }
    </style>
  `;
  
  const printFooter = `
    <div class="print-footer">
      PeakInfer Report${projectName ? ` - ${projectName}` : ''} | Generated ${new Date().toISOString().split('T')[0]} | https://github.com/kalmantic/peakinfer
    </div>
  `;
  
  // Insert print styles before closing </head> and footer before closing </body>
  let result = html.replace('</head>', `${printStyles}\n</head>`);
  result = result.replace('</body>', `${printFooter}\n</body>`);
  
  return result;
}

// =============================================================================
// MAIN EXPORT FUNCTION
// =============================================================================

/**
 * Write PDF report to file.
 * Attempts Puppeteer first, falls back to HTML if unavailable.
 * Returns the path to the generated file.
 */
export async function writePDFReport(
  outputDir: string,
  scan: ScanResult,
  stackMap: StackMap,
  pricing: PricingSummary,
  techStack?: TechStack,
  patterns?: InferencePatterns
): Promise<string | null> {
  try {
    // Determine project name from scan root
    const projectName = path.basename(scan.root) || 'peakinfer';
    
    // Generate HTML content
    const htmlContent = generatePDFReport(scan, stackMap, pricing, techStack, patterns, projectName);
    
    // Try Puppeteer first
    const pdfFileName = `${projectName}_peakinfer_report.pdf`;
    const pdfPath = path.join(outputDir, pdfFileName);
    
    const pdfResult = await generatePDFWithPuppeteer(htmlContent, pdfPath);
    
    if (pdfResult) {
      return pdfResult;
    }
    
    // Fallback: Write HTML file with instructions
    console.log('Note: Puppeteer not available, generating HTML for manual PDF conversion');
    
    const htmlFileName = `${projectName}_peakinfer_report.html`;
    const htmlPath = path.join(outputDir, htmlFileName);
    
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    
    // Write instructions for manual conversion
    const instructionsPath = path.join(outputDir, 'PDF_INSTRUCTIONS.md');
    const instructions = `# PDF Generation Instructions

The file \`${htmlFileName}\` has been generated with print-optimized styling.

## Option 1: Browser (Easiest)
1. Open \`${htmlFileName}\` in Chrome, Firefox, or Safari
2. Press **Ctrl+P** (Windows/Linux) or **Cmd+P** (Mac)
3. Select "Save as PDF" as the destination
4. Click Save

## Option 2: Command Line
If you have wkhtmltopdf installed:
\`\`\`bash
wkhtmltopdf ${htmlFileName} ${projectName}_peakinfer_report.pdf
\`\`\`

## Option 3: Install Puppeteer
For automatic PDF generation, install puppeteer:
\`\`\`bash
npm install puppeteer
\`\`\`

Then run PeakInfer again with \`--pdf\`.

---
Generated by PeakInfer v1.3
`;
    
    fs.writeFileSync(instructionsPath, instructions, 'utf-8');
    
    return htmlPath;
  } catch (error) {
    console.error('Failed to generate PDF report:', error);
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { addPrintStyles };
