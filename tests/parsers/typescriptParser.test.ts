import { TypeScriptParser } from '../../src/parsers/typescriptParser';

const parser = new TypeScriptParser();

describe('TypeScriptParser', () => {
  describe('canParse', () => {
    it('should accept .ts files', () => {
      expect(parser.canParse('foo.ts')).toBe(true);
    });

    it('should accept .tsx files', () => {
      expect(parser.canParse('foo.tsx')).toBe(true);
    });

    it('should accept .js files', () => {
      expect(parser.canParse('foo.js')).toBe(true);
    });

    it('should accept .jsx files', () => {
      expect(parser.canParse('foo.jsx')).toBe(true);
    });

    it('should reject .py files', () => {
      expect(parser.canParse('foo.py')).toBe(false);
    });

    it('should reject .go files', () => {
      expect(parser.canParse('foo.go')).toBe(false);
    });
  });

  describe('function declarations', () => {
    const content = `
function getUserById(id: string) {
  return db.users.findOne(id);
}

async function createUserAccount(data: CreateUserInput): Promise<User> {
  return db.users.create(data);
}
`.trim();

    it('should extract function declarations', () => {
      const symbols = parser.parse('src/users/service.ts', content);
      const names = symbols.map(s => s.name);
      expect(names).toContain('getUserById');
      expect(names).toContain('createUserAccount');
    });

    it('should set correct types for function declarations', () => {
      const symbols = parser.parse('src/users/service.ts', content);
      const getUserById = symbols.find(s => s.name === 'getUserById');
      expect(getUserById?.type).toBe('function');
    });

    it('should record correct line numbers', () => {
      const symbols = parser.parse('src/users/service.ts', content);
      const getUserById = symbols.find(s => s.name === 'getUserById');
      expect(getUserById?.line).toBe(1);
    });

    it('should decompose keywords from function name', () => {
      const symbols = parser.parse('src/users/service.ts', content);
      const getUserById = symbols.find(s => s.name === 'getUserById');
      expect(getUserById?.keywords).toContain('get');
      expect(getUserById?.keywords).toContain('user');
      expect(getUserById?.keywords).toContain('id');
    });
  });

  describe('class declarations', () => {
    const content = `
class UserService {
  constructor(private db: Database) {}

  async findUser(id: string) {
    return this.db.users.findOne(id);
  }
}

export class AuthenticationController {
  login() {}
  logout() {}
}
`.trim();

    it('should extract class declarations', () => {
      const symbols = parser.parse('src/services/user.ts', content);
      const names = symbols.map(s => s.name);
      expect(names).toContain('UserService');
      expect(names).toContain('AuthenticationController');
    });

    it('should set type to class for class declarations', () => {
      const symbols = parser.parse('src/services/user.ts', content);
      const userService = symbols.find(s => s.name === 'UserService');
      expect(userService?.type).toBe('class');
    });

    it('should extract method declarations from classes', () => {
      const symbols = parser.parse('src/services/user.ts', content);
      const names = symbols.map(s => s.name);
      expect(names).toContain('findUser');
    });
  });

  describe('arrow functions assigned to const', () => {
    const content = `
const handleRequest = async (req: Request, res: Response) => {
  res.send('ok');
};

const validateEmail = (email: string): boolean => {
  return /^[^@]+@[^@]+$/.test(email);
};

export const processPayment = async (amount: number) => {
  return stripe.charge(amount);
};
`.trim();

    it('should extract arrow functions assigned to const', () => {
      const symbols = parser.parse('src/handlers.ts', content);
      const names = symbols.map(s => s.name);
      expect(names).toContain('handleRequest');
      expect(names).toContain('validateEmail');
      expect(names).toContain('processPayment');
    });

    it('should type arrow functions as function', () => {
      const symbols = parser.parse('src/handlers.ts', content);
      const handleRequest = symbols.find(s => s.name === 'handleRequest');
      expect(handleRequest?.type).toBe('function');
    });
  });

  describe('interface declarations', () => {
    const content = `
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export interface PaymentGateway {
  charge(amount: number): Promise<string>;
}
`.trim();

    it('should extract interface declarations', () => {
      const symbols = parser.parse('src/types.ts', content);
      const names = symbols.map(s => s.name);
      expect(names).toContain('UserRepository');
      expect(names).toContain('PaymentGateway');
    });

    it('should type interfaces correctly', () => {
      const symbols = parser.parse('src/types.ts', content);
      const repo = symbols.find(s => s.name === 'UserRepository');
      expect(repo?.type).toBe('interface');
    });
  });

  describe('type alias declarations', () => {
    const content = `
type UserId = string;
type CreateUserInput = {
  name: string;
  email: string;
};
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
`.trim();

    it('should extract type aliases', () => {
      const symbols = parser.parse('src/types.ts', content);
      const names = symbols.map(s => s.name);
      expect(names).toContain('UserId');
      expect(names).toContain('CreateUserInput');
      expect(names).toContain('HttpMethod');
    });

    it('should type aliases as type', () => {
      const symbols = parser.parse('src/types.ts', content);
      const userId = symbols.find(s => s.name === 'UserId');
      expect(userId?.type).toBe('type');
    });
  });

  describe('Express route patterns', () => {
    const content = `
import express from 'express';
const router = express.Router();

router.get('/users', getAllUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/status', updateUserStatus);
`.trim();

    it('should extract route patterns', () => {
      const symbols = parser.parse('src/routes/users.ts', content);
      const routes = symbols.filter(s => s.type === 'route');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should include HTTP method and path in route name', () => {
      const symbols = parser.parse('src/routes/users.ts', content);
      const routeNames = symbols.filter(s => s.type === 'route').map(s => s.name);
      expect(routeNames.some(n => n.includes('GET') && n.includes('/users'))).toBe(true);
      expect(routeNames.some(n => n.includes('POST') && n.includes('/users'))).toBe(true);
    });
  });

  describe('keyword decomposition', () => {
    it('should decompose camelCase names', () => {
      const content = `function getUserAccountBalance() {}`;
      const symbols = parser.parse('src/index.ts', content);
      const sym = symbols.find(s => s.name === 'getUserAccountBalance');
      expect(sym?.keywords).toEqual(expect.arrayContaining(['get', 'user', 'account', 'balance']));
    });

    it('should handle PascalCase class names', () => {
      const content = `class UserAuthenticationService {}`;
      const symbols = parser.parse('src/index.ts', content);
      const sym = symbols.find(s => s.name === 'UserAuthenticationService');
      expect(sym?.keywords).toEqual(
        expect.arrayContaining(['user', 'authentication', 'service'])
      );
    });

    it('should not include very short words unless important', () => {
      const content = `function getById() {}`;
      const symbols = parser.parse('src/index.ts', content);
      const sym = symbols.find(s => s.name === 'getById');
      // 'by' is too short (2 chars) and not in the important list — should be filtered
      expect(sym?.keywords).not.toContain('by');
      // 'id' is in the important list
      expect(sym?.keywords).toContain('id');
      expect(sym?.keywords).toContain('get');
    });
  });

  describe('file path stored correctly', () => {
    it('should store the file path as provided', () => {
      const content = `function foo() {}`;
      const filePath = 'src/utils/helpers.ts';
      const symbols = parser.parse(filePath, content);
      expect(symbols[0].file).toBe(filePath);
    });
  });

  describe('TSX files', () => {
    const content = `
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};

export default Button;
`.trim();

    it('should parse TSX files without errors', () => {
      expect(() => parser.parse('src/components/Button.tsx', content)).not.toThrow();
    });

    it('should extract interface from TSX', () => {
      const symbols = parser.parse('src/components/Button.tsx', content);
      const names = symbols.map(s => s.name);
      expect(names).toContain('ButtonProps');
    });
  });
});
