import React from 'react';
import { Camera, Users, Printer } from 'lucide-react';

const DashboardOverview = () => {
  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-icon pink"><Camera /></div>
          <div className="stat-info">
            <h3>Photos Taken</h3>
            <p>1,248</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon blue"><Users /></div>
          <div className="stat-info">
            <h3>Active Sessions</h3>
            <p>42</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon purple"><Printer /></div>
          <div className="stat-info">
            <h3>Strips Printed</h3>
            <p>856</p>
          </div>
        </div>
      </div>
      <div className="card">
        <h2 className="card-header">Recent Activity</h2>
        <p style={{color: 'var(--text-muted)'}}>No recent activity to display.</p>
      </div>
    </div>
  );
};

export default DashboardOverview;
