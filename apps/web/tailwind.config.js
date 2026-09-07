/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        monero: {
          orange: '#FF6600',
          dark: '#1C1C1C',
          gray: '#4D4D4D'
        },
        cyber: {
          bg: '#0B0E14',
          card: '#151922',
          border: '#262D3D',
          accent: '#10B981',
          gold: '#F59E0B'
        }
      }
    },
  },
  plugins: [],
}
