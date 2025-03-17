import axios from 'axios';

// Configure axios with default settings
axios.defaults.baseURL = '/api'; // Use the proxy configured in vite.config.ts
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor for handling errors
axios.interceptors.request.use(
	config => {
		return config;
	},
	error => {
		return Promise.reject(error);
	}
);

// Add response interceptor for handling errors
axios.interceptors.response.use(
	response => {
		return response;
	},
	error => {
		console.error('API Error:', error);
		return Promise.reject(error);
	}
);

export default axios;
