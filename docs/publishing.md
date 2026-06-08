# CI and publishing

## What runs when

- **Every push to `main` and every pull request** → the `checks` job:
  `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check`.
- **Pushing a `v*` tag** → the `release` job (after checks pass): packages the
  extension, creates a GitHub Release with the zip attached, and publishes to the
  stores whose secrets are configured.

## Cutting a release

1. Bump the version in `extension/manifest.json` (and `package.json` if you keep
   them in sync). Stores reject re-uploads of an existing version.
2. Commit, then tag and push the tag:
   ```bash
   git tag v2.1.0
   git push origin v2.1.0
   ```
   The tag must equal the manifest version (the workflow fails fast otherwise).

The GitHub Release is always created. Each store publishes only if its secrets
are present, so you can enable them one at a time.

## Firefox (AMO) — listed

Publishes to the public addons.mozilla.org listing via `web-ext sign`
(`--channel=listed`), which goes through Mozilla review.

Secrets to add (repo → Settings → Secrets and variables → Actions):

- `AMO_JWT_ISSUER` — API key ("issuer") from
  <https://addons.mozilla.org/developers/addon/api/key/>.
- `AMO_JWT_SECRET` — API secret from the same page.

Note: the **first** listed version of a brand-new add-on may need to be created
once through the AMO Developer Hub; subsequent versions publish from CI.

> Listed and unlisted are mutually exclusive for a given version number — AMO
> won't take the same version on both channels. This pipeline uses listed (the
> public store). To self-distribute a signed `.xpi` instead, switch the channel
> to `unlisted` in the workflow.

## Chrome Web Store — optional, gated on secrets

Requires a Google developer account (one-time $5 USD registration). The publish
step is skipped until all four secrets exist.

1. Register and create the item once in the
   [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (upload
   any build) to obtain its **extension ID**.
2. Create OAuth credentials and a refresh token for the Web Store API (see the
   [chrome-webstore-upload docs](https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md)).

Secrets to add:

- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

## Adding secrets from the CLI

```bash
gh secret set AMO_JWT_ISSUER
gh secret set AMO_JWT_SECRET
# Chrome (when ready):
gh secret set CHROME_EXTENSION_ID
gh secret set CHROME_CLIENT_ID
gh secret set CHROME_CLIENT_SECRET
gh secret set CHROME_REFRESH_TOKEN
```
