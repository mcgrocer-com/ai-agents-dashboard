/**
 * File Parser Service
 * Uses Google GenAI SDK with File API for enhanced document understanding
 * Supports: PDF (via Gemini File API), TXT, JSON, CSV, XLSX, DOCX
 */

import { GoogleGenAI, createPartFromUri } from '@google/genai';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type { ServiceResponse } from '@/types/blogger';

// Initialize Google GenAI with new SDK
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface ParsedFileResult {
  content: string;
  method: 'gemini-file-api' | 'gemini-inline' | 'text-extraction';
  pageCount?: number;
}

/**
 * Wait for file processing to complete
 * Files go through PROCESSING -> ACTIVE state
 */
async function waitForFileProcessing(fileName: string, maxWaitMs = 60000): Promise<void> {
  const startTime = Date.now();
  const pollIntervalMs = 2000;

  while (Date.now() - startTime < maxWaitMs) {
    const file = await ai.files.get({ name: fileName });

    if (file.state === 'ACTIVE') {
      return; // File is ready
    }

    if (file.state === 'FAILED') {
      throw new Error('File processing failed');
    }

    // Still processing, wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('File processing timeout');
}

/**
 * Parse PDF using Gemini File API
 * Better for larger files with proper status tracking
 */
export async function parsePdfWithGemini(
  file: File
): Promise<ServiceResponse<ParsedFileResult>> {
  try {
    console.log('[Gemini PDF Parser] Uploading file to Gemini...');

    // Upload file using File API (accepts Blob in browser)
    const uploadedFile = await ai.files.upload({
      file: file,
      config: {
        displayName: file.name,
        mimeType: 'application/pdf',
      },
    });

    if (!uploadedFile.name) {
      throw new Error('File upload failed - no file name returned');
    }

    console.log('[Gemini PDF Parser] File uploaded:', uploadedFile.name);
    console.log('[Gemini PDF Parser] Waiting for processing...');

    // Wait for file to be processed
    await waitForFileProcessing(uploadedFile.name);

    console.log('[Gemini PDF Parser] File ready, generating content...');

    // Get the processed file details
    const processedFile = await ai.files.get({ name: uploadedFile.name });

    if (!processedFile.uri || !processedFile.mimeType) {
      throw new Error('Processed file missing URI or MIME type');
    }

    // Generate content using the uploaded file
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        createPartFromUri(processedFile.uri, processedFile.mimeType),
        {
          text: `Extract ALL text content from this PDF document.

Instructions:
- Preserve the document structure (headings, paragraphs, lists)
- Include ALL text from tables in a readable format
- Preserve any numerical data and statistics
- If there are multiple pages, separate them with "--- Page X ---"
- Do NOT summarize - extract the complete text content
- Format tables as key-value pairs or structured text
- Include image captions if present

Return the extracted text content only, no commentary.`,
        },
      ],
    });

    const extractedText = response.text;

    // Clean up - delete the uploaded file
    try {
      await ai.files.delete({ name: uploadedFile.name });
      console.log('[Gemini PDF Parser] Cleaned up uploaded file');
    } catch (deleteError) {
      console.warn('[Gemini PDF Parser] Failed to delete file:', deleteError);
    }

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Failed to extract meaningful content from PDF');
    }

    return {
      success: true,
      data: {
        content: extractedText,
        method: 'gemini-file-api',
      },
      error: null,
    };
  } catch (error) {
    console.error('[Gemini PDF Parser] Error:', error);

    // Fallback to inline data approach for smaller files or if File API fails
    console.log('[Gemini PDF Parser] Attempting inline data fallback...');
    return parsePdfWithInlineData(file);
  }
}

/**
 * Fallback: Parse PDF using inline base64 data
 * Used when File API fails or for smaller files
 */
