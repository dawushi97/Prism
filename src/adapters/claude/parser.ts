import type {
  ClaudeMetaSummary,
  ClaudeSessionLineType,
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
  'summary',
  'attachment',
  'system',
  'file-history-snapshot',
  'queue-operation',
  'progress',
  'permission-mode',
  'last-prompt',
  'custom-title',
  'ai-title',
  'tag',
  'agent-name',
  'agent-color',
  'agent-setting',
  'mode',
  'worktree-state',
  'pr-link',
  'attribution-snapshot',
  'content-replacement',
  'marble-origami-commit',
  'marble-origami-snapshot',
  'turn_duration'
]);

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const asRecord = (value: unknown): UnknownRecord | null =>
  isRecord(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const hasOwn = (record: UnknownRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const stringValue = asString(value);
    if (stringValue) {
      return stringValue;
    }
  }

  return undefined;
};

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
  const summary = events.find(event => event.type === 'summary');
  const summaryText = asString(summary?.summary)?.trim();
  if (summaryText) {
    return summaryText.split('\n')[0].slice(0, 80);
  }

  const firstUserMessage = events.find(
    event => event.type === 'user' && !event.isMeta && !event.isCompactSummary
  );
  const message = asRecord(firstUserMessage?.message);
  const text = extractTextFromContent(message?.content, {
    includeToolResults: false,
    includeThinking: false
  }).trim();

  if (text) {
    return text.split('\n')[0].slice(0, 80);
  }

  if (sessionId) {
    return `Claude Session ${sessionId.slice(0, 8)}`;
  }

  return 'Claude Session';
};

const extractTextFromContent = (
  content: unknown,
  options: {
    includeToolResults?: boolean;
    includeThinking?: boolean;
  } = {}
): string => {
  const includeToolResults = options.includeToolResults ?? true;
  const includeThinking = options.includeThinking ?? true;

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

      if (part.type === 'tool_result' && !includeToolResults) {
        return '';
      }

      if (
        (part.type === 'thinking' || part.type === 'redacted_thinking') &&
        !includeThinking
      ) {
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

      if (part.type === 'redacted_thinking' && typeof part.data === 'string') {
        return part.data;
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
  recipient,
  toolUseId,
  toolUseResult
}: {
  id: string;
  role: PrismRole;
  channel: PrismChannel;
  text: string;
  timestamp: string | null;
  event: UnknownRecord;
  name?: string;
  recipient?: string;
  toolUseId?: string;
  toolUseResult?: unknown;
}): NormalizedMessage => ({
  id,
  role,
  channel,
  text,
  timestamp,
  lineType: (asString(event.type) ?? undefined) as
    | ClaudeSessionLineType
    | undefined,
  uuid: asString(event.uuid) ?? undefined,
  sessionId: asString(event.sessionId),
  name,
  recipient,
  isSidechain: Boolean(event.isSidechain),
  isMeta: asBoolean(event.isMeta),
  isCompactSummary: asBoolean(event.isCompactSummary),
  isVisibleInTranscriptOnly: asBoolean(event.isVisibleInTranscriptOnly),
  parentUuid: asString(event.parentUuid),
  agentId: asString(event.agentId) ?? undefined,
  slug: asString(event.slug) ?? undefined,
  requestId: asString(event.requestId) ?? undefined,
  model: asString(asRecord(event.message)?.model) ?? undefined,
  toolUseId,
  parentToolUseId: firstString(event.parent_tool_use_id, event.parentToolUseId),
  sourceToolAssistantUUID: asString(event.sourceToolAssistantUUID) ?? undefined,
  toolUseResult,
  usage: asRecord(asRecord(event.message)?.usage) ?? undefined,
  raw: event
});

const getMessageId = (
  event: UnknownRecord,
  index: number,
  suffix: string
): string => {
  const uuid = asString(event.uuid);
  return uuid ? `${uuid}:${suffix}` : `${index}-${suffix}`;
};

interface ToolUseInfo {
  name: string;
  assistantUuid?: string;
  input?: unknown;
}

const getToolInfoFromUserContentPart = (
  part: UnknownRecord,
  toolUseMap: Map<string, ToolUseInfo>
): ToolUseInfo | undefined => {
  const toolUseId = asString(part.tool_use_id);
  if (!toolUseId) {
    return undefined;
  }

  return toolUseMap.get(toolUseId);
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
      if (part.type === 'thinking' || part.type === 'redacted_thinking') {
        return '';
      }

      if (part.type === 'tool_use' || part.type === 'server_tool_use') {
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
        id: getMessageId(event, index, 'assistant'),
        role: 'assistant',
        channel: 'message',
        text: visibleText,
        timestamp,
        event
      })
    );
  }

  content.filter(isRecord).forEach((part, partIndex) => {
    if (part.type === 'thinking' || part.type === 'redacted_thinking') {
      messages.push(
        buildMessage({
          id: getMessageId(event, index, `thinking-${partIndex}`),
          role: 'assistant',
          channel: 'thinking',
          text:
            typeof part.thinking === 'string' && part.thinking.trim() !== ''
              ? part.thinking
              : typeof part.data === 'string' && part.data.trim() !== ''
                ? part.data
                : '[thinking redacted or empty]',
          timestamp,
          event
        })
      );
    }

    if (part.type === 'tool_use' || part.type === 'server_tool_use') {
      const toolName = asString(part.name) ?? asString(part.type) ?? 'tool';
      const toolUseId = asString(part.id) ?? undefined;
      messages.push(
        buildMessage({
          id: getMessageId(event, index, `tool-call-${partIndex}`),
          role: 'tool',
          channel: 'tool_call',
          text: stringify({
            id: part.id,
            name: part.name,
            input: part.input
          }),
          timestamp,
          event,
          name: toolName,
          recipient: toolName,
          toolUseId
        })
      );
    }

    if (part.type === 'web_search_tool_result') {
      messages.push(
        buildMessage({
          id: getMessageId(event, index, `tool-result-${partIndex}`),
          role: 'tool',
          channel: 'tool_result',
          text: stringify(part),
          timestamp,
          event,
          name: 'web_search_tool_result',
          recipient: 'web_search'
        })
      );
    }

    if (part.type === 'image') {
      messages.push(
        buildMessage({
          id: getMessageId(event, index, `image-${partIndex}`),
          role: 'assistant',
          channel: 'event',
          text: stringify(part),
          timestamp,
          event,
          name: 'image'
        })
      );
    }
  });

  return messages;
};

