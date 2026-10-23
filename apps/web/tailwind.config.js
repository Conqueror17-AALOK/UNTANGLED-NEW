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
        industrial: {
          950: '#070A12',
          900: '#0B0F19',
          850: '#0F1626',
          800: '#141D30',
          700: '#1E293D',
          600: '#334155',
          500: '#64748B',
        },
        confidence: {
          high: '#10B981',    // >= 0.85 Emerald
          medium: '#F59E0B',  // 0.60 - 0.85 Amber
          low: '#EF4444',     // < 0.60 Red
        },
        brand: {
          cyan: '#06B6D4',
          blue: '#3B82F6',
          indigo: '#6366F1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
