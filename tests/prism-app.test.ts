import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import '../src/prism-app';
import type { PrismApp } from '../src/prism-app';

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), 'tests/fixtures', name), 'utf8');

const markdownSession = [
  JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: 'Please format this'
    },
    uuid: 'user-1',
    timestamp: '2026-04-22T12:00:00.000Z',
    sessionId: 'markdown-session'
  }),
  JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello **world**\n\n- first item\n- second item'
        },
        {
          type: 'tool_use',
          id: 'toolu_markdown',
          name: 'Bash',
          input: {
            command: 'printf "**raw**"'
          }
        }
      ]
    },
    uuid: 'assistant-1',
    timestamp: '2026-04-22T12:00:01.000Z',
    sessionId: 'markdown-session'
  }),
  JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_markdown',
          content: '**tool output**',
          is_error: false
        }
      ]
    },
    uuid: 'tool-result-1',
    timestamp: '2026-04-22T12:00:02.000Z',
    sessionId: 'markdown-session'
  })
].join('\n');

const mountApp = async () => {
  const app = document.createElement('prism-app') as PrismApp;
  document.body.innerHTML = '';
  document.body.append(app);
  await app.updateComplete;
  return app;
};

const getTimelines = (app: PrismApp) =>
  [...(app.shadowRoot?.querySelectorAll('prism-timeline') ?? [])] as HTMLElement[];

const getTimeline = (app: PrismApp, index = 0) => getTimelines(app)[index] as HTMLElement;

const getConversationContainers = (app: PrismApp) =>
  app.shadowRoot?.querySelectorAll('.conversation-container') ?? [];

const openActionsMenu = async (app: PrismApp) => {
  const button = app.shadowRoot?.querySelector(
    'button.action-toggle'
  ) as HTMLButtonElement;
  button.click();
  await app.updateComplete;
  return app.shadowRoot?.querySelector('.actions-menu') as HTMLElement;
};

const openPreferences = async (app: PrismApp) => {
  const menu = await openActionsMenu(app);
  const button = menu.querySelector(
    'button[name="togglePreferencesMenu"]'
  ) as HTMLButtonElement;
  button.click();
  await app.updateComplete;
  return app.shadowRoot?.querySelector('prism-preference-panel') as HTMLElement;
};

const expandFocusMode = async (panel: HTMLElement) => {
  const toggle = panel.shadowRoot?.querySelector(
    'button[name="toggleFocusModeSection"]'
  ) as HTMLButtonElement;
  toggle.click();
  await (panel as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  return panel;
};

const getFocusChip = (
  panel: HTMLElement,
  name: 'focusAuthor' | 'focusRecipient' | 'focusContentType',
  value: string
) =>
  panel.shadowRoot?.querySelector(
    `button[name="${name}"][value="${value}"]`
  ) as HTMLButtonElement;

const clickFocusChip = async (
  panel: HTMLElement,
  chip: HTMLButtonElement,
  options?: { shiftKey?: boolean }
) => {
  chip.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      shiftKey: options?.shiftKey ?? false
    })
  );
  await (panel as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
};

const openShareMenu = async (app: PrismApp, index = 0) => {
  const timeline = getTimeline(app, index);
  const button = timeline.shadowRoot?.querySelector(
    'button[name="toggleShareMenu"]'
  ) as HTMLButtonElement;
  button.click();
  await app.updateComplete;
  return getTimeline(app, index);
};

