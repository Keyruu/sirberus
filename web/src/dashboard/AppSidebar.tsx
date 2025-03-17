import * as React from 'react';

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from '@/components/ui/sidebar';
import { SearchForm } from '@/dashboard/SearchForm.tsx';
import { Container, Home, MonitorCog } from 'lucide-react';
import { Link } from 'react-router';
// This is sample data.
const data = {
	sidebar: [
		{
			title: 'Home',
			url: '/',
			icon: Home,
		},
		{
			title: 'Systemd',
			url: '/systemd',
			icon: MonitorCog,
		},
		{
			title: 'Container',
			url: '/container',
			icon: Container,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar {...props}>
			<SidebarHeader className="flex flex-col gap-4">
				<div className="flex items-center gap-2 px-4 py-2">
					<img src="/sirberus-logo.png" alt="Sirberus Logo" className="h-10 w-10" />
					<span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 dark:from-slate-200 dark:to-slate-400">
						sirberus
					</span>
				</div>
				<SearchForm />
			</SidebarHeader>
			<SidebarContent>
				{/* We create a SidebarGroup for each parent. */}
				<SidebarGroup key="main">
					<SidebarGroupLabel>Menu</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{data.sidebar.map(item => (
								<SidebarMenuItem key={item.url}>
									<SidebarMenuButton asChild>
										<Link to={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
