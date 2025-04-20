import { ReactElement } from 'react';
import { Alert } from 'antd';
import { theme } from 'antd';

interface ColorIconProps {
  icon: ReactElement;
  type?: React.ComponentProps<typeof Alert>['type'] | 'disabled';
  label?: string;
}

export function ColorIcon({ icon, type = 'info', label }: ColorIconProps) {
  const { token } = theme.useToken();

  console.log({ token });

  const colorMap = {
    success: token.colorSuccess,
    error: token.colorError,
    info: token.colorPrimary,
    warning: token.colorWarning,
    disabled: token.colorTextDisabled,
  };

  return (
    <span
      style={{
        color: colorMap[type],
      }}
    >
      {icon} {label}
    </span>
  );
}

export default ColorIcon;
