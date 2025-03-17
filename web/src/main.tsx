import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
// Import API configuration to ensure it's loaded before any API calls
import '@/lib/api';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>
);
