/**
 * Host restart plugin, browser half: occupies the sidebar's footer-action
 * slot with a restart row and registers its locale dictionaries. The row
 * calls the Host half's authenticated `POST /api/web-restart`, waits out the
 * process replacement, and reloads the page once the replacement answers.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.footer.action' entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { RestartRow } from './RestartRow.tsx'
import { en, NS, zh, type RestartKey } from './locales.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar restart-row copy. */
    'restart': RestartKey
  }
}
/** Dictionary namespace owned by this plugin. */
/** Required services: the footer-action slot declaration plus dictionaries. */
export const inject = ['slots', 'locale']
/**
 * Client plugin body: register the dictionaries and the footer action,
 * depending on the sidebar's slot declaration through `slots.inject`.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-host-restart: dictionaries')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'host-restart', locale: NS },
    RestartRow,
  ))
}
