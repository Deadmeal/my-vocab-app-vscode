import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Make sure this file exists for Tailwind
import AppWrapper from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);