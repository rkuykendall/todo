import { Ticket } from '@todo/shared';
import { useState, useEffect } from 'react';

const weekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

interface TicketFormProps {
  initialValues?: Partial<Ticket>;
  onSubmit: (values: Partial<Ticket>) => void;
  submitLabel?: string;
}

const empty = {};

export default function TicketForm({
  initialValues = empty,
  onSubmit,
  submitLabel = 'Save',
}: TicketFormProps) {
  const [title, setTitle] = useState(initialValues.title ?? '');
  const [doneOnChildDone, setDoneOnChildDone] = useState(
    initialValues.done_on_child_done ?? false
  );

  const [dayChecks, setDayChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(
      weekdays.map((day) => [
        `can_draw_${day}`,
        Boolean(initialValues[`can_draw_${day}` as keyof Ticket]),
      ])
    ) as Record<string, boolean>
  );

  useEffect(() => {
    setTitle(initialValues.title ?? '');
    setDoneOnChildDone(initialValues.done_on_child_done ?? false);
    setDayChecks(
      Object.fromEntries(
        weekdays.map((day) => [
          `can_draw_${day}`,
          Boolean(initialValues[`can_draw_${day}` as keyof Ticket]),
        ])
      ) as Record<string, boolean>
    );
  }, [initialValues]);

  const handleSubmit = () => {
    if (!title.trim()) return;

    onSubmit({
      title,
      done_on_child_done: doneOnChildDone,
      ...dayChecks,
    });
  };

  return (
    <div>
      <label>
        Title:{' '}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          placeholder="Ticket title"
        />
      </label>

      <div style={{ marginTop: 10 }}>
        <label>
          <input
            type="checkbox"
            checked={doneOnChildDone}
            onChange={(e) => {
              setDoneOnChildDone(e.target.checked);
            }}
          />
          Done when all draws are done
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>Can Draw On:</strong>
        <div>
          {weekdays.map((day) => (
            <label key={day} style={{ marginRight: 8 }}>
              <input
                type="checkbox"
                checked={dayChecks[`can_draw_${day}`]}
                onChange={(e) => {
                  setDayChecks((prev) => ({
                    ...prev,
                    [`can_draw_${day}`]: e.target.checked,
                  }));
                }}
              />
              {day.slice(0, 3)}
            </label>
          ))}
        </div>
      </div>

      <button type="button" onClick={handleSubmit} disabled={!title.trim()}>
        {submitLabel}
      </button>
    </div>
  );
}
