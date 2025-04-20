import { Ticket as TicketType, dayFields } from '@todo/shared';
import Button from './Button';
import Card from './Card';
import ColorIcon from './ColorIcon';
import {
  EditOutlined,
  DeleteOutlined,
  SunOutlined,
  CoffeeOutlined,
} from '@ant-design/icons';
import { Space } from 'antd';

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
      <div>
        Last drawn:{' '}
        {ticket.last_drawn
          ? new Date(ticket.last_drawn).toLocaleDateString()
          : 'Never'}
      </div>

      <div>
        Draw days:{' '}
        <Space>
          {dayFields.map((day, idx) => {
            const canDraw = ticket[`can_draw_${day}` as keyof TicketType];
            const icon = idx < 5 ? <CoffeeOutlined /> : <SunOutlined />;

            return canDraw ? (
              <ColorIcon key={day} icon={icon} />
            ) : (
              <ColorIcon key={day} icon={icon} type="disabled" />
            );
          })}
        </Space>
      </div>
    </Card>
  );
}

export default Ticket;
