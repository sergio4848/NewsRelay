import { createRoot } from 'react-dom/client';
import { App } from './App';
import { type DesktopBridge } from '../core/model';
import './style.css';
declare global {
  interface Window {
    newsrelay: DesktopBridge;
  }
}
createRoot(document.getElementById('root')!).render(<App />);
