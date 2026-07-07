import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS 配置
 * 主色：蓝灰 #3B82F6（Light）/ #60A5FA（Dark），对齐设计稿 family-finance-app/styles.css
 * 收入绿(success) / 支出红(danger) / 警告黄(warning) / 信息蓝(info)
 * 浅色系与主色经 CSS 变量驱动，深色模式一键反相
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
        // 蓝灰主色系（Light #3B82F6 / Dark #60A5FA，对齐设计稿）
        // 颜色以 CSS 变量（RGB 通道）驱动，外层 rgb(var() / <alpha-value>) 以支持 /透明度 修饰符与深色反相
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          soft: 'rgb(var(--color-primary-soft) / <alpha-value>)',
          50: 'rgb(var(--color-primary-soft) / <alpha-value>)',
          100: 'rgb(var(--color-primary-soft-2) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: '#60A5FA',
          500: 'rgb(var(--color-primary) / <alpha-value>)',
          600: 'rgb(var(--color-primary-deep) / <alpha-value>)',
          700: 'rgb(var(--color-primary-deep) / <alpha-value>)',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        // 收入绿（success 语义）—— 不再与主色撞色
        income: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          light: 'rgb(var(--color-success) / <alpha-value>)',
          dark: 'rgb(var(--color-success-strong) / <alpha-value>)',
        },
        // 支出红（danger 语义）
        expense: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          light: 'rgb(var(--color-danger) / <alpha-value>)',
          dark: 'rgb(var(--color-danger-strong) / <alpha-value>)',
        },
        // 预算状态色（对齐 success/danger/warning）
        budgetDanger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          light: 'rgb(var(--color-danger) / <alpha-value>)',
          dark: 'rgb(var(--color-danger-strong) / <alpha-value>)',
        },
        budgetSafe: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          light: 'rgb(var(--color-success) / <alpha-value>)',
          dark: 'rgb(var(--color-success-strong) / <alpha-value>)',
        },
        budgetWarning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
          light: 'rgb(var(--color-warning) / <alpha-value>)',
          dark: 'rgb(var(--color-warning) / <alpha-value>)',
        },
        // 语义别名（设计稿 token 命名）
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          light: 'rgb(var(--color-success) / <alpha-value>)',
          dark: 'rgb(var(--color-success-strong) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          light: 'rgb(var(--color-danger) / <alpha-value>)',
          dark: 'rgb(var(--color-danger-strong) / <alpha-value>)',
        },
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        // 背景色（跟随 CSS 变量，便于深色模式统一切换）
        background: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-raised': 'rgb(var(--color-surface-raised) / <alpha-value>)',
        'surface-dark': 'rgb(var(--color-surface-dark) / <alpha-value>)',
        // 文本色（跟随 CSS 变量）
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        'text-inverse': '#FFFFFF',
        // 边框色（跟随 CSS 变量）
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-dark': 'rgb(var(--color-border-dark) / <alpha-value>)',
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
