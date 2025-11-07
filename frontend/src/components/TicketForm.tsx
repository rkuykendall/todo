import type { Ticket, NewTicketInput, UpdateTicketInput } from '@todo/shared';
import { dayFields } from '@todo/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Form,
  Input,
  Checkbox,
  Space,
  Modal,
  Switch,
  DatePicker,
  Alert,
} from 'antd';
import type { InputRef } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import Button from './Button';
import { FrequencySelector } from './FrequencySelector';

// Type-safe utility functions for day field keys
type DayFieldKey = (typeof dayFields)[number];
type CanDrawKey = `can_draw_${DayFieldKey}`;
type MustDrawKey = `must_draw_${DayFieldKey}`;

const getCanDrawKey = (day: DayFieldKey): CanDrawKey => `can_draw_${day}`;
const getMustDrawKey = (day: DayFieldKey): MustDrawKey => `must_draw_${day}`;

// Generic utility function to get initial values with fallback to empty values
const getInitialValueOrDefault = <K extends keyof FormValues>(
  key: K,
  initialValues: Partial<Ticket>,
  emptyValues: FormValues
): FormValues[K] => {
  return (
    (initialValues[key as keyof Ticket] as FormValues[K]) ?? emptyValues[key]
  );
};

// Helper function to generate day field entries
const generateDayFieldEntries = (
  initialValues: Partial<Ticket>,
  emptyValues: FormValues
): Record<string, boolean> => {
  return Object.fromEntries(
    dayFields.flatMap((day) => {
      const canDrawKey = getCanDrawKey(day);
      const mustDrawKey = getMustDrawKey(day);
      return [
        [
          canDrawKey,
          getInitialValueOrDefault(canDrawKey, initialValues, emptyValues),
        ],
        [
          mustDrawKey,
          getInitialValueOrDefault(mustDrawKey, initialValues, emptyValues),
        ],
      ];
    })
  );
};

// Helper function to generate empty day field values
const generateEmptyDayFieldValues = (): Record<string, boolean> => {
  return Object.fromEntries(
    dayFields.flatMap((day) => [
      [getCanDrawKey(day), dayFields.slice(0, 5).includes(day)], // weekdays default to true
      [getMustDrawKey(day), false], // must_draw defaults to false
    ])
  );
};

interface TicketFormProps {
  initialValues?: undefined; // For new tickets
  onSubmit: (values: NewTicketInput) => void;
  title: string;
  open: boolean;
  onCancel: () => void;
}

interface TicketEditFormProps {
  initialValues: Partial<Ticket>; // For editing existing tickets
  onSubmit: (values: UpdateTicketInput) => void;
  title: string;
  open: boolean;
  onCancel: () => void;
}

type AllTicketFormProps = TicketFormProps | TicketEditFormProps;

type FormValues = Pick<Ticket, 'title' | 'recurring' | 'frequency'> & {
  deadline: string | null;
} & {
  [P in
    | `can_draw_${(typeof dayFields)[number]}`
    | `must_draw_${(typeof dayFields)[number]}`]: boolean;
};

const emptyValues: FormValues = {
  title: '',
  recurring: false,
  deadline: null,
  frequency: 1,
  ...generateEmptyDayFieldValues(),
} as FormValues;

const toLabel = (day: DayFieldKey): string => {
  const firstLetter = day.charAt(0).toUpperCase();
  return `${firstLetter}${day.slice(1, 3)}`;
};

