# Master prompt: build the agent orbit, step by step

Paste everything between the two lines into Claude Code, in an empty folder or in
`practice-repo`. Claude builds the mod in 6 steps and stops after each step, so the
class can see, read and ask. Type `next` to go on. Steps 1 to 5 make the CLI view;
step 6 adds the desktop view to the same mod.

Needs Claude Code 2.1.317 or newer (it has the `plugin-authoring` skill).

---

You are my tutor for Claude Code mods. Together we build **agent-orbit**: a mod that
shows, live, what Claude's agents do and which context they read: first in the
terminal (the Claude CLI), then in the Claude desktop app.
Load the `plugin-authoring` skill first and use its types file for every API name.

## How we work

- Build in the 6 steps below. After each step, stop and give me:
  1. what we built, in 2 lines,
  2. the one hook or API call that makes it work, with its line of code,
  3. how I see it work now.
  Then wait until I type `next`.
- Write the mod in the folder the skill names. When Claude Code asks "Turn on the
  mods Claude writes in this session?", tell me to click "Turn them on".
- After each step, run `claude plugin validate` on the mod and fix every error.
- Keep the code short and readable for a class: comments in plain words.
- Give `plugin.json` a `license` ("MIT") and an `author`, so validate passes first time.

## The steps

**Step 1. A pane.** Make the three files (`plugin.json`, `hooks/hooks.json`,
`hooks/register.tsx`). Register a `/orbit` command. Open a pane with `$.ui.open` from
a `prompt.submit` hook and from `/orbit`. Draw "Hello, orbit" in it.

**Step 2. Track the agents.** Keep a plain live model in the module: the main
session plus one entry per agent. Fill it from four hooks:
- `agent.spawn`: call `await next(e)` first; its result holds the new `agentId` and
  the `model`. The input holds `subagentType` and `description` (the task).
- `tool.call`: `e.agentId` is the same id for a call inside that agent, and absent
  for the main session. Read, Grep, Glob, WebFetch, WebSearch and Skill are
  *reads* (context the agent pulls in); every other tool is an *action*.
- `turn.complete`: when `e.agentId` is set, that agent is done.
- `prompt.context`: `e.instructionFiles` lists the CLAUDE.md files the session carries.
Show the model as text rows first, so the class sees the data before the drawing.

**Step 3. Make it move.** Replace the text with one `Raster` (a grid of coloured
terminal cells). Put the frame code in `hooks/frame.ts`: the main session as a
pulsing core, the agents on an orbit around it with a trail, a beam from the core to
each running agent. Repaint it with `$.clock.every(60, ...)` and `$.ui.blit`.

**Step 4. Make it explain.** Add to the frame:
- a legend row: ◉ main session, ● agent, ◆ reads a file, ◆ acts, ★ task out, ✔ done,
- a caption that types out the newest event in plain words
  ("Explore 2 reads PROBLEMS.md", "Main hands Explore 1 a task"),
- a ticker of the 2 events before it, with how long ago,
- the files each agent read as small `◇ file` labels beside it: its context,
- a list row per agent: spinner, name, live timer, last step.

**Step 5. Talk back.** In `turn.complete`, when every agent not yet reported has
ended, send one prompt into the chat with `$.prompt.submit`: the stats of each
agent, and the ask for a debrief of at most 4 lines. Remember which agents you
reported, so it fires once per wave. Show "The mod sends a debrief prompt to the
chat" in the caption.

**Step 6. The desktop view.** The desktop app has no Raster, but it draws `Svg`. In
`ui.render`, when `e.surface === 'desktop'`, return
`<Svg source={...} alt="..." isInteractive={true} />` (`isInteractive` turns on SMIL
animation and `<title>` hover tooltips). Put the drawing in `hooks/desktop.ts`:
- a dark rounded card with a radial gradient sky and twinkling stars,
- the main session as a glowing core with rings that pulse outward,
- each agent as a glowing node on a dashed orbit, a spinning ring while it runs, a
  check mark when done, its name, model and counts, and its files as `◇` chips,
- beams from the core to each running agent with a dash that flows outward,
- a CHAT node beside the orbit: a dot flies from CHAT to the core when I give a
  task, and back to CHAT when the mod sends its debrief,
- flying diamonds for reads (cyan, with the file name), actions (amber) and new
  tasks (lime),
- the legend at the top, the counts at the top right, and a caption card at the
  bottom: the newest event typed out, and the 2 before it with "Ns ago",
- a `<title>` on each agent with its task, context and last steps.
The SVG is drawn again on each change, so start every animation at its phase: a
negative `begin` (`now % duration`), so the motion runs on without a jump. Read the
state atom in the render so it redraws, and bump it every 2 s while agents run.

## Rules we learned the hard way

- A pane that opens by itself needs a terminal of 144 columns. Open it from
  `prompt.submit` or a command: then it opens at any width.
- Never name a command after a built-in (`/agents` is one). Use `/orbit`.
- A Raster cell takes one width-1 character. Turn emoji and wide characters into `?`.
- `$.ui.blit` must use the same columns and rows as the mounted Raster. Size the
  Raster from `e.props.bodyColumns` and `e.props.scroll.bodyRows`.
- Draw particles first and labels last, so no particle covers a name. Put a label on
  the other side of its agent when it has no room.
- A docked pane can be short (16 rows) and narrow (50 columns): fit the list to it.
- A reload of the mod empties the module's live model. Test with a fresh session.
- On the desktop, the SVG is a sandboxed frame: no scripts. All motion is SMIL or CSS.
- Escape `&`, `<`, `>` and `"` in every text you put in the SVG.

## The test at the end

Tell me to start a new CLI session with `claude --plugin-dir <the mod folder>` and to
type this prompt:

    Use three Explore agents in parallel on the haiku model. One reads PROBLEMS.md,
    one reads SUGGESTIONS.md, one reads PARKING.md. Each returns the top 3 themes,
    one line each. Do not change any file.

If the folder has no such files, make the three files with a few `- ` lines first.
Done means: the orbit moves, the caption explains each event, and the debrief
prompt shows up in the chat with Claude's answer. For step 6, run the same prompt in
the Claude desktop app, with the mod folder loaded there.

---

## For the trainer

- The finished mod is in `agent-orbit/`. If a step goes wrong in class, open that
  file next to the class's file and compare.
- Steps 1 and 2 take about 5 minutes each. Step 3 is the wow, step 5 is the point:
  a mod can watch Claude, and talk back to it. Step 6 shows that one mod draws on
  each surface in its own way: cells in the terminal, SVG in the desktop app.
- In TEST MODE (all steps at once, no stops), a fresh Sonnet built steps 1 to 5
  from this prompt, and the result passed validate first time after its fixes.
