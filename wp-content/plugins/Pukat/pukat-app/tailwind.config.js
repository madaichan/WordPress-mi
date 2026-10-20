/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic theme tokens ──────────────────────────────────────
        // Backed by CSS variables declared in index.css (:root for light,
        // .dark for dark). Components use these instead of raw gray/white
        // utilities so a theme switch is a variable swap, not a class swap.
        // `<alpha-value>` keeps Tailwind's /50 opacity modifiers working.
        canvas:  'rgb(var(--pk-canvas) / <alpha-value>)',
        panel: {
          DEFAULT: 'rgb(var(--pk-panel) / <alpha-value>)',
          subtle:  'rgb(var(--pk-panel-subtle) / <alpha-value>)',
          muted:   'rgb(var(--pk-panel-muted) / <alpha-value>)',
          strong:  'rgb(var(--pk-panel-strong) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--pk-line) / <alpha-value>)',
          soft:    'rgb(var(--pk-line-soft) / <alpha-value>)',
          strong:  'rgb(var(--pk-line-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--pk-ink) / <alpha-value>)',
          soft:    'rgb(var(--pk-ink-soft) / <alpha-value>)',
          muted:   'rgb(var(--pk-ink-muted) / <alpha-value>)',
          faint:   'rgb(var(--pk-ink-faint) / <alpha-value>)',
        },
        // Status foregrounds — lifted in dark mode so tinted text stays
        // readable; the solid `success`/`danger`/… fills below stay fixed.
        'success-fg': 'rgb(var(--pk-success-fg) / <alpha-value>)',
        'danger-fg':  'rgb(var(--pk-danger-fg) / <alpha-value>)',
        'warning-fg': 'rgb(var(--pk-warning-fg) / <alpha-value>)',
        'info-fg':    'rgb(var(--pk-info-fg) / <alpha-value>)',
        'violet-fg':  'rgb(var(--pk-violet-fg) / <alpha-value>)',

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
