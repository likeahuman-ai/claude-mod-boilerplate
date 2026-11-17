# Agent watch demo

Start Claude Code in the practice repo with both mods:

    cd practice-repo
    claude --plugin-dir ../mods/mini-board --plugin-dir ../mods/agent-watch

Type this prompt:

    Use two Explore agents in parallel, on the haiku model. One reads PROBLEMS.md
    and groups the problems by theme. The other reads SUGGESTIONS.md and PARKING.md
    and picks the best idea. Then park one new thought with a line in PARKING.md.

What the "Agent watch" pane shows:

- Context before the first word: the CLAUDE.md files the session carries, and the skills it loads.
- Per agent: its type, model and task, what it read (Read, Grep, Glob), and what it did.
- The main session too: the edit to PARKING.md, which also redraws the mini board.

# Agent orbit demo (the live one)

Start the CLI with the orbit mod:

    claude --plugin-dir ../mods/agent-orbit

Type this prompt. The orbit pane opens on the first prompt, at any terminal width:

    Use three Explore agents in parallel on the haiku model. One reads PROBLEMS.md,
    one reads SUGGESTIONS.md, one reads PARKING.md. Each returns the top 3 themes,
    one line each. Do not change any file.

What the class sees:

- The main session pulses in the centre. Each agent orbits it, with a beam while it runs.
- A star flies out when an agent starts. A file name flies in when an agent reads. A spark flies back when it acts.
- Under the orbit: a spinner, a live timer, reads and actions, and the last step of each agent.
- When the last agent ends, the mod sends a prompt into the chat ("Agent orbit saw 3 agents finish…"), and Claude answers it with a debrief.

The code to show: hooks/register.tsx (the hooks), hooks/frame.ts (one frame of cells), $.ui.blit (16 frames a second), $.prompt.submit (the mod talks back).
