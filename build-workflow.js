// Builds the "Neon Pulse · PR Guardian" n8n workflow as valid JSON.
// Reads the Guardian system prompt from guardian-system-prompt.md so the
// long instruction text is escaped correctly. Node versions are pinned to
// what is installed in this n8n 2.8.4 instance.
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const systemMessage = fs.readFileSync(path.join(HERE, 'guardian-system-prompt.md'), 'utf8');

const OWNER = 'Kujoh1';
const REPO = 'Designsystem-Neonpulse';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

// ---- nodes -------------------------------------------------------------
const manualTrigger = {
  id: 'node-manual-trigger',
  name: '▶ Run review',
  type: 'n8n-nodes-base.manualTrigger',
  typeVersion: 1,
  position: [-220, 300],
  parameters: {},
};

// Production trigger — kept in the workflow (disabled) to show the real,
// event-driven architecture. Activated + a webhook tunnel would make this live.
const githubTrigger = {
  id: 'node-github-trigger',
  name: 'PR opened / updated (production)',
  type: 'n8n-nodes-base.githubTrigger',
  typeVersion: 1,
  position: [-220, 80],
  disabled: true,
  parameters: {
    authentication: 'accessToken',
    owner: OWNER,
    repository: REPO,
    events: ['pull_request'],
  },
  notesInFlow: true,
  notes: 'PRODUCTION: fires on every PR. Needs the workflow active + a public webhook URL (n8n tunnel / reverse proxy). For local testing we use the manual trigger instead.',
};

const listOpenPRs = {
  id: 'node-list-prs',
  name: 'Get newest open PR',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [0, 300],
  parameters: {
    url: `${API}/pulls`,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'githubApi',
    sendQuery: true,
    queryParameters: {
      parameters: [
        { name: 'state', value: 'open' },
        { name: 'sort', value: 'created' },
        { name: 'direction', value: 'desc' },
        { name: 'per_page', value: '1' },
      ],
    },
    options: {},
  },
};

const parsePR = {
  id: 'node-parse-pr',
  name: 'Parse PR',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [220, 300],
  parameters: {
    jsCode: [
      "// Take the newest open PR and normalise the fields we need downstream.",
      "const items = $input.all();",
      "if (items.length === 0) {",
      "  throw new Error('No open pull request found. Run the \"Seed demo PR\" workflow first, or open a PR on the repo.');",
      "}",
      "const pr = items[0].json;",
      "return [{ json: {",
      "  owner: pr.base?.repo?.owner?.login || '" + OWNER + "',",
      "  repo: pr.base?.repo?.name || '" + REPO + "',",
      "  number: pr.number,",
      "  title: pr.title,",
      "  body: pr.body || '(no description)',",
      "  author: pr.user?.login,",
      "  htmlUrl: pr.html_url,",
      "} }];",
    ].join('\n'),
  },
};

const getFiles = {
  id: 'node-get-files',
  name: 'Get changed files',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [440, 300],
  parameters: {
    url: `=${API}/pulls/{{ $json.number }}/files`,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'githubApi',
    sendQuery: true,
    queryParameters: { parameters: [{ name: 'per_page', value: '100' }] },
    options: {},
  },
};

const buildPayload = {
  id: 'node-build-payload',
  name: 'Build review payload',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [660, 300],
  parameters: {
    jsCode: [
      "// Keep only design-relevant files and assemble one diff blob for the agent.",
      "const files = $input.all().map(i => i.json);",
      "const exts = ['.css', '.html', '.htm', '.scss'];",
      "const relevant = files.filter(f => f.filename && exts.some(e => f.filename.toLowerCase().endsWith(e)));",
      "let diffText = '';",
      "for (const f of relevant) {",
      "  diffText += `\\n### FILE: ${f.filename}  (${f.status}, +${f.additions}/-${f.deletions})\\n`;",
      "  diffText += (f.patch || '(no textual diff available — binary, renamed, or too large)') + '\\n';",
      "}",
      "const pr = $('Parse PR').first().json;",
      "return [{ json: {",
      "  ...pr,",
      "  changedFiles: relevant.map(f => f.filename),",
      "  reviewedCount: relevant.length,",
      "  totalFiles: files.length,",
      "  diffText: diffText.trim() || 'No CSS/HTML/SCSS files were changed in this PR.',",
      "} }];",
    ].join('\n'),
  },
};

const claude = {
  id: 'node-claude',
  name: 'Claude (Anthropic)',
  type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  typeVersion: 1.3,
  position: [720, 540],
  parameters: {
    model: {
      __rl: true,
      mode: 'list',
      value: 'claude-sonnet-4-6',
      cachedResultName: 'Claude Sonnet 4.6',
    },
    options: { temperature: 0.2, maxTokensToSample: 3500 },
  },
};

