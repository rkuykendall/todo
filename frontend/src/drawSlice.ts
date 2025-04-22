import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { API_DOMAIN } from './utils';
import { deleteTicket, fetchTickets } from './ticketSlice';

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
  createLoading: boolean;
  patchLoading: Record<string, boolean>;
}

const initialState: DrawState = {
  draws: [],
  loading: false,
  error: null,
  createLoading: false,
  patchLoading: {},
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
  async (
    { id, ...updates }: Partial<TicketDraw> & { id: string },
    { dispatch }
  ) => {
    const res = await fetch(`${API_DOMAIN}/ticket_draw/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    // After successful update, fetch latest ticket states
    await dispatch(fetchTickets());
    return data;
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
          state.error = null;
        }
      )
      .addCase(fetchDraws.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch draws';
        state.draws = [];
      })
      .addCase(createDraws.pending, (state) => {
        state.createLoading = true;
        state.error = null;
      })
      .addCase(
        createDraws.fulfilled,
        (state, action: PayloadAction<TicketDraw[]>) => {
          state.draws = action.payload;
          state.createLoading = false;
          state.error = null;
        }
      )
      .addCase(createDraws.rejected, (state, action) => {
        state.createLoading = false;
        state.error = action.error.message || 'Failed to create draws';
      })
      .addCase(patchDraw.pending, (state, action) => {
        state.patchLoading[action.meta.arg.id] = true;
        state.error = null;
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
          state.patchLoading[action.payload.id] = false;
          state.error = null;
        }
      )
      .addCase(patchDraw.rejected, (state, action) => {
        if (action.meta.arg.id) {
          state.patchLoading[action.meta.arg.id] = false;
        }
        state.error = action.error.message || 'Failed to update draw';
      })
      // Add handler for ticket deletion
      .addCase(deleteTicket.fulfilled, (state, action) => {
        state.draws = state.draws.filter(
          (draw) => draw.ticket_id !== action.payload
        );
      });
  },
});

export default drawSlice.reducer;
