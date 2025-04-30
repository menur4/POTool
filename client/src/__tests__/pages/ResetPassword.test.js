import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import ResetPassword from '../../pages/ResetPassword';

// Mock the useAuth hook
jest.mock('../../context/AuthContext', () => {
  const originalModule = jest.requireActual('../../context/AuthContext');
  return {
    ...originalModule,
    useAuth: jest.fn()
  };
});

// Mock useNavigate and useParams
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: jest.fn()
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'auth.resetPassword': 'Réinitialiser le mot de passe',
        'auth.resetPasswordSubtitle': 'Créez un nouveau mot de passe pour votre compte',
        'auth.newPassword': 'Nouveau mot de passe',
        'auth.newPasswordPlaceholder': 'Entrez votre nouveau mot de passe',
        'auth.confirmPassword': 'Confirmer le mot de passe',
        'auth.confirmPasswordPlaceholder': 'Confirmez votre mot de passe',
        'auth.resetPasswordButton': 'Réinitialiser le mot de passe',
        'auth.resetPasswordSuccess': 'Votre mot de passe a été réinitialisé avec succès',
        'auth.redirectingToLogin': 'Redirection vers la page de connexion...',
        'auth.backToLogin': 'Retour à la connexion',
        'auth.passwordRequirements': 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial',
        'common.loading': 'Chargement...',
        'validation.required': 'Ce champ est requis',
        'validation.passwordMinLength': 'Le mot de passe doit contenir au moins 8 caractères',
        'validation.passwordPattern': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
        'validation.passwordMatch': 'Les mots de passe ne correspondent pas'
      };
      return translations[key] || key;
    }
  })
}));

const { useAuth } = require('../../context/AuthContext');
const { useParams, useNavigate } = require('react-router-dom');

describe('ResetPassword Page', () => {
  const mockResetPassword = jest.fn();
  const mockNavigate = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    useAuth.mockReturnValue({
      resetPassword: mockResetPassword,
      error: null
    });
    
    useParams.mockReturnValue({ token: 'valid-reset-token' });
    useNavigate.mockReturnValue(mockNavigate);
    
    // Mock setTimeout
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders reset password form correctly', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ResetPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Check if main elements are rendered
    expect(screen.getByText('Réinitialiser le mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmer le mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' })).toBeInTheDocument();
    expect(screen.getByText('Retour à la connexion')).toBeInTheDocument();
  });

  test('validates password inputs', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ResetPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Submit the form without filling passwords
    userEvent.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));

    // Wait for validation errors
    await waitFor(() => {
      expect(screen.getAllByText('Ce champ est requis')).toHaveLength(2);
    });

    // Enter weak password
    userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'weak');
    
    // Submit again
    userEvent.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));
    
    // Check for password validation error
    await waitFor(() => {
      expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères')).toBeInTheDocument();
    });

    // Enter strong password but different confirmation
    userEvent.clear(screen.getByLabelText('Nouveau mot de passe'));
    userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'StrongPassword1!');
    userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'DifferentPassword1!');
    
    // Submit again
    userEvent.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));
    
    // Check for password match error
    await waitFor(() => {
      expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument();
    });
  });

  test('submits the form with valid passwords', async () => {
    // Mock successful password reset
    mockResetPassword.mockResolvedValue(true);

    render(
      <BrowserRouter>
        <AuthProvider>
          <ResetPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Fill form with valid passwords
    userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'StrongPassword1!');
    userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'StrongPassword1!');
    
    // Submit the form
    userEvent.click(screen.getByRole('button', { name: 'Réinitialiser le mot de passe' }));
    
    // Check if resetPassword function was called with correct arguments
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'StrongPassword1!',
        'StrongPassword1!'
      );
    });

    // Success message should be displayed
    await waitFor(() => {
      expect(screen.getByText('Votre mot de passe a été réinitialisé avec succès')).toBeInTheDocument();
      expect(screen.getByText('Redirection vers la page de connexion...')).toBeInTheDocument();
    });

    // After timeout, should navigate to login page
    jest.advanceTimersByTime(3000);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('displays error message when password reset fails', async () => {
    // Mock error response
    useAuth.mockReturnValue({
      resetPassword: mockResetPassword,
      error: 'Invalid or expired token'
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <ResetPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Error message should be displayed
    expect(screen.getByText('Invalid or expired token')).toBeInTheDocument();
  });

  test('toggles password visibility', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ResetPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Password should be hidden by default
    const passwordInput = screen.getByLabelText('Nouveau mot de passe');
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click the toggle button (there are two toggle buttons, one for each password field)
    const toggleButtons = screen.getAllByRole('button', { name: '' });
    userEvent.click(toggleButtons[0]);
    
    // Password should now be visible
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute('type', 'text');
    });
    
    // Click toggle button again
    userEvent.click(toggleButtons[0]);
    
    // Password should be hidden again
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});
