import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "./store";
import { fetchTickets, addTicket, deleteTicket } from "./ticketSlice";
import { fetchDraws, patchDraw } from "./drawSlice";
import { createDraws } from "./drawSlice";

const weekdays = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
];

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { tickets, loading: loadingTickets } = useSelector((state: RootState) => state.tickets);
  const { draws, loading: loadingDraws } = useSelector((state: RootState) => state.draws);
  const [newTitle, setNewTitle] = useState("");
  const [dayChecks, setDayChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(weekdays.map(day => [`can_draw_${day}`, true]))
  );

  useEffect(() => {
    dispatch(fetchTickets());
    dispatch(fetchDraws());
  }, [dispatch]);

  const handleAddTicket = () => {
    if (!newTitle.trim()) return;

    dispatch(
      addTicket({
        title: newTitle,
        done_on_child_done: false,
        deadline: null,
        last_drawn: null,
        done: null,
        ...dayChecks,
        ...Object.fromEntries(weekdays.map(day => [`must_draw_${day}`, false])),
      })
    );

    setNewTitle("");
    setDayChecks(Object.fromEntries(weekdays.map(day => [`can_draw_${day}`, false])));
  };

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

      <h2>➕ Add Ticket</h2>
      <input
        value={newTitle}
        onChange={e => setNewTitle(e.target.value)}
        placeholder="Ticket title"
      />
      <div>
        {weekdays.map(day => (
          <label key={day} style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={dayChecks[`can_draw_${day}`]}
              onChange={e =>
                setDayChecks(prev => ({
                  ...prev,
                  [`can_draw_${day}`]: e.target.checked
                }))
              }
            />
            {day.slice(0, 3)}
          </label>
        ))}
      </div>
      <button onClick={handleAddTicket} disabled={!newTitle.trim()}>
        Add Ticket
      </button>

      <hr />

      <h2>🗂 All Tickets</h2>
      {loadingTickets ? (
        <p>Loading tickets...</p>
      ) : (
        <ul>
          {tickets.map(ticket => (
            <li key={ticket.id}>
              <strong>{ticket.title}</strong>
              {" "}
              {ticket.done && <span>(Done)</span>}
              <button onClick={() => dispatch(deleteTicket(ticket.id))}>❌</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
