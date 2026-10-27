import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { RoleProvider } from './contexts/RoleContext.js';
import { StaffProvider } from './contexts/StaffContext.js';
import { ToastProvider } from './components/Toast.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RoleProvider>
        <StaffProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </StaffProvider>
      </RoleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
