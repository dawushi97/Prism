import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import {
  isClaudeSessionJSONL,
  parseClaudeMeta,
  parseClaudeSession
} from './adapters/claude/parser';
import './components/prism-metadata-panel';
import './components/prism-preference-panel';
import './components/prism-timeline';
import {
  clampGridColumnWidth,
  createDefaultFocusModeSettings,
  createDefaultViewSettings
} from './components/prism-preference-panel';
import type {
  PrismFocusBucket,
  PrismFocusChipState,
  PrismFocusModeSettings,
  PrismViewSettings
} from './components/prism-preference-panel';
import type {
  ClaudeMetaSummary,
  ClaudeSessionParseResult,
  NormalizedConversation,
  NormalizedMessage,
  PrismChannel,
  PrismConversationAction,
  PrismRole
} from './types/prism';
import { renderIcon } from './utils/icons';

export interface LoadedTextFile {
  name: string;
  text: string;
}

const INTERNAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INTERNAL_TOOL_ID_PATTERN = /^toolu_[a-z0-9]+$/i;
type PrismFocusClassification = 'include' | 'neutral' | 'exclude';

interface LoadedConversationRecord {
  key: string;
  fileName: string;
  fileText: string;
  conversation: NormalizedConversation;
  parseResult: ClaudeSessionParseResult;
}

interface SelectedMessageRef {
  conversationKey: string;
  messageId: string;
}

interface ConversationActionStatus {
  conversationKey: string;
  message: string;
}

@customElement('prism-app')
export class PrismApp extends LitElement {
  @state()
  private stagedFiles: LoadedTextFile[] = [];

  @state()
  private loadedFileNames: string[] = [];

  @state()
  private detectionLabel = 'No file loaded';

  @state()
  private loadedConversations: LoadedConversationRecord[] = [];

  @state()
  private selectedMessageRef: SelectedMessageRef | null = null;

  @state()
  private metaSummary: ClaudeMetaSummary | null = null;

  @state()
  private metaOnly = false;

  @state()
  private metadataConversationKey: string | null = null;

  @state()
  private showActionsMenu = false;

  @state()
  private showPreferencePanel = false;

  @state()
  private focusModeSettings: PrismFocusModeSettings =
    createDefaultFocusModeSettings();

  @state()
  private viewSettings: PrismViewSettings = createDefaultViewSettings();

  @state()
  private renderMarkdown = false;

  @state()
  private sidechainOnly = false;

  @state()
  private conversationActionStatus: ConversationActionStatus | null = null;

  @state()
  private shareMenuConversationKey: string | null = null;

  @state()
  private focusModeExemptedMessageKeys: string[] = [];

  async ingestFiles(files: LoadedTextFile[]): Promise<void> {
    this.stagedFiles = [];
    this.focusModeSettings = createDefaultFocusModeSettings();
    this.renderMarkdown = false;
    this.sidechainOnly = false;
    this.conversationActionStatus = null;
    this.metadataConversationKey = null;
    this.shareMenuConversationKey = null;
    this.focusModeExemptedMessageKeys = [];
    this.showActionsMenu = false;
    this.showPreferencePanel = false;

    const parsedMetaFiles = files
      .filter(file => file.name.endsWith('.meta.json'))
      .map(file => ({
        name: file.name,
        raw: this.#safeParseJSON(file.text)
      }))
      .filter(
        (file): file is { name: string; raw: Record<string, unknown> } =>
          file.raw !== null && typeof file.raw === 'object'
      );
    const parsedSessions = this.#parseConversationFiles(files, parsedMetaFiles);

    if (parsedSessions.length > 0) {
      this.loadedConversations = this.#mergeLoadedConversations(parsedSessions);
      this.loadedFileNames = [
        ...new Set([
          ...this.loadedFileNames,
          ...files.map(file => file.name)
        ])
      ];
      this.metaSummary = null;
      this.selectedMessageRef = null;
      this.detectionLabel = 'Claude session JSONL';
      this.metaOnly = false;
      return;
    }

    this.loadedConversations = [];
    this.selectedMessageRef = null;
    this.metadataConversationKey = null;
    this.shareMenuConversationKey = null;
    this.loadedFileNames = files.map(file => file.name);
    this.metaSummary = parsedMetaFiles[0]
      ? parseClaudeMeta(parsedMetaFiles[0].raw)
      : null;

    if (this.metaSummary) {
      this.detectionLabel = 'Claude meta JSON';
      this.metaOnly = true;
      return;
    }

    this.metaOnly = false;
    this.detectionLabel = 'Unsupported input';
  }

