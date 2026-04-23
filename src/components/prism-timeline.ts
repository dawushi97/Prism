import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type {
  NormalizedConversation,
  NormalizedMessage,
  PrismConversationAction
} from '../types/prism';
import { renderIcon } from '../utils/icons';
import './prism-message-card';
import './prism-message-hidden';

@customElement('prism-timeline')
export class PrismTimeline extends LitElement {
  @property({ attribute: false })
  conversation: NormalizedConversation | null = null;

  @property({ attribute: false })
  messages: NormalizedMessage[] = [];

  @property({ type: String })
  selectedMessageId: string | null = null;

  @property({ type: Boolean })
  renderMarkdown = false;

  @property({ type: Boolean })
  showAbsoluteTimestamp = false;

  @property({ type: String })
  maxMessageHeight = '100vh';

  @property({ type: String })
  actionStatus: string | null = null;

  @property({ type: Boolean })
  showShareMenu = false;

  @property({ attribute: false })
  hiddenMessageIds: string[] = [];

  render() {
    if (!this.conversation) {
      return html`<div class="empty">No timeline loaded.</div>`;
    }

    return html`
      <section class="timeline">
        <header class="timeline-header">
          <div class="title-block">
            <p class="eyebrow">Conversation</p>
            <h2>${this.conversation.title}</h2>
          </div>
          <div class="actions" aria-label="conversation actions">
            ${this.#renderActionButton(
              'toggleMarkdown',
              renderIcon('Type', { slashed: !this.renderMarkdown }),
              this.renderMarkdown
                ? 'Disable markdown rendering'
                : 'Enable markdown rendering'
            )}
            ${this.#renderActionButton(
              'translateConversation',
              renderIcon('Languages'),
              'Translate conversation'
            )}
            ${this.#renderActionButton(
              'toggleMetadata',
              renderIcon('Braces'),
              'Toggle metadata panel'
            )}
            ${this.#renderActionButton(
              'toggleShareMenu',
              renderIcon('Share2'),
              'Share'
            )}
          </div>
        </header>
        ${this.showShareMenu
          ? html`
              <div class="share-menu">
                ${this.#renderActionButton('copyShareableUrl', 'Copy shareable URL')}
                ${this.#renderActionButton(
                  'copyConversationJson',
                  'Copy conversation JSON'
                )}
                ${this.#renderActionButton('downloadConversation', 'Download')}
                ${this.#renderActionButton('openRenderView', 'Claude render view')}
              </div>
            `
          : null}
        ${this.actionStatus
          ? html`<div class="action-status">${this.actionStatus}</div>`
          : null}
        <div class="stack">
          ${this.messages.map(
            message =>
              this.hiddenMessageIds.includes(message.id)
                ? html`
                    <prism-message-hidden
                      .message=${message}
                      .showAbsoluteTimestamp=${this.showAbsoluteTimestamp}
                    ></prism-message-hidden>
                  `
                : html`
                    <prism-message-card
                      .message=${message}
                      ?selected=${message.id === this.selectedMessageId}
                      .renderMarkdown=${this.renderMarkdown}
                      .showAbsoluteTimestamp=${this.showAbsoluteTimestamp}
                      .maxMessageHeight=${this.maxMessageHeight}
                    ></prism-message-card>
                  `
          )}
        </div>
      </section>
    `;
  }

  #renderActionButton(
    action: PrismConversationAction,
    content: string | TemplateResult,
    ariaLabel?: string
  ) {
    return html`
      <button
        name=${action}
        aria-label=${ifDefined(ariaLabel)}
        title=${ifDefined(ariaLabel)}
        @click=${() => this.#emitAction(action)}
      >${content}</button>
    `;
  }

  #emitAction(action: PrismConversationAction): void {
    this.dispatchEvent(
      new CustomEvent<PrismConversationAction>('prism-conversation-action', {
        detail: action,
        bubbles: true,
        composed: true
      })
    );
  }

  static styles = css`
    :host {
      display: block;
    }

    .timeline {
      display: grid;
      gap: 10px;
      background-color: white;
      border-radius: 10px;
      padding: 14px 16px 18px;
      border: 1px solid var(--gray-200, #ebebeb);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .stack {
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .title-block {
      min-width: 0;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .actions button {
      all: unset;
      width: 30px;
      height: 30px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      border: 1px solid var(--gray-300, #dadada);
      background: var(--gray-50, #fafafa);
      color: var(--gray-700, #595959);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
    }

    .actions button:hover {
      background: var(--gray-100, #f5f5f5);
      color: var(--gray-900, #242424);
    }

    .share-menu {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--gray-50, #fafafa);
      border: 1px solid var(--gray-200, #ebebeb);
    }

    .share-menu button {
      all: unset;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--gray-300, #dadada);
      background: white;
      color: var(--gray-700, #595959);
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
    }

    .action-status {
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--gray-50, #fafafa);
      border: 1px solid var(--gray-200, #ebebeb);
      color: var(--gray-600, #656565);
      font-size: 13px;
    }

    .eyebrow {
      margin: 0;
      color: var(--gray-500, #7c7c7c);
      font-size: 12px;
    }

    h2 {
      margin: 2px 0 0;
      font-size: 16px;
      line-height: 1.3;
      color: var(--gray-900, #242424);
      font-weight: 500;
    }

    .empty {
      padding: 12px;
      border-radius: 5px;
      background: var(--gray-100, #f5f5f5);
      border: 1px dashed var(--gray-300, #d4d4d4);
      color: var(--gray-600, #656565);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-timeline': PrismTimeline;
  }
}
