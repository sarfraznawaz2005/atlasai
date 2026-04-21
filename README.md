# agent-atlas

Auto-generate a structured navigation layer for AI agents to understand any codebase — no vector store, no embeddings, no external services.

---

## The Problem

AI coding agents (Claude Code, Cursor, Gemini CLI, GitHub Copilot, etc.) start every session with zero knowledge of your project. Current workarounds all break down at scale:

- **CLAUDE.md / agents.md** — you write it by hand, it goes stale immediately, and it can't capture every file and symbol across a large codebase
- **RAG / embeddings** — precise when tuned, but requires a vector store, embedding pipeline, and ongoing infrastructure to maintain
- **Dumping the full codebase** — burns thousands of tokens and still forces the agent to reason about which files are relevant

The result: agents explore the wrong directories, re-read files they already visited, make changes in the wrong layer, and ask clarifying questions that any senior engineer on the team could answer in five seconds.

---

## The Solution

Atlas scans your project and writes a `.agent-atlas/` directory — a file-resident navigation layer made of plain JSON and Markdown. Every file has a stable path. Any agent reads it with the same file tools it already uses.

No infrastructure. No embeddings. No external API calls. Run one command, commit the output, and every agent that opens the project gets a structured map of exactly what exists and where.

---

## Comparison

| | CLAUDE.md / agents.md | RAG / embeddings | Full codebase dump | No context | **Atlas** |
|---|---|---|---|---|---|
| Manually maintained | Yes | No | No | — | No |
| Requires infrastructure | No | Yes | No | — | No |
| Precise file:line pointers | No | Sometimes | No | — | Yes |
| Captures constraints / why | Yes (if written) | No | No | — | Yes (template) |
| Improves over time | No | No | No | — | Yes |
| Works with any AI agent | Yes | No | Yes | — | Yes |
| Survives codebase churn | No | No | No | — | Yes |
| Tokens consumed by agent | ~1k | ~500 | ~50k–500k | 0 | ~2k–5k |

---

## What Gets Generated

Running `agent-atlas init` produces the following inside `.agent-atlas/`:

### `index.json` — front door (~2k tokens)

The first file every agent should read. Contains project type, primary language, entry points, a map of domain names to their domain files, and pointers to all other atlas files.

```json
{
  "project": {
    "name": "atlas-ai",
    "type": "Node.js",
    "language": "TypeScript",
    "languages": ["TypeScript"]
  },
  "entry_points": {
    "main": "./dist/cli.js"
  },
  "domains": {
    "commands": ".agent-atlas/domains/commands.md",
    "generators": ".agent-atlas/domains/generators.md",
    "parsers": ".agent-atlas/domains/parsers.md",
    "utils": ".agent-atlas/domains/utils.md",
    "git": ".agent-atlas/domains/git.md"
  },
  "concepts_index": ".agent-atlas/concepts.json",
  "conventions": ".agent-atlas/conventions.json",
  "constraints": ".agent-atlas/constraints.md",
  "architecture_pattern": "Flat / Unstructured",
  "last_generated": "2026-04-21T13:23:45.920Z"
}
```

### `concepts.json` — keyword-to-location map

Every symbol extracted from source is decomposed into keywords. The result is a grep-queryable map from keyword to a list of `{ file, line, symbol, type }` records. An agent looking for "notification" can read this file and immediately know every relevant file and line number.

```json
{
  "symbol": [
    { "file": "src/parsers/genericParser.ts", "line": 166, "symbol": "makeSymbol", "type": "method" },
    { "file": "src/parsers/typescriptParser.ts", "line": 44, "symbol": "addSymbol", "type": "function" },
    { "file": "src/types.ts", "line": 1, "symbol": "ParsedSymbol", "type": "interface" }
  ],
  "parsed": [
    { "file": "src/types.ts", "line": 1, "symbol": "ParsedSymbol", "type": "interface" }
  ]
}
```

### `domains/*.md` — one file per logical domain

Each domain file lists every source file in the domain, every symbol with its line number grouped by type, a detected data flow pattern, and a change recipe — a numbered checklist of what to touch when adding a feature to that domain.

