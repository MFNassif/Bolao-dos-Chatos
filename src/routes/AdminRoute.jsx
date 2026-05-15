import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function AdminRoute() {
  const { profile } = useAuth();
  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
