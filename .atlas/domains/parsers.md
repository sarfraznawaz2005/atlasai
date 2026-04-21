# Domain: parsers

**Directory:** `src/parsers`
**Files:** 5
**Symbols:** 19

## Files

### `src/parsers/genericParser.ts`

**Classs:**
- `GenericParser` (line 75)

**Interfaces:**
- `LanguagePatterns` (line 5)

**Methods:**
- `canParse` (line 76)
- `parse` (line 81)
- `parseGenericFallback` (line 138)
- `makeSymbol` (line 166)


### `src/parsers/identifierUtils.ts`

**Functions:**
- `decomposeIdentifier` (line 8)


### `src/parsers/parserFactory.ts`

**Functions:**
- `extractScriptContent` (line 15)
- `getParser` (line 27)
- `parseFile` (line 51)


### `src/parsers/pythonParser.ts`

**Classs:**
- `PythonParser` (line 5)

**Methods:**
- `canParse` (line 6)
- `parse` (line 10)


### `src/parsers/typescriptParser.ts`

**Classs:**
- `TypeScriptParser` (line 11)

**Functions:**
- `getLine` (line 39)
- `addSymbol` (line 44)
- `visitNode` (line 59)

**Methods:**
- `canParse` (line 12)
- `parse` (line 17)


## Change Recipe

To add a new feature to the **parsers** domain:

1. Add the new file under `src/parsers/`
2. Export from the domain index if applicable