async function parsePdfWithInlineData(
  file: File
): Promise<ServiceResponse<ParsedFileResult>> {
  try {
    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Data,
          },
        },
        {
          text: `Extract ALL text content from this PDF document.

Instructions:
- Preserve the document structure (headings, paragraphs, lists)
- Include ALL text from tables in a readable format
- Preserve any numerical data and statistics
- If there are multiple pages, separate them with "--- Page X ---"
- Do NOT summarize - extract the complete text content
- Format tables as key-value pairs or structured text
- Include image captions if present

Return the extracted text content only, no commentary.`,
        },
      ],
    });

    const extractedText = response.text;

    if (!extractedText || extractedText.length < 10) {
      throw new Error('Failed to extract meaningful content from PDF');
    }

    return {
      success: true,
      data: {
        content: extractedText,
        method: 'gemini-inline',
      },
      error: null,
    };
  } catch (error) {
    console.error('[Gemini PDF Parser] Inline fallback error:', error);
    return {
      success: false,
      data: null,
      error:
        error instanceof Error ? error : new Error('Failed to parse PDF with Gemini'),
    };
  }
}

/**
 * Parse TXT file
 */
export async function parseTxtFile(file: File): Promise<string> {
  return await file.text();
}

/**
 * Parse JSON file with pretty formatting
 */
export async function parseJsonFile(file: File): Promise<string> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return JSON.stringify(parsed, null, 2);
}

/**
 * Parse CSV file to readable text format
 */
export async function parseCsvFile(file: File): Promise<string> {
  const text = await file.text();
  const lines = text.split('\n').filter((line) => line.trim());

  if (lines.length === 0) return '';

  const result: string[] = [];
  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^["']|["']$/g, ''));

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(',')
      .map((v) => v.trim().replace(/^["']|["']$/g, ''));
    const row: string[] = [];

    headers.forEach((header, j) => {
      if (values[j]) {
        row.push(`${header}: ${values[j]}`);
      }
    });

    if (row.length > 0) {
      result.push(row.join('\n'));
    }
  }

  return result.join('\n\n---\n\n');
}

/**
 * Parse XLSX file to readable text format
 */
export async function parseXlsxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const result: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (data.length === 0) continue;

    result.push(`## Sheet: ${sheetName}\n`);

    const headers = data[0] as string[];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const rowData: string[] = [];
      headers.forEach((header, j) => {
        if (row[j] !== undefined && row[j] !== null && row[j] !== '') {
          rowData.push(`${header}: ${row[j]}`);
        }
      });

      if (rowData.length > 0) {
        result.push(rowData.join('\n'));
        result.push('---');
      }
    }
  }

  return result.join('\n');
}

/**
 * Parse DOCX file using mammoth library
 * Extracts text content while preserving structure
 */
export async function parseDocxFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  if (result.messages && result.messages.length > 0) {
    console.warn('[DOCX Parser] Warnings:', result.messages);
  }

  return result.value || '';
}

/**
 * Universal file parser - uses best method for each file type
 * PDFs use Gemini File API for enhanced understanding
 */
export async function parseFileWithAI(
  file: File,
  fileType: 'txt' | 'json' | 'csv' | 'xlsx' | 'pdf' | 'docx'
): Promise<ServiceResponse<ParsedFileResult>> {
  try {
    let content: string;
    let method: 'gemini-file-api' | 'gemini-inline' | 'text-extraction' =
      'text-extraction';

    switch (fileType) {
      case 'pdf':
        // Use Gemini File API for PDF - better understanding of complex documents
        const pdfResult = await parsePdfWithGemini(file);
        if (pdfResult.success && pdfResult.data) {
          return pdfResult;
        }
        // If Gemini fails, we'll throw and let the caller handle fallback
        throw new Error(pdfResult.error?.message || 'Gemini PDF parsing failed');

      case 'txt':
        content = await parseTxtFile(file);
        break;

      case 'json':
        content = await parseJsonFile(file);
        break;

      case 'csv':
        content = await parseCsvFile(file);
        break;

      case 'xlsx':
        content = await parseXlsxFile(file);
        break;

      case 'docx':
        content = await parseDocxFile(file);
        break;

      default:
        throw new Error('Unsupported file type');
    }

    return {
      success: true,
      data: {
        content,
        method,
      },
      error: null,
    };
  } catch (error) {
    console.error('[File Parser] Error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error : new Error('Failed to parse file'),
    };
  }
}
