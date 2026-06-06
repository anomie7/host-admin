import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SidePanelProvider } from './context/SidePanelContext';
import { CanvasProvider } from './context/CanvasContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SidePanelProvider>
        <CanvasProvider>
          <App />
        </CanvasProvider>
      </SidePanelProvider>
    </BrowserRouter>
  </React.StrictMode>
);
