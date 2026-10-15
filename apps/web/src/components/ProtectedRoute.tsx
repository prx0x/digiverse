import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context';
import { Button, ErrorState, LoadingState } from '@/components';

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'team';
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState title="Authenticating" description="Checking credentials..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="stack" style={{ padding: 'var(--space-6)', maxWidth: '600px', margin: '0 auto' }}>
        <ErrorState
          title="Access Denied (403)"
          description={`Your account role (${user.role}) is not authorized to access this section.`}
        />
        <Button
          onClick={() => {
            window.location.href = user.role === 'admin' ? '/admin' : '/team';
          }}
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return <Outlet />;
}
