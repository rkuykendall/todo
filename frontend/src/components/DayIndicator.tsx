import { ReactElement } from 'react';
import { Space } from 'antd';
import { SunOutlined, CoffeeOutlined } from '@ant-design/icons';
import { Day, dayFields } from '@todo/shared';
import ColorIcon from './ColorIcon';

interface DayIndicatorProps {
  canDraw: Partial<Record<`can_draw_${Day}`, boolean>>;
  mustDraw: Partial<Record<`must_draw_${Day}`, boolean>>;
}

export function DayIndicator({ canDraw, mustDraw }: DayIndicatorProps) {
  return (
    <Space>
      {dayFields.map((day, idx) => {
        const canDrawDay = canDraw[`can_draw_${day}` as keyof typeof canDraw];
        const mustDrawDay =
          mustDraw[`must_draw_${day}` as keyof typeof mustDraw];
        const icon: ReactElement =
          idx < 5 ? <CoffeeOutlined /> : <SunOutlined />;

        if (!canDrawDay) {
          return <ColorIcon key={day} icon={icon} type="disabled" />;
        }

        return (
          <ColorIcon
            key={day}
            icon={icon}
            type={mustDrawDay ? 'warning' : 'info'}
          />
        );
      })}
    </Space>
  );
}

export default DayIndicator;
