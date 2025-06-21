import { ModeToggle } from '@/components/mode-toggle';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/dashboard/AppSidebar.tsx';
import { Link, Outlet, useLocation } from 'react-router';

function Page() {
	const location = useLocation();

	// Get the current path and create breadcrumb items
	const getBreadcrumbs = () => {
		const path = location.pathname;

		if (path === '/') {
			return (
				<>
					<BreadcrumbItem>
						<BreadcrumbPage>Dashboard</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		} else if (path === '/systemd') {
			return (
				<>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/">Dashboard</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Systemd Services</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		} else if (path.match(/^\/systemd\/[^/]+\/logs$/)) {
			const serviceName = path.split('/')[2];
			return (
				<>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/">Dashboard</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/systemd">Systemd Services</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to={`/systemd/${serviceName}`}>{serviceName}</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Logs</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		} else if (path.match(/^\/systemd\/[^/]+$/)) {
			const serviceName = path.split('/')[2];
			return (
				<>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/">Dashboard</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/systemd">Systemd Services</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{serviceName}</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		} else if (path === '/container') {
			return (
				<>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/">Dashboard</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Container Management</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		} else if (path.match(/^\/container\/[^/]+\/logs$/)) {
			const containerId = path.split('/')[2];
			return (
				<>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/">Dashboard</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/container">Container Management</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to={`/container/${containerId}`}>{containerId}</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>Logs</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		} else if (path.match(/^\/container\/[^/]+$/)) {
			const containerId = path.split('/')[2];
			return (
				<>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/">Dashboard</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/container">Container Management</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{containerId}</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			);
		}

		return null;
	};

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<Breadcrumb>
						<BreadcrumbList>{getBreadcrumbs()}</BreadcrumbList>
					</Breadcrumb>
					<div className="ml-auto">
						<ModeToggle />
					</div>
				</header>
				<div className="flex-1">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

export default Page;
