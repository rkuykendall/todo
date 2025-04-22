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
        y: 500,
        x: 200,
        rotate: 50,
        scale: 0.9,
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
        scale: 1.03,
        rotate: 0.5,
        transition: { duration: 0.15 },
      }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 400,
        delay: 0.2 + index * 0.05,
        mass: 0.5,
      }}
      {...props}
    />
  );
}

export default Card;
