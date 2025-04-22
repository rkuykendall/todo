import { Ticket as TicketType } from '@todo/shared';
import Button from './Button';
import Card from './Card';
import DayIndicator from './DayIndicator';
import {
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { formatDate } from '../utils';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Space, Typography, Popconfirm } from 'antd';

interface TicketProps {
  ticket: TicketType;
  onEdit: (ticket: TicketType) => void;
  onDelete: (id: string) => void;
  index?: number;
}

export function Ticket({ ticket, onEdit, onDelete, index = 0 }: TicketProps) {
  const { updateLoading, deleteLoading } = useSelector(
    (state: RootState) => state.tickets
  );

  const isUpdateLoading = updateLoading[ticket.id];
  const isDeleteLoading = deleteLoading[ticket.id];

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
      extra={ticket.done && <span>(Done)</span>}
      title={<DayIndicator ticket={ticket} />}
    >
      <Space direction="vertical">
        <div>
          <Typography.Title level={5}>{ticket.title}</Typography.Title>
          <div>Last drawn: {formatDate(ticket.last_drawn)}</div>
        </div>

        {ticket.deadline && (
          <div>
            <ClockCircleOutlined /> Deadline: {formatDate(ticket.deadline)}
          </div>
        )}
      </Space>
    </Card>
  );
}

export default Ticket;
