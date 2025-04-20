import { Ticket } from '@todo/shared';
import { TicketDraw } from '../drawSlice';
import Button from './Button';
import Card from './Card';

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
      style={{ marginBottom: 16 }}
      title={ticket?.title || 'Untitled'}
      actions={[
        draw.done || draw.skipped ? (
          <Button key="undo" onClick={() => onUndo(draw.id)}>
            ↩️ Undo
          </Button>
        ) : (
          <>
            <Button
              key="done"
              type="primary"
              onClick={() => onMarkDone(draw.id)}
            >
              ✅ Done
            </Button>
            <Button key="skip" danger onClick={() => onMarkSkipped(draw.id)}>
              ❌ Skip
            </Button>
          </>
        ),
      ]}
    >
      <p>
        Status:{' '}
        {draw.done ? '✅ Done' : draw.skipped ? '❌ Skipped' : '⏳ Pending'}
      </p>
    </Card>
  );
}

export default Draw;
