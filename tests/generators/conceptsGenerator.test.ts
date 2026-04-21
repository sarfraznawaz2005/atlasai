import { generateConcepts, mergeConceptsForFiles } from '../../src/generators/conceptsGenerator';
import { ParsedSymbol } from '../../src/types';
import { decomposeIdentifier } from '../../src/parsers/identifierUtils';

describe('decomposeIdentifier', () => {
  describe('camelCase decomposition', () => {
    it('should split getUserById', () => {
      const result = decomposeIdentifier('getUserById');
      expect(result).toContain('get');
      expect(result).toContain('user');
      expect(result).toContain('id');
    });

    it('should split createUserAccount', () => {
      const result = decomposeIdentifier('createUserAccount');
      expect(result).toContain('create');
      expect(result).toContain('user');
      expect(result).toContain('account');
    });

    it('should split processOrderPayment', () => {
      const result = decomposeIdentifier('processOrderPayment');
      expect(result).toContain('process');
      expect(result).toContain('order');
      expect(result).toContain('payment');
    });

    it('should handle PascalCase: UserAuthenticationService', () => {
      const result = decomposeIdentifier('UserAuthenticationService');
      expect(result).toContain('user');
      expect(result).toContain('authentication');
      expect(result).toContain('service');
    });
  });

  describe('snake_case decomposition', () => {
    it('should split get_user_by_id', () => {
      const result = decomposeIdentifier('get_user_by_id');
      expect(result).toContain('get');
      expect(result).toContain('user');
      expect(result).toContain('id');
    });

    it('should split create_order_payment', () => {
      const result = decomposeIdentifier('create_order_payment');
      expect(result).toContain('create');
      expect(result).toContain('order');
      expect(result).toContain('payment');
    });

    it('should handle SCREAMING_SNAKE_CASE', () => {
      const result = decomposeIdentifier('MAX_RETRY_COUNT');
      expect(result).toContain('max');
      expect(result).toContain('retry');
      expect(result).toContain('count');
    });
  });

  describe('kebab-case decomposition', () => {
    it('should split get-user-by-id', () => {
      const result = decomposeIdentifier('get-user-by-id');
      expect(result).toContain('get');
      expect(result).toContain('user');
      expect(result).toContain('id');
    });
  });

  describe('filtering short words', () => {
    it('should filter out words shorter than 3 chars (except important ones)', () => {
      const result = decomposeIdentifier('getById');
      // 'by' is 2 chars and not important, should be filtered
      expect(result).not.toContain('by');
    });

    it('should keep "id" even though it is 2 chars', () => {
      const result = decomposeIdentifier('getUserId');
      expect(result).toContain('id');
    });

    it('should keep "db" even though it is 2 chars', () => {
      const result = decomposeIdentifier('initDb');
      expect(result).toContain('db');
    });
  });

  describe('deduplication', () => {
    it('should not repeat the same keyword', () => {
      const result = decomposeIdentifier('getUserUser');
      const userCount = result.filter(k => k === 'user').length;
      expect(userCount).toBe(1);
    });
  });
});

