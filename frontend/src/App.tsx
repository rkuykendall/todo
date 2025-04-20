import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Ticket as TicketType } from '@todo/shared';
import { ConfigProvider, Typography, Space } from 'antd';
import { SyncOutlined, PlusOutlined } from '@ant-design/icons';
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
        <Space direction="vertical" size="large">
          <Typography.Title level={1}>Today's Draws</Typography.Title>
          <Space>
            <Button
              type="primary"
              onClick={() => dispatch(createDraws())}
              icon={<SyncOutlined />}
            >
              Draw Tickets for Today
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              icon={<PlusOutlined />}
            >
              Add Ticket
            </Button>
          </Space>

          {loadingDraws ? (
            <p>Loading draws...</p>
          ) : draws.length === 0 ? (
            <p>No draws today!</p>
          ) : (
            <Space wrap>
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
            </Space>
          )}

          <Typography.Title level={2}>All Tickets</Typography.Title>
          {loadingTickets ? (
            <p>Loading tickets...</p>
          ) : (
            <Space wrap>
              {tickets.map((ticket) => (
                <Ticket
                  key={ticket.id}
                  ticket={ticket}
                  onEdit={setEditingTicket}
                  onDelete={(id) => dispatch(deleteTicket(id))}
                />
              ))}
            </Space>
          )}

          <TicketForm
            title="Add New Ticket"
            open={isAddModalOpen}
            onCancel={() => setIsAddModalOpen(false)}
            onSubmit={(ticket) => {
              dispatch(addTicket(ticket));
              setIsAddModalOpen(false);
            }}
          />

          <TicketForm
            title="Edit Ticket"
            open={!!editingTicket}
            onCancel={() => setEditingTicket(null)}
            initialValues={editingTicket || undefined}
            onSubmit={(updates) => {
              if (editingTicket) {
                dispatch(updateTicket({ id: editingTicket.id, updates }));
                setEditingTicket(null);
              }
            }}
          />
        </Space>
      </div>
    </ConfigProvider>
  );
}

export default App;
