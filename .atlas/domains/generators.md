# Domain: generators

**Directory:** `src/generators`
**Files:** 4
**Symbols:** 21

## Files

### `src/generators/conceptsGenerator.ts`

**Functions:**
- `generateConcepts` (line 7)
- `mergeConceptsForFiles` (line 48)


### `src/generators/conventionsGenerator.ts`

**Types:**
- `NamingStyle` (line 6)

**Functions:**
- `generateConventions` (line 11)
- `detectFileNaming` (line 46)
- `detectFunctionNaming` (line 76)
- `detectClassNaming` (line 103)
- `detectConstantNaming` (line 112)
- `detectTestRunner` (line 124)
- `detectTestLocation` (line 176)
- `detectFileStructure` (line 210)
- `detectPatterns` (line 241)
- `computeConfidence` (line 306)


### `src/generators/domainsGenerator.ts`

**Functions:**
- `detectDomains` (line 17)
- `generateDomainMarkdown` (line 105)
- `detectDataFlow` (line 169)
- `generateChangeRecipe` (line 191)
- `capitalize` (line 226)

**Routes:**
- `syms` (line 138)


### `src/generators/indexGenerator.ts`

**Functions:**
- `generateIndex` (line 5)
- `generateConstraintsMd` (line 35)


## Change Recipe

To add a new feature to the **generators** domain:

1. Register the new route/endpoint
