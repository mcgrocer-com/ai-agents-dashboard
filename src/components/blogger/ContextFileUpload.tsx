/**
 * ContextFileUpload Component
 * File upload for importing context files to be used by the AI agent
 * Supports: TXT, JSON, CSV, XLSX, PDF, DOCX (with Gemini AI-powered understanding)
 */

import { useState, useRef } from 'react';
import { Upload, X, FileText, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { parsePdfWithGemini, parseDocxFile } from '@/services/blogger/file-parser.service';
import type { ContextFile, ContextFileType } from '@/types/blogger';

// Set up the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface ContextFileUploadProps {
  contextFile: ContextFile | null;
  onFileChange: (file: ContextFile | null) => void;
  isLoading?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function ContextFileUpload({
  contextFile,
  onFileChange,
  isLoading = false,
}: ContextFileUploadProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseMethod, setParseMethod] = useState<'gemini-vision' | 'text-extraction' | null>(null);
  const [parsingStatus, setParsingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileType = (file: File): ContextFileType | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt') return 'txt';
    if (ext === 'json') return 'json';
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    return null;
  };

  const parseTxt = async (file: File): Promise<string> => {
    return await file.text();
  };

  const parseJson = async (file: File): Promise<string> => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  };

  const parseCsv = async (file: File): Promise<string> => {
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length === 0) return '';

    // Convert CSV to readable text format
    const result: string[] = [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
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
  };

  const parseXlsx = async (file: File): Promise<string> => {
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
  };

  /**
   * Fallback PDF parser using pdfjs-dist (text extraction only)
   */
  const parsePdfFallback = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      if (pageText.trim()) {
        textParts.push(`--- Page ${i} ---\n${pageText}`);
      }
    }

    return textParts.join('\n\n');
  };

  /**
   * Parse PDF using Gemini AI for enhanced document understanding
   * Falls back to pdfjs-dist if Gemini fails
   */
  const parsePdf = async (file: File): Promise<{ content: string; method: 'gemini-vision' | 'text-extraction' }> => {
    // Try Gemini first for better document understanding
    setParsingStatus('Using AI to understand document...');

    const geminiResult = await parsePdfWithGemini(file);

    if (geminiResult.success && geminiResult.data) {
      return {
        content: geminiResult.data.content,
        method: 'gemini-vision',
      };
    }

    // Fallback to pdfjs-dist
    console.log('[PDF Parser] Gemini failed, falling back to pdfjs-dist');
    setParsingStatus('Extracting text...');

    const fallbackContent = await parsePdfFallback(file);
    return {
      content: fallbackContent,
      method: 'text-extraction',
    };
  };

  const handleFileSelect = async (file: File) => {
    setParseError(null);
    setIsParsing(true);
    setParsingStatus('Reading file...');
    setParseMethod(null);

    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      }

      // Get file type
      const fileType = getFileType(file);
      if (!fileType) {
        throw new Error('Unsupported file format. Please use .txt, .json, .csv, .xlsx, .pdf, or .docx');
      }

      // Parse file content
      let content: string;
      let method: 'gemini-vision' | 'text-extraction' | null = null;

      switch (fileType) {
        case 'txt':
          content = await parseTxt(file);
          break;
        case 'json':
          content = await parseJson(file);
          break;
        case 'csv':
          content = await parseCsv(file);
          break;
        case 'xlsx':
          content = await parseXlsx(file);
          break;
        case 'pdf': {
          const pdfResult = await parsePdf(file);
          content = pdfResult.content;
          method = pdfResult.method;
          setParseMethod(method);
          break;
        }
        case 'docx':
          content = await parseDocxFile(file);
          break;
        default:
          throw new Error('Unsupported file type');
      }

      if (!content.trim()) {
        throw new Error('File is empty or could not be parsed');
      }

      // Create context file object
      const contextFile: ContextFile = {
        name: file.name,
        type: fileType,
        size: file.size,
        content,
        uploadedAt: Date.now(),
      };

      onFileChange(contextFile);
    } catch (error) {
      console.error('Error parsing file:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
    } finally {
      setIsParsing(false);
      setParsingStatus('');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = () => {
    onFileChange(null);
    setParseError(null);
    setShowPreview(false);
    setParseMethod(null);
    setParsingStatus('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Context File (Optional)
      </label>

      {contextFile ? (
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          {/* File Info */}
          <div className="flex items-center justify-between p-3 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{contextFile.name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">
                    {formatFileSize(contextFile.size)} • {contextFile.type.toUpperCase()}
                  </p>
                  {contextFile.type === 'pdf' && parseMethod && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        parseMethod === 'gemini-vision'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {parseMethod === 'gemini-vision' && (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {parseMethod === 'gemini-vision' ? 'AI-Parsed' : 'Text Extracted'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={isLoading}
              >
                {showPreview ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                disabled={isLoading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content Preview */}
          {showPreview && (
            <div className="p-3 border-t border-gray-200 bg-white">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                {contextFile.content.length > 2000
                  ? contextFile.content.substring(0, 2000) + '\n\n... (truncated)'
                  : contextFile.content}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer
            flex flex-col items-center gap-2 transition-colors
            ${isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
            }
            ${isLoading || isParsing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.json,.csv,.xlsx,.xls,.pdf,.docx"
            onChange={handleInputChange}
            className="hidden"
            disabled={isLoading || isParsing}
          />

          {isParsing ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
              <span className="text-sm text-gray-600">
                {parsingStatus || 'Parsing file...'}
              </span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-600">
                Drop a file here or click to upload
              </span>
              <span className="text-xs text-gray-400">
                TXT, JSON, CSV, XLSX, PDF (max 10MB)
              </span>
            </>
          )}
        </div>
      )}

      {/* Error Message */}
      {parseError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{parseError}</p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Upload a file to provide additional context for the AI when generating content.
      </p>
    </div>
  );
}
