/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary palette — matches existing index.html design
        navy: {
          DEFAULT: '#0F1629',
          light:   '#1A2447',
          lighter: '#1E2D5A',
        },
        violet: {
          50:  '#f5f4ff',
          100: '#ebe9ff',
          200: '#d7d4ff',
          300: '#b8b2ff',
          400: '#938aff',
          500: '#6C63FF', // primary accent
          600: '#5a50e6',
          700: '#4c41cc',
          800: '#3d34a0',
          900: '#2e2778',
        },
        success:  '#10B981',
        danger:   '#EF4444',
        warning:  '#F59E0B',
        info:     '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(108, 99, 255, 0.3)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
