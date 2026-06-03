// Builds the "Neon Pulse · Seed demo PR" helper workflow.
// It creates a branch, commits an intentionally flawed component, and opens a PR
// — giving the Guardian something rich to review. Uses the same GitHub credential,
// so the token never leaves n8n. Safe to run once; re-runs continue past 422s.
const fs = require('fs');
const path = require('path');

const OWNER = 'Kujoh1';
const REPO = 'Designsystem-Neonpulse';
const BRANCH = 'guardian-demo-pr';
const FILE = 'ui_kits/demo/neon-card.html';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

// Deliberately flawed Neon Pulse card — every line breaks at least one rule.
const flawed = `<!-- Neon Pulse demo card — intentionally flawed, for the PR Guardian to review -->
<div class="np-card" style="
  background: #1a1a2b;                 /* hardcoded surface instead of var(--bg-3) */
  border: 2px solid #00e5ff;           /* 2px hardcoded neon border (should be 1px hairline token) */
  border-radius: 4px;                  /* off-scale + too sharp; min radius is 8px */
  padding: 13px;                       /* off the 4px spacing scale */
  box-shadow: 0 0 24px #00e5ff;        /* ambient glow on a STATIC card — glow is state-only */
  transition: all 600ms ease-in-out;   /* 'all' + far slower than the 200ms default */
  font-family: Arial, sans-serif;      /* not a Neon Pulse type family */
">
  <span class="label" style="color:#ff2d9b; text-transform: none;">live status</span>
  <h2 style="color:#ffffff; font-weight: 800;">WELCOME TO THE FUTURE!!!</h2>
  <p style="color:#aab0c8;">We're SO excited to have you here 🎉🚀 — click below now!</p>
  <button style="background:#7c4dff; color:#000000; border-radius: 0;">CLICK ME</button>
</div>
`;

const manualTrigger = {
  id: 'seed-manual', name: '▶ Seed demo PR', type: 'n8n-nodes-base.manualTrigger',
  typeVersion: 1, position: [-200, 200], parameters: {},
};

const getMainSha = {
  id: 'seed-main-sha', name: 'Get main SHA', type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4, position: [20, 200],
  parameters: {
    url: `${API}/git/ref/heads/main`,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'githubApi',
    options: {},
  },
};

const createBranch = {
  id: 'seed-branch', name: 'Create branch', type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4, position: [240, 200], onError: 'continueRegularOutput',
  parameters: {
    method: 'POST', url: `${API}/git/refs`,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'githubApi',
    sendBody: true, contentType: 'json', specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ ref: "refs/heads/${BRANCH}", sha: $json.object.sha }) }}`,
    options: {},
  },
};

const fileContent = {
  id: 'seed-content', name: 'Flawed component', type: 'n8n-nodes-base.code',
  typeVersion: 2, position: [460, 200],
  parameters: {
    jsCode: 'return [{ json: { fileContent: ' + JSON.stringify(flawed) + ' } }];',
  },
};

const commitFile = {
  id: 'seed-commit', name: 'Commit flawed file', type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4, position: [680, 200], onError: 'continueRegularOutput',
  parameters: {
    method: 'PUT', url: `${API}/contents/${FILE}`,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'githubApi',
    sendBody: true, contentType: 'json', specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ message: "demo: add intentionally-flawed neon card for Guardian review", content: $json.fileContent.base64Encode(), branch: "${BRANCH}" }) }}`,
    options: {},
  },
};

const openPR = {
  id: 'seed-pr', name: 'Open pull request', type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.4, position: [900, 200], onError: 'continueRegularOutput',
  parameters: {
    method: 'POST', url: `${API}/pulls`,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'githubApi',
    sendBody: true, contentType: 'json', specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ title: "Add neon hero card to demo kit", head: "${BRANCH}", base: "main", body: "Adds a new card component to the demo UI kit. Ready for review." }) }}`,
    options: {},
  },
};

const note = {
  id: 'seed-note', name: 'Sticky · Seed', type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1, position: [-220, 40],
  parameters: {
    width: 520, height: 130,
    content: '## Seed demo PR\nCreates branch `' + BRANCH + '`, commits a deliberately flawed card, and opens a PR. Run this once, then run **Neon Pulse · PR Guardian** to watch Claude review it. Re-runs continue past "already exists" errors.',
  },
};

const nodes = [manualTrigger, getMainSha, createBranch, fileContent, commitFile, openPR, note];

const connections = {
  '▶ Seed demo PR': { main: [[{ node: 'Get main SHA', type: 'main', index: 0 }]] },
  'Get main SHA': { main: [[{ node: 'Create branch', type: 'main', index: 0 }]] },
  'Create branch': { main: [[{ node: 'Flawed component', type: 'main', index: 0 }]] },
  'Flawed component': { main: [[{ node: 'Commit flawed file', type: 'main', index: 0 }]] },
  'Commit flawed file': { main: [[{ node: 'Open pull request', type: 'main', index: 0 }]] },
};

const workflow = {
  name: 'Neon Pulse · Seed demo PR',
  nodes, connections, settings: { executionOrder: 'v1' }, tags: [],
};

fs.writeFileSync(path.join(__dirname, 'seed-demo-pr.workflow.json'), JSON.stringify(workflow, null, 2));
console.log('Wrote seed-demo-pr.workflow.json with', nodes.length, 'nodes.');
