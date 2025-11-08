import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Tooltip, Spin, theme } from 'antd';
import type { RootState } from '../store';
import styles from './HistoryGraph.module.css';
import { getDateFromISO, getDayName, getDayNumber } from '../utils';

interface DayIndicatorProps {
  date: string;
  totalDraws: number;
  completedDraws: number;
  isGolden: boolean;
}

const DayIndicator: React.FC<DayIndicatorProps> = ({
  date,
  totalDraws,
  completedDraws,
  isGolden,
}) => {
  const dateObj = getDateFromISO(date);
  const dayName = getDayName(dateObj);
  const dayNumber = getDayNumber(dateObj);
  const { token } = theme.useToken();

  // Determine colors based on completion rate and golden status
  const getTicketColor = (isCompleted: boolean) => {
    if (!isCompleted) {
      return token.colorTextQuaternary; // Neutral/muted color for incomplete
    }

    if (isGolden) {
      return token.colorWarning; // Golden/warning color for perfect days
    } else {
      return token.colorSuccess; // Green color for completed tickets
    }
  };

  const tooltipContent = (
    <div>
      <div>
        <strong>{dateObj.toLocaleDateString()}</strong>
      </div>
      <div>
        Completed: {completedDraws}/{totalDraws}
      </div>
    </div>
  );

  // Create array of squares representing each ticket
  const ticketSquares = [];
  for (let i = 0; i < totalDraws; i++) {
    const isCompleted = i < completedDraws;
    ticketSquares.push(
      <div
        key={i}
        className={styles.ticketSquare}
        style={{
          backgroundColor: getTicketColor(isCompleted),
          borderColor: token.colorBorder,
        }}
      />
    );
  }

  return (
    <Tooltip title={tooltipContent}>
      <div className={styles.dayColumn}>
        <div className={styles.ticketStack}>{ticketSquares}</div>
        <div
          className={styles.dayLabel}
          style={{
            backgroundColor: token.colorBgContainer,
            borderColor: token.colorBorder,
            color: token.colorText,
          }}
        >
          <div className={styles.dayName}>{dayName}</div>
          <div className={styles.dayNumber}>{dayNumber}</div>
        </div>
      </div>
    </Tooltip>
  );
};

export const HistoryGraph: React.FC = () => {
  const { history, loading, error } = useSelector(
    (state: RootState) => state.history
  );

  const sortedHistory = useMemo(() => {
    if (!Array.isArray(history)) {
      return [];
    }
    return [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [history]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="small" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <span style={{ color: '#f05252', fontSize: '12px' }}>
          Failed to load history
        </span>
      </div>
    );
  }

  return (
    <div className={styles.historyGraph}>
      {sortedHistory.map((day) => (
        <DayIndicator
          key={day.date}
          date={day.date}
          totalDraws={day.totalDraws}
          completedDraws={day.completedDraws}
          isGolden={day.completedDraws === day.totalDraws && day.totalDraws > 0}
        />
      ))}
    </div>
  );
};

export default HistoryGraph;
