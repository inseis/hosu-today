import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { basePath, site } from './config/site';
import '../tokens.css';
import './styles/app.css';

document.title = site.name;
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basePath.replace(/\/$/, '') || '/'}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
