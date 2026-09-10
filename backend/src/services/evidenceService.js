const fs = require('fs');
const path = require('path');

const uploadDirectory = path.resolve(__dirname, '../../uploads');
const privilegedRoles = new Set(['security', 'admin']);

const normalizePhotos = (photos) => {
  if (Array.isArray(photos)) return photos.filter((photo) => typeof photo === 'string');
  if (typeof photos !== 'string' || !photos.trim()) return [];
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed.filter((photo) => typeof photo === 'string') : [];
  } catch {
    return [];
  }
};

const getEvidenceFilename = (reference) => {
  if (typeof reference !== 'string' || !reference.trim()) return null;

  try {
    const parsed = new URL(reference, 'http://localhost');
    if (!parsed.pathname.startsWith('/uploads/')) return null;
    const filename = path.basename(parsed.pathname);
    if (!filename || filename === '.' || filename === '..' || filename !== path.basename(parsed.pathname)) return null;
    return filename;
  } catch {
    return null;
  }
};

const getProtectedEvidenceUrl = (incidentId, reference) => {
  const filename = getEvidenceFilename(reference);
  if (!filename) return null;
  return `/api/incidents/${encodeURIComponent(incidentId)}/evidence/${encodeURIComponent(filename)}`;
};

const canAccessIncidentEvidence = (user, incident) => Boolean(
  user
  && incident
  && (privilegedRoles.has(user.role) || incident.user_id === user.user_id)
);

const isStoredEvidence = (incident, filename) => normalizePhotos(incident?.photos)
  .some((reference) => getEvidenceFilename(reference) === filename);

const resolveEvidencePath = (filename) => {
  if (typeof filename !== 'string' || !filename || filename !== path.basename(filename) || filename.includes('\0')) {
    return null;
  }

  const resolvedPath = path.resolve(uploadDirectory, filename);
  const relativePath = path.relative(uploadDirectory, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return resolvedPath;
};

const evidenceExists = (filePath) => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const realUploadDirectory = fs.realpathSync(uploadDirectory);
  const realFilePath = fs.realpathSync(filePath);
  const relativePath = path.relative(realUploadDirectory, realFilePath);
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
};

module.exports = {
  canAccessIncidentEvidence,
  evidenceExists,
  getEvidenceFilename,
  getProtectedEvidenceUrl,
  isStoredEvidence,
  normalizePhotos,
  resolveEvidencePath,
  uploadDirectory
};