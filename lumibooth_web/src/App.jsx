import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Outlet } from 'react-router-dom';
import { Camera, LayoutTemplate, Printer, Users, Settings } from 'lucide-react';
import DashboardOverview from './pages/DashboardOverview';
import TemplateManager from './pages/TemplateManager';
import PrintLogs from './pages/PrintLogs';
import WebWelcome from './pages/user/WebWelcome';
import WebLayoutSelection from './pages/user/WebLayoutSelection';
import WebCamera from './pages/user/WebCamera';
import WebEditor from './pages/user/WebEditor';
import WebPreview from './pages/user/WebPreview';
import { PhotoboothProvider } from './context/PhotoboothContext';
import './index.css';

const AdminLayout = () => {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <Camera className="brand-icon" size={28} />
          LumiBooth Admin
        </div>
        <nav className="nav-menu">
          <NavLink to="/admin" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutTemplate size={20} />
            Overview
          </NavLink>
          <NavLink to="/admin/templates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Camera size={20} />
            Templates
          </NavLink>
          <NavLink to="/admin/logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Printer size={20} />
            Print Logs
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            Users
          </NavLink>
          <div style={{ flex: 1 }}></div>
          <NavLink to="/admin/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            Settings
          </NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

const App = () => {
  return (
    <PhotoboothProvider>
      <Router>
        <Routes>
          {/* User Photobooth App */}
          <Route path="/" element={<WebWelcome />} />
          <Route path="/layout" element={<WebLayoutSelection />} />
          <Route path="/camera" element={<WebCamera />} />
          <Route path="/editor" element={<WebEditor />} />
          <Route path="/preview" element={<WebPreview />} />

          {/* Admin Dashboard */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="templates" element={<TemplateManager />} />
            <Route path="logs" element={<PrintLogs />} />
            <Route path="*" element={<div className="page-title">Coming Soon</div>} />
          </Route>
        </Routes>
      </Router>
    </PhotoboothProvider>
  );
};

export default App;
