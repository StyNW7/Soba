/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FAF9F4',
        surface: '#FFFFFF',
        cream: '#F2F5E2',
        custard: '#E3DEA4',
        apricot: {
          DEFAULT: '#D4954D',
          hover: '#C5863F',
          soft: '#F3E3CE',
storm:    '#B8763A',
        },
        brown: {
          DEFAULT: '#775533',
          dark: '#523A28',
          soft: '#A98970',
          faint: '#EDE3D8',
        },
        muted: '#F5F0E8',
        line: '#E7DED2',
        ink: {
          DEFAULT: '#3F3026',
          secondary: '#78685C',
          muted: '#A19389',
        },
        sage: {
          DEFAULT: '#7C9070',
          soft: '#E6EDE1',
        },
        amber: {
          DEFAULT: '#C79A3C',
          soft: '#F7EED8',
        },
        terracotta: {
          DEFAULT: '#B5654F',
          soft: '#F5E3DD',
          dark: '#8E4B39',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Lora', 'Georgia', 'serif'],
        sans: ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(82,58,40,0.06)',
        card: '0 2px 12px rgba(82,58,40,0.05)',
        lift: '0 16px 44px rgba(82,58,40,0.10)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: '.55' }, '50%': { transform: 'scale(1.06)', opacity: '.85' } },
        'orb-pulse': { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.04)' } },
      },
      animation: {
        'fade-up': 'fade-up .6s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .5s ease both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,1,.36,1) both',
        'slide-in-right': 'slide-in-right .3s cubic-bezier(.22,1,.36,1) both',
        breathe: 'breathe 6s ease-in-out infinite',
        'orb-pulse': 'orb-pulse 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
