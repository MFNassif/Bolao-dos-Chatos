/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      },
      colors: {
        green: { DEFAULT: '#16a34a', light: '#22c55e', dark: '#15803d' },
        gold: { DEFAULT: '#f59e0b', light: '#fbbf24' },
        surface: { DEFAULT: '#161921', 2: '#1e2330', 3: '#252c3d' },
        slate: { DEFAULT: '#94a3b8', dark: '#64748b' },
        ink: '#0d0f14'
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' }
    }
  },
  plugins: []
};
