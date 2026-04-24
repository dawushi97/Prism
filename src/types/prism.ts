export type PrismSource = 'claude-session';

export type PrismRole = 'user' | 'assistant' | 'system' | 'tool' | 'meta';

export type PrismChannel =
  | 'message'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'event';

export type ClaudeSessionLineType =
  | 'user'
  | 'assistant'
  | 'summary'
  | 'system'
  | 'attachment'
  | 'file-history-snapshot'
  | 'queue-operation'
  | 'progress'
  | 'permission-mode'
  | 'last-prompt'
  | 'custom-title'
  | 'ai-title'
  | 'tag'
  | 'agent-name'
  | 'agent-color'
  | 'agent-setting'
  | 'mode'
  | 'worktree-state'
  | 'pr-link'
  | 'attribution-snapshot'
  | 'content-replacement'
  | 'marble-origami-commit'
  | 'marble-origami-snapshot'
  | 'turn_duration'
  | string;

export type PrismConversationAction =
  | 'toggleMarkdown'
  | 'toggleMetadata'
  | 'toggleShareMenu'
  | 'translateConversation'
  | 'copyShareableUrl'
  | 'copyConversationJson'
  | 'downloadConversation'
  | 'openRenderView';

export interface NormalizedMessage {
  id: string;
  role: PrismRole;
  channel: PrismChannel;
  text: string;
  timestamp: string | null;
  lineType?: ClaudeSessionLineType;
  uuid?: string;
  sessionId?: string | null;
  name?: string;
  recipient?: string;
  isSidechain: boolean;
  isMeta?: boolean;
  isCompactSummary?: boolean;
  isVisibleInTranscriptOnly?: boolean;
  parentUuid: string | null;
  agentId?: string;
  slug?: string;
  requestId?: string;
  model?: string;
  toolUseId?: string;
  parentToolUseId?: string;
  sourceToolAssistantUUID?: string;
  toolUseResult?: unknown;
  usage?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface NormalizedConversation {
  id: string;
  source: PrismSource;
  sessionId: string | null;
  title: string;
  startedAt: string | null;
  messages: NormalizedMessage[];
  metadata: Record<string, unknown>;
}

export interface ClaudeSessionStats {
  totalMessages: number;
  toolCalls: number;
  toolResults: number;
  eventMessages: number;
  thinkingMessages: number;
  summaryMessages: number;
  fileSnapshots: number;
  queueOperations: number;
  progressEvents: number;
  compactBoundaries: number;
  branchPoints: number;
  conversationBranchPoints: number;
  progressForks: number;
  titleEvents: number;
  metadataEvents: number;
  malformedLines: number;
  hasSidechain: boolean;
  hasCompact: boolean;
  hasToolUseResult: boolean;
}

export interface ClaudeSessionParseResult {
  conversation: NormalizedConversation;
  stats: ClaudeSessionStats;
  warnings: string[];
}

export interface ClaudeMetaSummary {
  agentId: string | null;
  agentType: string | null;
  description: string | null;
  raw: Record<string, unknown>;
}
