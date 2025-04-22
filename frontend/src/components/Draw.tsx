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
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface DrawProps {
  draw: TicketDraw;
  ticket?: Ticket;
  onMarkDone: (drawId: string) => void;
  onMarkSkipped: (drawId: string) => void;
  onUndo: (drawId: string) => void;
  index?: number;
}

const triggerConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });
};

export function Draw({
  draw,
  ticket,
  onMarkDone,
  onMarkSkipped,
  onUndo,
  index = 0,
}: DrawProps) {
  const { error, patchLoading } = useSelector(
    (state: RootState) => state.draws
  );
  const isLoading = patchLoading[draw.id];

  const handleMarkDone = () => {
    onMarkDone(draw.id);
    triggerConfetti();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ rotateY: 0 }}
        animate={{
          rotateY: draw.done ? 360 : 0,
          scale: draw.skipped ? 0.95 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 20,
        }}
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

          {error && <Alert message={error} type="error" />}
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export default Draw;
