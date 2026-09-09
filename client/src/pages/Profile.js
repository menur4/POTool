import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Spinner, useToast } from '@frhamon/design-system';
import { useAuth } from '../context/AuthContext';
import { uploadPhoto } from '../services/uploadService';
import '../styles/Profile.css';

// Le profil stocke le code langue (fr/en/ar) ; les libellés i18n sont sous
// languages.french / english / arabic.
const LANGUAGE_KEYS = { fr: 'french', en: 'english', ar: 'arabic' };

const Profile = () => {
  const { t } = useTranslation();
  const { currentUser, updateProfile } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const getAvatarUrl = () =>
    `https://ui-avatars.com/api/?name=${currentUser?.firstName?.charAt(0) || ''}${currentUser?.lastName?.charAt(0) || ''}&background=1A1A1A&color=fff&size=128`;

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast({ type: 'warning', message: t('profile.invalidType', 'Format d\'image non supporté (JPG, PNG, GIF, WEBP).') });
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast({ type: 'warning', message: t('profile.tooLarge', 'Image trop lourde (5 Mo maximum).') });
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const res = await uploadPhoto(file);
      const photoUrl = res.data?.fileUrl || res.data?.relativeUrl;
      if (photoUrl) {
        const ok = await updateProfile({ photo: photoUrl });
        showToast({
          type: ok ? 'success' : 'error',
          message: ok ? t('profile.photoUpdated', 'Photo mise à jour.') : t('profile.photoError', 'Impossible d\'enregistrer la photo.'),
        });
      } else {
        showToast({ type: 'error', message: t('profile.photoError', 'Impossible d\'enregistrer la photo.') });
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      showToast({ type: 'error', message: err?.message || t('profile.photoError', 'Impossible d\'enregistrer la photo.') });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    await updateProfile({ photo: '' });
  };

  return (
    <div className="profile-page">
      <h1>{t('profile.title')}</h1>
      <p className="profile-page__subtitle">{t('profile.subtitle')}</p>

      <div className="profile-section">
        <Card variant="outlined" padding="md">
          <h5>{t('profile.personalInfo')}</h5>

          <div className="profile-avatar">
            <div className="profile-avatar__wrapper" onClick={handlePhotoClick}>
              {uploading ? (
                <div className="profile-avatar__loading">
                  <Spinner size="sm" />
                </div>
              ) : (
                <img
                  src={currentUser?.photo || getAvatarUrl()}
                  alt={`${currentUser?.firstName} ${currentUser?.lastName}`}
                  className="profile-avatar__img"
                  onError={(e) => { e.target.src = getAvatarUrl(); }}
                />
              )}
              <div className="profile-avatar__overlay">
                <i className="bi bi-camera"></i>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {currentUser?.photo && (
              <button className="profile-avatar__remove" onClick={handleRemovePhoto}>
                <i className="bi bi-x-lg"></i>
                {t('profile.removePhoto', 'Supprimer la photo')}
              </button>
            )}
          </div>

          <div className="profile-info__row">
            <span className="profile-info__label">{t('auth.firstName')}:</span>
            <span className="profile-info__value">{currentUser?.firstName || ''}</span>
          </div>
          <div className="profile-info__row">
            <span className="profile-info__label">{t('auth.lastName')}:</span>
            <span className="profile-info__value">{currentUser?.lastName || ''}</span>
          </div>
          <div className="profile-info__row">
            <span className="profile-info__label">{t('auth.email')}:</span>
            <span className="profile-info__value">{currentUser?.email || ''}</span>
          </div>
          <div className="profile-info__row">
            <span className="profile-info__label">{t('profile.language')}:</span>
            <span className="profile-info__value">
              {t(`languages.${LANGUAGE_KEYS[currentUser?.language] || 'french'}`)}
            </span>
          </div>
        </Card>
      </div>

      <Card variant="outlined" padding="md">
        <h5>{t('profile.security')}</h5>
        <Button variant="primary">
          {t('profile.changePassword')}
        </Button>
      </Card>
    </div>
  );
};

export default Profile;
