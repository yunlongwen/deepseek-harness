---
description: "Deployment-local sidebar restart button for the self-hosted dsh web: an authenticated systemctl restart route plus a footer action row."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-host-restart

## Summary

Deployment-local plugin for the self-hosted `dsh web` service: it adds a restart row beside the sidebar's bottom controls and one authenticated Host route that restarts the deployment's systemd unit. The package is untracked in the checkout on purpose — upstream syncs must never touch it. It composes through the same public seams every Web plugin uses: a `connection.fetch` exact route on the shared `/api` channel and a `sidebar.footer.action` slot registration.

## Model Experience

No model-visible surface: the plugin contributes no tools, prompts, or session events. Token and KV-cache effects are zero.

## Security posture

`POST /api/web-restart` rides Connection's own trust fence (Host/Origin allowlist) and browser-session authentication; the cookie is `SameSite=Strict`, and the route is POST-only, so a cross-site page can neither read nor replay it. The handler spawns `systemctl restart <unit>` detached — systemd owns process replacement, so the responding process dying is the restart succeeding.

## Known Limitations and Deferred Work

- The restart probes for recovery from the page that pressed the button; if the replacement never comes up within 30 seconds, the row shows the failure copy and the operator checks `journalctl -u <unit>`.
- Allowed in the web profile only; there is no TUI or headless surface, and none is planned.

## Dev Note

Test the execution chain against a nonexistent unit name (override `unit` in the profile patch) before pointing it at the live unit. The registry serves the built `lib/client.js`; rebuild with `pnpm --filter @deepseek-ai/dsh-client-ui-host-restart bundle` before probing a live server.
