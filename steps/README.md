# Agent orbit: six steps

Each step is a complete mod that loads on its own. Each step is the previous step plus one addition. Step 6 equals `mods/agent-orbit`.

Run a step from `practice-repo`:

```
claude --plugin-dir ../steps/step-3/agent-orbit
```

(Adjust the path to where `steps/` lives. The engine writes `.claude-plugin/types` on first load; it is not part of the snapshots.)

Show what a step adds:

```
diff -ru steps/step-N/agent-orbit steps/step-M/agent-orbit
```

| Step | What it adds | Files it changes | Diff |
|---|---|---|---|
| 1. A pane | `/orbit` command, a pane that opens on a prompt, and `Hello, orbit` | new: `plugin.json`, `hooks.json`, `register.tsx`, `tsconfig.json` | (first step) |
| 2. Track the agents | The `live.ts` model, the `version` atom, the hooks `agent.spawn`, `tool.call`, `turn.complete`, `prompt.context`, `skill.prompt`, and a text row per loop on every surface | new: `live.ts`, `types/index.d.ts`; changes: `register.tsx`, `plugin.json` (adds `types`) | `diff -ru steps/step-1/agent-orbit steps/step-2/agent-orbit` |
| 3. Make it move | `frame.ts` (core, orbit, stars, agents with trails, beams, particles, agent list), `$.clock.every(60)` with `$.ui.blit`, the terminal `Raster` branch; text rows stay as the fallback | new: `frame.ts`; changes: `register.tsx`, `live.ts` (particles, colours, `hash`) | `diff -ru steps/step-2/agent-orbit steps/step-3/agent-orbit` |
| 4. Make it explain | Legend, caption, ticker, `◇` file chips, agent names (Explore 1, 2...), `say`, `verbOf`, plain-word events in the hooks | changes: `register.tsx`, `live.ts` (events, `say`, `verbOf`, `context`), `frame.ts` | `diff -ru steps/step-3/agent-orbit steps/step-4/agent-orbit` |
| 5. Talk back | The debrief: `$.prompt.submit` in `turn.complete`, once per wave (the `reported` set), plus its event | changes: `register.tsx` | `diff -ru steps/step-4/agent-orbit steps/step-5/agent-orbit` |
| 6. The desktop view | `desktop.ts`, the `Svg` branch, and the 2-second redraw | new: `desktop.ts`; changes: `register.tsx` | `diff -ru steps/step-5/agent-orbit steps/step-6/agent-orbit` |

Check that the last step is the finished mod:

```
diff -ru steps/step-6/agent-orbit mods/agent-orbit
```
