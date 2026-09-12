# Agent Note: Browser-aware trusted-host configuration plane

Status: implemented

English | [中文](2026-09-04-browser-aware-trusted-host-config-plane.zh.md)

## Problem

`dsh web --trusted-host harness.example` declares `harness.example` a trusted authority so the served page may reach the full Host API through the [browser request-trust fence](2026-07-28-api-browser-trust-boundary.md) and [browser token authentication](2026-08-24-browser-token-authentication.md). The server half accepted the authority, but the browser half still classified reachability purely from `isLoopback`, which reads the page's URL hostname and the transport owner flag. A page served at `harness.example` read `isLoopback === false`, so `ui-settings` selected its process-local `memory` persistence and never called `settings/describe`, and `ui-settings-general` withheld the Host document action. The trusted deployment therefore lost the configuration plane its operator intended to reach, while loopback deployments behaved unchanged.

The server fence alone could not fix this: it answers per-request, but the settings surfaces decide their mode once at activation, before any request, from a browser-side reachability fact.

## Decision

`dsh-client-connection` mirrors the deployment's configured authorities into the browser and reports configuration-plane reachability separately from loopback ownership.

The node half pushes the resolved `trustedHosts` array verbatim as the `__DSH_TRUSTED_HOSTS__` page global through the existing `webserver/index-inject` row (kind `global`), the same mechanism that injects `window.__DSH_BOOT__`. The browser half reads that global and derives `ctx.connection.configAccessible`: true when the page authority is loopback, the transport declares the page owns the Host, or the page authority matches a declared trusted entry using the same WHATWG-normalized comparison the Host fence applies (port-less entry matches the hostname on any port; a ported entry matches the exact authority). A missing or malformed global leaves the page untrusted, matching the empty-grant default of an unconfigured `trustedHosts`. `ctx.remote.$host.configAccessible` exposes the same fact on the fixed Host facts.

Settings surfaces switch their mode decision from `isLoopback` to `configAccessible`: `ui-settings` selects `host` persistence when the configuration plane is reachable, and `ui-settings-general` mounts its Host document action under the same condition. Host-native desktop operations — opening files or directories in `ui-deliverables` — keep reading `isLoopback` and remain loopback-only: a served trusted page still must not reach the operator's filesystem directly.

The server fence is unchanged. Configuration-plane reachability from a browser still requires a successful browser session (`settings/describe` and friends return 401 without a valid cookie), so `configAccessible` only decides which mode the settings surfaces boot into; it grants nothing the fence would refuse.

## Verification

Unit coverage pins `isTrustedAuthority` matching (port-less and ported entries, case-insensitivity, malformed entries, empty trust), the node half's index-injection of the configured and empty trust globals, the browser half's `configAccessible` derivation across loopback, declared-authority, untrusted, and absent/malformed global cases, and the gateway `$host` projection of the fact. Settings suites pin the memory-mode fallback when the configuration plane is unreachable and host-document availability on trusted authorities.

## Alternatives considered

**Split the Host method list into configuration-plane and native-desktop tiers and fence them separately.** Master replaced the method-specific loopback list with uniform browser authentication, so a per-method browser-side split would reintroduce a second authority model with no server counterpart. The browser-facing reachability fact is enough: the fence enforces the real grant, and the desktop-only `isLoopback` consumers keep their existing loopback gate.

**Round-trip a reachability probe before choosing the settings mode.** Settings activation must stay synchronous and request-free; a probe would race activation and add a wire read to a surface whose mode is fixed for the page lifetime. The injected global carries the same information with no round trip.

## Consequences

A `trustedHosts`-declared non-loopback deployment boots its settings surfaces into the host-backed document and shows the Host document action, closing the gap between the fence's acceptance of the authority and the browser's reachability model. The injected global is public page content (like `__DSH_BOOT__`) and changes only with the deployment configuration; it grants nothing beyond what the fence and browser session already allow. Settings remain process-local on any page the deployment does not declare, preserving the memory-mode behavior for untrusted browsing contexts.
