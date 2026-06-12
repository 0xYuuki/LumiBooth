import React from 'react';
import { Plus } from 'lucide-react';

const TemplateManager = () => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Template Manager</h1>
        <button className="btn-primary">
          <Plus size={18} />
          New Template
        </button>
      </div>
      <div className="stats-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem' }}>
          <div style={{ width: 100, height: 140, border: '2px dashed var(--text-muted)', borderRadius: 8, marginBottom: '1rem' }}></div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>4-Grid Classic</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Active</p>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem' }}>
          <div style={{ width: 100, height: 140, border: '2px dashed var(--text-muted)', borderRadius: 8, marginBottom: '1rem' }}></div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>6-Grid Wide</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Active</p>
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;
