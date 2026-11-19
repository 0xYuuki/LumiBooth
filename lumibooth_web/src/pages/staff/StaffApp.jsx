import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { commerceEnabled } from '../../online/lumiClient';
import WebAccount from '../user/WebAccount';
import WebStaffPrint from './WebStaffPrint';

export default function StaffApp() {
  if (!commerceEnabled) return <main className="booth-content"><h1>Staff print orders unavailable</h1></main>;

  return <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route path="/" element={<WebStaffPrint />} />
      <Route path="/admin/print-orders" element={<Navigate to="/" replace />} />
      <Route path="/account" element={<WebAccount staffOnly />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>;
}