const fetchTool = {
  id: 'node-fetch-tool',
  name: 'fetch_repo_file',
  type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  typeVersion: 1.1,
  position: [900, 540],
  parameters: {
    toolDescription:
      "Fetch the full CURRENT content of a file in the Neon Pulse repo by its repo-relative path (e.g. 'colors_and_type.css' or 'ui_kits/dashboard/index.html'). Use this when a diff lacks surrounding context or to confirm an exact token value before flagging it.",
    method: 'GET',
    url: `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/{path}`,
    placeholderDefinitions: {
      values: [
        { name: 'path', description: 'Repo-relative file path, e.g. colors_and_type.css', type: 'string' },
      ],
    },
    options: {},
  },
};

const guardian = {
  id: 'node-guardian',
  name: 'Design System Guardian',
  type: '@n8n/n8n-nodes-langchain.agent',
  typeVersion: 2.2,
  position: [900, 300],
  parameters: {
    promptType: 'define',
    text:
      '=A pull request was opened/updated on the Neon Pulse design system repository.\n\n' +
      'PR #{{ $json.number }} — {{ $json.title }}\n' +
      'Author: {{ $json.author }}\n' +
      'Description: {{ $json.body }}\n' +
      'Design files changed ({{ $json.reviewedCount }} of {{ $json.totalFiles }} total): {{ $json.changedFiles.join(", ") }}\n\n' +
      'Review the following diffs against the Neon Pulse rulebook and produce the PR review comment exactly in the required output format:\n\n' +
      '{{ $json.diffText }}',
    options: { systemMessage },
  },
};

const postComment = {
  id: 'node-post-comment',
  name: 'Post review comment',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4,
  position: [1140, 300],
  parameters: {
    method: 'POST',
    url: `=${API}/issues/{{ $('Build review payload').first().json.number }}/comments`,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'githubApi',
    sendBody: true,
    contentType: 'json',
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ body: $json.output }) }}',
    options: {},
  },
};

// ---- sticky notes (portfolio polish) ----------------------------------
const noteArchitecture = {
  id: 'note-architecture',
  name: 'Sticky · Architecture',
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [-260, -120],
  parameters: {
    width: 460,
    height: 170,
    content:
      '## 🛡 Neon Pulse · PR Guardian\n' +
      'Design-system governance as an always-on service. **Production** fires on every PR via the GitHub webhook (top, disabled here). **Locally** we pull the newest open PR with the manual trigger — same pipeline, no public exposure.',
  },
};

const noteBrain = {
  id: 'note-brain',
  name: 'Sticky · The brain',
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [700, 720],
  parameters: {
    width: 460,
    height: 150,
    content:
      '### The reviewer\nClaude reviews the diff against the embedded Neon Pulse rulebook (tokens + principles + brand voice). The `fetch_repo_file` tool lets it pull live file content for context — so the review never drifts from the source of truth.',
  },
};

const nodes = [
  manualTrigger, githubTrigger, listOpenPRs, parsePR, getFiles,
  buildPayload, claude, fetchTool, guardian, postComment,
  noteArchitecture, noteBrain,
];

// ---- connections -------------------------------------------------------
const connections = {
  '▶ Run review': { main: [[{ node: 'Get newest open PR', type: 'main', index: 0 }]] },
  'Get newest open PR': { main: [[{ node: 'Parse PR', type: 'main', index: 0 }]] },
  'Parse PR': { main: [[{ node: 'Get changed files', type: 'main', index: 0 }]] },
  'Get changed files': { main: [[{ node: 'Build review payload', type: 'main', index: 0 }]] },
  'Build review payload': { main: [[{ node: 'Design System Guardian', type: 'main', index: 0 }]] },
  'Design System Guardian': { main: [[{ node: 'Post review comment', type: 'main', index: 0 }]] },
  'Claude (Anthropic)': { ai_languageModel: [[{ node: 'Design System Guardian', type: 'ai_languageModel', index: 0 }]] },
  'fetch_repo_file': { ai_tool: [[{ node: 'Design System Guardian', type: 'ai_tool', index: 0 }]] },
  // NOTE: the production GitHub trigger is intentionally left unconnected + disabled.
  // It documents the event-driven entry point without breaking the local test path
  // (which depends on the "Parse PR" node that the webhook payload does not produce).
};

const workflow = {
  name: 'Neon Pulse · PR Guardian',
  nodes,
  connections,
  settings: { executionOrder: 'v1' },
  tags: [],
};

fs.writeFileSync(path.join(HERE, 'pr-guardian.workflow.json'), JSON.stringify(workflow, null, 2));
console.log('Wrote pr-guardian.workflow.json with', nodes.length, 'nodes.');
