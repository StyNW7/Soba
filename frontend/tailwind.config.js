/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FAF9F4',
        surface: '#FFFFFF',
        cream: {
          DEFAULT: '#F2F5E2',
          deep: '#E9EDD2',
          tint: '#F8FAEE',
        },
        custard: {
          DEFAULT: '#E3DEA4',
          soft: '#EFEBC8',
          deep: '#D6CF88',
        },
        apricot: {
          50: '#FDF8F1',
          100: '#F9EDDC',
          200: '#F3E3CE',
          300: '#E9C99C',
          400: '#DEAE71',
          DEFAULT: '#D4954D',
          500: '#D4954D',
          600: '#C5863F',
          700: '#B8763A',
          800: '#9A612E',
          900: '#6F4620',
          hover: '#C5863F',
          soft: '#F3E3CE',
          storm: '#B8763A',
        },
        brown: {
          50: '#F8F4EF',
          100: '#EDE3D8',
          200: '#DCC9B6',
          300: '#C4A88F',
          400: '#A98970',
          DEFAULT: '#775533',
          500: '#8B6A48',
          600: '#775533',
          700: '#634529',
          800: '#523A28',
          900: '#3A2819',
          dark: '#523A28',
          soft: '#A98970',
          faint: '#EDE3D8',
        },
        muted: {
          DEFAULT: '#F5F0E8',
          deep: '#EDE6DB',
        },
        line: {
          DEFAULT: '#E7DED2',
          soft: '#F0E9DF',
          strong: '#D7C9B8',
        },
        ink: {
          DEFAULT: '#3F3026',
          secondary: '#78685C',
          muted: '#A19389',
          faint: '#BFB3A7',
        },
        sage: {
          DEFAULT: '#7C9070',
          soft: '#E6EDE1',
          deep: '#5D6F52',
        },
        amber: {
          DEFAULT: '#C79A3C',
          soft: '#F7EED8',
          deep: '#8A6A22',
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
      letterSpacing: {
        eyebrow: '0.16em',
        headline: '-0.022em',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      /* Layered, warm-tinted shadows: a tight contact shadow plus a wide ambient
         one, which reads as real depth rather than a grey blur. */
      boxShadow: {
        card: '0 1px 2px rgba(82,58,40,0.04), 0 2px 8px rgba(82,58,40,0.035)',
        soft: '0 2px 4px rgba(82,58,40,0.03), 0 8px 24px rgba(82,58,40,0.06)',
        lift: '0 4px 10px rgba(82,58,40,0.05), 0 16px 40px rgba(82,58,40,0.09)',
        float: '0 8px 18px rgba(82,58,40,0.06), 0 28px 64px rgba(82,58,40,0.13)',
        'apricot-glow': '0 4px 12px rgba(212,149,77,0.24), 0 12px 32px rgba(212,149,77,0.16)',
        'brown-glow': '0 4px 12px rgba(82,58,40,0.20), 0 12px 32px rgba(82,58,40,0.14)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.65)',
        ring: '0 0 0 1px rgba(231,222,210,0.9)',
      },
      transitionTimingFunction: {
        soba: 'cubic-bezier(.22,1,.36,1)',
        'soba-out': 'cubic-bezier(.16,1,.3,1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        breathe: {
          '0%,100%': { transform: 'scale(1)', opacity: '.55' },
          '50%': { transform: 'scale(1.06)', opacity: '.85' },
        },
        'orb-pulse': {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ring-out': {
          '0%': { transform: 'scale(.85)', opacity: '.5' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up .6s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .5s ease both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,1,.36,1) both',
        'slide-in-right': 'slide-in-right .3s cubic-bezier(.22,1,.36,1) both',
        'slide-up': 'slide-up .32s cubic-bezier(.22,1,.36,1) both',
        breathe: 'breathe 6s ease-in-out infinite',
        'orb-pulse': 'orb-pulse 3.5s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'ring-out': 'ring-out 2.8s cubic-bezier(.22,1,.36,1) infinite',
      },
    },
  },
  plugins: [],
}
