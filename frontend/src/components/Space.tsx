import { Space as AntSpace } from 'antd';
import type { SpaceProps } from 'antd';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';

interface ExtendedSpaceProps extends SpaceProps {
  block?: boolean;
  desktop?: boolean;
}

export function Space({
  block,
  desktop,
  direction,
  style,
  ...props
}: ExtendedSpaceProps) {
  const screens = useBreakpoint();

  return (
    <AntSpace
      direction={desktop && !screens.sm ? 'vertical' : direction}
      style={{
        width: block ? '100%' : undefined,
        ...style,
      }}
      {...props}
    />
  );
}

export default Space;
