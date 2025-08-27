/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2E7D32',
        accent: '#FFA000',
        dark: '#262626',
        card: '#3f3f3f',
      },
      borderRadius: {
        'xl-2': '48px',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        'hero': '0 20px 60px rgba(0,0,0,0.6)',
        'card-lg': '0px 3px 49px 9px rgba(0, 0, 0, 0.06)'
      },
    },
  },
  plugins: [],
}


