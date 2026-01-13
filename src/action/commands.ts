/**
 * Command parsing for GitHub Action PR comments
 */

export type ParsedCommand =
  | { type: 'rerun' }
  | { type: 'fix'; issueId: number }
  | { type: 'fix-all' }
  | { type: 'dismiss'; issueId: number };

/**
 * Parse a command from a PR comment
 */
export function parseCommand(text: string): ParsedCommand | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // Normalize to lowercase for case-insensitive matching
  const lower = trimmed.toLowerCase();

  // /peakinfer or /peakinfer rerun
  if (lower === '/peakinfer' || lower === '/peakinfer rerun') {
    return { type: 'rerun' };
  }

  // /fix <id> or /peakinfer fix <id>
  const fixMatch = trimmed.match(/^\/peakinfer\s+fix\s+(\d+)$/i) || trimmed.match(/^\/fix\s+(\d+)$/i);
  if (fixMatch) {
    return { type: 'fix', issueId: parseInt(fixMatch[1], 10) };
  }

  // /fix all or /peakinfer fix all
  const fixAllMatch = trimmed.match(/^\/peakinfer\s+fix\s+all$/i) || trimmed.match(/^\/fix\s+all$/i);
  if (fixAllMatch) {
    return { type: 'fix-all' };
  }

  // /dismiss <id> or /peakinfer dismiss <id>
  const dismissMatch = trimmed.match(/^\/peakinfer\s+dismiss\s+(\d+)$/i) || trimmed.match(/^\/dismiss\s+(\d+)$/i);
  if (dismissMatch) {
    return { type: 'dismiss', issueId: parseInt(dismissMatch[1], 10) };
  }

  // Not a valid command
  return null;
}

