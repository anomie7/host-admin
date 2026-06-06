import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CanvasProvider } from './context/CanvasContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CanvasProvider>
        <App />
      </CanvasProvider>
    </BrowserRouter>
  </React.StrictMode>
);