describe('prism-app', () => {
  test('loads a Claude session JSONL and renders summary, timeline, and metadata', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const rootText = app.shadowRoot?.textContent ?? '';
    const metadataPanel = app.shadowRoot?.querySelector(
      'prism-metadata-panel'
    ) as HTMLElement | null;
    const loader = app.shadowRoot?.querySelector('.loader') as HTMLElement | null;

    expect(rootText).toContain('Claude Session Viewer');
    expect(rootText).toContain('main-session.jsonl');
    expect(rootText).toContain('Conversations');
    expect(rootText).not.toContain('Pending Files None');
    expect(
      loader?.querySelector('button[name="loadStagedFiles"]')
    ).toBeNull();
    expect(metadataPanel?.shadowRoot?.textContent ?? '').toContain('No metadata selected.');
  });

  test('keeps parent and subagent session files separate when sessionId matches', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      },
      {
        name: 'subagent-session.jsonl',
        text: fixture('subagent-session.jsonl')
      }
    ]);
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const containers = [...getConversationContainers(app)];

    expect(getTimelines(app)).toHaveLength(2);
    expect(containers).toHaveLength(2);
    expect(containers[0]?.textContent ?? '').toContain('main-session.jsonl');
    expect(containers[1]?.textContent ?? '').toContain('subagent-session.jsonl');
    expect(app.shadowRoot?.textContent ?? '').toContain('2 total conversations');
  });

  test('renders markdown from the conversation toolbar and keeps tool output raw', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'markdown-session.jsonl',
        text: markdownSession
      }
    ]);
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
    const initialCards = timeline.shadowRoot?.querySelectorAll('prism-message-card') ?? [];
    const assistantCard = initialCards[1] as HTMLElement;
    const assistantText = assistantCard.shadowRoot?.querySelector(
      'prism-message-text'
    ) as HTMLElement | null;

    expect(assistantText?.shadowRoot?.innerHTML ?? '').not.toContain('<strong>world</strong>');
    expect(assistantText?.shadowRoot?.textContent ?? '').toContain('Hello **world**');

    const toggleMarkdown = timeline.shadowRoot?.querySelector(
      'button[name="toggleMarkdown"]'
    ) as HTMLButtonElement;
    toggleMarkdown.click();
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const updatedCards = timeline.shadowRoot?.querySelectorAll('prism-message-card') ?? [];
    const updatedAssistantCard = updatedCards[1] as HTMLElement;
    const updatedAssistantText = updatedAssistantCard.shadowRoot?.querySelector(
      'prism-message-text'
    ) as HTMLElement | null;
    const toolResultCard = [...updatedCards].find(
      card => card.getAttribute('data-channel') === 'tool_result'
    ) as HTMLElement | undefined;

    expect(updatedAssistantText?.shadowRoot?.innerHTML ?? '').toContain(
      '<strong>world</strong>'
    );
    expect(updatedAssistantText?.shadowRoot?.querySelectorAll('li').length).toBe(2);
    expect(toolResultCard?.shadowRoot?.querySelector('pre')?.textContent ?? '').toContain(
      '**tool output**'
    );
  });

  test('shows conversation actions and keeps translate as a placeholder action', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const timeline = getTimeline(app);
    const actionNames = [
      'toggleMarkdown',
      'toggleMetadata',
      'toggleShareMenu',
      'translateConversation'
    ];

    for (const actionName of actionNames) {
      expect(
        timeline.shadowRoot?.querySelector(`button[name="${actionName}"]`)
      ).not.toBeNull();
    }

    const actionsMenu = await openActionsMenu(app);
    expect(actionsMenu.textContent ?? '').toContain('Load local files');
    expect(actionsMenu.textContent ?? '').toContain('Preferences');

    await openShareMenu(app);
    const shareActionNames = [
      'copyShareableUrl',
      'copyConversationJson',
      'downloadConversation',
      'openRenderView'
    ];

    for (const actionName of shareActionNames) {
      expect(
        timeline.shadowRoot?.querySelector(`button[name="${actionName}"]`)
      ).not.toBeNull();
    }

    const translateButton = timeline.shadowRoot?.querySelector(
      'button[name="translateConversation"]'
    ) as HTMLButtonElement;
    translateButton.click();
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(timeline.shadowRoot?.textContent ?? '').toContain(
      'Translation API not configured'
    );
  });

  test('keeps file loading behind a persistent load button after staging files', async () => {
    const app = await mountApp();

    const actionsMenu = await openActionsMenu(app);
    const fileInput = actionsMenu.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const stagedFile = new File([fixture('main-session.jsonl')], 'main-session.jsonl', {
      type: 'application/json'
    });

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [stagedFile]
    });

    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const rootTextBeforeLoad = app.shadowRoot?.textContent ?? '';
    const loader = app.shadowRoot?.querySelector('.loader') as HTMLElement | null;
    expect(rootTextBeforeLoad).toContain('Pending Files');
    expect(rootTextBeforeLoad).toContain('main-session.jsonl');
    expect(rootTextBeforeLoad).toContain('No file loaded');

    const loadButton = app.shadowRoot?.querySelector(
      'button[name="loadStagedFiles"]'
    ) as HTMLButtonElement;
    expect(loadButton.disabled).toBe(false);
    expect(loader?.querySelector('button[name="loadStagedFiles"]')).toBeNull();

    loadButton.click();
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const rootTextAfterLoad = app.shadowRoot?.textContent ?? '';
    expect(rootTextAfterLoad).toContain('Claude session JSONL');
    expect(rootTextAfterLoad).toContain('Loaded Files');
    expect(rootTextAfterLoad).toContain('main-session.jsonl');
  });

  test('opens preferences as a separate popover from the actions menu', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    expect(app.shadowRoot?.querySelector('button.pref-toggle')).toBeNull();

    const actionsMenu = await openActionsMenu(app);
    expect(actionsMenu.querySelector('prism-preference-panel')).toBeNull();

    const preferencesButton = actionsMenu.querySelector(
      'button[name="togglePreferencesMenu"]'
    ) as HTMLButtonElement;
    preferencesButton.click();
    await app.updateComplete;

    const panel = app.shadowRoot?.querySelector(
      'prism-preference-panel'
    ) as HTMLElement | null;
    expect(panel).not.toBeNull();
    expect(app.shadowRoot?.querySelector('.actions-menu')).toBeNull();
    expect(panel?.shadowRoot?.textContent ?? '').toContain('Message Labels');
    expect(panel?.shadowRoot?.textContent ?? '').toContain('Preferences');
  });

  test('dismisses the preference popover on outside click', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    expect(await openPreferences(app)).not.toBeNull();

    document.body.click();
    await app.updateComplete;

    expect(app.shadowRoot?.querySelector('prism-preference-panel')).toBeNull();
  });

  test('closes the preference popover from its close button', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const closeButton = panel.shadowRoot?.querySelector(
      'button[name="closePreferences"]'
    ) as HTMLButtonElement;

    closeButton.click();
    await app.updateComplete;

    expect(app.shadowRoot?.querySelector('prism-preference-panel')).toBeNull();
  });

  test('allows dragging the preference popover by its header', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const header = panel.shadowRoot?.querySelector('.header') as HTMLElement;
    const windowElement = panel.shadowRoot?.querySelector(
      '.preference-window'
    ) as HTMLElement;

    header.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 20,
        clientY: 30
      })
    );
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 65,
        clientY: 90
      })
    );
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await panel.updateComplete;

    expect(windowElement.style.transform).toContain('translate(45px, 60px)');
  });

  test('applies max message height modes from preferences to message cards', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'markdown-session.jsonl',
        text: markdownSession
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const noLimit = panel.shadowRoot?.querySelector(
      'input[name="maxMessageHeightMode"][value="no-limit"]'
    ) as HTMLInputElement;
    noLimit.click();
    await app.updateComplete;

    const timeline = getTimeline(app);
    const card = timeline.shadowRoot?.querySelector(
      'prism-message-card'
    ) as HTMLElement & { maxMessageHeight?: string };

    expect(card.maxMessageHeight).toBe('none');

    const customMode = panel.shadowRoot?.querySelector(
      'input[name="maxMessageHeightMode"][value="custom"]'
    ) as HTMLInputElement;
    customMode.click();
    await app.updateComplete;

    const maxMessageHeight = panel.shadowRoot?.querySelector(
      'input[name="customMessageHeight"]'
    ) as HTMLInputElement;
    maxMessageHeight.value = '300';
    maxMessageHeight.dispatchEvent(new Event('input', { bubbles: true }));
    await app.updateComplete;

    expect(card.maxMessageHeight).toBe('300px');
    expect(panel.shadowRoot?.textContent ?? '').toContain('Custom Height (300px)');
  });

  test('switches conversation layout between list and grid and syncs grid width to the URL', async () => {
    window.history.replaceState({}, '', '/');

    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      },
      {
        name: 'secondary-session.jsonl',
        text: fixture('secondary-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const gridMode = panel.shadowRoot?.querySelector(
      'input[name="layoutMode"][value="grid"]'
    ) as HTMLInputElement;
    gridMode.click();
    await app.updateComplete;

    const gridWidth = panel.shadowRoot?.querySelector(
      'input[name="gridColumnWidth"]'
    ) as HTMLInputElement;
    gridWidth.value = '373';
    gridWidth.dispatchEvent(new Event('input', { bubbles: true }));
    await app.updateComplete;

    const conversationList = app.shadowRoot?.querySelector(
      '.conversation-list'
    ) as HTMLElement | null;
    const timelines = getTimelines(app);
    const containers = getConversationContainers(app);

    expect(timelines.length).toBe(2);
    expect(containers.length).toBe(2);
    expect(conversationList?.getAttribute('data-layout')).toBe('grid');
    expect(new URL(window.location.href).searchParams.get('grid')).toBe('373');

    const listMode = panel.shadowRoot?.querySelector(
      'input[name="layoutMode"][value="list"]'
    ) as HTMLInputElement;
    listMode.click();
    await app.updateComplete;

    expect(conversationList?.getAttribute('data-layout')).toBe('list');
    expect(new URL(window.location.href).searchParams.get('grid')).toBeNull();
  });

  test('renders one full timeline per loaded jsonl file', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      },
      {
        name: 'secondary-session.jsonl',
        text: fixture('secondary-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const containers = [...getConversationContainers(app)] as HTMLElement[];
    const timelines = getTimelines(app);

    expect(timelines).toHaveLength(2);
    expect(containers).toHaveLength(2);
    expect(containers[0]?.textContent ?? '').toContain('main-session.jsonl');
    expect(containers[1]?.textContent ?? '').toContain('secondary-session.jsonl');
  });

  test('keeps previously loaded conversations when loading another jsonl later', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    await app.ingestFiles([
      {
        name: 'secondary-session.jsonl',
        text: fixture('secondary-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const containers = [...getConversationContainers(app)] as HTMLElement[];
    const timelines = getTimelines(app);

    expect(timelines).toHaveLength(2);
    expect(containers).toHaveLength(2);
    expect(
      containers.some(container =>
        (container.textContent ?? '').includes('main-session.jsonl')
      )
    ).toBe(true);
    expect(
      containers.some(container =>
        (container.textContent ?? '').includes('secondary-session.jsonl')
      )
    ).toBe(true);
  });

  test('focus chips support include and exclude states with click and shift-click', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await expandFocusMode(await openPreferences(app));
    const assistant = getFocusChip(panel, 'focusAuthor', 'assistant');
    const thinking = getFocusChip(panel, 'focusContentType', 'thinking');

    await clickFocusChip(panel, assistant);
    expect(assistant.getAttribute('data-state')).toBe('include');

    await clickFocusChip(panel, thinking, { shiftKey: true });
    expect(thinking.getAttribute('data-state')).toBe('exclude');

    await clickFocusChip(panel, thinking, { shiftKey: true });
    expect(thinking.getAttribute('data-state')).toBe('neutral');

    expect(panel.shadowRoot?.textContent ?? '').toContain('author: +assistant');
  });

  test('non-strict focus expands included messages and folds all non-included messages', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await expandFocusMode(await openPreferences(app));
    const assistant = getFocusChip(panel, 'focusAuthor', 'assistant');
    const thinking = getFocusChip(panel, 'focusContentType', 'thinking');
    await clickFocusChip(panel, assistant);
    await clickFocusChip(panel, thinking, { shiftKey: true });
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
    const visibleMessages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-role]'
    );
    const foldedMessages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-hidden'
    );
    const foldedThinking = [...(foldedMessages ?? [])].filter(
      node =>
        (node.shadowRoot?.textContent ?? '').includes('thinking') ||
        (node.shadowRoot?.textContent ?? '').includes('Show thinking message')
    );
    const visibleThinking = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-channel="thinking"]'
    );

    expect(
      [...(visibleMessages ?? [])].every(
        node => node.getAttribute('data-role') === 'assistant'
      )
    ).toBe(true);
    expect(foldedMessages && foldedMessages.length).toBeGreaterThan(0);
    expect(foldedThinking.length).toBeGreaterThan(0);
    expect(visibleThinking?.length ?? 0).toBe(0);
  });

  test('strict focus keeps only included messages after exclude rules are applied', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await expandFocusMode(await openPreferences(app));
    const assistant = getFocusChip(panel, 'focusAuthor', 'assistant');
    const thinking = getFocusChip(panel, 'focusContentType', 'thinking');
    await clickFocusChip(panel, assistant);
    await clickFocusChip(panel, thinking, { shiftKey: true });

    const strictFocus = panel.shadowRoot?.querySelector(
      'input[name="strictFocus"]'
    ) as HTMLInputElement;
    strictFocus.click();
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
    const visibleMessages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-role]'
    );
    const foldedMessages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-hidden'
    );
    const visibleThinking = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-channel="thinking"]'
    );

    expect(visibleMessages && visibleMessages.length).toBeGreaterThan(0);
    expect(
      [...(visibleMessages ?? [])].every(
        node => node.getAttribute('data-role') === 'assistant'
      )
    ).toBe(true);
    expect(foldedMessages?.length ?? 0).toBe(0);
    expect(visibleThinking?.length ?? 0).toBe(0);
  });

  test('supports selecting multiple include values for a focus field', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await expandFocusMode(await openPreferences(app));
    const assistant = getFocusChip(panel, 'focusAuthor', 'assistant');
    const tool = getFocusChip(panel, 'focusAuthor', 'tool');
    await clickFocusChip(panel, assistant);
    await clickFocusChip(panel, tool);
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
    const messages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-role]'
    );
    expect(messages && messages.length).toBeGreaterThan(0);
    expect(
      [...(messages ?? [])].every(
        node => ['assistant', 'tool'].includes(node.getAttribute('data-role') ?? '')
      )
    ).toBe(true);
  });

  test('filters by recipient from focus chips', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'subagent-session.jsonl',
        text: fixture('subagent-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await expandFocusMode(await openPreferences(app));
    const bash = getFocusChip(panel, 'focusRecipient', 'Bash');
    await clickFocusChip(panel, bash);
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
    const messages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-recipient]'
    );
    expect(messages && messages.length).toBeGreaterThan(0);
    expect(
      [...(messages ?? [])].every(
        node => node.getAttribute('data-recipient') === 'Bash'
      )
    ).toBe(true);
  });

  test('recipient focus chips hide internal UUID-like identifiers', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await expandFocusMode(await openPreferences(app));
    const recipientButtons = [
      ...(panel.shadowRoot?.querySelectorAll(
        'button[name="focusRecipient"]'
      ) ?? [])
    ] as HTMLButtonElement[];
    const values = recipientButtons.map(input => input.value);

    expect(values).toContain('Bash');
    expect(values).toContain('Grep');
    expect(
      values.some(value =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value
        )
      )
    ).toBe(false);
  });

  test('updates the metadata panel when a message is selected from another conversation', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      },
      {
        name: 'secondary-session.jsonl',
        text: fixture('secondary-session.jsonl')
      }
    ]);
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app, 1);
    const toggleMetadata = timeline.shadowRoot?.querySelector(
      'button[name="toggleMetadata"]'
    ) as HTMLButtonElement;
    toggleMetadata.click();
    await app.updateComplete;

    const firstMessage = timeline.shadowRoot?.querySelector(
      'prism-message-card'
    ) as HTMLElement;
    firstMessage.click();
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const metadataPanel = app.shadowRoot?.querySelector('prism-metadata-panel');
    expect(metadataPanel?.shadowRoot?.textContent ?? '').toContain(
      '73ce5455-964d-4bf0-9351-19d85151938c'
    );
    expect(metadataPanel?.shadowRoot?.textContent ?? '').toContain('"type"');
  });

  test('shows a structured meta summary prompt when only a meta file is loaded', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'subagent-session.meta.json',
        text: fixture('subagent-session.meta.json')
      }
    ]);
    await app.updateComplete;

    const rootText = app.shadowRoot?.textContent ?? '';

    expect(rootText).toContain('Meta Summary');
    expect(rootText).toContain('需要配套 JSONL 才能渲染时间线');
    expect(rootText).toContain('general-purpose');
  });
});
