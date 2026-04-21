const IMPORTANT_SHORT_WORDS = new Set(['id', 'db', 'ui', 'vm', 'io', 'os', 'fs', 'fn', 'rx']);
const MIN_KEYWORD_LENGTH = 3;

/**
 * Decompose a programming identifier into searchable keywords.
 * Handles camelCase, PascalCase, snake_case, kebab-case, and SCREAMING_SNAKE_CASE.
 */
export function decomposeIdentifier(name: string): string[] {
  // Split on route/path separators first (handles symbols like "POST:/register", "GET:/:id")
  const slashParts = name.split(/[/:]+/);

  // Rejoin with spaces so they're treated as separate words, then clean
  const preJoined = slashParts.join(' ');

  // Remove remaining special chars (keep alphanumeric, underscore, hyphen, space)
  const cleaned = preJoined.replace(/[^a-zA-Z0-9_\- ]/g, ' ');

  // Split on underscores, hyphens, and spaces first
  const underscoreParts = cleaned.split(/[_\-\s]+/);

  const allParts: string[] = [];

  for (const part of underscoreParts) {
    if (!part) continue;

    // Split camelCase / PascalCase
    // Insert splits before uppercase letters that follow lowercase, or before uppercase + lowercase sequences
    const camelParts = part
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(' ');

    for (const cp of camelParts) {
      if (cp) allParts.push(cp.toLowerCase());
    }
  }

  // Filter and deduplicate
  const seen = new Set<string>();
  const result: string[] = [];

  for (const word of allParts) {
    if (!word) continue;
    if (seen.has(word)) continue;
    seen.add(word);

    // Keep if long enough, or if it's an important short word
    if (word.length >= MIN_KEYWORD_LENGTH || IMPORTANT_SHORT_WORDS.has(word)) {
      result.push(word);
    }
  }

  return result;
}
