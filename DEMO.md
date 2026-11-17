# Demo prompts

From the root of this repo, start Claude Code with the orbit:

    claude --plugin-dir mods/agent-orbit

The demo prompt. The agents read the orbit's own code, so the class sees which agent reads which file:

    Use three Explore agents in parallel on the haiku model. One reads mods/agent-orbit/hooks/register.tsx,
    one reads mods/agent-orbit/hooks/frame.ts, one reads mods/agent-orbit/hooks/desktop.ts.
    Each explains in 3 lines what its file does. Do not change any file.

Then type `/orbit web` for the live page. On the page, "Run the demo" sends the same prompt.

The warm-up mod, agent-watch, shows the same data as plain text:

    claude --plugin-dir mods/agent-watch
