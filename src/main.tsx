import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/atoms/ErrorBoundary';
import type { ErrorBoundaryFallbackProps } from './components/atoms/ErrorBoundary';
import { SectionErrorFallback } from './components/molecules/SectionErrorFallback';
import './styles/index.css';
import { FinancialStoreProvider } from './store/FinancialStoreProvider';
import { registerServiceWorker } from './serviceWorkerRegistration';
import { setupWebCrypto } from './utils/setupWebCrypto';

const applicationFallback = ({ error }: ErrorBoundaryFallbackProps) => (
  <SectionErrorFallback
    section="application"
    error={error}
    layout="full"
    actionLabel="Reload app"
    onRetry={() => window.location.reload()}
  />
);

setupWebCrypto();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary fallback={applicationFallback}>
        <FinancialStoreProvider>
          <App />
        </FinancialStoreProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
