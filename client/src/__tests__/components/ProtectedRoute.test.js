import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';

// Mock AuthContext values
jest.mock('../../context/AuthContext', () => {
  const originalModule = jest.requireActual('../../context/AuthContext');
  return {
    ...originalModule,
    useAuth: jest.fn()
  };
});

const { useAuth } = require('../../context/AuthContext');

// Test components
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;
const LoginPage = () => <div data-testid="login-page">Login Page</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the protected component when user is authenticated', () => {
    // Mock authenticated user
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 1, email: 'test@example.com' }
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/protected" 
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    // Should render the protected content
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  test('redirects to login page when user is not authenticated', () => {
    // Mock unauthenticated user
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/protected" 
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to login page
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  test('redirects to login page when user is loading', () => {
    // Mock loading state
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: true
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/protected" 
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to login page
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
