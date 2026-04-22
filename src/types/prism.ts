export type PrismSource = 'claude-session';

export type PrismRole = 'user' | 'assistant' | 'system' | 'tool' | 'meta';

export type PrismChannel =
  | 'message'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'event';

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
  name?: string;
  recipient?: string;
  isSidechain: boolean;
  parentUuid: string | null;
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
  hasSidechain: boolean;
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
