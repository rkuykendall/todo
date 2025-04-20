import { Ticket, dayFields } from '@todo/shared';
import { useEffect } from 'react';
import { Form, Input, Checkbox, Space, Modal, Switch } from 'antd';
import Button from './Button';

interface TicketFormProps {
  initialValues?: Partial<Ticket>;
  onSubmit: (values: Partial<Ticket>) => void;
  title: string;
  open: boolean;
  onCancel: () => void;
}

type FormValues = Pick<Ticket, 'title' | 'done_on_child_done'> & {
  [P in `can_draw_${(typeof dayFields)[number]}`]: boolean;
};

const emptyValues: FormValues = {
  title: '',
  done_on_child_done: true,
  ...Object.fromEntries(
    dayFields.map((day) => [
      `can_draw_${day}`,
      dayFields.slice(0, 5).includes(day),
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

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        title: initialValues.title ?? emptyValues.title,
        done_on_child_done:
          initialValues.done_on_child_done ?? emptyValues.done_on_child_done,
        ...Object.fromEntries(
          dayFields.map((day) => [
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
        initialValues={emptyValues}
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

        <Form.Item
          name="done_on_child_done"
          valuePropName="checked"
          label="Done when child is done"
        >
          <Switch title="Done when all draws are done" />
        </Form.Item>

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
      </Form>
    </Modal>
  );
}

export default TicketForm;
