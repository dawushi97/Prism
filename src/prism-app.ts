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
import type {
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

@customElement('prism-app')
export class PrismApp extends LitElement {
  @state()
  private stagedFiles: LoadedTextFile[] = [];

  @state()
  private loadedFileNames: string[] = [];

  @state()
  private detectionLabel = 'No file loaded';

  @state()
  private conversation: NormalizedConversation | null = null;

  @state()
  private parseResult: ClaudeSessionParseResult | null = null;

  @state()
  private metaSummary: ClaudeMetaSummary | null = null;

  @state()
  private metaOnly = false;

  @state()
  private selectedMessageId: string | null = null;

  @state()
  private showActionsMenu = false;

  @state()
  private showPreferenceDetails = false;

  @state()
  private focusModeSettings: PrismFocusModeSettings = {
    author: [],
    recipient: [],
    contentType: [],
    strictFocus: false
  };

  @state()
  private viewSettings: PrismViewSettings = {
    showAbsoluteTimestamp: false
  };

  @state()
  private renderMarkdown = false;

  @state()
  private sidechainOnly = false;

  @state()
  private conversationActionStatus: string | null = null;

  @state()
  private showConversationMetadata = false;

  @state()
  private showShareMenu = false;

  @state()
  private focusModeExemptedMessageIds: string[] = [];

  private loadedSessionText: string | null = null;

  async ingestFiles(files: LoadedTextFile[]): Promise<void> {
    this.stagedFiles = [];
    this.loadedFileNames = files.map(file => file.name);
    this.focusModeSettings = {
      author: [],
      recipient: [],
      contentType: [],
      strictFocus: false
    };
    this.viewSettings = {
      showAbsoluteTimestamp: false
    };
    this.renderMarkdown = false;
    this.sidechainOnly = false;
    this.conversationActionStatus = null;
    this.showConversationMetadata = false;
    this.showShareMenu = false;
    this.focusModeExemptedMessageIds = [];
    this.loadedSessionText = null;
    this.showActionsMenu = false;
    this.showPreferenceDetails = false;

    let sessionLines: unknown[] | null = null;
    let meta: unknown = null;

    for (const file of files) {
      if (file.name.endsWith('.meta.json')) {
        meta = this.#safeParseJSON(file.text);
        continue;
      }

      if (file.name.endsWith('.jsonl')) {
        sessionLines = this.#parseJSONLText(file.text);
        this.loadedSessionText = file.text;
      }
    }

    this.metaSummary = meta ? parseClaudeMeta(meta) : null;

    if (sessionLines && isClaudeSessionJSONL(sessionLines)) {
      this.parseResult = parseClaudeSession(sessionLines, meta ?? undefined);
      this.conversation = this.parseResult?.conversation ?? null;
      this.selectedMessageId = null;
      this.detectionLabel = 'Claude session JSONL';
      this.metaOnly = false;
      return;
    }

    this.conversation = null;
    this.parseResult = null;
    this.selectedMessageId = null;

    if (this.metaSummary) {
      this.detectionLabel = 'Claude meta JSON';
      this.metaOnly = true;
      return;
    }

    this.metaOnly = false;
    this.detectionLabel = 'Unsupported input';
  }

  render() {
    const baseMessages = this.#getTimelineMessages();
    const strictFocus = this.focusModeSettings.strictFocus;
    const timelineMessages = strictFocus
      ? baseMessages.filter(
          message => !this.#isMessageHiddenByFocusMode(message)
        )
      : baseMessages;
    const hiddenMessageIds = strictFocus
      ? []
      : timelineMessages
          .filter(message => this.#isMessageHiddenByFocusMode(message))
          .map(message => message.id);
    const selectedMessage =
      this.conversation?.messages.find(
        message => message.id === this.selectedMessageId
      ) ?? null;

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
                          aria-expanded=${this.showPreferenceDetails}
                          @click=${this.#handlePreferenceDetailsToggle}
                        >
                          <span>Preferences</span>
                        </button>
                        ${this.showPreferenceDetails
                          ? html`
                              <prism-preference-panel
                                inline
                                .availableAuthors=${this.#availableAuthors()}
                                .availableRecipients=${this.#availableRecipients()}
                                .availableContentTypes=${this.#availableContentTypes()}
                                .settings=${this.focusModeSettings}
                                .viewSettings=${this.viewSettings}
                                @prism-focus-mode-change=${this.#handleFocusModeChange}
                                @prism-view-settings-change=${this.#handleViewSettingsChange}
                              ></prism-preference-panel>
                            `
                          : nothing}
                      </div>
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

              ${this.conversation
                ? html`
                    <div class="metrics-row">
                      <span class="metric">
                        <strong>${this.conversation.sessionId ?? 'Unknown'}</strong>
                        <small>Session ID</small>
                      </span>
                      <span class="metric">
                        <strong>${this.parseResult?.stats.totalMessages ?? 0}</strong>
                        <small>Messages</small>
                      </span>
                      <span class="metric">
                        <strong>${this.parseResult?.stats.toolCalls ?? 0}</strong>
                        <small>Tool Calls</small>
                      </span>
                      <span class="metric">
                        <strong>${this.parseResult?.stats.eventMessages ?? 0}</strong>
                        <small>Events</small>
                      </span>
                    </div>
                  `
                : nothing}

              ${this.conversation
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

            ${this.conversation
              ? html`
                  <prism-timeline
                    .conversation=${this.conversation}
                    .messages=${timelineMessages}
                    .hiddenMessageIds=${hiddenMessageIds}
                    .selectedMessageId=${this.selectedMessageId}
                    .renderMarkdown=${this.renderMarkdown}
                    .showAbsoluteTimestamp=${this.viewSettings.showAbsoluteTimestamp}
                    .actionStatus=${this.conversationActionStatus}
                    .showShareMenu=${this.showShareMenu}
                    @prism-select-message=${this.#handleMessageSelect}
                    @prism-reveal-message=${this.#handleRevealMessage}
                    @prism-conversation-action=${this.#handleConversationAction}
                  ></prism-timeline>
                `
              : nothing}
          </section>

          <aside
            class="content-right"
            ?is-hidden=${!this.metaOnly && !this.showConversationMetadata}
          >
            <prism-metadata-panel
              title=${this.metaOnly
                ? 'Meta Summary'
                : !this.showConversationMetadata
                  ? 'Metadata'
                  : selectedMessage
                  ? 'Metadata'
                  : 'Conversation Metadata'}
              .data=${this.metaOnly
                ? this.metaSummary?.raw ?? null
                : this.showConversationMetadata
                  ? selectedMessage?.raw ?? this.conversation?.metadata ?? null
                  : null}
              .conversation=${this.conversation}
              .stats=${this.parseResult?.stats ?? null}
              .warnings=${this.parseResult?.warnings ?? []}
            ></prism-metadata-panel>
          </aside>
        </div>
      </div>
    `;
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

  #getTimelineMessages(): NormalizedMessage[] {
    if (!this.conversation) {
      return [];
    }

    return this.conversation.messages.filter(message => {
      if (this.sidechainOnly && !message.isSidechain) {
        return false;
      }

      return true;
    });
  }

  #isMessageHiddenByFocusMode(message: NormalizedMessage): boolean {
    if (this.focusModeExemptedMessageIds.includes(message.id)) {
      return false;
    }

    if (
      this.focusModeSettings.author.length > 0 &&
      !this.focusModeSettings.author.includes(message.role)
    ) {
      return true;
    }

    if (
      this.focusModeSettings.contentType.length > 0 &&
      !this.focusModeSettings.contentType.includes(message.channel)
    ) {
      return true;
    }

    if (
      this.focusModeSettings.recipient.length > 0 &&
      (!message.recipient ||
        !this.focusModeSettings.recipient.includes(message.recipient))
    ) {
      return true;
    }

    return false;
  }

  #availableAuthors(): PrismRole[] {
    return [...new Set(this.conversation?.messages.map(message => message.role) ?? [])]
      .sort();
  }

  #availableRecipients(): string[] {
    return [
      ...new Set(
        this.conversation?.messages
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
        this.conversation?.messages.map(message => message.channel) ?? []
      )
    ].sort() as PrismChannel[];
  }

  #getFilterSummary(): string {
    const parts: string[] = [];
    if (this.focusModeSettings.author.length > 0) {
      parts.push(`author: ${this.focusModeSettings.author.join(', ')}`);
    }
    if (this.focusModeSettings.recipient.length > 0) {
      parts.push(`recipient: ${this.focusModeSettings.recipient.join(', ')}`);
    }
    if (this.focusModeSettings.contentType.length > 0) {
      parts.push(`type: ${this.focusModeSettings.contentType.join(', ')}`);
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
    if (!this.showActionsMenu) {
      this.showPreferenceDetails = false;
    }
  }

  #handlePreferenceDetailsToggle(event: Event): void {
    event.stopPropagation();
    this.showPreferenceDetails = !this.showPreferenceDetails;
  }

  async #handleLoadStagedFiles(): Promise<void> {
    if (this.stagedFiles.length === 0) {
      return;
    }

    await this.ingestFiles(this.stagedFiles);
  }

  #handleDocumentClick = (event: MouseEvent): void => {
    if (!this.showActionsMenu) {
      return;
    }
    const path = event.composedPath();
    const menu = this.renderRoot.querySelector('.actions-menu');
    const toggle = this.renderRoot.querySelector('.action-toggle');
    if (menu && path.includes(menu)) {
      return;
    }
    if (toggle && path.includes(toggle)) {
      return;
    }
    this.showActionsMenu = false;
    this.showPreferenceDetails = false;
  };

  #handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.showActionsMenu) {
      this.showActionsMenu = false;
      this.showPreferenceDetails = false;
    }
  };

  #stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  #stageFiles(files: LoadedTextFile[]): void {
    this.stagedFiles = files;
    this.showActionsMenu = false;
    this.showPreferenceDetails = false;
    this.conversationActionStatus = `Staged ${files.length} file${files.length === 1 ? '' : 's'} for loading`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this.#handleDocumentClick);
    document.addEventListener('keydown', this.#handleKeydown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this.#handleDocumentClick);
    document.removeEventListener('keydown', this.#handleKeydown);
    super.disconnectedCallback();
  }

  #handleFocusModeChange(event: CustomEvent<PrismFocusModeSettings>): void {
    this.focusModeSettings = event.detail;
  }

  #handleViewSettingsChange(event: CustomEvent<PrismViewSettings>): void {
    this.viewSettings = event.detail;
  }

  #handleMessageSelect(event: CustomEvent<{ messageId: string }>): void {
    this.selectedMessageId = event.detail.messageId;
  }

  #handleRevealMessage(event: CustomEvent<{ messageId: string }>): void {
    this.focusModeExemptedMessageIds = [
      ...new Set([
        ...this.focusModeExemptedMessageIds,
        event.detail.messageId
      ])
    ];
  }

  async #handleConversationAction(
    event: CustomEvent<PrismConversationAction>
  ): Promise<void> {
    switch (event.detail) {
      case 'toggleMarkdown':
        this.renderMarkdown = !this.renderMarkdown;
        break;
      case 'toggleMetadata':
        this.showConversationMetadata = !this.showConversationMetadata;
        break;
      case 'toggleShareMenu':
        this.showShareMenu = !this.showShareMenu;
        break;
      case 'translateConversation':
        this.conversationActionStatus = 'Translation API not configured';
        break;
      case 'copyShareableUrl':
        await this.#copyShareableUrl();
        this.showShareMenu = false;
        break;
      case 'copyConversationJson':
        await this.#copyConversationJson();
        this.showShareMenu = false;
        break;
      case 'downloadConversation':
        this.#downloadConversation();
        this.showShareMenu = false;
        break;
      case 'openRenderView':
        this.#openRenderView();
        this.showShareMenu = false;
        break;
      default:
        break;
    }
  }

  async #copyShareableUrl(): Promise<void> {
    if (!this.conversation) {
      return;
    }

    const shareableUrl = `${window.location.href.split('#')[0]}#session=${this.conversation.sessionId ?? this.conversation.id}`;
    await this.#writeToClipboard(shareableUrl, 'Shareable URL copied');
  }

  async #copyConversationJson(): Promise<void> {
    if (!this.conversation) {
      return;
    }

    await this.#writeToClipboard(
      JSON.stringify(this.conversation, null, 2),
      'Conversation JSON copied'
    );
  }

  #downloadConversation(): void {
    if (!this.conversation) {
      return;
    }

    const fileContent =
      this.loadedSessionText ?? JSON.stringify(this.conversation, null, 2);
    const extension = this.loadedSessionText ? 'jsonl' : 'json';
    const blob = new Blob([fileContent], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.conversation.sessionId ?? this.conversation.id}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.conversationActionStatus = 'Conversation download started';
  }

  #openRenderView(): void {
    if (!this.conversation) {
      return;
    }

    const openedWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!openedWindow) {
      this.conversationActionStatus = 'Unable to open Claude render view';
      return;
    }

    const transcript = this.#getTimelineMessages()
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
    <h1 style="margin:0 0 16px;font-size:20px;">${this.#escapeHtml(this.conversation.title)}</h1>
    ${transcript}
  </body>
</html>`);
    openedWindow.document.close();
    this.conversationActionStatus = 'Opened Claude render view';
  }

  async #writeToClipboard(text: string, successMessage: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      this.conversationActionStatus = 'Clipboard API unavailable in this environment';
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.conversationActionStatus = successMessage;
    } catch {
      this.conversationActionStatus = 'Clipboard write failed';
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
