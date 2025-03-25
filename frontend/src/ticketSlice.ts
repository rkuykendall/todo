import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

export interface Ticket {
  id: string;
  title: string;
  done_on_child_done: boolean;
  done: string | null;
  last_drawn: string | null;
  deadline: string | null;

  can_draw_monday: boolean;
  must_draw_monday: boolean;
  can_draw_tuesday: boolean;
  must_draw_tuesday: boolean;
  can_draw_wednesday: boolean;
  must_draw_wednesday: boolean;
  can_draw_thursday: boolean;
  must_draw_thursday: boolean;
  can_draw_friday: boolean;
  must_draw_friday: boolean;
  can_draw_saturday: boolean;
  must_draw_saturday: boolean;
  can_draw_sunday: boolean;
  must_draw_sunday: boolean;
}

interface TicketState {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
}

const API_DOMAIN = import.meta.env.VITE_API_DOMAIN || "http://localhost:4000";

const initialState: TicketState = {
  tickets: [],
  loading: false,
  error: null,
};

// Fetch all tickets
export const fetchTickets = createAsyncThunk("tickets/fetchTickets", async () => {
  const res = await fetch(`${API_DOMAIN}/tickets`);
  return res.json();
});

// Add a new ticket
export const addTicket = createAsyncThunk("tickets/addTicket", async (data: Partial<Ticket>) => {
  const res = await fetch(`${API_DOMAIN}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  return { ...data, id: result.id } as Ticket;
});

export const updateTicket = createAsyncThunk(
  "tickets/updateTicket",
  async ({ id, updates }: { id: string; updates: Partial<Ticket> }) => {
    const res = await fetch(`${API_DOMAIN}/tickets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!res.ok) throw new Error("Failed to update ticket");

    const updated = await fetch(`${API_DOMAIN}/tickets/${id}`);
    return await updated.json();
  }
);

// Delete a ticket
export const deleteTicket = createAsyncThunk("tickets/deleteTicket", async (id: string) => {
  await fetch(`${API_DOMAIN}/tickets/${id}`, { method: "DELETE" });
  return id;
});

const ticketSlice = createSlice({
  name: "tickets",
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchTickets.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action: PayloadAction<Ticket[]>) => {
        state.tickets = action.payload;
        state.loading = false;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch tickets";
      })
      .addCase(addTicket.fulfilled, (state, action: PayloadAction<Ticket>) => {
        state.tickets.push(action.payload);
      })
      .addCase(deleteTicket.fulfilled, (state, action: PayloadAction<string>) => {
        state.tickets = state.tickets.filter(ticket => ticket.id !== action.payload);
      })
      .addCase(updateTicket.fulfilled, (state, action: PayloadAction<Ticket>) => {
        const index = state.tickets.findIndex(ticket => ticket.id === action.payload.id);
        if (index !== -1) {
          state.tickets[index] = action.payload;
        }
      });   
  },
});

export default ticketSlice.reducer;
