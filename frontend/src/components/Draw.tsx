import { Ticket } from '@todo/shared';
import { TicketDraw } from '../drawSlice';
import Button from './Button';
import Card from './Card';
import ColorIcon from './ColorIcon';
import {
  UndoOutlined,
  CheckOutlined,
  CloseOutlined,
  HourglassOutlined,
} from '@ant-design/icons';

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
  return (
    <Card
      title={ticket?.title || 'Untitled'}
      actions={
        draw.done || draw.skipped
          ? [
              <Button
                key="undo"
                onClick={() => onUndo(draw.id)}
                icon={<UndoOutlined />}
              >
                Undo
              </Button>,
            ]
          : [
              <Button
                key="done"
                type="link"
                onClick={() => onMarkDone(draw.id)}
                icon={<CheckOutlined />}
              >
                Done
              </Button>,
              <Button
                key="skip"
                onClick={() => onMarkSkipped(draw.id)}
                type="text"
              >
                Skip
              </Button>,
            ]
      }
    >
      <p>
        Status:{' '}
        {draw.done ? (
          <ColorIcon icon={<CheckOutlined />} type="success" label="Done" />
        ) : draw.skipped ? (
          <ColorIcon icon={<CloseOutlined />} type="error" label="Skipped" />
        ) : (
          <ColorIcon icon={<HourglassOutlined />} type="info" label="Pending" />
        )}
      </p>
    </Card>
  );
}

export default Draw;
