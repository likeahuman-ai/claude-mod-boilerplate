# Agent orbit: build a Claude Code mod

A class kit by Like A Human. In 6 steps you build **agent-orbit**: a Claude Code mod
that shows, live, what Claude's agents do and which context they read, first in the
terminal (the Claude CLI) and then in the Claude desktop app. At the end, the mod
talks back: it sends a debrief prompt into the chat when the agents are done.

## What is in here

| Folder or file | What it is |
|---|---|
| `page/index.html` | The full-screen step page for the projector. ← → moves, R replays the run, F goes full screen. |
| `steps/step-1` … `step-7` | The mod after each step. Each one loads and runs on its own. Git tags `step-1` … `step-7` hold the same. |
| `mods/agent-orbit` | The finished mod (equal to step 7). |
| `bridge/serve.ts` | The bridge between the mod and the live page. |
| `mods/mini-board`, `mods/agent-watch` | Two warm-up mods: a board pane with `/note`, and a text view of the agents. |
| `practice-repo/` | A small folder to run the mods in: three board files and a CLAUDE.md. |
| `MASTER-PROMPT.md` | One prompt that makes Claude build the mod with you, step by step. |
| `DEMO.md` | The demo prompts. |

## Run it

Needs Claude Code 2.1.317 or newer. Put the terminal in full screen, so the pane docks beside the chat.

```bash
cd practice-repo
claude --plugin-dir ../mods/agent-orbit
```

Then type:

```
Use three Explore agents in parallel on the haiku model. One reads PROBLEMS.md,
one reads SUGGESTIONS.md, one reads PARKING.md. Each returns the top 3 themes,
one line each. Do not change any file.
```

## The live page

The page works like a live board, connected to your chats:

1. In a chat with the mod, type `/orbit web`. It starts the bridge (`bun bridge/serve.ts`, needs [Bun](https://bun.sh)) and opens http://127.0.0.1:4747.
2. The page shows one chip per chat that has the mod: a CLI chat and a desktop chat can both connect. It draws the selected chat live: the same model as the pane.
3. "Run the demo", "Ask for a debrief" or your own text send a prompt into the selected chat.

Keys: T switches between the desktop view and the terminal view, Tab goes to the next chat, S shows the steps.
Without the bridge, the page plays the 6 steps with a simulated run.

## Teach it

1. Open `page/index.html` and show the intro: the finished orbit.
2. Per step: show the step on the page (the code and what it draws), then run that
   step for real: `claude --plugin-dir ../steps/step-3/agent-orbit` from `practice-repo`.
3. Show what a step adds with `diff -ru steps/step-2/agent-orbit steps/step-3/agent-orbit`.
4. Let the class build it themselves with `MASTER-PROMPT.md`, or ask Claude for one
   change per step and read the diff together.

## Good to know

- A pane opens by itself only in a terminal of 144 columns or wider. The mod also
  opens it on the first prompt you type, which works at any width.
- A mod reloads when you change its files, and the reload empties what it tracked.
  Start a fresh session for a clean run.
