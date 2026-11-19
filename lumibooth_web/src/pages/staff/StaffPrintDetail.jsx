import { useEffect, useRef, useState } from 'react';
import { staffPrintRequest } from '../../commerce/commerceClient';
import { downloadBlob } from '../../online/download';
import { exceptionStages, humanize, manilaTime, nextStage, reprintActive, stageLabel } from './printStaffLabels';

const identifier = '[A-Za-z0-9_\\-]+';
const reasonInput = <input name="reason" required maxLength="300" />;

export default function StaffPrintDetail({ id, owner, onChange, onDenied }) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [retryKey, setRetryKey] = useState(() => crypto.randomUUID());
  const action = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    staffPrintRequest(owner, 'staff-detail', { requestId: id }, { signal: controller.signal })
      .then(detail => { if (!controller.signal.aborted) setResult({ detail, version }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ error, version }); });
    return () => {
      controller.abort();
      action.current?.abort();
    };
  }, [id, owner, version]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const current = result?.version === version ? result : null;
  const denied = [401, 403].includes(current?.error?.status);
  useEffect(() => { if (denied) onDenied(); }, [denied, onDenied]);

  function refresh() {
    setPreview(null);
    setVersion(value => value + 1);
  }

  async function run(route, payload, mode) {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    setError('');
    try {
      const data = await staffPrintRequest(owner, route, { requestId: id, ...payload }, { signal: controller.signal, file: Boolean(mode) });
      if (controller.signal.aborted) return;
      if (mode === 'preview') setPreview(URL.createObjectURL(data));
      else if (mode === 'download') downloadBlob(data, `lumibooth-${current.detail.request.code}.png`);
      else {
        if (route === 'staff-reprint') setRetryKey(crypto.randomUUID());
        refresh();
        onChange();
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      if ([401, 403].includes(failure.status)) onDenied();
      else {
        setError(failure.message);
        if ([404, 409].includes(failure.status)) {
          refresh();
          onChange();
        }
      }
    } finally {
      action.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const detail = current?.detail;
  return <section className="staff-print-detail" aria-label="Print request details">
    <div className="staff-print-heading">
      <h2>{detail?.request.code ?? 'Print request'}</h2>
      <button type="button" className="booth-link" disabled={busy} onClick={refresh}>Refresh request</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!current && <p role="status">Loading request…</p>}
    {current?.error && <p role="alert">{current.error.message}</p>}
    {detail && <PrintOrder key={`${id}-${detail.request.status}`} detail={detail} run={run} busy={busy} preview={preview} retryKey={retryKey} />}
  </section>;
}

function PrintOrder({ detail, run, busy, preview, retryKey }) {
  const { request, match, fileStatus, events, reprints } = detail;
  const { specification: spec, status } = request;
  const next = nextStage[status];
  const exceptions = exceptionStages[status] ?? [];
  const activeReprint = reprints.some(reprintActive);
  const track = next?.[0] === 'shipped';

  function progress(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    run('staff-transition', { status: next[0], expectedStatus: status, trackingReference: fields.get('trackingReference') || null });
  }

  return <>
    <p className="staff-print-status">{stageLabel(status)}</p>
    <dl className="staff-print-facts">
      <div><dt>Product</dt><dd>{spec.title} · {spec.variant}</dd></div>
      <div><dt>SKU</dt><dd>{spec.sku}</dd></div>
      <div><dt>Quantity</dt><dd>{request.quantity}</dd></div>
      <div><dt>PNG size</dt><dd>{spec.width_px} × {spec.height_px} px at {spec.target_dpi} DPI</dd></div>
      <div><dt>Trim size</dt><dd>{spec.width_px - 2 * spec.bleed_px} × {spec.height_px - 2 * spec.bleed_px} px</dd></div>
      <div><dt>Bleed</dt><dd>{spec.bleed_px} px per edge</dd></div>
      {spec.safe_inset_px != null && <div><dt>Safe area inset</dt><dd>{spec.safe_inset_px} px inside the trim</dd></div>}
      {request.shippingDeadline && <div><dt>Seller Center ship-by date</dt><dd>{request.shippingDeadline}</dd></div>}
      {request.trackingReference && <div><dt>Waybill or tracking reference</dt><dd>{request.trackingReference}</dd></div>}
    </dl>
    {match && <section>
      <h3>Seller Center match</h3>
      <p>Order {match.order_id}{match.line_id ? ` · Line ${match.line_id}` : ''}</p>
      <p>Allocated from unit {match.allocation_start} · {request.quantity} of {match.verified_line_quantity} units · {manilaTime(match.verified_at)}</p>
    </section>}
    {!match && ['awaiting_marketplace_order', 'needs_review'].includes(status) && <MatchForm request={request} run={run} busy={busy} />}
    <section>
      <h3>Print file</h3>
      {fileStatus === 'locked' && <p>The private print file is locked. It becomes available once staff verify the purchase.</p>}
      {fileStatus === 'missing' && <p role="alert">The print file is missing. Resolve the missing file before printing.</p>}
      {fileStatus === 'ready' && <>
        <div className="preview-actions">
          <button type="button" className="booth-button booth-secondary" disabled={busy || Boolean(preview)}
            onClick={() => run('staff-media', {}, 'preview')}>Load preview</button>
          <button type="button" className="booth-button booth-secondary" disabled={busy}
            onClick={() => run('staff-media', {}, 'download')}>Download print PNG</button>
        </div>
        {preview && <a href={preview} target="_blank" rel="noreferrer" aria-label="Open full-size print preview">
          <img className="staff-print-preview" src={preview} alt="Verified print file" />
        </a>}
      </>}
    </section>
    {(next || exceptions.length > 0) && <section>
      <h3>Fulfillment</h3>
      {activeReprint && <p>Finish or cancel the active reprint before advancing fulfillment.</p>}
      {next && <form onSubmit={progress}>
        {track && <label>Waybill or tracking reference (optional)
          <input name="trackingReference" maxLength="100" pattern={identifier} />
        </label>}
        <button className="booth-button" disabled={busy || activeReprint
          || (['print_ready', 'printing'].includes(next[0]) && fileStatus !== 'ready')}>{next[1]}</button>
      </form>}
      {exceptions.length > 0 && <details>
        <summary>Review, cancellation and refund</summary>
        <form onSubmit={event => {
          event.preventDefault();
          run('staff-transition', { ...Object.fromEntries(new FormData(event.currentTarget)), expectedStatus: status });
        }}>
          <label>Action<select name="status">{exceptions.map(value => <option key={value} value={value}>{stageLabel(value)}</option>)}</select></label>
          <label>Reason{reasonInput}</label>
          <p>Confirm cancellations and refunds in TikTok Seller Center before recording them here.</p>
          <button className="booth-button booth-secondary" disabled={busy}>Record exception</button>
        </form>
      </details>}
    </section>}
    {(reprints.length > 0 || (fileStatus === 'ready' && ['printing', 'packed', 'shipped', 'completed'].includes(status))) &&
      <Reprints jobs={reprints} canCreate={!activeReprint && fileStatus === 'ready'
        && ['printing', 'packed', 'shipped', 'completed'].includes(status)} quantity={request.quantity} run={run} busy={busy} retryKey={retryKey} />}
    <section>
      <h3>Recent activity</h3>
      <ol className="staff-print-history">{events.map(event => <li key={event.id}>
        <strong>{humanize(event.action)}</strong> · {manilaTime(event.occurred_at)}
        {event.actor_id && <small>Actor {event.actor_id}</small>}
        {(event.detail?.reason || event.detail?.reference || event.detail?.sellerCenterDate) &&
          <p>{event.detail.reason ?? event.detail.reference ?? event.detail.sellerCenterDate}</p>}
      </li>)}</ol>
    </section>
  </>;
}

function MatchForm({ request, run, busy }) {
  return <section>
    <h3>Match purchase</h3>
    <p>Check reference <strong>{request.code}</strong> and the purchased item in TikTok Seller Center.</p>
    <form onSubmit={event => {
      event.preventDefault();
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      run('staff-match', { ...fields, code: request.code, lineQuantity: Number(fields.lineQuantity),
        firstUnit: Number(fields.firstUnit), lineId: fields.lineId || null, shippingDeadline: fields.shippingDeadline || null,
        sellerCenterVerified: fields.sellerCenterVerified === 'on' });
    }}>
      <div className="staff-print-fields">
        <label>TikTok order ID<input name="orderId" required maxLength="80" pattern={identifier} /></label>
        <label>Seller Center line ID (if available)<input name="lineId" maxLength="80" pattern={identifier} /></label>
        <label>Purchased SKU<input name="sku" required maxLength="120" /></label>
        <label>Purchased variant<input name="variant" required maxLength="120" /></label>
        <label>Quantity on order line<input name="lineQuantity" type="number" required min="1" max="50" /></label>
        <label>First unit to allocate<input name="firstUnit" type="number" required defaultValue="1" min="1" max="50" /></label>
        <label>Seller Center ship-by date (optional)<input name="shippingDeadline" type="date" /></label>
      </div>
      <small>Use the first unallocated unit when splitting an order line across requests.</small>
      <label className="staff-print-check"><input type="checkbox" name="sellerCenterVerified" required />
        I verified the purchase is paid and the reference, SKU, variant and quantity match in TikTok Seller Center.
      </label>
      <button className="booth-button" disabled={busy}>Verify and match purchase</button>
    </form>
  </section>;
}

function Reprints({ jobs, canCreate, quantity, run, busy, retryKey }) {
  return <section>
    <h3>Reprints</h3>
    {jobs.map(job => {
      const update = (status, reason) => run('staff-reprint-update', { jobId: job.id, expectedStatus: job.status, status, reason });
      return <article className="staff-print-job" key={job.id}>
        <p><strong>{stageLabel(job.status)}</strong> · Qty {job.quantity} · {manilaTime(job.created_at)}</p>
        <p>{job.reason}</p>
        {reprintActive(job) && <>
          <button type="button" className="booth-button booth-secondary" disabled={busy}
            onClick={() => update(job.status === 'queued' ? 'printing' : 'completed')}>
            {job.status === 'queued' ? 'Start reprint' : 'Complete reprint'}
          </button>
          <details><summary>Cancel reprint</summary>
            <form onSubmit={event => {
              event.preventDefault();
              update('cancelled', new FormData(event.currentTarget).get('reason'));
            }}>
              <label>Cancellation reason{reasonInput}</label>
              <button className="booth-button booth-secondary" disabled={busy}>Confirm reprint cancellation</button>
            </form>
          </details>
        </>}
      </article>;
    })}
    {canCreate && <details>
      <summary>Queue a reprint</summary>
      <form onSubmit={event => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        run('staff-reprint', { retryKey, quantity: Number(fields.get('quantity')), reason: fields.get('reason') });
      }}>
        <label>Reprint quantity<input name="quantity" type="number" min="1" max={quantity} defaultValue="1" required /></label>
        <label>Reprint reason{reasonInput}</label>
        <button className="booth-button booth-secondary" disabled={busy}>Create reprint job</button>
      </form>
    </details>}
  </section>;
}
