import type { Ticket } from '@todo/shared';
import Button from './Button';
import Card from './Card';
import DayIndicator from './DayIndicator';
import {
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { formatDate, formatAge } from '../utils';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { Space, Typography, Popconfirm, List, Card as AntCard } from 'antd';
import { updateTicket } from '../ticketSlice';

interface TicketCardProps {
  ticket: Ticket;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  index?: number;
}

export const SimpleTicketList = ({ tickets }: { tickets: Ticket[] }) => {
  return (
    <AntCard styles={{ body: { padding: 0 } }}>
      <List
        size="small"
        bordered={false}
        dataSource={tickets}
        renderItem={(ticket) => (
          <List.Item>
            <Typography.Text>{ticket.title}</Typography.Text>
          </List.Item>
        )}
      />
    </AntCard>
  );
};

export const TicketCard = ({
  ticket,
  onEdit,
  onDelete,
  index = 0,
}: TicketCardProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { updateLoading, deleteLoading } = useSelector(
    (state: RootState) => state.tickets
  );

  const isUpdateLoading = updateLoading[ticket.id];
  const isDeleteLoading = deleteLoading[ticket.id];

  const toggleDone = () => {
    dispatch(
      updateTicket({
        id: ticket.id,
        updates: {
          done: ticket.done ? null : new Date().toISOString(),
        },
      })
    );
  };

  return (
    <Card
      index={index}
      actions={[
        <Button
          icon={<EditOutlined />}
          key="edit"
          loading={isUpdateLoading}
          onClick={() => onEdit(ticket)}
          type="text"
        />,
        <Button
          icon={<CheckCircleOutlined />}
          key="done"
          loading={isUpdateLoading}
          onClick={toggleDone}
          type={ticket.done ? 'text' : 'link'}
        />,
        <Popconfirm
          key="delete"
          title="Delete Ticket"
          description={`Are you sure you want to delete "${ticket.title}"?`}
          okText="Yes"
          cancelText="No"
          okType="danger"
          onConfirm={() => onDelete(ticket.id)}
        >
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={isDeleteLoading}
            type="text"
          />
        </Popconfirm>,
      ]}
      title={<DayIndicator ticket={ticket} />}
    >
      <div>
        <Typography.Title level={5}>{ticket.title}</Typography.Title>
        <Space direction="vertical" size={2}>
          <div>Last drawn: {formatDate(ticket.last_drawn)}</div>
          <div>Created: {formatAge(ticket.created_at)}</div>
          {ticket.frequency !== 1 && (
            <div>Frequency: {ticket.frequency} days</div>
          )}
        </Space>
      </div>

      {ticket.deadline && <div>Deadline: {formatDate(ticket.deadline)}</div>}

      {ticket.done && <div>Done: {formatDate(ticket.done)}</div>}
    </Card>
  );
};
