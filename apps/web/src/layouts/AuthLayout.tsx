import { Outlet } from 'react-router-dom';
import { Wordmark } from '@/components';
import './layouts.css';

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__card">
        <Wordmark to="/" />
        <Outlet />
      </div>
    </div>
  );
}
