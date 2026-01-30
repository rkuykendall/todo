import type { ReactNode } from 'react';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import Space from './Space';
import styles from './Header.module.css';

interface HeaderProps {
  title: ReactNode;
  actions: ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  const screens = useBreakpoint();

  const headerClasses = [
    styles.headerContainer,
    screens.sm ? styles.horizontal : styles.vertical,
  ].join(' ');

  return (
    <Space
      orientation={screens.sm ? 'horizontal' : 'vertical'}
      block
      className={headerClasses}
    >
      {title}
      {actions}
    </Space>
  );
}

export default Header;
