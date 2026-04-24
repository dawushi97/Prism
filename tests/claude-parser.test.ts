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

  test('aligns Claude session fields, summaries, compact markers, and tool results', () => {
    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const lines = [
      {
        type: 'summary',
        summary: 'Synthetic summary title',
        leafUuid: 'assistant-1'
      },
      {
        parentUuid: null,
        isSidechain: false,
        type: 'user',
        message: { role: 'user', content: 'hello prism' },
        uuid: 'user-1',
        timestamp: '2026-04-24T01:00:00.000Z',
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/tmp/prism',
        sessionId,
        version: '2.1.101',
        gitBranch: 'main',
        slug: 'synthetic-slug'
      },
      {
        parentUuid: 'user-1',
        isSidechain: false,
        type: 'assistant',
        message: {
          model: 'claude-opus-4-6',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will inspect it.' },
            { type: 'redacted_thinking', data: 'encrypted-thinking' },
            {
              type: 'server_tool_use',
              id: 'srv_1',
              name: 'WebSearch',
              input: { query: 'Claude Code session fields' }
            }
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation: {
              ephemeral_5m_input_tokens: 2,
              ephemeral_1h_input_tokens: 0
            }
          }
        },
        requestId: 'req_synthetic',
        uuid: 'assistant-1',
        timestamp: '2026-04-24T01:00:01.000Z',
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/tmp/prism',
        sessionId,
        version: '2.1.101',
        gitBranch: 'main',
        slug: 'synthetic-slug'
      },
      {
        parentUuid: 'assistant-1',
        isSidechain: false,
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'srv_1',
              content: 'search result text',
              is_error: false
            }
          ]
        },
        toolUseResult: {
          query: 'Claude Code session fields',
          results: [{ title: 'Result', url: 'https://example.com' }]
        },
        sourceToolAssistantUUID: 'assistant-1',
        uuid: 'tool-result-1',
        timestamp: '2026-04-24T01:00:02.000Z',
        userType: 'external',
        entrypoint: 'cli',
        cwd: '/tmp/prism',
        sessionId,
        version: '2.1.101',
        gitBranch: 'main',
        slug: 'synthetic-slug'
      },
      {
        type: 'system',
        subtype: 'compact_boundary',
        uuid: 'compact-1',
        logicalParentUuid: 'tool-result-1',
        parentUuid: 'tool-result-1',
        content: 'Conversation compacted',
        compactMetadata: { trigger: 'manual', preTokens: 1234 },
        timestamp: '2026-04-24T01:00:03.000Z',
        sessionId,
        cwd: '/tmp/prism',
        version: '2.1.101',
        gitBranch: 'main'
      },
      {
        type: 'queue-operation',
        operation: 'enqueue',
        content: 'queued prompt',
        sessionId,
        timestamp: '2026-04-24T01:00:04.000Z'
      },
      {
        type: 'progress',
        parentUuid: 'tool-result-1',
        uuid: 'progress-1',
        sessionId,
        timestamp: '2026-04-24T01:00:05.000Z',
        message: 'working'
      },
      {
        type: 'custom-title',
        customTitle: 'Synthetic renamed session',
        sessionId,
        timestamp: '2026-04-24T01:00:06.000Z'
      }
    ];

    const result = parseClaudeSession(lines);

    expect(result).not.toBeNull();
    expect(result?.conversation.title).toBe('Synthetic summary title');
    expect(result?.stats.summaryMessages).toBe(1);
    expect(result?.stats.compactBoundaries).toBe(1);
    expect(result?.stats.queueOperations).toBe(1);
    expect(result?.stats.progressEvents).toBe(1);
    expect(result?.stats.titleEvents).toBe(1);
    expect(result?.stats.metadataEvents).toBeGreaterThan(0);
    expect(result?.stats.progressForks).toBe(1);
    expect(result?.stats.branchPoints).toBe(1);
    expect(result?.stats.conversationBranchPoints).toBe(0);
    expect(result?.stats.hasCompact).toBe(true);
    expect(result?.stats.hasToolUseResult).toBe(true);

    const toolResults =
      result?.conversation.messages.filter(
        message => message.channel === 'tool_result'
      ) ?? [];
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]).toMatchObject({
      uuid: 'tool-result-1',
      sessionId,
      lineType: 'user',
      toolUseId: 'srv_1',
      name: 'WebSearch',
      sourceToolAssistantUUID: 'assistant-1'
    });
    expect(toolResults[0].toolUseResult).toEqual({
      query: 'Claude Code session fields',
      results: [{ title: 'Result', url: 'https://example.com' }]
    });

    const toolCall = result?.conversation.messages.find(
      message => message.channel === 'tool_call'
    );
    expect(toolCall).toMatchObject({
      uuid: 'assistant-1',
      sessionId,
      requestId: 'req_synthetic',
      model: 'claude-opus-4-6',
      toolUseId: 'srv_1',
      name: 'WebSearch'
    });

    const duplicateUserToolText =
      result?.conversation.messages.filter(
        message =>
          message.channel === 'message' &&
          Array.isArray(
            (message.raw.message as { content?: unknown } | undefined)?.content
          ) &&
          (
            (message.raw.message as { content: Array<{ type?: string }> })
              .content
          ).every(part => part.type === 'tool_result')
      ) ?? [];
    expect(duplicateUserToolText).toHaveLength(0);

    const metadata = result?.conversation.metadata as {
      claudeFields: { sessionIds: string[]; versions: string[] };
      claudeIndexes: {
        childrenByParentUuid: Record<string, string[]>;
        conversationBranchPoints: Array<{ uuid: string; children: string[] }>;
        progressForks: number;
        toolResultsByToolUseId: Record<string, string>;
      };
    };
    expect(metadata.claudeFields.sessionIds).toContain(sessionId);
    expect(metadata.claudeFields.versions).toContain('2.1.101');
    expect(metadata.claudeIndexes.childrenByParentUuid['user-1']).toContain(
      'assistant-1'
    );
    expect(metadata.claudeIndexes.conversationBranchPoints).toHaveLength(0);
    expect(metadata.claudeIndexes.progressForks).toBe(1);
    expect(metadata.claudeIndexes.toolResultsByToolUseId.srv_1).toBe(
      'tool-result-1'
    );
  });

  test('accepts newer session metadata entries and parent tool use linkage', () => {
    const lines = [
      {
        type: 'custom-title',
        customTitle: 'Named session',
        sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        timestamp: '2026-04-24T01:00:00.000Z'
      },
      {
        type: 'content-replacement',
        uuid: 'replacement-1',
        sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        timestamp: '2026-04-24T01:00:01.000Z',
        replacement: { kind: 'tool-output' }
      },
      {
        parentUuid: null,
        parent_tool_use_id: 'toolu_parent',
        isSidechain: true,
        agentId: 'agent-1',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'subagent result' }]
        },
        uuid: 'sidechain-assistant-1',
        timestamp: '2026-04-24T01:00:02.000Z',
        sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      }
    ];

    const result = parseClaudeSession(lines);
    const assistantMessage = result?.conversation.messages.find(
      message => message.role === 'assistant'
    );

    expect(result).not.toBeNull();
    expect(result?.stats.titleEvents).toBe(1);
    expect(result?.stats.metadataEvents).toBe(2);
    expect(assistantMessage?.parentToolUseId).toBe('toolu_parent');
    expect(assistantMessage?.agentId).toBe('agent-1');
  });

  test('keeps string toolUseResult as the structured tool result payload', () => {
    const lines = [
      {
        parentUuid: null,
        isSidechain: false,
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_error',
              content: 'Error: failed',
              is_error: true
            }
          ]
        },
        toolUseResult: 'Error: Exit code 128',
        uuid: 'string-result',
        timestamp: '2026-04-24T01:00:00.000Z',
        sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      }
    ];

    const result = parseClaudeSession(lines);
    const toolResult = result?.conversation.messages.find(
      message => message.channel === 'tool_result'
    );

    expect(toolResult?.toolUseResult).toBe('Error: Exit code 128');
    expect(result?.stats.hasToolUseResult).toBe(true);
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
