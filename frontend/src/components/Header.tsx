import type { ReactNode } from 'react';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';
import Space from './Space';

interface HeaderProps {
  title: ReactNode;
  actions: ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  const screens = useBreakpoint();

  return (
    <Space
      direction={screens.sm ? 'horizontal' : 'vertical'}
      block
      style={{
        display: 'flex',
        justifyContent: screens.sm ? 'space-between' : undefined,
        alignItems: screens.sm ? 'center' : undefined,
      }}
    >
      {title}
      {actions}
    </Space>
  );
}

export default Header;
