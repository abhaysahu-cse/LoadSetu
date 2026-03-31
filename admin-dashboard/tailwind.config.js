/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:   { 950: '#040812', 900: '#070d1a', 800: '#0c1526', 700: '#111e34', 600: '#172642', 500: '#1e3156' },
        orange: { 500: '#ff6b2b', 400: '#ff854d', 300: '#ffaa85' },
        cyan:   { 400: '#22d3ee', 300: '#67e8f9' },
        green:  { 400: '#4ade80', 500: '#22c55e' },
        red:    { 400: '#f87171', 500: '#ef4444' },
        amber:  { 400: '#fbbf24', 300: '#fcd34d' },
        slate:  { 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155' },
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
      boxShadow: {
        'glow-orange': '0 0 24px rgba(255,107,43,0.3)',
        'glow-green':  '0 0 16px rgba(74,222,128,0.25)',
        'glow-cyan':   '0 0 16px rgba(34,211,238,0.25)',
        'card':        '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover':  '0 8px 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in':     'fadeIn 0.4s ease forwards',
        'slide-up':    'slideUp 0.4s ease forwards',
        'pulse-dot':   'pulseDot 2s ease-in-out infinite',
        'spin-slow':   'spin 3s linear infinite',
        'shimmer':     'shimmer 1.8s ease-in-out infinite',
        'count-up':    'fadeIn 0.6s ease forwards',
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { transform: 'scale(1)', opacity: 1 }, '50%': { transform: 'scale(1.5)', opacity: 0.7 } },
        shimmer:  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};