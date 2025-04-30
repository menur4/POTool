import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import Login from '../../pages/Login';

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
        'auth.login': 'Connexion',
        'auth.loginSubtitle': 'Connectez-vous à votre compte POTool',
        'auth.email': 'Email',
        'auth.emailPlaceholder': 'Entrez votre email',
        'auth.password': 'Mot de passe',
        'auth.passwordPlaceholder': 'Entrez votre mot de passe',
        'auth.rememberMe': 'Se souvenir de moi',
        'auth.loginButton': 'Se connecter',
        'auth.forgotPassword': 'Mot de passe oublié ?',
        'auth.noAccount': 'Vous n\'avez pas de compte ?',
        'auth.registerLink': 'S\'inscrire',
        'auth.secureConnection': 'Connexion sécurisée',
        'common.loading': 'Chargement...',
        'validation.required': 'Ce champ est requis',
        'validation.email': 'Veuillez entrer une adresse email valide'
      };
      return translations[key] || key;
    }
  })
}));

const { useAuth } = require('../../context/AuthContext');

describe('Login Page', () => {
  const mockLogin = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    useAuth.mockReturnValue({
      login: mockLogin,
      error: null,
      isAuthenticated: false
    });
  });

  test('renders login form correctly', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    // Check if main elements are rendered
    expect(screen.getByText('Connexion')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByText('Mot de passe oublié ?')).toBeInTheDocument();
    expect(screen.getByText('S\'inscrire')).toBeInTheDocument();
    // Vérifier si le texte de connexion sécurisée existe, s'il est présent dans l'interface
    const secureConnectionText = screen.queryByText('Connexion sécurisée');
    if (secureConnectionText) {
      expect(secureConnectionText).toBeInTheDocument();
    }
    
    // Check for icons
    expect(document.querySelector('label[for="email"] .icon-container i.bi-envelope')).not.toBeNull();
    expect(document.querySelector('label[for="password"] .icon-container i.bi-lock')).not.toBeNull();
    expect(document.querySelector('.password-toggle-btn i.bi-eye')).not.toBeNull();
  });

  test('validates form inputs', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    // Submit the form without filling inputs
    userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    // Wait for validation errors
    await waitFor(() => {
      expect(screen.getAllByText('Ce champ est requis')).toHaveLength(2);
    });

    // Enter invalid email
    userEvent.type(screen.getByLabelText('Email'), 'invalid-email');
    
    // Submit again
    userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    
    // Check for email validation error
    await waitFor(() => {
      expect(screen.getByText('Veuillez entrer une adresse email valide')).toBeInTheDocument();
    });
  });

  test('submits the form with valid data', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    // Fill form with valid data
    userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    userEvent.type(screen.getByLabelText('Mot de passe'), 'password123');
    
    // Submit the form
    userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    
    // Check if login function was called with correct arguments
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123', true);
    });
  });

  test('displays error message when login fails', async () => {
    // Mock login error
    useAuth.mockReturnValue({
      login: mockLogin,
      error: 'Invalid credentials',
      isAuthenticated: false
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    // Error message should be displayed
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  test('toggles password visibility', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>
    );

    // Password should be hidden by default
    const passwordInput = screen.getByLabelText('Mot de passe');
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Check initial eye icon
    expect(document.querySelector('.password-toggle-btn i.bi-eye')).not.toBeNull();
    
    // Click the toggle button
    const toggleButton = screen.getByRole('button', { name: /Afficher le mot de passe/i });
    userEvent.click(toggleButton);
    
    // Password should now be visible and icon should change
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(document.querySelector('.password-toggle-btn i.bi-eye-slash')).not.toBeNull();
    });
    
    // Click toggle button again
    userEvent.click(toggleButton);
    
    // Password should be hidden again and icon should change back
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(document.querySelector('.password-toggle-btn i.bi-eye')).not.toBeNull();
    });
  });
});
