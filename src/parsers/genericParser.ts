import * as path from 'path';
import { ParsedSymbol, Parser } from '../types';
import { decomposeIdentifier } from './identifierUtils';

interface LanguagePatterns {
  function?: RegExp;
  class?: RegExp;
  interface?: RegExp;
  struct?: RegExp;
  method?: RegExp;
}

const LANGUAGE_PATTERNS: Record<string, LanguagePatterns> = {
  '.py': {
    function: /^(?:async\s+)?def\s+(\w+)\s*\(/m,
    class: /^class\s+(\w+)[\s:(]/m,
  },
  '.go': {
    function: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/m,
    struct: /^type\s+(\w+)\s+struct\b/m,
    interface: /^type\s+(\w+)\s+interface\b/m,
  },
  '.rb': {
    function: /^(?:  |\t)?def\s+(\w+[\?!]?)/m,
    class: /^class\s+(\w+)/m,
    method: /^  def\s+(\w+[\?!]?)/m,
  },
  '.rs': {
    function: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[(<]/m,
    struct: /^(?:pub\s+)?struct\s+(\w+)\b/m,
    interface: /^(?:pub\s+)?trait\s+(\w+)\b/m,
  },
  '.java': {
    function: /^(?:\s+)(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\(/m,
    class: /^(?:public\s+)?(?:abstract\s+)?class\s+(\w+)\b/m,
    interface: /^(?:public\s+)?interface\s+(\w+)\b/m,
  },
  '.kt': {
    function: /^(?:\s+)?(?:override\s+)?fun\s+(\w+)\s*[(<]/m,
    class: /^(?:data\s+|sealed\s+|abstract\s+)?class\s+(\w+)\b/m,
    interface: /^interface\s+(\w+)\b/m,
  },
  '.php': {
    function: /^(?:\s+)?(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(/m,
    class: /^class\s+(\w+)\b/m,
    interface: /^interface\s+(\w+)\b/m,
  },
  '.swift': {
    function: /^(?:\s+)?(?:@\w+\s+)*(?:public|private|internal|open|fileprivate|\s)*func\s+(\w+)\s*[(<]/m,
    class: /^(?:\s+)?(?:public|private|open|\s)*class\s+(\w+)\b/m,
    struct: /^(?:\s+)?(?:public|private|\s)*struct\s+(\w+)\b/m,
    interface: /^(?:\s+)?(?:public|private|\s)*protocol\s+(\w+)\b/m,
  },
  '.c': {
    function: /^(?:static\s+|extern\s+|inline\s+)*\w[\w\s\*]+\s+(\w+)\s*\([^;]/m,
    struct: /^(?:typedef\s+)?struct\s+(\w+)\s*\{/m,
  },
  '.cpp': {
    function: /^(?:static\s+|virtual\s+|inline\s+|explicit\s+)*(?:[\w:]+\s+)+(\w+)\s*\([^;]/m,
    class: /^class\s+(\w+)\b/m,
    struct: /^struct\s+(\w+)\b/m,
  },
  '.cs': {
    function: /^(?:\s+)(?:public|private|protected|internal|static|async|\s)+[\w<>\[\]?]+\s+(\w+)\s*\(/m,
    class: /^(?:\s+)?(?:public|private|internal|abstract|sealed|\s)*class\s+(\w+)\b/m,
    interface: /^(?:\s+)?(?:public|internal|\s)*interface\s+(\w+)\b/m,
  },
};

const GENERIC_EXTENSIONS = new Set([
  '.py', '.go', '.rb', '.rs', '.java', '.kt', '.php',
  '.swift', '.c', '.cpp', '.cs',
]);

export class GenericParser implements Parser {
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return GENERIC_EXTENSIONS.has(ext);
  }

  parse(filePath: string, content: string): ParsedSymbol[] {
    const ext = path.extname(filePath).toLowerCase();
    const patterns = LANGUAGE_PATTERNS[ext];
    if (!patterns) return this.parseGenericFallback(filePath, content);

    const symbols: ParsedSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      if (patterns.function) {
        const match = line.match(patterns.function);
        if (match && match[1]) {
          symbols.push(this.makeSymbol(match[1], 'function', filePath, lineNumber));
        }
      }

      if (patterns.class) {
        const match = line.match(patterns.class);
        if (match && match[1]) {
          symbols.push(this.makeSymbol(match[1], 'class', filePath, lineNumber));
        }
      }

      if (patterns.interface) {
        const match = line.match(patterns.interface);
        if (match && match[1]) {
          symbols.push(this.makeSymbol(match[1], 'interface', filePath, lineNumber));
        }
      }

      if (patterns.struct) {
        const match = line.match(patterns.struct);
        if (match && match[1]) {
          symbols.push(this.makeSymbol(match[1], 'class', filePath, lineNumber));
        }
      }

      if (patterns.method) {
        const match = line.match(patterns.method);
        if (match && match[1]) {
          // only add if not already captured as function
          const alreadyAdded = symbols.some(
            s => s.line === lineNumber && s.name === match[1]
          );
          if (!alreadyAdded) {
            symbols.push(this.makeSymbol(match[1], 'method', filePath, lineNumber));
          }
        }
      }
    }

    return symbols;
  }

  private parseGenericFallback(filePath: string, content: string): ParsedSymbol[] {
    const symbols: ParsedSymbol[] = [];
    const lines = content.split('\n');

    // Generic function-like pattern
    const genericFn = /\b(?:function|def|func|fn|sub|proc)\s+(\w+)\s*[(<]/;
    // Generic class-like pattern
    const genericClass = /\b(?:class|struct|interface|trait|type)\s+(\w+)\b/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      const fnMatch = line.match(genericFn);
      if (fnMatch && fnMatch[1]) {
        symbols.push(this.makeSymbol(fnMatch[1], 'function', filePath, lineNumber));
        continue;
      }

      const classMatch = line.match(genericClass);
      if (classMatch && classMatch[1]) {
        symbols.push(this.makeSymbol(classMatch[1], 'class', filePath, lineNumber));
      }
    }

    return symbols;
  }

  private makeSymbol(
    name: string,
    type: ParsedSymbol['type'],
    file: string,
    line: number
  ): ParsedSymbol {
    return {
      name,
      type,
      file,
      line,
      keywords: decomposeIdentifier(name),
    };
  }
}
