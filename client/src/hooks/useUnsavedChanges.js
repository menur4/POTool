import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to track unsaved changes in forms and prevent accidental data loss
 * Following Apple HIG: "Get confirmation before closing if data loss could occur"
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether to track changes (default: true)
 * @param {Function} options.onConfirmDiscard - Callback when user confirms discarding changes
 * @returns {Object} - Hook state and methods
 */
const useUnsavedChanges = (options = {}) => {
  const { enabled = true, onConfirmDiscard } = options;

  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  /**
   * Mark the form as having unsaved changes
   */
  const markDirty = useCallback(() => {
    if (enabled) {
      setIsDirty(true);
    }
  }, [enabled]);

  /**
   * Reset the dirty state (usually after saving)
   */
  const resetDirty = useCallback(() => {
    setIsDirty(false);
  }, []);

  /**
   * Request to perform an action that would discard changes
   * If there are unsaved changes, show confirmation dialog
   * @param {Function} action - The action to perform if confirmed
   */
  const requestDiscard = useCallback((action) => {
    if (isDirty && enabled) {
      setPendingAction(() => action);
      setShowConfirmDialog(true);
    } else {
      // No unsaved changes, perform action immediately
      action();
    }
  }, [isDirty, enabled]);

  /**
   * Confirm discarding changes and perform pending action
   */
  const confirmDiscard = useCallback(() => {
    setShowConfirmDialog(false);
    setIsDirty(false);

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }

    if (onConfirmDiscard) {
      onConfirmDiscard();
    }
  }, [pendingAction, onConfirmDiscard]);

  /**
   * Cancel discarding changes
   */
  const cancelDiscard = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  }, []);

  /**
   * Handle form field changes - convenience method
   * Wraps the original onChange and marks form as dirty
   * @param {Function} originalOnChange - The original onChange handler
   * @returns {Function} - Wrapped onChange handler
   */
  const wrapOnChange = useCallback((originalOnChange) => {
    return (...args) => {
      markDirty();
      if (originalOnChange) {
        originalOnChange(...args);
      }
    };
  }, [markDirty]);

  /**
   * Warn user before leaving page with unsaved changes
   */
  useEffect(() => {
    if (!enabled || !isDirty) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, enabled]);

  return {
    // State
    isDirty,
    showConfirmDialog,

    // Methods
    markDirty,
    resetDirty,
    setIsDirty,
    requestDiscard,
    confirmDiscard,
    cancelDiscard,
    wrapOnChange,
  };
};

export default useUnsavedChanges;
