'use client';

import { Sidebar } from '@/components/layout';
import { ChatButton } from '@/components/chat';
import AIAssistantDrawer from '@/components/incident/AIAssistantDrawer';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { sidebarCollapsed, isMobileMenuOpen, closeMobileMenu } = useUIStore();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-soar-bg overflow-x-hidden">
                <Sidebar />

                {/* Mobile Sidebar Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity"
                        onClick={closeMobileMenu}
                    />
                )}

                <main
                    className={cn(
                        'pt-16 transition-all duration-300 min-h-screen relative',
                        sidebarCollapsed ? 'ltr:lg:ml-16 ltr:lg:mr-0 rtl:lg:mr-16 rtl:lg:ml-0' : 'ltr:lg:ml-64 ltr:lg:mr-0 rtl:lg:mr-64 rtl:lg:ml-0'
                    )}
                >
                    <div className="p-6">{children}</div>
                </main>

                {/* AI Chatbot Button */}
                <ChatButton />

                {/* Global AI Assistant Drawer */}
                <AIAssistantDrawer />
            </div>
        </ProtectedRoute>
    );
}
