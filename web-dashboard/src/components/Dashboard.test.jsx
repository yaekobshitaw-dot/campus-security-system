import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsersPage } from './Dashboard';

describe('UsersPage SMS access', () => {
  const baseProps = {
    users: [{ user_id: 'u1', name: 'Ava', email: 'ava@example.com', phone: '+15551234567', role: 'student', is_active: true }],
    loading: false,
    submitting: false,
    error: '',
    form: { name: '', email: '', password: '', phone: '', role: 'student' },
    setForm: () => { },
    createUser: () => { },
    changeUserStatus: () => { },
  };

  it('hides the Send SMS action for non-admins', () => {
    render(<UsersPage {...baseProps} admin={false} />);
    expect(screen.queryByRole('button', { name: /send sms/i })).not.toBeInTheDocument();
  });

  it('shows the Send SMS action only for admins', () => {
    render(<UsersPage {...baseProps} admin />);
    expect(screen.getByRole('button', { name: /send sms/i })).toBeInTheDocument();
  });
});
