import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type {
  ClaudeSessionStats,
  NormalizedConversation
} from '../types/prism';

@customElement('prism-metadata-panel')
export class PrismMetadataPanel extends LitElement {
  @property({ type: String })
  title = 'Metadata';

  @property({ attribute: false })
  data: unknown = null;

  @property({ attribute: false })
  conversation: NormalizedConversation | null = null;

  @property({ attribute: false })
  stats: ClaudeSessionStats | null = null;

  @property({ attribute: false })
  warnings: string[] = [];

  render() {
    return html`
      <aside class="panel">
        <header>
          <p class="eyebrow">Metadata</p>
          <h2>${this.title}</h2>
        </header>
        ${this.conversation
          ? html`
              <section class="summary">
                <div class="summary-row">
                  <span class="summary-label">Source</span>
                  <span class="summary-value">${this.conversation.source}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Session ID</span>
                  <span class="summary-value"
                    >${this.conversation.sessionId ?? 'Unknown'}</span
                  >
                </div>
                <div class="summary-row">
                  <span class="summary-label">Started</span>
                  <span class="summary-value"
                    >${this.conversation.startedAt ?? 'Unknown'}</span
                  >
                </div>
                ${this.stats
                  ? html`
                      <div class="summary-row">
                        <span class="summary-label">Counts</span>
                        <span class="summary-value"
                          >${this.stats.totalMessages} messages, ${this.stats.toolCalls}
                          tool calls, ${this.stats.eventMessages} events</span
                        >
                      </div>
                    `
                  : null}
              </section>
            `
          : null}
        ${this.warnings.length > 0
          ? html`
              <section class="warnings">
                <div class="warnings-title">Warnings</div>
                <ul>
                  ${this.warnings.map(
                    warning => html`<li>${warning}</li>`
                  )}
                </ul>
              </section>
            `
          : null}
        <pre>${this.#formatData(this.data)}</pre>
      </aside>
    `;
  }

  #formatData(data: unknown): string {
    if (data == null) {
      return 'No metadata selected.';
    }

    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .panel {
      position: sticky;
      top: 72px;
      display: grid;
      gap: 8px;
      padding-top: 2px;
    }

    .eyebrow {
      margin: 0;
      color: var(--gray-500, #7c7c7c);
      font-size: 12px;
    }

    h2 {
      margin: 0;
      font-size: 16px;
      color: var(--gray-900, #242424);
      font-weight: 500;
    }

    .summary,
    .warnings {
      padding: 10px 12px;
      border-radius: 5px;
      border: 1px solid var(--gray-200, #ebebeb);
      background: white;
    }

    .summary {
      display: grid;
      gap: 8px;
    }

    .summary-row {
      display: grid;
      gap: 4px;
    }

    .summary-label,
    .warnings-title {
      font-size: 12px;
      color: var(--gray-500, #7c7c7c);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .summary-value {
      color: var(--gray-800, #383838);
      font-size: 13px;
      word-break: break-word;
    }

    .warnings ul {
      margin: 8px 0 0;
      padding-left: 18px;
      color: var(--gray-700, #5c5c5c);
      font-size: 13px;
      line-height: 1.45;
    }

    pre {
      margin: 0;
      max-height: calc(100vh - 110px);
      overflow: auto;
      padding: 10px 12px;
      border-radius: 5px;
      background: var(--gray-100, #f5f5f5);
      color: var(--gray-800, #383838);
      border: 1px solid var(--gray-200, #ebebeb);
      font-family:
        ui-monospace,
        'SFMono-Regular',
        monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-metadata-panel': PrismMetadataPanel;
  }
}
