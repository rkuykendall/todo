import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { Ticket as TicketType } from '@todo/shared';
import {
  ConfigProvider,
  Typography,
  Alert,
  Spin,
  Radio,
  message,
  Switch,
  Space as AntSpace,
  Popconfirm,
} from 'antd';
import {
  SyncOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import type { RootState, AppDispatch } from './store';
import {
  fetchTickets,
  addTicket,
  deleteTicket,
  updateTicket,
} from './ticketSlice';
import { fetchDraws, patchDraw, createDraws, clearDraws } from './drawSlice';
import TicketForm from './components/TicketForm';
import Button from './components/Button';
import Space from './components/Space';
import { TicketCard, SimpleTicketList } from './components/Ticket';
import { DrawCard } from './components/Draw';
import Login from './components/Login';
import { API_DOMAIN } from './utils';
import Header from './components/Header';

type TicketFilter = 'tasks' | 'recurring' | 'done';

const TOKEN_KEY = 'todoAppToken';

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
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>('tasks');
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(TOKEN_KEY)
  );
  const [loginError, setLoginError] = useState<string>();
  const screens = useBreakpoint();
  const [messageApi, contextHolder] = message.useMessage();
  const [isListView, setIsListView] = useState(false);

  const handleLogin = async (password: string) => {
    setLoginError(undefined);
    try {
      // Test the password by making a request
      const response = await fetch(`${API_DOMAIN}/tickets`, {
        headers: {
          Authorization: `Bearer ${password}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid password');
      }

      // If we get here, the password worked
      localStorage.setItem(TOKEN_KEY, password);
      setToken(password);
    } catch (error) {
      setLoginError('Invalid password');
      throw error;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  // Setup authorization header for all API requests
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.includes(API_DOMAIN)) {
        const headers = new Headers(init?.headers || {});
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init = {
          ...init,
          headers,
        };
      }
      const response = await originalFetch(input, init);
      if (response.status === 401) {
        handleLogout();
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [token]);

  // Load initial data when logged in
  useEffect(() => {
    if (token) {
      dispatch(fetchTickets());
      dispatch(fetchDraws());
    }
  }, [dispatch, token]);

  if (!token) {
    return <Login onLogin={handleLogin} error={loginError} />;
  }

  // Sort draws by status: pending first, then done, then skipped
  const sortedDraws = [...draws].sort((a, b) => {
    // Pending draws (neither done nor skipped)
    if (!a.done && !a.skipped && (b.done || b.skipped)) return -1;
    if (!b.done && !b.skipped && (a.done || a.skipped)) return 1;

    // Done draws before skipped draws
    if (a.done && b.skipped) return -1;
    if (b.done && a.skipped) return 1;

    // Keep original order within each status group
    return 0;
  });

  const filteredTickets = tickets.filter((ticket) => {
    switch (ticketFilter) {
      case 'tasks':
        return !ticket.done && !ticket.recurring;
      case 'recurring':
        return !ticket.done && ticket.recurring;
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
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: !screens.sm ? 40 : 32,
            fontSize: !screens.sm ? 16 : 14,
            paddingInline: !screens.sm ? 16 : 15,
          },
        },
      }}
    >
      {contextHolder}
      <div
        style={{
          maxWidth: 1064,
          margin: '0 auto',
          padding: '1rem',
          width: '100%',
        }}
      >
        <Space direction="vertical" size="large" block>
          <Header
            title={
              <Typography.Title level={1} style={{ margin: 0 }}>
                Today's Draws
              </Typography.Title>
            }
            actions={
              <Space desktop block={!screens.sm}>
                <Popconfirm
                  title="Are you sure you want to clear all draws?"
                  onConfirm={() => dispatch(clearDraws())}
                  okText="Yes"
                  cancelText="No"
                >
                  {/* <Button block={!screens.sm} type="text" danger>
                    Clear Draws
                  </Button> */}
                </Popconfirm>
                <Button block={!screens.sm} onClick={handleLogout} type="text">
                  Logout
                </Button>
                <Button
                  block={!screens.sm}
                  icon={<SyncOutlined spin={createLoading} />}
                  loading={createLoading || loadingDraws || loadingTickets}
                  onClick={async () => {
                    const result = await dispatch(createDraws());
                    if (createDraws.rejected.match(result)) {
                      const payload = result.payload as { error: string };
                      messageApi.warning(payload.error);
                    } else {
                      // Refresh draws after creating them
                      dispatch(fetchDraws());
                    }
                  }}
                  type="primary"
                  disabled={draws.length >= 5}
                >
                  Draw Tickets for Today
                </Button>
                <Button
                  block={!screens.sm}
                  icon={<PlusOutlined />}
                  loading={addLoading}
                  onClick={() => setIsAddModalOpen(true)}
                  type="primary"
                >
                  Add Ticket
                </Button>
              </Space>
            }
          />

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
              <Space
                wrap={screens.sm}
                direction={screens.sm ? 'horizontal' : 'vertical'}
                block={!screens.sm}
                desktop
              >
                {sortedDraws.map((draw, index) => (
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

          <Header
            title={
              <Typography.Title level={2} style={{ margin: 0 }}>
                All Tickets
              </Typography.Title>
            }
            actions={
              <AntSpace>
                <Radio.Group
                  value={ticketFilter}
                  onChange={(e) => setTicketFilter(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="tasks">Tasks</Radio.Button>
                  <Radio.Button value="recurring">Recurring</Radio.Button>
                  <Radio.Button value="done">Done</Radio.Button>
                </Radio.Group>
                <Switch
                  checkedChildren={<UnorderedListOutlined />}
                  unCheckedChildren={<AppstoreOutlined />}
                  checked={isListView}
                  onChange={setIsListView}
                />
              </AntSpace>
            }
          />

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
                    : ticketFilter === 'tasks'
                      ? 'No active tasks'
                      : 'No recurring tickets'
                }
                description={undefined}
                type="info"
                showIcon
              />
            ) : isListView ? (
              <SimpleTicketList tickets={filteredTickets} />
            ) : (
              <Space
                wrap={screens.sm}
                direction={screens.sm ? 'horizontal' : 'vertical'}
                style={{ width: '100%' }}
              >
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
              dispatch(addTicket(ticket))
                .unwrap()
                .then(() => {
                  setIsAddModalOpen(false);
                  messageApi.success('Ticket added successfully');
                })
                .catch((error) => {
                  // The error will be handled by the TicketForm component
                  throw error;
                });
            }}
            open={isAddModalOpen}
            title="Add New Ticket"
          />

          <TicketForm
            initialValues={editingTicket || undefined}
            onCancel={() => setEditingTicket(null)}
            onSubmit={(updates) => {
              if (editingTicket) {
                dispatch(updateTicket({ id: editingTicket.id, updates }))
                  .unwrap()
                  .then(() => {
                    setEditingTicket(null);
                    messageApi.success('Ticket updated successfully');
                  })
                  .catch((error) => {
                    // The error will be handled by the TicketForm component
                    throw error;
                  });
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
