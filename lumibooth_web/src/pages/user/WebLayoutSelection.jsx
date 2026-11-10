import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { PhotoboothContext } from '../../context/photoboothContext';
import { layouts } from '../../context/photoboothSession';
import { BoothHeader, MiniStrip } from '../../components/BoothUI';

export default function WebLayoutSelection() {
  const navigate = useNavigate();
  const { dispatch } = useContext(PhotoboothContext);
  useEffect(() => { dispatch({ type: 'reset' }); }, [dispatch]);

  const selectLayout = (layout) => {
    dispatch({ type: 'start', layout });
    navigate('/camera');
  };

  return (
    <div className="booth-shell">
      <BoothHeader step="01 / LAYOUT" back="/" />
      <main className="booth-content">
        <p className="booth-eyebrow">STEP 01 OF 04</p>
        <h1 className="booth-title">Choose your layout.</h1>
        <p className="booth-intro">How many photos would you like on your strip?</p>
        <div className="layout-gallery">
          {layouts.map((layout) => (
            <button className="layout-tile" key={layout.id} onClick={() => selectLayout(layout)}>
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