  render() {
    const totalMessages = this.loadedConversations.reduce(
      (count, entry) => count + entry.parseResult.stats.totalMessages,
      0
    );
    const totalToolCalls = this.loadedConversations.reduce(
      (count, entry) => count + entry.parseResult.stats.toolCalls,
      0
    );
    const totalEvents = this.loadedConversations.reduce(
      (count, entry) => count + entry.parseResult.stats.eventMessages,
      0
    );
    const sidebarConversationRecord = this.#getSidebarConversationRecord();
    const sidebarConversation = sidebarConversationRecord?.conversation ?? null;
    const sidebarSelectedMessage =
      this.metadataConversationKey === null
        ? null
        : this.#getSelectedMessageForConversation(this.metadataConversationKey);

    return html`
      <div class="app">
        <header class="header">
          <div class="header-inner">
            <div class="brand-row">
              <span class="brand">Prism</span>
              <span class="name">Claude Session Viewer</span>
            </div>
            <div class="header-controls">
              <div
                class="loader"
                @dragover=${this.#handleDragOver}
                @drop=${this.#handleDrop}
              >
                <div class="loader-copy">
                  Drag .jsonl / .meta.json here, or use the actions menu above.
                </div>
              </div>
              <button
                class="load-staged-button"
                type="button"
                name="loadStagedFiles"
                ?disabled=${this.stagedFiles.length === 0}
                @click=${this.#handleLoadStagedFiles}
              >
                Load
              </button>
              <div class="menu-anchor">
                <button
                  class="header-action action-toggle"
                  type="button"
                  aria-label="Actions"
                  title="Actions"
                  aria-expanded=${this.showActionsMenu}
                  ?data-active=${this.showActionsMenu}
                  @click=${this.#handleActionsToggle}
                >
                  ${renderIcon('Menu')}
                </button>
                ${this.showActionsMenu
                  ? html`
                      <div class="actions-menu" @click=${this.#stopPropagation}>
                        <label class="menu-item file-menu-item">
                          <input
                            type="file"
                            multiple
                            accept=".jsonl,.json,.meta.json"
                            @change=${this.#handleFileSelection}
                          />
                          <span>Load local files</span>
                        </label>
                        <button
                          class="menu-item submenu-toggle"
                          type="button"
                          name="togglePreferencesMenu"
                          aria-haspopup="dialog"
                          aria-expanded=${this.showPreferencePanel}
                          @click=${this.#handlePreferenceDetailsToggle}
                        >
                          <span>Preferences</span>
                        </button>
                      </div>
                    `
                  : nothing}
                ${this.showPreferencePanel
                  ? html`
                      <prism-preference-panel
                        .availableAuthors=${this.#availableAuthors()}
                        .availableRecipients=${this.#availableRecipients()}
                        .availableContentTypes=${this.#availableContentTypes()}
                        .settings=${this.focusModeSettings}
                        .viewSettings=${this.viewSettings}
                        @prism-request-close=${this.#handlePreferenceClose}
                        @prism-focus-mode-change=${this.#handleFocusModeChange}
                        @prism-view-settings-change=${this.#handleViewSettingsChange}
                      ></prism-preference-panel>
                    `
                  : nothing}
              </div>
            </div>
          </div>
        </header>

        <div class="content">
          <section class="content-center">
            <section class="status-bar">
              <div class="info-row">
                <span class="label">Detection</span>
                <span class="value">${this.detectionLabel}</span>
                <span class="label">Loaded Files</span>
                <span class="value files"
                  >${this.loadedFileNames.join(', ') || 'None'}</span
                >
              </div>
              ${this.stagedFiles.length > 0
                ? html`
                    <div class="pending-files">
                      <span class="label">Pending Files</span>
                      <span class="value files"
                        >${this.stagedFiles.map(file => file.name).join(', ')}</span
                      >
                    </div>
                  `
                : nothing}

              ${this.loadedConversations.length > 0
                ? html`
                    <div class="metrics-row">
                      <span class="metric">
                        <strong>${this.loadedConversations.length}</strong>
                        <small>Conversations</small>
                      </span>
                      <span class="metric">
                        <strong>${totalMessages}</strong>
                        <small>Messages</small>
                      </span>
                      <span class="metric">
                        <strong>${totalToolCalls}</strong>
                        <small>Tool Calls</small>
                      </span>
                      <span class="metric">
                        <strong>${totalEvents}</strong>
                        <small>Events</small>
                      </span>
                    </div>
                  `
                : nothing}

              ${this.loadedConversations.length > 0
                ? html`
                    <div class="filters">
                      <label class="checkbox">
                        <input
                          type="checkbox"
                          name="sidechainOnly"
                          .checked=${this.sidechainOnly}
                          @change=${this.#handleSidechainToggle}
                        />
                        <span>Only sidechain</span>
                      </label>
                      <span class="active-filter-summary"
                        >${this.#getFilterSummary()}</span
                      >
                    </div>
                `
                : nothing}

              ${this.loadedConversations.length > 0
                ? html`
                    <div class="conversation-list-header">
                      <div class="empty-title">
                        ${this.loadedConversations.length} total conversations
                      </div>
                    </div>
                    <div
                      class="conversation-list"
                      data-layout=${this.viewSettings.layoutMode}
                      style=${`--prism-grid-column-width: ${this.viewSettings.gridColumnWidth}px;`}
                    >
                      ${this.loadedConversations.map((entry, index) => {
                        const baseMessages = this.#getTimelineMessages(entry);
                        const timelineMessages = baseMessages.filter(
                          message => !this.#isMessageRemovedByFocusMode(message)
                        );
                        const hiddenMessageIds = timelineMessages
                          .filter(message =>
                            this.#isMessageFoldedByFocusMode(entry.key, message)
                          )
                          .map(message => message.id);
                        const selectedMessageId =
                          this.selectedMessageRef?.conversationKey === entry.key
                            ? this.selectedMessageRef.messageId
                            : null;

                        return html`
                          <section
                            class="conversation-container"
                            id=${`conversation-${index}`}
                          >
                            <div class="conversation-container-meta">
                              <span class="conversation-index">#${index}</span>
                              <span class="conversation-file">${entry.fileName}</span>
                            </div>
                            <prism-timeline
                              .conversation=${entry.conversation}
                              .messages=${timelineMessages}
                              .hiddenMessageIds=${hiddenMessageIds}
                              .selectedMessageId=${selectedMessageId}
                              .renderMarkdown=${this.renderMarkdown}
                              .showAbsoluteTimestamp=${this.viewSettings.showAbsoluteTimestamp}
                              .maxMessageHeight=${this.#resolveMaxMessageHeight()}
                              .actionStatus=${this.conversationActionStatus?.conversationKey ===
                              entry.key
                                ? this.conversationActionStatus.message
                                : null}
                              .showShareMenu=${this.shareMenuConversationKey === entry.key}
                              @prism-select-message=${(
                                event: CustomEvent<{ messageId: string }>
                              ) => this.#handleMessageSelect(entry.key, event)}
                              @prism-reveal-message=${(
                                event: CustomEvent<{ messageId: string }>
                              ) => this.#handleRevealMessage(entry.key, event)}
                              @prism-conversation-action=${(
                                event: CustomEvent<PrismConversationAction>
                              ) => this.#handleConversationAction(entry.key, event)}
                            ></prism-timeline>
                          </section>
                        `;
                      })}
                    </div>
                  `
                : nothing}
            </section>

            ${this.metaOnly
              ? html`
                  <section class="empty-message">
                    <div class="empty-title">Meta Summary</div>
                    <div>需要配套 JSONL 才能渲染时间线。</div>
                    <div>${this.metaSummary?.agentType ?? 'Unknown agent type'}</div>
                  </section>
                `
              : nothing}

          </section>

          <aside
            class="content-right"
            ?is-hidden=${!this.metaOnly && this.metadataConversationKey === null}
          >
            <prism-metadata-panel
              title=${this.metaOnly
                ? 'Meta Summary'
                : this.metadataConversationKey === null
                  ? 'Metadata'
                  : sidebarSelectedMessage
                  ? 'Metadata'
                  : 'Conversation Metadata'}
              .data=${this.metaOnly
                ? this.metaSummary?.raw ?? null
                : this.metadataConversationKey !== null
                  ? sidebarSelectedMessage?.raw ?? sidebarConversation?.metadata ?? null
                  : null}
              .conversation=${sidebarConversation}
              .stats=${sidebarConversationRecord?.parseResult.stats ?? null}
              .warnings=${sidebarConversationRecord?.parseResult.warnings ?? []}
            ></prism-metadata-panel>
          </aside>
        </div>
      </div>
    `;
  }

  #parseConversationFiles(
    files: LoadedTextFile[],
    parsedMetaFiles: Array<{ name: string; raw: Record<string, unknown> }>
  ): LoadedConversationRecord[] {
    const parsedMetaByStem = new Map(
      parsedMetaFiles.map(file => [this.#baseFileName(file.name), file.raw])
    );
    const fallbackMeta =
      files.filter(file => file.name.endsWith('.jsonl')).length === 1 &&
      parsedMetaFiles.length === 1
        ? parsedMetaFiles[0]?.raw
        : undefined;

    return files
      .filter(file => file.name.endsWith('.jsonl'))
      .flatMap(file => {
        const sessionLines = this.#parseJSONLText(file.text);
        if (!isClaudeSessionJSONL(sessionLines)) {
          return [];
        }

        const matchedMeta =
          parsedMetaByStem.get(this.#baseFileName(file.name)) ?? fallbackMeta;
        const parseResult = parseClaudeSession(sessionLines, matchedMeta);
        if (!parseResult) {
          return [];
        }

        return [
          {
            key: this.#getConversationKey(file.name, parseResult.conversation),
            fileName: file.name,
            fileText: file.text,
            conversation: parseResult.conversation,
            parseResult
          }
        ];
      });
  }

  #parseJSONLText(text: string): unknown[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return line;
        }
      });
  }

  #safeParseJSON(text: string): unknown {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }

  #baseFileName(name: string): string {
    return name.replace(/\.meta\.json$/u, '').replace(/\.jsonl$/u, '');
  }

  #getConversationKey(
    fileName: string,
    conversation: NormalizedConversation
  ): string {
    return conversation.sessionId ?? `${fileName}:${conversation.id}`;
  }

  #mergeLoadedConversations(
    incomingConversations: LoadedConversationRecord[]
  ): LoadedConversationRecord[] {
    const mergedConversations = [...this.loadedConversations];

    for (const incomingConversation of incomingConversations) {
      const existingIndex = mergedConversations.findIndex(
        conversation => conversation.key === incomingConversation.key
      );

      if (existingIndex === -1) {
        mergedConversations.push(incomingConversation);
        continue;
      }

      mergedConversations.splice(existingIndex, 1, incomingConversation);
    }

    return mergedConversations;
  }

  #getConversationRecord(
    conversationKey: string | null
  ): LoadedConversationRecord | null {
    if (!conversationKey) {
      return null;
    }

    return (
      this.loadedConversations.find(
        conversation => conversation.key === conversationKey
      ) ?? null
    );
  }

  #getSidebarConversationRecord(): LoadedConversationRecord | null {
    return (
      this.#getConversationRecord(this.metadataConversationKey) ??
      this.loadedConversations[0] ??
      null
    );
  }

  #getSelectedMessageForConversation(
    conversationKey: string
  ): NormalizedMessage | null {
    if (this.selectedMessageRef?.conversationKey !== conversationKey) {
      return null;
    }

    return (
      this.#getConversationRecord(conversationKey)?.conversation.messages.find(
        message => message.id === this.selectedMessageRef?.messageId
      ) ?? null
    );
  }

  #getMessageRefKey(conversationKey: string, messageId: string): string {
    return `${conversationKey}:${messageId}`;
  }

  #getTimelineMessages(
    conversationRecord: LoadedConversationRecord
  ): NormalizedMessage[] {
    return conversationRecord.conversation.messages.filter(message => {
      if (this.sidechainOnly && !message.isSidechain) {
        return false;
      }

      return true;
    });
  }

