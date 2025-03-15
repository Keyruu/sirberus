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
	SidebarRail
} from '@/components/ui/sidebar';
import { SearchForm } from '@/dashboard/SearchForm.tsx';
import { Cog, Container, MonitorCog } from 'lucide-react';

// This is sample data.
const data = {
	sidebar: [
		{
			title: 'Systemd',
			url: '#',
			icon: MonitorCog,
		},
		{
			title: 'Container',
			url: '#',
			icon: Container,
		},
		{
			title: 'Settings',
			url: '#',
			icon: Cog,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<SearchForm />
			</SidebarHeader>
			<SidebarContent>
				{/* We create a SidebarGroup for each parent. */}
				<SidebarGroup key="main">
					<SidebarGroupLabel>Menu</SidebarGroupLabel>
					<SidebarGroupContent>
						{data.sidebar.map(item => (
							<SidebarMenu>
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild>
										<a href={item.url}>
											<item.icon />
											<span>{item.title}</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						))}
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
