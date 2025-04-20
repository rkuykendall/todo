import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Ticket as TicketType } from '@todo/shared';
import { ConfigProvider } from 'antd';
import { AimOutlined, SyncOutlined } from '@ant-design/icons';
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
import Card from './components/Card';
import Draw from './components/Draw';
import Ticket from './components/Ticket';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { tickets, loading: loadingTickets } = useSelector(
    (state: RootState) => state.tickets
  );
  const { draws, loading: loadingDraws } = useSelector(
    (state: RootState) => state.draws
  );
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);

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
          colorPrimary: '#1677ff',
        },
      }}
    >
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
        <h1>
          <AimOutlined /> Today's Draws
        </h1>
        <Button
          type="primary"
          onClick={() => dispatch(createDraws())}
          icon={<SyncOutlined />}
        >
          Draw Tickets for Today
        </Button>

        {loadingDraws ? (
          <p>Loading draws...</p>
        ) : draws.length === 0 ? (
          <p>No draws today!</p>
        ) : (
          <div style={{ marginTop: 16 }}>
            {draws.map((draw) => (
              <Draw
                key={draw.id}
                draw={draw}
                ticket={tickets.find((t) => t.id === draw.ticket_id)}
                onMarkDone={markDone}
                onMarkSkipped={markSkipped}
                onUndo={undoDraw}
              />
            ))}
          </div>
        )}

        <Card style={{ margin: '24px 0' }}>
          <TicketForm
            submitLabel="Add Ticket"
            onSubmit={(ticket) => dispatch(addTicket(ticket))}
          />
        </Card>

        <h2>
          <AimOutlined /> All Tickets
        </h2>
        {loadingTickets ? (
          <p>Loading tickets...</p>
        ) : (
          <div>
            {tickets.map((ticket) => (
              <Ticket
                key={ticket.id}
                ticket={ticket}
                onEdit={setEditingTicket}
                onDelete={(id) => dispatch(deleteTicket(id))}
              />
            ))}
          </div>
        )}

        {editingTicket && (
          <Card style={{ marginTop: 16 }} title="Edit Ticket">
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
          </Card>
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
