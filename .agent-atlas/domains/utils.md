# Domain: utils

**Directory:** `src/utils`
**Files:** 4
**Symbols:** 34

## Files

### `src/utils/fileUtils.ts`

**Functions:**
- `ensureDir` (line 4)
- `writeJSON` (line 10)
- `readJSON` (line 16)
- `writeFile` (line 26)
- `readFile` (line 31)
- `appendLine` (line 40)
- `fileExists` (line 44)
- `getFileMtime` (line 48)
- `toRelativePath` (line 57)
- `toAbsolutePath` (line 61)
- `listDir` (line 65)
- `isDirectory` (line 70)


### `src/utils/ignoreUtils.ts`

**Interfaces:**
- `IgnoreRules` (line 48)

**Functions:**
- `loadIgnoreRules` (line 57)
- `shouldIgnore` (line 88)

**Exports:**
- `ALWAYS_IGNORED_DIRS` (line 6)
- `ALWAYS_IGNORED_PATTERNS` (line 35)


### `src/utils/logger.ts`

**Methods:**
- `info` (line 12)
- `success` (line 16)
- `warn` (line 20)
- `error` (line 24)
- `debug` (line 28)
- `step` (line 34)
- `summary` (line 38)

**Exports:**
- `logger` (line 11)


### `src/utils/projectDetector.ts`

**Interfaces:**
- `ProjectInfo` (line 5)
- `PackageJson` (line 14)
- `CargoToml` (line 21)

**Functions:**
- `detectProject` (line 45)
- `detectProjectName` (line 63)
- `detectLanguages` (line 102)
- `detectProjectType` (line 118)
- `detectEntryPoints` (line 152)
- `detectArchitecturePattern` (line 227)


## Change Recipe

To add a new feature to the **utils** domain:

1. Add the new file under `src/utils/`
2. Export from the domain index if applicable
