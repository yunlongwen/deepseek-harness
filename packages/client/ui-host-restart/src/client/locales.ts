/** Sidebar restart-row copy dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'restart'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'restart.label': '重启服务',
  'restart.confirm': '确认重启？',
  'restart.working': '重启中…',
  'restart.failed': '重启失败，请查看服务器日志',
} satisfies Record<string, string>

/** The restart namespace key union. */
export type RestartKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'restart.label': 'Restart service',
  'restart.confirm': 'Confirm restart?',
  'restart.working': 'Restarting…',
  'restart.failed': 'Restart failed; check the server logs',
} satisfies Record<RestartKey, string>
