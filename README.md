# Active Tab → Home Assistant

<p align="center">
  <img src="extension-logo.png" alt="Active Tab → Home Assistant logo" width="128" height="128" />
</p>

Browser extension (Chromium + Firefox, Manifest V3) that reports the active
browser tab to Home Assistant via a webhook. Configure it from the toolbar popup.

Payload sent on each report:
```json
{ "domain": "example.com", "url": "https://example.com/page", "visible": true, "focused": true }
```

It sends when the active tab's URL changes and on a heartbeat (configurable,
minimum 30 s). It sends nothing for non-web pages (`chrome://`, new tab,
extension pages) or when no browser window is focused; Home Assistant keeps the
last reported state.

> **Note:** This extension was generated almost entirely autonomously by
> [Claude Code](https://claude.com/claude-code) running Anthropic's Opus 4.8 model.

## Configuration (popup → Settings)

- **Home Assistant host**: e.g. `ha.example.com` or `https://ha.example.com:8123`.
- **Webhook ID**: the `/api/webhook/<id>` identifier.
- **Additional headers**: one `Name: Value` per line (optional).
- **Heartbeat interval**: seconds, minimum 30 (default 60).

Click **Save & grant access** and accept the permission prompt so the extension
may call your Home Assistant host.

## Install - Chromium (Chrome / Edge / Brave, etc.)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.

(A harmless `Unrecognized manifest key 'background.scripts'` warning is expected.)

## Install - Firefox (temporary)

For quick testing or development: `about:debugging` → *This Firefox* →
*Load Temporary Add-on* → pick `extension/manifest.json`. This is forgotten when
the browser restarts; for a lasting install see the next section.

> **Flatpak (Linux):** If your browser is installed via Flatpak, temporary
> loading may silently fail to load resources (no toolbar icon, empty popup)
> because the sandboxed browser can't read this repository's directory. Grant
> the app filesystem access to the `extension/` folder, via [Flatseal](https://flathub.org/apps/com.github.tchx84.Flatseal)
> or a `flatpak override`, e.g.:
> ```bash
> flatpak override --user --filesystem="$PWD/extension" org.mozilla.firefox
> ```
> Replace the application ID with your browser's (e.g.
> `io.gitlab.librewolf-community` for LibreWolf), then reload the add-on.

## Install - Firefox (permanent)

For a lasting install the add-on must be signed:

1. Get API credentials from <https://addons.mozilla.org/developers/addon/api/key/>.
2. From the `extension/` folder, sign for self-distribution (no source build;
   `web-ext` only packages and signs):
   ```bash
   cd extension
   npx web-ext sign --channel=unlisted \
     --api-key=YOUR_JWT_ISSUER --api-secret=YOUR_JWT_SECRET
   ```
3. Install the produced `.xpi` via `about:addons` → gear → **Install Add-on From File…**.

Alternatively, on Firefox Developer Edition / ESR you may set
`xpinstall.signatures.required = false` in `about:config` and install the
unsigned `.xpi` directly.

Gecko extension id: `{61d778e5-1738-490d-81d4-441d10ab4592}` (minimum Firefox 128).

## Development

- After cloning, enable the project's git hooks once. A `pre-push` hook refuses
  to push a version tag whose version doesn't match `extension/manifest.json`,
  which keeps releases from going out half-bumped:
  ```bash
  git config core.hooksPath .githooks
  ```
- No build step. All code is baseline JS/CSS/HTML, no polyfills.
- Install dev tooling once: `npm install`.
- Checks (the same set CI runs): `npm run typecheck`, `npm run lint`,
  `npm test`, and `npm run format` (or `npm run format:check`).
- Manual webhook receiver for local testing: `node tools/webhook-receiver.js`.

> **CORS note:** against a real HTTPS Home Assistant the granted host permission
> lets the background `fetch` bypass CORS (no preflight). But Firefox routes
> requests to `http://localhost` from the extension's secure context through
> CORS, so the local receiver answers the `OPTIONS` preflight to stay usable.
> This only affects the `http://localhost` dev setup, not real HTTPS hosts.

## License

[GPL-3.0-only](LICENSE).
