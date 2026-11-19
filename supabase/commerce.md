# LumiBooth print commerce backend

This is the backend contract for [issue #33](https://github.com/0xYuuki/LumiBooth/issues/33). The Edge Function defaults to disabled. The migration creates no products or staff accounts. Seller Center remains the source staff consult to confirm orders.

## Data relationships

| Entity | Relationship |
|---|---|
| `print_products` | One row per enabled or disabled SKU and variant. One product can have many print requests. |
| `print_requests` | One immutable SKU, quantity, consent and print specification snapshot per request. The creating Auth identity and retry key identify repeated submissions. |
| `tiktok_order_matches` | At most one match per request. One TikTok order can have several identified lines or non-overlapping item allocations within a line. |
| `print_reprints` | Separate reprint jobs against the verified original. Each request can have one active reprint at a time. |
| `print_order_events` | Many audit events per request. The Edge role can write events and has no update or delete permission on them. |
| `staff_roles` | Provisioned from trusted database administration for the Auth user ID. The application never accepts a staff role as user input. |
| `lumi-prints` | A server-only private Storage bucket. Each request owns one immutable PNG path. |

App roles have no grants on the commerce schema. The exposed RPCs are callable only by the server role. The Edge Function validates the Auth token for request creation and staff operations. Auth anonymous sign-in can provide a guest identity. Staff must use a non-anonymous account with an active staff row.

## Version 1 API

All calls are POSTs to `/functions/v1/print-commerce/v1/<action>`. Browser requests require the configured exact `LUMI_WEB_ORIGIN`.

| Action | Access and inputs | Result |
|---|---|---|
| `catalog` | Enabled feature | Enabled variants with operator-configured listing and print specs. |
| `create` | Guest or account Auth token. JSON with `productId`, `quantity`, `idempotencyKey`, `receiptToken`, `consentVersion` and `consentAccepted: true` | Draft receipt summary. |
| `upload?requestId=…` | `X-Lumi-Receipt` header and raw `image/png` body | Finalized receipt summary and printable reference. Retry with the same PNG after an interrupted upload. |
| `status` | `X-Lumi-Receipt` header and JSON `requestId` | Receipt summary with status and the finalized code. |
| `staff-list` | Staff token. Optional `lookup` (reference or TikTok order ID), `sku`, `status`, `fromDate`, `throughDate`, and cursor pair `beforeCreated` and `beforeId` | Up to 50 finalized requests. Date filters use Philippine calendar dates. |
| `staff-detail` | Staff token and `requestId` | Print specification, Seller Center match, file availability, reprints, and the latest 100 audit events. |
| `staff-match` | Staff token. JSON `code`, `orderId`, optional `lineId`, `sku`, `variant`, `lineQuantity`, optional `firstUnit`, optional `shippingDeadline` in YYYY-MM-DD format, and `sellerCenterVerified: true` | Verified request with the staff match recorded. |
| `staff-transition` | Staff token. JSON `requestId`, `status`, optional `expectedStatus` for conflict detection, short `reason` for exceptions, and optional `trackingReference` when shipping | Updated request and an audit event. |
| `staff-media` | Staff token and JSON `requestId`. The request must be verified or in a fulfillment state. | Authenticated PNG attachment. The response forbids caching. |
| `staff-reprint` | Staff token. JSON `requestId`, UUID `retryKey`, `quantity`, and `reason` | Creates or returns a retried reprint job. |
| `staff-reprint-update` | Staff token. JSON `requestId`, `jobId`, `expectedStatus`, `status`, and `reason` for cancellation | Records a reprint transition with audit history. |
| `cleanup` | Server-only `X-Lumi-Cleanup` secret | Expires abandoned requests and removes eligible expired PNGs. |

Generate the receipt token from 32 cryptographically random bytes and encode it as lowercase hex. Generate a separate random UUID for the idempotency key. Persist both before sending `create`. The server stores only the token hash. Reuse the original values for retries. Keep the token out of URLs, seller messages and logs. The receipt token grants access only to its request summary and upload.

The backend assigns the prefixed reference and exposes it once the file is finalized. The reference serves manual order matching. It provides no receipt or file access. An unavailable request or invalid receipt returns 404. A conflicting retry, file, match or state change returns 409.

## Print file and fulfillment rules

The upload accepts non-interlaced 8-bit RGB or RGBA PNG at the exact width and height in the request snapshot. It checks the configured compressed size, PNG chunks and checksums, and the expected decoded scanlines. The server removes incidental metadata, hashes the image and stores it under the request ID. It reserves the hash before writing and confirms the Storage object before publishing the reference. The customer preview must calculate effective source quality against the approved DPI in M2. PNG dimensions alone establish output size.

After upload, the request waits for marketplace matching. Staff can hold it in `needs_review` while investigating. A staff attestation can move the request to `verified`, followed by `print_ready → printing → packed → shipped → completed`. Review, cancellation and refund transitions require a reason. The order allocation record is preserved across these transitions. Record the ship-by date at matching and the waybill or tracking reference when marking the order shipped. Use Seller Center for shipping, cancellations and refunds. A reprint uses the same verified file and stays separate from the original fulfillment status. Staff can queue reprints once printing starts and must resolve an active reprint before advancing fulfillment. Recording a refund cancels the active reprint and locks the print file.

If Seller Center does not identify the item line, a match must cover the entire verified quantity for that order. A request with a line ID can claim an explicit allocation beginning at `firstUnit`. A database transaction serializes matching by order ID and rejects ambiguous overlaps. Staff must confirm the positions in Seller Center or leave the request in review.

Cleanup expires only unverified pending requests. It removes the private file after a short grace period to let in-flight uploads finish. A later job retries interrupted cleanup. Held or fulfilled requests are excluded. An operator-approved retention policy for those records and files is required before launch.

## Local verification and deployment

The [commerce verification workflow](../.github/workflows/print-commerce.yml) runs an isolated Auth, Storage, and Edge test. It creates a synthetic SKU and staff account, exercises request recovery and concurrent matching, fulfillment and reprints, and checks expiry and access isolation. No production records are seeded.

Deploy only to a test environment while implementing M2 and M3. Provision test staff through trusted administration, and configure the exact web origin and a server-only cleanup secret. Schedule `cleanup` through the existing Vault and Cron pattern, and verify that it runs. Keep `LUMI_COMMERCE_ENABLED` and `VITE_LUMI_COMMERCE` disabled on public builds until the operator approves listings, print specs, consent, retention, seller procedures and supervised live orders.

## Customer web integration

The web client offers only catalog entries with a valid TikTok Shop link
and operator-approved `buyer_instructions`. The SKU may define `bleed_px`
from the outside edge and `safe_inset_px` inside the trim. The PNG uses the
full specified width and height. Staff print at the SKU’s physical size.

The receipt keeps the original listing and print specification. When the
customer opens TikTok Shop, the app refreshes the receipt and checks the
current catalog against that snapshot. A disabled product or changed checkout
details stops the redirect. Staff can still review an existing request.
