import { useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { PhotoboothContext } from '../../context/photoboothContext';
import { layouts } from '../../context/photoboothSession';
import { BoothHeader, BoothStep, MiniStrip } from '../../components/BoothUI';

export default function WebLayoutSelection() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, dispatch } = useContext(PhotoboothContext);

  const selectLayout = (layout) => {
    const source = params.get('source') ?? session?.source ?? 'camera';
    dispatch({ type: session ? 'changeLayout' : 'start', layout, source });
    navigate(source === 'gallery' || session?.photos.length >= layout.count ? '/gallery' : '/camera');
  };

  return (
    <div className="booth-shell">
      <BoothHeader step="01 / LAYOUT" />
      <main className="booth-content">
        <BoothStep number={1} back="/" />
        <h1 className="booth-title">Choose your layout.</h1>
        <p className="booth-intro">How many photos would you like on your strip?</p>
        <div className="layout-gallery">
          {layouts.map((layout) => (
            <button className="layout-tile" key={layout.id} aria-pressed={session?.layout.id === layout.id} onClick={() => selectLayout(layout)}>
              <span className="layout-art"><MiniStrip count={layout.count} columns={layout.columns} /></span>
              <strong>{layout.name}</strong>
              <span>{layout.count} {layout.count === 1 ? 'photo' : 'photos'}</span>
              <ArrowUpRight size={16} className="tile-arrow" aria-hidden="true" />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
