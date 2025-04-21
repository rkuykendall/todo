import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface TicketDraw {
  id: string;
  created_at: string;
  ticket_id: string;
  done: boolean;
  skipped: boolean;
}

interface DrawState {
  draws: TicketDraw[];
  loading: boolean;
  error: string | null;
}

const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || 'http://localhost:4000';

const initialState: DrawState = {
  draws: [],
  loading: false,
  error: null,
};

// 🔄 Fetch today's draws
export const fetchDraws = createAsyncThunk('draws/fetchDraws', async () => {
  const res = await fetch(`${API_DOMAIN}/ticket_draw`);
  return await res.json();
});

// 📅 Create draws for today
export const createDraws = createAsyncThunk('draws/createDraws', async () => {
  const res = await fetch(`${API_DOMAIN}/ticket_draw`, {
    method: 'POST',
  });
  return await res.json(); // array of today's draws
});

// 🧩 Update a draw's status (PATCH)
export const patchDraw = createAsyncThunk(
  'draws/patchDraw',
  async ({ id, ...updates }: Partial<TicketDraw> & { id: string }) => {
    const res = await fetch(`${API_DOMAIN}/ticket_draw/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  }
);

const drawSlice = createSlice({
  name: 'draws',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDraws.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchDraws.fulfilled,
        (state, action: PayloadAction<TicketDraw[]>) => {
          state.draws = action.payload;
          state.loading = false;
        }
      )
      .addCase(fetchDraws.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch draws';
      })
      .addCase(
        patchDraw.fulfilled,
        (state, action: PayloadAction<TicketDraw>) => {
          const index = state.draws.findIndex(
            (d) => d.id === action.payload.id
          );
          if (index !== -1) {
            state.draws[index] = action.payload;
          }
        }
      )
      .addCase(
        createDraws.fulfilled,
        (state, action: PayloadAction<TicketDraw[]>) => {
          state.draws = action.payload;
        }
      );
  },
});

export default drawSlice.reducer;
