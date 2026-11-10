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

## Verify on staging

- Run `supabase/tests/room_protocol.sql` with `psql` against the staging database after applying migrations.
- Print and scan QR codes with Android and iOS. From a second device, download the original JPEGs, finished PNG, and animated GIF. Compare the files with the booth outputs. Revoke a link and confirm that it stops resolving.
- Pair a phone browser on Wi-Fi with Flutter on a second phone using cellular data. Use a card labeled with the role and round in each shot. Verify that the export has three stacked TV screens, with the host on the left and the guest on the right inside each screen. Check rounds 1 through 3 from top to bottom. Save the PNG on both devices and compare their SHA-256 hashes.
- For the physical timing check, keep the phones on their separate networks but point both cameras at the same continuously running millisecond display. Compare the times visible in the two stills from each round. This measures the resulting exposures. The simulated browser test measures when each device requested capture against the 250 ms target. Background one participant before the shutter, then return and retry the round.
- Check that cleanup removes abandoned uploads and that plain capture and printing work with both flags disabled.
