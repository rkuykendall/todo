import { configureStore } from '@reduxjs/toolkit';
import ticketReducer from './ticketSlice';
import drawReducer from './drawSlice';
import historyReducer from './historySlice';

const store = configureStore({
  reducer: {
    tickets: ticketReducer,
    draws: drawReducer,
    history: historyReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