const parseUserMessageWithToolMap = (
  event: UnknownRecord,
  index: number,
  toolUseMap: Map<string, ToolUseInfo>
): NormalizedMessage[] => {
  const message = asRecord(event.message);
  const content = message?.content;
  const timestamp = asString(event.timestamp);
  const messages: NormalizedMessage[] = [];

  const directText = extractTextFromContent(content, {
    includeToolResults: false,
    includeThinking: false
  }).trim();
  if (directText) {
    messages.push(
      buildMessage({
        id: getMessageId(event, index, 'user'),
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
        const toolUseId = asString(part.tool_use_id) ?? undefined;
        const toolInfo = getToolInfoFromUserContentPart(part, toolUseMap);
        const topLevelToolResult = hasOwn(event, 'toolUseResult')
          ? event.toolUseResult
          : undefined;
        const toolName =
          toolInfo?.name ??
          asString(asRecord(topLevelToolResult)?.type) ??
          toolUseId;
        messages.push(
          buildMessage({
            id: getMessageId(event, index, `tool-result-${partIndex}`),
            role: 'tool',
            channel: 'tool_result',
            text: extractTextFromContent(part.content) || stringify(part.content),
            timestamp,
            event,
            name: toolName,
            recipient: toolName,
            toolUseId,
            toolUseResult: topLevelToolResult
          })
        );
      }
    });
  }

  const topLevelToolResult = hasOwn(event, 'toolUseResult')
    ? event.toolUseResult
    : undefined;
  const hasToolResultPart =
    Array.isArray(content) &&
    content.filter(isRecord).some(part => part.type === 'tool_result');

  if (topLevelToolResult !== undefined && !hasToolResultPart) {
    messages.push(
      buildMessage({
        id: getMessageId(event, index, 'top-level-tool-result'),
        role: 'tool',
        channel: 'tool_result',
        text: stringify(topLevelToolResult),
        timestamp,
        event,
        name: asString(asRecord(topLevelToolResult)?.type) ?? undefined,
        recipient: asString(event.sourceToolAssistantUUID) ?? undefined,
        toolUseResult: topLevelToolResult
      })
    );
  }

  return messages;
};

