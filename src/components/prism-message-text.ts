import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { renderMarkdown } from '../utils/markdown';

@customElement('prism-message-text')
export class PrismMessageText extends LitElement {
  @property({ type: String })
  text = '';

  @property({ type: Boolean })
  shouldRenderMarkdown = false;

  render() {
    if (this.shouldRenderMarkdown) {
      return html`
        <div class="message-text rendered" data-mode="markdown">
          ${unsafeHTML(renderMarkdown(this.text))}
        </div>
      `;
    }

    return html`<div class="message-text plain" data-mode="plain">${this.text}</div>`;
  }

  static styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .message-text {
      color: inherit;
      line-height: 1.5;
      word-break: break-word;
    }

    .plain {
      white-space: pre-wrap;
    }

    .rendered > :first-child {
      margin-top: 0;
    }

    .rendered > :last-child {
      margin-bottom: 0;
    }

    .rendered p,
    .rendered ul,
    .rendered ol,
    .rendered blockquote,
    .rendered pre,
    .rendered h1,
    .rendered h2,
    .rendered h3,
    .rendered h4,
    .rendered h5,
    .rendered h6 {
      margin: 0 0 0.8em;
    }

    .rendered ul,
    .rendered ol {
      padding-left: 1.2rem;
    }

    .rendered blockquote {
      padding-left: 0.9rem;
      border-left: 3px solid var(--gray-300, #dadada);
      color: var(--gray-700, #595959);
    }

    .rendered code {
      padding: 0.08rem 0.3rem;
      border-radius: 4px;
      background: var(--gray-100, #f3f3f3);
      font-family:
        ui-monospace,
        'SFMono-Regular',
        monospace;
      font-size: 0.92em;
    }

    .rendered pre {
      overflow: auto;
      padding: 10px 12px;
      border-radius: 6px;
      background: var(--gray-100, #f3f3f3);
    }

    .rendered pre code {
      padding: 0;
      background: transparent;
      display: block;
      white-space: pre;
    }

    .rendered a {
      color: var(--blue-700, #1e76d8);
      text-decoration: none;
    }

    .rendered a:hover {
      text-decoration: underline;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-message-text': PrismMessageText;
  }
}
