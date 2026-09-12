/**
 * Host restart plugin, node half: one authenticated POST route on the shared
 * `/api` channel that restarts the deployment's systemd unit. The route rides
 * Connection's own browser-session authentication (Host/Origin fence plus the
 * persistent cookie), so its trust posture is the web UI's; POST-only and the
 * cookie's SameSite=Strict attribute close the cross-site path. The restart
 * itself is the same `systemctl restart <unit>` an operator would run over
 * SSH: systemd owns process replacement, so this process's own shutdown is
 * the restart succeeding.
 */

import { spawn } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import z from '@deepseek-ai/schemastery'

/** Plugin config: the systemd unit the button restarts. */
export interface HostRestartConfig {
  /** Systemd unit name passed to `systemctl restart`; defaults to `dsh-web`. */
  unit: string
}

export const Config: z<HostRestartConfig> = z.object({
  unit: z.string().default('dsh-web'),
})

/** Services required to register the exact Fetch route. */
export const inject = ['connection']

/** Stable Cordis plugin name. */
export const name = 'ui-host-restart'

/** Absolute path of the restart route on the shared `/api` channel. */
const RESTART_PATH = '/api/web-restart'

/** Milliseconds to wait for a fast systemctl verdict before assuming restart. */
const SYSTEMCTL_VERDICT_MS = 1200

/**
 * Register the restart route. `systemctl restart` is spawned detached (the
 * restart job is owned by systemd's PID 1, so the dying unit — this process
 * — never takes the stop request down with it) and the route waits briefly
 * for a fast verdict: an instant nonzero exit means the unit could not be
 * restarted (missing unit, failed daemon-reload), which is reported as 500
 * with the stderr so a misconfigured deployment fails loud; no exit within
 * the window means the stop/start job is running — the normal self-restart
 * shape, where this process is the one being stopped — and the answer
 * reports that the restart was requested.
 * @param ctx - host plugin context.
 * @param config - validated plugin config (`unit` carries its default).
 */
export function apply(ctx: Context, config: HostRestartConfig): void {
  const unit = config.unit as string
  const connection = ctx.get('connection') as HostConnectionHandle
  ctx.effect(() => connection.fetch.register({
    path: RESTART_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async () => {
      const child = spawn('systemctl', ['restart', unit], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] })
      child.unref()
      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      const verdict = await new Promise<'restarting' | { failed: string }>((resolve) => {
        const timer = setTimeout(() => resolve('restarting'), SYSTEMCTL_VERDICT_MS)
        child.on('error', (error) => { clearTimeout(timer); resolve({ failed: String(error) }) })
        child.on('close', (code) => {
          clearTimeout(timer)
          resolve(code === 0 ? 'restarting' : { failed: `systemctl restart ${unit} exited ${String(code)}: ${stderr.trim()}` })
        })
      })
      if (typeof verdict === 'object') {
        process.stderr.write(`ui-host-restart: ${verdict.failed}\n`)
        return Response.json({ error: verdict.failed }, { status: 500 })
      }
      return Response.json({ restarting: true, unit })
    },
  }), `ui-host-restart: ${RESTART_PATH}`)
}
