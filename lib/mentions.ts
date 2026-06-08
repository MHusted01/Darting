const MENTION_RE = /(?:^|[^\w@])@([a-zA-Z0-9_]{2,})/g;
const ACTIVE_MENTION_RE = /@([a-zA-Z0-9_]*)$/;

export function getActiveMentionQuery(text: string): string | null {
  const match = ACTIVE_MENTION_RE.exec(text);
  return match ? match[1] : null;
}

export function insertMention(text: string, username: string): string {
  const match = ACTIVE_MENTION_RE.exec(text);
  if (!match) return text;
  return `${text.slice(0, match.index)}@${username} `;
}

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
