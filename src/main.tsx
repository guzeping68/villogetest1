import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';

const clearNativeWebAssetCaches = () => {
  if (!Capacitor.isNativePlatform()) return;
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch(() => {});
  }

  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
};

clearNativeWebAssetCaches();
window.addEventListener(
  'load',
  () => {
    clearNativeWebAssetCaches();
    window.setTimeout(clearNativeWebAssetCaches, 1000);
    window.setTimeout(clearNativeWebAssetCaches, 4000);
  },
  { once: true },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
