import * as path from 'path';
import { ParsedSymbol, DomainInfo } from '../types';

const KNOWN_DOMAIN_DIRS = new Set([
  'auth', 'authentication', 'users', 'user', 'payments', 'payment',
  'notifications', 'notification', 'orders', 'order', 'products', 'product',
  'admin', 'api', 'routes', 'route', 'services', 'service', 'models', 'model',
  'controllers', 'controller', 'middleware', 'utils', 'helpers', 'helper',
  'config', 'database', 'db', 'email', 'queue', 'workers', 'worker',
  'jobs', 'job', 'hooks', 'hook', 'components', 'pages', 'views', 'view',
  'lib', 'core', 'common', 'shared', 'types', 'schemas', 'schema',
]);

/**
 * Group source files into logical domains based on their directory structure.
 */
export function detectDomains(
  sourceFiles: string[],
  allSymbols: ParsedSymbol[],
  projectRoot: string
): DomainInfo[] {
  // Build a map of file -> symbols
  const symbolsByFile = new Map<string, ParsedSymbol[]>();
  for (const symbol of allSymbols) {
    const existing = symbolsByFile.get(symbol.file) || [];
    existing.push(symbol);
    symbolsByFile.set(symbol.file, existing);
  }

  // Determine the source root (prefer src/ subdirectory)
  const hasSrcDir = sourceFiles.some(f => {
    const normalized = f.replace(/\\/g, '/');
    return normalized.startsWith('src/');
  });

  const domainMap = new Map<string, string[]>();

  // Config/tooling files at project root that should not appear as domain members
  const ROOT_CONFIG_FILES = new Set([
    'jest.config.ts', 'jest.config.js', 'jest.config.cjs',
    'vitest.config.ts', 'vitest.config.js',
    'vite.config.ts', 'vite.config.js',
    'webpack.config.ts', 'webpack.config.js',
    'rollup.config.ts', 'rollup.config.js',
    'tsconfig.json', 'babel.config.js', 'babel.config.json',
    'eslint.config.js', 'eslint.config.ts', '.eslintrc.js',
    'prettier.config.js', '.prettierrc.js',
    'tailwind.config.ts', 'tailwind.config.js',
    'next.config.ts', 'next.config.js',
    'nuxt.config.ts', 'nuxt.config.js',
  ]);

  for (const file of sourceFiles) {
    const normalized = file.replace(/\\/g, '/');
    const basename = normalized.split('/').pop() || '';

    // Skip root-level config/tooling files when project has a src/ directory
    if (hasSrcDir && !normalized.includes('/') && ROOT_CONFIG_FILES.has(basename)) {
      continue;
    }

    let domainName: string;

    if (hasSrcDir && normalized.startsWith('src/')) {
      const withoutSrc = normalized.slice(4); // remove 'src/'
      const parts = withoutSrc.split('/');
      if (parts.length > 1) {
        domainName = parts[0]; // first subdirectory under src/
      } else {
        domainName = 'root';
      }
    } else {
      const parts = normalized.split('/');
      if (parts.length > 1) {
        domainName = parts[0];
      } else {
        domainName = 'root';
      }
    }

    const existing = domainMap.get(domainName) || [];
    existing.push(file);
    domainMap.set(domainName, existing);
  }

  const domains: DomainInfo[] = [];

  for (const [domainName, files] of domainMap.entries()) {
    const domainSymbols: ParsedSymbol[] = [];
    for (const file of files) {
      const fileSymbols = symbolsByFile.get(file) || [];
      domainSymbols.push(...fileSymbols);
    }

    let dirPath: string;
    if (domainName === 'root') {
      dirPath = hasSrcDir ? 'src' : '.';
    } else if (hasSrcDir) {
      dirPath = `src/${domainName}`;
    } else {
      dirPath = domainName;
    }

    domains.push({
      name: domainName,
      dirPath,
      files,
      symbols: domainSymbols,
    });
  }

  // Sort domains: known domains first, then alphabetically
  domains.sort((a, b) => {
    const aKnown = KNOWN_DOMAIN_DIRS.has(a.name);
    const bKnown = KNOWN_DOMAIN_DIRS.has(b.name);
    if (aKnown && !bKnown) return -1;
    if (!aKnown && bKnown) return 1;
    return a.name.localeCompare(b.name);
  });

  return domains;
}

/**
 * Generate markdown content for a domain.
 */
