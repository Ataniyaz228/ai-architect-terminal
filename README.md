<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/terminal-square.svg" width="60" alt="Terminal Icon" />
  <h1>AI Architect Terminal</h1>
  
  <p>
    <b>A strict, premium cognitive tool for software architects and product designers.</b><br>
    Transforms raw ideas into highly structured, high-level design specifications (HLD).
  </p>

  <p>
    <a href="#core-philosophy">Philosophy</a> •
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#русский">Русский</a>
  </p>
</div>

<br/>

<!-- SCREENSHOT_DEMO_VIDEO_PLACEHOLDER_EN 
[Insert Video/Screenshot Here: e.g. <img src="./docs/demo.gif" width="800" />]
-->

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/book-open.svg" width="20" align="top" /> Core Philosophy

This application acts as a digital Staff Engineer and Lead Product Designer. It refuses executable code generation and enforces strict, high-level abstract thinking: system architecture, data flow, product mechanics, and visual hierarchy.

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/layers.svg" width="20" align="top" /> Features

| Feature | Description |
| ------- | ----------- |
| **Strict Specializations** | Three dedicated operating modes: Architecture (System Design), Design Review (UX/UI Audits), and Ideation (Product Strategy). |
| **Iterative Refinement** | An inline, surgically precise floating command bar for targeted text modifications. |
| **Version Control** | Built-in history to navigate back and forth between different iterations of the architectural brief. |
| **Monochrome Aesthetic** | Premium graphite and slate visual identity, minimizing noise for deep cognitive work. |
| **Secure Keyring** | API keys are stored securely using the native OS keyring (no plaintext `.env` leaks). |

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cpu.svg" width="20" align="top" /> Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **Frontend Core** | Next.js 16 (React 19), Server-Side Rendering |
| **Desktop Runtime** | Tauri 2.0 (Rust) |
| **Styling** | Vanilla CSS (Vercel Monochrome Palette) |
| **State Management** | Zustand |

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/download.svg" width="20" align="top" /> Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust & Cargo](https://rustup.rs/) (For Tauri backend)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/Ataniyaz228/ai-architect-terminal.git
cd ai-architect-terminal
```

2. **Install dependencies**
```bash
npm install
```

3. **Run the development server**
```bash
npx tauri dev
```
*Note: Make sure your `cargo` binary is in your system PATH.*

<br/>

---

<div align="center" id="русский">
  <h1>AI Architect Terminal (Русский)</h1>
  <p>
    <b>Строгий премиальный когнитивный инструмент для системных архитекторов и продуктовых дизайнеров.</b><br>
    Превращает сырые идеи в структурированные спецификации высокого уровня (HLD).
  </p>
</div>

<br/>

<!-- SCREENSHOT_DEMO_VIDEO_PLACEHOLDER_RU 
[Вставьте Видео/Скриншот Здесь: например <img src="./docs/demo_ru.gif" width="800" />]
-->

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/book-open.svg" width="20" align="top" /> Основная философия

Приложение выступает в роли цифрового Staff Engineer'а и Lead Product Designer'а. Оно категорически отказывается писать исполняемый код, заставляя фокусироваться исключительно на абстрактном мышлении: системной архитектуре, потоках данных, продуктовых механиках и визуальной иерархии.

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/layers.svg" width="20" align="top" /> Ключевые возможности

| Функция | Описание |
| ------- | -------- |
| **Строгие специализации** | Три операционных режима: Architecture (Архитектура систем), Design Review (UX/UI Аудит) и Ideation (Продуктовая стратегия). |
| **Итеративная правка** | Плавающая командная строка для точечного (inline) редактирования конкретных фрагментов брифа. |
| **Система версионирования** | Встроенная история версий для навигации между различными итерациями технического задания. |
| **Монохромная эстетика** | Премиальный графитовый визуал (Industrial Monochrome), минимизирующий визуальный шум. |
| **Безопасное хранение** | Ключи API хранятся в защищенном хранилище ОС (Keyring), без утечек в `.env` файлы. |

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cpu.svg" width="20" align="top" /> Стек технологий

| Слой | Технологии |
| ---- | ---------- |
| **Frontend ядро** | Next.js 16 (React 19), Server-Side Rendering |
| **Desktop Runtime** | Tauri 2.0 (Rust) |
| **Стилизация** | Vanilla CSS (Vercel Monochrome) |
| **State Management**| Zustand |

## <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/download.svg" width="20" align="top" /> Установка

### Требования
- [Node.js](https://nodejs.org/) (v18+)
- [Rust & Cargo](https://rustup.rs/) (Для Tauri бэкенда)

### Запуск

1. **Клонирование репозитория**
```bash
git clone https://github.com/Ataniyaz228/ai-architect-terminal.git
cd ai-architect-terminal
```

2. **Установка зависимостей**
```bash
npm install
```

3. **Запуск сервера разработки**
```bash
npx tauri dev
```
*Примечание: Убедитесь, что `cargo` добавлен в `PATH` вашей системы.*
