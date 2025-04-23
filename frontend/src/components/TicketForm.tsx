import type { Ticket } from '@todo/shared';
import { dayFields, formatDateISO } from '@todo/shared';
import { useEffect, useRef, useState } from 'react';
import {
  Form,
  Input,
  Checkbox,
  Space,
  Modal,
  Switch,
  DatePicker,
  Radio,
} from 'antd';
import type { InputRef } from 'antd';
import Button from './Button';

interface TicketFormProps {
  initialValues?: Partial<Ticket>;
  onSubmit: (values: Partial<Ticket>) => void;
  title: string;
  open: boolean;
  onCancel: () => void;
}

type FormValues = Pick<Ticket, 'title' | 'done_on_child_done' | 'frequency'> & {
  deadline: string | null;
} & {
  [P in
    | `can_draw_${(typeof dayFields)[number]}`
    | `must_draw_${(typeof dayFields)[number]}`]: boolean;
};

const emptyValues: FormValues = {
  title: '',
  done_on_child_done: true,
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
  const [customFrequency, setCustomFrequency] = useState(false);

  useEffect(() => {
    if (open) {
      const frequency = initialValues.frequency ?? emptyValues.frequency;
      const isCustom = ![1, 7, 30, 365].includes(frequency);
      setCustomFrequency(isCustom);

      form.setFieldsValue({
        title: initialValues.title ?? emptyValues.title,
        done_on_child_done:
          initialValues.done_on_child_done ?? emptyValues.done_on_child_done,
        deadline: initialValues.deadline || null,
        frequency: frequency,
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

      // Focus the title input when modal opens
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [form, initialValues, open]);

  const handleSubmit = (values: FormValues) => {
    // Ensure frequency is a number before submitting
    const submittedValues = {
      ...values,
      frequency: Number(values.frequency),
    };
    onSubmit(submittedValues);
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
          <Input ref={titleInputRef} placeholder="Ticket title" />
        </Form.Item>

        <Form.Item name="deadline" label="Deadline">
          <DatePicker
            onChange={(date) => {
              form.setFieldValue('deadline', formatDateISO(date));
            }}
          />
        </Form.Item>

        <Form.Item
          name="done_on_child_done"
          valuePropName="checked"
          label="Done when child is done"
        >
          <Switch title="Done when all draws are done" />
        </Form.Item>

        <Form.Item
          label="Frequency"
          name="frequency"
          rules={[
            { required: true, message: 'Please select or enter a frequency' },
          ]}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Radio.Group
              value={
                customFrequency ? 'custom' : form.getFieldValue('frequency')
              }
              onChange={(e) => {
                const value = e.target.value;
                setCustomFrequency(value === 'custom');
                if (value !== 'custom') {
                  form.setFieldsValue({ frequency: value });
                }
              }}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: 'Daily', value: 1 },
                { label: 'Weekly', value: 7 },
                { label: 'Monthly', value: 30 },
                { label: 'Annual', value: 365 },
                { label: 'Custom', value: 'custom' },
              ]}
            />
            {customFrequency && (
              <Input
                type="number"
                min={1}
                placeholder="Enter custom frequency in days"
                value={form.getFieldValue('frequency')}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value)) {
                    form.setFieldsValue({ frequency: value });
                  }
                }}
              />
            )}
          </Space>
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
