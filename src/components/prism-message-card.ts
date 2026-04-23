import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { NormalizedMessage } from '../types/prism';
import { renderIcon, type IconName } from '../utils/icons';
import './prism-message-text';

@customElement('prism-message-card')
export class PrismMessageCard extends LitElement {
  @property({ attribute: false })
  message!: NormalizedMessage;

  @property({ type: Boolean })
  selected = false;

  @property({ type: Boolean })
  renderMarkdown = false;

  @property({ type: Boolean })
  showAbsoluteTimestamp = false;

  @property({ type: String })
  maxMessageHeight = '100vh';

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('click', this.#handleClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#handleClick);
    super.disconnectedCallback();
  }

  updated(): void {
    if (!this.message) {
      return;
    }

    this.dataset.channel = this.message.channel;
    this.dataset.sidechain = String(this.message.isSidechain);
    this.dataset.role = this.message.role;
    if (this.message.recipient) {
      this.dataset.recipient = this.message.recipient;
    } else {
      delete this.dataset.recipient;
    }
  }

  render() {
    if (!this.message) {
      return html``;
    }

    const isCodeLike =
      this.message.channel === 'tool_call' ||
      this.message.channel === 'tool_result' ||
      this.message.channel === 'event';

    return html`
      <article
        class="card ${this.selected ? 'selected' : ''}"
        style=${`--prism-message-max-height: ${this.maxMessageHeight};`}
      >
        <div class="rail ${this.message.role}">
          <span class="glyph" aria-hidden="true">${this.#getRoleGlyph()}</span>
        </div>
        <header>
          <div class="chips">
            <span class="chip role">${this.message.role}</span>
            <span class="chip channel">${this.message.channel}</span>
            ${this.message.isSidechain
              ? html`<span class="chip sidechain">sidechain</span>`
              : null}
          </div>
          <div class="meta">
            ${this.message.name ? html`<span>${this.message.name}</span>` : null}
            ${this.message.timestamp
              ? html`<time>${this.#formatTimestamp(this.message.timestamp)}</time>`
              : null}
          </div>
        </header>
        ${isCodeLike
          ? html`<pre>${this.message.text}</pre>`
          : html`
              <prism-message-text
                .text=${this.message.text}
                .shouldRenderMarkdown=${this.renderMarkdown}
                .maxHeight=${this.maxMessageHeight}
              ></prism-message-text>
            `}
      </article>
    `;
  }

  #formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }

    if (this.showAbsoluteTimestamp) {
      return date.toLocaleString();
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  #getRoleGlyph(): TemplateResult {
    const iconName: IconName = (() => {
      switch (this.message.role) {
        case 'assistant':
          return 'Bot';
        case 'tool':
          return 'Wrench';
        case 'system':
        case 'meta':
          return 'MoreHorizontal';
        case 'user':
        default:
          return 'User';
      }
    })();
    return renderIcon(iconName, { size: 16 });
  }

  #handleClick = () => {
    if (!this.message) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('prism-select-message', {
        detail: { messageId: this.message.id },
        bubbles: true,
        composed: true
      })
    );
  };

  static styles = css`
    :host {
      display: block;
      cursor: pointer;
      color: var(--gray-900, #242424);
    }

    .card {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      column-gap: 10px;
      border-radius: 5px;
      background: white;
      padding: 10px 12px 10px 10px;
      border: 1px solid var(--gray-200, #ebebeb);
      transition: background-color 120ms ease;
    }

    .card:hover {
      background: color-mix(in lab, var(--gray-100, #f5f5f5), white 60%);
    }

    .card.selected {
      background: color-mix(in lab, var(--blue-50, #eef7ff), white 35%);
    }

    .rail {
      grid-row: 1 / span 2;
      display: grid;
      justify-items: center;
      align-content: start;
      gap: 8px;
      padding-top: 2px;
      color: var(--gray-500, #7c7c7c);
    }

    .rail::after {
      content: '';
      width: 4px;
      min-height: 100%;
      border-radius: 999px;
      background: currentColor;
      opacity: 0.75;
    }

    .rail.user {
      color: var(--green-700, #2f8b43);
    }

    .rail.assistant,
    .rail.tool {
      color: var(--purple-700, #6d2aa1);
    }

    .rail.system,
    .rail.meta {
      color: var(--gray-500, #7c7c7c);
    }

    .glyph {
      display: inline-flex;
      line-height: 0;
    }

    header {
      grid-column: 2;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .chips,
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      border-radius: 5px;
      padding: 0 5px;
      font-size: 12px;
      line-height: 1.5;
      font-weight: 500;
      background: color-mix(in lab, currentColor 7%, white 100%);
      color: currentColor;
    }

    .role {
      color: var(--green-700, #2f8b43);
    }

    .channel {
      color: var(--purple-700, #6d2aa1);
    }

    .sidechain {
      color: var(--blue-700, #1e76d8);
    }

    .meta {
      color: var(--gray-500, #7c7c7c);
      font-size: 12px;
    }

    pre {
      grid-column: 2;
      margin: 0;
      color: inherit;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
    }

    prism-message-text {
      grid-column: 2;
    }

    pre {
      max-height: var(--prism-message-max-height, 100vh);
      overflow: auto;
      padding: 8px 10px;
      border-radius: 5px;
      background: var(--gray-100, #f5f5f5);
      color: var(--gray-800, #383838);
      font-family:
        ui-monospace,
        'SFMono-Regular',
        monospace;
      font-size: 12px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-message-card': PrismMessageCard;
  }
}
