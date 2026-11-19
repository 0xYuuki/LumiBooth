import './booth.css';
import '@fontsource/outfit/latin-300.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './studio.css'
const { default: App } = import.meta.env.MODE === 'staff'
  ? await import('./pages/staff/StaffApp.jsx')
  : await import('./App.jsx')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && import.meta.env.MODE !== 'staff' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}offline-worker.js`).catch(() => {
    // Local storage remains available when the browser disallows offline caching.
  });
}
