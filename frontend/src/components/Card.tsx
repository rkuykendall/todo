import { Card as AntCard, theme } from 'antd';
import type { CardProps } from 'antd';
import { motion } from 'framer-motion';
import type { MotionProps } from 'framer-motion';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import styles from './Card.module.css';

type MotionCardProps = Omit<CardProps, keyof MotionProps> & MotionProps;
const MotionCard: React.ComponentType<MotionCardProps> = motion(AntCard);

interface ExtendedCardProps extends Pick<
  CardProps,
  'actions' | 'title' | 'children' | 'style'
> {
  done?: boolean;
  index?: number;
}

export function Card({ done, index = 0, ...props }: ExtendedCardProps) {
  const screens = useBreakpoint();
  const { token } = theme.useToken();

  const shimmerColor = `${token.colorSuccess}1A`; // Add alpha transparency

  const cardStyle = done
    ? ({
        '--shimmer-color': shimmerColor,
      } as React.CSSProperties)
    : {};

  const shared = {
    className: styles.card,
    variant: 'borderless' as const,
    'data-done': done,
    style: { ...cardStyle, ...props.style },
  };

  if (!screens.sm) {
    return <AntCard {...shared} {...props} />;
  }

  return (
    <MotionCard
      {...shared}
      hoverable
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
        delay: 0.1 + index * 0.05,
        mass: 0.5,
      }}
      {...props}
    />
  );
}

export default Card;
