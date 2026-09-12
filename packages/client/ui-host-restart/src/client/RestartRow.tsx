/**
 * Sidebar footer restart action: a row matching the Settings trigger's visual
 * language (42px wide row / 36px rail circle), with an inline two-step
 * confirm — the first click arms the button, the second one fires the
 * authenticated restart, then the row reports progress and reloads the page
 * once the replacement process answers. Disarming states (idle ← armed)
 * happen on a second click anywhere on the row and on a sidebar fold, so a
 * collapsed rail never hides an armed confirm.
 */
import { useCallback, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './restart.module.css'

/** Footer-action owner share this component renders against. */
type RestartRowProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'restart'>

/** Phases of one restart interaction. */
type Phase = 'idle' | 'armed' | 'working' | 'failed'

/** Milliseconds the armed confirm stays open before disarming itself. */
const ARM_TIMEOUT_MS = 4000
/** Milliseconds between recovery probes once the restart request is sent. */
const PROBE_INTERVAL_MS = 1000
/** How long the row keeps probing for the replacement process. */
const PROBE_DEADLINE_MS = 30_000
/** The Host half's authenticated restart route. */
const RESTART_URL = '/api/web-restart'

/** One-loop circular-arrows glyph riding currentColor. */
function RestartGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M13.6 8a5.6 5.6 0 1 1-1.64-3.96M13.6 1.6v2.8h-2.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Render the restart row content for the sidebar footer.
 * @param props - composed slot props (wide flag + locale seat).
 * @returns the restart row fragment.
 */
export function RestartRow({ wide, t }: RestartRowProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const armTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const probeTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const clearTimers = useCallback(() => {
    clearTimeout(armTimer.current)
    clearInterval(probeTimer.current)
  }, [])

  const beginRestart = useCallback(() => {
    setPhase('working')
    // Probes hit the origin root, not the restart route: a looping POST would
    // ask every replacement to restart again. The root answers 200/303/401
    // from the webserver itself, which is exactly "a dsh process is serving".
    const probe = (): void => {
      fetch('/', { credentials: 'same-origin' })
        .then((response) => {
          if (response.status === 502 || response.status === 504) throw new Error('gateway')
          // A dsh process answered (200 index, 303 login redirect, or 401
          // unauthenticated): reload into it.
          clearTimers()
          location.reload()
        })
        .catch(() => {
          // The old process dying is the restart succeeding; keep probing
          // until the deadline, then surface the failure copy.
          if (Date.now() >= deadline) {
            clearTimers()
            setPhase('failed')
          }
        })
    }
    const deadline = Date.now() + PROBE_DEADLINE_MS
    const fire = (): void => {
      fetch(RESTART_URL, { method: 'POST', credentials: 'same-origin' })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status))
          // The stop was accepted: move to recovery probing.
          probeTimer.current = setInterval(probe, PROBE_INTERVAL_MS)
        })
        .catch(() => {
          // The old process may already be dying (request raced the stop);
          // treat a failed fire the same as an accepted one and start probing.
          probeTimer.current = setInterval(probe, PROBE_INTERVAL_MS)
        })
    }
    fire()
  }, [clearTimers])

  const onClick = useCallback(() => {
    if (phase === 'idle') {
      setPhase('armed')
      armTimer.current = setTimeout(() => { setPhase('idle') }, ARM_TIMEOUT_MS)
      return
    }
    if (phase === 'armed') {
      clearTimers()
      beginRestart()
      return
    }
    if (phase === 'failed') setPhase('idle')
  }, [phase, clearTimers, beginRestart])

  const label = phase === 'idle' || phase === 'failed'
    ? t('restart.label')
    : phase === 'armed'
      ? t('restart.confirm')
      : t('restart.working')

  const className = wide ? css.row : `${css.row} ${css.rail}`

  return (
    <button
      type="button"
      className={className}
      disabled={phase === 'working'}
      aria-label={label}
      onClick={onClick}
      onMouseLeave={() => { if (phase === 'armed') setPhase('idle') }}
    >
      <RestartGlyph size={wide ? 14 : 18} />
      {wide && <span className={css.label}>{label}</span>}
    </button>
  )
}
