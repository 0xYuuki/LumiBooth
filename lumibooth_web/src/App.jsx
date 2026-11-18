import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { Camera, LayoutTemplate, Printer } from 'lucide-react';
import DashboardOverview from './pages/DashboardOverview';
import TemplateManager from './pages/TemplateManager';
import PrintLogs from './pages/PrintLogs';
import WebWelcome from './pages/user/WebWelcome';
import WebGallerySelection from './pages/user/WebGallerySelection';
import WebCamera from './pages/user/WebCamera';
import WebEditor from './pages/user/WebEditor';
import { WebSavedWork, WebWorks } from './pages/user/WebWorks';
import WebLegal from './pages/user/WebLegal';
import WebUploads from './pages/user/WebUploads';
import WebPreview from './pages/user/WebPreview';
import { PhotoboothProvider } from './context/PhotoboothProvider';
import { PhotoboothContext } from './context/photoboothContext';
import { requiredPhotos } from './context/photoboothSession';
import { accountsEnabled, backupsEnabled, printToPlayEnabled, remoteBoothEnabled } from './online/lumiClient';
import WebBackup from './pages/user/WebBackup';
import WebAccount from './pages/user/WebAccount';
import SharedStrip from './online/SharedStrip';
import PrintLinks from './online/PrintLinks';
import RemoteBooth from './online/RemoteBooth';

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
        </nav>
      </aside>
      <main className="main-content">
        <p className="admin-demo-note">Demo data only</p>
        <Outlet />
      </main>
    </div>
  );
};

function GuestStep({ step, children }) {
  const { session } = useContext(PhotoboothContext);
  if (!session) return <Navigate to="/" replace />;

  const complete = session.photos.length === requiredPhotos(session.layout);
  if (!['camera', 'review'].includes(step) && !complete) return <Navigate to="/gallery" replace />;
  if (step === 'preview' && !session.output) return <Navigate to="/editor" replace />;
  return children;
}

const App = () => {
  return (
    <PhotoboothProvider>
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          {/* User Photobooth App */}
          <Route path="/" element={<WebWelcome />} />
          {accountsEnabled && <Route path="/account" element={<WebAccount />} />}
          {backupsEnabled && <>
            <Route path="/backup" element={<WebBackup />} />
            <Route path="/uploads/backup" element={<WebBackup uploads />} />
          </>}
          <Route path="/uploads" element={<WebUploads />} />
          <Route path="/legal" element={<WebLegal />} />
          <Route path="/works" element={<WebWorks />} />
          <Route path="/works/:id" element={<WebSavedWork />} />
          <Route path="/layout" element={<Navigate to="/gallery" replace />} />
          <Route path="/gallery" element={<GuestStep step="review"><WebGallerySelection /></GuestStep>} />
          <Route path="/camera" element={<GuestStep step="camera"><WebCamera /></GuestStep>} />
          <Route path="/editor" element={<GuestStep step="editor"><WebEditor /></GuestStep>} />
          <Route path="/preview" element={<GuestStep step="preview"><WebPreview /></GuestStep>} />
          <Route path="/p" element={<SharedStrip />} />
          {printToPlayEnabled && <Route path="/print-links" element={<PrintLinks />} />}
          {remoteBoothEnabled && <Route path="/room" element={<RemoteBooth />} />}

          {/* Admin Dashboard */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="templates" element={<TemplateManager />} />
            <Route path="logs" element={<PrintLogs />} />
            <Route path="*" element={<div className="page-title">Page unavailable</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </PhotoboothProvider>
  );
};

export default App;
