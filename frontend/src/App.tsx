import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Ticket } from '@todo/shared';
import { ConfigProvider } from 'antd';
import { RootState, AppDispatch } from './store';
import {
  fetchTickets,
  addTicket,
  deleteTicket,
  updateTicket,
} from './ticketSlice';
import { fetchDraws, patchDraw, createDraws } from './drawSlice';
import TicketForm from './components/TicketForm';
import Button from './components/Button';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { tickets, loading: loadingTickets } = useSelector(
    (state: RootState) => state.tickets
  );
  const { draws, loading: loadingDraws } = useSelector(
    (state: RootState) => state.draws
  );
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
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 12,
          colorBgContainer: '#fefcf5',
          fontFamily: 'Comic Neue, sans-serif',
        },
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
        <h1>🎯 Today’s Draws</h1>
        <Button type="primary" onClick={() => dispatch(createDraws())}>
          🎲 Draw Tickets for Today
        </Button>

        {loadingDraws ? (
          <p>Loading draws...</p>
        ) : draws.length === 0 ? (
          <p>No draws today!</p>
        ) : (
          <ul>
            {draws.map((draw) => {
              const ticket = tickets.find((t) => t.id === draw.ticket_id);
              return (
                <li key={draw.id}>
                  <span>{ticket?.title || 'Untitled'}</span>{' '}
                  {draw.done || draw.skipped ? (
                    <Button
                      onClick={() => {
                        undoDraw(draw.id);
                      }}
                    >
                      ↩️ Undo
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="primary"
                        onClick={() => {
                          markDone(draw.id);
                        }}
                      >
                        ✅ Done
                      </Button>
                      <Button
                        danger
                        onClick={() => {
                          markSkipped(draw.id);
                        }}
                      >
                        ❌ Skip
                      </Button>
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
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <strong>{ticket.title}</strong>{' '}
                {ticket.done && <span>(Done)</span>}
                <Button
                  onClick={() => {
                    setEditingTicket(ticket);
                  }}
                >
                  ✏️ Edit
                </Button>
                <Button
                  danger
                  onClick={() => dispatch(deleteTicket(ticket.id))}
                >
                  ❌
                </Button>
              </li>
            ))}
          </ul>
        )}

        {editingTicket && (
          <div
            style={{
              background: '#333',
              padding: 16,
              border: '1px solid #ccc',
              marginTop: 16,
            }}
          >
            <h3>Edit Ticket</h3>
            <TicketForm
              key={editingTicket.id}
              initialValues={editingTicket}
              submitLabel="Save Changes"
              onSubmit={(updates) => {
                dispatch(updateTicket({ id: editingTicket.id, updates }));
                setEditingTicket(null);
              }}
            />
            <Button
              onClick={() => {
                setEditingTicket(null);
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
