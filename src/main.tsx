import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';
import './styles/global.css';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { SetupWizard } from './app/SetupWizard';
import { ensureSeed, getSetting } from './db/repo';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Ask the browser to not evict our IndexedDB data under storage pressure or
// after periods of inactivity (Safari in particular is aggressive here).
// This is best-effort and silently unsupported in some browsers — the JSON
// backup in Einstellungen remains the actual safety net regardless.
async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* not supported — ignore */
  }
}

function renderApp(demoMode: boolean) {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App initialDemoMode={demoMode} />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

async function bootstrap(): Promise<void> {
  await ensureSeed();
  void requestPersistentStorage();
  const setupDone = await getSetting<boolean>('setupDone');
  if (!setupDone) {
    root.render(
      <React.StrictMode>
        <SetupWizard onDone={renderApp} />
      </React.StrictMode>,
    );
    return;
  }
  const demoMode = (await getSetting<boolean>('demoMode')) ?? false;
  renderApp(demoMode);
}

bootstrap().catch((err) => {
  console.error('Vestoro: Initialisierung fehlgeschlagen', err);
  root.render(
    <div style={{ padding: 24, color: '#e9ebee', fontFamily: 'system-ui' }}>
      <h2>Initialisierung fehlgeschlagen</h2>
      <p>{String(err?.message ?? err)}</p>
      <p style={{ color: '#969ca8', fontSize: 13 }}>
        Details in der Browser-Konsole. Meist hilft: Seite neu laden, oder in den
        Browser-Einstellungen den Speicher für diese Seite leeren.
      </p>
    </div>,
  );
});
