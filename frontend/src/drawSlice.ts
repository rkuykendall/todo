import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { TicketDraw, UpdateTicketDrawInput } from '@todo/shared';
import { ticketDrawApi } from './api/services';
import { ApiRequestError } from './api/client';
import { deleteTicket, fetchTickets } from './ticketSlice';

interface DrawState {
  draws: TicketDraw[];
  loading: boolean;
  error: string | null;
  createLoading: boolean;
  patchLoading: Record<string, boolean>;
  clearLoading: boolean;
}

const initialState: DrawState = {
  draws: [],
  loading: false,
  error: null,
  createLoading: false,
  patchLoading: {},
  clearLoading: false,
};

// 🔄 Fetch today's draws
export const fetchDraws = createAsyncThunk('draws/fetchDraws', async () => {
  return await ticketDrawApi.getTodays();
});

// 📅 Create draws for today
export const createDraws = createAsyncThunk(
  'draws/createDraws',
  async (_, { rejectWithValue }) => {
    try {
      return await ticketDrawApi.createDraws();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        return rejectWithValue(error.data);
      }
      return rejectWithValue({ error: 'Failed to create draws' });
    }
  }
);

// 🧹 Clear all draws
export const clearDraws = createAsyncThunk(
  'draws/clearDraws',
  async (_, { dispatch }) => {
    const result = await ticketDrawApi.clearAll();
    // Refresh tickets after clearing draws
    await dispatch(fetchTickets());
    return result;
  }
);

// 🧩 Update a draw's status (PATCH)
export const patchDraw = createAsyncThunk(
  'draws/patchDraw',
  async (
    { id, ...updates }: UpdateTicketDrawInput & { id: string },
    { dispatch }
  ) => {
    const result = await ticketDrawApi.updateStatus(id, updates);
    // After successful update, fetch latest ticket states
    await dispatch(fetchTickets());
    return result;
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
      .addCase(clearDraws.pending, (state) => {
        state.clearLoading = true;
        state.error = null;
      })
      .addCase(clearDraws.fulfilled, (state) => {
        state.draws = [];
        state.clearLoading = false;
        state.error = null;
      })
      .addCase(clearDraws.rejected, (state, action) => {
        state.clearLoading = false;
        state.error = action.error.message || 'Failed to clear draws';
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
