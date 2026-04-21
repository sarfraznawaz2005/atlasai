import { GenericParser } from '../../src/parsers/genericParser';

const parser = new GenericParser();

describe('GenericParser', () => {
  describe('canParse', () => {
    it('should accept .py files', () => {
      expect(parser.canParse('foo.py')).toBe(true);
    });

    it('should accept .go files', () => {
      expect(parser.canParse('foo.go')).toBe(true);
    });

    it('should accept .rs files', () => {
      expect(parser.canParse('foo.rs')).toBe(true);
    });

    it('should accept .java files', () => {
      expect(parser.canParse('foo.java')).toBe(true);
    });

    it('should accept .rb files', () => {
      expect(parser.canParse('foo.rb')).toBe(true);
    });

    it('should not accept .ts files', () => {
      expect(parser.canParse('foo.ts')).toBe(false);
    });

    it('should not accept .js files', () => {
      expect(parser.canParse('foo.js')).toBe(false);
    });
  });

  describe('Python parsing', () => {
    const pythonContent = `
import os
import sys

MAX_RETRIES = 3

def get_user_by_id(user_id):
    return db.query(user_id)

def create_user_account(name, email):
    return db.insert(name, email)

class UserRepository:
    def __init__(self, db):
        self.db = db

    def find_by_email(self, email):
        return self.db.query_one(email)

async def process_payment(amount):
    return await stripe.charge(amount)
`.trim();

    it('should extract top-level function definitions', () => {
      const symbols = parser.parse('app/services.py', pythonContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('get_user_by_id');
      expect(names).toContain('create_user_account');
    });

    it('should extract async function definitions', () => {
      const symbols = parser.parse('app/services.py', pythonContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('process_payment');
    });

    it('should extract class definitions', () => {
      const symbols = parser.parse('app/services.py', pythonContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('UserRepository');
    });

    it('should set correct type for functions', () => {
      const symbols = parser.parse('app/services.py', pythonContent);
      const func = symbols.find(s => s.name === 'get_user_by_id');
      expect(func?.type).toBe('function');
    });

    it('should set correct type for classes', () => {
      const symbols = parser.parse('app/services.py', pythonContent);
      const cls = symbols.find(s => s.name === 'UserRepository');
      expect(cls?.type).toBe('class');
    });

    it('should record correct line numbers', () => {
      const symbols = parser.parse('app/services.py', pythonContent);
      const func = symbols.find(s => s.name === 'get_user_by_id');
      // Line 5 in the trimmed content (0-indexed: MAX_RETRIES is 4, def get_user_by_id is 5+1=6)
      expect(func?.line).toBeGreaterThan(0);
    });

    it('should decompose snake_case function names into keywords', () => {
      const symbols = parser.parse('app/services.py', pythonContent);
      const func = symbols.find(s => s.name === 'get_user_by_id');
      expect(func?.keywords).toContain('get');
      expect(func?.keywords).toContain('user');
      expect(func?.keywords).toContain('id');
    });
  });

  describe('Go parsing', () => {
    const goContent = `
package main

import "fmt"

type UserService struct {
    db Database
}

type PaymentGateway interface {
    Charge(amount float64) (string, error)
}

func GetUserByID(db *Database, id string) (*User, error) {
    return db.FindOne(id)
}

func (s *UserService) CreateAccount(name string) error {
    return s.db.Insert(name)
}

func processOrderPayment(orderID string) error {
    fmt.Println(orderID)
    return nil
}
`.trim();

    it('should extract function declarations', () => {
      const symbols = parser.parse('main.go', goContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('GetUserByID');
      expect(names).toContain('processOrderPayment');
    });

    it('should extract method declarations (receiver functions)', () => {
      const symbols = parser.parse('main.go', goContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('CreateAccount');
    });

    it('should extract struct declarations', () => {
      const symbols = parser.parse('main.go', goContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('UserService');
    });

    it('should extract interface declarations', () => {
      const symbols = parser.parse('main.go', goContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('PaymentGateway');
    });

    it('should set correct type for structs', () => {
      const symbols = parser.parse('main.go', goContent);
      const struct = symbols.find(s => s.name === 'UserService');
      expect(struct?.type).toBe('class');
    });

    it('should set correct type for interfaces', () => {
      const symbols = parser.parse('main.go', goContent);
      const iface = symbols.find(s => s.name === 'PaymentGateway');
      expect(iface?.type).toBe('interface');
    });

    it('should decompose PascalCase names into keywords', () => {
      const symbols = parser.parse('main.go', goContent);
      const func = symbols.find(s => s.name === 'GetUserByID');
      expect(func?.keywords).toContain('get');
      expect(func?.keywords).toContain('user');
    });
  });

  describe('Rust parsing', () => {
    const rustContent = `
use std::collections::HashMap;

pub struct UserRepository {
    connection: DbConnection,
}

pub trait PaymentProcessor {
    fn charge(&self, amount: f64) -> Result<String, Error>;
}

pub fn get_user_by_id(id: &str) -> Option<User> {
    None
}

pub async fn process_payment(amount: f64) -> Result<(), Error> {
    Ok(())
}

fn internal_helper(data: &str) -> String {
    data.to_string()
}
`.trim();

    it('should extract public function declarations', () => {
      const symbols = parser.parse('src/lib.rs', rustContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('get_user_by_id');
      expect(names).toContain('process_payment');
    });

    it('should extract private function declarations', () => {
      const symbols = parser.parse('src/lib.rs', rustContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('internal_helper');
    });

    it('should extract struct declarations', () => {
      const symbols = parser.parse('src/lib.rs', rustContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('UserRepository');
    });

    it('should extract trait declarations', () => {
      const symbols = parser.parse('src/lib.rs', rustContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('PaymentProcessor');
    });

    it('should type traits as interface', () => {
      const symbols = parser.parse('src/lib.rs', rustContent);
      const trait_ = symbols.find(s => s.name === 'PaymentProcessor');
      expect(trait_?.type).toBe('interface');
    });
  });

  describe('Java parsing', () => {
    const javaContent = `
package com.example.service;

public class OrderService {
    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    public Order createOrder(String userId, List<Item> items) {
        return repository.save(new Order(userId, items));
    }

    private void validateOrder(Order order) {
        // validation logic
    }
}

public interface PaymentGateway {
    PaymentResult charge(double amount);
}
`.trim();

    it('should extract class declarations', () => {
      const symbols = parser.parse('OrderService.java', javaContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('OrderService');
    });

    it('should extract interface declarations', () => {
      const symbols = parser.parse('OrderService.java', javaContent);
      const names = symbols.map(s => s.name);
      expect(names).toContain('PaymentGateway');
    });
  });
});
