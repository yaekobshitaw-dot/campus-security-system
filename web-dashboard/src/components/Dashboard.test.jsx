// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) }
}));

describe('Dashboard', () => {
  it('renders the overview shell', () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard /></MemoryRouter>);
    expect(screen.getByText('Campus overview')).toBeInTheDocument();
  });
});
