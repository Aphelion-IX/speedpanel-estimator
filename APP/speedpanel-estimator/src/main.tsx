import React from 'react';
import './index.css';
import { createRoot } from 'react-dom/client';
import SpeedpanelEstimator from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SpeedpanelEstimator />
  </React.StrictMode>,
);
