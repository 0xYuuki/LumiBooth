import React from 'react';
import { useNavigate } from 'react-router-dom';

const WebPreview = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-light)' }}>
      <div style={{ fontSize: '80px', marginBottom: '20px' }}>✅</div>
      <h1 className="page-title" style={{ textAlign: 'center' }}>Your photo strip is ready!</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '40px', textAlign: 'center' }}>
        You can now save this to your device or send it to the printer.
      </p>
      
      <div style={{ display: 'flex', gap: '20px', flexDirection: 'column', width: '100%', maxWidth: '300px' }}>
        <button className="btn-primary" style={{ justifyContent: 'center', padding: '1rem' }}>
          <span style={{ fontSize: '20px' }}>💾</span> Save to Device
        </button>
        <button className="btn-primary" style={{ background: 'var(--primary-blue)', justifyContent: 'center', padding: '1rem' }}>
          <span style={{ fontSize: '20px' }}>🖨️</span> Print Photo
        </button>
      </div>
      
      <button 
        onClick={() => navigate('/')} 
        style={{ marginTop: '40px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
        Go back Home
      </button>
    </div>
  );
};

export default WebPreview;
