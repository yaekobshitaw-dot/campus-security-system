// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AlertsZonesPage, AnalyticsPage } from './OperationsPages';

vi.mock('recharts', () => {
  const chart = (name) => function Chart({ children, data = [] }) {
    return <div data-testid={`chart-${name}`} data-points={data.length}>{children}</div>;
  };
  const primitive = () => null;
  return {
    BarChart: chart('bar'),
    CartesianGrid: primitive,
    Cell: primitive,
    Legend: primitive,
    Line: primitive,
    LineChart: chart('line'),
    Pie: primitive,
    PieChart: chart('pie'),
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    Tooltip: primitive,
    XAxis: primitive,
    YAxis: primitive,
    Bar: primitive,
  };
});

const analytics = {
  total_incidents: 3,
  by_severity: { low: 1, high: 1, critical: 1 },
  by_status: { reported: 1, resolved: 1, closed: 1 },
};
const incidents = [
  { incident_id: 'i-1', type: 'theft', severity: 'high', status: 'reported', location_name: 'North Gate', created_at: '2026-09-28T08:00:00Z' },
  { incident_id: 'i-2', type: 'fire_alarm', severity: 'low', status: 'resolved', location_name: 'Library', created_at: '2026-09-28T11:00:00Z' },
  { incident_id: 'i-3', type: 'sos_alert', is_sos: true, severity: 'critical', status: 'closed', location_name: 'North Gate', created_at: '2026-09-29T08:00:00Z' },
];
const responses = [
  { response_id: 'r-1', response_time_seconds: 120, created_at: '2026-09-28T08:20:00Z' },
  { response_id: 'r-2', response_time_seconds: 240, created_at: '2026-09-29T08:20:00Z' },
];

describe('AnalyticsPage', () => {
  it('renders summary cards and charts from the provided real datasets', () => {
    const { container } = render(<AnalyticsPage analytics={analytics} incidents={incidents} responses={responses} />);

    expect(screen.getByText('3', { selector: '.analytics-summary-card p.text-3xl' })).toBeInTheDocument();
    expect(screen.getByText('Average response time')).toBeInTheDocument();
    expect(screen.getByText('180s')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(container.querySelectorAll('.analytics-chart-panel')).toHaveLength(6);
    expect(screen.getAllByTestId(/chart-/)).toHaveLength(6);
    expect(screen.getAllByTestId('chart-line')[0]).toHaveAttribute('data-points', '2');
    expect(screen.getByText('Incident trends')).toBeInTheDocument();
    expect(screen.getByText('Incidents by category')).toBeInTheDocument();
    expect(screen.getByText('Status distribution')).toBeInTheDocument();
    expect(screen.getByText('Severity distribution')).toBeInTheDocument();
    expect(screen.getByText('Response activity')).toBeInTheDocument();
    expect(screen.getByText('Incidents by location')).toBeInTheDocument();
  });

  it('derives charts and summaries from incidents when only records are available', () => {
    render(<AnalyticsPage incidents={incidents} responses={responses} />);

    expect(screen.getByText('3', { selector: '.analytics-summary-card p.text-3xl' })).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-line')[0]).toHaveAttribute('data-points', '2');
  });

  it('preserves loading, error, empty, and refresh states', () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<AnalyticsPage loading onRefresh={onRefresh} />);
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();

    rerender(<AnalyticsPage error="Analytics unavailable" onRefresh={onRefresh} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Analytics unavailable');
    expect(screen.getByText('No analytics data')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('AlertsZonesPage clearing', () => {
  it('clears displayed alerts without affecting zones or subsequent realtime alerts', () => {
    const alerts = [
      { alert_id: 'alert-1', title: 'First alert', message: 'First message', is_read: false },
      { alert_id: 'alert-2', title: 'Second alert', message: 'Second message', is_read: true },
    ];
    const zones = [{ zone_id: 'zone-1', name: 'Administration Zone', description: 'Admin buildings', radius: 250 }];
    const onReadAlert = vi.fn();
    const { rerender } = render(<AlertsZonesPage alerts={alerts} zones={zones} onReadAlert={onReadAlert} canManage />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(onReadAlert).toHaveBeenCalledWith('alert-1');
    fireEvent.click(screen.getByRole('button', { name: 'Clear alerts' }));

    expect(screen.queryByText('First alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Second alert')).not.toBeInTheDocument();
    expect(screen.getByText('Administration Zone')).toBeInTheDocument();
    expect(screen.getByText('No alerts')).toBeInTheDocument();

    rerender(<AlertsZonesPage alerts={[...alerts, { alert_id: 'alert-3', title: 'Realtime alert', message: 'New activity' }]} zones={zones} onReadAlert={onReadAlert} canManage />);
    expect(screen.getByText('Realtime alert')).toBeInTheDocument();
    expect(screen.queryByText('First alert')).not.toBeInTheDocument();
  });
});
