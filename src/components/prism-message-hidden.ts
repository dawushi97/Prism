import { LitElement, css, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { NormalizedMessage } from '../types/prism';
import { renderIcon, type IconName } from '../utils/icons';

@customElement('prism-message-hidden')
export class PrismMessageHidden extends LitElement {
  @property({ attribute: false })
  message: NormalizedMessage | null = null;

  render() {
    const role = this.message?.role ?? 'user';
    const channel = this.message?.channel ?? 'message';

    return html`
      <button
        type="button"
        class="hidden-stub"
        aria-label="Show message"
        @click=${this.#handleClick}
      >
        <span class="rail rail-${role}" aria-hidden="true">
          ${this.#getRoleGlyph()}
        </span>

        <span class="chips">
          <span class="chip role role-${role}">${role}</span>
          <span class="chip channel">${channel}</span>
          ${this.message?.name
            ? html`<span class="chip name">${this.message.name}</span>`
            : null}
        </span>

        <span class="reveal">
          ${renderIcon('EyeOff', { size: 12 })}
          <span>show</span>
        </span>
      </button>
    `;
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
    return renderIcon(iconName, { size: 14 });
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

    .hidden-stub {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 16px 1fr auto;
      align-items: center;
      column-gap: 10px;
      width: 100%;
      padding: 5px 10px 5px 8px;
      border: 1px solid var(--gray-200);
      border-radius: 8px;
      background: var(--gray-50);
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }

    .hidden-stub:hover {
      background: white;
      border-color: var(--gray-300);
    }

    .hidden-stub:focus-visible {
      outline: 2px solid var(--blue-700);
      outline-offset: 1px;
    }

    .rail {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--gray-500);
      opacity: 0.7;
    }

    .rail-user {
      color: var(--green-700);
    }

    .rail-assistant,
    .rail-tool {
      color: var(--purple-700);
    }

    .rail-system,
    .rail-meta {
      color: var(--gray-500);
    }

    .chips {
      display: flex;
      gap: 5px;
      align-items: center;
      flex-wrap: wrap;
      min-width: 0;
    }

    .chip {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10.5px;
      line-height: 1.5;
      font-weight: 400;
      white-space: nowrap;
      color: var(--gray-600);
      background: var(--gray-100);
      font-variant-numeric: tabular-nums;
    }

    .chip.role {
      font-weight: 500;
    }

    .chip.role-user {
      color: var(--green-700);
      background: hsl(122, 43%, 96%);
    }

    .chip.role-assistant,
    .chip.role-tool {
      color: var(--purple-700);
      background: hsl(282, 68%, 97%);
    }

    .chip.role-system,
    .chip.role-meta {
      color: var(--gray-600);
      background: var(--gray-100);
    }

    .chip.channel,
    .chip.name {
      color: var(--gray-600);
      background: var(--gray-100);
    }

    .reveal {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--gray-500);
      font-size: 11px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-message-hidden': PrismMessageHidden;
  }
}
