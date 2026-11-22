import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, Inbox, PackageCheck, RefreshCw, Search, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
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

  if (user === null) return <Navigate to="/account" replace />;
  if (user === undefined) return <div className="booth-shell staff-shell">
    <BoothHeader step="STAFF SIGN-IN" />
    <main className="booth-account"><p role="status">Checking staff sign-in…</p></main>
  </div>;

  return <div className="booth-shell staff-shell">
    <BoothHeader step="STAFF FULFILLMENT">
      <Link className="booth-link staff-account-link" to="/account"><UserRound size={16} aria-hidden="true" /> Staff account</Link>
    </BoothHeader>
    <main className="booth-content staff-print">
      <header className="staff-page-heading">
        <div><p className="staff-eyebrow"><ShieldCheck size={14} aria-hidden="true" /> STAFF WORKSPACE</p>
          <h1>Print orders</h1><p>From a little keepsake to a finished print.</p></div>
        <span className="staff-workspace-label"><PackageCheck size={16} aria-hidden="true" /> Fulfillment workspace</span>
      </header>
      <Queue key={user.id} owner={user.id} />
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
  const filters = useRef(null);
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

  const activeFilters = Object.values(query).some(Boolean);
  function clearFilters() {
    filters.current?.reset();
    setQuery({});
    setPages([null]);
  }

  return <>
    <section className="staff-workflow" aria-label="Fulfillment steps">
      <div><span><Search size={18} aria-hidden="true" /></span><p><strong>01 · Find the request</strong><small>Search the customer's reference</small></p></div>
      <ArrowRight className="staff-workflow-arrow" size={16} aria-hidden="true" />
      <div><span><CheckCircle2 size={18} aria-hidden="true" /></span><p><strong>02 · Verify the purchase</strong><small>Match it in TikTok Seller Center</small></p></div>
      <ArrowRight className="staff-workflow-arrow" size={16} aria-hidden="true" />
      <div><span><PackageCheck size={18} aria-hidden="true" /></span><p><strong>03 · Print & fulfill</strong><small>Download the file and update progress</small></p></div>
    </section>
    <section className="staff-filter-panel" aria-labelledby="staff-filter-title">
      <div className="staff-panel-heading"><h2 id="staff-filter-title"><SlidersHorizontal size={17} aria-hidden="true" /> Find an order</h2>
        <button className="booth-link" type="button" disabled={!activeFilters} onClick={clearFilters}>Clear filters</button></div>
    <form ref={filters} className="staff-print-filters" onSubmit={filter}>
      <label>Reference or order ID<input name="lookup" maxLength="80" placeholder="Reference or TikTok order ID" /></label>
      <label>SKU<input name="sku" maxLength="120" placeholder="Any SKU" /></label>
      <label>Status<select name="status">
        <option value="">All statuses</option>
        {Object.entries(printStatus).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select></label>
      {dateFields.map(([field, name]) => <label key={field}>{name}<input name={field} type="date" /></label>)}
      <button className="booth-button" type="submit"><Search size={16} aria-hidden="true" /> Apply filters</button>
      <small>Dates use Philippine time.</small>
    </form>
    </section>
    <div className="staff-print-workspace">
      <section className="staff-queue-panel" aria-label="Print queue">
        <div className="staff-print-heading">
          <h2><ClipboardList size={18} aria-hidden="true" /> Queue {current?.requests && <span className="staff-count" title="Requests on this page">{current.requests.length}</span>}</h2>
          <button type="button" className="booth-link" disabled={!current} onClick={() => setVersion(value => value + 1)}><RefreshCw size={15} aria-hidden="true" /> Refresh queue</button>
        </div>
        {!current && <div className="staff-state" role="status"><RefreshCw size={26} aria-hidden="true" /><h3>Loading print requests…</h3><p>Getting the latest queue.</p></div>}
        {current?.error && <div className="staff-state staff-state-error" role="alert">
          <AlertCircle size={28} aria-hidden="true" /><h3>We couldn't load the queue</h3>
          <p>{current.error}</p><p>Your orders have not been changed.</p>
          <button type="button" className="booth-button booth-secondary" onClick={() => setVersion(value => value + 1)}>Try again</button>
        </div>}
        {current?.requests?.length === 0 && <div className="staff-state"><Inbox size={30} aria-hidden="true" />
          <h3>{activeFilters ? 'No matching requests' : 'Your queue is clear'}</h3>
          <p>{activeFilters ? 'No requests match these filters.' : 'New print requests will appear here when customers submit their designs.'}</p>
          {activeFilters && <button type="button" className="booth-link" onClick={clearFilters}>Show all requests</button>}
        </div>}
        {current?.requests?.length > 0 && <ul className="staff-print-list">
          {current.requests.map(item => <li key={item.requestId}>
            <button type="button" aria-pressed={selection === item.requestId}
              onClick={() => select(item.requestId)}>
              <strong>{item.code} <span className="staff-status-badge" data-status={item.status}>{stageLabel(item.status)}</span></strong>
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
      <div className="staff-details-panel" ref={details}>{selection ? <StaffPrintDetail key={selection} id={selection} owner={owner}
        onChange={() => setVersion(value => value + 1)} onDenied={() => setDenied(true)} />
        : <section className="staff-detail-placeholder" aria-label="Order details">
          <span className="staff-placeholder-icon"><ClipboardList size={30} aria-hidden="true" /></span>
          <p className="staff-eyebrow">ORDER DETAILS</p><h2>A closer look at every print.</h2>
          <p>Select a request to review its print specifications and fulfillment history.</p>
          <div className="staff-detail-tags"><span>Purchase verification</span><span>Print-ready file</span><span>Activity history</span></div>
        </section>}</div>
    </div>
    <details className="staff-print-help">
      <summary>Missing or mismatched reference?</summary>
      <p>Hold the order in Seller Center until you have the correct LumiBooth reference, SKU and item quantity. If a request is already in this queue, mark it for review.</p>
    </details>
    <p className="staff-footer-note"><ShieldCheck size={14} aria-hidden="true" /> Verify purchases in TikTok Seller Center before matching. Fulfillment changes are recorded in the activity history.</p>
  </>;
}