export function generateDomainMarkdown(domain: DomainInfo): string {
  const lines: string[] = [];

  lines.push(`# Domain: ${domain.name}`);
  lines.push('');
  lines.push(`**Directory:** \`${domain.dirPath}\``);
  lines.push(`**Files:** ${domain.files.length}`);
  lines.push(`**Symbols:** ${domain.symbols.length}`);
  lines.push('');

  // Files section with symbols
  lines.push('## Files');
  lines.push('');

  for (const file of domain.files.sort()) {
    lines.push(`### \`${file}\``);
    lines.push('');

    const fileSymbols = domain.symbols.filter(s => s.file === file);

    if (fileSymbols.length === 0) {
      lines.push('_No exported symbols detected._');
    } else {
      // Group by type
      const byType = new Map<string, ParsedSymbol[]>();
      for (const sym of fileSymbols) {
        const list = byType.get(sym.type) || [];
        list.push(sym);
        byType.set(sym.type, list);
      }

      const typeOrder = ['class', 'interface', 'type', 'function', 'method', 'route', 'export', 'variable'];
      for (const t of typeOrder) {
        const syms = byType.get(t);
        if (!syms || syms.length === 0) continue;
        lines.push(`**${pluralizeType(t)}:**`);
        for (const sym of syms) {
          lines.push(`- \`${sym.name}\` (line ${sym.line})`);
        }
        lines.push('');
      }
    }

    lines.push('');
  }

  // Data flow section
  const dataFlow = detectDataFlow(domain);
  if (dataFlow) {
    lines.push('## Data Flow');
    lines.push('');
    lines.push(dataFlow);
    lines.push('');
  }

  // Change recipe
  lines.push('## Change Recipe');
  lines.push('');
  lines.push(generateChangeRecipe(domain));
  lines.push('');

  return lines.join('\n');
}

function detectDataFlow(domain: DomainInfo): string | null {
  const symbolNames = domain.symbols.map(s => s.name.toLowerCase());
  const hasRouter = symbolNames.some(n => n.includes('router') || n.includes('route'));
  const hasService = symbolNames.some(n => n.includes('service'));
  const hasRepo = symbolNames.some(n => n.includes('repo') || n.includes('repository'));
  const hasModel = symbolNames.some(n => n.includes('model') || n.includes('schema'));
  const hasController = symbolNames.some(n => n.includes('controller'));

  const parts: string[] = [];

  if (hasRouter || hasController) parts.push('Router/Controller');
  if (hasService) parts.push('Service');
  if (hasRepo) parts.push('Repository');
  if (hasModel) parts.push('Model/Schema');

  if (parts.length >= 2) {
    return parts.join(' → ');
  }

  return null;
}

function generateChangeRecipe(domain: DomainInfo): string {
  const lines: string[] = [];
  const domainName = domain.name;

  lines.push(`To add a new feature to the **${domainName}** domain:`);
  lines.push('');

  const symbolNames = domain.symbols.map(s => s.name.toLowerCase());
  const hasService = symbolNames.some(n => n.includes('service'));
  const hasRoute = domain.symbols.some(s => s.type === 'route');
  const hasModel = symbolNames.some(n => n.includes('model') || n.includes('schema'));
  const hasTest = domain.files.some(f => f.includes('test') || f.includes('spec'));

  let step = 1;

  if (hasModel) {
    lines.push(`${step++}. Update the model/schema in \`${domain.dirPath}/\``);
  }
  if (hasService) {
    lines.push(`${step++}. Add business logic to the service layer`);
  }
  if (hasRoute) {
    lines.push(`${step++}. Register the new route/endpoint`);
  }
  if (hasTest) {
    lines.push(`${step++}. Add or update tests`);
  }
  if (step === 1) {
    lines.push(`${step++}. Add the new file under \`${domain.dirPath}/\``);
    lines.push(`${step++}. Export from the domain index if applicable`);
  }

  return lines.join('\n');
}

const PLURAL_MAP: Record<string, string> = {
  'class': 'Classes',
  'interface': 'Interfaces',
  'type': 'Types',
  'function': 'Functions',
  'method': 'Methods',
  'route': 'Routes',
  'export': 'Exports',
  'variable': 'Variables',
};

function pluralizeType(t: string): string {
  return PLURAL_MAP[t] ?? (t.charAt(0).toUpperCase() + t.slice(1) + 's');
}
