import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import ForgotPassword from '../../pages/ForgotPassword';

// Mock the useAuth hook
jest.mock('../../context/AuthContext', () => {
  const originalModule = jest.requireActual('../../context/AuthContext');
  return {
    ...originalModule,
    useAuth: jest.fn()
  };
});

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'auth.forgotPassword': 'Mot de passe oublié ?',
        'auth.forgotPasswordSubtitle': 'Entrez votre email pour réinitialiser votre mot de passe',
        'auth.email': 'Email',
        'auth.emailPlaceholder': 'Entrez votre email',
        'auth.sendResetLink': 'Envoyer le lien de réinitialisation',
        'auth.forgotPasswordSuccess': 'Un email de réinitialisation a été envoyé à votre adresse email',
        'auth.checkEmailInstructions': 'Veuillez vérifier votre email pour les instructions de réinitialisation de mot de passe',
        'auth.backToLogin': 'Retour à la connexion',
        'auth.rememberPassword': 'Vous vous souvenez de votre mot de passe ?',
        'auth.loginLink': 'Se connecter',
        'common.loading': 'Chargement...',
        'validation.required': 'Ce champ est requis',
        'validation.email': 'Veuillez entrer une adresse email valide'
      };
      return translations[key] || key;
    }
  })
}));

const { useAuth } = require('../../context/AuthContext');

describe('ForgotPassword Page', () => {
  const mockForgotPassword = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    useAuth.mockReturnValue({
      forgotPassword: mockForgotPassword,
      error: null
    });
  });

  test('renders forgot password form correctly', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ForgotPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Check if main elements are rendered
    expect(screen.getByText('Mot de passe oublié ?')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' })).toBeInTheDocument();
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
  });

  test('validates email input', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <ForgotPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Submit the form without filling email
    userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }));

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText('Ce champ est requis')).toBeInTheDocument();
    });

    // Enter invalid email
    userEvent.type(screen.getByLabelText('Email'), 'invalid-email');
    
    // Submit again
    userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }));
    
    // Check for email validation error
    await waitFor(() => {
      expect(screen.getByText('Veuillez entrer une adresse email valide')).toBeInTheDocument();
    });
  });

  test('submits the form with valid email', async () => {
    // Mock successful password reset request
    mockForgotPassword.mockResolvedValue(true);

    render(
      <BrowserRouter>
        <AuthProvider>
          <ForgotPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Fill form with valid email
    userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    
    // Submit the form
    userEvent.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }));
    
    // Check if forgotPassword function was called with correct email
    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
    });

    // Success message should be displayed
    await waitFor(() => {
      expect(screen.getByText('Un email de réinitialisation a été envoyé à votre adresse email')).toBeInTheDocument();
    });

    // Form should be replaced with success message and back to login button
    await waitFor(() => {
      expect(screen.getByText('Veuillez vérifier votre email pour les instructions de réinitialisation de mot de passe')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retour à la connexion' })).toBeInTheDocument();
    });
  });

  test('displays error message when password reset request fails', async () => {
    // Mock error response
    useAuth.mockReturnValue({
      forgotPassword: mockForgotPassword,
      error: 'Email not found'
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <ForgotPassword />
        </AuthProvider>
      </BrowserRouter>
    );

    // Error message should be displayed
    expect(screen.getByText('Email not found')).toBeInTheDocument();
  });
});
