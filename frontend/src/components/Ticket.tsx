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

interface TicketProps {
  ticket: TicketType;
  onEdit: (ticket: TicketType) => void;
  onDelete: (id: string) => void;
}

export function Ticket({ ticket, onEdit, onDelete }: TicketProps) {
  return (
    <Card
      actions={[
        <Button
          icon={<EditOutlined />}
          key="edit"
          onClick={() => onEdit(ticket)}
          type="text"
        />,
        <Button
          danger
          icon={<DeleteOutlined />}
          key="delete"
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
