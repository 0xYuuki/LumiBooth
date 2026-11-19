# Print commerce operations

## Staging deployment

Use a dedicated staging Supabase project or branch and separate, stable HTTPS origins for the public booth and private staff dashboard. In Vercel, create separate projects with the `lumibooth_web` root. Use the default web build for the booth. Set the staff project's build command to `npm run build:staff` and its output directory to `dist-staff`.

Before deploying the staff build, turn on Vercel Authentication with **All Deployments** in the staff project's Deployment Protection settings. Grant access to approved staff accounts. Verify that the primary staff URL and the generated deployment URL both deny unauthenticated requests. Use synthetic images, accounts, and catalog items for the checklist.

| Setting | Staging value |
|---|---|
| `VITE_LUMI_COMMERCE` | `true` for the staging build. The default is `false` when omitted. |
| `VITE_LUMI_SUPABASE_URL` | Staging Supabase API URL. |
| `VITE_LUMI_SUPABASE_KEY` | Staging publishable key. |
| `LUMI_COMMERCE_ENABLED` | `true` in the staging Edge Function environment after setup. The default is `false` when omitted. |
| `LUMI_WEB_ORIGIN` | Exact HTTPS web origin, without a path or trailing slash. This setting is shared with the `lumi` function. |
| `LUMI_STAFF_WEB_ORIGIN` | Exact HTTPS origin of the private staff dashboard, without a path or trailing slash. |
| `LUMI_COMMERCE_CLEANUP_SECRET` | Random server-only secret, separate from the online booth cleanup secret. Store the same value in staging Vault for Cron. |

1. Link the Supabase CLI to the approved staging project or branch. Confirm the project ref before running the staging migration and deploying the function.

   ```sh
   supabase link --project-ref "$LUMI_STAGING_PROJECT_REF"
   supabase db push
   supabase functions deploy print-commerce --project-ref "$LUMI_STAGING_PROJECT_REF"
   ```

2. Enable guest anonymous sign-in in staging Supabase Auth and configure the staging Auth site URL and exact `/account` redirect URLs for the public and staff sites. Review anonymous sign-in limits before public rollout. Store Edge secrets in Supabase. The web build uses only the publishable key.
3. Provision the staff role through trusted database administration after creating and confirming the staff Auth account. Verify that a regular account cannot open the queue before using the staff account.

   ```sql
   insert into lumi_commerce.staff_roles (user_id)
   values ('<confirmed-staff-auth-user-uuid>'::uuid)
   on conflict (user_id) do update set active = true;
   ```

4. Provision an approved test SKU with a unique reference prefix, variant, listing URL, buyer reference instructions, consent text, pixel dimensions, trim and bleed, safe inset, DPI, and order limits. Use the spec and field rules in the backend contract.
5. Set up cleanup, then enable both staging feature flags and deploy both staging builds. Open the private staff URL, confirm Vercel access, and sign in with the provisioned staff account. Confirm that the public booth has no staff queue. Keep the public flags disabled until the seller completes the live approval in issue #33.

