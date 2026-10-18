/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#16A34A',
        'primary-dark': '#15803D',
        'primary-light': '#22C55E',
        'primary-bg': '#F0FDF4',
        secondary: '#F8FAFC',
        'text-primary': '#111827',
        'text-secondary': '#64748B',
        border: '#E2E8F0',
        'award-green': '#22C55E',
        'award-gold': '#EAB308',
        'award-orange': '#F97316',
        'award-purple': '#A855F7',
        'award-red': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
