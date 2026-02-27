import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  return (
    <div className="pt-24 bg-gray-50 min-h-screen">
      {children}
    </div>
  );
}
