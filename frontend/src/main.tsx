
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Order matters: fonts + tokens/base first, then every component and page stylesheet (pulled in by App).
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './styles/globals.css';
import { App } from './app/App';

async function enableMocking() {
  const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';
  if (import.meta.env.DEV && useMocks) {
    const { worker } = await import('./mocks/browser');
    await worker.start();
  } else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});