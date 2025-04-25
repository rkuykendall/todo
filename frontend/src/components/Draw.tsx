import type { Ticket } from '@todo/shared';
import type { TicketDraw } from '../drawSlice';
import Button from './Button';
import Card from './Card';
import ColorIcon from './ColorIcon';
import { Alert, Typography, Tag } from 'antd';
import {
  UndoOutlined,
  CheckOutlined,
  CloseOutlined,
  HourglassOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { formatDate } from '../utils';

interface DrawCardProps {
  draw: TicketDraw;
  ticket?: Ticket;
  onMarkDone: (drawId: string) => void;
  onMarkSkipped: (drawId: string) => void;
  onUndo: (drawId: string) => void;
  index?: number;
}

const count = 200;
const defaults = {
  origin: { y: 0.3 },
};

function fire(particleRatio: number, opts: Parameters<typeof confetti>[0]) {
  confetti({
    ...defaults,
    ...opts,
    spread: (opts?.spread || 20) * 4,
    particleCount: Math.floor(count * particleRatio),
  });
}

const triggerConfetti = () => {
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
};

function getDeadlineTagColor(deadline: string | null): string {
  if (!deadline) return 'default';

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'error'; // Overdue
  if (diffDays <= 2) return 'warning'; // Due very soon
  if (diffDays <= 7) return 'orange'; // Due this week
  return 'blue'; // Future deadline
}

export function DrawCard({
  draw,
  ticket,
  onMarkDone,
  onMarkSkipped,
  onUndo,
  index = 0,
}: DrawCardProps) {
  const { error, patchLoading } = useSelector(
    (state: RootState) => state.draws
  );
  const isLoading = patchLoading[draw.id];

  const handleMarkDone = () => {
    onMarkDone(draw.id);
    triggerConfetti();
  };

  const hasDeadline = ticket?.deadline && !ticket.done;
  const deadlineColor = hasDeadline
    ? getDeadlineTagColor(ticket.deadline)
    : undefined;

  // Define status for animation purposes
  const status = draw.done ? 'done' : draw.skipped ? 'skipped' : 'pending';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ rotateY: 0 }}
        animate={{
          rotateY: draw.done ? 360 : 0,
          scale: draw.skipped ? 0.95 : 1,
        }}
        layout // Enable automatic layout animations
        layoutId={`draw-${draw.id}`} // Unique ID for each draw
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 20,
          layout: { type: 'spring', damping: 25, stiffness: 120 },
        }}
        data-status={status} // Add status as data attribute for styling
      >
        <Card
          index={index}
          done={draw.done}
          actions={
            draw.done || draw.skipped
              ? [
                  <Button
                    icon={<UndoOutlined />}
                    key="undo"
                    type="text"
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
                    onClick={handleMarkDone}
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
          title={
            draw.done ? (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                <ColorIcon
                  icon={<CheckOutlined />}
                  label="Done"
                  type="success"
                />
              </motion.div>
            ) : draw.skipped ? (
              <ColorIcon
                icon={<CloseOutlined />}
                label="Skipped"
                type="error"
              />
            ) : (
              <ColorIcon
                icon={<HourglassOutlined />}
                label="To-do"
                type="info"
              />
            )
          }
        >
          {ticket?.title && (
            <Typography.Title level={5}>{ticket.title}</Typography.Title>
          )}

          {hasDeadline && (
            <div style={{ marginTop: '8px', marginBottom: '8px' }}>
              <Tag color={deadlineColor}>
                <CalendarOutlined /> {formatDate(ticket.deadline)}
              </Tag>
            </div>
          )}

          {error && <Alert message={error} type="error" />}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export default DrawCard;
