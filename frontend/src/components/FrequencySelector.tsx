import { Space, Radio, Input } from 'antd';
import { useState } from 'react';

interface FrequencySelectorProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
}

export function FrequencySelector({
  value = 1,
  onChange,
}: FrequencySelectorProps) {
  const [customFrequency, setCustomFrequency] = useState(
    value ? ![1, 7, 30, 365].includes(value) : false
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Radio.Group
        value={customFrequency ? 'custom' : value}
        onChange={(e) => {
          const selectedValue = e.target.value;
          setCustomFrequency(selectedValue === 'custom');
          if (selectedValue !== 'custom') {
            onChange?.(selectedValue);
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
          value={value}
          onChange={(e) => {
            const inputValue = e.target.value
              ? Number(e.target.value)
              : undefined;
            onChange?.(inputValue);
          }}
        />
      )}
    </Space>
  );
}
