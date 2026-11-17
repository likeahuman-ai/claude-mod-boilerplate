// The bridge: the mod posts its live model here, and every open page gets it at once.
// Run from the repo root: bun bridge/serve.ts  →  http://127.0.0.1:4747
const PORT = 4747
const page = new URL('../page/index.html', import.meta.url)
const encoder = new TextEncoder()
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()
let last = ''
// Prompts the page sends, per session. Each mod takes its own with its next post.
const queues = new Map<string, string[]>()
let latestSession = ''
// The latest model per session, sent to a page when it connects; a chat that is quiet for 60 s is dropped.
const latest = new Map<string, string>()
const seen = new Map<string, number>()
setInterval(() => {
  const old = Date.now() - 60_000
  seen.forEach((at, id) => {
    if (at < old) {
      seen.delete(id)
      latest.delete(id)
      queues.delete(id)
    }
  })
}, 10_000)

function send(controller: ReadableStreamDefaultController<Uint8Array>, data: string) {
  try {
    controller.enqueue(encoder.encode(data))
  } catch {
    clients.delete(controller)
  }
}

// A comment line every 10 s keeps the stream open.
setInterval(() => clients.forEach(c => send(c, ': ping\n\n')), 10_000)

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url)

    // The mod posts the model here, about 3 times a second while agents run.
    if (url.pathname === '/state' && req.method === 'POST') {
      last = await req.text()
      clients.forEach(c => send(c, `data: ${last}\n\n`))
      const id = (JSON.parse(last) as { session?: { id?: string } }).session?.id ?? ''
      latestSession = id
      latest.set(id, last)
      seen.set(id, Date.now())
      const prompts = queues.get(id) ?? []
      queues.delete(id)
      return Response.json({ prompts })
    }

    // The page sends a prompt here; the mod submits it into the chat (like the build board).
    if (url.pathname === '/prompt' && req.method === 'POST') {
      const { text, session } = (await req.json().catch(() => ({}))) as { text?: string; session?: string }
      if (!text?.trim()) return new Response('empty', { status: 400 })
      // No session named: the session that posted last gets it.
      const id = session || latestSession
      queues.set(id, [...(queues.get(id) ?? []), text.trim().slice(0, 4000)])
      return Response.json({ queued: queues.get(id)?.length ?? 0, session: id })
    }

    // The mod asks this to know whether the bridge is up.
    if (url.pathname === '/health') return new Response('ok')

    // The page listens here.
    if (url.pathname === '/events') {
      let mine: ReadableStreamDefaultController<Uint8Array>
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          mine = controller
          clients.add(controller)
          latest.forEach(model => send(controller, `data: ${model}\n\n`))
        },
        cancel() {
          clients.delete(mine)
        },
      })
      return new Response(stream, {
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
      })
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(Bun.file(page), { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    return new Response('not found', { status: 404 })
  },
})

console.log(`Agent orbit bridge on http://127.0.0.1:${PORT}  (open it in the browser, then start Claude Code with the mod)`)
