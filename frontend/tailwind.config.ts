import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS 配置
 * 主色：翡翠绿 #00C896
 * 支出红色 / 收入绿色 / 预算超支红色
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 翡翠绿主色系
        primary: {
          DEFAULT: '#00C896', // 主色默认值
          50: '#E6FFF8',
          100: '#C2FFEE',
          200: '#8DFFDD',
          300: '#4FFFC8',
          400: '#1FE8B0',
          500: '#00C896', // 主色
          600: '#00A87E',
          700: '#008866',
          800: '#006E52',
          900: '#005841',
          950: '#003D2C',
        },
        // 收入绿色
        income: {
          DEFAULT: '#16A34A',
          light: '#22C55E',
          dark: '#15803D',
        },
        // 支出红色
        expense: {
          DEFAULT: '#DC2626',
          light: '#EF4444',
          dark: '#B91C1C',
        },
        // 预算超支红色
        budgetDanger: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dark: '#DC2626',
        },
        // 预算安全绿色
        budgetSafe: {
          DEFAULT: '#00C896',
          light: '#4FFFC8',
          dark: '#00A87E',
        },
        // 预算警告黄色
        budgetWarning: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
        },
        // 背景色（跟随 CSS 变量，便于深色模式统一切换）
        background: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-dark': 'var(--color-surface-dark)',
        // 文本色（跟随 CSS 变量）
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        'text-inverse': '#FFFFFF',
        // 边框色（跟随 CSS 变量）
        border: 'var(--color-border)',
        'border-dark': 'var(--color-border-dark)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
        'dropdown': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      },
      width: {
        'sidebar': '240px',
      },
      height: {
        'header': '64px',
        'mobile-nav': '62px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
