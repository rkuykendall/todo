import { Button as AntButton } from 'antd';
import type { ButtonProps } from 'antd';

export function Button(props: ButtonProps) {
  return <AntButton {...props} />;
}

export default Button;
