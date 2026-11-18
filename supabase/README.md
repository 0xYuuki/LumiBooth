# Deploy LumiBooth online features

Local photo capture and GIF export require no backend. Print-to-Play and Long-Distance Booth use one Supabase project and independent client flags.

## Backend

1. Link the Supabase CLI to a staging project. Apply the migration with `supabase db push` and deploy the Edge Function with `supabase functions deploy lumi`.
2. Enable anonymous sign-ins in Supabase Auth and disable public channels in Realtime. Set `LUMI_WEB_ORIGIN` to the exact HTTPS origin of the web app and `LUMI_CLEANUP_SECRET` to a random server-only secret. Keep the Supabase service-role key in the function environment. Set `LUMI_PUBLIC_SUPABASE_URL` when the internal Supabase address differs from the one clients can reach. For a local CLI deployment viewed on the development machine, use `http://127.0.0.1:54321`.
3. Configure a one-minute [Supabase Cron job](https://supabase.com/docs/guides/cron) before enabling either feature. Store the API base URL and cleanup secret in Vault as `lumi_project_url` and `lumi_cleanup_secret`, enable `pg_net`, and run the following SQL. Check the Cron and Edge Function logs for failed runs.

```sql
select cron.schedule('lumi-expired-media', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lumi_project_url') || '/functions/v1/lumi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-lumi-cleanup', (select decrypted_secret from vault.decrypted_secrets where name = 'lumi_cleanup_secret')
    ),
    body := '{"action":"cleanup"}'::jsonb
  );
$job$);
```

Share and invite tokens are hashed in the database. Links stop resolving at expiry or revocation. Previously issued media URLs last up to 60 seconds. Cleanup deletes expired files and revisits abandoned uploads while their upload tickets can still be used. Review [anonymous sign-in rate limits](https://supabase.com/docs/guides/auth/auth-anonymous) and monitor usage before public rollout.

## Clients

Serve the web app over HTTPS with SPA fallback routes for `/p` and `/room`. Set these build variables using the project's **publishable key**. Include any deployment path prefix in the public web URL and keep it stable for printed QR codes.

```dotenv
VITE_LUMI_SUPABASE_URL=https://PROJECT.supabase.co
VITE_LUMI_SUPABASE_KEY=sb_publishable_...
VITE_LUMI_PUBLIC_URL=https://booth.example/
VITE_LUMI_PRINT_QR=true
VITE_LUMI_REMOTE_BOOTH=true
```

Pass the corresponding variables without `VITE_` to Flutter as `--dart-define` values. For example, use `--dart-define=LUMI_PRINT_QR=true`. Omit either feature flag to keep its controls off. The web route for existing print links remains available as long as the backend stays configured.

## Optional accounts

With a Supabase URL and publishable key configured, the web welcome page and the mobile Me tab offer email accounts. Enable the Email provider and email confirmations in Supabase Auth. Configure the project Site URL, an email provider suitable for production, and these allowed redirect URLs:

- The web app’s `/account` URL, including any deployment path prefix. Serve it through the SPA fallback.
- `com.lumibooth.app://auth/callback` for Android and iOS.

Email confirmation and recovery use PKCE. Open the link on the device and in the app or browser profile that requested it. For local web development, also allow the corresponding localhost URLs. Guest capture, editing, and local export work without the account service. Existing online guest sharing sessions are independent of account sessions.

## Verify on staging

- Run `supabase/tests/room_protocol.sql` with `psql` against the staging database after applying migrations.
- Print and scan QR codes with Android and iOS. From a second device, download the original JPEGs, finished PNG, and animated GIF. Compare the files with the booth outputs. Revoke a link and confirm that it stops resolving.
- Pair a phone browser on Wi-Fi with Flutter on a second phone using cellular data. Use a card labeled with the role and round in each shot. Verify that the export has three stacked TV screens, with the host on the left and the guest on the right inside each screen. Check rounds 1 through 3 from top to bottom. Save the PNG on both devices and compare their SHA-256 hashes.
- For the physical timing check, keep the phones on their separate networks but point both cameras at the same continuously running millisecond display. Compare the times visible in the two stills from each round. This measures the resulting exposures. The simulated browser test measures when each device requested capture against the 250 ms target. Background one participant before the shutter, then return and retry the round.
- In the web app and on Android and iOS, confirm a new email account, sign out, sign back in, and follow a password reset link. Sign in again with the new password and confirm that an existing local draft is still available.
- Check that cleanup removes abandoned uploads and that plain capture and printing work with both flags disabled.

## Private strip backups

Apply the private-backup migration to staging and verify access before enabling
`VITE_LUMI_CLOUD_BACKUP=true` on web or `--dart-define=LUMI_CLOUD_BACKUP=true`
on Flutter. Both flags default off. The web host should serve the app shell for
`/backup`.

Guests keep local access to Your works. A signed-in account can select existing
saved strips, see the estimated upload size, and confirm the upload. Backups are
manual. Signing in, dismissing the invitation, and creating future strips leave
those strips on the device. Motion buffers and unsaved drafts stay local.

The private `lumi-private-backups` bucket stores one immutable archive per
saved work under the account's UUID. The Storage object record is the catalog.
A retry uses the same path. Only complete uploads appear in the catalog, and
the archive limit is 24 MiB. Store a strip again as a new work to back up another
edit. Cross-device restore preserves editable projects on the originating
platform. Restoring a Flutter archive on web or a web archive on Flutter
produces a preview-only PNG. A restore keeps any local work that already has
the same ID.

Cloud backups are retained until the owner deletes them. Deleting a local
strip leaves its cloud backup. Deleting the backup leaves every downloaded
local copy. For an account deletion request, remove that account's backup
objects through the Storage API before deleting its Auth user. Do not delete
Storage rows directly. The QR sharing bucket and its expiry policy are separate.

For local verification, start Supabase and set `LUMI_TEST_SUPABASE_KEY` to its
publishable key. Run `node supabase/tests/private_backups.mjs` from the repo
root. The test covers owner access, peer and guest isolation, immutable upload
retries, failed uploads, and deletion. To run the browser integration test,
build the web app with the local Supabase URL `http://127.0.0.1:54321`, the
local publishable key, and the backup flag enabled. Run
`npm run test:e2e -- e2e/backup.spec.js` in `lumibooth_web`.

Before production rollout, repeat upload, retry, duplicate restore, and delete
checks with two staging accounts on web and Android/iOS. Confirm that a
different account cannot list, download, overwrite, or remove the backup, and
that local capture and Your works remain usable while signed out or offline.
