import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:9733',
				changeOrigin: true,
				timeout: 60000, // Increase timeout to 60 seconds
				configure: proxy => {
					proxy.on('error', err => {
						console.log('Proxy error:', err);
					});
					proxy.on('proxyReq', (_proxyReq, req) => {
						console.log('Sending request to:', req.url);
					});
					proxy.on('proxyRes', (proxyRes, req) => {
						console.log('Received response from:', req.url, 'Status:', proxyRes.statusCode);
					});
				},
			},
		},
	},
});
