import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { NormalizedMessage } from '../types/prism';
import { renderIcon, type IconName } from '../utils/icons';

@customElement('prism-message-hidden')
export class PrismMessageHidden extends LitElement {
  @property({ attribute: false })
  message: NormalizedMessage | null = null;

  @property({ type: Boolean })
  showAbsoluteTimestamp = false;

  render() {
    const role = this.message?.role ?? 'user';
    return html`
      <article class="hidden-message">
        <div class="rail ${role}">
          <span class="glyph" aria-hidden="true">${this.#getRoleGlyph()}</span>
          ${this.message?.timestamp
            ? html`<time>${this.#formatTimestamp(this.message.timestamp)}</time>`
            : null}
          <span class="role-label">${role}</span>
        </div>
        <button class="reveal" type="button" @click=${this.#handleClick}>
          ${this.#getLabel()}
        </button>
      </article>
    `;
  }

  #getLabel(): string {
    if (!this.message) {
      return 'Show hidden message';
    }

    const typeLabel =
      this.message.channel === 'tool_call'
        ? 'tool call'
        : this.message.channel === 'tool_result'
          ? 'tool result'
          : this.message.channel === 'event'
            ? 'event'
            : this.message.channel === 'thinking'
              ? 'thinking'
              : 'text';

    return `Show ${typeLabel} message`;
  }

  #getRoleGlyph(): TemplateResult {
    const iconName: IconName = (() => {
      switch (this.message?.role) {
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
      second: '2-digit',
      hour12: false
    });
  }

  #handleClick = () => {
    if (!this.message) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('prism-reveal-message', {
        detail: { messageId: this.message.id },
        bubbles: true,
        composed: true
      })
    );
  };

  static styles = css`
    :host {
      display: block;
    }

    .hidden-message {
      display: grid;
      grid-template-columns: 84px minmax(0, 1fr);
      column-gap: 14px;
      align-items: center;
      padding: 10px 14px 10px 0;
      border-radius: 5px;
      background: var(--gray-50, #fafafa);
      border: 1px solid var(--gray-200, #ebebeb);
    }

    .rail {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 6px;
      padding: 2px 0;
      color: var(--gray-500, #7c7c7c);
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

    .rail time {
      font-size: 11px;
      line-height: 1.2;
      color: var(--gray-600, #656565);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .role-label {
      font-size: 10px;
      line-height: 1;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--gray-500, #7c7c7c);
    }

    .reveal {
      all: unset;
      justify-self: start;
      min-height: 28px;
      padding: 0 12px;
      border-radius: 10px;
      background: white;
      border: 1px solid var(--gray-200, #ebebeb);
      color: var(--gray-700, #595959);
      font-size: 14px;
      line-height: 1.2;
      cursor: pointer;
    }

    .reveal:hover {
      background: var(--gray-100, #f5f5f5);
      color: var(--gray-900, #242424);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-message-hidden': PrismMessageHidden;
  }
}
