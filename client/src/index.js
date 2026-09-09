import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Styles
import 'bootstrap/dist/css/bootstrap.min.css'; // Utility classes only (text-center, mb-3, etc.)
import 'bootstrap-icons/font/bootstrap-icons.css';

// Importation du Design System
import '@frhamon/design-system/dist/index.css';
import { ToastProvider } from '@frhamon/design-system';

import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  </React.StrictMode>
);
