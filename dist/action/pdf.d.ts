/**
 * PDF Generation Module
 * Converts HTML reports to well-formatted PDFs using Puppeteer
 *
 * Julie Zhou Design Principles:
 * - "Reports exist to enable sharing, not exploration"
 * - PDFs should be print-ready and professional
 */
export interface PDFOptions {
    format?: 'A4' | 'Letter';
    margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
    printBackground?: boolean;
}
/**
 * Generate a PDF from HTML content
 * @param htmlContent - The HTML string to convert
 * @param outputPath - Where to save the PDF
 * @param options - PDF formatting options
 */
export declare function generatePDF(htmlContent: string, outputPath: string, options?: PDFOptions): Promise<void>;
