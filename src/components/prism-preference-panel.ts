import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { PrismChannel, PrismRole } from '../types/prism';

export type PrismMessageHeightMode = 'automatic' | 'no-limit' | 'custom';
export type PrismLayoutMode = 'list' | 'grid';
export type PrismFocusChipState = 'neutral' | 'include' | 'exclude';
export type PrismFocusFieldName = 'author' | 'recipient' | 'contentType';

export interface PrismFocusBucket<T extends string> {
  include: T[];
  exclude: T[];
}

export interface PrismFocusModeSettings {
  author: PrismFocusBucket<PrismRole>;
  recipient: PrismFocusBucket<string>;
  contentType: PrismFocusBucket<PrismChannel>;
  strictFocus: boolean;
}

export interface PrismViewSettings {
  showAbsoluteTimestamp: boolean;
  maxMessageHeightMode: PrismMessageHeightMode;
  customMaxMessageHeight: number;
  layoutMode: PrismLayoutMode;
  gridColumnWidth: number;
}

export const MIN_CUSTOM_MAX_MESSAGE_HEIGHT = 120;
export const MAX_CUSTOM_MAX_MESSAGE_HEIGHT = 3000;
export const DEFAULT_CUSTOM_MAX_MESSAGE_HEIGHT = 300;
export const MIN_GRID_COLUMN_WIDTH = 220;
export const MAX_GRID_COLUMN_WIDTH = 640;
export const DEFAULT_GRID_COLUMN_WIDTH = 373;

export const clampCustomMessageHeight = (value: number): number =>
  Math.max(
    MIN_CUSTOM_MAX_MESSAGE_HEIGHT,
    Math.min(MAX_CUSTOM_MAX_MESSAGE_HEIGHT, value)
  );

export const clampGridColumnWidth = (value: number): number =>
  Math.max(MIN_GRID_COLUMN_WIDTH, Math.min(MAX_GRID_COLUMN_WIDTH, value));

const createEmptyFocusBucket = <T extends string>(): PrismFocusBucket<T> => ({
  include: [],
  exclude: []
});

export const createDefaultFocusModeSettings = (): PrismFocusModeSettings => ({
  author: createEmptyFocusBucket<PrismRole>(),
  recipient: createEmptyFocusBucket<string>(),
  contentType: createEmptyFocusBucket<PrismChannel>(),
  strictFocus: false
});

export const createDefaultViewSettings = (): PrismViewSettings => ({
  showAbsoluteTimestamp: false,
  maxMessageHeightMode: 'automatic',
  customMaxMessageHeight: DEFAULT_CUSTOM_MAX_MESSAGE_HEIGHT,
  layoutMode: 'list',
  gridColumnWidth: DEFAULT_GRID_COLUMN_WIDTH
});

const getBucketState = <T extends string>(
  bucket: PrismFocusBucket<T>,
  value: T
): PrismFocusChipState => {
  if (bucket.include.includes(value)) {
    return 'include';
  }
  if (bucket.exclude.includes(value)) {
    return 'exclude';
  }
  return 'neutral';
};

@customElement('prism-preference-panel')
export class PrismPreferencePanel extends LitElement {
  @state()
  private dragOffsetX = 0;

  @state()
  private dragOffsetY = 0;

  @state()
  private isFocusModeCollapsed = true;

  @state()
  private isAdvancedCollapsed = true;

  private dragStartX = 0;

  private dragStartY = 0;

  @property({ attribute: false })
  availableAuthors: PrismRole[] = [];

  @property({ attribute: false })
  availableRecipients: string[] = [];

  @property({ attribute: false })
  availableContentTypes: PrismChannel[] = [];

  @property({ attribute: false })
  settings: PrismFocusModeSettings = createDefaultFocusModeSettings();

  @property({ attribute: false })
  viewSettings: PrismViewSettings = createDefaultViewSettings();

