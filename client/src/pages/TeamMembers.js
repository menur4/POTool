import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner, useToast, Modal, Badge } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import { getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember, toggleTeamMemberStatus, uploadPhoto } from '../services/teamMemberService';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ui';
import countriesData from 'country-flag-emoji-json';
import '../styles/TeamMembers.css';

const TeamMembers = ({ embedded = false }) => {
  const { t } = useTranslation();
  useAuth();
  const { showToast } = useToast();
  // Temporairement, permettre à tous les utilisateurs d'ajouter des membres
  const isAdmin = true;

  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideTJM, setHideTJM] = useState(true);
  const [sortField] = useState('lastName');
  const [sortDirection] = useState('asc');
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

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    if (error) {
      showToast({ type: 'error', message: error });
      setError('');
    }
  }, [error, showToast]);

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getTeamMembers();
      setTeamMembers(response.data);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de la récupération des membres de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = () => {
    setCurrentTeamMember(null);
    setFormData({
      firstName: '', lastName: '', email: '', role: 'developpeur', profile: 'watcher',
      dailyRate: '', city: '', country: '', photo: ''
    });
    setFormErrors({});
    setUploadedFile(null);
    setUploadProgress(0);
    setShowModal(true);
  };

  const handleEditMember = (member) => {
    setCurrentTeamMember(member);
    setFormData({
      firstName: member.firstName, lastName: member.lastName, email: member.email,
      role: member.role, profile: member.profile || 'watcher', dailyRate: member.dailyRate,
      city: member.city || '', country: member.country || '', photo: member.photo || ''
    });
    setFormErrors({});
    setUploadedFile(null);
    setUploadProgress(0);
    setShowModal(true);
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  const handleFileUpload = async (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setFormErrors(prev => ({ ...prev, photo: 'Format d\'image non supporté. Utilisez JPG, PNG, GIF ou WEBP.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors(prev => ({ ...prev, photo: 'L\'image est trop volumineuse. Taille maximale: 5MB.' }));
      return;
    }
    setUploadedFile(file);
    setFormErrors(prev => ({ ...prev, photo: null }));
    const reader = new FileReader();
    reader.onload = (ev) => setFormData(prev => ({ ...prev, photo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const uploadFileToServer = async () => {
    if (!uploadedFile) return null;
    try {
      setIsUploading(true);
      setUploadProgress(0);
      const response = await uploadPhoto(uploadedFile, (progress) => setUploadProgress(progress));
      setIsUploading(false);
      setUploadProgress(100);
      setFormData(prev => ({ ...prev, photo: response.data.fileUrl }));
      return response.data.fileUrl;
    } catch (err) {
      setIsUploading(false);
      setFormErrors(prev => ({ ...prev, photo: err.message || 'Erreur lors de l\'upload de l\'image' }));
      return null;
    }
  };

  const onButtonClick = () => fileInputRef.current.click();

  const validateForm = () => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = 'Le prénom est requis';
    if (!formData.lastName.trim()) errors.lastName = 'Le nom est requis';
    if (formData.email.trim() && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      errors.email = 'L\'email n\'est pas valide';
    }
    if (formData.dailyRate && (isNaN(formData.dailyRate) || Number(formData.dailyRate) < 0)) {
      errors.dailyRate = 'Le TJM doit être un nombre positif';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      setError('');
      let photoUrl = formData.photo;
      if (uploadedFile) {
        photoUrl = await uploadFileToServer();
        if (!photoUrl) { setLoading(false); return; }
      }
      const memberData = { ...formData, photo: photoUrl };
      // Don't send empty email (would conflict with unique sparse index)
      if (!memberData.email?.trim()) delete memberData.email;
      // Default dailyRate to 0 if empty
      if (!memberData.dailyRate && memberData.dailyRate !== 0) memberData.dailyRate = 0;
      if (currentTeamMember) {
        await updateTeamMember(currentTeamMember._id, memberData);
      } else {
        await createTeamMember(memberData);
      }
      setShowModal(false);
      setUploadedFile(null);
      setUploadProgress(0);
      await fetchTeamMembers();
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de l\'enregistrement du membre');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirmation = (member) => {
    setTeamMemberToDelete(member);
    setDeleteConfirmation(true);
  };

  const handleDeleteMember = async () => {
    try {
      setLoading(true);
      setError('');
      await deleteTeamMember(teamMemberToDelete._id);
      await fetchTeamMembers();
      setDeleteConfirmation(false);
      setTeamMemberToDelete(null);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de la suppression du membre de l\'équipe');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      setLoading(true);
      setError('');
      await toggleTeamMemberStatus(id);
      await fetchTeamMembers();
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de la modification du statut');
    } finally {
      setLoading(false);
    }
  };

  const formatRole = (role) => {
    const roles = {
      chef_de_projet: 'Chef de Projet', delivery_manager: 'Delivery Manager',
      tech_lead: 'Tech Lead', developpeur: 'Développeur',
      developpeur_junior: 'Développeur Junior', developpeur_confirme: 'Développeur Confirmé',
      developpeur_senior: 'Développeur Senior',
      business_analyst: 'Business Analyst',
      qa_lead: 'QA Lead', qa: 'QA', support: 'Support', support_lead: 'Support Lead',
      product_owner: 'Product Owner', product_manager: 'Product Manager',
      developer: 'Développeur (ancien)', designer: 'Designer', tester: 'Testeur',
      scrum_master: 'Scrum Master', other: 'Autre'
    };
    return roles[role] || role;
  };

  const getSortedMembers = () => {
    if (!teamMembers.length) return [];
    return [...teamMembers].sort((a, b) => {
      let valueA, valueB;
      switch (sortField) {
        case 'firstName': valueA = a.firstName?.toLowerCase() || ''; valueB = b.firstName?.toLowerCase() || ''; break;
        case 'lastName': valueA = a.lastName?.toLowerCase() || ''; valueB = b.lastName?.toLowerCase() || ''; break;
        case 'email': valueA = a.email?.toLowerCase() || ''; valueB = b.email?.toLowerCase() || ''; break;
        case 'role': valueA = a.role?.toLowerCase() || ''; valueB = b.role?.toLowerCase() || ''; break;
        case 'dailyRate': valueA = a.dailyRate || 0; valueB = b.dailyRate || 0; break;
        case 'city': valueA = a.city?.toLowerCase() || ''; valueB = b.city?.toLowerCase() || ''; break;
        case 'country': valueA = a.country?.toLowerCase() || ''; valueB = b.country?.toLowerCase() || ''; break;
        case 'status': valueA = a.active ? 1 : 0; valueB = b.active ? 1 : 0; break;
        default: valueA = a.lastName?.toLowerCase() || ''; valueB = b.lastName?.toLowerCase() || '';
      }
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getFullPhotoUrl = (photoUrl) => {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('http')) return photoUrl;
    return `${window.location.origin}${photoUrl}`;
  };

  const getCountryFlag = (countryName) => {
    if (!countryName) return '';
    const normalized = countryName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const specialMappings = {
      'france': 'France', 'etats-unis': 'United States', 'etats unis': 'United States',
      'usa': 'United States', 'royaume-uni': 'United Kingdom', 'royaume uni': 'United Kingdom',
      'uk': 'United Kingdom', 'allemagne': 'Germany', 'espagne': 'Spain', 'italie': 'Italy',
      'japon': 'Japan', 'chine': 'China', 'canada': 'Canada', 'bresil': 'Brazil',
      'australie': 'Australia', 'russie': 'Russia', 'inde': 'India', 'mexique': 'Mexico',
      'suisse': 'Switzerland', 'belgique': 'Belgium', 'pays-bas': 'Netherlands',
      'pays bas': 'Netherlands', 'suede': 'Sweden', 'norvege': 'Norway', 'danemark': 'Denmark',
      'finlande': 'Finland', 'portugal': 'Portugal', 'grece': 'Greece', 'autriche': 'Austria',
      'pologne': 'Poland', 'irlande': 'Ireland', 'nouvelle-zelande': 'New Zealand',
      'nouvelle zelande': 'New Zealand', 'singapour': 'Singapore', 'coree du sud': 'South Korea',
      'emirats arabes unis': 'United Arab Emirates', 'maroc': 'Morocco', 'tunisie': 'Tunisia',
      'algerie': 'Algeria', 'senegal': 'Senegal', "cote d'ivoire": 'Ivory Coast'
    };
    const englishName = specialMappings[normalized] || countryName;
    const country = Object.values(countriesData).find(c =>
      c.name.toLowerCase() === englishName.toLowerCase() || c.code.toLowerCase() === englishName.toLowerCase()
    );
    return country ? country.emoji : '';
  };

  const getAvatarUrl = (member) =>
    `https://ui-avatars.com/api/?name=${member.firstName?.charAt(0) || ''}${member.lastName?.charAt(0) || ''}&background=random&color=fff&size=128`;

  return (
    <div className={`team-members-page ${embedded ? 'team-members-page--embedded' : ''}`}>
      <div className={`team-members-header ${embedded ? 'team-members-header--embedded' : ''}`}>
        {!embedded && (
          <div className="team-members-header__info">
            <h1>
              <i className="bi bi-people" style={{ marginRight: '8px' }}></i>
              {t('teamMembers.title', 'Gestion de l\'équipe')}
            </h1>
            <p className="team-members-header__subtitle">
              {t('teamMembers.subtitle', 'Gérez les membres de votre équipe et leurs taux journaliers moyens (TJM)')}
            </p>
          </div>
        )}
        {isAdmin && (
          <Button variant="primary" onClick={handleAddMember} loading={loading}>
            <i className="bi bi-person-plus-fill" style={{ marginRight: '8px' }}></i>
            {t('teamMembers.addMember', 'Ajouter un membre')}
          </Button>
        )}
      </div>

      {loading && teamMembers.length === 0 ? (
        <div className="team-members-list__loading">
          <Spinner size="lg" />
          <p>{t('common.loading', 'Chargement...')}</p>
        </div>
      ) : teamMembers.length === 0 ? (
        <div className="team-members-list__empty">
          <i className="bi bi-people"></i>
          <p>{t('teamMembers.noMembers', 'Aucun membre dans l\'équipe')}</p>
          {isAdmin && (
            <Button variant="secondary" onClick={handleAddMember}>
              <i className="bi bi-person-plus-fill" style={{ marginRight: '8px' }}></i>
              {t('teamMembers.addFirstMember', 'Ajouter votre premier membre')}
            </Button>
          )}
        </div>
      ) : (
        <div className="team-members-grid">
          {getSortedMembers().map((member) => (
            <div key={member._id} className={`team-card ${!member.active ? 'team-card--inactive' : ''}`}>
              <div className="team-card__header">
                <img
                  src={member.photo ? getFullPhotoUrl(member.photo) : getAvatarUrl(member)}
                  alt={`${member.firstName} ${member.lastName}`}
                  className="team-card__avatar"
                  onError={(e) => { e.target.src = getAvatarUrl(member); }}
                />
                <Badge
                  variant={member.active ? 'success' : 'default'}
                  dot rounded size="sm"
                >
                  {member.active ? t('teamMembers.active', 'Actif') : t('teamMembers.inactive', 'Inactif')}
                </Badge>
              </div>

              <div className="team-card__body">
                <div className="team-card__name">{member.firstName} {member.lastName}</div>
                <div className="team-card__role">{formatRole(member.role)}</div>
                {(member.city || member.country) && (
                  <div className="team-card__location">
                    {member.country && <span className="team-card__flag">{getCountryFlag(member.country)}</span>}
                    {member.city && member.country ? `${member.city}, ${member.country}` : member.city || member.country}
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="team-card__footer">
                  <button className="team-card__action team-card__action--edit"
                    onClick={() => handleEditMember(member)} disabled={loading} title={t('common.edit', 'Modifier')}>
                    <i className="bi bi-pencil"></i>
                  </button>
                  <button className="team-card__action team-card__action--toggle"
                    onClick={() => handleToggleStatus(member._id)} disabled={loading}
                    title={member.active ? t('teamMembers.deactivate', 'Désactiver') : t('teamMembers.activate', 'Activer')}>
                    <i className={`bi ${member.active ? 'bi-toggle-on' : 'bi-toggle-off'}`}></i>
                  </button>
                  <button className="team-card__action team-card__action--delete"
                    onClick={() => handleDeleteConfirmation(member)} disabled={loading} title={t('common.delete', 'Supprimer')}>
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Member Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={currentTeamMember ? t('teamMembers.editMember', 'Modifier un membre') : t('teamMembers.addMember', 'Ajouter un membre')}
        size="md"
        footer={
          <div className="team-member-form__footer">
            <Button variant="ghost" onClick={() => setShowModal(false)}>{t('common.cancel', 'Annuler')}</Button>
            <Button variant="primary" onClick={handleSubmit} loading={loading}>{t('common.save', 'Enregistrer')}</Button>
          </div>
        }>
        <div className="team-member-form__row">
          <div className="team-member-form__group">
            <label className="team-member-form__label">{t('teamMembers.firstName', 'Prénom')}</label>
            <input type="text" className={`team-member-form__input ${formErrors.firstName ? 'team-member-form__input--error' : ''}`}
              value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
            {formErrors.firstName && <span className="team-member-form__error">{formErrors.firstName}</span>}
          </div>
          <div className="team-member-form__group">
            <label className="team-member-form__label">{t('teamMembers.lastName', 'Nom')}</label>
            <input type="text" className={`team-member-form__input ${formErrors.lastName ? 'team-member-form__input--error' : ''}`}
              value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
            {formErrors.lastName && <span className="team-member-form__error">{formErrors.lastName}</span>}
          </div>
        </div>

        <div className="team-member-form__group">
          <label className="team-member-form__label">{t('teamMembers.email', 'Email')}</label>
          <input type="email" className={`team-member-form__input ${formErrors.email ? 'team-member-form__input--error' : ''}`}
            value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
          {formErrors.email && <span className="team-member-form__error">{formErrors.email}</span>}
        </div>

        <div className="team-member-form__group">
          <label className="team-member-form__label">{t('teamMembers.role', 'Rôle')}</label>
          <select className="team-member-form__select" value={formData.role} onChange={(e) => handleChange('role', e.target.value)}>
            <option value="chef_de_projet">{t('teamMembers.roles.chefDeProjet', 'Chef de Projet')}</option>
            <option value="delivery_manager">{t('teamMembers.roles.deliveryManager', 'Delivery Manager')}</option>
            <option value="tech_lead">{t('teamMembers.roles.techLead', 'Tech Lead')}</option>
            <option value="developpeur">{t('teamMembers.roles.developpeur', 'Développeur')}</option>
            <option value="developpeur_junior">{t('teamMembers.roles.developpeurJunior', 'Développeur Junior')}</option>
            <option value="developpeur_confirme">{t('teamMembers.roles.developpeurConfirme', 'Développeur Confirmé')}</option>
            <option value="developpeur_senior">{t('teamMembers.roles.developpeurSenior', 'Développeur Senior')}</option>
            <option value="product_owner">{t('teamMembers.roles.productOwner', 'Product Owner')}</option>
            <option value="product_manager">{t('teamMembers.roles.productManager', 'Product Manager')}</option>
            <option value="business_analyst">{t('teamMembers.roles.businessAnalyst', 'Business Analyst')}</option>
            <option value="qa_lead">{t('teamMembers.roles.qaLead', 'QA Lead')}</option>
            <option value="qa">{t('teamMembers.roles.qa', 'QA')}</option>
            <option value="support">{t('teamMembers.roles.support', 'Support')}</option>
            <option value="support_lead">{t('teamMembers.roles.supportLead', 'Support Lead')}</option>
            <option value="designer">{t('teamMembers.roles.designer', 'Designer')}</option>
            <option value="other">{t('teamMembers.roles.other', 'Autre')}</option>
          </select>
        </div>

        <div className="team-member-form__group">
          <label className="team-member-form__label">{t('teamMembers.profile', 'Profil utilisateur')}</label>
          <select className="team-member-form__select" value={formData.profile} onChange={(e) => handleChange('profile', e.target.value)}>
            <option value="watcher">{t('teamMembers.profiles.watcher', 'Watcher')}</option>
            <option value="power-user">{t('teamMembers.profiles.powerUser', 'Power User')}</option>
            <option value="admin">{t('teamMembers.profiles.admin', 'Admin')}</option>
          </select>
          <small className="team-member-form__help">{t('teamMembers.profileHelp', 'Définit les permissions accordées à l\'utilisateur dans l\'application.')}</small>
        </div>

        <div className="team-member-form__row">
          <div className="team-member-form__group">
            <label className="team-member-form__label">{t('teamMembers.city', 'Ville')}</label>
            <input type="text" className="team-member-form__input" value={formData.city} onChange={(e) => handleChange('city', e.target.value)} />
          </div>
          <div className="team-member-form__group">
            <label className="team-member-form__label">
              {t('teamMembers.country', 'Pays')}
              {formData.country && <span style={{ marginLeft: '8px' }} title={formData.country}>{getCountryFlag(formData.country)}</span>}
            </label>
            <input type="text" className="team-member-form__input" value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)} list="countryList" />
            <datalist id="countryList">
              <option value="France" /><option value="Belgique" /><option value="Suisse" />
              <option value="Canada" /><option value="Maroc" /><option value="Tunisie" />
              <option value="Algérie" /><option value="Sénégal" /><option value="Côte d'Ivoire" />
              <option value="Royaume-Uni" /><option value="Allemagne" /><option value="Espagne" />
              <option value="Italie" /><option value="Portugal" /><option value="Pays-Bas" /><option value="États-Unis" />
            </datalist>
            <small className="team-member-form__help">{t('teamMembers.countryHelp', 'Saisissez le nom du pays pour afficher automatiquement son drapeau.')}</small>
          </div>
        </div>

        <div className="team-member-form__group">
          <label className="team-member-form__label">{t('teamMembers.photo', 'Photo')}</label>
          <div className={`team-member-form__photo-zone ${dragActive ? 'team-member-form__photo-zone--active' : ''}`}
            onClick={onButtonClick} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} />
            {isUploading ? (
              <div className="team-member-form__upload-spinner">
                <Spinner size="md" />
                <div className="team-member-form__photo-progress">
                  <div className="team-member-form__photo-progress-bar" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p>{t('teamMembers.uploading', 'Envoi en cours...')}</p>
              </div>
            ) : (
              <div>
                <i className="bi bi-cloud-arrow-up"></i>
                <p>{t('teamMembers.dragDropPhoto', 'Glissez et déposez une image ici ou cliquez pour sélectionner')}</p>
                <small>{t('teamMembers.photoFormats', 'Formats acceptés: JPG, PNG, GIF, WEBP (max 5MB)')}</small>
              </div>
            )}
          </div>
          {formErrors.photo && <span className="team-member-form__error">{formErrors.photo}</span>}
          {formData.photo && (
            <div className="team-member-form__photo-preview">
              <img src={formData.photo} alt="Aperçu" onError={(e) => { e.target.src = getAvatarUrl(formData); }} />
              {uploadedFile && (
                <div className="team-member-form__photo-preview-info">{uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)</div>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="team-member-form__group">
            <label className="team-member-form__label">
              {t('teamMembers.dailyRate', 'Taux Journalier Moyen (TJM) en €')}
              <button type="button" className="team-members-table__tjm-toggle" onClick={() => setHideTJM(!hideTJM)}
                title={hideTJM ? t('teamMembers.showTJM', 'Afficher le TJM') : t('teamMembers.hideTJM', 'Masquer le TJM')}>
                <i className={`bi ${hideTJM ? 'bi-eye' : 'bi-eye-slash'}`}></i>
              </button>
            </label>
            <div className="team-member-form__input-group">
              <input type={hideTJM ? "password" : "number"} className={`team-member-form__input ${formErrors.dailyRate ? 'team-member-form__input--error' : ''}`}
                value={formData.dailyRate} onChange={(e) => handleChange('dailyRate', e.target.value)} min="0" step="0.01" />
              <span className="team-member-form__input-addon">€</span>
            </div>
            {formErrors.dailyRate && <span className="team-member-form__error">{formErrors.dailyRate}</span>}
            <small className="team-member-form__help">{t('teamMembers.dailyRateHelp', 'Ce taux sera utilisé pour calculer la valeur financière des user stories.')}</small>
          </div>
        )}
      </Modal>

      <ConfirmationModal open={deleteConfirmation} onClose={() => setDeleteConfirmation(false)} onConfirm={handleDeleteMember}
        title={t('teamMembers.deleteConfirmation', 'Confirmer la suppression')}
        message={teamMemberToDelete ? `${t('teamMembers.deleteWarning', 'Êtes-vous sûr de vouloir supprimer le membre')} ${teamMemberToDelete.firstName} ${teamMemberToDelete.lastName} ? ${t('teamMembers.deleteWarningDetails', 'Cette action est irréversible.')}` : ''}
        confirmText={t('common.delete', 'Supprimer')} cancelText={t('common.cancel', 'Annuler')} variant="danger" loading={loading} />
    </div>
  );
};

export default TeamMembers;
