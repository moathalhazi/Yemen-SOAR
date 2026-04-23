import type { Metadata } from 'next';
import { Inter, Cairo } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo' });

export const metadata: Metadata = {
    title: 'SOAR Pro - Security Operations Center',
    description: 'Security Orchestration, Automation and Response Platform',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            try {
                                const state = localStorage.getItem('soar-language-preference');
                                if (state) {
                                    const parsed = JSON.parse(state);
                                    if (parsed.state && parsed.state.locale === 'ar') {
                                        document.documentElement.lang = 'ar';
                                        document.documentElement.dir = 'rtl';
                                    } else {
                                        document.documentElement.lang = 'en';
                                        document.documentElement.dir = 'ltr';
                                    }
                                }
                            } catch (e) {}
                        `,
                    }}
                />
            </head>
            <body className={`${inter.variable} ${cairo.variable} font-cairo`}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
