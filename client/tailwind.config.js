/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#A6342E',
          hover: '#872621',
          tint: '#FDF3F2',
        },
        canvas: '#F7F4EE',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#EFE9DE',
        },
        ink: '#24120E',
        muted: '#6E5A4F',
        hairline: '#E6DDD0',
        wood: {
          DEFAULT: '#3A251D',
          deep: '#24120E',
        },
        gold: {
          DEFAULT: '#C69C49',
          hover: '#A88236',
          tint: '#FAF5E8',
        },
        neutral: {
          1: '#8C7769',
          2: '#24120E',
        },
        status: {
          available: '#1F6E5A',
          'available-tint': '#EDF7F4',
          occupied: '#A6342E',
          'occupied-tint': '#FDF3F2',
          reserved: '#B45309',
          'reserved-tint': '#FEF6E7',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif"', 'Georgia', 'serif'],
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        none: '0px',
        xs: '6px',
        sm: '8px',
        full: '9999px',
      },
      boxShadow: {
        canho: 'rgba(36, 18, 14, 0.14) 0px 2px 8px 0px',
      },
      maxWidth: {
        container: '1108px',
      },
    },
  },
  plugins: [],
};
