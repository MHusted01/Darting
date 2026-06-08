const MENTION_RE = /(?:^|[^\w@])@([a-zA-Z0-9_]{2,})/g;

export function parseMentions(body: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(body)) !== null) {
    const handle = match[1].toLowerCase();
    if (!seen.has(handle)) {
      seen.add(handle);
      results.push(handle);
    }
  }
  MENTION_RE.lastIndex = 0;
  return results;
}