```markdown
# Domain: parsers

**Directory:** `src/parsers`
**Files:** 5
**Symbols:** 19

## Files

### `src/parsers/typescriptParser.ts`

**Classes:**
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
```

### `conventions.json` — auto-extracted naming and test patterns

Atlas inspects your source files and infers naming conventions, the testing runner and test file location, and the detected file structure pattern. Confidence is reported so the agent knows how much to trust the inference.

```json
{
  "naming": {
    "files": "camelCase",
    "functions": "camelCase",
    "classes": "PascalCase",
    "constants": "SCREAMING_SNAKE_CASE",
    "confidence": 1
  },
  "patterns": {
    "routing": "Express-style route handlers"
  },
  "test_patterns": {
    "location": "tests/ directory",
    "runner": "jest"
  },
  "file_structure": {
    "detected_pattern": "src/ root with subdirectories"
  }
}
```

### `constraints.md` — cross-cutting invariants (human-reviewed)

A structured template pre-populated with common constraint categories: authentication, data validation, error handling, database, security, testing, and deployment. Atlas generates the skeleton; your team fills in the actual rules. This is the one file intended for human editing.

### `history.jsonl` — append-only agent task log

An empty file at init time. After each task, your agent appends a record describing its intent, which files it read, and which files it changed. Over time this creates a ground-truth mapping that `agent-atlas update` uses to improve domain files. See [Self-Improving Index](#self-improving-index).

---

## How It Works With Any Agent

`agent-atlas init` detects common agent configuration files in your project root and appends a single bridge line to each one that already exists:

```
Before starting any task, read .agent-atlas/index.json first.
```

| Agent | Config file |
|---|---|
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| Cursor | `.cursorrules` |

That one line is the only change to your existing agent configuration. The rest of the protocol follows from reading `index.json`.

**Agent protocol:**

1. Read `.agent-atlas/index.json` — identify project type, architecture, and available domains
2. Map the task to the relevant domain(s) from `index.json`'s `domains` map
3. Read the matching `domains/*.md` file — get the file list, symbol locations, and change recipe
4. Look up task-relevant keywords in `concepts.json` — get exact `file:line` pointers
5. Read only the target files — make the change
6. Append a record to `history.jsonl`

---

## Installation

```bash
npm install -g agent-atlas
```

Or use without installing:

```bash
npx agent-atlas init
```

---

## Usage

```bash
agent-atlas init [path]     # Full generation of all .agent-atlas/ files for a project
agent-atlas update [path]   # Incremental update — only changed files are re-processed
agent-atlas watch [path]    # Watch mode — auto-updates .agent-atlas/ on file save
```

All commands default to the current directory if `[path]` is omitted.

`atlas update` reads `last_generated` from `index.json` and only re-parses files with a newer modification time. If `.agent-atlas/index.json` does not exist, it falls back to a full `init`.

`agent-atlas watch` uses [chokidar](https://github.com/paulmillr/chokidar) to monitor source files and debounces updates by 500ms to batch rapid saves into a single update pass.

---

## Ignoring Files

Agent Atlas uses a three-layer ignore system applied on every `init` and `update` run.

### Layer 1: Built-in patterns (always active)

The following are always ignored regardless of any ignore files:

```
node_modules  dist        build       coverage    .next
.nuxt         .cache      .turbo      .git        __pycache__
.venv         venv        vendor      target      .agent-atlas
out           tmp         temp        .yarn       bower_components
*.min.js      *.min.css   *.map       *.d.ts      *.lock files
```

### Layer 2: `.gitignore`

If a `.gitignore` exists at the project root it is automatically parsed and respected. No configuration needed.

### Layer 3: `.agentatlasignore`

Create a `.agentatlasignore` at your project root to exclude additional paths specific to agent scanning. It follows the same syntax as `.gitignore`:

```gitignore
# Exclude generated API clients
src/generated/

# Exclude a specific vendor bundle kept in source
public/vendor.js

# Exclude all fixture files
**/__fixtures__/
tests/fixtures/

# Exclude a noisy config directory
.storybook/
```

The file is optional. If it does not exist, only the built-in patterns and `.gitignore` apply.

### Precedence

Built-in patterns → `.gitignore` → `.agentatlasignore`

A path ignored by any layer is excluded. There is no way to un-ignore a path that a higher-priority layer has excluded.

---

## Supported Languages

| Language | Parser |
|---|---|
| TypeScript, TSX | TypeScript Compiler API (AST-based) |
| JavaScript, JSX | TypeScript Compiler API (AST-based) |
| Python | Regex-based |
| Go | Regex-based |
| Rust | Regex-based |
| Ruby | Regex-based |
| Java | Regex-based |
| Kotlin | Regex-based |
| PHP | Regex-based |
| Swift | Regex-based |
| C, C++ | Regex-based |
| C# | Regex-based |
| Vue | Script block extracted, then TypeScript/JS parser |
| Svelte | Script block extracted, then TypeScript/JS parser |

TypeScript and JavaScript use the TypeScript Compiler API, which walks the real AST. All other languages use pattern-based extraction. Symbol precision is higher for TypeScript/JavaScript projects.

---

## The Agent Protocol — Concrete Walkthrough

**Task:** "Add email notification on user registration"

**Step 1 — Read `index.json`** (~2k tokens)

The agent sees domains including `users`, `notifications`, and `services`. It also sees `architecture_pattern` and `conventions` pointers.

**Step 2 — Read `.agent-atlas/domains/users.md`** (~1k tokens)

The domain file shows `src/users/userService.ts` with a `registerUser` function at line 47. The change recipe says: update the service layer, register a new route if needed, add tests.

**Step 3 — Read `.agent-atlas/domains/notifications.md`** (~1k tokens)

Shows `src/notifications/emailService.ts` with a `sendEmail` function at line 12 and a `NotificationTemplate` interface at line 3.

**Step 4 — Query `concepts.json` for "email"** (~0.5k tokens, one key lookup)

```json
"email": [
  { "file": "src/notifications/emailService.ts", "line": 12, "symbol": "sendEmail", "type": "function" },
  { "file": "src/users/userModel.ts", "line": 8, "symbol": "UserEmail", "type": "type" }
]
```

**Step 5 — Read `src/users/userService.ts` and `src/notifications/emailService.ts`**

The agent has the exact line numbers. It reads two files, finds `registerUser` and `sendEmail`, and writes the integration. It does not need to explore any other directory.

**Step 6 — Append to `history.jsonl`**

```jsonl
{"intent":"add email notification on user registration","files_read":["src/users/userService.ts","src/notifications/emailService.ts"],"files_changed":["src/users/userService.ts"],"timestamp":"2026-04-21T14:02:11Z"}
```

Total tokens consumed before the agent wrote a single line of code: approximately 4.5k. A full codebase dump of the same project would cost 80k–200k tokens and still require the agent to reason about relevance.

---

## Self-Improving Index

`history.jsonl` is an append-only log. Each record written by the agent contains:

- `intent` — natural language description of the task
- `files_read` — every file the agent opened
- `files_changed` — files that were actually modified
- `timestamp` — ISO 8601

When you run `agent-atlas update` after accumulating history, the generator reads these records and uses the `intent → files_changed` mappings as additional signal when regenerating domain files. Domains that accumulate task history get richer change recipes and more accurate file prioritization over time.

The history file is plain text. It is safe to commit. It is the only part of `.agent-atlas/` that grows with usage rather than being fully regenerated.

---

## Git Hook

`agent-atlas init` installs a pre-commit hook at `.git/hooks/pre-commit` that runs `agent-atlas update` and stages the result before every commit:

```sh
#!/bin/sh
# agent-atlas pre-commit hook

npx agent-atlas update
git add .agent-atlas/
```

If a pre-commit hook already exists, agent-atlas appends its commands to the end of the existing file rather than replacing it.

If no `.git/` directory is found (monorepo sub-package, non-git project), agent-atlas skips hook installation and prints:

```
No .git directory found. Run `agent-atlas watch` to keep .agent-atlas/ up to date automatically.
```

---

## License

MIT
