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
import { Space, Typography } from 'antd';

interface TicketProps {
  ticket: TicketType;
  onEdit: (ticket: TicketType) => void;
  onDelete: (id: string) => void;
}

export function Ticket({ ticket, onEdit, onDelete }: TicketProps) {
  const { updateLoading, deleteLoading } = useSelector(
    (state: RootState) => state.tickets
  );

  const isUpdateLoading = updateLoading[ticket.id];
  const isDeleteLoading = deleteLoading[ticket.id];

  return (
    <Card
      actions={[
        <Button
          icon={<EditOutlined />}
          key="edit"
          loading={isUpdateLoading}
          onClick={() => onEdit(ticket)}
          type="text"
        />,
        <Button
          danger
          icon={<DeleteOutlined />}
          key="delete"
          loading={isDeleteLoading}
          onClick={() => onDelete(ticket.id)}
          type="text"
        />,
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
