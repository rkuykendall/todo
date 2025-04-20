import { Ticket } from '@todo/shared';
import { TicketDraw } from '../drawSlice';
import Button from './Button';
import Card from './Card';
import { Space } from 'antd';
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
      style={{ marginBottom: 16 }}
      title={ticket?.title || 'Untitled'}
      actions={[
        draw.done || draw.skipped ? (
          <Button
            key="undo"
            onClick={() => onUndo(draw.id)}
            icon={<UndoOutlined />}
          >
            Undo
          </Button>
        ) : (
          <Space>
            <Button
              key="done"
              type="primary"
              onClick={() => onMarkDone(draw.id)}
              icon={<CheckOutlined />}
            >
              Done
            </Button>
            <Button
              key="skip"
              danger
              onClick={() => onMarkSkipped(draw.id)}
              icon={<CloseOutlined />}
            >
              Skip
            </Button>
          </Space>
        ),
      ]}
    >
      <p>
        Status:{' '}
        {draw.done ? (
          <>
            <CheckOutlined style={{ color: '#52c41a' }} /> Done
          </>
        ) : draw.skipped ? (
          <>
            <CloseOutlined style={{ color: '#ff4d4f' }} /> Skipped
          </>
        ) : (
          <>
            <HourglassOutlined style={{ color: '#1677ff' }} /> Pending
          </>
        )}
      </p>
    </Card>
  );
}

export default Draw;