describe('generateConcepts', () => {
  const makeSymbol = (
    name: string,
    file: string,
    line: number,
    type: ParsedSymbol['type'] = 'function'
  ): ParsedSymbol => ({
    name,
    type,
    file,
    line,
    keywords: decomposeIdentifier(name),
  });

  it('should create concept entries for each keyword', () => {
    const symbols = [
      makeSymbol('getUserById', 'src/users/service.ts', 10),
    ];

    const concepts = generateConcepts(symbols);

    expect(concepts['get']).toBeDefined();
    expect(concepts['user']).toBeDefined();
    expect(concepts['id']).toBeDefined();
  });

  it('should map keywords to correct concept entries', () => {
    const symbols = [
      makeSymbol('createPayment', 'src/payments/service.ts', 25),
    ];

    const concepts = generateConcepts(symbols);

    const paymentEntries = concepts['payment'];
    expect(paymentEntries).toHaveLength(1);
    expect(paymentEntries[0]).toMatchObject({
      file: 'src/payments/service.ts',
      line: 25,
      symbol: 'createPayment',
      type: 'function',
    });
  });

  it('should merge symbols from multiple files for the same keyword', () => {
    const symbols = [
      makeSymbol('getUser', 'src/users/service.ts', 5),
      makeSymbol('updateUser', 'src/users/controller.ts', 12),
      makeSymbol('UserModel', 'src/users/model.ts', 1, 'class'),
    ];

    const concepts = generateConcepts(symbols);

    // All three share 'user' keyword
    expect(concepts['user']).toHaveLength(3);
    const files = concepts['user'].map(e => e.file);
    expect(files).toContain('src/users/service.ts');
    expect(files).toContain('src/users/controller.ts');
    expect(files).toContain('src/users/model.ts');
  });

  it('should not create duplicate entries for the same symbol', () => {
    const symbols = [
      makeSymbol('getUser', 'src/users/service.ts', 5),
      makeSymbol('getUser', 'src/users/service.ts', 5), // duplicate
    ];

    const concepts = generateConcepts(symbols);

    expect(concepts['user']).toHaveLength(1);
  });

  it('should sort entries by file then line', () => {
    const symbols = [
      makeSymbol('getUserRole', 'src/users/service.ts', 50),
      makeSymbol('getUserInfo', 'src/users/service.ts', 10),
      makeSymbol('getUserAccount', 'src/auth/service.ts', 5),
    ];

    const concepts = generateConcepts(symbols);

    const userEntries = concepts['user'];
    expect(userEntries[0].file).toBe('src/auth/service.ts');
    expect(userEntries[1].line).toBe(10);
    expect(userEntries[2].line).toBe(50);
  });

  it('should handle empty symbols array', () => {
    const concepts = generateConcepts([]);
    expect(Object.keys(concepts)).toHaveLength(0);
  });
});

describe('mergeConceptsForFiles', () => {
  const makeSymbol = (
    name: string,
    file: string,
    line: number
  ): ParsedSymbol => ({
    name,
    type: 'function',
    file,
    line,
    keywords: decomposeIdentifier(name),
  });

  it('should remove old entries for changed files', () => {
    const existing = {
      'user': [
        { file: 'src/users/old.ts', line: 5, symbol: 'getUser', type: 'function' },
        { file: 'src/other/file.ts', line: 3, symbol: 'otherUser', type: 'function' },
      ],
    };

    const result = mergeConceptsForFiles(existing, ['src/users/old.ts'], []);

    const userEntries = result['user'] || [];
    expect(userEntries.some(e => e.file === 'src/users/old.ts')).toBe(false);
    expect(userEntries.some(e => e.file === 'src/other/file.ts')).toBe(true);
  });

  it('should add new entries for changed files', () => {
    const existing = {
      'payment': [
        { file: 'src/payments/service.ts', line: 10, symbol: 'processPayment', type: 'function' },
      ],
    };

    const newSymbols = [
      makeSymbol('createPaymentRecord', 'src/payments/service.ts', 20),
    ];

    const result = mergeConceptsForFiles(
      existing,
      ['src/payments/service.ts'],
      newSymbols
    );

    const paymentEntries = result['payment'] || [];
    // Old entry was removed (same file), new entry was added
    expect(paymentEntries.some(e => e.symbol === 'createPaymentRecord')).toBe(true);
    expect(paymentEntries.some(e => e.symbol === 'processPayment')).toBe(false);
  });

  it('should preserve entries from unchanged files', () => {
    const existing = {
      'order': [
        { file: 'src/orders/service.ts', line: 5, symbol: 'getOrder', type: 'function' },
        { file: 'src/orders/model.ts', line: 1, symbol: 'OrderModel', type: 'class' },
      ],
    };

    const result = mergeConceptsForFiles(existing, ['src/orders/service.ts'], []);

    const orderEntries = result['order'] || [];
    // Model file was NOT changed, should be preserved
    expect(orderEntries.some(e => e.file === 'src/orders/model.ts')).toBe(true);
  });

  it('should handle empty existing map', () => {
    const newSymbols = [makeSymbol('getUserById', 'src/users/service.ts', 1)];
    const result = mergeConceptsForFiles({}, ['src/users/service.ts'], newSymbols);

    expect(result['get']).toBeDefined();
    expect(result['user']).toBeDefined();
  });
});
