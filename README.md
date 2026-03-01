# 🚀 Multiplayer Game Backend Core

Este es el motor principal del sistema, diseñado para ofrecer una experiencia de juego multijugador fluida, segura y escalable. Construido con una arquitectura modular para soportar partidas en tiempo real, gestión de colecciones y una infraestructura robusta.

## 🛠 Tecnologías Core

A las tecnologías base que ya teníamos, hemos sumado herramientas críticas para cumplir con los requisitos de rendimiento (**RNF-2**) y seguridad (**RNF-4**):

[![Node.js Badge](https://img.shields.io/badge/Node.js-5FA04E?logo=node.js&logoColor=fff&style=for-the-badge)](https://nodejs.org/)
[![TypeScript Badge](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff&style=for-the-badge)](https://www.typescriptlang.org/)
[![Express Badge](https://img.shields.io/badge/Express-000000?logo=express&logoColor=fff&style=for-the-badge)](https://expressjs.com/)
[![Prisma Badge](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=fff&style=for-the-badge)](https://www.prisma.io/)
[![Supabase Badge](https://img.shields.io/badge/supabase-black?logo=supabase&logoColor=fff&style=for-the-badge)](https://supabase.com/)
[![Docker Badge](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=fff&style=for-the-badge)](https://www.docker.com/)
[![ESLint Badge](https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=fff&style=for-the-badge)](https://eslint.org/)
[![Prettier Badge](https://img.shields.io/badge/Prettier-F7B93E?logo=prettier&logoColor=fff&style=for-the-badge)](https://prettier.io/)

[![JWT Badge](https://img.shields.io/badge/JWT-000000?logo=jsonwebtokens&logoColor=fff&style=for-the-badge)](https://jwt.io/)
[![WebSockets Badge](https://img.shields.io/badge/WebSockets-010101?logo=websocket&logoColor=fff&style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![AES-256 Badge](https://img.shields.io/badge/AES--256-4B8BBE?style=for-the-badge)](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)
[![ts-node-dev Badge](https://img.shields.io/badge/ts--node--dev-3178C6?logo=typescript&logoColor=fff&style=for-the-badge)](https://github.com/wclr/ts-node-dev)
[![PostgreSQL Badge](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=fff&style=for-the-badge)](https://www.postgresql.org/)
[![Redis Badge](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=fff&style=for-the-badge)](https://redis.io/)

---

## ✨ Características Principales

- **Sistema de Juego Híbrido:** Soporte para motores _Classic_ y _Stella_ con conmutación en caliente.
- **Real-time Ready:** Optimizado para latencias menores a 500ms mediante WebSockets y Redis.
- **Seguridad Nivel Enterprise:** Cifrado de datos sensibles con **AES-256** y autenticación robusta via **JWT**.
- **Persistencia Inteligente:** Uso de **Prisma + Supabase** para datos persistentes y **Redis** para estados de partida volátiles.
- **Documentación Viva:** API totalmente documentada con **Swagger** accesible desde el navegador.

---

## 📂 Estructura del Proyecto

Hemos adoptado una estructura **orientada a servicios** para mantener el código limpio y testeable:

```text
src/
 ├── config/         # Configuraciones globales (Swagger, Cloud, etc.)
 ├── controllers/    # Controladores de la API (Lógica de entrada)
 ├── lib/            # Clientes de servicios (Prisma, Redis Singleton)
 ├── middlewares/    # Auth, Validaciones, Error Handlers
 ├── models/         # Definiciones de tipos e interfaces TS
 ├── routes/         # Definición de endpoints
 ├── services/       # Lógica de negocio pura (Servicios de juego)
 ├── app.ts          # Configuración de Express
 └── index.ts        # Punto de entrada y Bootstrap del sistema

```

---

## ⚡️ Inicio Rápido

### Requisitos Previos

- Node.js v20+
- Instancia de PostgreSQL (Supabase)
- Redis Server

### Instalación

1. **Clonar el repositorio:**

```bash
git clone https://github.com/Unizar-30226-2026-11/Backend.git
cd Backend

```

2. **Instalar dependencias:**

```bash
npm install

```

3. **Configurar el entorno:**
   Crea un archivo `.env` en la raíz basándote en el ejemplo:

```env
PORT=3000
DATABASE_URL="tu_url_de_supabase"
REDIS_URL="tu_url_de_redis"
JWT_SECRET="tu_secreto"

```

4. **Desplegar base de datos:**

```bash
npx prisma generate
npx prisma db push

```

5. **Arrancar en desarrollo:**

```bash
npm run dev

```

---

## 📖 Documentación de la API

Una vez que el servidor esté corriendo, puedes explorar todos los endpoints disponibles y probarlos directamente desde la interfaz de Swagger:

🔗 **[http://localhost:3000/api-docs](https://www.google.com/search?q=http://localhost:3000/api-docs)**

---

## 🛠 Scripts Disponibles

| Script           | Descripción                                                    |
| ---------------- | -------------------------------------------------------------- |
| `npm run dev`    | Arranca el servidor con recarga en caliente (**ts-node-dev**). |
| `npm run build`  | Compila el proyecto a JavaScript plano.                        |
| `npm run lint`   | Analiza el código en busca de errores de estilo.               |
| `npm run format` | Formatea el código automáticamente usando Prettier.            |

---

> **Nota para desarrolladores:** Recuerda que para cumplir con el **RNF-4**, cualquier dato sensible debe ser gestionado a través del servicio de cifrado antes de ser almacenado.
