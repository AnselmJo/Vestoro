import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';
import './styles/global.css';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { ensureSeed } from './db/repo';

const root = ReactDOM.createRoot(document.getElementById('root')!);

ensureSeed()
  .then(() => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error('Vestoro: Initialisierung fehlgeschlagen', err);
    root.render(
      <div style={{ padding: 24, color: '#e8eaed', fontFamily: 'system-ui' }}>
        <h2>Initialisierung fehlgeschlagen</h2>
        <p>{String(err?.message ?? err)}</p>
        <p style={{ color: '#9aa0ab', fontSize: 13 }}>
          Details in der Browser-Konsole. Meist hilft: Seite neu laden, oder
          in den Browser-Einstellungen den Speicher für diese Seite leeren.
        </p>
      </div>,
    );
  });

