import React from 'react';
import { Modal, Button } from '@frhamon/design-system';
import { useTranslation } from 'react-i18next';
import './ConfirmationModal.css';

/**
 * Reusable confirmation modal following Apple HIG principles
 * "The Cancel button must never directly discard any state or data.
 * Always display an additional confirmation dialog as a safety measure."
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed/cancelled
 * @param {Function} props.onConfirm - Callback when action is confirmed
 * @param {string} props.title - Modal title
 * @param {string|React.ReactNode} props.message - Confirmation message
 * @param {string} props.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {'danger'|'warning'|'info'} props.variant - Visual variant (default: 'danger')
 * @param {boolean} props.loading - Whether confirm action is in progress
 * @param {string} props.icon - Optional icon to display
 */
const ConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  loading = false,
  icon,
}) => {
  const { t } = useTranslation();

  // Default texts from translations
  const defaultConfirmText = confirmText || t('common.confirm');
  const defaultCancelText = cancelText || t('common.cancel');

  // Get button variant based on modal variant
  const getButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'danger';
      case 'warning':
        return 'primary';
      case 'info':
      default:
        return 'primary';
    }
  };

  // Get icon based on variant if not provided
  const getDefaultIcon = () => {
    switch (variant) {
      case 'danger':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const displayIcon = icon || getDefaultIcon();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
      className={`confirmation-modal confirmation-modal--${variant}`}
      footer={
        <div className="confirmation-modal__actions">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {defaultCancelText}
          </Button>
          <Button
            variant={getButtonVariant()}
            onClick={onConfirm}
            loading={loading}
          >
            {defaultConfirmText}
          </Button>
        </div>
      }
    >
      <div className="confirmation-modal__content">
        {displayIcon && (
          <div className={`confirmation-modal__icon confirmation-modal__icon--${variant}`}>
            {displayIcon}
          </div>
        )}
        <div className="confirmation-modal__message">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
