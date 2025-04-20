import { Card as AntCard, CardProps } from 'antd';
import styles from './Card.module.css';

export function Card(props: CardProps) {
  return <AntCard className={styles.card} variant="borderless" {...props} />;
}

export default Card;
