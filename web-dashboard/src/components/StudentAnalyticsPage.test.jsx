// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StudentAnalyticsPage from './StudentAnalyticsPage';

const incidents = [
  { incident_id: 'own-1', user_id: 'student-1', type: 'theft', status: 'reported', created_at: '2026-09-28T08:00:00Z' },
  { incident_id: 'own-2', user_id: 'student-1', type: 'fire', status: 'investigating', created_at: '2026-09-28T09:00:00Z' },
  { incident_id: 'own-3', user_id: 'student-1', type: 'theft', status: 'closed', created_at: '2026-09-29T08:00:00Z' },
  { incident_id: 'other-1', user_id: 'student-2', type: 'assault', status: 'reported', created_at: '2026-09-29T09:00:00Z' },
];

describe('StudentAnalyticsPage', () => {
  it("shows only the authenticated student's incidents and personal activity", () => {
    render(<StudentAnalyticsPage incidents={incidents} userId="student-1" />);

    expect(screen.getByText('3', { selector: '.dashboard-panel .text-3xl' })).toBeInTheDocument();
    expect(screen.getByText('Open / Pending')).toBeInTheDocument();
    expect(screen.getByText('Investigating / In Progress')).toBeInTheDocument();
    expect(screen.getByText('Resolved / Closed')).toBeInTheDocument();
    expect(screen.queryByText('Assault')).not.toBeInTheDocument();
    expect(screen.queryByText('other-1')).not.toBeInTheDocument();
    expect(screen.getAllByText('Theft').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent incident activity')).toBeInTheDocument();
  });

  it('shows a useful empty state when the student has no incidents', () => {
    render(<StudentAnalyticsPage incidents={incidents} userId="student-with-no-reports" />);

    expect(screen.getAllByText('0', { selector: '.dashboard-panel .text-3xl' })).toHaveLength(4);
    expect(screen.getByText('No incidents reported yet')).toBeInTheDocument();
    expect(screen.queryByText('Incident categories')).not.toBeInTheDocument();
  });
});

