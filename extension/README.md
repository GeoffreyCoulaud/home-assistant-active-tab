# Architecture

How this extension works, at the level of principles. It intentionally names no
files or functions so it stays accurate as the code evolves — for the concrete
shape of things, read the code.

## Purpose

Report which web page is active in the browser to Home Assistant, so automations
can react to what the user is looking at. One small JSON payload (hostname, URL,
and visibility/focus flags) is POSTed to a Home Assistant webhook.

## Event-driven, never polling

The extension reacts to browser events — window focus changes, tab activation,
and address changes in the active tab. It never polls the active tab on a timer.
A separate periodic heartbeat exists only as a recovery mechanism: it re-sends
the current state so a missed event or a temporarily unreachable Home Assistant
self-heals over time.

## Change detection

Each report is reduced to a small "state key". A report is sent only when that
key differs from the last one, so ordinary event noise doesn't produce duplicate
calls. The heartbeat deliberately bypasses this check so it can recover even when
nothing changed.

## Service-worker lifecycle

The background runs as an event page / service worker that the browser may stop
and restart at will. Because of this, no important state is kept in memory:
focus state and the de-duplication key are persisted so a fresh start is
seamless. A cold restart only re-establishes state and the heartbeat timer — it
does not emit a report; the event that woke the worker does that. Only genuine
lifecycle events (install, browser startup) emit an initial snapshot.

## Permission model

The Home Assistant host is configured by the user, so access to it is requested
on demand rather than asked for up front. The request happens during the save
action (a user gesture, which the browser requires), and settings are persisted
before that request so configuration is never lost if the permission prompt
interrupts the popup. A granted host permission also lets the background talk to
Home Assistant without cross-origin (CORS) restrictions.

## State and storage

All persistent state lives in the browser's local extension storage: the user
settings, an execution-log ring buffer, the last-send result shown in the popup,
and the ephemeral focus/de-duplication state. Settings are normalized both when
written and when read, so every consumer receives clean, fully-typed values and
the stored shape can't drift.

## Code organization

Pure, browser-independent logic (parsing, shaping payloads, normalizing
settings, building requests) is kept separate from the thin layers that touch
browser APIs and the DOM. The pure layer is unit-tested and statically
type-checked; the glue layers are verified by running the extension. There is no
build step and no polyfill: the code targets baseline JavaScript and the
promise-based extension API that both Chromium and Firefox expose.
