import { Ticket } from '@todo/shared';
import { useEffect } from 'react';
import { Form, Input, Checkbox, Space, Modal } from 'antd';
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

const emptyValues: Partial<Ticket> = {};

interface TicketFormProps {
  initialValues?: Partial<Ticket>;
  onSubmit: (values: Partial<Ticket>) => void;
  title: string;
  open: boolean;
  onCancel: () => void;
}

interface FormValues {
  title: string;
  done_on_child_done: boolean;
  [key: `can_draw_${(typeof weekdays)[number]}`]: boolean;
}

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

  useEffect(() => {
    if (open) {
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
    }
  }, [form, initialValues, open]);

  const handleSubmit = (values: FormValues) => {
    onSubmit(values);
    form.resetFields();
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
      <Form<FormValues>
        form={form}
        initialValues={{
          title: '',
          done_on_child_done: false,
          ...Object.fromEntries(
            weekdays.map((day) => [`can_draw_${day}`, false])
          ),
        }}
        layout="vertical"
        onFinish={handleSubmit}
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
