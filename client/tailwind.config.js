/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Палитра светло-зелёная: тон сайта «НОВОСТИ СЕКУНДЫ» взят за тёмный
        // край, а рабочие поверхности сделаны на два шага светлее — переписка
        // читается часами, и насыщенный зелёный на таком объёме утомляет.
        brand: {
          DEFAULT: '#43A047',
          hover: '#4CAF50',
          dark: '#2E7D32',
          accent: '#A5D6A7',
          soft: '#E8F5E9',
        },
        // Фон приложения и фон ленты сообщений.
        paper: '#F3FAF3',
        // Свой пузырь: зелёный светлее кнопки, чтобы чёрный текст оставался читаемым.
        mine: '#D7F0D9',
        ink: '#17301F',
        muted: '#6B8A73',
        line: '#DCEBDE',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Название набирается антиквой — так же, как на сайте.
        // Имя в кавычках: без них цифра в «Source Serif 4» делает запись
        // невалидной и браузер молча выбрасывает шрифт.
        serif: ['"Source Serif 4"', 'Georgia', 'PT Serif', 'serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 60%, 100%': { opacity: '0.25' },
          '30%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        blink: 'blink 1.2s infinite',
      },
    },
  },
  plugins: [],
};
