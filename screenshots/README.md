# Screenshots

Drop the key screenshots here (suggested filenames so the embeds below just work):

| Filename | What it shows |
|---|---|
| `01-rulebook.png` | The embedded rulebook — `guardian-system-prompt.md` or the System Message inside the Guardian node (the design competence, encoded) |
| `02-workflow.png` | The PR Guardian workflow canvas in n8n (the architecture: trigger → fetch PR → Claude agent + tool → post comment) |
| `03-flawed-code.png` | The "before" — the intentionally flawed `neon-card.html` in the PR's *Files changed* tab |
| `04-review.png` | The "after" — Claude's rendered review comment on the live PR |

Once added, you can embed them in the main README like this:

```markdown
![The rulebook, encoded in the agent](screenshots/01-rulebook.png)
![The PR Guardian workflow in n8n](screenshots/02-workflow.png)
![Before — the intentionally flawed component](screenshots/03-flawed-code.png)
![After — Claude's automated review on the live PR](screenshots/04-review.png)
```