  #hasActiveFocusFilters(): boolean {
    const { author, recipient, contentType } = this.focusModeSettings;
    return (
      author.include.length > 0 ||
      author.exclude.length > 0 ||
      recipient.include.length > 0 ||
      recipient.exclude.length > 0 ||
      contentType.include.length > 0 ||
      contentType.exclude.length > 0
    );
  }

  #hasActiveFocusIncludes(): boolean {
    const { author, recipient, contentType } = this.focusModeSettings;
    return (
      author.include.length > 0 ||
      recipient.include.length > 0 ||
      contentType.include.length > 0
    );
  }

  #matchesFocusValue<T extends string>(
    bucket: PrismFocusBucket<T>,
    value: string | undefined,
    state: Exclude<PrismFocusChipState, 'neutral'>
  ): boolean {
    if (!value) {
      return false;
    }

    return bucket[state].includes(value as T);
  }

  #matchesAllActiveIncludes(message: NormalizedMessage): boolean {
    const checks: boolean[] = [];
    const { author, recipient, contentType } = this.focusModeSettings;

    if (author.include.length > 0) {
      checks.push(author.include.includes(message.role));
    }
    if (recipient.include.length > 0) {
      checks.push(
        Boolean(
          message.recipient && recipient.include.includes(message.recipient)
        )
      );
    }
    if (contentType.include.length > 0) {
      checks.push(contentType.include.includes(message.channel));
    }

    return checks.every(Boolean);
  }

  #classifyMessageByFocusMode(
    message: NormalizedMessage
  ): PrismFocusClassification {
    if (!this.#hasActiveFocusFilters()) {
      return 'include';
    }

    const { author, recipient, contentType } = this.focusModeSettings;
    const isExcluded =
      author.exclude.includes(message.role) ||
      this.#matchesFocusValue(recipient, message.recipient, 'exclude') ||
      contentType.exclude.includes(message.channel);

    if (isExcluded) {
      return 'exclude';
    }

    if (!this.#hasActiveFocusIncludes()) {
      return 'include';
    }

    return this.#matchesAllActiveIncludes(message) ? 'include' : 'neutral';
  }

  #isMessageFoldedByFocusMode(
    conversationKey: string,
    message: NormalizedMessage
  ): boolean {
    if (this.focusModeSettings.strictFocus) {
      return false;
    }

    if (
      this.focusModeExemptedMessageKeys.includes(
        this.#getMessageRefKey(conversationKey, message.id)
      )
    ) {
      return false;
    }

    return this.#classifyMessageByFocusMode(message) !== 'include';
  }

  #isMessageRemovedByFocusMode(message: NormalizedMessage): boolean {
    const classification = this.#classifyMessageByFocusMode(message);

    if (this.focusModeSettings.strictFocus && classification !== 'include') {
      return true;
    }

    return false;
  }

  #availableAuthors(): PrismRole[] {
    return [
      ...new Set(
        this.loadedConversations.flatMap(entry =>
          entry.conversation.messages.map(message => message.role)
        )
      )
    ].sort();
  }

  #availableRecipients(): string[] {
    return [
      ...new Set(
        this.loadedConversations
          .flatMap(entry => entry.conversation.messages)
          .map(message => message.recipient)
          .filter((recipient): recipient is string => {
            if (typeof recipient !== 'string') {
              return false;
            }

            return (
              !INTERNAL_UUID_PATTERN.test(recipient) &&
              !INTERNAL_TOOL_ID_PATTERN.test(recipient)
            );
          }) ?? []
      )
    ].sort();
  }

  #availableContentTypes(): PrismChannel[] {
    return [
      ...new Set(
        this.loadedConversations.flatMap(entry =>
          entry.conversation.messages.map(message => message.channel)
        )
      )
    ].sort() as PrismChannel[];
  }

  #getFilterSummary(): string {
    const parts: string[] = [];
    const fieldSummaries: Array<[string, PrismFocusBucket<string>]> = [
      ['author', this.focusModeSettings.author as PrismFocusBucket<string>],
      ['recipient', this.focusModeSettings.recipient as PrismFocusBucket<string>],
      ['type', this.focusModeSettings.contentType as PrismFocusBucket<string>]
    ];

    for (const [label, bucket] of fieldSummaries) {
      const includePart =
        bucket.include.length > 0 ? `+${bucket.include.join(', +')}` : '';
      const excludePart =
        bucket.exclude.length > 0 ? `-${bucket.exclude.join(', -')}` : '';
      const summary = [includePart, excludePart].filter(Boolean).join(', ');

      if (summary) {
        parts.push(`${label}: ${summary}`);
      }
    }

    if (this.focusModeSettings.strictFocus) {
      parts.push('strict');
    }
    if (parts.length === 0) {
      return 'No focus filters';
    }
    return parts.join(' | ');
  }

  async #handleFileSelection(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    const loadedFiles = await Promise.all(
      files.map(async file => ({
        name: file.name,
        text: await file.text()
      }))
    );

    this.#stageFiles(loadedFiles);
    input.value = '';
  }

  async #handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length === 0) {
      return;
    }

    const loadedFiles = await Promise.all(
      files.map(async file => ({
        name: file.name,
        text: await file.text()
      }))
    );

    this.#stageFiles(loadedFiles);
  }

  #handleDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  #handleSidechainToggle(event: Event): void {
    this.sidechainOnly = (event.target as HTMLInputElement).checked;
  }

  #handleActionsToggle(event: Event): void {
    event.stopPropagation();
    this.showActionsMenu = !this.showActionsMenu;
    if (this.showActionsMenu) {
      this.showPreferencePanel = false;
    }
  }

  #handlePreferenceDetailsToggle(event: Event): void {
    event.stopPropagation();
    this.showPreferencePanel = !this.showPreferencePanel;
    this.showActionsMenu = false;
  }

  async #handleLoadStagedFiles(): Promise<void> {
    if (this.stagedFiles.length === 0) {
      return;
    }

    await this.ingestFiles(this.stagedFiles);
  }

  #handleDocumentClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    const menu = this.renderRoot.querySelector('.actions-menu');
    const toggle = this.renderRoot.querySelector('.action-toggle');
    const preferencePanel = this.renderRoot.querySelector('prism-preference-panel');

    if (
      this.showActionsMenu &&
      !((menu && path.includes(menu)) || (toggle && path.includes(toggle)))
    ) {
      this.showActionsMenu = false;
    }

    if (
      this.showPreferencePanel &&
      !(
        (preferencePanel && path.includes(preferencePanel)) ||
        (toggle && path.includes(toggle))
      )
    ) {
      this.showPreferencePanel = false;
    }
  };

  #handleKeydown = (event: KeyboardEvent): void => {
    if (
      event.key === 'Escape' &&
      (this.showActionsMenu || this.showPreferencePanel)
    ) {
      this.showActionsMenu = false;
      this.showPreferencePanel = false;
    }
  };

  #handleFocusIn = (event: FocusEvent): void => {
    const path = event.composedPath();
    const menu = this.renderRoot.querySelector('.actions-menu');
    const toggle = this.renderRoot.querySelector('.action-toggle');
    const preferencePanel = this.renderRoot.querySelector('prism-preference-panel');

    if (
      this.showActionsMenu &&
      !((menu && path.includes(menu)) || (toggle && path.includes(toggle)))
    ) {
      this.showActionsMenu = false;
    }

    if (
      this.showPreferencePanel &&
      !(
        (preferencePanel && path.includes(preferencePanel)) ||
        (toggle && path.includes(toggle))
      )
    ) {
      this.showPreferencePanel = false;
    }
  };

  #stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  #stageFiles(files: LoadedTextFile[]): void {
    this.stagedFiles = files;
    this.showActionsMenu = false;
    this.showPreferencePanel = false;
    this.conversationActionStatus = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.viewSettings = this.#readViewSettingsFromLocation();
    document.addEventListener('click', this.#handleDocumentClick);
    document.addEventListener('keydown', this.#handleKeydown);
    document.addEventListener('focusin', this.#handleFocusIn);
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this.#handleDocumentClick);
    document.removeEventListener('keydown', this.#handleKeydown);
    document.removeEventListener('focusin', this.#handleFocusIn);
    super.disconnectedCallback();
  }

  #handleFocusModeChange(event: CustomEvent<PrismFocusModeSettings>): void {
    this.focusModeSettings = event.detail;
    this.focusModeExemptedMessageKeys = [];
  }

  #handleViewSettingsChange(event: CustomEvent<PrismViewSettings>): void {
    this.viewSettings = event.detail;
    this.#syncViewSettingsToLocation();
  }

  #handlePreferenceClose(): void {
    this.showPreferencePanel = false;
  }

  #resolveMaxMessageHeight(): string {
    switch (this.viewSettings.maxMessageHeightMode) {
      case 'no-limit':
        return 'none';
      case 'custom':
        return `${this.viewSettings.customMaxMessageHeight}px`;
      case 'automatic':
      default:
        return '100vh';
    }
  }

  #readViewSettingsFromLocation(): PrismViewSettings {
    const nextSettings = createDefaultViewSettings();
    const gridParam = new URL(window.location.href).searchParams.get('grid');
    if (!gridParam) {
      return nextSettings;
    }

    const parsedGridWidth = Number.parseInt(gridParam, 10);
    if (Number.isNaN(parsedGridWidth)) {
      return nextSettings;
    }

    return {
      ...nextSettings,
      layoutMode: 'grid',
      gridColumnWidth: clampGridColumnWidth(parsedGridWidth)
    };
  }

  #syncViewSettingsToLocation(): void {
    const url = new URL(window.location.href);

    if (this.viewSettings.layoutMode === 'grid') {
      url.searchParams.set('grid', String(this.viewSettings.gridColumnWidth));
    } else {
      url.searchParams.delete('grid');
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', nextUrl || '/');
  }

  #handleMessageSelect(
    conversationKey: string,
    event: CustomEvent<{ messageId: string }>
  ): void {
    this.selectedMessageRef = {
      conversationKey,
      messageId: event.detail.messageId
    };
  }

  #handleRevealMessage(
    conversationKey: string,
    event: CustomEvent<{ messageId: string }>
  ): void {
    this.focusModeExemptedMessageKeys = [
      ...new Set([
        ...this.focusModeExemptedMessageKeys,
        this.#getMessageRefKey(conversationKey, event.detail.messageId)
      ])
    ];
  }

  async #handleConversationAction(
    conversationKey: string,
    event: CustomEvent<PrismConversationAction>
  ): Promise<void> {
    switch (event.detail) {
      case 'toggleMarkdown':
        this.renderMarkdown = !this.renderMarkdown;
        break;
      case 'toggleMetadata':
        if (this.metadataConversationKey === conversationKey) {
          this.metadataConversationKey = null;
        } else {
          this.metadataConversationKey = conversationKey;
        }
        if (this.selectedMessageRef?.conversationKey !== conversationKey) {
          this.selectedMessageRef = null;
        }
        break;
      case 'toggleShareMenu':
        this.shareMenuConversationKey =
          this.shareMenuConversationKey === conversationKey
            ? null
            : conversationKey;
        break;
      case 'translateConversation':
        this.#setConversationActionStatus(
          conversationKey,
          'Translation API not configured'
        );
        break;
      case 'copyShareableUrl':
        await this.#copyShareableUrl(conversationKey);
        this.shareMenuConversationKey = null;
        break;
      case 'copyConversationJson':
        await this.#copyConversationJson(conversationKey);
        this.shareMenuConversationKey = null;
        break;
      case 'downloadConversation':
        this.#downloadConversation(conversationKey);
        this.shareMenuConversationKey = null;
        break;
      case 'openRenderView':
        this.#openRenderView(conversationKey);
        this.shareMenuConversationKey = null;
        break;
      default:
        break;
    }
  }

  #setConversationActionStatus(
    conversationKey: string,
    message: string
  ): void {
    this.conversationActionStatus = { conversationKey, message };
  }

  async #copyShareableUrl(conversationKey: string): Promise<void> {
    const conversationRecord = this.#getConversationRecord(conversationKey);
    if (!conversationRecord) {
      return;
    }

    const shareableUrl = `${window.location.href.split('#')[0]}#session=${conversationRecord.conversation.sessionId ?? conversationRecord.conversation.id}`;
    await this.#writeToClipboard(
      shareableUrl,
      'Shareable URL copied',
      conversationKey
    );
  }

  async #copyConversationJson(conversationKey: string): Promise<void> {
    const conversationRecord = this.#getConversationRecord(conversationKey);
    if (!conversationRecord) {
      return;
    }

    await this.#writeToClipboard(
      JSON.stringify(conversationRecord.conversation, null, 2),
      'Conversation JSON copied',
      conversationKey
    );
  }

  #downloadConversation(conversationKey: string): void {
    const conversationRecord = this.#getConversationRecord(conversationKey);
    if (!conversationRecord) {
      return;
    }

    const fileContent =
      conversationRecord.fileText ??
      JSON.stringify(conversationRecord.conversation, null, 2);
    const extension = conversationRecord.fileText ? 'jsonl' : 'json';
    const blob = new Blob([fileContent], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${conversationRecord.conversation.sessionId ?? conversationRecord.conversation.id}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.#setConversationActionStatus(
      conversationKey,
      'Conversation download started'
    );
  }

  #openRenderView(conversationKey: string): void {
    const conversationRecord = this.#getConversationRecord(conversationKey);
    if (!conversationRecord) {
      return;
    }

    const openedWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!openedWindow) {
      this.#setConversationActionStatus(
        conversationKey,
        'Unable to open Claude render view'
      );
      return;
    }

    const transcript = this.#getTimelineMessages(conversationRecord)
      .map(message => {
        const heading = [
          message.role,
          message.channel,
          message.name ?? message.recipient ?? ''
        ]
          .filter(Boolean)
          .join(' · ');

        return `<section style="margin:0 0 16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
          <div style="margin:0 0 8px;color:#6b7280;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${this.#escapeHtml(heading)}</div>
          <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font:13px/1.5 ui-monospace,'SFMono-Regular',monospace;">${this.#escapeHtml(message.text)}</pre>
        </section>`;
      })
      .join('');

    openedWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Claude Render View</title>
  </head>
  <body style="margin:0;padding:24px;background:#f8fafc;color:#111827;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <h1 style="margin:0 0 16px;font-size:20px;">${this.#escapeHtml(conversationRecord.conversation.title)}</h1>
    ${transcript}
  </body>
