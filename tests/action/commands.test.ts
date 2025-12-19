import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../src/action/commands.js';

// =============================================================================
// COMMAND PARSING TESTS
// =============================================================================

describe('parseCommand', () => {
  describe('/peakinfer command', () => {
    it('parses /peakinfer as rerun', () => {
      const cmd = parseCommand('/peakinfer');
      expect(cmd).toEqual({ type: 'rerun' });
    });

    it('parses /peakinfer rerun as rerun', () => {
      const cmd = parseCommand('/peakinfer rerun');
      expect(cmd).toEqual({ type: 'rerun' });
    });

    it('is case insensitive', () => {
      const cmd = parseCommand('/PEAKINFER');
      expect(cmd).toEqual({ type: 'rerun' });
    });

    it('trims whitespace', () => {
      const cmd = parseCommand('  /peakinfer  ');
      expect(cmd).toEqual({ type: 'rerun' });
    });
  });

  describe('/fix command', () => {
    it('parses /fix <id> correctly', () => {
      const cmd = parseCommand('/fix 1');
      expect(cmd).toEqual({ type: 'fix', issueId: 1 });
    });

    it('parses /fix with larger ids', () => {
      const cmd = parseCommand('/fix 123');
      expect(cmd).toEqual({ type: 'fix', issueId: 123 });
    });

    it('parses /peakinfer fix <id>', () => {
      const cmd = parseCommand('/peakinfer fix 5');
      expect(cmd).toEqual({ type: 'fix', issueId: 5 });
    });

    it('parses /fix all as fix-all', () => {
      const cmd = parseCommand('/fix all');
      expect(cmd).toEqual({ type: 'fix-all' });
    });

    it('parses /peakinfer fix all', () => {
      const cmd = parseCommand('/peakinfer fix all');
      expect(cmd).toEqual({ type: 'fix-all' });
    });
  });

  describe('/dismiss command', () => {
    it('parses /dismiss <id> correctly', () => {
      const cmd = parseCommand('/dismiss 2');
      expect(cmd).toEqual({ type: 'dismiss', issueId: 2 });
    });

    it('parses /peakinfer dismiss <id>', () => {
      const cmd = parseCommand('/peakinfer dismiss 7');
      expect(cmd).toEqual({ type: 'dismiss', issueId: 7 });
    });
  });

  describe('non-commands', () => {
    it('returns null for regular comments', () => {
      expect(parseCommand('Great work on this PR!')).toBeNull();
    });

    it('returns null for partial commands', () => {
      expect(parseCommand('/fix')).toBeNull();
      expect(parseCommand('/dismiss')).toBeNull();
    });

    it('returns null for invalid ids', () => {
      expect(parseCommand('/fix abc')).toBeNull();
      expect(parseCommand('/dismiss xyz')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseCommand('')).toBeNull();
    });

    it('returns null for comments mentioning peakinfer', () => {
      expect(parseCommand('can you run peakinfer again?')).toBeNull();
    });
  });
});

// =============================================================================
// COMMAND SCENARIOS
// =============================================================================

describe('Command Scenarios', () => {
  it('user wants to re-run analysis after fixing issues', () => {
    // User pushes fixes, then comments to re-analyze
    const cmd = parseCommand('/peakinfer');
    expect(cmd?.type).toBe('rerun');
  });

  it('user wants to accept a specific fix', () => {
    // User reviews the top issue and accepts it
    const cmd = parseCommand('/fix 1');
    expect(cmd?.type).toBe('fix');
    expect(cmd?.issueId).toBe(1);
  });

  it('user wants to dismiss an issue they disagree with', () => {
    // User thinks the issue is a false positive
    const cmd = parseCommand('/dismiss 3');
    expect(cmd?.type).toBe('dismiss');
    expect(cmd?.issueId).toBe(3);
  });

  it('user wants to accept all available fixes', () => {
    // User trusts all suggestions and wants to apply them
    const cmd = parseCommand('/fix all');
    expect(cmd?.type).toBe('fix-all');
  });
});