[Backend contract](commerce.md) · [Issue #33](https://github.com/0xYuuki/LumiBooth/issues/33) · [Supabase anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous)

## Cleanup and monitoring

Enable Supabase Cron and `pg_net`. In Vault, create `lumi_commerce_project_url` with the staging API URL without a trailing slash and `lumi_commerce_cleanup_secret` with the staging cleanup secret. Schedule the job from the staging SQL Editor.

```sql
select cron.schedule('lumi-print-cleanup', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'lumi_commerce_project_url') || '/functions/v1/print-commerce/v1/cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-lumi-cleanup', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'lumi_commerce_cleanup_secret')
    ),
    body := '{}'::jsonb
  );
$job$);
```

Check the Cron run history and the Edge invocation for a successful HTTP response. A successful Cron run confirms that the HTTP request was queued. The Edge invocation shows whether cleanup completed. On staging, let a synthetic pending request expire. Confirm it reads expired, then confirm the private file is removed and `cleaned_at` is filled after the five-minute grace period.

Route repeated cleanup failures or missing cleanup invocations to the project operator through the existing operational alert channel. Use the Edge invocation status and the aggregate query below to distinguish a cleanup delay from an empty queue. Include the environment, timestamp, and affected count in alerts. Keep receipt tokens, cleanup secrets, print files, and order references out of logs and alerts.

```sql
select count(*) as overdue_requests, min(expires_at) as oldest_expiry
from lumi_commerce.print_requests
where status in ('draft_upload', 'awaiting_marketplace_order', 'expired')
  and cleaned_at is null
  and expires_at < now() - interval '15 minutes';
```

A rising overdue count calls for checking Edge errors, the Vault secret match, the function URL, and Storage. Cleanup can safely retry an eligible file on the next run. It handles up to 50 expired requests per run and leaves held and fulfilled requests for the separate operator-approved retention policy.

[Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) · [Supabase Cron](https://supabase.com/docs/guides/cron)

## Staff fulfillment

1. Open the private staff site and sign in with a provisioned staff account. Search for the LumiBooth reference.
2. In Seller Center, confirm payment and compare the exact reference, SKU, variant, and quantity. Enter the order ID and identifiable line ID, confirm the attestation, and record the seller ship-by date if available. When splitting a line, identify its first unallocated unit. Without a line ID, use a request that covers the entire verified order quantity.
3. For a missing, wrong, or duplicated reference, hold the order in Seller Center and ask for the right reference. Mark any identified LumiBooth request **Needs review** and record why. For cancelled or refunded purchases, confirm the change in Seller Center before recording it in LumiBooth.
4. Preview and download the original after verification. Check the PNG dimensions, trim, bleed, and safe area against the catalog spec. Print at the approved physical size. Record **Ready to print**, **Printing**, and **Packed** as work progresses.
5. Use Seller Center to ship and obtain the waybill or tracking reference. Record shipment in LumiBooth, then mark the request complete after fulfillment. Use a separate reprint job with a reason and quantity. Complete or cancel it before advancing the original request.

To revoke access, set the account’s `lumi_commerce.staff_roles.active` to `false` through trusted administration. Verify the removed account receives a staff-access error and loses access to the request and original.

## Hosted staging checklist

- [ ] Record the deployment commit and note the browser, viewport, and staging project in the QA ticket.
- [ ] On a phone and a desktop, capture and edit with a representative template. Choose a SKU, check the crop, safe area, and bleed, give consent, and upload.
- [ ] Interrupt a synthetic upload and return to **Print orders**. Recover the same request and reference. Confirm that keyboard focus selects the read-only reference and that manual copy works when clipboard permission is denied.
- [ ] Confirm the checkout link points to the approved test listing. Use a seller-approved supervised transaction only when authorized for live orders. Use a synthetic Seller Center record or fixture for staging QA.
- [ ] Verify rejection of missing, wrong, duplicated, expired, cancelled, or refunded requests and mismatched products or quantities. Have two staff accounts attempt the same allocation. Confirm only one succeeds and the audit identifies the staff account.
- [ ] Verify unauthenticated access is blocked on every staff deployment URL and that an ordinary Supabase account cannot open the queue even with hosting access. Check file access before and after verification with staff, signed-out, and regular accounts. Download a verified PNG, confirm pixel dimensions and visible crop and color, then make a test print and check physical trim and bleed.
- [ ] Progress a verified request through tracking and completion, refresh the buyer receipt, and confirm staff and buyer see the expected statuses. Exercise a reprint and verify that refund revokes further download.
- [ ] Confirm cleanup finishes for a synthetic expired request. Check that ordinary capture, editing and download work with commerce off.

The CI browser test runs from camera capture through the buyer’s completed receipt against local Auth, the print service, and private Storage. It checks the decoded downloaded PNG against the cropped preview at the configured dimensions. The TikTok navigation goes to a test fixture. Seller Center behavior, physical print output, and deployment settings need the hosted staging or seller checks above.

## Rollback

- To stop new orders while staff handle existing requests, disable the affected SKUs in the catalog. Keep both flags enabled while staff need the queue and buyers need receipt updates. Existing receipts for a disabled listing stop offering checkout.
- For a full stop, set `LUMI_COMMERCE_ENABLED=false` to stop commerce API operations, then redeploy the web with `VITE_LUMI_COMMERCE=false` to hide entry points. Validate the catalog and staff API are unavailable and ordinary booth functions still work. Cleanup remains available to its scheduler.
- Preserve request, match, reprint, audit, and file records during rollback. Restore the last known working app and Edge Function if needed and verify against the existing schema before reopening. Keep seller operations in Seller Center while the dashboard is unavailable.
