import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DailyHistory } from '@todo/shared';
import { historyApi } from './api/services';

interface HistoryState {
  history: DailyHistory[];
  loading: boolean;
  error: string | null;
}

const initialState: HistoryState = {
  history: [],
  loading: false,
  error: null,
};

// Async thunk for fetching daily history
export const fetchDailyHistory = createAsyncThunk(
  'history/fetchDaily',
  async (_, { rejectWithValue }) => {
    try {
      const response = await historyApi.getDailyHistory();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch history:', error);
      return rejectWithValue('Failed to fetch history data');
    }
  }
);

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = Array.isArray(action.payload) ? action.payload : [];
        state.error = null;
      })
      .addCase(fetchDailyHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch history';
      });
  },
});

export default historySlice.reducer;
