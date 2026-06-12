import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoboothContext } from '../../context/PhotoboothContext';

const WebLayoutSelection = () => {
  const navigate = useNavigate();
  const { setLayout, setPhotos } = useContext(PhotoboothContext);

  const layouts = [
    { id: '1-photo', name: 'Single Photo', count: 1 },
    { id: '2-photo', name: 'Dual Strip', count: 2 },
    { id: '4-grid', name: '4-Grid Classic', count: 4 },
    { id: '6-grid', name: '6-Grid Wide', count: 6 },
  ];

  const handleSelect = (layout) => {
    setLayout(layout);
    setPhotos([]);
    navigate('/camera');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1 className="page-title">Select Template</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '3rem' }}>Choose a layout for your photo strip</p>
      
      <div className="stats-grid">
        {layouts.map(layout => (
          <div 
            key={layout.id} 
            className="card" 
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => handleSelect(layout)}
          >
            <div style={{ width: 80, height: 120, border: '2px dashed var(--primary-pink)', borderRadius: 8, marginBottom: '1rem', backgroundColor: 'rgba(255,182,193,0.1)' }}></div>
            <h3 style={{ fontSize: '1.1rem' }}>{layout.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{layout.count} Photos</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WebLayoutSelection;
