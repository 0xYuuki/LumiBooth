import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { printCatalog, sameProduct, submitPrintIntent } from '../../commerce/commerceClient';
import { defaultPrintCrop, drawPrint, encodePrint, printPlacement, printQuality } from '../../commerce/printImage';
import { newPrintIntent, storePrintIntent } from '../../commerce/printReceipts';
import { PhotoboothContext } from '../../context/photoboothContext';
import { PrivacyInformationLink } from './WebLegal';

export default function WebPrintOrder() {
  const { session } = useContext(PhotoboothContext);
  const navigate = useNavigate();
  const canvas = useRef(null);
  const active = useRef(false);
  const sending = useRef(false);
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState('');
  const [catalog, setCatalog] = useState({ products: null, error: '' });
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [productId, setProductId] = useState('');
  const [crop, setCrop] = useState(defaultPrintCrop);
  const [units, setUnits] = useState(1);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const product = catalog.products?.find(item => item.id === productId) ?? catalog.products?.[0];
  const size = image && { width: image.naturalWidth, height: image.naturalHeight };
  const quality = product && size && printQuality(session.printDensity, printPlacement(size, product, crop), product);
  const validQuantity = product && Number.isInteger(Number(units)) && Number(units) >= 1 && Number(units) <= product.max_quantity;

  function guideInset(inset) {
    return `${100 * inset / product.height_px}% ${100 * inset / product.width_px}%`;
  }

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    let open = true;
    const source = new Image();
    source.src = session.output;
    source.decode().then(() => {
      if (open) setImage(source);
    }).catch(() => {
      if (open) setImageError('Could not open this strip. Return to Finish and export it again.');
    });
    return () => { open = false; };
  }, [session.output]);

  useEffect(() => {
    let open = true;
    printCatalog().then(products => {
      if (open) setCatalog({ products, error: '' });
    }).catch(reason => {
      if (open) setCatalog({ products: [], error: reason.message });
    });
    return () => { open = false; };
  }, [catalogVersion]);

  useLayoutEffect(() => {
    if (image && product) drawPrint(canvas.current, image, product, crop);
  }, [image, product, crop]);

  function reloadCatalog() {
    setCatalog({ products: null, error: '' });
    setConsent(false);
    setCatalogVersion(value => value + 1);
  }

  function selectProduct(id) {
    setProductId(id);
    setCrop(defaultPrintCrop);
    setUnits(1);
    setConsent(false);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (sending.current || !quality || quality.blocked || !validQuantity || !consent) return;
    sending.current = true;
    setBusy(true);
    setProgress(null);
    setError('');
    let stored;
    let failure = '';
    try {
      const products = await printCatalog();
      if (!active.current) return;
      if (!sameProduct(product, products.find(item => item.id === product.id))) {
        setCatalog({ products, error: '' });
        selectProduct('');
        throw new Error('The product details changed. Review the current selection before continuing.');
      }
      const png = await encodePrint(canvas.current, product.max_png_bytes);
      if (!active.current) return;
      const intent = newPrintIntent(product, Number(units));
      await storePrintIntent(intent, png);
      stored = intent;
      await submitPrintIntent(intent, value => {
        if (active.current) setProgress(value);
      });
    } catch (reason) {
      failure = reason.message || 'Could not prepare the print request.';
    } finally {
      sending.current = false;
      if (active.current) {
        setBusy(false);
        if (stored) navigate(`/print-orders/${stored.localId}`, { replace: true, state: { error: failure } });
        else setError(failure);
      }
    }
  }

  return (
    <div className="booth-shell">
      <BoothHeader step="ORDER PRINT" />
      <main className="booth-content print-order">
        <div className="preview-actions">
          <Link className="booth-link" to="/preview">Back to finished strip</Link>
          <Link className="booth-link" to="/print-orders">Print orders</Link>
        </div>
        <h1 className="booth-title">Order Print</h1>
        <p className="booth-intro">Choose what to print and check the crop before submitting.</p>
        {catalog.products === null && <p role="status">Loading print products…</p>}
        {catalog.error && <div>
          <p role="alert">{catalog.error}</p>
          <button className="booth-link" onClick={reloadCatalog}>Retry products</button>
        </div>}
        {catalog.products?.length === 0 && !catalog.error && <p>Print ordering is currently unavailable.</p>}
        {imageError && <p role="alert">{imageError}</p>}
        {product && <div className="print-order-grid">
          <section aria-labelledby="print-preview-title" className="print-order-preview">
            <h2 id="print-preview-title">Print preview</h2>
            {!image && !imageError && <p role="status">Preparing preview…</p>}
            <div className="print-order-art" style={{ '--print-aspect': product.width_px / product.height_px }}>
              <canvas ref={canvas} role="img" aria-label="Cropped print preview" />
              {product.bleed_px > 0 && <div className="print-order-trim" aria-hidden="true"
                style={{ inset: guideInset(product.bleed_px) }} />}
              {product.safe_inset_px > 0 && <div className="print-order-safe" aria-hidden="true"
                style={{ inset: guideInset(product.bleed_px + product.safe_inset_px) }} />}
            </div>
            <p>{product.width_px} × {product.height_px} pixels{product.bleed_px ? ` · ${product.bleed_px}px bleed on each edge` : ''}</p>
            {product.bleed_px > 0 && <small>The dashed line shows the trim edge. </small>}
            {product.safe_inset_px > 0 && <small>Keep important details inside the dotted safe area.</small>}
          </section>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>Product and variant
                <select value={product.id} onChange={event => selectProduct(event.target.value)}>
                  {catalog.products.map(item => <option key={item.id} value={item.id}>{item.title} — {item.variant}</option>)}
                </select>
              </label>
              <label>Quantity
                <input type="number" min="1" max={product.max_quantity} step="1" required value={units}
                  onChange={event => { setUnits(event.target.value); setConsent(false); }} />
              </label>
              <div className="print-order-crop" aria-label="Crop controls">
                {[['zoom', 'Zoom', 1, 2.5, 0.05], ['x', 'Horizontal position', 0, 100, 1], ['y', 'Vertical position', 0, 100, 1]]
                  .map(([key, label, min, max, step]) => <label key={key}>{label}
                    <input type="range" min={min} max={max} step={step} value={crop[key]}
                      onChange={event => setCrop(value => ({ ...value, [key]: Number(event.target.value) }))} />
                  </label>)}
                <button type="button" className="booth-link" onClick={() => setCrop(defaultPrintCrop)}>Reset crop</button>
              </div>
              {quality?.warning && <p role="status" className="print-order-warning">
                {quality.dpi === null ? 'Source photo resolution could not be measured.' :
                  `Estimated source detail is ${quality.dpi} DPI at this crop. The target is ${product.target_dpi} DPI.`}
                {quality.blocked ? ` Use a crop or photo that meets the ${product.minimum_dpi} DPI minimum.` : ' The print may look soft.'}
              </p>}
              <p>Price, delivery fees and payment are shown in TikTok Shop.</p>
              <p id="print-consent-text">{product.consent_text}</p>
              <PrivacyInformationLink />
              <label className="print-order-consent">
                <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}
                  aria-describedby="print-consent-text" />
                Upload this print PNG for private print fulfillment
              </label>
              <button className="booth-button" disabled={!consent || !quality || quality.blocked || !validQuantity}>
                Confirm and upload
              </button>
            </fieldset>
            {busy && <div role="status" className="print-order-progress">
              {progress === null ? 'Preparing your print request…' : progress < 100 ? `Uploading print PNG… ${progress}%` : 'Confirming the uploaded file…'}
              <progress aria-label="Print upload progress" max="100" value={progress ?? undefined} />
            </div>}
            {error && <p role="alert">{error}</p>}
          </form>
        </div>}
      </main>
    </div>
  );
}
