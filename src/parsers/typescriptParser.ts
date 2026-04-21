import * as path from 'path';
import * as ts from 'typescript';
import { ParsedSymbol, Parser } from '../types';
import { decomposeIdentifier } from './identifierUtils';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Express-style route method names
const ROUTE_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'use', 'all']);

export class TypeScriptParser implements Parser {
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return TS_EXTENSIONS.has(ext);
  }

  parse(filePath: string, content: string): ParsedSymbol[] {
    const ext = path.extname(filePath).toLowerCase();
    const isJsx = ext === '.tsx' || ext === '.jsx';

    const scriptKind = isJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind
      );
    } catch {
      return [];
    }

    const symbols: ParsedSymbol[] = [];
    const lines = content.split('\n');

    const getLine = (pos: number): number => {
      const lineAndChar = sourceFile.getLineAndCharacterOfPosition(pos);
      return lineAndChar.line + 1;
    };

    const addSymbol = (
      name: string,
      type: ParsedSymbol['type'],
      pos: number
    ): void => {
      if (!name) return;
      symbols.push({
        name,
        type,
        file: filePath,
        line: getLine(pos),
        keywords: decomposeIdentifier(name),
      });
    };

    const visitNode = (node: ts.Node): void => {
      // Function declarations: function foo() {}
      if (ts.isFunctionDeclaration(node) && node.name) {
        addSymbol(node.name.text, 'function', node.getStart(sourceFile));
      }

      // Class declarations: class Foo {}
      else if (ts.isClassDeclaration(node) && node.name) {
        addSymbol(node.name.text, 'class', node.getStart(sourceFile));
      }

      // Interface declarations: interface Foo {}
      else if (ts.isInterfaceDeclaration(node) && node.name) {
        addSymbol(node.name.text, 'interface', node.getStart(sourceFile));
      }

      // Type aliases: type Foo = ...
      else if (ts.isTypeAliasDeclaration(node) && node.name) {
        addSymbol(node.name.text, 'type', node.getStart(sourceFile));
      }

      // Variable declarations: const foo = ..., let foo = ...
      else if (ts.isVariableDeclaration(node)) {
        if (ts.isIdentifier(node.name)) {
          if (node.initializer) {
            // Arrow functions assigned to const
            if (
              ts.isArrowFunction(node.initializer) ||
              ts.isFunctionExpression(node.initializer)
            ) {
              addSymbol(node.name.text, 'function', node.getStart(sourceFile));
            } else {
              // Check for route patterns: const route = router.get('/path', handler)
              // Requires string literal as first arg to avoid false positives like Map.get(key)
              if (
                ts.isCallExpression(node.initializer) &&
                ts.isPropertyAccessExpression(node.initializer.expression)
              ) {
                const methodName = node.initializer.expression.name.text;
                const firstArg = node.initializer.arguments[0];
                if (ROUTE_METHODS.has(methodName) && firstArg && ts.isStringLiteral(firstArg)) {
                  addSymbol(node.name.text, 'route', node.getStart(sourceFile));
                  return;
                }
              }
              // Exported variables
              const parent = node.parent?.parent;
              if (parent && ts.isVariableStatement(parent)) {
                const hasExport = parent.modifiers?.some(
                  m => m.kind === ts.SyntaxKind.ExportKeyword
                );
                if (hasExport) {
                  addSymbol(node.name.text, 'export', node.getStart(sourceFile));
                }
              }
            }
          }
        }
      }

      // Method declarations inside classes/objects
      else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
        addSymbol(node.name.text, 'method', node.getStart(sourceFile));
      }

      // Export declarations: export { foo }, export default foo
      else if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            addSymbol(element.name.text, 'export', node.getStart(sourceFile));
          }
        }
      }

      // Detect Express route patterns via call expressions
      // app.get('/route', handler) or router.post('/route', handler)
      else if (ts.isExpressionStatement(node)) {
        if (ts.isCallExpression(node.expression)) {
          const callExpr = node.expression;
          if (
            ts.isPropertyAccessExpression(callExpr.expression) &&
            ROUTE_METHODS.has(callExpr.expression.name.text)
          ) {
            const methodName = callExpr.expression.name.text.toUpperCase();
            const firstArg = callExpr.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              const routePath = firstArg.text;
              const routeName = `${methodName}:${routePath}`;
              addSymbol(routeName, 'route', node.getStart(sourceFile));
            }
          }
        }
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);

    // Deduplicate by name + line
    const seen = new Set<string>();
    return symbols.filter(s => {
      const key = `${s.name}:${s.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
