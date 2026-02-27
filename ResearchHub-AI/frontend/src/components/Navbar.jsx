import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { FlaskConical, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/search', label: 'Search' },
  { to: '/workspaces', label: 'Workspaces' },
  { to: '/ai-tools', label: 'AI Tools' },
  { to: '/upload', label: 'Upload' },
  { to: '/docspace', label: 'Doc Space' },
];

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 text-blue-600 font-bold text-xl">
              <FlaskConical size={24} />
              <span className="hidden sm:inline">ResearchHub AI</span>
            </Link>
          </div>

          {/* Desktop nav links */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="hidden sm:inline text-sm text-gray-600">
                  {user?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 hover:text-blue-600"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            {isAuthenticated && (
              <button
                className="md:hidden p-2 text-gray-600"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {isAuthenticated && mobileOpen && (
          <div className="md:hidden pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === link.to
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
