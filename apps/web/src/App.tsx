import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/layouts/AdminLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { TeamLayout } from '@/layouts/TeamLayout';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { AdminSectionPage } from '@/pages/AdminSectionPage';
import { GalleryPage } from '@/pages/GalleryPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RapidFirePage } from '@/pages/RapidFirePage';
import { RoundPage } from '@/pages/RoundPage';
import { TeamLobbyPage } from '@/pages/TeamLobbyPage';
import { ProtectedRoute } from '@/components';
import { AuthProvider } from '@/context';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Authenticated Team Shell */}
        <Route element={<ProtectedRoute />}>
          <Route path="/team" element={<TeamLayout />}>
            <Route index element={<TeamLobbyPage />} />
            <Route path="rapid-fire" element={<RapidFirePage />} />
            <Route path="round" element={<RoundPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
          </Route>
        </Route>

        {/* Authenticated Admin Shell (Admin role strictly required) */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path=":sectionId" element={<AdminSectionPage />} />
          </Route>
        </Route>

        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
