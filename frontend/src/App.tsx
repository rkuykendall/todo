import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "./store";
import {
  fetchTickets,
  addTicket,
  deleteTicket,
  updateTicket,
  Ticket,
} from "./ticketSlice";
import {
  fetchDraws,
  patchDraw,
  createDraws,
} from "./drawSlice";
import TicketForm from "./components/TicketForm";

const weekdays = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { tickets, loading: loadingTickets } = useSelector((state: RootState) => state.tickets);
  const { draws, loading: loadingDraws } = useSelector((state: RootState) => state.draws);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    dispatch(fetchTickets());
    dispatch(fetchDraws());
  }, [dispatch]);

  const markDone = (drawId: string) => {
    dispatch(patchDraw({ id: drawId, done: true, skipped: false }));
  };

  const markSkipped = (drawId: string) => {
    dispatch(patchDraw({ id: drawId, done: false, skipped: true }));
  };

  const undoDraw = (drawId: string) => {
    dispatch(patchDraw({ id: drawId, done: false, skipped: false }));
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "1rem" }}>
      <h1>🎯 Today’s Draws</h1>
      <button onClick={() => dispatch(createDraws())}>🎲 Draw Tickets for Today</button>

      {loadingDraws ? (
        <p>Loading draws...</p>
      ) : draws.length === 0 ? (
        <p>No draws today!</p>
      ) : (
        <ul>
          {draws.map(draw => {
            const ticket = tickets.find(t => t.id === draw.ticket_id);
            return (
              <li key={draw.id}>
                <span>{ticket?.title || "Untitled"}</span>{" "}
                {draw.done || draw.skipped ? (
                  <button onClick={() => undoDraw(draw.id)}>↩️ Undo</button>
                ) : (
                  <>
                    <button onClick={() => markDone(draw.id)}>✅ Done</button>
                    <button onClick={() => markSkipped(draw.id)}>❌ Skip</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <hr />

      <TicketForm
        submitLabel="Add Ticket"
        onSubmit={(ticket) => dispatch(addTicket(ticket))}
      />

      <hr />

      <h2>🗂 All Tickets</h2>
      {loadingTickets ? (
        <p>Loading tickets...</p>
      ) : (
        <ul>
          {tickets.map(ticket => (
            <li key={ticket.id}>
              <strong>{ticket.title}</strong>{" "}
              {ticket.done && <span>(Done)</span>}
              <button onClick={() => setEditingTicket(ticket)}>✏️ Edit</button>
              <button onClick={() => dispatch(deleteTicket(ticket.id))}>❌</button>
            </li>
          ))}
        </ul>
      )}

      {editingTicket && (
        <div style={{
          background: "#333",
          padding: 16,
          border: "1px solid #ccc",
          marginTop: 16
        }}>
          <h3>Edit Ticket</h3>
          <TicketForm
            initialValues={editingTicket}
            submitLabel="Save Changes"
            onSubmit={(updates) => {
              dispatch(updateTicket({ id: editingTicket.id, updates }));
              setEditingTicket(null);
            }}
          />
          <button onClick={() => setEditingTicket(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default App;