export default function TicketForm({
  initialValues,
  onSubmit,
  title,
  open,
  onCancel,
}: AllTicketFormProps) {
  const [form] = Form.useForm<FormValues>();
  const titleInputRef = useRef<InputRef>(null);
  const [error, setError] = useState<string | null>(null);

  // Watch the "recurring" field value to conditionally render the frequency field
  const recurring = Form.useWatch('recurring', form);

  const getInitialValue = useCallback(
    <K extends keyof FormValues>(key: K): FormValues[K] => {
      return getInitialValueOrDefault(key, initialValues || {}, emptyValues);
    },
    [initialValues]
  );

  const dayFieldEntries = useMemo(() => {
    return generateDayFieldEntries(initialValues || {}, emptyValues);
  }, [initialValues]);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        title: getInitialValue('title'),
        recurring: getInitialValue('recurring'),
        deadline: getInitialValue('deadline'),
        frequency: getInitialValue('frequency'),
        ...dayFieldEntries,
      });

      // Focus the title input when modal opens
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [open, form, getInitialValue, dayFieldEntries]);

  const handleSubmit = async (values: FormValues) => {
    try {
      setError(null);

      // Transform FormValues to NewTicketInput/UpdateTicketInput format
      // If we have initialValues, this is an edit operation (UpdateTicketInput)
      // Otherwise, it's a create operation (NewTicketInput)
      const isEdit = initialValues && Object.keys(initialValues).length > 0;

      if (isEdit) {
        // For updates, only include changed fields
        const submittedValues: UpdateTicketInput = {
          ...values,
          frequency: values.recurring ? Number(values.frequency) || 1 : 1,
          deadline: values.deadline || null,
        };
        await onSubmit(submittedValues);
      } else {
        // For new tickets, ensure all required fields are present
        const submittedValues: NewTicketInput = {
          title: values.title || '',
          recurring: values.recurring || false,
          frequency: values.recurring ? Number(values.frequency) || 1 : 1,
          deadline: values.deadline || null,
          ...Object.fromEntries(
            dayFields.flatMap((day) => [
              [
                `can_draw_${day}`,
                values[`can_draw_${day}` as keyof FormValues] || false,
              ],
              [
                `must_draw_${day}`,
                values[`must_draw_${day}` as keyof FormValues] || false,
              ],
            ])
          ),
        };
        await onSubmit(submittedValues);
      }
      form.resetFields();
    } catch (err) {
      // Handle validation errors from the backend
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'object' && err !== null) {
        try {
          // Try to parse the error object
          const errorObj = err as {
            error?: { fieldErrors?: Record<string, string[]> };
          };
          if (errorObj.error?.fieldErrors) {
            const fieldErrors = errorObj.error.fieldErrors;
            const errorMessages = Object.entries(fieldErrors)
              .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
              .join('; ');
            setError(`Validation failed: ${errorMessages}`);

            // Set form field errors using properly typed field names
            Object.entries(fieldErrors).forEach(([field, messages]) => {
              if (field in values) {
                form.setFields([
                  {
                    name: field as NamePath,
                    errors: messages,
                  },
                ]);
              }
            });
          } else {
            setError('An unknown error occurred');
          }
        } catch {
          setError('Failed to process the server response');
        }
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  return (
    <Modal
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="submit" onClick={() => form.submit()} type="primary">
          {initialValues?.id ? 'Save Changes' : 'Add Ticket'}
        </Button>,
      ]}
      onCancel={onCancel}
      open={open}
      title={title}
      afterOpenChange={(isOpen) => {
        if (isOpen) {
          setError(null);
        }
      }}
    >
      {error && (
        <Alert message="Error" description={error} type="error" showIcon />
      )}

      <Form<FormValues>
        form={form}
        initialValues={emptyValues}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="Title"
          name="title"
          rules={[{ required: true, message: 'Please enter a title' }]}
        >
          <Input ref={titleInputRef} placeholder="Ticket title" />
        </Form.Item>

        <Form.Item name="deadline" label="Deadline">
          <DatePicker
            allowClear={true}
            format="YYYY-MM-DD"
            getPopupContainer={(trigger) =>
              trigger.parentElement as HTMLElement
            }
          />
        </Form.Item>

        <Form.Item name="recurring" valuePropName="checked" label="Recurring">
          <Switch title="Ticket is recurring" />
        </Form.Item>

        {recurring && (
          <Form.Item
            label="Frequency"
            name="frequency"
            rules={[
              {
                required: true,
                message: 'Please select or enter a frequency',
                validator: (_, value) => {
                  if (value === undefined || value === null || value === '') {
                    return Promise.reject(
                      new Error('Please select or enter a frequency')
                    );
                  }
                  if (typeof value === 'number' && value > 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error('Frequency must be a positive number')
                  );
                },
              },
            ]}
          >
            <FrequencySelector />
          </Form.Item>
        )}

        <Form.Item label="Can draw on">
          <Space wrap>
            {dayFields.map((day) => (
              <Form.Item
                key={day}
                name={getCanDrawKey(day)}
                noStyle
                valuePropName="checked"
              >
                <Checkbox>{toLabel(day)}</Checkbox>
              </Form.Item>
            ))}
          </Space>
        </Form.Item>

        <Form.Item label="Must draw on">
          <Space wrap>
            {dayFields.map((day) => (
              <Form.Item
                key={day}
                name={getMustDrawKey(day)}
                noStyle
                valuePropName="checked"
              >
                <Checkbox>{toLabel(day)}</Checkbox>
              </Form.Item>
            ))}
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
