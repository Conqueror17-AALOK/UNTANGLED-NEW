/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cad: {
          bg: '#090a0f',
          surface: '#0f1117',
          panel: '#151821',
          card: '#1a1d27',
          hover: '#222634',
          border: '#2a2e3d',
          'border-subtle': '#1e222d',
          'border-bright': '#3d4358',
          text: '#f1f5f9',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
        },
        engineering: {
          blue: '#2563eb',
          sky: '#0ea5e9',
          cyan: '#06b6d4',
          process: '#38bdf8',
          signal: '#a855f7',
          pneumatic: '#f97316',
          valve: '#e2e8f0',
        },
        status: {
          success: '#10b981',
          'success-bg': 'rgba(16, 185, 129, 0.1)',
          'success-border': 'rgba(16, 185, 129, 0.25)',
          warning: '#f59e0b',
          'warning-bg': 'rgba(245, 158, 11, 0.1)',
          'warning-border': 'rgba(245, 158, 11, 0.25)',
          danger: '#ef4444',
          'danger-bg': 'rgba(239, 68, 68, 0.1)',
          'danger-border': 'rgba(239, 68, 68, 0.25)',
          info: '#3b82f6',
          'info-bg': 'rgba(59, 130, 246, 0.1)',
          'info-border': 'rgba(59, 130, 246, 0.25)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'cad-subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'cad-panel': '0 4px 20px -2px rgba(0, 0, 0, 0.6)',
        'cad-glow': '0 0 15px -3px rgba(37, 99, 235, 0.2)',
      },
    },
  },
  plugins: [],
};
