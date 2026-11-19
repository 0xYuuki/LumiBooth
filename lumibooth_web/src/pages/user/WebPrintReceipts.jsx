import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { printCatalog, refreshPrintReceipt, sameProduct, submitPrintIntent, tiktokListing } from '../../commerce/commerceClient';
import { forgetPrintReceipt, listPrintReceipts, loadPrintReceipt } from '../../commerce/printReceipts';

const labels = {
  local_pending: 'Upload pending',
  draft_upload: 'Upload pending',
  awaiting_marketplace_order: 'Awaiting store verification',
  needs_review: 'Needs store review',
  verified: 'Verified by staff',
  print_ready: 'Ready to print',
  printing: 'Printing',
  packed: 'Packed',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  expired: 'Expired',
};
const localPending = item => ['local_pending', 'draft_upload'].includes(item.status);
const readable = status => labels[status] ?? 'Status unavailable';

function Shell({ title, children, detail }) {
  return <div className="booth-shell">
    <BoothHeader step="PRINT ORDERS" />
    <main className="booth-content print-order">
      <Link className="booth-link" to={detail ? '/print-orders' : '/'}>{detail ? 'All print orders' : 'Back to photo booth'}</Link>
      <h1 className="booth-title">{title}</h1>
      {children}
    </main>
  </div>;
}

export function WebPrintReceiptList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let open = true;
    listPrintReceipts().then(records => {
      if (open) setItems(records);
    }).catch(() => {
      if (open) setError('Could not open print orders from this browser.');
    });
    return () => { open = false; };
  }, []);

  return <Shell title="Print orders">
    <p className="booth-intro">Receipts are saved in this browser. Clearing site data removes access to these receipts.</p>
    {error ? <p role="alert">{error}</p> : items === null ? <p role="status">Loading print orders…</p> : items.length === 0 ? (
      <p>No print requests on this browser yet.</p>
    ) : <ul className="print-receipt-list">
      {items.map(item => <li key={item.localId}>
        <Link to={`/print-orders/${item.localId}`}>{item.product.title} — {item.product.variant}</Link>
        <small>{item.code ? `${item.code} · ` : ''}{readable(item.status)}</small>
      </li>)}
    </ul>}
  </Shell>;
}

export function WebPrintReceipt() {
  const { id } = useParams();
  return <PrintReceipt key={id} id={id} />;
}

function PrintReceipt({ id }) {
  const location = useLocation();
  const navigate = useNavigate();
  const codeField = useRef(null);
  const [item, setItem] = useState(undefined);
  const [error, setError] = useState(location.state?.error ?? '');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [notice, setNotice] = useState('');
  const action = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    let open = true;
    active.current = true;
    loadPrintReceipt(id).then(record => {
      if (!open) return;
      setItem(record ?? null);
      if (record && !localPending(record)) setError('');
    }).catch(() => {
      if (open) {
        setItem(null);
        setError('Could not open this receipt from your browser.');
      }
    });
    return () => { open = false; active.current = false; };
  }, [id]);

  async function run(operation) {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setProgress(null);
    try {
      const receipt = await operation();
      if (receipt && active.current) setItem(receipt);
    } catch (reason) {
      if (active.current) setError(reason.message || 'Could not complete this request.');
    } finally {
      action.current = false;
      if (active.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  }

  function openTikTok() {
    void run(async () => {
      const receipt = await refreshPrintReceipt(item);
      if (!active.current) return;
      setItem(receipt);
      if (receipt.status !== 'awaiting_marketplace_order') throw new Error('This print request is no longer waiting for checkout.');
      const products = await printCatalog();
      const current = products.find(product => product.id === item.product.id);
      const link = current && tiktokListing(current.tiktok_url);
      if (!link || !sameProduct(receipt.specification, current)) {
        throw new Error('The listing or checkout details changed. Contact the store before placing an order.');
      }
      if (active.current) window.location.assign(link);
      return receipt;
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.code);
      setNotice('Reference copied.');
    } catch {
      codeField.current?.focus();
      codeField.current?.select();
      setNotice('Select and copy the reference shown above.');
    }
  }

  async function forget() {
    if (!window.confirm('Remove this unfinished receipt and its print file from this browser? Any server request can still expire automatically.')) return;
    await run(async () => {
      await forgetPrintReceipt(id);
      if (active.current) navigate('/print-orders', { replace: true });
    });
  }

  return <Shell title="Print receipt" detail>
    {item === undefined && <p role="status">Loading receipt…</p>}
    {item === null && !error && <p>This receipt is unavailable in this browser.</p>}
    {item && <div className="print-receipt">
      <h2>{item.product.title} — {item.product.variant}</h2>
      <p>Quantity {item.quantity} · {readable(item.status)}</p>
      {localPending(item) ? <>
        <p>Your upload is unfinished. You can retry with the saved print file.</p>
        <div className="preview-actions">
          <button className="booth-button" disabled={busy} onClick={() => run(() => submitPrintIntent(item, setProgress))}>Retry upload</button>
          <button className="booth-link" disabled={busy} onClick={forget}>Remove local draft</button>
        </div>
      </> : <>
        {item.code && <div className="preview-actions">
          <label>Print reference
            <input ref={codeField} value={item.code} readOnly onFocus={event => event.currentTarget.select()} />
          </label>
          <button className="booth-button booth-secondary" onClick={copy}>Copy code</button>
        </div>}
        {item.status === 'awaiting_marketplace_order' && <>
          <p>The store has yet to confirm this order. Complete checkout and send the reference using the store’s instructions.</p>
          <p className="print-order-instructions">{item.specification?.buyer_instructions}</p>
          <p>Price, delivery fees and payment are shown in TikTok Shop. Return to Print orders in this browser to check your request.</p>
          {item.expiresAt && <p>Print request expires {new Date(item.expiresAt).toLocaleString()}.</p>}
          <button className="booth-button" disabled={busy} onClick={openTikTok}>Open TikTok Shop</button>
        </>}
        {item.status === 'expired' && <p>This request expired. If you already purchased, contact the store before placing another order.</p>}
        {item.requestId && <button className="booth-link" disabled={busy} onClick={() => run(() => refreshPrintReceipt(item))}>Refresh status</button>}
      </>}
      {progress !== null && <progress aria-label="Print upload progress" max="100" value={progress} />}
      {busy && <p role="status">{progress === null ? 'Checking print request…' : progress < 100 ? `Uploading print PNG… ${progress}%` : 'Confirming the uploaded file…'}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>}
    {error && <p role="alert">{error}</p>}
  </Shell>;
}
