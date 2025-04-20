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
      actions={
        draw.done || draw.skipped
          ? [
              <Button
                icon={<UndoOutlined />}
                key="undo"
                onClick={() => onUndo(draw.id)}
              >
                Undo
              </Button>,
            ]
          : [
              <Button
                icon={<CheckOutlined />}
                key="done"
                onClick={() => onMarkDone(draw.id)}
                type="link"
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
      title={ticket?.title || 'Untitled'}
    >
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
