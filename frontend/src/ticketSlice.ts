import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Ticket } from '@todo/shared';
import { API_DOMAIN } from './utils';

// Define error payload type
interface ErrorPayload {
  error?: string;
}

interface TicketState {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  addLoading: boolean;
  updateLoading: Record<string, boolean>;
  deleteLoading: Record<string, boolean>;
}

const initialState: TicketState = {
  tickets: [],
  loading: false,
  error: null,
  addLoading: false,
  updateLoading: {},
  deleteLoading: {},
};

// Fetch all tickets
export const fetchTickets = createAsyncThunk(
  'tickets/fetchTickets',
  async () => {
    const res = await fetch(`${API_DOMAIN}/tickets`);
    return res.json();
  }
);

// Add a new ticket
export const addTicket = createAsyncThunk<
  Ticket,
  Partial<Ticket>,
  { rejectValue: ErrorPayload }
>('tickets/addTicket', async (data, { rejectWithValue }) => {
  try {
    const res = await fetch(`${API_DOMAIN}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      return rejectWithValue(result);
    }

    // Fetch the complete ticket data
    const ticketRes = await fetch(`${API_DOMAIN}/tickets/${result.id}`);
    if (!ticketRes.ok) {
      const errorData = await ticketRes.json();
      return rejectWithValue(errorData);
    }

    return await ticketRes.json();
  } catch {
    return rejectWithValue({ error: 'Failed to add ticket' });
  }
});

export const updateTicket = createAsyncThunk<
  Ticket,
  { id: string; updates: Partial<Ticket> },
  { rejectValue: ErrorPayload }
>('tickets/updateTicket', async ({ id, updates }, { rejectWithValue }) => {
  try {
    const res = await fetch(`${API_DOMAIN}/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return rejectWithValue(errorData);
    }

    const updated = await fetch(`${API_DOMAIN}/tickets/${id}`);
    if (!updated.ok) {
      const errorData = await updated.json();
      return rejectWithValue(errorData);
    }

    return await updated.json();
  } catch {
    return rejectWithValue({ error: 'Failed to update ticket' });
  }
});

// Delete a ticket
export const deleteTicket = createAsyncThunk(
  'tickets/deleteTicket',
  async (id: string) => {
    await fetch(`${API_DOMAIN}/tickets/${id}`, { method: 'DELETE' });
    return id;
  }
);

const ticketSlice = createSlice({
  name: 'tickets',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchTickets.fulfilled,
        (state, action: PayloadAction<Ticket[]>) => {
          state.tickets = action.payload;
          state.loading = false;
          state.error = null;
        }
      )
      .addCase(fetchTickets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch tickets';
        state.tickets = [];
      })
      .addCase(addTicket.pending, (state) => {
        state.addLoading = true;
        state.error = null;
      })
      .addCase(addTicket.fulfilled, (state, action: PayloadAction<Ticket>) => {
        state.tickets.push(action.payload);
        state.addLoading = false;
        state.error = null;
      })
      .addCase(addTicket.rejected, (state, action) => {
        state.addLoading = false;
        state.error =
          action.payload?.error ||
          action.error.message ||
          'Failed to add ticket';
      })
      .addCase(updateTicket.pending, (state, action) => {
        state.updateLoading[action.meta.arg.id] = true;
        state.error = null;
      })
      .addCase(
        updateTicket.fulfilled,
        (state, action: PayloadAction<Ticket>) => {
          const index = state.tickets.findIndex(
            (ticket) => ticket.id === action.payload.id
          );
          if (index !== -1) {
            state.tickets[index] = action.payload;
          }
          state.updateLoading[action.payload.id] = false;
          state.error = null;
        }
      )
      .addCase(updateTicket.rejected, (state, action) => {
        if (action.meta.arg.id) {
          state.updateLoading[action.meta.arg.id] = false;
        }
        state.error =
          action.payload?.error ||
          action.error.message ||
          'Failed to update ticket';
      })
      .addCase(deleteTicket.pending, (state, action) => {
        state.deleteLoading[action.meta.arg] = true;
        state.error = null;
      })
      .addCase(
        deleteTicket.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.tickets = state.tickets.filter(
            (ticket) => ticket.id !== action.payload
          );
          state.deleteLoading[action.payload] = false;
          state.error = null;
        }
      )
      .addCase(deleteTicket.rejected, (state, action) => {
        if (typeof action.meta.arg === 'string') {
          state.deleteLoading[action.meta.arg] = false;
        }
        state.error = action.error.message || 'Failed to delete ticket';
      });
  },
});

export default ticketSlice.reducer;
