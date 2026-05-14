import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PillWindow } from './pill/PillWindow';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root not found in pill.html');
}

createRoot(container).render(
  <StrictMode>
    <PillWindow />
  </StrictMode>,
);
