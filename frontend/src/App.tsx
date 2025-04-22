import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { Ticket as TicketType } from '@todo/shared';
import {
  ConfigProvider,
  Typography,
  Space,
  Alert,
  Spin,
  Radio,
  Row,
  Col,
} from 'antd';
import { SyncOutlined, PlusOutlined } from '@ant-design/icons';
import type { RootState, AppDispatch } from './store';
import {
  fetchTickets,
  addTicket,
  deleteTicket,
  updateTicket,
} from './ticketSlice';
import { fetchDraws, patchDraw, createDraws } from './drawSlice';
import TicketForm from './components/TicketForm';
import Button from './components/Button';
import { TicketCard } from './components/Ticket';
import { DrawCard } from './components/Draw';

type TicketFilter = 'all' | 'active' | 'done';

const LoadingWrapper = ({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) => (
  <Spin spinning={loading} size="large">
    <div style={{ minHeight: loading ? '200px' : 'auto' }}>{children}</div>
  </Spin>
);

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    tickets,
    loading: loadingTickets,
    error: ticketError,
    addLoading,
  } = useSelector((state: RootState) => state.tickets);
  const {
    draws,
    loading: loadingDraws,
    error: drawError,
    createLoading,
  } = useSelector((state: RootState) => state.draws);
  const [editingTicket, setEditingTicket] = useState<TicketType | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('active');

  useEffect(() => {
    dispatch(fetchTickets());
    dispatch(fetchDraws());
  }, [dispatch]);

  const filteredTickets = tickets.filter((ticket) => {
    switch (ticketFilter) {
      case 'active':
        return !ticket.done;
      case 'done':
        return !!ticket.done;
      default:
        return true;
    }
  });

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
          colorPrimary: '#4fa4f7',
          colorSuccess: '#53c66e',
          colorError: '#f05252',
          colorWarning: '#f6c542',
        },
      }}
    >
      <div style={{ maxWidth: 1064, margin: '0 auto', padding: '1rem' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Typography.Title level={1} style={{ margin: 0 }}>
                Today's Draws
              </Typography.Title>
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<SyncOutlined spin={createLoading} />}
                  loading={createLoading || loadingDraws || loadingTickets}
                  onClick={() => dispatch(createDraws())}
                  type="primary"
                  disabled={draws.length >= 5}
                >
                  Draw Tickets for Today
                </Button>

                <Button
                  icon={<PlusOutlined />}
                  loading={addLoading}
                  onClick={() => setIsAddModalOpen(true)}
                >
                  Add Ticket
                </Button>
              </Space>
            </Col>
          </Row>

          {drawError && (
            <Alert
              message="Error"
              description={drawError}
              type="error"
              showIcon
            />
          )}

          <LoadingWrapper loading={loadingDraws}>
            {!loadingDraws && draws.length === 0 ? (
              <Alert
                message="No draws available"
                description="There are no tickets drawn for today. Click 'Draw Tickets for Today' to get started."
                type="info"
                showIcon
              />
            ) : (
              <Space wrap>
                {draws.map((draw, index) => (
                  <DrawCard
                    draw={draw}
                    key={draw.id}
                    index={index}
                    onMarkDone={markDone}
                    onMarkSkipped={markSkipped}
                    onUndo={undoDraw}
                    ticket={tickets.find((t) => t.id === draw.ticket_id)}
                  />
                ))}
              </Space>
            )}
          </LoadingWrapper>

          <Row align="middle" justify="space-between">
            <Col>
              <Typography.Title level={2} style={{ margin: 0 }}>
                All Tickets
              </Typography.Title>
            </Col>
            <Col>
              <Radio.Group
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="all">All</Radio.Button>
                <Radio.Button value="active">Active</Radio.Button>
                <Radio.Button value="done">Done</Radio.Button>
              </Radio.Group>
            </Col>
          </Row>

          {ticketError && (
            <Alert
              message="Error"
              description={ticketError}
              type="error"
              showIcon
            />
          )}

          <LoadingWrapper loading={loadingTickets}>
            {!loadingTickets && filteredTickets.length === 0 ? (
              <Alert
                message={
                  ticketFilter === 'done'
                    ? 'No completed tickets'
                    : ticketFilter === 'active'
                      ? 'No active tickets'
                      : 'No tickets found'
                }
                description={
                  ticketFilter === 'all'
                    ? 'Add your first ticket to get started!'
                    : undefined
                }
                type="info"
                showIcon
              />
            ) : (
              <Space wrap>
                {filteredTickets.map((ticket, index) => (
                  <TicketCard
                    key={ticket.id}
                    index={index}
                    onDelete={(id: string) => dispatch(deleteTicket(id))}
                    onEdit={setEditingTicket}
                    ticket={ticket}
                  />
                ))}
              </Space>
            )}
          </LoadingWrapper>

          <TicketForm
            onCancel={() => setIsAddModalOpen(false)}
            onSubmit={(ticket) => {
              dispatch(addTicket(ticket));
              setIsAddModalOpen(false);
            }}
            open={isAddModalOpen}
            title="Add New Ticket"
          />

          <TicketForm
            initialValues={editingTicket || undefined}
            onCancel={() => setEditingTicket(null)}
            onSubmit={(updates) => {
              if (editingTicket) {
                dispatch(updateTicket({ id: editingTicket.id, updates }));
                setEditingTicket(null);
              }
            }}
            open={!!editingTicket}
            title="Edit Ticket"
          />
        </Space>
      </div>
    </ConfigProvider>
  );
}

export default App;
