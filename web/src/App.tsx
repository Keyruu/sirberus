import Page from '@/dashboard/Page.tsx';
import ContainerPage from '@/pages/ContainerPage';
import HomePage from '@/pages/HomePage';
import SystemdPage from '@/pages/SystemdPage';
import SystemdLogsPage from '@/pages/SystemdLogsPage';
import SystemdServiceDetailsPage from '@/pages/SystemdServiceDetailsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Toaster } from 'sonner';
import './App.css';
import { ThemeProvider } from './components/theme-provider';

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
							<Route path="systemd/:serviceName" element={<SystemdServiceDetailsPage />} />
							<Route path="systemd/:serviceName/logs" element={<SystemdLogsPage />} />
							<Route path="container" element={<ContainerPage />} />
						</Route>
					</Routes>
				</BrowserRouter>
				<Toaster richColors />
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
