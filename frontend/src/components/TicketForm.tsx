import { Ticket } from '@todo/shared';
import { useEffect } from 'react';
import { Form, Input, Checkbox, Space } from 'antd';
import Button from './Button';

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

interface FormValues {
  title: string;
  done_on_child_done: boolean;
  [key: `can_draw_${(typeof weekdays)[number]}`]: boolean;
}

const empty = {};

export default function TicketForm({
  initialValues = empty,
  onSubmit,
  submitLabel = 'Save',
}: TicketFormProps) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    form.setFieldsValue({
      title: initialValues.title ?? '',
      done_on_child_done: initialValues.done_on_child_done ?? false,
      ...Object.fromEntries(
        weekdays.map((day) => [
          `can_draw_${day}`,
          Boolean(initialValues[`can_draw_${day}` as keyof Ticket]),
        ])
      ),
    });
  }, [form, initialValues]);

  const handleSubmit = (values: FormValues) => {
    onSubmit(values);
  };

  return (
    <Form<FormValues>
      form={form}
      onFinish={handleSubmit}
      layout="vertical"
      initialValues={{
        title: '',
        done_on_child_done: false,
        ...Object.fromEntries(
          weekdays.map((day) => [`can_draw_${day}`, false])
        ),
      }}
    >
      <Form.Item
        label="Title"
        name="title"
        rules={[{ required: true, message: 'Please enter a title' }]}
      >
        <Input placeholder="Ticket title" />
      </Form.Item>

      <Form.Item name="done_on_child_done" valuePropName="checked">
        <Checkbox>Done when all draws are done</Checkbox>
      </Form.Item>

      <Form.Item label="Can Draw On:">
        <Space wrap>
          {weekdays.map((day) => (
            <Form.Item
              key={day}
              name={`can_draw_${day}`}
              valuePropName="checked"
              noStyle
            >
              <Checkbox>{day.slice(0, 3)}</Checkbox>
            </Form.Item>
          ))}
        </Space>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          {submitLabel}
        </Button>
      </Form.Item>
    </Form>
  );
}
