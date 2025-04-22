import { useState } from 'react';
import { Form, Input, Button, Alert, Card } from 'antd';
import { LoginOutlined } from '@ant-design/icons';

interface LoginProps {
  onLogin: (password: string) => void;
  error?: string;
}

export function Login({ onLogin, error }: LoginProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async ({ password }: { password: string }) => {
    setLoading(true);
    try {
      await onLogin(password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '1rem',
      }}
    >
      <Card style={{ width: 300 }}>
        <Form onFinish={handleSubmit}>
          <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Login</h1>
          {error && (
            <Alert
              message={error}
              type="error"
              style={{ marginBottom: '1rem' }}
            />
          )}
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter the password' }]}
          >
            <Input.Password placeholder="Enter password" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<LoginOutlined />}
              block
            >
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default Login;
