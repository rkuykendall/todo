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
      style={{ marginBottom: 16 }}
      title={ticket.title}
    >
      <div>Last drawn: {formatDate(ticket.last_drawn)}</div>

      {ticket.deadline && (
        <div>
          <ClockCircleOutlined /> Deadline: {formatDate(ticket.deadline)}
        </div>
      )}

      <div>
        Draw days: <DayIndicator canDraw={ticket} mustDraw={ticket} />
      </div>
    </Card>
  );
}

export default Ticket;
