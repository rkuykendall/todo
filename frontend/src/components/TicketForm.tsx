import type { Ticket } from '@todo/shared';
import { dayFields } from '@todo/shared';
import { useEffect, useRef, useState } from 'react';
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

interface TicketFormProps {
  initialValues?: Partial<Ticket>;
  onSubmit: (values: Partial<Ticket>) => void;
  title: string;
  open: boolean;
  onCancel: () => void;
}

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
  ...Object.fromEntries(
    dayFields.flatMap((day) => [
      [`can_draw_${day}`, dayFields.slice(0, 5).includes(day)],
      [`must_draw_${day}`, false],
    ])
  ),
} as FormValues;

const toLabel = (day: string): string => {
  const firstLetter = day.charAt(0).toUpperCase();
  return `${firstLetter}${day.slice(1, 3)}`;
};

function TicketForm({
  initialValues = emptyValues,
  onSubmit,
  title,
  open,
  onCancel,
}: TicketFormProps) {
  const [form] = Form.useForm<FormValues>();
  const titleInputRef = useRef<InputRef>(null);
  const [error, setError] = useState<string | null>(null);

  // Watch the "recurring" field value to conditionally render the frequency field
  const recurring = Form.useWatch('recurring', form);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        title: initialValues.title ?? emptyValues.title,
        recurring: initialValues.recurring ?? emptyValues.recurring,
        deadline: initialValues.deadline || null,
        frequency: initialValues.frequency ?? emptyValues.frequency,
        ...Object.fromEntries(
          dayFields.flatMap((day) => [
            [
              `can_draw_${day}`,
              Boolean(initialValues[`can_draw_${day}` as keyof Ticket]),
            ],
            [
              `must_draw_${day}`,
              Boolean(initialValues[`must_draw_${day}` as keyof Ticket]),
            ],
          ])
        ),
      });

      // Clear any previous errors when the form reopens
      setError(null);

      // Focus the title input when modal opens
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [form, initialValues, open]);

  const handleSubmit = async (values: FormValues) => {
    try {
      setError(null);

      // Always ensure frequency is a number (defaults to 1 if not recurring)
      const submittedValues = {
        ...values,
        // If not recurring, ensure frequency is still a valid number (default to 1)
        frequency: values.recurring ? Number(values.frequency) : 1,
      };

      await onSubmit(submittedValues);
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
          {initialValues.id ? 'Save Changes' : 'Add Ticket'}
        </Button>,
      ]}
      onCancel={onCancel}
      open={open}
      title={title}
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
              { required: true, message: 'Please select or enter a frequency' },
              { type: 'number', message: 'Frequency must be a number' },
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
                name={`can_draw_${day}`}
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
                name={`must_draw_${day}`}
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

export default TicketForm;