</html>`);
    openedWindow.document.close();
    this.#setConversationActionStatus(
      conversationKey,
      'Opened Claude render view'
    );
  }

  async #writeToClipboard(
    text: string,
    successMessage: string,
    conversationKey: string
  ): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      this.#setConversationActionStatus(
        conversationKey,
        'Clipboard API unavailable in this environment'
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.#setConversationActionStatus(conversationKey, successMessage);
    } catch {
      this.#setConversationActionStatus(
        conversationKey,
        'Clipboard write failed'
      );
    }
  }

  #escapeHtml(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      color: hsl(0, 0%, 29%);
      --gray-50: hsl(0, 0%, 98%);
      --gray-100: hsl(0, 0%, 96%);
      --gray-200: hsl(0, 0%, 92%);
      --gray-300: hsl(0, 0%, 88%);
      --gray-400: hsl(0, 0%, 74%);
      --gray-500: hsl(0, 0%, 56%);
      --gray-600: hsl(0, 0%, 43%);
      --gray-700: hsl(0, 0%, 36%);
      --gray-800: hsl(0, 0%, 23%);
      --gray-900: hsl(0, 0%, 14%);
      --green-700: hsl(122, 43.43%, 38.82%);
      --purple-700: hsl(282, 67.88%, 37.84%);
      --blue-700: hsl(209, 78.72%, 46.08%);
      --blue-50: hsl(205, 86.67%, 94.12%);
    }

    .app {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: auto;
      overflow-x: hidden;
    }

    .header {
      width: 100%;
      padding: 20px 0;
      display: flex;
      justify-content: center;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 3;
      background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 1) 20%,
        rgba(255, 255, 255, 0.9) 80%,
        rgba(255, 255, 255, 0) 100%
      );
    }

    .header-inner {
      width: min(1160px, calc(100vw - 24px));
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .brand-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .header-controls {
      flex: 1;
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 12px;
    }

    .header-action {
      all: unset;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 50px;
      height: 50px;
      border-radius: 10px;
      color: var(--gray-700);
      cursor: pointer;
      line-height: 1;
      border: 1px solid var(--gray-300);
      background: white;
    }

    .header-action:hover {
      background: var(--gray-100);
      color: var(--gray-900);
    }

    .header-action:focus-visible {
      outline: 2px solid var(--blue-700);
      outline-offset: 1px;
    }

    .header-action[data-active] {
      background: var(--gray-200);
      color: var(--gray-900);
    }

    .actions-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 4;
      display: grid;
      gap: 8px;
      min-width: 280px;
      padding: 10px;
      border-radius: 8px;
      background: white;
      border: 1px solid var(--gray-200);
      box-shadow:
        0 0 2px hsla(0, 0%, 0%, 0.15),
        0 0 4px hsla(0, 0%, 0%, 0.07),
        0 0 12px hsla(0, 0%, 0%, 0.07);
    }

    .menu-anchor {
      position: relative;
    }

    .menu-item {
      all: unset;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 6px;
      color: var(--gray-800);
      background: var(--gray-50);
      border: 1px solid var(--gray-200);
      cursor: pointer;
      font-size: 14px;
    }

    .menu-item:hover {
      background: var(--gray-100);
    }

    .file-menu-item input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    .brand {
      font-weight: 700;
      color: var(--gray-900);
    }

    .name {
      color: var(--gray-600);
    }

    .content {
      width: min(1160px, calc(100vw - 24px));
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 16px;
      padding-bottom: 20px;
    }

    .content-center {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .content-right {
      min-width: 0;
    }

    .content-right[is-hidden] {
      display: none;
    }

    .status-bar {
      display: grid;
      gap: 10px;
    }

    .conversation-list-header {
      color: var(--gray-700);
    }

    .conversation-list {
      display: grid;
      gap: 20px;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }

    .conversation-list[data-layout='grid'] {
      grid-template-columns: repeat(
        auto-fill,
        minmax(min(100%, var(--prism-grid-column-width, 373px)), 1fr)
      );
    }

    .conversation-container {
      position: relative;
      width: 100%;
    }

    .conversation-container-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin: 0 0 8px;
      color: var(--gray-500);
      font-size: 13px;
    }

    .conversation-list[data-layout='grid'] .conversation-container-meta {
      padding-left: 8px;
    }

    .conversation-index {
      color: var(--gray-400);
      font-size: 12px;
      line-height: 1.4;
    }

    .conversation-file {
      font-size: 12px;
      line-height: 1.4;
      color: var(--gray-500);
      word-break: break-word;
    }

    .info-row,
    .metrics-row,
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      color: var(--gray-600);
    }

    .label {
      font-size: 12px;
      color: var(--gray-500);
    }

    .value {
      color: var(--gray-800);
      word-break: break-word;
    }

    .loader {
      min-width: 0;
      display: flex;
      align-items: center;
      min-height: 56px;
      padding: 0 18px;
      border: 1px solid var(--gray-300);
      border-radius: 10px;
      background: white;
      color: var(--gray-600);
    }

    .pending-files {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .load-staged-button {
      all: unset;
      min-width: 96px;
      min-height: 56px;
      padding: 0 24px;
      border-radius: 10px;
      background: white;
      color: var(--gray-800);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      text-align: center;
      border: 1px solid var(--gray-300);
    }

    .load-staged-button:disabled {
      background: var(--gray-100);
      color: var(--gray-500);
      cursor: not-allowed;
    }

    .metric {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      padding-right: 10px;
      border-right: 1px solid var(--gray-300);
    }

    .metric:last-child {
      border-right: none;
    }

    .metric strong {
      font-weight: 500;
      color: var(--gray-900);
    }

    .metric small {
      color: var(--gray-500);
      font-size: 12px;
    }

    select,
    input[type='checkbox'] {
      accent-color: var(--blue-700);
    }

    select {
      min-width: 150px;
      padding: 6px 8px;
      border-radius: 5px;
      border: 1px solid var(--gray-300);
      background: white;
      color: var(--gray-800);
    }

    .filters label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .active-filter-summary {
      color: var(--gray-500);
      font-size: 13px;
    }

    .checkbox span {
      margin: 0;
    }

    .empty-message {
      padding: 12px 0;
      color: var(--gray-600);
    }

    .empty-title {
      color: var(--gray-800);
      font-weight: 500;
      margin-bottom: 4px;
    }

    @media (max-width: 980px) {
      .content {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .header-inner,
      .content {
        width: min(100vw - 16px, 100%);
      }

      .header-inner {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-controls {
        width: 100%;
        grid-template-columns: 1fr;
      }

      .menu-anchor {
        justify-self: end;
      }

      .filters,
      .filters label,
      select {
        width: 100%;
      }

      .actions-menu {
        left: 0;
        right: auto;
        width: min(100vw - 16px, 320px);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-app': PrismApp;
  }
}
