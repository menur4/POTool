import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import Register from '../../pages/Register';

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
        'auth.register': 'Inscription',
        'auth.registerSubtitle': 'Créez votre compte POTool',
        'auth.firstName': 'Prénom',
        'auth.firstNamePlaceholder': 'Entrez votre prénom',
        'auth.lastName': 'Nom',
        'auth.lastNamePlaceholder': 'Entrez votre nom',
        'auth.email': 'Email',
        'auth.emailPlaceholder': 'Entrez votre email',
        'auth.password': 'Mot de passe',
        'auth.passwordPlaceholder': 'Entrez votre mot de passe',
        'auth.confirmPassword': 'Confirmer le mot de passe',
        'auth.confirmPasswordPlaceholder': 'Confirmez votre mot de passe',
        'auth.language': 'Langue',
        'auth.registerButton': 'S\'inscrire',
        'auth.alreadyHaveAccount': 'Vous avez déjà un compte ?',
        'auth.loginLink': 'Se connecter',
        'auth.passwordRequirements': 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial',
        'common.loading': 'Chargement...',
        'validation.required': 'Ce champ est requis',
        'validation.email': 'Veuillez entrer une adresse email valide',
        'validation.passwordMinLength': 'Le mot de passe doit contenir au moins 8 caractères',
        'validation.passwordPattern': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
        'validation.passwordMatch': 'Les mots de passe ne correspondent pas',
        'languages.french': 'Français',
        'languages.english': 'Anglais',
        'languages.arabic': 'Arabe'
      };
      return translations[key] || key;
    }
  })
}));

const { useAuth } = require('../../context/AuthContext');

describe('Register Page', () => {
  const mockRegister = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    useAuth.mockReturnValue({
      register: mockRegister,
      error: null,
      isAuthenticated: false
    });
  });

  test('renders registration form correctly', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </BrowserRouter>
    );

    // Check if main elements are rendered
    expect(screen.getByText('Inscription')).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmer le mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText('Langue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'S\'inscrire' })).toBeInTheDocument();
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
  });

  test('validates form inputs', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </BrowserRouter>
    );

    // Submit the form without filling inputs
    userEvent.click(screen.getByRole('button', { name: 'S\'inscrire' }));

    // Wait for validation errors
    await waitFor(() => {
      // 5 required fields: firstName, lastName, email, password, confirmPassword
      expect(screen.getAllByText('Ce champ est requis').length).toBeGreaterThanOrEqual(5);
    });

    // Enter invalid email
    userEvent.type(screen.getByLabelText('Email'), 'invalid-email');
    
    // Submit again
    userEvent.click(screen.getByRole('button', { name: 'S\'inscrire' }));
    
    // Check for email validation error
    await waitFor(() => {
      expect(screen.getByText('Veuillez entrer une adresse email valide')).toBeInTheDocument();
    });

    // Enter weak password
    userEvent.type(screen.getByLabelText('Mot de passe'), 'weak');
    
    // Submit again
    userEvent.click(screen.getByRole('button', { name: 'S\'inscrire' }));
    
    // Check for password validation error
    await waitFor(() => {
      expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères')).toBeInTheDocument();
    });

    // Enter different passwords
    userEvent.type(screen.getByLabelText('Mot de passe'), 'StrongPassword1!');
    userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'DifferentPassword1!');
    
    // Submit again
    userEvent.click(screen.getByRole('button', { name: 'S\'inscrire' }));
    
    // Check for password match error
    await waitFor(() => {
      expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument();
    });
  });

  test('submits the form with valid data', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </BrowserRouter>
    );

    // Fill form with valid data
    userEvent.type(screen.getByLabelText('Prénom'), 'John');
    userEvent.type(screen.getByLabelText('Nom'), 'Doe');
    userEvent.type(screen.getByLabelText('Email'), 'john.doe@example.com');
    userEvent.type(screen.getByLabelText('Mot de passe'), 'StrongPassword1!');
    userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'StrongPassword1!');
    
    // Select language
    const languageSelect = screen.getByLabelText('Langue');
    userEvent.selectOptions(languageSelect, 'fr');
    
    // Submit the form
    userEvent.click(screen.getByRole('button', { name: 'S\'inscrire' }));
    
    // Check if register function was called with correct arguments
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'John', 
        'Doe', 
        'john.doe@example.com', 
        'StrongPassword1!', 
        'StrongPassword1!', 
        'fr'
      );
    });
  });

  test('displays error message when registration fails', async () => {
    // Mock registration error
    useAuth.mockReturnValue({
      register: mockRegister,
      error: 'Email already exists',
      isAuthenticated: false
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </BrowserRouter>
    );

    // Error message should be displayed
    expect(screen.getByText('Email already exists')).toBeInTheDocument();
  });

  test('toggles password visibility', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Register />
        </AuthProvider>
      </BrowserRouter>
    );

    // Password should be hidden by default
    const passwordInput = screen.getByLabelText('Mot de passe');
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
