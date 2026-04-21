import * as path from 'path';
import { Parser, ParsedSymbol } from '../types';
import { TypeScriptParser } from './typescriptParser';
import { PythonParser } from './pythonParser';
import { GenericParser } from './genericParser';
import { logger } from '../utils/logger';

const tsParser = new TypeScriptParser();
const pyParser = new PythonParser();
const genericParser = new GenericParser();

const PARSERS: Parser[] = [tsParser, pyParser, genericParser];

// Vue and Svelte: extract script blocks then parse as TypeScript/JS
function extractScriptContent(content: string, ext: string): string {
  if (ext === '.vue') {
    const match = content.match(/<script(?:\s[^>]*)?>([^]*?)<\/script>/i);
    return match ? match[1] : '';
  }
  if (ext === '.svelte') {
    const match = content.match(/<script(?:\s[^>]*)?>([^]*?)<\/script>/i);
    return match ? match[1] : '';
  }
  return content;
}

export function getParser(filePath: string): Parser | null {
  const ext = path.extname(filePath).toLowerCase();

  // Vue and Svelte: treat script block as TypeScript
  if (ext === '.vue' || ext === '.svelte') {
    return {
      canParse: () => true,
      parse: (fp: string, content: string): ParsedSymbol[] => {
        const script = extractScriptContent(content, ext);
        if (!script.trim()) return [];
        return tsParser.parse(fp, script);
      },
    };
  }

  for (const parser of PARSERS) {
    if (parser.canParse(filePath)) {
      return parser;
    }
  }

  return null;
}

export function parseFile(filePath: string, content: string): ParsedSymbol[] {
  const parser = getParser(filePath);
  if (!parser) return [];

  try {
    return parser.parse(filePath, content);
  } catch (err) {
    logger.warn(`Failed to parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
