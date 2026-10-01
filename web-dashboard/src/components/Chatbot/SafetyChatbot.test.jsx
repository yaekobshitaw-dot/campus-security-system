 // @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SafetyChatbot from './SafetyChatbot';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn()
  }
}));

beforeEach(() => {
  vi.clearAllMocks();

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

describe('SafetyChatbot', () => {
  it('sends questions and clears only the local conversation', async () => {
    api.post.mockResolvedValue({
      data: { message: 'Stay calm and contact campus security.' }
    });

    render(<SafetyChatbot user={{ role: 'student' }} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Open AI Security Assistant' })
    );

    fireEvent.change(
      screen.getByPlaceholderText('Ask a security question...'),
      { target: { value: 'What should I do?' } }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('Stay calm and contact campus security.')
    ).toBeInTheDocument();

    expect(api.post).toHaveBeenCalledWith(
      '/assistant/chat',
      { message: 'What should I do?' },
      { timeout: 190000 }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(
      screen.getByText(
        'Hello! I\'m your Campus Security Assistant. How can I help?'
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText('What should I do?')
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText('Stay calm and contact campus security.')
    ).not.toBeInTheDocument();

    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('does not restore a response from a request cleared while it was pending', async () => {
    let resolveResponse;

    api.post.mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );

    render(<SafetyChatbot user={{ role: 'student' }} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Open AI Security Assistant' })
    );

    fireEvent.change(
      screen.getByPlaceholderText('Ask a security question...'),
      { target: { value: 'Pending question' } }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    resolveResponse({
      data: { message: 'Stale answer' }
    });

    await waitFor(() => {
      expect(screen.queryByText('Stale answer')).not.toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Hello! I\'m your Campus Security Assistant. How can I help?'
      )
    ).toBeInTheDocument();
  });

  it('keeps the chat panel within the dashboard header, footer, and viewport width', () => {
    const app = document.createElement('div');
    app.className = 'dashboard-app';

    const header = document.createElement('header');
    header.className = 'dashboard-header';
    header.getBoundingClientRect = () => ({ bottom: 96 });

    const footer = document.createElement('footer');
    footer.className = 'public-footer';
    footer.getBoundingClientRect = () => ({ top: 700 });

    app.append(header, footer);

    render(
      <SafetyChatbot user={{ role: 'student' }} />,
      { container: app }
    );

    fireEvent.click(
      within(app).getByRole('button', {
        name: 'Open AI Security Assistant'
      })
    );

    const panel = within(app)
      .getByText(/AI Security Assistant/)
      .parentElement.parentElement;

    expect(panel.style.top).toBe('88px');
    expect(panel.style.bottom).toBe('12px');

    expect(
      within(app).getByRole('button', { name: 'Clear' })
    ).toHaveStyle({ minHeight: '40px' });

    expect(
      within(app).getByPlaceholderText('Ask a security question...')
        .style.minWidth
    ).toBe('0');
  });
});
