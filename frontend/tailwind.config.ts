import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Dynamic theme palette
                'soar': {
                    'bg': 'var(--bg-primary)',
                    'bg-secondary': 'var(--bg-secondary)',
                    'card': 'var(--bg-card)',
                    'border': 'var(--border-color)',
                    'accent': 'var(--accent-primary)',
                    'accent-hover': 'var(--accent-hover)',
                },
                'severity': {
                    'critical': 'var(--severity-critical)',
                    'high': 'var(--severity-high)',
                    'medium': 'var(--severity-medium)',
                    'low': 'var(--severity-low)',
                },
                'status': {
                    'new': '#3b82f6',
                    'in-progress': '#f59e0b',
                    'resolved': '#22c55e',
                    'closed': '#6b7280',
                },
                'forensic': {
                    'verified': '#4ade80',
                    'tampered': '#ef4444',
                    'pending': '#94a3b8',
                    'chain': '#22d3ee',
                },
                'neon': {
                    'blue': '#38bdf8',
                    'green': '#4ade80',
                    'cyan': '#22d3ee',
                    'purple': '#a78bfa',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                cairo: ['var(--font-cairo)', 'sans-serif'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-in': 'slideIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'gauge-pulse': 'gaugePulse 3s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateX(-10px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                gaugePulse: {
                    '0%, 100%': { filter: 'drop-shadow(0 0 6px currentColor)' },
                    '50%': { filter: 'drop-shadow(0 0 12px currentColor)' },
                },
            },
        },
    },
    plugins: [],
}
export default config
