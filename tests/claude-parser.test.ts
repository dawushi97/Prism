import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
  isClaudeSessionJSONL,
  parseClaudeMeta,
  parseClaudeSession
} from '../src/adapters/claude/parser';

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), 'tests/fixtures', name), 'utf8');

const parseJSONLLines = (name: string) =>
  fixture(name)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as unknown);

describe('Claude session detection', () => {
  test('detects a main Claude session JSONL file', () => {
    const lines = parseJSONLLines('main-session.jsonl');

    expect(isClaudeSessionJSONL(lines)).toBe(true);
  });

  test('detects a subagent Claude session JSONL file', () => {
    const lines = parseJSONLLines('subagent-session.jsonl');

    expect(isClaudeSessionJSONL(lines)).toBe(true);
  });
});

describe('Claude session parsing', () => {
  test('parses a main session into a normalized conversation', () => {
    const lines = parseJSONLLines('main-session.jsonl');

    const result = parseClaudeSession(lines);

    expect(result).not.toBeNull();
    expect(result?.conversation.source).toBe('claude-session');
    expect(result?.conversation.sessionId).toBe(
      'd3d74cf2-b10e-47d5-a5ee-45ee2e113a0a'
    );
    expect(result?.conversation.messages.length).toBeGreaterThan(20);
    expect(result?.stats.hasSidechain).toBe(false);
    expect(result?.stats.eventMessages).toBeGreaterThan(0);
  });

  test('keeps sidechain markers and tool call/result channels', () => {
    const lines = parseJSONLLines('subagent-session.jsonl');

    const result = parseClaudeSession(lines);
    const channels = new Set(result?.conversation.messages.map(m => m.channel));
    const sidechainMessages =
      result?.conversation.messages.filter(m => m.isSidechain) ?? [];
    const recipients = new Set(
      result?.conversation.messages
        .map(message => message.recipient)
        .filter(Boolean) ?? []
    );

    expect(result).not.toBeNull();
    expect(sidechainMessages.length).toBeGreaterThan(0);
    expect(channels.has('tool_call')).toBe(true);
    expect(channels.has('tool_result')).toBe(true);
    expect(recipients.has('Bash')).toBe(true);
  });

  test('classifies attachment and system rows as event messages', () => {
    const lines = parseJSONLLines('main-session.jsonl');

    const result = parseClaudeSession(lines);
    const eventMessages =
      result?.conversation.messages.filter(message => message.channel === 'event') ??
      [];

    expect(eventMessages.length).toBeGreaterThan(0);
    expect(
      eventMessages.some(message =>
        String(message.raw.type).includes('attachment')
      )
    ).toBe(true);
    expect(
      eventMessages.some(message => String(message.raw.type).includes('system'))
    ).toBe(true);
  });

  test('preserves malformed lines as raw meta events and records a warning', () => {
    const brokenLines = `${fixture('main-session.jsonl')}\n{not-json}\n`;
    const parsed = brokenLines
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return line;
        }
      });

    const result = parseClaudeSession(parsed);

    expect(result).not.toBeNull();
    expect(result?.warnings.length).toBeGreaterThan(0);
    expect(
      result?.conversation.messages.some(
        message =>
          message.role === 'meta' &&
          message.raw.type === 'parse_warning' &&
          String(message.text).includes('{not-json}')
      )
    ).toBe(true);
    expect(result?.conversation.messages.length).toBeGreaterThan(20);
  });
});

describe('Claude meta parsing', () => {
  test('summarizes a .meta.json file without pretending it is a session', () => {
    const meta = JSON.parse(fixture('subagent-session.meta.json')) as unknown;

    const summary = parseClaudeMeta(meta);

    expect(summary).not.toBeNull();
    expect(summary?.agentId).toBeNull();
    expect(summary?.agentType).toBe('general-purpose');
    expect(summary?.description).toContain('Search lab conversation logs');
  });
});
