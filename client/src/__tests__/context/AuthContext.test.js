import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import axios from 'axios';

// Mock axios
jest.mock('axios');

// Test component that uses the auth context
const TestComponent = () => {
  const { 
    isAuthenticated, 
    user, 
    login, 
    register, 
    logout, 
    error 
  } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      {user && <div data-testid="user-email">{user.email}</div>}
      {error && <div data-testid="auth-error">{error}</div>}
      <button onClick={() => login('test@example.com', 'password123')}>Login</button>
      <button onClick={() => register('John', 'Doe', 'test@example.com', 'password123', 'password123', 'fr')}>Register</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    global.localStorage = localStorageMock;
  });

  test('provides authentication state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
  });

  test('handles login success', async () => {
    // Mock successful login response
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'fake-token',
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Click login button
    userEvent.click(screen.getByText('Login'));

    // Wait for state to update
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    // Verify localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'fake-token');
    expect(localStorage.setItem).toHaveBeenCalledWith('user', expect.any(String));
  });

  test('handles login error', async () => {
    // Mock login error
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Invalid credentials'
        }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Click login button
    userEvent.click(screen.getByText('Login'));

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Invalid credentials');
    });

    // Auth status should still be not authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
  });

  test('handles registration success', async () => {
    // Mock successful registration response
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'fake-token',
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Click register button
    userEvent.click(screen.getByText('Register'));

    // Wait for state to update
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    // Verify localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'fake-token');
    expect(localStorage.setItem).toHaveBeenCalledWith('user', expect.any(String));
  });

  test('handles logout', async () => {
    // Setup initial authenticated state
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'token') return 'fake-token';
      if (key === 'user') return JSON.stringify({
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should be authenticated initially
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    // Click logout button
    userEvent.click(screen.getByText('Logout'));

    // Should be logged out
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    });

    // Verify localStorage items were removed
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  });

  test('initializes from localStorage', async () => {
    // Setup localStorage mock to return authentication data
    localStorage.getItem.mockImplementation((key) => {
      if (key === 'token') return 'fake-token';
      if (key === 'user') return JSON.stringify({
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });
      return null;
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Should be authenticated from localStorage data
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });
  });
});
