import { ArrowBack } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';

const getParentPath = (pathname) => {
  const pathParts = pathname.split('/').filter(Boolean);

  if (
    pathParts[0] === 'incidents'
    && pathParts.length > 1
    && !['active', 'history'].includes(pathParts[1])
  ) {
    return '/incidents/active';
  }
  if (
    (pathParts[0] === 'reports' || pathParts[0] === 'analytics')
    && pathParts.length > 1
  ) {
    return '/analytics';
  }
  if (pathParts[0] === 'users' && pathParts.length > 1) {
    return pathParts.length > 2
      ? `/${pathParts.slice(0, -1).join('/')}`
      : '/users';
  }
  if (pathParts.length > 2) {
    return `/${pathParts.slice(0, -1).join('/')}`;
  }
  return '/dashboard';
};

export default function DashboardBackButton({ onBack, fallbackTo }) {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    const historyIndex = window.history.state?.idx;
    if (Number.isInteger(historyIndex) && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate(fallbackTo || getParentPath(location.pathname), { replace: true });
    }
  };

  return (
    <button type="button" className="dashboard-button primary dashboard-back-button" onClick={goBack}>
      <ArrowBack className="text-[18px]" />
      Back
    </button>
  );
}
