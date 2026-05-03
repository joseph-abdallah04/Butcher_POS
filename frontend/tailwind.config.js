/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5f5',
          100: '#ffe3e3',
          200: '#ffc9c9',
          300: '#ffa8a8',
          400: '#ff8787',
          500: '#e03131',
          600: '#c92a2a',
          700: '#a51c1c',
          800: '#7d1414',
          900: '#5c0d0d',
        },
      },
    },
  },
  plugins: [],
};
