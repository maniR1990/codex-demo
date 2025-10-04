import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { FinancialStoreProvider } from './store/FinancialStoreProvider';
import { registerServiceWorker } from './serviceWorkerRegistration';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <FinancialStoreProvider>
        <App />
      </FinancialStoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
