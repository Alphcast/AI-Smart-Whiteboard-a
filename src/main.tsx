import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Workbox Service Worker in production to cache assets and enable offline capability
if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[Workbox PWA] New version ready for AI Smart Whiteboard.');
    },
    onOfflineReady() {
      console.log('[Workbox PWA] AI Smart Whiteboard cached & ready for offline operation.');
    },
    onRegistered(r) {
      console.log('[Workbox PWA] Service worker registered successfully:', r?.scope);
    },
    onRegisterError(error) {
      console.warn('[Workbox PWA] Service worker registration failed:', error);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);

