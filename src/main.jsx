import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

let updateSW;
updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW?.(true);
  },
  onRegisteredSW(_, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), 5 * 60 * 1000);
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
