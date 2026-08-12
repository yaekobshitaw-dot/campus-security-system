const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const exportIncidentReports = (incidents = [], format = 'csv') => {
  if (!Array.isArray(incidents) || incidents.length === 0) {
    return;
  }

  const headers = ['incident_id', 'type', 'severity', 'status', 'location_name', 'created_at'];

  if (format === 'csv') {
    const csvRows = [headers.join(',')];
    incidents.forEach((incident) => {
      csvRows.push(
        headers
          .map((key) => escapeCsvValue(incident[key] ?? ''))
          .join(',')
      );
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'incident-report.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  if (format === 'json') {
    const payload = JSON.stringify(incidents, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'incident-report.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  const payload = incidents.map((incident) => ({
    incident_id: incident.incident_id,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    location_name: incident.location_name,
    created_at: incident.created_at
  }));

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'incident-report.json';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export default { exportIncidentReports };
