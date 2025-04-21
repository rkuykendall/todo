import { Ticket } from '@todo/shared';
import { TicketDraw } from '../drawSlice';
import Button from './Button';
import Card from './Card';
import ColorIcon from './ColorIcon';
import { Alert, Typography } from 'antd';
import {
  UndoOutlined,
  CheckOutlined,
  CloseOutlined,
  HourglassOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface DrawProps {
  draw: TicketDraw;
  ticket?: Ticket;
  onMarkDone: (drawId: string) => void;
  onMarkSkipped: (drawId: string) => void;
  onUndo: (drawId: string) => void;
}

export function Draw({
  draw,
  ticket,
  onMarkDone,
  onMarkSkipped,
  onUndo,
}: DrawProps) {
  const { error, patchLoading } = useSelector(
    (state: RootState) => state.draws
  );
  const isLoading = patchLoading[draw.id];

  return (
    <Card
      actions={
        draw.done || draw.skipped
          ? [
              <Button
                icon={<UndoOutlined />}
                key="undo"
                loading={isLoading}
                onClick={() => onUndo(draw.id)}
              >
                Undo
              </Button>,
            ]
          : [
              <Button
                icon={<CheckOutlined />}
                key="done"
                loading={isLoading}
                onClick={() => onMarkDone(draw.id)}
                type="link"
              >
                Done
              </Button>,
              <Button
                key="skip"
                loading={isLoading}
                onClick={() => onMarkSkipped(draw.id)}
                type="text"
              >
                Skip
              </Button>,
            ]
      }
    >
      {ticket?.title && (
        <Typography.Title level={5}>{ticket.title}</Typography.Title>
      )}

      {error && <Alert message={error} type="error" />}
      <p>
        Status:{' '}
        {draw.done ? (
          <ColorIcon icon={<CheckOutlined />} label="Done" type="success" />
        ) : draw.skipped ? (
          <ColorIcon icon={<CloseOutlined />} label="Skipped" type="error" />
        ) : (
          <ColorIcon icon={<HourglassOutlined />} label="Pending" type="info" />
        )}
      </p>
    </Card>
  );
}

export default Draw;
