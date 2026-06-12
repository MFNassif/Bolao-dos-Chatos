import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { logout } from '../services/authService';

export default function ProtectedRoute() {
  const { user, profile } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <DeletedAccount />;
  return <Outlet />;
}

function DeletedAccount() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card bg-surface-2 p-6 max-w-sm w-full text-center space-y-3">
        <h1 className="font-display text-2xl text-white tracking-wider">CONTA REMOVIDA</h1>
        <p className="text-sm text-slate">Esta conta nao tem mais perfil ativo no bolao.</p>
        <button className="btn-primary w-full" onClick={logout}>Sair</button>
      </div>
    </div>
  );
}
