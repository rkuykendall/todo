import { Ticket as TicketType } from '@todo/shared';
import Button from './Button';
import Card from './Card';
import DayIndicator from './DayIndicator';
import {
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { formatDate } from '../utils';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { Space, Typography, Popconfirm } from 'antd';
import { updateTicket } from '../ticketSlice';

interface TicketProps {
  ticket: TicketType;
  onEdit: (ticket: TicketType) => void;
  onDelete: (id: string) => void;
  index?: number;
}

export function Ticket({ ticket, onEdit, onDelete, index = 0 }: TicketProps) {
  const dispatch = useDispatch();
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
          done: ticket.done ? null : formatDate(new Date()),
        },
      })
    );
  };

  return (
    <Card
      index={index}
      done={!!ticket.done}
      actions={[
        <Button
          icon={<CheckCircleOutlined />}
          key="done"
          loading={isUpdateLoading}
          onClick={toggleDone}
          type={ticket.done ? 'text' : 'link'}
        />,
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
      title={<DayIndicator ticket={ticket} />}
    >
      <Space direction="vertical">
        <div>
          <Typography.Title level={5}>{ticket.title}</Typography.Title>
          <Space direction="vertical" size={2}>
            <div>
              <ClockCircleOutlined /> Last drawn:{' '}
              {formatDate(ticket.last_drawn)}
            </div>
            {ticket.frequency !== 1 && (
              <div>
                <CalendarOutlined /> Frequency: {ticket.frequency} days
              </div>
            )}
          </Space>
        </div>

        {ticket.deadline && (
          <div>
            <ClockCircleOutlined /> Deadline: {formatDate(ticket.deadline)}
          </div>
        )}

        {ticket.done && (
          <div>
            <CheckCircleOutlined /> Done: {formatDate(ticket.done)}
          </div>
        )}
      </Space>
    </Card>
  );
}

export default Ticket;
