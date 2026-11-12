/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // One muted accent: warm sand / stone. Used sparingly for surfaces and hairlines; text on it is ink.
        brand: {
          50: '#faf8f4',
          100: '#f3efe8',
          200: '#e9e3d8',
          300: '#ddd5c7',
          400: '#d4cab8',
          500: '#bdb09a',
          600: '#8e8069',
          700: '#6a5e4c',
          800: '#4a4135',
          900: '#2e2921',
        },
        ink: { DEFAULT: '#141414', soft: '#45423d', muted: '#7c776f' },
        cream: '#f8f6f1',
        line: '#e7e2d9',
        success: '#3d6b52',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        hand: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // Lighter, quieter weights across the storefront.
      fontWeight: { semibold: '500', bold: '600', extrabold: '600', black: '600' },
      borderRadius: { xl: '0.625rem', '2xl': '0.875rem', '3xl': '1.125rem' },
      boxShadow: {
        card: '0 1px 0 rgba(20,20,20,.03), 0 10px 30px -18px rgba(20,20,20,.18)',
        lift: '0 24px 50px -28px rgba(20,20,20,.35)',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: { marquee: 'marquee 60s linear infinite' },
    },
  },
  plugins: [],
};
