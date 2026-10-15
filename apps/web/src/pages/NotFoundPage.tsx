import { useNavigate } from 'react-router-dom';
import { ErrorState } from '@/components';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="auth-layout">
      <ErrorState
        title="404 — Page not found"
        description="That route does not exist in the Digiverse shell."
        actionLabel="Go to login"
        onAction={() => navigate('/login')}
      />
    </div>
  );
}
