# Chrome Web Store releases

The repository publishes only from version tags. A normal commit runs CI; a
tag matching the manifest version runs the release workflow.

## One-time setup

1. Create a Chrome Web Store developer account and pay Google's one-time
   registration fee.
2. Upload `artifacts/keyframe-staff-overlap-<version>.zip` manually once and
   choose the desired visibility. Keep the resulting extension ID.
3. Create OAuth credentials for the Chrome Web Store API and obtain a refresh
   token for the publishing account.
4. Add these repository secrets under **Settings -> Secrets and variables ->
   Actions**:

   - `CHROME_EXTENSION_ID`
   - `CHROME_CLIENT_ID`
   - `CHROME_CLIENT_SECRET`
   - `CHROME_REFRESH_TOKEN`

## Release a version

Update the version in `manifest.json`, `package.json`, and `package-lock.json`,
then create and push the matching tag:

```sh
git tag v0.1.8
git push origin v0.1.8
```

The workflow runs unit tests, type checking, the Chromium extension test,
builds the package, creates a GitHub Release, and uploads/publishes the same
ZIP to the existing Chrome Web Store item. Chrome distributes the published
update through its normal update cycle.

Commits without a version tag do not publish. The tag must match the manifest
version exactly; this prevents publishing an accidentally stale package.
