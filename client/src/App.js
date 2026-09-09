import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './App.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import TeamMembers from './pages/TeamMembers';
import Configuration from './pages/Configuration';
import Sprints from './pages/Sprints';
import Epics from './pages/Epics';
import Calendar from './pages/Calendar';
import Roadmap from './pages/Roadmap';
import NotFound from './pages/NotFound';
// import GoogleCallback from './pages/GoogleCallback';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import TokenHandler from './components/TokenHandler';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="app">
      <TokenHandler>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          {/* Routes d'authentification Google temporairement désactivées */}
          {/* <Route path="/auth/google/callback" element={<GoogleCallback />} /> */}
          {/* <Route path="/login-success" element={<GoogleCallback />} /> */}
          
          {/* Routes protégées */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/configuration" element={<ProtectedRoute><Configuration /></ProtectedRoute>} />
          {/* Ancienne route équipe → configuration */}
          <Route path="/team-members" element={<ProtectedRoute><Navigate to="/configuration" replace /></ProtectedRoute>} />
          <Route path="/sprints" element={<ProtectedRoute><Sprints /></ProtectedRoute>} />
          <Route path="/epics" element={<ProtectedRoute><Epics /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />

          {/* Route 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TokenHandler>
    </div>
  );
}

export default App;
