import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Modal, Form, Alert, InputGroup, Image } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember, toggleTeamMemberStatus, uploadPhoto } from '../services/teamMemberService';
import { useAuth } from '../context/AuthContext';
import countriesData from 'country-flag-emoji-json';



const TeamMembers = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  // Temporairement, permettre à tous les utilisateurs d'ajouter des membres
  // const isAdmin = currentUser?.role === 'admin';
  const isAdmin = true; // Temporaire: tous les utilisateurs peuvent ajouter des membres
  
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideTJM, setHideTJM] = useState(true); // Par défaut, les TJM sont masqués
  const [sortField, setSortField] = useState('lastName'); // Champ de tri par défaut
  const [sortDirection, setSortDirection] = useState('asc'); // Direction de tri par défaut (ascendant)
  const [showModal, setShowModal] = useState(false);
  const [currentTeamMember, setCurrentTeamMember] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'developpeur',
    profile: 'watcher',
    dailyRate: isAdmin ? 0 : '',
    active: true,
    city: '',
    country: '',
    photo: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [teamMemberToDelete, setTeamMemberToDelete] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);



  // Charger les membres de l'équipe au chargement de la page
  useEffect(() => {
    fetchTeamMembers();
  }, []);

  // Récupérer les membres de l'équipe depuis l'API
  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getTeamMembers();
      
      // Déboguer les données des membres
      console.log('Membres récupérés:', response.data);
      
      // Vérifier les URLs des photos
      response.data.forEach(member => {
        if (member.photo) {
          console.log(`Membre ${member.firstName} ${member.lastName} - Photo URL:`, member.photo);
        }
      });
      
      setTeamMembers(response.data);
    } catch (error) {
      setError(error.message || 'Une erreur est survenue lors de la récupération des membres de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir le modal pour ajouter un nouveau membre
  const handleAddMember = () => {
    setCurrentTeamMember(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      role: 'developpeur',
      dailyRate: '',
      city: '',
      country: '',
      photo: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Ouvrir le modal pour éditer un membre existant
  const handleEditMember = (member) => {
    setCurrentTeamMember(member);
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      role: member.role,
      dailyRate: member.dailyRate,
      city: member.city || '',
      country: member.country || '',
      photo: member.photo || ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Gérer les changements dans le formulaire
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Effacer l'erreur pour ce champ
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };
  
  // Fonction pour gérer le changement de fichier
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Fonction pour gérer le drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Fonction pour gérer le drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Fonction pour uploader le fichier
  const handleFileUpload = async (file) => {
    // Vérifier le type de fichier
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setFormErrors({
        ...formErrors,
        photo: 'Format d\'image non supporté. Utilisez JPG, PNG, GIF ou WEBP.'
      });
      return;
    }
    
    // Vérifier la taille du fichier (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors({
        ...formErrors,
        photo: 'L\'image est trop volumineuse. Taille maximale: 5MB.'
      });
      return;
    }
    
    setUploadedFile(file);
    setFormErrors({ ...formErrors, photo: null });
    
    // Prévisualiser l'image
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData({
        ...formData,
        photo: e.target.result // URL temporaire pour la prévisualisation
      });
    };
    reader.readAsDataURL(file);
  };

  // Fonction pour envoyer le fichier au serveur
  const uploadFileToServer = async () => {
    if (!uploadedFile) return null;
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      console.log('Début de l\'upload du fichier:', uploadedFile.name);
      
      // Utiliser le callback de progression pour mettre à jour la barre de progression
      const response = await uploadPhoto(uploadedFile, (progress) => {
        setUploadProgress(progress);
      });
      
      console.log('Réponse du serveur après upload:', response.data);
      console.log('URL de la photo reçue:', response.data.fileUrl);
      
      setIsUploading(false);
      setUploadProgress(100);
      
      // Mettre à jour l'URL de la photo avec l'URL du serveur
      setFormData({
        ...formData,
        photo: response.data.fileUrl
      });
      
      console.log('URL de la photo mise à jour dans le formulaire:', response.data.fileUrl);
      
      return response.data.fileUrl;
    } catch (error) {
      console.error('Erreur lors de l\'upload de la photo:', error);
      setIsUploading(false);
      setFormErrors({
        ...formErrors,
        photo: error.message || 'Erreur lors de l\'upload de l\'image'
      });
      return null;
    }
  };

  // Fonction pour déclencher le clic sur l'input file
  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  // Valider le formulaire
  const validateForm = () => {
    const errors = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'Le prénom est requis';
    }
    
    if (!formData.lastName.trim()) {
      errors.lastName = 'Le nom est requis';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'L\'email est requis';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      errors.email = 'L\'email n\'est pas valide';
    }
    
    // Validation du TJM uniquement pour les admins
    if (isAdmin) {
      if (!formData.dailyRate) {
        errors.dailyRate = 'Le TJM est requis';
      } else if (isNaN(formData.dailyRate) || Number(formData.dailyRate) < 0) {
        errors.dailyRate = 'Le TJM doit être un nombre positif';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Soumettre le formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      console.log('Début de la soumission du formulaire');
      console.log('URL de la photo actuelle:', formData.photo);
      
      // Si un fichier a été uploadé, l'envoyer au serveur
      let photoUrl = formData.photo;
      if (uploadedFile) {
        console.log('Fichier détecté, envoi au serveur:', uploadedFile.name);
        photoUrl = await uploadFileToServer();
        console.log('URL de la photo après upload:', photoUrl);
        if (!photoUrl) {
          // Erreur lors de l'upload de la photo
          console.error('Erreur: Pas d\'URL de photo retournée après upload');
          setLoading(false);
          return;
        }
      }
      
      // Préparer les données à envoyer
      const memberData = {
        ...formData,
        photo: photoUrl
      };
      
      console.log('Données du membre à envoyer:', memberData);
      
      if (currentTeamMember) {
        // Mettre à jour un membre existant
        console.log('Mise à jour du membre:', currentTeamMember._id);
        const response = await updateTeamMember(currentTeamMember._id, memberData);
        console.log('Réponse après mise à jour:', response);
        setShowModal(false);
        await fetchTeamMembers();
      } else {
        // Créer un nouveau membre
        console.log('Création d\'un nouveau membre');
        const response = await createTeamMember(memberData);
        console.log('Réponse après création:', response);
        setShowModal(false);
        await fetchTeamMembers();
      }
      
      // Réinitialiser l'état d'upload
      setUploadedFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error('Erreur lors de la soumission du formulaire:', error);
      setError(error.message || 'Une erreur est survenue lors de l\'enregistrement du membre');
    } finally {
      setLoading(false);
    }
  };

  // Ouvrir la confirmation de suppression
  const handleDeleteConfirmation = (member) => {
    setTeamMemberToDelete(member);
    setDeleteConfirmation(true);
  };

  // Supprimer un membre
  const handleDeleteMember = async () => {
    try {
      setLoading(true);
      setError('');
      
      await deleteTeamMember(teamMemberToDelete._id);
      
      // Recharger la liste des membres
      await fetchTeamMembers();
      
      // Fermer la confirmation
      setDeleteConfirmation(false);
      setTeamMemberToDelete(null);
    } catch (error) {
      setError(error.message || 'Une erreur est survenue lors de la suppression du membre de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  // Activer/désactiver un membre
  const handleToggleStatus = async (id) => {
    try {
      setLoading(true);
      setError('');
      
      await toggleTeamMemberStatus(id);
      
      // Recharger la liste des membres
      await fetchTeamMembers();
    } catch (error) {
      setError(error.message || 'Une erreur est survenue lors de la modification du statut du membre de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  // Formater le rôle pour l'affichage
  const formatRole = (role) => {
    const roles = {
      // Nouveaux rôles
      chef_de_projet: 'Chef de Projet',
      delivery_manager: 'Delivery Manager',
      tech_lead: 'Tech Lead',
      developpeur: 'Développeur',
      business_analyst: 'Business Analyst',
      qa_lead: 'QA Lead',
      qa: 'QA',
      support: 'Support',
      support_lead: 'Support Lead',
      // Anciens rôles (pour compatibilité)
      developer: 'Développeur (ancien)',
      designer: 'Designer',
      tester: 'Testeur',
      product_owner: 'Product Owner',
      scrum_master: 'Scrum Master',
      other: 'Autre'
    };
    
    return roles[role] || role;
  };
  
  // Fonction pour trier les membres d'équipe
  const handleSort = (field) => {
    // Si on clique sur le même champ, on inverse la direction
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Sinon, on trie par le nouveau champ en ordre ascendant
      setSortField(field);
      setSortDirection('asc');
    }
  };
  

  
  // Fonction pour obtenir les membres triés
  const getSortedMembers = () => {
    if (!teamMembers.length) return [];
    
    return [...teamMembers].sort((a, b) => {
      let valueA, valueB;
      
      // Déterminer les valeurs à comparer en fonction du champ de tri
      switch (sortField) {
        case 'firstName':
          valueA = a.firstName?.toLowerCase() || '';
          valueB = b.firstName?.toLowerCase() || '';
          break;
        case 'lastName':
          valueA = a.lastName?.toLowerCase() || '';
          valueB = b.lastName?.toLowerCase() || '';
          break;
        case 'email':
          valueA = a.email?.toLowerCase() || '';
          valueB = b.email?.toLowerCase() || '';
          break;
        case 'role':
          valueA = a.role?.toLowerCase() || '';
          valueB = b.role?.toLowerCase() || '';
          break;
        case 'dailyRate':
          valueA = a.dailyRate || 0;
          valueB = b.dailyRate || 0;
          break;
        case 'city':
          valueA = a.city?.toLowerCase() || '';
          valueB = b.city?.toLowerCase() || '';
          break;
        case 'country':
          valueA = a.country?.toLowerCase() || '';
          valueB = b.country?.toLowerCase() || '';
          break;
        case 'status':
          valueA = a.active ? 1 : 0;
          valueB = b.active ? 1 : 0;
          break;
        default:
          valueA = a.lastName?.toLowerCase() || '';
          valueB = b.lastName?.toLowerCase() || '';
      }
      
      // Comparer les valeurs en fonction de la direction de tri
      if (valueA < valueB) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };
  
  // Construire l'URL complète pour les photos
  const getFullPhotoUrl = (photoUrl) => {
    if (!photoUrl) {
      console.log('getFullPhotoUrl: URL de photo vide');
      return null;
    }
    
    console.log('getFullPhotoUrl - URL d\'origine:', photoUrl);
    
    // Si l'URL est déjà complète (commence par http), la retourner telle quelle
    if (photoUrl.startsWith('http')) {
      console.log('getFullPhotoUrl - URL déjà complète:', photoUrl);
      return photoUrl;
    }
    
    // Sinon, construire l'URL complète
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}${photoUrl}`;
    console.log('getFullPhotoUrl - URL construite:', fullUrl);
    return fullUrl;
  };
  
  // Fonction pour rafraîchir les données des membres après un changement
  const refreshTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await getTeamMembers();
      setTeamMembers(response.data);
      setLoading(false);
    } catch (error) {
      setError(error.message || 'Erreur lors du rafraîchissement des données');
      setLoading(false);
    }
  };
  
  // Obtenir le drapeau emoji à partir du nom du pays
  const getCountryFlag = (countryName) => {
    if (!countryName) return '';
    
    // Normaliser le nom du pays (suppression des accents, passage en minuscules)
    const normalizedCountryName = countryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    // Correspondances spéciales pour les noms de pays en français
    const specialMappings = {
      'france': 'France',
      'etats-unis': 'United States',
      'etats unis': 'United States',
      'usa': 'United States',
      'royaume-uni': 'United Kingdom',
      'royaume uni': 'United Kingdom',
      'uk': 'United Kingdom',
      'allemagne': 'Germany',
      'espagne': 'Spain',
      'italie': 'Italy',
      'japon': 'Japan',
      'chine': 'China',
      'canada': 'Canada',
      'bresil': 'Brazil',
      'brésil': 'Brazil',
      'australie': 'Australia',
      'russie': 'Russia',
      'inde': 'India',
      'mexique': 'Mexico',
      'suisse': 'Switzerland',
      'belgique': 'Belgium',
      'pays-bas': 'Netherlands',
      'pays bas': 'Netherlands',
      'suede': 'Sweden',
      'suède': 'Sweden',
      'norvege': 'Norway',
      'norvège': 'Norway',
      'danemark': 'Denmark',
      'finlande': 'Finland',
      'portugal': 'Portugal',
      'grece': 'Greece',
      'grèce': 'Greece',
      'autriche': 'Austria',
      'pologne': 'Poland',
      'irlande': 'Ireland',
      'nouvelle-zelande': 'New Zealand',
      'nouvelle zelande': 'New Zealand',
      'singapour': 'Singapore',
      'coree du sud': 'South Korea',
      'corée du sud': 'South Korea',
      'emirats arabes unis': 'United Arab Emirates',
      'émirats arabes unis': 'United Arab Emirates',
      'maroc': 'Morocco',
      'tunisie': 'Tunisia',
      'algerie': 'Algeria',
      'algérie': 'Algeria',
      'senegal': 'Senegal',
      'sénégal': 'Senegal',
      'cote d\'ivoire': 'Ivory Coast',
      'côte d\'ivoire': 'Ivory Coast'
    };
    
    // Rechercher dans les correspondances spéciales
    const englishCountryName = specialMappings[normalizedCountryName] || countryName;
    
    // Rechercher le pays dans la liste des pays
    const country = Object.values(countriesData).find(c => 
      c.name.toLowerCase() === englishCountryName.toLowerCase() ||
      c.code.toLowerCase() === englishCountryName.toLowerCase()
    );
    
    return country ? country.emoji : '';
  };

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="mb-3">
            <i className="bi bi-people me-2"></i>
            {t('teamMembers.title', 'Gestion de l\'équipe')}
          </h1>
          <p className="text-muted">
            {t('teamMembers.subtitle', 'Gérez les membres de votre équipe et leurs taux journaliers moyens (TJM)')}
          </p>
          <div className="alert alert-info">
            <strong>Rôle actuel :</strong> {currentUser?.role || 'Non défini'} (isAdmin: {isAdmin ? 'Oui' : 'Non'})
          </div>
        </Col>
        {isAdmin && (
          <Col xs="auto" className="align-self-center">
            <Button 
              variant="primary" 
              onClick={handleAddMember}
              disabled={loading}
            >
              <i className="bi bi-person-plus-fill me-2"></i>
              {t('teamMembers.addMember', 'Ajouter un membre')}
            </Button>
          </Col>
        )}
      </Row>

      {error && (
        <Alert variant="danger" className="mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </Alert>
      )}

      <Card>
        <Card.Body>
          {loading && teamMembers.length === 0 ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Chargement...</span>
              </div>
              <p className="mt-3">{t('common.loading', 'Chargement...')}</p>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
              <p className="mt-3">{t('teamMembers.noMembers', 'Aucun membre dans l\'équipe')}</p>
              {isAdmin && (
                <Button 
                  variant="outline-primary" 
                  onClick={handleAddMember}
                  disabled={loading}
                >
                  <i className="bi bi-person-plus-fill me-2"></i>
                  {t('teamMembers.addFirstMember', 'Ajouter votre premier membre')}
                </Button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ verticalAlign: 'middle' }}>
                <thead>
                  <tr>
                    <th>{t('teamMembers.photo', '')}</th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('lastName')}
                      style={{ cursor: 'pointer' }}
                    >
                      {t('teamMembers.name', 'Nom')}
                      {sortField === 'lastName' && (
                        <i className={`bi bi-sort-${sortDirection === 'asc' ? 'down' : 'up'} ms-1`}></i>
                      )}
                    </th>

                    <th 
                      className="sortable" 
                      onClick={() => handleSort('country')}
                      style={{ cursor: 'pointer' }}
                    >
                      {t('teamMembers.location', 'Localisation')}
                      {sortField === 'country' && (
                        <i className={`bi bi-sort-${sortDirection === 'asc' ? 'down' : 'up'} ms-1`}></i>
                      )}
                    </th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('role')}
                      style={{ cursor: 'pointer' }}
                    >
                      {t('teamMembers.role', 'Rôle')}
                      {sortField === 'role' && (
                        <i className={`bi bi-sort-${sortDirection === 'asc' ? 'down' : 'up'} ms-1`}></i>
                      )}
                    </th>
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('profile')}
                      style={{ cursor: 'pointer' }}
                    >
                      {t('teamMembers.profile', 'Profil')}
                      {sortField === 'profile' && (
                        <i className={`bi bi-sort-${sortDirection === 'asc' ? 'down' : 'up'} ms-1`}></i>
                      )}
                    </th>
                    {isAdmin && (
                      <th 
                        className="sortable" 
                        onClick={() => handleSort('dailyRate')}
                        style={{ cursor: 'pointer' }}
                      >
                        {t('teamMembers.dailyRate', 'TJM')}
                        {sortField === 'dailyRate' && (
                          <i className={`bi bi-sort-${sortDirection === 'asc' ? 'down' : 'up'} ms-1`}></i>
                        )}
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="ms-1 p-0" 
                          onClick={(e) => { e.stopPropagation(); setHideTJM(!hideTJM); }}
                          title={hideTJM ? t('teamMembers.showTJM', 'Afficher les TJM') : t('teamMembers.hideTJM', 'Masquer les TJM')}
                        >
                          <i className={`bi ${hideTJM ? 'bi-eye' : 'bi-eye-slash'}`}></i>
                        </Button>
                      </th>
                    )}
                    <th 
                      className="sortable" 
                      onClick={() => handleSort('status')}
                      style={{ cursor: 'pointer' }}
                    >
                      {t('teamMembers.status', 'Statut')}
                      {sortField === 'status' && (
                        <i className={`bi bi-sort-${sortDirection === 'asc' ? 'down' : 'up'} ms-1`}></i>
                      )}
                    </th>
                    {isAdmin && <th className="text-end">{t('common.actions', 'Actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {getSortedMembers().map((member) => (
                    <tr key={member._id}>
                      <td className="text-center">
                        {member.photo ? (
                          <div>
                            <img 
                              src={getFullPhotoUrl(member.photo)} 
                              alt={`${member.firstName} ${member.lastName}`} 
                              className="rounded-circle" 
                              style={{ width: '40px', height: '40px', objectFit: 'cover' }} 
                              onError={(e) => { 
                                console.log('Erreur de chargement d\'image:', member.photo);
                                e.target.src = `https://ui-avatars.com/api/?name=${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}&background=random&color=fff&size=128`; 
                              }}
                            />
                          </div>
                        ) : (
                          <img 
                            src={`https://ui-avatars.com/api/?name=${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}&background=random&color=fff&size=128`} 
                            alt={`${member.firstName} ${member.lastName}`} 
                            className="rounded-circle" 
                            style={{ width: '40px', height: '40px', objectFit: 'cover' }} 
                          />
                        )}
                      </td>
                      <td className="align-middle">
                        {member.firstName} {member.lastName}
                      </td>
                      <td className="align-middle">
                        {member.country && (
                          <span className="me-1" title={member.country} style={{ fontSize: '1.2em' }}>
                            {getCountryFlag(member.country)}
                          </span>
                        )}
                        {member.city && member.country ? `${member.city}, ${member.country}` : 
                         member.city ? member.city : 
                         member.country ? member.country : '-'}
                      </td>
                      <td className="align-middle text-center">{formatRole(member.role)}</td>
                      <td className="align-middle text-center">
                        <Badge bg={member.profile === 'admin' ? 'danger' : member.profile === 'power-user' ? 'warning' : 'info'}>
                          {member.profile === 'admin' ? 'Admin' : 
                           member.profile === 'power-user' ? 'Power User' : 
                           'Watcher'}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="align-middle text-center">
                          {hideTJM ? (
                            <span title={`${member.dailyRate} €`}>
                              &#8226;&#8226;&#8226;&#8226;&#8226;&#8226;
                            </span>
                          ) : (
                            `${member.dailyRate} €`
                          )}
                        </td>
                      )}
                      <td className="align-middle text-center">
                        <Badge bg={member.active ? 'success' : 'secondary'}>
                          {member.active 
                            ? t('teamMembers.active', 'Actif') 
                            : t('teamMembers.inactive', 'Inactif')}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="text-end">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-2"
                            onClick={() => handleEditMember(member)}
                            disabled={loading}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button
                            variant={member.active ? 'outline-warning' : 'outline-success'}
                            size="sm"
                            className="me-2"
                            onClick={() => handleToggleStatus(member._id)}
                            disabled={loading}
                          >
                            <i className={`bi ${member.active ? 'bi-toggle-on' : 'bi-toggle-off'}`}></i>
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteConfirmation(member)}
                            disabled={loading}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal pour ajouter/éditer un membre */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {currentTeamMember 
              ? t('teamMembers.editMember', 'Modifier un membre') 
              : t('teamMembers.addMember', 'Ajouter un membre')}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group controlId="firstName">
                  <Form.Label>{t('teamMembers.firstName', 'Prénom')}</Form.Label>
                  <Form.Control
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    isInvalid={!!formErrors.firstName}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.firstName}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="lastName">
                  <Form.Label>{t('teamMembers.lastName', 'Nom')}</Form.Label>
                  <Form.Control
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    isInvalid={!!formErrors.lastName}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.lastName}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3" controlId="email">
              <Form.Label>{t('teamMembers.email', 'Email')}</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                isInvalid={!!formErrors.email}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.email}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" controlId="role">
              <Form.Label>{t('teamMembers.role', 'Rôle')}</Form.Label>
              <Form.Select 
                name="role" 
                value={formData.role} 
                onChange={handleChange}
                isInvalid={!!formErrors.role}
              >
                <option value="chef_de_projet">{t('teamMembers.roles.chefDeProjet', 'Chef de Projet')}</option>
                <option value="delivery_manager">{t('teamMembers.roles.deliveryManager', 'Delivery Manager')}</option>
                <option value="tech_lead">{t('teamMembers.roles.techLead', 'Tech Lead')}</option>
                <option value="developpeur">{t('teamMembers.roles.developpeur', 'Développeur')}</option>
                <option value="business_analyst">{t('teamMembers.roles.businessAnalyst', 'Business Analyst')}</option>
                <option value="qa_lead">{t('teamMembers.roles.qaLead', 'QA Lead')}</option>
                <option value="qa">{t('teamMembers.roles.qa', 'QA')}</option>
                <option value="support">{t('teamMembers.roles.support', 'Support')}</option>
                <option value="support_lead">{t('teamMembers.roles.supportLead', 'Support Lead')}</option>
                <option value="designer">{t('teamMembers.roles.designer', 'Designer')}</option>
                <option value="other">{t('teamMembers.roles.other', 'Autre')}</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3" controlId="profile">
              <Form.Label>{t('teamMembers.profile', 'Profil utilisateur')}</Form.Label>
              <Form.Select 
                name="profile" 
                value={formData.profile} 
                onChange={handleChange}
                isInvalid={!!formErrors.profile}
              >
                <option value="watcher">{t('teamMembers.profiles.watcher', 'Watcher')}</option>
                <option value="power-user">{t('teamMembers.profiles.powerUser', 'Power User')}</option>
                <option value="admin">{t('teamMembers.profiles.admin', 'Admin')}</option>
              </Form.Select>
              <Form.Text className="text-muted">
                {t('teamMembers.profileHelp', 'Définit les permissions accordées à l\'utilisateur dans l\'application.')}
              </Form.Text>
            </Form.Group>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group controlId="city">
                  <Form.Label>{t('teamMembers.city', 'Ville')}</Form.Label>
                  <Form.Control
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    isInvalid={!!formErrors.city}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.city}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="country">
                  <Form.Label>
                    {t('teamMembers.country', 'Pays')}
                    {formData.country && (
                      <span className="ms-2" title={formData.country}>
                        {getCountryFlag(formData.country)}
                      </span>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    isInvalid={!!formErrors.country}
                    list="countryList"
                  />
                  <datalist id="countryList">
                    <option value="France" />
                    <option value="Belgique" />
                    <option value="Suisse" />
                    <option value="Canada" />
                    <option value="Maroc" />
                    <option value="Tunisie" />
                    <option value="Algérie" />
                    <option value="Sénégal" />
                    <option value="Côte d'Ivoire" />
                    <option value="Royaume-Uni" />
                    <option value="Allemagne" />
                    <option value="Espagne" />
                    <option value="Italie" />
                    <option value="Portugal" />
                    <option value="Pays-Bas" />
                    <option value="États-Unis" />
                  </datalist>
                  <Form.Control.Feedback type="invalid">
                    {formErrors.country}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    {t('teamMembers.countryHelp', 'Saisissez le nom du pays pour afficher automatiquement son drapeau.')}
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3" controlId="photo">
              <Form.Label>{t('teamMembers.photo', 'Photo')}</Form.Label>
              
              {/* Zone de drag and drop */}
              <div 
                className={`drag-drop-zone p-3 mb-2 text-center ${dragActive ? 'active' : ''}`}
                style={{
                  border: `2px dashed ${dragActive ? '#0d6efd' : '#ced4da'}`,
                  borderRadius: '0.25rem',
                  backgroundColor: dragActive ? 'rgba(13, 110, 253, 0.05)' : '#f8f9fa',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onClick={onButtonClick}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                />
                
                {isUploading ? (
                  <div className="text-center">
                    <div className="spinner-border text-primary mb-2" role="status">
                      <span className="visually-hidden">Chargement...</span>
                    </div>
                    <div className="progress mb-2">
                      <div 
                        className="progress-bar" 
                        role="progressbar" 
                        style={{ width: `${uploadProgress}%` }} 
                        aria-valuenow={uploadProgress} 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      >
                        {uploadProgress}%
                      </div>
                    </div>
                    <p>{t('teamMembers.uploading', 'Envoi en cours...')}</p>
                  </div>
                ) : (
                  <div>
                    <i className="bi bi-cloud-arrow-up" style={{ fontSize: '2rem' }}></i>
                    <p className="mb-0">
                      {t('teamMembers.dragDropPhoto', 'Glissez et déposez une image ici ou cliquez pour sélectionner')}
                    </p>
                    <small className="text-muted">
                      {t('teamMembers.photoFormats', 'Formats acceptés: JPG, PNG, GIF, WEBP (max 5MB)')}
                    </small>
                  </div>
                )}
              </div>
              
              <Form.Control.Feedback type="invalid" style={{ display: formErrors.photo ? 'block' : 'none' }}>
                {formErrors.photo}
              </Form.Control.Feedback>
              
              {/* Aperçu de l'image */}
              {formData.photo && (
                <div className="mt-2 text-center">
                  <img 
                    src={formData.photo} 
                    alt="Aperçu" 
                    className="img-thumbnail" 
                    style={{ maxWidth: '150px', maxHeight: '150px' }} 
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${formData.firstName?.charAt(0) || ''}${formData.lastName?.charAt(0) || ''}&background=random&color=fff&size=128`; }}
                  />
                  {uploadedFile && (
                    <div className="mt-1">
                      <small className="text-muted">{uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)</small>
                    </div>
                  )}
                </div>
              )}
            </Form.Group>

            {isAdmin && (
              <Form.Group className="mb-3" controlId="dailyRate">
                <Form.Label>
                  {t('teamMembers.dailyRate', 'Taux Journalier Moyen (TJM) en €')}
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="ms-1 p-0" 
                    onClick={() => setHideTJM(!hideTJM)}
                    title={hideTJM ? t('teamMembers.showTJM', 'Afficher le TJM') : t('teamMembers.hideTJM', 'Masquer le TJM')}
                  >
                    <i className={`bi ${hideTJM ? 'bi-eye' : 'bi-eye-slash'}`}></i>
                  </Button>
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type={hideTJM ? "password" : "number"}
                    name="dailyRate"
                    value={formData.dailyRate}
                    onChange={handleChange}
                    isInvalid={!!formErrors.dailyRate}
                    min="0"
                    step="0.01"
                  />
                  <InputGroup.Text>€</InputGroup.Text>
                </InputGroup>
                <Form.Control.Feedback type="invalid">
                  {formErrors.dailyRate}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  {t('teamMembers.dailyRateHelp', 'Ce taux sera utilisé pour calculer la valeur financière des user stories.')}
                </Form.Text>
              </Form.Group>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {t('common.loading', 'Chargement...')}
                </>
              ) : (
                t('common.save', 'Enregistrer')
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal de confirmation de suppression */}
      <Modal show={deleteConfirmation} onHide={() => setDeleteConfirmation(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('teamMembers.deleteConfirmation', 'Confirmer la suppression')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {teamMemberToDelete && (
            <p>
              {t('teamMembers.deleteWarning', 'Êtes-vous sûr de vouloir supprimer le membre')} 
              <strong> {teamMemberToDelete.firstName} {teamMemberToDelete.lastName}</strong> ?
              {t('teamMembers.deleteWarningDetails', 'Cette action est irréversible.')}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDeleteConfirmation(false)}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button variant="danger" onClick={handleDeleteMember} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {t('common.loading', 'Chargement...')}
              </>
            ) : (
              <>
                <i className="bi bi-trash me-2"></i>
                {t('common.delete', 'Supprimer')}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default TeamMembers;
