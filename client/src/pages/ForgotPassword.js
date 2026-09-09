import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Card, Button } from '@frhamon/design-system';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const { forgotPassword, error } = useAuth();
  const [success, setSuccess] = useState(false);

  const validationSchema = Yup.object({
    email: Yup.string()
      .email(t('validation.email'))
      .required(t('validation.required'))
  });

  const initialValues = { email: '' };

  const handleSubmit = async (values, { setSubmitting }) => {
    const result = await forgotPassword(values.email);
    if (result) setSuccess(true);
    setSubmitting(false);
  };

  return (
    <div className="auth-container">
      <Card variant="elevated" padding="lg" className="auth-card">
        <div className="text-center mb-4">
          <h2 className="auth-title">{t('auth.forgotPassword')}</h2>
          <p className="text-muted">{t('auth.forgotPasswordSubtitle')}</p>
        </div>

        {error && <div className="auth-alert auth-alert--danger">{error}</div>}
        {success && <div className="auth-alert auth-alert--success">{t('auth.forgotPasswordSuccess')}</div>}

        {!success ? (
          <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
            {({ isSubmitting }) => (
              <Form>
                <div className="mb-4">
                  <label htmlFor="email" className="form-label">{t('auth.email')}</label>
                  <Field type="email" name="email" id="email" className="form-control" placeholder={t('auth.emailPlaceholder')} />
                  <ErrorMessage name="email" component="div" className="text-danger mt-1" />
                </div>

                <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
                  {t('auth.sendResetLink')}
                </Button>
              </Form>
            )}
          </Formik>
        ) : (
          <div className="text-center">
            <p>{t('auth.checkEmailInstructions')}</p>
            <Link to="/login">
              <Button variant="ghost" className="mt-3">
                {t('auth.backToLogin')}
              </Button>
            </Link>
          </div>
        )}

        <div className="text-center mt-4">
          <p className="mb-0">
            {t('auth.rememberPassword')}{' '}
            <Link to="/login" className="text-primary">{t('auth.loginLink')}</Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
