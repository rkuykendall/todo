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

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Start the backend server:

   ```bash
   cd backend
   npm run dev
   ```

3. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

By default, the backend runs on port 4000 and the frontend on port 5173.

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
