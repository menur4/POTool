import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import teamMemberService from '../../../client/src/services/teamMemberService';

// Créer un mock pour axios
const mock = new MockAdapter(axios);

describe('Team Member Service', () => {
  // Réinitialiser les mocks après chaque test
  afterEach(() => {
    mock.reset();
  });

  describe('getAllTeamMembers', () => {
    it('devrait récupérer tous les membres de l\'équipe', async () => {
      const mockResponse = {
        success: true,
        count: 2,
        data: [
          {
            _id: '1',
            firstName: 'Jean',
            lastName: 'Dupont',
            email: 'jean.dupont@example.com',
            role: 'developer',
            dailyRate: 500,
            active: true
          },
          {
            _id: '2',
            firstName: 'Marie',
            lastName: 'Martin',
            email: 'marie.martin@example.com',
            role: 'designer',
            dailyRate: 600,
            active: true
          }
        ]
      };

      mock.onGet('/api/team-members').reply(200, mockResponse);

      const result = await teamMemberService.getAllTeamMembers();
      
      expect(result).toEqual(mockResponse);
    });

    it('devrait gérer les erreurs lors de la récupération des membres', async () => {
      mock.onGet('/api/team-members').reply(500, {
        success: false,
        message: 'Erreur serveur'
      });

      await expect(teamMemberService.getAllTeamMembers()).rejects.toThrow();
    });
  });

  describe('getTeamMember', () => {
    it('devrait récupérer un membre spécifique par ID', async () => {
      const mockResponse = {
        success: true,
        data: {
          _id: '1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'developer',
          dailyRate: 500,
          active: true
        }
      };

      mock.onGet('/api/team-members/1').reply(200, mockResponse);

      const result = await teamMemberService.getTeamMember('1');
      
      expect(result).toEqual(mockResponse);
    });

    it('devrait gérer les erreurs lors de la récupération d\'un membre', async () => {
      mock.onGet('/api/team-members/999').reply(404, {
        success: false,
        message: 'Membre non trouvé'
      });

      await expect(teamMemberService.getTeamMember('999')).rejects.toThrow();
    });
  });

  describe('createTeamMember', () => {
    it('devrait créer un nouveau membre', async () => {
      const newMember = {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        role: 'developer',
        dailyRate: 500
      };

      const mockResponse = {
        success: true,
        data: {
          _id: '1',
          ...newMember,
          active: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        }
      };

      mock.onPost('/api/team-members').reply(201, mockResponse);

      const result = await teamMemberService.createTeamMember(newMember);
      
      expect(result).toEqual(mockResponse);
    });

    it('devrait gérer les erreurs lors de la création d\'un membre', async () => {
      const invalidMember = {
        // Données incomplètes
        firstName: 'Jean'
      };

      mock.onPost('/api/team-members').reply(400, {
        success: false,
        message: 'Données invalides'
      });

      await expect(teamMemberService.createTeamMember(invalidMember)).rejects.toThrow();
    });
  });

  describe('updateTeamMember', () => {
    it('devrait mettre à jour un membre existant', async () => {
      const updatedData = {
        firstName: 'Jean-Pierre',
        dailyRate: 550
      };

      const mockResponse = {
        success: true,
        data: {
          _id: '1',
          firstName: 'Jean-Pierre',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'developer',
          dailyRate: 550,
          active: true,
          updatedAt: '2023-01-02T00:00:00.000Z'
        }
      };

      mock.onPut('/api/team-members/1').reply(200, mockResponse);

      const result = await teamMemberService.updateTeamMember('1', updatedData);
      
      expect(result).toEqual(mockResponse);
    });

    it('devrait gérer les erreurs lors de la mise à jour d\'un membre', async () => {
      mock.onPut('/api/team-members/999').reply(404, {
        success: false,
        message: 'Membre non trouvé'
      });

      await expect(teamMemberService.updateTeamMember('999', { firstName: 'Test' })).rejects.toThrow();
    });
  });

  describe('deleteTeamMember', () => {
    it('devrait supprimer un membre existant', async () => {
      const mockResponse = {
        success: true,
        data: {}
      };

      mock.onDelete('/api/team-members/1').reply(200, mockResponse);

      const result = await teamMemberService.deleteTeamMember('1');
      
      expect(result).toEqual(mockResponse);
    });

    it('devrait gérer les erreurs lors de la suppression d\'un membre', async () => {
      mock.onDelete('/api/team-members/999').reply(404, {
        success: false,
        message: 'Membre non trouvé'
      });

      await expect(teamMemberService.deleteTeamMember('999')).rejects.toThrow();
    });
  });

  describe('toggleTeamMemberStatus', () => {
    it('devrait basculer le statut d\'un membre', async () => {
      const mockResponse = {
        success: true,
        data: {
          _id: '1',
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          role: 'developer',
          dailyRate: 500,
          active: false, // Statut basculé
          updatedAt: '2023-01-02T00:00:00.000Z'
        }
      };

      mock.onPut('/api/team-members/1/toggle-status').reply(200, mockResponse);

      const result = await teamMemberService.toggleTeamMemberStatus('1');
      
      expect(result).toEqual(mockResponse);
    });

    it('devrait gérer les erreurs lors du basculement du statut d\'un membre', async () => {
      mock.onPut('/api/team-members/999/toggle-status').reply(404, {
        success: false,
        message: 'Membre non trouvé'
      });

      await expect(teamMemberService.toggleTeamMemberStatus('999')).rejects.toThrow();
    });
  });
});
