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
      initial={{
        y: -1000,
        x: -100,
        rotate: -15,
        scale: 0.8,
        opacity: 0,
      }}
      animate={{
        y: 0,
        x: 0,
        rotate: 0,
        scale: 1,
        opacity: 1,
      }}
      whileHover={{
        scale: 1.02,
        rotate: 1.5,
        transition: { duration: 0.2 },
      }}
      transition={{
        type: 'spring',
        damping: 100,
        stiffness: 800,
        delay: index * 0.05,
        mass: 0.3,
      }}
      {...props}
    />
  );
}

export default Card;
