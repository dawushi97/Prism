import type {
  ClaudeMetaSummary,
  ClaudeSessionParseResult,
  ClaudeSessionStats,
  NormalizedConversation,
  NormalizedMessage,
  PrismChannel,
  PrismRole
} from '../../types/prism';

type UnknownRecord = Record<string, unknown>;

const CLAUDE_TOP_LEVEL_TYPES = new Set([
  'user',
  'assistant',
  'attachment',
  'system',
  'file-history-snapshot',
  'permission-mode',
  'last-prompt'
]);

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const asRecord = (value: unknown): UnknownRecord | null =>
  isRecord(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const stringify = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const isClaudeEvent = (value: unknown): value is UnknownRecord => {
  const record = asRecord(value);
  if (!record) {
    return false;
  }

  const type = asString(record.type);
  if (!type || !CLAUDE_TOP_LEVEL_TYPES.has(type)) {
    return false;
  }

  if (type === 'user' || type === 'assistant') {
    return isRecord(record.message);
  }

  return true;
};

const getSessionId = (events: UnknownRecord[]): string | null => {
  for (const event of events) {
    const sessionId = asString(event.sessionId);
    if (sessionId) {
      return sessionId;
    }
  }

  return null;
};

const getStartedAt = (events: UnknownRecord[]): string | null => {
  for (const event of events) {
    const timestamp = asString(event.timestamp);
    if (timestamp) {
      return timestamp;
    }
  }

  return null;
};

const getTitle = (events: UnknownRecord[], sessionId: string | null): string => {
  const firstUserMessage = events.find(event => event.type === 'user');
  const message = asRecord(firstUserMessage?.message);
  const text = extractTextFromContent(message?.content).trim();

  if (text) {
    return text.split('\n')[0].slice(0, 80);
  }

  if (sessionId) {
    return `Claude Session ${sessionId.slice(0, 8)}`;
  }

  return 'Claude Session';
};

const extractTextFromContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map(part => {
      if (!isRecord(part)) {
        return '';
      }

      if (typeof part.text === 'string') {
        return part.text;
      }

      if (typeof part.content === 'string') {
        return part.content;
      }

      if (typeof part.thinking === 'string') {
        return part.thinking;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');
};

const buildMessage = ({
  id,
  role,
  channel,
  text,
  timestamp,
  event,
  name,
  recipient
}: {
  id: string;
  role: PrismRole;
  channel: PrismChannel;
  text: string;
  timestamp: string | null;
  event: UnknownRecord;
  name?: string;
  recipient?: string;
}): NormalizedMessage => ({
  id,
  role,
  channel,
  text,
  timestamp,
  name,
  recipient,
  isSidechain: Boolean(event.isSidechain),
  parentUuid: asString(event.parentUuid),
  raw: event
});

const getToolNameFromUserContentPart = (
  part: UnknownRecord,
  toolUseMap: Map<string, string>
): string | undefined => {
  const toolUseId = asString(part.tool_use_id);
  if (!toolUseId) {
    return undefined;
  }

  return toolUseMap.get(toolUseId) ?? toolUseId;
};

const parseAssistantMessage = (
  event: UnknownRecord,
  index: number
): NormalizedMessage[] => {
  const message = asRecord(event.message);
  const content = Array.isArray(message?.content) ? message?.content : [];
  const timestamp = asString(event.timestamp);
  const messages: NormalizedMessage[] = [];

  const visibleText = content
    .filter(isRecord)
    .map(part => {
      if (part.type === 'thinking') {
        return '';
      }

      if (part.type === 'tool_use') {
        return '';
      }

      if (typeof part.text === 'string') {
        return part.text;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');

  if (visibleText) {
    messages.push(
      buildMessage({
        id: `${index}-assistant`,
        role: 'assistant',
        channel: 'message',
        text: visibleText,
        timestamp,
        event
      })
    );
  }

  content.filter(isRecord).forEach((part, partIndex) => {
    if (part.type === 'thinking') {
      messages.push(
        buildMessage({
          id: `${index}-thinking-${partIndex}`,
          role: 'assistant',
          channel: 'thinking',
          text:
            typeof part.thinking === 'string' && part.thinking.trim() !== ''
              ? part.thinking
              : '[thinking redacted or empty]',
          timestamp,
          event
        })
      );
    }

    if (part.type === 'tool_use') {
      messages.push(
        buildMessage({
          id: `${index}-tool-call-${partIndex}`,
          role: 'tool',
          channel: 'tool_call',
          text: stringify({
            id: part.id,
            name: part.name,
            input: part.input
          }),
          timestamp,
          event,
          name: asString(part.name) ?? undefined,
          recipient: asString(part.name) ?? undefined
        })
      );
    }
  });

  return messages;
};

const parseUserMessageWithToolMap = (
  event: UnknownRecord,
  index: number,
  toolUseMap: Map<string, string>
): NormalizedMessage[] => {
  const message = asRecord(event.message);
  const content = message?.content;
  const timestamp = asString(event.timestamp);
  const messages: NormalizedMessage[] = [];

  const directText = extractTextFromContent(content).trim();
  if (directText) {
    messages.push(
      buildMessage({
        id: `${index}-user`,
        role: 'user',
        channel: 'message',
        text: directText,
        timestamp,
        event
      })
    );
  }

  if (Array.isArray(content)) {
    content.filter(isRecord).forEach((part, partIndex) => {
      if (part.type === 'tool_result') {
        messages.push(
          buildMessage({
            id: `${index}-tool-result-${partIndex}`,
            role: 'tool',
            channel: 'tool_result',
            text: extractTextFromContent(part.content) || stringify(part.content),
            timestamp,
            event,
            name: getToolNameFromUserContentPart(part, toolUseMap),
            recipient: getToolNameFromUserContentPart(part, toolUseMap)
          })
        );
      }
    });
  }

  const topLevelToolResult = asRecord(event.toolUseResult);
  if (topLevelToolResult) {
    messages.push(
      buildMessage({
        id: `${index}-top-level-tool-result`,
        role: 'tool',
        channel: 'tool_result',
        text: stringify(topLevelToolResult),
        timestamp,
        event,
        name: asString(topLevelToolResult.type) ?? undefined,
        recipient: asString(event.sourceToolAssistantUUID) ?? undefined
      })
    );
  }

  return messages;
};

const collectToolUseMap = (events: UnknownRecord[]): Map<string, string> => {
  const toolUseMap = new Map<string, string>();

  for (const event of events) {
    if (event.type !== 'assistant') {
      continue;
    }

    const message = asRecord(event.message);
    const content = Array.isArray(message?.content) ? message?.content : [];
    for (const part of content.filter(isRecord)) {
      if (part.type !== 'tool_use') {
        continue;
      }

      const id = asString(part.id);
      const name = asString(part.name);
      if (id && name) {
        toolUseMap.set(id, name);
      }
    }
  }

  return toolUseMap;
};

const parseEventRow = (event: UnknownRecord, index: number): NormalizedMessage => {
  const timestamp = asString(event.timestamp);
  const topLevelType = asString(event.type) ?? 'event';
  const attachmentType = asString(asRecord(event.attachment)?.type);
  const systemSubtype = asString(event.subtype);
  const label = attachmentType ?? systemSubtype ?? topLevelType;

  return buildMessage({
    id: `${index}-event`,
    role: topLevelType === 'permission-mode' ? 'meta' : 'system',
    channel: 'event',
    text: stringify({
      type: topLevelType,
      subtype: systemSubtype,
      attachmentType,
      summary:
        asString(asRecord(event.attachment)?.stdout) ??
        asString(asRecord(event.attachment)?.content) ??
        asString(asRecord(event.snapshot)?.timestamp) ??
        label
    }),
    timestamp,
    event,
    name: label
  });
};

const parseUnsupportedLine = (
  line: unknown,
  index: number
): NormalizedMessage => {
  const raw =
    asRecord(line) ??
    ({
      original: typeof line === 'string' ? line : stringify(line)
    } satisfies UnknownRecord);

  return buildMessage({
    id: `${index}-parse-warning`,
    role: 'meta',
    channel: 'event',
    text: `Skipped unsupported or malformed line at index ${index}.\n\n${stringify(line)}`,
    timestamp: null,
    event: {
      type: 'parse_warning',
      lineIndex: index,
      ...raw
    }
  });
};

export const isClaudeSessionJSONL = (rawLines: unknown[]): boolean => {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return false;
  }

  const matches = rawLines.filter(isClaudeEvent);
  if (matches.length === 0) {
    return false;
  }

  const ratio = matches.length / rawLines.length;
  return ratio >= 0.6;
};

export const parseClaudeMeta = (json: unknown): ClaudeMetaSummary | null => {
  const record = asRecord(json);
  if (!record) {
    return null;
  }

  return {
    agentId: asString(record.agentId),
    agentType: asString(record.agentType),
    description: asString(record.description),
    raw: record
  };
};

export const parseClaudeSession = (
  rawLines: unknown[],
  meta?: unknown
): ClaudeSessionParseResult | null => {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return null;
  }

  const warnings: string[] = [];
  const events: UnknownRecord[] = [];
  const dirtyMessages: NormalizedMessage[] = [];

  rawLines.forEach((line, index) => {
    if (isClaudeEvent(line)) {
      events.push(line);
      return;
    }

    warnings.push(`Skipped unsupported or malformed line at index ${index}.`);
    dirtyMessages.push(parseUnsupportedLine(line, index));
  });

  if (!isClaudeSessionJSONL(events)) {
    return null;
  }

  const toolUseMap = collectToolUseMap(events);
  const messages: NormalizedMessage[] = [];

  events.forEach((event, index) => {
    switch (event.type) {
      case 'assistant':
        messages.push(...parseAssistantMessage(event, index));
        break;
      case 'user':
        messages.push(
          ...parseUserMessageWithToolMap(event, index, toolUseMap)
        );
        break;
      default:
        messages.push(parseEventRow(event, index));
        break;
    }
  });

  messages.push(...dirtyMessages);

  messages.sort((left, right) => {
    const leftTime = left.timestamp ? Date.parse(left.timestamp) : 0;
    const rightTime = right.timestamp ? Date.parse(right.timestamp) : 0;
    return leftTime - rightTime;
  });

  const stats: ClaudeSessionStats = {
    totalMessages: messages.length,
    toolCalls: messages.filter(message => message.channel === 'tool_call').length,
    toolResults: messages.filter(message => message.channel === 'tool_result')
      .length,
    eventMessages: messages.filter(message => message.channel === 'event').length,
    thinkingMessages: messages.filter(message => message.channel === 'thinking')
      .length,
    hasSidechain:
      messages.some(message => message.isSidechain) ||
      events.some(event => Boolean(event.isSidechain))
  };

  const sessionId = getSessionId(events);
  const metaSummary = meta ? parseClaudeMeta(meta) : null;

  const conversation: NormalizedConversation = {
    id: sessionId ?? `claude-session-${Date.now()}`,
    source: 'claude-session',
    sessionId,
    title: getTitle(events, sessionId),
    startedAt: getStartedAt(events),
    messages,
    metadata: {
      sessionId,
      importedMeta: metaSummary,
      stats,
      warnings
    }
  };

  return {
    conversation,
    stats,
    warnings
  };
};
