import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { accountAuth } from '../../online/lumiClient';
import { staffPrintRequest } from '../../commerce/commerceClient';
import StaffPrintDetail from './StaffPrintDetail';
import { manilaTime, printStatus, stageLabel } from './printStaffLabels';
import './staffPrint.css';

const dateFields = [['fromDate', 'From date'], ['throughDate', 'Through date']];

export default function WebStaffPrint() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let open = true;
    try {
      const { data: { subscription } } = accountAuth().onAuthStateChange((event, session) => {
        if (open) setUser(event !== 'PASSWORD_RECOVERY' && !session?.user.is_anonymous ? session?.user ?? null : null);
      });
      return () => { open = false; subscription.unsubscribe(); };
    } catch {
      queueMicrotask(() => { if (open) setUser(null); });
      return () => { open = false; };
    }
  }, []);

  return <div className="booth-shell">
    <BoothHeader step="STAFF FULFILLMENT" />
    <main className="booth-content staff-print">
      <h1 className="booth-title">Print orders</h1>
      {user === undefined ? <p role="status">Checking staff sign-in…</p> : user ? (
        <Queue key={user.id} owner={user.id} />
      ) : <p><Link to="/account">Sign in with your staff account</Link> to open the print queue.</p>}
    </main>
  </div>;
}

function Queue({ owner }) {
  const [query, setQuery] = useState({});
  const [pages, setPages] = useState([null]);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [selection, setSelection] = useState(null);
  const [denied, setDenied] = useState(false);
  const details = useRef(null);
  const page = pages.at(-1);

  useEffect(() => {
    const controller = new AbortController();
    staffPrintRequest(owner, 'staff-list', { ...query, ...page }, { signal: controller.signal })
      .then(({ requests }) => {
        if (!controller.signal.aborted) setResult({ requests, query, page, version });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        if ([401, 403].includes(error.status)) setDenied(true);
        else setResult({ error: error.message, query, page, version });
      });
    return () => controller.abort();
  }, [owner, query, page, version]);

  if (denied) return <p role="alert">An active staff role is required to access print orders.</p>;

  const current = result?.query === query && result.page === page && result.version === version ? result : null;
  const next = current?.requests?.at(-1);

  function select(requestId) {
    setSelection(requestId);
    if (window.matchMedia('(max-width: 760px)').matches) {
      requestAnimationFrame(() => details.current?.scrollIntoView());
    }
  }

  function filter(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setQuery(Object.fromEntries([...fields].map(([key, value]) => [key, value.trim() || null])));
    setPages([null]);
  }

  return <>
    <p className="booth-intro">Verify purchases in TikTok Seller Center before matching a request. Fulfillment updates here are recorded by staff.</p>
    <details className="staff-print-help">
      <summary>Missing or mismatched reference?</summary>
      <p>Hold the order in Seller Center until you have the correct LumiBooth reference, SKU and item quantity. If a request is already in this queue, mark it for review.</p>
    </details>
    <form className="staff-print-filters" onSubmit={filter}>
      <label>Reference or order ID<input name="lookup" maxLength="80" /></label>
      <label>SKU<input name="sku" maxLength="120" /></label>
      <label>Status<select name="status">
        <option value="">All statuses</option>
        {Object.entries(printStatus).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select></label>
      {dateFields.map(([field, name]) => <label key={field}>{name}<input name={field} type="date" /></label>)}
      <button className="booth-button booth-secondary" type="submit">Apply filters</button>
      <small>Dates use Philippine time.</small>
    </form>
    <div className="staff-print-workspace">
      <section aria-label="Print queue">
        <div className="staff-print-heading">
          <h2>Queue</h2>
          <button type="button" className="booth-link" onClick={() => setVersion(value => value + 1)}>Refresh queue</button>
        </div>
        {!current && <p role="status">Loading print requests…</p>}
        {current?.error && <p role="alert">{current.error}</p>}
        {current?.requests?.length === 0 && <p>No requests match these filters.</p>}
        {current?.requests?.length > 0 && <ul className="staff-print-list">
          {current.requests.map(item => <li key={item.requestId}>
            <button type="button" aria-pressed={selection === item.requestId}
              onClick={() => select(item.requestId)}>
              <strong>{item.code} <span>{stageLabel(item.status)}</span></strong>
              <span>{item.specification.title} · {item.specification.variant} · Qty {item.quantity}</span>
              <small>{item.orderId ? `TikTok ${item.orderId} · ` : ''}{manilaTime(item.createdAt)}</small>
            </button>
          </li>)}
        </ul>}
        {(pages.length > 1 || current?.requests?.length === 50) && <div className="preview-actions">
          <button className="booth-link" disabled={pages.length === 1 || !current} onClick={() => setPages(values => values.slice(0, -1))}>Previous page</button>
          <button className="booth-link" disabled={current?.requests?.length !== 50}
            onClick={() => setPages(values => [...values, { beforeCreated: next.createdAt, beforeId: next.requestId }])}>Next page</button>
        </div>}
      </section>
      <div ref={details}>{selection ? <StaffPrintDetail key={selection} id={selection} owner={owner}
        onChange={() => setVersion(value => value + 1)} onDenied={() => setDenied(true)} />
        : <p>Select a request to review its print specifications and fulfillment history.</p>}</div>
    </div>
  </>;
}
