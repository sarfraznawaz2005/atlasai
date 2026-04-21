export interface ParsedSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'route' | 'export' | 'method';
  file: string;        // relative path from project root
  line: number;
  keywords: string[];  // decomposed words from the symbol name
}

export interface ConceptEntry {
  file: string;
  line: number;
  symbol: string;
  type: string;
}

export type ConceptsMap = Record<string, ConceptEntry[]>;

export interface DomainInfo {
  name: string;
  dirPath: string;     // relative path
  files: string[];     // relative paths
  symbols: ParsedSymbol[];
}

export interface ConventionsData {
  naming: {
    files: string;
    functions: string;
    classes: string;
    constants: string;
    confidence: number;
  };
  patterns: Record<string, string>;
  test_patterns: {
    location: string;
    runner: string;
  };
  file_structure: {
    detected_pattern: string;
  };
}

export interface AtlasIndex {
  project: {
    name: string;
    type: string;
    language: string;
    languages: string[];
  };
  entry_points: Record<string, string>;
  domains: Record<string, string>;
  concepts_index: string;
  conventions: string;
  constraints: string;
  architecture_pattern: string;
  last_generated: string;
}

export interface AtlasConfig {
  projectRoot: string;
  atlasDir: string;
  sourceFiles: string[];
  ignoredDirs: string[];
}

export interface Parser {
  canParse(filePath: string): boolean;
  parse(filePath: string, content: string): ParsedSymbol[];
}
