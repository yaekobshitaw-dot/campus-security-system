/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#155a91',
          deep: '#0f4778',
          hover: '#1c6da8',
          accent: '#a7ddec',
          border: 'rgb(167 221 236 / 0.28)',
        },
        navy: {
          950: '#061426',
          900: '#0a1d35',
          800: '#102945',
        },
        ink: {
          900: '#10233d',
          600: '#52657d',
        },
        surface: {
          DEFAULT: '#ffffff',
          page: '#eef4f8',
          panel: '#f5f6f8',
        },
      },
      boxShadow: {
        soft: '0 8px 24px rgba(15, 71, 120, 0.18)',
        panel: '0 12px 28px rgba(13,26,43,0.14)',
      },
      fontFamily: {
        sans: ['Aptos', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'dashboard-grid': 'linear-gradient(rgb(111 191 218 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(111 191 218 / 0.035) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};