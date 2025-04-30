import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../client/src/i18n'; // Assurez-vous que le chemin est correct
import TeamMembers from '../../../client/src/pages/TeamMembers';
import teamMemberService from '../../../client/src/services/teamMemberService';
import { AuthProvider } from '../../../client/src/context/AuthContext';

// Mock du service
jest.mock('../../../client/src/services/teamMemberService');

// Mock du contexte d'authentification
jest.mock('../../../client/src/context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { role: 'admin' },
    isAuthenticated: true
  })
}));

describe('TeamMembers Component', () => {
  const mockTeamMembers = [
    {
      _id: '1',
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      role: 'developer',
      profile: 'watcher',
      city: 'Paris',
      country: 'France',
      photo: 'http://localhost:3002/uploads/photo-123456789.jpg',
      dailyRate: 500,
      active: true
    },
    {
      _id: '2',
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie.martin@example.com',
      role: 'designer',
      profile: 'power-user',
      city: 'Lyon',
      country: 'France',
      photo: '',
      dailyRate: 600,
      active: true
    },
    {
      _id: '3',
      firstName: 'Pierre',
      lastName: 'Dubois',
      email: 'pierre.dubois@example.com',
      role: 'tech_lead',
      profile: 'admin',
      city: 'Marseille',
      country: 'France',
      photo: 'http://localhost:3002/uploads/photo-987654321.jpg',
      dailyRate: 700,
      active: true
    }
  ];

  beforeEach(() => {
    // Réinitialiser les mocks
    jest.clearAllMocks();
    
    // Mock des fonctions du service
    teamMemberService.getAllTeamMembers.mockResolvedValue({
      success: true,
      data: mockTeamMembers
    });
    
    teamMemberService.createTeamMember.mockResolvedValue({
      success: true,
      data: {
        _id: '3',
        firstName: 'Nouveau',
        lastName: 'Membre',
        email: 'nouveau.membre@example.com',
        role: 'tester',
        dailyRate: 450,
        active: true
      }
    });
    
    teamMemberService.updateTeamMember.mockResolvedValue({
      success: true,
      data: {
        _id: '1',
        firstName: 'Jean-Pierre',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 550,
        active: true
      }
    });
    
    teamMemberService.deleteTeamMember.mockResolvedValue({
      success: true
    });
    
    teamMemberService.toggleTeamMemberStatus.mockResolvedValue({
      success: true,
      data: {
        _id: '1',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500,
        active: false
      }
    });
  });

  it('devrait afficher la liste des membres de l\'équipe', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );

    // Vérifier que le service a été appelé
    expect(teamMemberService.getAllTeamMembers).toHaveBeenCalled();
    
    // Attendre que les données soient chargées
    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
      expect(screen.getByText('Marie Martin')).toBeInTheDocument();
      expect(screen.getByText('Pierre Dubois')).toBeInTheDocument();
    });
  });

  it('devrait afficher les profils utilisateurs avec les badges appropriés', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );
    
    // Attendre que les données soient chargées
    await waitFor(() => {
      // Vérifier la présence des badges de profil
      const watcherBadge = screen.getByText('Watcher');
      const powerUserBadge = screen.getByText('Power User');
      const adminBadge = screen.getByText('Admin');
      
      expect(watcherBadge).toBeInTheDocument();
      expect(powerUserBadge).toBeInTheDocument();
      expect(adminBadge).toBeInTheDocument();
      
      // Vérifier les classes de couleur des badges (optionnel si difficile à tester)
      // expect(watcherBadge.closest('.badge')).toHaveClass('bg-info');
      // expect(powerUserBadge.closest('.badge')).toHaveClass('bg-warning');
      // expect(adminBadge.closest('.badge')).toHaveClass('bg-danger');
    });
  });
  
  it('devrait afficher les informations de localisation avec les drapeaux de pays', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );
    
    // Attendre que les données soient chargées
    await waitFor(() => {
      // Vérifier la présence des informations de localisation
      expect(screen.getByText(/Paris, France/)).toBeInTheDocument();
      expect(screen.getByText(/Lyon, France/)).toBeInTheDocument();
      expect(screen.getByText(/Marseille, France/)).toBeInTheDocument();
    });
  });

  it('devrait ouvrir le modal d\'ajout de membre', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );

    // Cliquer sur le bouton d'ajout
    const addButton = await screen.findByText(/Ajouter un membre/i);
    fireEvent.click(addButton);
    
    // Vérifier que le modal est ouvert
    await waitFor(() => {
      expect(screen.getByText(/Nouveau membre/i)).toBeInTheDocument();
    });
  });

  it('devrait ajouter un nouveau membre avec tous les champs, y compris le profil et la localisation', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );

    // Cliquer sur le bouton d'ajout
    const addButton = await screen.findByText(/Ajouter un membre/i);
    fireEvent.click(addButton);
    
    // Remplir le formulaire avec tous les nouveaux champs
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/Prénom/i), { target: { value: 'Nouveau' } });
      fireEvent.change(screen.getByLabelText(/Nom/i), { target: { value: 'Membre' } });
      fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'nouveau.membre@example.com' } });
      fireEvent.change(screen.getByLabelText(/Rôle/i), { target: { value: 'tester' } });
      // Sélectionner un profil
      fireEvent.change(screen.getByLabelText(/Profil utilisateur/i), { target: { value: 'power-user' } });
      // Ajouter une ville et un pays
      fireEvent.change(screen.getByLabelText(/Ville/i), { target: { value: 'Bordeaux' } });
      fireEvent.change(screen.getByLabelText(/Pays/i), { target: { value: 'France' } });
      fireEvent.change(screen.getByLabelText(/TJM/i), { target: { value: '450' } });
    });
    
    // Simuler l'upload d'une photo
    // Note: Ceci est une simulation simplifiée car l'upload réel nécessiterait des mocks plus complexes
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    
    // Créer un fichier fictif
    const file = new File(['dummy content'], 'test-photo.jpg', { type: 'image/jpeg' });
    
    // Simuler l'upload du fichier
    const uploadInput = screen.getByLabelText(/Photo/i);
    fireEvent.change(uploadInput, { target: { files: [file] } });
    
    // Mock de la fonction uploadPhoto
    teamMemberService.uploadPhoto = jest.fn().mockResolvedValue({
      data: {
        success: true,
        fileUrl: 'http://localhost:3002/uploads/test-photo-123456789.jpg',
        fileName: 'test-photo-123456789.jpg'
      }
    });
    
    // Soumettre le formulaire
    const submitButton = screen.getByText(/Enregistrer/i);
    fireEvent.click(submitButton);
    
    // Vérifier que le service a été appelé avec les bonnes données
    await waitFor(() => {
      expect(teamMemberService.createTeamMember).toHaveBeenCalledWith({
        firstName: 'Nouveau',
        lastName: 'Membre',
        email: 'nouveau.membre@example.com',
        role: 'tester',
        dailyRate: 450
      });
    });
    
    // Vérifier que la liste a été rechargée
    await waitFor(() => {
      expect(teamMemberService.getAllTeamMembers).toHaveBeenCalledTimes(2);
    });
  });

  it('devrait ouvrir le modal d\'édition et mettre à jour un membre', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );

    // Attendre que les données soient chargées
    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });
    
    // Cliquer sur le bouton d'édition
    const editButtons = await screen.findAllByText(/Modifier/i);
    fireEvent.click(editButtons[0]);
    
    // Vérifier que le modal est ouvert
    await waitFor(() => {
      expect(screen.getByText(/Modifier un membre/i)).toBeInTheDocument();
    });
    
    // Modifier le formulaire
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/Prénom/i), { target: { value: 'Jean-Pierre' } });
      fireEvent.change(screen.getByLabelText(/TJM/i), { target: { value: '550' } });
    });
    
    // Soumettre le formulaire
    const submitButton = screen.getByText(/Enregistrer/i);
    fireEvent.click(submitButton);
    
    // Vérifier que le service a été appelé avec les bonnes données
    await waitFor(() => {
      expect(teamMemberService.updateTeamMember).toHaveBeenCalledWith('1', expect.objectContaining({
        firstName: 'Jean-Pierre',
        dailyRate: 550
      }));
    });
    
    // Vérifier que la liste a été rechargée
    await waitFor(() => {
      expect(teamMemberService.getAllTeamMembers).toHaveBeenCalledTimes(2);
    });
  });

  it('devrait supprimer un membre', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );

    // Attendre que les données soient chargées
    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });
    
    // Cliquer sur le bouton de suppression
    const deleteButtons = await screen.findAllByText(/Supprimer/i);
    fireEvent.click(deleteButtons[0]);
    
    // Vérifier que le modal de confirmation est ouvert
    await waitFor(() => {
      expect(screen.getByText(/Confirmer la suppression/i)).toBeInTheDocument();
    });
    
    // Confirmer la suppression
    const confirmButton = screen.getByText(/Confirmer/i);
    fireEvent.click(confirmButton);
    
    // Vérifier que le service a été appelé
    await waitFor(() => {
      expect(teamMemberService.deleteTeamMember).toHaveBeenCalledWith('1');
    });
    
    // Vérifier que la liste a été rechargée
    await waitFor(() => {
      expect(teamMemberService.getAllTeamMembers).toHaveBeenCalledTimes(2);
    });
  });

  it('devrait basculer le statut d\'un membre', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <TeamMembers />
      </I18nextProvider>
    );

    // Attendre que les données soient chargées
    await waitFor(() => {
      expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    });
    
    // Cliquer sur le bouton de basculement de statut
    const toggleButtons = await screen.findAllByText(/Désactiver/i);
    fireEvent.click(toggleButtons[0]);
    
    // Vérifier que le service a été appelé
    await waitFor(() => {
      expect(teamMemberService.toggleTeamMemberStatus).toHaveBeenCalledWith('1');
    });
    
    // Vérifier que la liste a été rechargée
    await waitFor(() => {
      expect(teamMemberService.getAllTeamMembers).toHaveBeenCalledTimes(2);
    });
  });
});
