import * as path from 'path';
import { ParsedSymbol, Parser } from '../types';
import { decomposeIdentifier } from './identifierUtils';

export class PythonParser implements Parser {
  canParse(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.py';
  }

  parse(filePath: string, content: string): ParsedSymbol[] {
    const symbols: ParsedSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Function definition: def foo(...) or async def foo(...)
      const funcMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
      if (funcMatch && funcMatch[1]) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          file: filePath,
          line: lineNumber,
          keywords: decomposeIdentifier(funcMatch[1]),
        });
        continue;
      }

      // Indented method: "  def foo(...)"
      const methodMatch = line.match(/^[ \t]+(?:async\s+)?def\s+(\w+)\s*\(/);
      if (methodMatch && methodMatch[1]) {
        symbols.push({
          name: methodMatch[1],
          type: 'method',
          file: filePath,
          line: lineNumber,
          keywords: decomposeIdentifier(methodMatch[1]),
        });
        continue;
      }

      // Class definition: class Foo: or class Foo(Bar):
      const classMatch = line.match(/^class\s+(\w+)[\s:(]/);
      if (classMatch && classMatch[1]) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          file: filePath,
          line: lineNumber,
          keywords: decomposeIdentifier(classMatch[1]),
        });
        continue;
      }

      // Module-level variable/constant assignment (uppercase = constant convention)
      const constMatch = line.match(/^([A-Z][A-Z0-9_]+)\s*=/);
      if (constMatch && constMatch[1]) {
        symbols.push({
          name: constMatch[1],
          type: 'variable',
          file: filePath,
          line: lineNumber,
          keywords: decomposeIdentifier(constMatch[1]),
        });
      }
    }

    return symbols;
  }
}
