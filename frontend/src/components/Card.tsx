import { Card as AntCard, CardProps } from 'antd';
import { motion, MotionProps } from 'framer-motion';
import styles from './Card.module.css';

type MotionCardProps = Omit<CardProps, keyof MotionProps> & MotionProps;
const MotionCard = motion(AntCard);

interface ExtendedCardProps extends MotionCardProps {
  done?: boolean;
  index?: number;
}

export function Card({ done, index = 0, ...props }: ExtendedCardProps) {
  return (
    <MotionCard
      className={styles.card}
      hoverable
      variant="borderless"
      data-done={done}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
        delay: index * 0.1, // Add 0.1s delay for each subsequent card
      }}
      {...props}
    />
  );
}

export default Card;
