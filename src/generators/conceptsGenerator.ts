import { ParsedSymbol, ConceptsMap, ConceptEntry } from '../types';

/**
 * Build the concepts map from all parsed symbols.
 * Each keyword from each symbol maps to an array of ConceptEntry records.
 */
export function generateConcepts(symbols: ParsedSymbol[]): ConceptsMap {
  const map: ConceptsMap = {};

  for (const symbol of symbols) {
    const entry: ConceptEntry = {
      file: symbol.file,
      line: symbol.line,
      symbol: symbol.name,
      type: symbol.type,
    };

    for (const keyword of symbol.keywords) {
      if (!map[keyword]) {
        map[keyword] = [];
      }

      // Avoid exact duplicates (same file, line, symbol)
      const exists = map[keyword].some(
        e => e.file === entry.file && e.line === entry.line && e.symbol === entry.symbol
      );
      if (!exists) {
        map[keyword].push(entry);
      }
    }
  }

  // Sort each entry list by file then line for determinism
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => {
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      return a.line - b.line;
    });
  }

  return map;
}

/**
 * Merge updated symbols for a set of changed files into an existing concepts map.
 * Removes all old entries for the changed files, then adds new entries.
 */
export function mergeConceptsForFiles(
  existing: ConceptsMap,
  changedFiles: string[],
  newSymbols: ParsedSymbol[]
): ConceptsMap {
  const changedSet = new Set(changedFiles);

  // Remove old entries for changed files
  const pruned: ConceptsMap = {};
  for (const [keyword, entries] of Object.entries(existing)) {
    const filtered = entries.filter(e => !changedSet.has(e.file));
    if (filtered.length > 0) {
      pruned[keyword] = filtered;
    }
  }

  // Add new entries
  const newSymbolsForChanged = newSymbols.filter(s => changedSet.has(s.file));
  const additions = generateConcepts(newSymbolsForChanged);

  for (const [keyword, entries] of Object.entries(additions)) {
    if (!pruned[keyword]) {
      pruned[keyword] = entries;
    } else {
      pruned[keyword].push(...entries);
      pruned[keyword].sort((a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        return a.line - b.line;
      });
    }
  }

  return pruned;
}
