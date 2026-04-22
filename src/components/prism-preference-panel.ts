import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { PrismChannel, PrismRole } from '../types/prism';

export interface PrismFocusModeSettings {
  author: PrismRole[];
  recipient: string[];
  contentType: PrismChannel[];
  strictFocus: boolean;
}

export interface PrismViewSettings {
  showAbsoluteTimestamp: boolean;
}

@customElement('prism-preference-panel')
export class PrismPreferencePanel extends LitElement {
  @property({ type: Boolean, reflect: true })
  inline = false;

  @property({ attribute: false })
  availableAuthors: PrismRole[] = [];

  @property({ attribute: false })
  availableRecipients: string[] = [];

  @property({ attribute: false })
  availableContentTypes: PrismChannel[] = [];

  @property({ attribute: false })
  settings: PrismFocusModeSettings = {
    author: [],
    recipient: [],
    contentType: [],
    strictFocus: false
  };

  @property({ attribute: false })
  viewSettings: PrismViewSettings = {
    showAbsoluteTimestamp: false
  };

  render() {
    return html`
      <div class="preference-window">
        ${this.inline ? null : html`<div class="header">Preferences</div>`}
        <div class="content">
          <div class="setting-block">
            <div class="setting-block-header">Message Labels</div>
            <div class="setting-block-content">
              <label class="toggle-row">
                <span>absolute timestamp</span>
                <input
                  type="checkbox"
                  name="showAbsoluteTimestamp"
                  .checked=${this.viewSettings.showAbsoluteTimestamp}
                  @change=${this.#toggleAbsoluteTimestamp}
                />
              </label>
            </div>
          </div>

          <div class="setting-block">
            <div class="setting-block-header">Focus Mode</div>
            <div class="setting-block-content">
              <label class="toggle-row">
                <span>strict focus (hide unmatched)</span>
                <input
                  type="checkbox"
                  name="strictFocus"
                  .checked=${this.settings.strictFocus}
                  @change=${this.#toggleStrictFocus}
                />
              </label>

              <div class="form-block-header">Focus by author</div>
              <div class="form-block">
                ${this.availableAuthors.map(
                  role => html`
                    <label class="checkbox-group">
                      <input
                        type="checkbox"
                        name="focusAuthor"
                        value=${role}
                        .checked=${this.settings.author.includes(role)}
                        @change=${this.#toggleAuthor}
                      />
                      <span>${role}</span>
                    </label>
                  `
                )}
              </div>

              <div class="form-block-header">Focus by recipient</div>
              <div class="form-block">
                ${this.availableRecipients.length === 0
                  ? html`<div class="empty">No recipients in this session</div>`
                  : this.availableRecipients.map(
                      recipient => html`
                        <label class="checkbox-group">
                          <input
                            type="checkbox"
                            name="focusRecipient"
                            value=${recipient}
                            .checked=${this.settings.recipient.includes(recipient)}
                            @change=${this.#toggleRecipient}
                          />
                          <span>${recipient}</span>
                        </label>
                      `
                    )}
              </div>

              <div class="form-block-header">Focus by content type</div>
              <div class="form-block">
                ${this.availableContentTypes.map(
                  channel => html`
                    <label class="checkbox-group">
                      <input
                        type="checkbox"
                        name="focusContentType"
                        value=${channel}
                        .checked=${this.settings.contentType.includes(channel)}
                        @change=${this.#toggleContentType}
                      />
                      <span>${channel}</span>
                    </label>
                  `
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #toggleAuthor = (event: Event) => {
    this.#emitChangedSettings('author', event);
  };

  #toggleRecipient = (event: Event) => {
    this.#emitChangedSettings('recipient', event);
  };

  #toggleContentType = (event: Event) => {
    this.#emitChangedSettings('contentType', event);
  };

  #toggleAbsoluteTimestamp = (event: Event) => {
    this.#emitViewSettingChange('showAbsoluteTimestamp', event);
  };

  #toggleStrictFocus = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const nextSettings: PrismFocusModeSettings = {
      ...this.settings,
      strictFocus: input.checked
    };
    this.settings = nextSettings;
    this.dispatchEvent(
      new CustomEvent<PrismFocusModeSettings>('prism-focus-mode-change', {
        detail: nextSettings,
        bubbles: true,
        composed: true
      })
    );
  };

  #emitChangedSettings(
    key: 'author' | 'recipient' | 'contentType',
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const current = new Set<string>(this.settings[key]);

    if (input.checked) {
      current.add(input.value);
    } else {
      current.delete(input.value);
    }

    const nextSettings: PrismFocusModeSettings = {
      ...this.settings,
      [key]: [...current]
    };
    this.settings = nextSettings;

    this.dispatchEvent(
      new CustomEvent<PrismFocusModeSettings>('prism-focus-mode-change', {
        detail: nextSettings,
        bubbles: true,
        composed: true
      })
    );
  }

  #emitViewSettingChange(
    key: keyof PrismViewSettings,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const nextSettings: PrismViewSettings = {
      ...this.viewSettings,
      [key]: input.checked
    };

    this.viewSettings = nextSettings;
    this.dispatchEvent(
      new CustomEvent<PrismViewSettings>('prism-view-settings-change', {
        detail: nextSettings,
        bubbles: true,
        composed: true
      })
    );
  }

  static styles = css`
    :host {
      display: block;
    }

    :host(:not([inline])) {
      position: absolute;
      top: 48px;
      right: 0;
      z-index: 10;
    }

    .preference-window {
      --panel-width: 280px;
      width: var(--panel-width);
      max-height: calc(100vh - 90px);
      overflow-y: auto;
      border-radius: 8px;
      background: white;
      box-shadow:
        0 0 2px hsla(0, 0%, 0%, 0.15),
        0 0 4px hsla(0, 0%, 0%, 0.07),
        0 0 12px hsla(0, 0%, 0%, 0.07);
      border: 1px solid var(--gray-200, #ebebeb);
    }

    :host([inline]) .preference-window {
      width: min(320px, 100%);
      max-height: 420px;
      box-shadow: none;
      border-radius: 6px;
      background: var(--gray-50, #fafafa);
    }

    .header {
      height: 34px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      font-size: 1rem;
      font-weight: 600;
      background: var(--gray-100, #f5f5f5);
      border-bottom: 1px solid var(--gray-200, #ebebeb);
    }

    .content {
      padding: 10px 0;
    }

    .setting-block {
      padding: 0 12px;
      display: grid;
      gap: 8px;
      border-bottom: 1px solid var(--gray-200, #ebebeb);
      padding-bottom: 12px;
      margin-bottom: 12px;
    }

    .setting-block:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .setting-block-header {
      font-weight: 600;
      color: var(--gray-900, #242424);
    }

    .setting-block-content {
      display: grid;
      gap: 10px;
      padding-bottom: 4px;
    }

    .form-block-header {
      font-size: 14px;
      font-weight: 600;
      color: var(--gray-700, #5c5c5c);
    }

    .form-block {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 14px;
      color: var(--gray-700, #5c5c5c);
    }

    .checkbox-group {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: var(--gray-700, #5c5c5c);
    }

    input[type='checkbox'] {
      margin: 0;
      accent-color: var(--blue-700, #1e76d8);
    }

    .empty {
      color: var(--gray-500, #7c7c7c);
      font-size: 13px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-preference-panel': PrismPreferencePanel;
  }
}
