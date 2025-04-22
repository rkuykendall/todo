import type { ReactElement } from 'react';
import { Space, Tooltip } from 'antd';
import { SunOutlined, CoffeeOutlined } from '@ant-design/icons';
import type { Day } from '@todo/shared';
import { dayFields } from '@todo/shared';
import ColorIcon from './ColorIcon';

interface DayIndicatorProps {
  ticket: Partial<Record<`can_draw_${Day}`, boolean>>;
}

function getDrawDescription(ticket: DayIndicatorProps['ticket']): string {
  const mustDrawDays = dayFields.filter(
    (day) => ticket[`must_draw_${day}` as keyof typeof ticket]
  );
  const canDrawDays = dayFields.filter(
    (day) =>
      ticket[`can_draw_${day}` as keyof typeof ticket] &&
      !ticket[`must_draw_${day}` as keyof typeof ticket]
  );

  const parts: string[] = [];

  if (mustDrawDays.length > 0) {
    const days = mustDrawDays.map(
      (day) => day.charAt(0).toUpperCase() + day.slice(1)
    );

    if (days.length === 7) {
      return 'Must draw every day';
    }

    parts.push(`Must draw on ${days.join(', ')}`);
  }

  if (canDrawDays.length > 0) {
    const days = canDrawDays.map(
      (day) => day.charAt(0).toUpperCase() + day.slice(1)
    );

    if (days.length === 7) {
      return 'Can draw any day';
    }

    parts.push(`Can draw on ${days.join(', ')}`);
  }

  return parts.join('. ') || 'No draw days set';
}

export function DayIndicator({ ticket }: DayIndicatorProps) {
  const description = getDrawDescription(ticket);

  return (
    <Tooltip title={description} placement="top">
      <Space size={6}>
        {dayFields.map((day, idx) => {
          const canDrawDay = ticket[`can_draw_${day}` as keyof typeof ticket];
          const mustDrawDay = ticket[`must_draw_${day}` as keyof typeof ticket];
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
    </Tooltip>
  );
}

export default DayIndicator;
