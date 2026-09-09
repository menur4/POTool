import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Card, Button } from '@frhamon/design-system';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const ResetPassword = () => {
  const { t } = useTranslation();
  const { resetPassword, error } = useAuth();
  const { token } = useParams();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validationSchema = Yup.object({
    password: Yup.string()
      .required(t('validation.required'))
      .min(8, t('validation.passwordMinLength'))
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        t('validation.passwordPattern')
      ),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password'), null], t('validation.passwordMatch'))
      .required(t('validation.required'))
  });

  const initialValues = { password: '', confirmPassword: '' };

  const handleSubmit = async (values, { setSubmitting }) => {
    const result = await resetPassword(token, values.password, values.confirmPassword);
    if (result) {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-container">
      <Card variant="elevated" padding="lg" className="auth-card">
        <div className="text-center mb-4">
          <h2 className="auth-title">{t('auth.resetPassword')}</h2>
          <p className="text-muted">{t('auth.resetPasswordSubtitle')}</p>
        </div>

        {error && <div className="auth-alert auth-alert--danger">{error}</div>}
        {success && <div className="auth-alert auth-alert--success">{t('auth.resetPasswordSuccess')}</div>}

        {!success ? (
          <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
            {({ isSubmitting }) => (
              <Form>
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">{t('auth.newPassword')}</label>
                  <div className="input-group">
                    <Field type={showPassword ? "text" : "password"} name="password" id="password"
                      className="form-control" placeholder={t('auth.newPasswordPlaceholder')} />
                    <Button variant="ghost" type="button" onClick={() => setShowPassword(!showPassword)}>
                      <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                    </Button>
                  </div>
                  <ErrorMessage name="password" component="div" className="text-danger mt-1" />
                  <small className="form-text text-muted">{t('auth.passwordRequirements')}</small>
                </div>

                <div className="mb-4">
                  <label htmlFor="confirmPassword" className="form-label">{t('auth.confirmPassword')}</label>
                  <div className="input-group">
                    <Field type={showConfirmPassword ? "text" : "password"} name="confirmPassword" id="confirmPassword"
                      className="form-control" placeholder={t('auth.confirmPasswordPlaceholder')} />
                    <Button variant="ghost" type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <i className={`bi bi-eye${showConfirmPassword ? '-slash' : ''}`}></i>
                    </Button>
                  </div>
                  <ErrorMessage name="confirmPassword" component="div" className="text-danger mt-1" />
                </div>

                <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
                  {t('auth.resetPasswordButton')}
                </Button>
              </Form>
            )}
          </Formik>
        ) : (
          <div className="text-center">
            <p>{t('auth.redirectingToLogin')}</p>
          </div>
        )}

        <div className="text-center mt-4">
          <p className="mb-0">
            <Link to="/login" className="text-primary">{t('auth.backToLogin')}</Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ResetPassword;
