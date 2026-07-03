import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F6F1E7',
        sand: '#E7DFCF',
        bark: '#20302A',
        moss: '#6E7B72',
        ember: { DEFAULT: '#D98324', dark: '#B96A15', soft: '#FBEFE0' },
        pine: {
          50: '#EFF5F1',
          100: '#DCE9E2',
          200: '#BBD3C6',
          500: '#356A52',
          600: '#2A5140',
          700: '#1F3D30',
          800: '#193026',
          900: '#12241C',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,38,30,0.06), 0 10px 30px rgba(20,38,30,0.07)',
      },
    },
  },
  plugins: [],
};

export default config;
