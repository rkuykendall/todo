import { configureStore } from "@reduxjs/toolkit";
import ticketReducer from "./ticketSlice";
import drawReducer from "./drawSlice";

const store = configureStore({
  reducer: {
    tickets: ticketReducer,
    draws: drawReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
