import { detectDomains, generateDomainMarkdown } from '../../src/generators/domainsGenerator';
import { ParsedSymbol } from '../../src/types';
import { decomposeIdentifier } from '../../src/parsers/identifierUtils';

const makeSymbol = (name: string, file: string, line = 1): ParsedSymbol => ({
  name,
  type: 'function',
  file,
  line,
  keywords: decomposeIdentifier(name),
});

describe('detectDomains', () => {
  it('should group files under src/auth/ into auth domain', () => {
    const files = [
      'src/auth/service.ts',
      'src/auth/controller.ts',
      'src/auth/middleware.ts',
    ];
    const symbols = files.flatMap((f, i) => [makeSymbol(`func${i}`, f)]);

    const domains = detectDomains(files, symbols, '/project');

    const authDomain = domains.find(d => d.name === 'auth');
    expect(authDomain).toBeDefined();
    expect(authDomain?.files).toHaveLength(3);
    expect(authDomain?.dirPath).toBe('src/auth');
  });

  it('should group files under src/users/ into users domain', () => {
    const files = [
      'src/users/service.ts',
      'src/users/repository.ts',
    ];
    const symbols = files.flatMap((f, i) => [makeSymbol(`func${i}`, f)]);

    const domains = detectDomains(files, symbols, '/project');

    const usersDomain = domains.find(d => d.name === 'users');
    expect(usersDomain).toBeDefined();
    expect(usersDomain?.files).toContain('src/users/service.ts');
    expect(usersDomain?.files).toContain('src/users/repository.ts');
  });

  it('should put root-level src/ files into root domain', () => {
    const files = [
      'src/index.ts',
      'src/app.ts',
      'src/auth/service.ts',
    ];
    const symbols = files.flatMap((f, i) => [makeSymbol(`func${i}`, f)]);

    const domains = detectDomains(files, symbols, '/project');

    const rootDomain = domains.find(d => d.name === 'root');
    expect(rootDomain).toBeDefined();
    expect(rootDomain?.files).toContain('src/index.ts');
    expect(rootDomain?.files).toContain('src/app.ts');
  });

  it('should handle projects without src/ directory', () => {
    const files = [
      'auth/service.ts',
      'auth/middleware.ts',
      'users/service.ts',
    ];
    const symbols = files.flatMap((f, i) => [makeSymbol(`func${i}`, f)]);

    const domains = detectDomains(files, symbols, '/project');

    const authDomain = domains.find(d => d.name === 'auth');
    expect(authDomain).toBeDefined();
    expect(authDomain?.dirPath).toBe('auth');

    const usersDomain = domains.find(d => d.name === 'users');
    expect(usersDomain).toBeDefined();
  });

  it('should assign symbols to the correct domain', () => {
    const files = [
      'src/auth/service.ts',
      'src/payments/service.ts',
    ];
    const authSymbol = makeSymbol('loginUser', 'src/auth/service.ts');
    const paymentSymbol = makeSymbol('processPayment', 'src/payments/service.ts');

    const domains = detectDomains(files, [authSymbol, paymentSymbol], '/project');

    const authDomain = domains.find(d => d.name === 'auth');
    expect(authDomain?.symbols).toHaveLength(1);
    expect(authDomain?.symbols[0].name).toBe('loginUser');

    const paymentDomain = domains.find(d => d.name === 'payments');
    expect(paymentDomain?.symbols).toHaveLength(1);
    expect(paymentDomain?.symbols[0].name).toBe('processPayment');
  });

  it('should handle multiple domains', () => {
    const files = [
      'src/auth/service.ts',
      'src/users/service.ts',
      'src/payments/service.ts',
      'src/notifications/service.ts',
    ];
    const symbols = files.flatMap((f, i) => [makeSymbol(`func${i}`, f)]);

    const domains = detectDomains(files, symbols, '/project');

    const domainNames = domains.map(d => d.name);
    expect(domainNames).toContain('auth');
    expect(domainNames).toContain('users');
    expect(domainNames).toContain('payments');
    expect(domainNames).toContain('notifications');
  });

  it('should put flat files into root domain when no subdirectory', () => {
    const files = ['index.ts', 'app.ts', 'server.ts'];
    const symbols = files.flatMap((f, i) => [makeSymbol(`func${i}`, f)]);

    const domains = detectDomains(files, symbols, '/project');

    expect(domains).toHaveLength(1);
    expect(domains[0].name).toBe('root');
  });

  it('should return empty array for empty file list', () => {
    const domains = detectDomains([], [], '/project');
    expect(domains).toHaveLength(0);
  });
});

describe('generateDomainMarkdown', () => {
  it('should include domain name in output', () => {
    const domain = {
      name: 'auth',
      dirPath: 'src/auth',
      files: ['src/auth/service.ts'],
      symbols: [makeSymbol('loginUser', 'src/auth/service.ts', 5)],
    };

    const md = generateDomainMarkdown(domain);
    expect(md).toContain('# Domain: auth');
  });

  it('should include directory path', () => {
    const domain = {
      name: 'users',
      dirPath: 'src/users',
      files: ['src/users/service.ts'],
      symbols: [],
    };

    const md = generateDomainMarkdown(domain);
    expect(md).toContain('src/users');
  });

  it('should list all files', () => {
    const domain = {
      name: 'payments',
      dirPath: 'src/payments',
      files: ['src/payments/service.ts', 'src/payments/gateway.ts'],
      symbols: [],
    };

    const md = generateDomainMarkdown(domain);
    expect(md).toContain('src/payments/service.ts');
    expect(md).toContain('src/payments/gateway.ts');
  });

  it('should list symbols for each file', () => {
    const domain = {
      name: 'auth',
      dirPath: 'src/auth',
      files: ['src/auth/service.ts'],
      symbols: [
        makeSymbol('loginUser', 'src/auth/service.ts', 10),
        makeSymbol('logoutUser', 'src/auth/service.ts', 20),
      ],
    };

    const md = generateDomainMarkdown(domain);
    expect(md).toContain('loginUser');
    expect(md).toContain('logoutUser');
  });

  it('should include a change recipe section', () => {
    const domain = {
      name: 'orders',
      dirPath: 'src/orders',
      files: ['src/orders/service.ts'],
      symbols: [makeSymbol('createOrder', 'src/orders/service.ts', 1)],
    };

    const md = generateDomainMarkdown(domain);
    expect(md).toContain('## Change Recipe');
  });

  it('should include files section', () => {
    const domain = {
      name: 'auth',
      dirPath: 'src/auth',
      files: ['src/auth/service.ts'],
      symbols: [],
    };

    const md = generateDomainMarkdown(domain);
    expect(md).toContain('## Files');
  });

  it('should show line numbers for symbols', () => {
    const domain = {
      name: 'users',
      dirPath: 'src/users',
      files: ['src/users/service.ts'],
      symbols: [makeSymbol('getUser', 'src/users/service.ts', 42)],
    };

    const md = generateDomainMarkdown(domain);
    expect(md).toContain('line 42');
  });
});
