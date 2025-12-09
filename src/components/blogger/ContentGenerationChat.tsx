/**
 * ContentGenerationChat Component
 * Chat-style input for interacting with the AI content generation agent
 * Supports text prompts and file attachments for context
 */

import { useState, useRef } from 'react';
import { Paperclip, X, FileText, Sparkles, Settings, RefreshCw, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { parsePdfWithGemini, parseDocxFile } from '@/services/blogger/file-parser.service';
import type { ContextFile, ContextFileType } from '@/types/blogger';

// Set up the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  file?: ContextFile;
  timestamp: number;
}

interface ContentGenerationChatProps {
  onSendMessage: (prompt: string, file: ContextFile | null) => void;
  onSettingsClick?: () => void;
  isLoading: boolean;
  placeholder?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONTEXT_TOKENS = 12500; // Token limit for context
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * 4; // ~50,000 chars (approx 4 chars per token)

export function ContentGenerationChat({
  onSendMessage,
  onSettingsClick,
  isLoading,
  placeholder = 'Ask the AI to generate or modify content...',
}: ContentGenerationChatProps) {
  const [prompt, setPrompt] = useState('');
  const [attachedFile, setAttachedFile] = useState<ContextFile | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseMethod, setParseMethod] = useState<'gemini-vision' | 'text-extraction' | null>(null);
  const [parsingStatus, setParsingStatus] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
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
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
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

  const parsePdfFallback = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? (item as { str: string }).str : ''))
        .join(' ');
      if (pageText.trim()) {
        textParts.push(`--- Page ${i} ---\n${pageText}`);
      }
    }
    return textParts.join('\n\n');
  };

  const parsePdf = async (
    file: File
  ): Promise<{ content: string; method: 'gemini-vision' | 'text-extraction' }> => {
    setParsingStatus('Using AI to understand document...');
    const geminiResult = await parsePdfWithGemini(file);

    if (geminiResult.success && geminiResult.data) {
      return { content: geminiResult.data.content, method: 'gemini-vision' };
    }

    console.log('[PDF Parser] Gemini failed, falling back to pdfjs-dist');
    setParsingStatus('Extracting text...');
    const fallbackContent = await parsePdfFallback(file);
    return { content: fallbackContent, method: 'text-extraction' };
  };

  const handleFileSelect = async (file: File) => {
    setParseError(null);
    setIsParsing(true);
    setParsingStatus('Reading file...');
    setParseMethod(null);

    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      }

      const fileType = getFileType(file);
      if (!fileType) {
        throw new Error('Unsupported file format. Please use .txt, .json, .csv, .xlsx, .pdf, or .docx');
      }

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

      // Check if parsed content exceeds token limit
      if (content.length > MAX_CONTEXT_CHARS) {
        const estimatedTokens = Math.round(content.length / 4);
        throw new Error(
          `File content exceeds maximum context size (~${estimatedTokens.toLocaleString()} tokens). ` +
          `Maximum allowed is ~${MAX_CONTEXT_TOKENS.toLocaleString()} tokens (~${MAX_CONTEXT_CHARS.toLocaleString()} characters). ` +
          `Please use a smaller file or extract the relevant sections.`
        );
      }

      const contextFile: ContextFile = {
        name: file.name,
        type: fileType,
        size: file.size,
        content,
        uploadedAt: Date.now(),
      };

      setAttachedFile(contextFile);
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
    event.target.value = '';
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    setParseError(null);
    setParseMethod(null);
    setShowPreview(false);
  };

  const handleSend = () => {
    if (isLoading || isParsing) return;

    onSendMessage(prompt.trim(), attachedFile);
    setPrompt('');
    setAttachedFile(null);
    setParseMethod(null);
    setShowPreview(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Attached File Preview */}
      {attachedFile && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900 truncate">{attachedFile.name}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-blue-600">
                  {formatFileSize(attachedFile.size)} • {attachedFile.type.toUpperCase()}
                </p>
                {attachedFile.type === 'pdf' && parseMethod && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                      parseMethod === 'gemini-vision'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {parseMethod === 'gemini-vision' && <Sparkles className="w-3 h-3" />}
                    {parseMethod === 'gemini-vision' ? 'AI-Parsed' : 'Text Extracted'}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
              disabled={isLoading}
              title={showPreview ? 'Hide preview' : 'Preview content'}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
              disabled={isLoading}
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* File Content Preview */}
          {showPreview && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-64 overflow-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {attachedFile.content.length > 15000
                  ? `${attachedFile.content.substring(0, 15000)}...\n\n[Truncated - ${attachedFile.content.length.toLocaleString()} characters total]`
                  : attachedFile.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Parse Error */}
      {parseError && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{parseError}</p>
        </div>
      )}

      {/* Chat Input */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
        {/* File Attach Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isParsing}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Attach file for context"
        >
          {isParsing ? (
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        {/* Settings Button */}
        {onSettingsClick && (
          <button
            type="button"
            onClick={onSettingsClick}
            disabled={isLoading || isParsing}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Generation settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.json,.csv,.xlsx,.xls,.pdf,.docx"
          onChange={handleInputChange}
          className="hidden"
          disabled={isLoading || isParsing}
        />

        {/* Text Input */}
        <div className="flex-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isParsing ? parsingStatus : placeholder}
            disabled={isLoading || isParsing}
            rows={2}
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg resize-y
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              placeholder:text-gray-400 text-sm"
            style={{ minHeight: '60px', maxHeight: '400px' }}
          />
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || isParsing}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2
            bg-gradient-to-r from-blue-600 to-indigo-600 text-white
            hover:from-blue-700 hover:to-indigo-700
            disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title="Generate content"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Content</span>
            </>
          )}
        </button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-gray-500">
        Send instructions to the AI. Attach files (TXT, JSON, CSV, XLSX, PDF, DOCX) for additional context.
        Press Enter to send.
      </p>
    </div>
  );
}