const collectToolUseMap = (events: UnknownRecord[]): Map<string, ToolUseInfo> => {
  const toolUseMap = new Map<string, ToolUseInfo>();

  for (const event of events) {
    if (event.type !== 'assistant') {
      continue;
    }

    const message = asRecord(event.message);
    const content = Array.isArray(message?.content) ? message?.content : [];
    for (const part of content.filter(isRecord)) {
      if (part.type !== 'tool_use' && part.type !== 'server_tool_use') {
        continue;
      }

      const id = asString(part.id);
      const name = asString(part.name);
      if (id && name) {
        toolUseMap.set(id, {
          name,
          assistantUuid: asString(event.uuid) ?? undefined,
          input: part.input
        });
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
  const label =
    attachmentType ??
    systemSubtype ??
    (topLevelType === 'summary' ? 'summary' : topLevelType);
  const summaryText = asString(event.summary);

  return buildMessage({
    id:
      asString(event.uuid) ??
      (summaryText
        ? `summary-${asString(event.leafUuid) ?? index}`
        : `${index}-event`),
    role:
      topLevelType === 'permission-mode' ||
      topLevelType === 'summary' ||
      topLevelType === 'last-prompt'
        ? 'meta'
        : 'system',
    channel: 'event',
    text: stringify({
      type: topLevelType,
      subtype: systemSubtype,
      attachmentType,
      summary:
        summaryText ??
        asString(event.content) ??
        asString(event.lastPrompt) ??
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

const incrementCount = (
  counts: Record<string, number>,
  key: string | null
): void => {
  if (!key) {
    return;
  }

  counts[key] = (counts[key] ?? 0) + 1;
};

const collectUniqueStrings = (
  events: UnknownRecord[],
  field: string
): string[] => [
  ...new Set(
    events
      .map(event => asString(event[field]))
      .filter((value): value is string => Boolean(value))
  )
];

const buildChildrenByParentUuid = (
  events: UnknownRecord[],
  options: { conversationOnly?: boolean } = {}
): Record<string, string[]> => {
  const childrenByParentUuid: Record<string, string[]> = {};

  for (const event of events) {
    if (
      options.conversationOnly &&
      event.type !== 'user' &&
      event.type !== 'assistant'
    ) {
      continue;
    }

    const uuid = asString(event.uuid);
    const parentUuid = asString(event.parentUuid);
    if (!uuid || !parentUuid) {
      continue;
    }

    childrenByParentUuid[parentUuid] = [
      ...(childrenByParentUuid[parentUuid] ?? []),
      uuid
    ];
  }

  return childrenByParentUuid;
};

const collectBranchPoints = (
  childrenByParentUuid: Record<string, string[]>
): Array<{ uuid: string; children: string[] }> =>
  Object.entries(childrenByParentUuid)
    .filter(([, children]) => children.length > 1)
    .map(([uuid, children]) => ({ uuid, children }));

const countProgressForks = (events: UnknownRecord[]): number => {
  const childrenByParentUuid = buildChildrenByParentUuid(events);
  const eventByUuid = new Map(
    events.flatMap(event => {
      const uuid = asString(event.uuid);
      return uuid ? [[uuid, event]] : [];
    })
  );

  return collectBranchPoints(childrenByParentUuid).filter(branch =>
    branch.children.some(childUuid => eventByUuid.get(childUuid)?.type === 'progress')
  ).length;
};

const collectToolResultsByToolUseId = (
  events: UnknownRecord[]
): Record<string, string> => {
  const toolResultsByToolUseId: Record<string, string> = {};

  for (const event of events) {
    if (event.type !== 'user') {
      continue;
    }

    const content = asRecord(event.message)?.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content.filter(isRecord)) {
      const toolUseId = asString(part.tool_use_id);
      const uuid = asString(event.uuid);
      if (part.type === 'tool_result' && toolUseId && uuid) {
        toolResultsByToolUseId[toolUseId] = uuid;
      }
    }
  }

  return toolResultsByToolUseId;
};

const collectContentBlockTypeCounts = (
  events: UnknownRecord[]
): Record<string, number> => {
  const contentBlockTypeCounts: Record<string, number> = {};

  for (const event of events) {
    const content = asRecord(event.message)?.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content.filter(isRecord)) {
      incrementCount(contentBlockTypeCounts, asString(part.type));
    }
  }

  return contentBlockTypeCounts;
};

const buildMetadata = ({
  events,
  messages,
  metaSummary,
  stats,
  toolUseMap,
  warnings
}: {
  events: UnknownRecord[];
  messages: NormalizedMessage[];
  metaSummary: ClaudeMetaSummary | null;
  stats: ClaudeSessionStats;
  toolUseMap: Map<string, ToolUseInfo>;
  warnings: string[];
}): Record<string, unknown> => {
  const topLevelTypeCounts: Record<string, number> = {};
  events.forEach(event => incrementCount(topLevelTypeCounts, asString(event.type)));

  const childrenByParentUuid = buildChildrenByParentUuid(events);
  const conversationChildrenByParentUuid = buildChildrenByParentUuid(events, {
    conversationOnly: true
  });
  const branchPoints = collectBranchPoints(childrenByParentUuid);
  const conversationBranchPoints = collectBranchPoints(
    conversationChildrenByParentUuid
  );

  const uuidIndex = events.flatMap(event => {
    const uuid = asString(event.uuid);
    if (!uuid) {
      return [];
    }

    return [
      {
        uuid,
        type: asString(event.type),
        parentUuid: asString(event.parentUuid),
        sessionId: asString(event.sessionId),
        timestamp: asString(event.timestamp),
        isSidechain: Boolean(event.isSidechain),
        isMeta: Boolean(event.isMeta),
        isCompactSummary: Boolean(event.isCompactSummary),
        parentToolUseId: firstString(
          event.parent_tool_use_id,
          event.parentToolUseId
        ),
        agentId: asString(event.agentId),
        slug: asString(event.slug)
      }
    ];
  });

  const toolUseIndex = [...toolUseMap.entries()].map(([toolUseId, info]) => ({
    toolUseId,
    ...info
  }));

  return {
    sessionId: collectUniqueStrings(events, 'sessionId')[0] ?? null,
    importedMeta: metaSummary,
    stats,
    warnings,
    claudeFields: {
      sessionIds: collectUniqueStrings(events, 'sessionId'),
      cwd: collectUniqueStrings(events, 'cwd'),
      versions: collectUniqueStrings(events, 'version'),
      gitBranches: collectUniqueStrings(events, 'gitBranch'),
      userTypes: collectUniqueStrings(events, 'userType'),
      entrypoints: collectUniqueStrings(events, 'entrypoint'),
      permissionModes: collectUniqueStrings(events, 'permissionMode'),
      slugs: collectUniqueStrings(events, 'slug'),
      agentIds: collectUniqueStrings(events, 'agentId')
    },
    claudeIndexes: {
      topLevelTypeCounts,
      contentBlockTypeCounts: collectContentBlockTypeCounts(events),
      uuidIndex,
      childrenByParentUuid,
      branchPoints,
      conversationChildrenByParentUuid,
      conversationBranchPoints,
      progressForks: countProgressForks(events),
      toolUseIndex,
      toolResultsByToolUseId: collectToolResultsByToolUseId(events),
      summaries: events
        .filter(event => event.type === 'summary')
        .map(event => ({
          summary: asString(event.summary),
          leafUuid: asString(event.leafUuid)
        })),
      compactBoundaries: events
        .filter(
          event =>
            event.type === 'system' &&
            asString(event.subtype) === 'compact_boundary'
        )
        .map(event => ({
          uuid: asString(event.uuid),
          timestamp: asString(event.timestamp),
          logicalParentUuid: asString(event.logicalParentUuid),
          compactMetadata: event.compactMetadata
        }))
    },
    normalizedMessageCount: messages.length
  };
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

  const childrenByParentUuid = buildChildrenByParentUuid(events);
  const conversationChildrenByParentUuid = buildChildrenByParentUuid(events, {
    conversationOnly: true
  });
  const compactBoundaries = events.filter(
    event =>
      event.type === 'system' && asString(event.subtype) === 'compact_boundary'
  );
  const titleEventTypes = new Set(['custom-title', 'ai-title', 'last-prompt']);
  const conversationLineTypes = new Set(['user', 'assistant']);

  const stats: ClaudeSessionStats = {
    totalMessages: messages.length,
    toolCalls: messages.filter(message => message.channel === 'tool_call').length,
    toolResults: messages.filter(message => message.channel === 'tool_result')
      .length,
    eventMessages: messages.filter(message => message.channel === 'event').length,
    thinkingMessages: messages.filter(message => message.channel === 'thinking')
      .length,
    summaryMessages: events.filter(event => event.type === 'summary').length,
    fileSnapshots: events.filter(event => event.type === 'file-history-snapshot')
      .length,
    queueOperations: events.filter(event => event.type === 'queue-operation')
      .length,
    progressEvents: events.filter(event => event.type === 'progress').length,
    compactBoundaries: compactBoundaries.length,
    branchPoints: collectBranchPoints(childrenByParentUuid).length,
    conversationBranchPoints: collectBranchPoints(conversationChildrenByParentUuid)
      .length,
    progressForks: countProgressForks(events),
    titleEvents: events.filter(event =>
      titleEventTypes.has(asString(event.type) ?? '')
    ).length,
    metadataEvents: events.filter(
      event => !conversationLineTypes.has(asString(event.type) ?? '')
    ).length,
    malformedLines: warnings.length,
    hasSidechain:
      messages.some(message => message.isSidechain) ||
      events.some(event => Boolean(event.isSidechain)),
    hasCompact:
      compactBoundaries.length > 0 ||
      events.some(event => Boolean(event.isCompactSummary)),
    hasToolUseResult: events.some(event => hasOwn(event, 'toolUseResult'))
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
    metadata: buildMetadata({
      events,
      messages,
      metaSummary,
      stats,
      toolUseMap,
      warnings
    })
  };

  return {
    conversation,
    stats,
    warnings
  };
};
