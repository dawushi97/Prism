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

const getTimeline = (app: PrismApp) =>
  app.shadowRoot?.querySelector('prism-timeline') as HTMLElement;

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

const openShareMenu = async (app: PrismApp) => {
  const timeline = getTimeline(app);
  const button = timeline.shadowRoot?.querySelector(
    'button[name="toggleShareMenu"]'
  ) as HTMLButtonElement;
  button.click();
  await app.updateComplete;
  return getTimeline(app);
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
    expect(rootText).toContain('Session ID');
    expect(rootText).not.toContain('Pending Files None');
    expect(
      loader?.querySelector('button[name="loadStagedFiles"]')
    ).toBeNull();
    expect(metadataPanel?.shadowRoot?.textContent ?? '').toContain('No metadata selected.');
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

  test('nests preferences under the combined actions button', async () => {
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
    expect(panel?.shadowRoot?.textContent ?? '').toContain('Message Labels');
    expect(panel?.shadowRoot?.textContent ?? '').not.toContain('Preferences');
  });

  test('focus mode hides messages behind placeholders instead of deleting them', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const assistant = panel.shadowRoot?.querySelector(
      'input[name="focusAuthor"][value="assistant"]'
    ) as HTMLInputElement;
    assistant.click();
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
    const hiddenMessages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-hidden'
    );
    const visibleMessages = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-role="assistant"]'
    );

    expect(hiddenMessages && hiddenMessages.length).toBeGreaterThan(0);
    expect(hiddenMessages?.[0]?.shadowRoot?.textContent ?? '').toContain(
      'Show'
    );
    expect(visibleMessages && visibleMessages.length).toBeGreaterThan(0);
  });

  test('filters to multiple content types through the preference panel', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'subagent-session.jsonl',
        text: fixture('subagent-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const toolCall = panel.shadowRoot?.querySelector(
      'input[name="focusContentType"][value="tool_call"]'
    ) as HTMLInputElement;
    const toolResult = panel.shadowRoot?.querySelector(
      'input[name="focusContentType"][value="tool_result"]'
    ) as HTMLInputElement;
    toolCall.click();
    toolResult.click();
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
    const messageKinds = timeline.shadowRoot?.querySelectorAll(
      'prism-message-card[data-channel]'
    );
    expect(messageKinds && messageKinds.length).toBeGreaterThan(0);
    expect(
      [...(messageKinds ?? [])].every(node =>
        ['tool_call', 'tool_result'].includes(
          node.getAttribute('data-channel') ?? ''
        )
      )
    ).toBe(true);
  });

  test('supports selecting multiple author roles at once', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const assistant = panel.shadowRoot?.querySelector(
      'input[name="focusAuthor"][value="assistant"]'
    ) as HTMLInputElement;
    const tool = panel.shadowRoot?.querySelector(
      'input[name="focusAuthor"][value="tool"]'
    ) as HTMLInputElement;
    assistant.click();
    tool.click();
    await app.updateComplete;
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
    expect(
      [...(messages ?? [])].some(
        node => node.getAttribute('data-role') === 'assistant'
      )
    ).toBe(true);
    expect(
      [...(messages ?? [])].some(node => node.getAttribute('data-role') === 'tool')
    ).toBe(true);
  });

  test('filters by recipient from the preference panel', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'subagent-session.jsonl',
        text: fixture('subagent-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const bash = panel.shadowRoot?.querySelector(
      'input[name="focusRecipient"][value="Bash"]'
    ) as HTMLInputElement;
    bash.click();
    await app.updateComplete;
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

  test('recipient options hide internal UUID-like identifiers', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;

    const panel = await openPreferences(app);
    const recipientInputs = [
      ...(panel.shadowRoot?.querySelectorAll(
        'input[name="focusRecipient"]'
      ) ?? [])
    ] as HTMLInputElement[];
    const values = recipientInputs.map(input => input.value);

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

  test('updates the metadata panel when a message is selected', async () => {
    const app = await mountApp();

    await app.ingestFiles([
      {
        name: 'main-session.jsonl',
        text: fixture('main-session.jsonl')
      }
    ]);
    await app.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 0));

    const timeline = getTimeline(app);
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
