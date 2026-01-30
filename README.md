# Personal Task Manager

A personal task management system that helps organize daily tasks through a ticket-drawing system. Tasks can be scheduled for specific days of the week, with options for both required and optional draws.

## Features

- **Daily Task Drawing**: Automatically selects up to 5 tasks each day based on scheduling rules
- **Flexible Scheduling**: Configure tasks to be:
  - Available on specific days
  - Required on specific days
  - Optional on specific days
- **Task Management**:
  - Add, edit, and delete tasks
  - Set deadlines for tasks
  - Mark tasks as done or skipped
  - Track last completion date
- **Modern UI**:
  - Clean, card-based interface
  - Smooth animations
  - Confetti celebration on task completion

## Tech Stack

- **Frontend**:
  - React with TypeScript
  - Redux Toolkit for state management
  - Ant Design component library
  - Framer Motion for animations
  - Vite for development and building

- **Backend**:
  - Node.js with Express
  - SQLite database
  - TypeScript
  - Zod for validation

## Development Setup

This is a monorepo using npm workspaces. Install dependencies from the root directory:

```bash
npm install
```

Start the backend and frontend in separate terminals:

```bash
cd backend && npm run dev   # Port 4000
cd frontend && npm run dev  # Port 5173
```

### Authentication

The backend uses Bearer token authentication. Set `AUTH_PASSWORD` environment variable or use the default password: `default-password`

### Testing & Code Quality

```bash
npm run test      # Run all tests (backend, frontend, shared)
npm run check     # Run format, lint, typecheck, and tests
npm run build     # Build all workspaces (shared must build first)
```

Pre-commit hooks (Husky + lint-staged) enforce formatting and linting.

## Docker Deployment

The project includes Docker configuration for easy deployment:

```bash
cd docker
docker-compose up
```

The frontend will be available at port 5173 and the backend at port 4000.

## Project Structure

- `/frontend`: React frontend application
- `/backend`: Express backend server
- `/shared`: Shared types and utilities
- `/docker`: Docker configuration files
- `/data`: Database and backup files

## Environment Variables

- `PORT`: Backend server port (default: 4000)
- `DATABASE_PATH`: SQLite database path (default: /data/todo.db)
- `VITE_API_DOMAIN`: Backend API URL for frontend (default: http://localhost:4000)
- `AUTH_PASSWORD`: Backend authentication password (default: default-password)
- `FRONTEND_URL`: CORS whitelist (default: localhost:3000, localhost:5173, localhost:4173)
