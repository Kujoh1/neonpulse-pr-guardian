# Neon Pulse · PR Guardian

**Design-System-Governance als Always-on-Service.** Ein autonomer Agent, der jeden Pull Request gegen das [Neon Pulse Design System](https://github.com/Kujoh1/Designsystem-Neonpulse) prüft — Tokens, Prinzipien und Brand Voice — und sein Review als Kommentar zurück in den PR schreibt. Gebaut in **n8n** mit **Claude** als reviewendem Modell.

> Portfolio-Stück für die Bewerbung als **Head of Design**.

**Live demo:** the Guardian reviewing a real pull request → [Designsystem-Neonpulse PR #1](https://github.com/Kujoh1/Designsystem-Neonpulse/pull/1)
**Screenshots:** see [`screenshots/`](screenshots/)

---

## Das Problem

Ein Design-System ist nur so gut wie seine **Durchsetzung**. Tokens, Komponenten und Prinzipien stehen sauber dokumentiert im Repo — aber im Alltag schleicht sich *Drift* ein: ein hartkodierter Hex-Wert statt eines Tokens, ein Glow auf einer statischen Karte, ein Emoji in einer Fehlermeldung, ein Button im falschen Farbverlauf.

Wer fängt das ab? Heute: eine Person, die jeden PR manuell reviewt. Das skaliert nicht, ist inkonsistent und macht Design-Qualität von der Verfügbarkeit einzelner abhängig.

## Die Idee

Design-Qualität **über die eigene Person hinaus skalieren** — als automatischen, immer verfügbaren Service. Der *Guardian* reviewt jeden PR mit demselben Maßstab, sofort, rund um die Uhr, und gibt konstruktives, konkretes Feedback im Ton des Systems selbst.

Das ist eine **Design-Ops**-Geschichte: nicht „ein Tool baut mein Design-System", sondern „mein Design-System setzt sich im Team selbst durch."

## Warum n8n (und nicht einfach Claude Code)?

Eine bewusste Werkzeug-Entscheidung — und Teil der Story:

| | Claude Code | n8n |
|---|---|---|
| Dateien editieren, committen, das System *bauen* | ✅ ideal | ✗ Umweg |
| **Always-on & event-getrieben** (reagiert auf PRs, 24/7) | ✗ | ✅ |
| **Team-facing ohne Code** (niemand muss das Repo klonen) | ✗ | ✅ |
| **Services verknüpfen** (GitHub ↔ Claude ↔ Slack …) | begrenzt | ✅ |
| Prozess **sichtbar** als Diagramm | ✗ | ✅ |

Das *Erstellen* des Systems macht Claude Code (das Repo ist mit `CLAUDE.md`/`SKILL.md` genau dafür aufgesetzt). n8n verdient seinen Platz dort, wo es um **Governance & Betrieb** geht: ein dauerhaft laufender, event-getriebener Service, mit dem ein ganzes Team arbeitet.

## Architektur

```
                ┌─ (Production) GitHub-Webhook: jeder PR ────┐
                │   PR opened / synchronize                  │
 ▶ Manual ──────┤                                            ▼
   (lokaler     └─ Get newest open PR ─→ Parse PR ─→ Get changed files
    Test)                                                    │
                                                             ▼
                                                  Build review payload
                                              (nur .css/.html/.scss + Diffs)
                                                             │
                                                             ▼
                              ┌────────────── Design System Guardian (Agent) ──────────────┐
                              │  • Claude (Anthropic) als Modell                            │
                              │  • System-Prompt = das Neon-Pulse-Regelwerk                 │
                              │  • Tool `fetch_repo_file` → liest Live-Dateien für Kontext  │
                              └─────────────────────────────┬──────────────────────────────┘
                                                             ▼
                                                  Post review comment  →  GitHub PR
```

**Production vs. lokal:** Der echte Einsatz hängt am **GitHub-Webhook-Trigger** (im Workflow enthalten, hier deaktiviert) — er feuert bei jedem PR. Für den lokalen Test ohne den Rechner ins Internet zu exponieren, holt der **Manual-Trigger** denselben PR aktiv ab (n8n → GitHub, keine eingehende Verbindung). Identische Pipeline, sichere Demo.

## Das „Gehirn": der Guardian-Prompt

Die eigentliche Design-Kompetenz steckt in [`guardian-system-prompt.md`](guardian-system-prompt.md). Er enthält:

- **Das komplette Token-Set** (Surfaces, Text, Neon, Semantik, Spacing, Radii, Type-Scale, Motion) als „einzige erlaubte Rohwerte".
- **Die Prinzipien als Review-Intent** — z. B. die *90/10-Regel* (≈90 % neutrale Fläche, ≈10 % Neon), *Glow nur bei State* (hover/focus/active/live, nie ambient), *Mono als HUD-Sprache* (UPPERCASE, 1–3 Wörter), *flache Tiefe* (Surface-Steps + Hairlines statt Schatten).
- **Brand Voice** für sichtbaren Text (knapp, system-readout-artig, keine Emojis, keine beiläufigen Ausrufezeichen).
- **Severity-Stufen** (🔴 Block / 🟡 Warn / 🔵 Note) und ein **festes Output-Format**, damit jeder Review-Kommentar scannbar und konsistent ist.

Der Agent darf via `fetch_repo_file` jederzeit die **aktuelle** Datei aus dem Repo nachladen — so driftet das Review nie von der Source of Truth weg.

## Setup (lokal, ohne n8n-Account)

> Voraussetzungen: Node 18+/22, ein Anthropic-API-Key, ein GitHub-PAT (Scope `repo`).

```bash
npm install -g n8n
# rein lokal starten (kein Tunnel, keine Internet-Exposition):
N8N_SECURE_COOKIE=false n8n start
```

Workflows importieren (oder in der UI „Import from File"):

```bash
node build-workflow.js          # erzeugt pr-guardian.workflow.json
node build-seed-workflow.js     # erzeugt seed-demo-pr.workflow.json
n8n import:workflow --input=pr-guardian.workflow.json
n8n import:workflow --input=seed-demo-pr.workflow.json
```

Dann unter **http://localhost:5678**:
1. Owner-Account anlegen (lokal).
2. Credentials **GitHub API** (PAT) und **Anthropic API** (Key) anlegen.
3. Den Nodes die Credentials zuweisen; beim Claude-Node ein Modell wählen.

## Demo

1. **„Neon Pulse · Seed demo PR"** ausführen → legt Branch `guardian-demo-pr` an, committet eine **absichtlich fehlerhafte** Karte und öffnet einen PR.
2. **„Neon Pulse · PR Guardian"** ausführen → Claude reviewt den PR und postet seinen Kommentar.

Die Demo-Karte verstößt bewusst gegen ~10 Regeln (hartkodierte Farben, 4px-Radius, ambient Glow, falsche Schrift, Emoji, Ausrufezeichen, falscher Button-Verlauf …) — der Guardian soll sie präzise benennen und je den korrekten Token/das Prinzip als Fix nennen.

## Ergebnis (echter Lauf)

> Live ausgeführt am 01.06.2026 gegen [PR #1](https://github.com/Kujoh1/Designsystem-Neonpulse/pull/1).

Claude lieferte ein Review mit dem Verdikt **„CHANGES REQUESTED · 9 blocking · 3 warnings · 2 notes"** — als Tabelle, jeder Fund mit Ort, Problem und dem **exakten Token als Fix**. Auszug:

| Sev | Location | Issue | Fix |
|-----|----------|-------|-----|
| 🔴 | `background: #1a1a2b` | Hardcoded surface hex | `var(--bg-3)` / `var(--color-surface-raised)` |
| 🔴 | `box-shadow: 0 0 24px #00e5ff` | Ambient glow auf statischer Karte (Glow = State-Signal) | Nur auf `:hover` / `:focus-visible`, via `var(--glow-cyan)` |
| 🔴 | `🎉🚀` in Body-Copy | Emoji — in Neon Pulse nie erlaubt | Entfernen; on-brand: *„Telemetry active · All systems nominal."* |
| 🟡 | `transition: all 600ms` | `all` + über dem 360ms-Maximum | Gezielte Properties mit `var(--dur)` |

**Bemerkenswert:** Der Agent rief eigenständig sein `fetch_repo_file`-Tool auf, lud die *aktuelle* `colors_and_type.css` nach — inklusive der semantischen Alias-Schicht (`--color-surface-raised`, `--color-border-focus`), die kurz zuvor ins Repo gepusht wurde — und schlug Fixes gegen den **neuesten** Stand vor. Das Review driftet also nicht von der Source of Truth.

## Dateien

| Datei | Zweck |
|---|---|
| `guardian-system-prompt.md` | Das Regelwerk / der „Verstand" des Agenten |
| `build-workflow.js` | Generiert den Guardian-Workflow (valides JSON, gepinnte Node-Versionen) |
| `build-seed-workflow.js` | Generiert den Seed-Workflow für den Demo-PR |
| `pr-guardian.workflow.json` | Importierbarer n8n-Workflow (der Star) |
| `seed-demo-pr.workflow.json` | Importierbarer Hilfs-Workflow |

## Mögliche Ausbaustufen

- **Inline-Review-Kommentare** an der exakten Zeile statt eines Sammelkommentars.
- **PR-Status-Check** (grün/rot), der bei 🔴-Findings das Mergen blockiert.
- **Slack-Benachrichtigung** mit der Review-Zusammenfassung.
- **Figma-Webhook** als zweiter Trigger: Design-Drift schon vor dem Code abfangen.
- **„Ask the Design System"-Bot** als zweiter Service auf demselben Regelwerk.
