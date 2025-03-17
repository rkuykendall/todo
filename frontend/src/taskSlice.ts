import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

interface Task {
  id: number;
  title: string;
  completed: boolean;
}

interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: TaskState = {
  tasks: [],
  loading: false,
  error: null,
};

// Fetch tasks from API
export const fetchTasks = createAsyncThunk("tasks/fetchTasks", async () => {
  const res = await fetch("http://localhost:4000/tasks");
  return res.json();
});

// Add a new task
export const addTask = createAsyncThunk("tasks/addTask", async (title: string) => {
  const res = await fetch("http://localhost:4000/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return res.json();
});

// Toggle task completion
export const toggleTask = createAsyncThunk(
  "tasks/toggleTask",
  async ({ id, completed }: { id: number; completed: boolean }) => {
    await fetch(`http://localhost:4000/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !completed }),
    });
    return { id, completed: !completed };
  }
);

// Delete a task
export const deleteTask = createAsyncThunk("tasks/deleteTask", async (id: number) => {
  await fetch(`http://localhost:4000/tasks/${id}`, { method: "DELETE" });
  return id;
});

const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchTasks.pending, state => {
        state.loading = true;
      })
      .addCase(fetchTasks.fulfilled, (state, action: PayloadAction<Task[]>) => {
        state.tasks = action.payload;
        state.loading = false;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.error = action.error.message || "Failed to fetch tasks";
        state.loading = false;
      })
      .addCase(addTask.fulfilled, (state, action: PayloadAction<Task>) => {
        state.tasks.push(action.payload);
      })
      .addCase(toggleTask.fulfilled, (state, action: PayloadAction<{ id: number; completed: boolean }>) => {
        const task = state.tasks.find(task => task.id === action.payload.id);
        if (task) {
          task.completed = action.payload.completed;
        }
      })
      .addCase(deleteTask.fulfilled, (state, action: PayloadAction<number>) => {
        state.tasks = state.tasks.filter(task => task.id !== action.payload);
      });
  },
});

export default taskSlice.reducer;
