import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "./store";
import { fetchTickets, addTicket, deleteTicket } from "./ticketSlice";

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { tickets, loading, error } = useSelector((state: RootState) => state.tickets);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const handleAddTicket = () => {
    if (!newTitle.trim()) return;

    dispatch(
      addTicket({
        title: newTitle,
        // You can also set defaults for any other fields if needed
        done_on_child_done: false,
        deadline: null,
        last_drawn: null,
        done: null,
        can_draw_monday: true, // default: allow draw today?
        must_draw_monday: false,
        can_draw_tuesday: false,
        must_draw_tuesday: false,
        can_draw_wednesday: false,
        must_draw_wednesday: false,
        can_draw_thursday: false,
        must_draw_thursday: false,
        can_draw_friday: false,
        must_draw_friday: false,
        can_draw_saturday: false,
        must_draw_saturday: false,
        can_draw_sunday: false,
        must_draw_sunday: false,
      })
    );

    setNewTitle("");
  };

  return (
    <div>
      <h1>Ticket List</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <label>
        New Ticket:{" "}
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Enter a ticket title"
        />
      </label>
      <button onClick={handleAddTicket} disabled={!newTitle.trim()}>
        Add
      </button>

      {loading ? (
        <p>Loading tickets...</p>
      ) : (
        <ul>
          {tickets.map(ticket => (
            <li key={ticket.id} style={{ textDecoration: ticket.done ? "line-through" : "none" }}>
              {ticket.title}
              <button onClick={() => dispatch(deleteTicket(ticket.id))}>❌</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
