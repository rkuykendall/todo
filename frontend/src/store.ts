import { configureStore } from "@reduxjs/toolkit";
import ticketSlice from "./ticketSlice";

const store = configureStore({
  reducer: {
    tickets: ticketSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