  render() {
    return html`
      <div
        class="preference-window"
        style=${`transform: translate(${this.dragOffsetX}px, ${this.dragOffsetY}px);`}
      >
        <div class="header" @mousedown=${this.#handleDragStart}>
          <span>Preferences</span>
          <button
            class="close-button"
            type="button"
            name="closePreferences"
            aria-label="Close preferences"
            @click=${this.#handleClose}
          >
            ×
          </button>
        </div>

        <div class="content">
          <div class="setting-block">
            <div class="setting-block-header">Max Message Height</div>
            <div class="setting-block-content">
              ${this.#renderRadioRow(
                'maxMessageHeightMode',
                'automatic',
                'Automatic',
                this.viewSettings.maxMessageHeightMode === 'automatic',
                this.#handleMaxMessageHeightModeChange
              )}
              ${this.#renderRadioRow(
                'maxMessageHeightMode',
                'no-limit',
                'No Limit',
                this.viewSettings.maxMessageHeightMode === 'no-limit',
                this.#handleMaxMessageHeightModeChange
              )}
              ${this.#renderRadioRow(
                'maxMessageHeightMode',
                'custom',
                `Custom Height (${this.viewSettings.customMaxMessageHeight}px)`,
                this.viewSettings.maxMessageHeightMode === 'custom',
                this.#handleMaxMessageHeightModeChange
              )}
              <input
                class="range-input"
                type="range"
                name="customMessageHeight"
                min=${String(MIN_CUSTOM_MAX_MESSAGE_HEIGHT)}
                max=${String(MAX_CUSTOM_MAX_MESSAGE_HEIGHT)}
                step="10"
                .value=${String(this.viewSettings.customMaxMessageHeight)}
                @input=${this.#handleCustomMessageHeightInput}
              />
            </div>
          </div>

          <div class="setting-block">
            <div class="setting-block-header">Message Labels</div>
            <div class="setting-block-content">
              <label class="toggle-row checkbox-row">
                <input
                  type="checkbox"
                  name="showAbsoluteTimestamp"
                  .checked=${this.viewSettings.showAbsoluteTimestamp}
                  @change=${this.#toggleAbsoluteTimestamp}
                />
                <span>absolute timestamp</span>
              </label>
            </div>
          </div>

          <div class="setting-block">
            <div class="setting-block-header">Layout</div>
            <div class="setting-block-content">
              ${this.#renderRadioRow(
                'layoutMode',
                'list',
                'List View',
                this.viewSettings.layoutMode === 'list',
                this.#handleLayoutModeChange
              )}
              ${this.#renderRadioRow(
                'layoutMode',
                'grid',
                `Grid View (${this.viewSettings.gridColumnWidth}px)`,
                this.viewSettings.layoutMode === 'grid',
                this.#handleLayoutModeChange
              )}
              <input
                class="range-input"
                type="range"
                name="gridColumnWidth"
                min=${String(MIN_GRID_COLUMN_WIDTH)}
                max=${String(MAX_GRID_COLUMN_WIDTH)}
                step="1"
                .value=${String(this.viewSettings.gridColumnWidth)}
                @input=${this.#handleGridColumnWidthInput}
              />
            </div>
          </div>

          <div class="setting-block">
            <button
              class="section-toggle"
              type="button"
              name="toggleFocusModeSection"
              @click=${this.#toggleFocusModeSection}
            >
              <span
                class="disclosure"
                ?is-collapsed=${this.isFocusModeCollapsed}
                aria-hidden="true"
              >
                ▸
              </span>
              <span>Focus Mode</span>
            </button>
            <div
              class="setting-block-content"
              ?is-hidden=${this.isFocusModeCollapsed}
            >
              <label class="toggle-row checkbox-row">
                <input
                  type="checkbox"
                  name="strictFocus"
                  .checked=${this.settings.strictFocus}
                  @change=${this.#toggleStrictFocus}
                />
                <span>strict focus (hide unmatched)</span>
              </label>

              <div class="focus-hint">
                Click to include. Shift+Click to exclude. Click again to clear.
              </div>
              <div class="focus-summary">${this.#getFocusSummary()}</div>

              <div class="form-block-header">Focus by author</div>
              <div class="chip-block">
                ${this.availableAuthors.map(role =>
                  this.#renderFocusChip('author', role, role)
                )}
              </div>

              <div class="form-block-header">Focus by recipient</div>
              <div class="chip-block">
                ${this.availableRecipients.length === 0
                  ? html`<div class="empty">No recipients in this session</div>`
                  : this.availableRecipients.map(recipient =>
                      this.#renderFocusChip('recipient', recipient, recipient)
                    )}
              </div>

              <div class="form-block-header">Focus by content type</div>
              <div class="chip-block">
                ${this.availableContentTypes.map(channel =>
                  this.#renderFocusChip('contentType', channel, channel)
                )}
              </div>
            </div>
          </div>

          <div class="setting-block">
            <button
              class="section-toggle"
              type="button"
              name="toggleAdvancedSection"
              @click=${this.#toggleAdvancedSection}
            >
              <span
                class="disclosure"
                ?is-collapsed=${this.isAdvancedCollapsed}
                aria-hidden="true"
              >
                ▸
              </span>
              <span>Advanced</span>
            </button>
            <div
              class="setting-block-content"
              ?is-hidden=${this.isAdvancedCollapsed}
            >
              <div class="empty">No advanced settings yet.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  #renderRadioRow(
    name: string,
    value: string,
    label: string,
    checked: boolean,
    onChange: (event: Event) => void
  ) {
    return html`
      <label class="radio-row">
        <input
          type="radio"
          name=${name}
          value=${value}
          .checked=${checked}
          @change=${onChange}
        />
        <span>${label}</span>
      </label>
    `;
  }

  #renderFocusChip(
    field: PrismFocusFieldName,
    value: PrismRole | PrismChannel | string,
    label: string
  ) {
    const buttonName = field === 'author'
      ? 'focusAuthor'
      : field === 'recipient'
        ? 'focusRecipient'
        : 'focusContentType';
    const state = getBucketState(
      this.settings[field] as PrismFocusBucket<string>,
      value
    );
    const stateSymbol = state === 'include' ? '✓' : state === 'exclude' ? '−' : '○';

    return html`
      <button
        class="focus-chip"
        type="button"
        name=${buttonName}
        value=${value}
        data-state=${state}
        @click=${(event: MouseEvent) =>
          this.#handleFocusChipClick(field, String(value), event)}
      >
        <span class="chip-symbol" aria-hidden="true">${stateSymbol}</span>
        <span>${label}</span>
      </button>
    `;
  }

  #toggleAbsoluteTimestamp = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.#emitViewSettings({
      showAbsoluteTimestamp: input.checked
    });
  };

  #handleMaxMessageHeightModeChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.#emitViewSettings({
      maxMessageHeightMode: input.value as PrismMessageHeightMode
    });
  };

  #handleCustomMessageHeightInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const parsedValue = Number.parseInt(input.value, 10);
    const nextValue = Number.isNaN(parsedValue)
      ? this.viewSettings.customMaxMessageHeight
      : clampCustomMessageHeight(parsedValue);

    input.value = String(nextValue);
    this.#emitViewSettings({
      customMaxMessageHeight: nextValue
    });
  };

  #handleLayoutModeChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.#emitViewSettings({
      layoutMode: input.value as PrismLayoutMode
    });
  };

  #handleGridColumnWidthInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const parsedValue = Number.parseInt(input.value, 10);
    const nextValue = Number.isNaN(parsedValue)
      ? this.viewSettings.gridColumnWidth
      : clampGridColumnWidth(parsedValue);

    input.value = String(nextValue);
    this.#emitViewSettings({
      gridColumnWidth: nextValue
    });
  };

  #toggleStrictFocus = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.#emitFocusSettings({
      strictFocus: input.checked
    });
  };

  #handleFocusChipClick = (
    field: PrismFocusFieldName,
    rawValue: string,
    event: MouseEvent
  ) => {
    const currentState = getBucketState(
      this.settings[field] as PrismFocusBucket<string>,
      rawValue
    );
    const nextState = this.#getNextFocusChipState(currentState, event.shiftKey);
    const nextBucket = this.#setBucketState(
      this.settings[field] as PrismFocusBucket<string>,
      rawValue,
      nextState
    );

    this.#emitFocusSettings({
      [field]: nextBucket
    } as Partial<PrismFocusModeSettings>);
  };

  #getNextFocusChipState(
    currentState: PrismFocusChipState,
    shiftKey: boolean
  ): PrismFocusChipState {
    if (shiftKey) {
      return currentState === 'exclude' ? 'neutral' : 'exclude';
    }

    return currentState === 'include' ? 'neutral' : 'include';
  }

  #setBucketState<T extends string>(
    bucket: PrismFocusBucket<T>,
    value: T,
    nextState: PrismFocusChipState
  ): PrismFocusBucket<T> {
    const include = bucket.include.filter(item => item !== value);
    const exclude = bucket.exclude.filter(item => item !== value);

    if (nextState === 'include') {
      include.push(value);
    } else if (nextState === 'exclude') {
      exclude.push(value);
    }

    return {
      include,
      exclude
    };
  }

  #getFocusSummary(): string {
    const parts: string[] = [];

    const fieldSummaries: Array<[string, PrismFocusBucket<string>]> = [
      ['author', this.settings.author as PrismFocusBucket<string>],
      ['recipient', this.settings.recipient as PrismFocusBucket<string>],
      ['type', this.settings.contentType as PrismFocusBucket<string>]
    ];

    for (const [label, bucket] of fieldSummaries) {
      const includePart =
        bucket.include.length > 0 ? `+${bucket.include.join(', +')}` : '';
      const excludePart =
        bucket.exclude.length > 0 ? `-${bucket.exclude.join(', -')}` : '';
      const valuePart = [includePart, excludePart].filter(Boolean).join(', ');

      if (valuePart) {
        parts.push(`${label}: ${valuePart}`);
      }
    }

    if (this.settings.strictFocus) {
      parts.push('strict');
    }

    return parts.length > 0 ? parts.join(' | ') : 'No focus filters';
  }

  #toggleFocusModeSection = () => {
    this.isFocusModeCollapsed = !this.isFocusModeCollapsed;
  };

  #toggleAdvancedSection = () => {
    this.isAdvancedCollapsed = !this.isAdvancedCollapsed;
  };

  #handleClose = (event: Event) => {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('prism-request-close', {
        bubbles: true,
        composed: true
      })
    );
  };

  #handleDragStart = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, label')) {
      return;
    }

    event.preventDefault();
    this.dragStartX = event.clientX - this.dragOffsetX;
    this.dragStartY = event.clientY - this.dragOffsetY;
    document.addEventListener('mousemove', this.#handleDragMove);
    document.addEventListener('mouseup', this.#handleDragEnd);
  };

  #handleDragMove = (event: MouseEvent) => {
    this.dragOffsetX = event.clientX - this.dragStartX;
    this.dragOffsetY = event.clientY - this.dragStartY;
  };

  #handleDragEnd = () => {
    document.removeEventListener('mousemove', this.#handleDragMove);
    document.removeEventListener('mouseup', this.#handleDragEnd);
  };

  #emitFocusSettings(partial: Partial<PrismFocusModeSettings>): void {
    const nextSettings: PrismFocusModeSettings = {
      ...this.settings,
      ...partial
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

  #emitViewSettings(partial: Partial<PrismViewSettings>): void {
    const nextSettings: PrismViewSettings = {
      ...this.viewSettings,
      ...partial
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

  disconnectedCallback(): void {
    this.#handleDragEnd();
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 10;
    }

    .preference-window {
      --panel-width: 500px;
      width: min(var(--panel-width), calc(100vw - 16px));
      max-height: calc(100vh - 90px);
      overflow-y: auto;
      border-radius: 16px;
      background: white;
      border: 1px solid var(--gray-200, #ebebeb);
      box-shadow:
        0 0 2px hsla(0, 0%, 0%, 0.15),
        0 0 4px hsla(0, 0%, 0%, 0.07),
        0 0 12px hsla(0, 0%, 0%, 0.07);
    }

    .header {
      min-height: 56px;
      padding: 0 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 1.2rem;
      font-weight: 700;
      background: var(--gray-100, #f5f5f5);
      border-bottom: 1px solid var(--gray-200, #ebebeb);
      cursor: move;
      user-select: none;
    }

    .close-button {
      all: unset;
      width: 34px;
      height: 34px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      color: var(--gray-500, #7c7c7c);
      cursor: pointer;
      font-size: 28px;
      line-height: 1;
    }

    .close-button:hover {
      background: var(--gray-200, #ebebeb);
      color: var(--gray-900, #242424);
    }

    .content {
      padding: 0;
    }

    .setting-block {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px;
      border-bottom: 1px solid var(--gray-200, #ebebeb);
    }

    .setting-block:last-child {
      border-bottom: none;
    }

    .setting-block-header {
      font-size: 1rem;
      font-weight: 700;
      color: var(--gray-900, #242424);
    }

    .setting-block-content {
      display: grid;
      gap: 12px;
    }

    .setting-block-content[is-hidden] {
      display: none;
    }

    .radio-row,
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--gray-700, #5c5c5c);
      font-size: 15px;
    }

    .radio-row input,
    .checkbox-row input {
      margin: 0;
      accent-color: var(--blue-700, #1e76d8);
    }

    .range-input {
      width: 100%;
      accent-color: var(--blue-700, #1e76d8);
    }

    .section-toggle {
      all: unset;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--gray-800, #404040);
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
    }

    .disclosure {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      color: var(--gray-600, #656565);
      transform: rotate(90deg);
      transition: transform 120ms ease;
    }

    .disclosure[is-collapsed] {
      transform: rotate(0deg);
    }

    .focus-hint,
    .focus-summary,
    .empty {
      color: var(--gray-500, #7c7c7c);
      font-size: 13px;
      line-height: 1.4;
    }

    .focus-summary {
      color: var(--gray-700, #5c5c5c);
    }

    .form-block-header {
      font-size: 14px;
      font-weight: 600;
      color: var(--gray-700, #5c5c5c);
    }

    .chip-block {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .focus-chip {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--gray-300, #dadada);
      background: white;
      color: var(--gray-700, #5c5c5c);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
    }

    .focus-chip[data-state='include'] {
      border-color: color-mix(in srgb, var(--blue-700, #1e76d8) 35%, white);
      background: color-mix(in srgb, var(--blue-700, #1e76d8) 10%, white);
      color: var(--blue-700, #1e76d8);
    }

    .focus-chip[data-state='exclude'] {
      border-color: color-mix(in srgb, #d14343 35%, white);
      background: color-mix(in srgb, #d14343 9%, white);
      color: #c53a3a;
    }

    .chip-symbol {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.1em;
      font-weight: 700;
    }

    @media (max-width: 720px) {
      .preference-window {
        width: min(500px, calc(100vw - 16px));
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'prism-preference-panel': PrismPreferencePanel;
  }
}
