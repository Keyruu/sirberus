import Page from '@/dashboard/Page.tsx';
import ContainerPage from '@/pages/ContainerPage';
import HomePage from '@/pages/HomePage';
import SystemdPage from '@/pages/SystemdPage';
import { BrowserRouter, Route, Routes } from 'react-router';
import './App.css';
import { ThemeProvider } from './components/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client
const queryClient = new QueryClient();

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
				<BrowserRouter>
					<Routes>
						<Route path="/" element={<Page />}>
							<Route index element={<HomePage />} />
							<Route path="systemd" element={<SystemdPage />} />
							<Route path="container" element={<ContainerPage />} />
						</Route>
					</Routes>
				</BrowserRouter>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
