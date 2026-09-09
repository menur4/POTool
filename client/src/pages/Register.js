import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Card, Button, useToast } from '@frhamon/design-system';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Register = () => {
  const { t } = useTranslation();
  const { register, error } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { showToast } = useToast();

  // Afficher les erreurs via Toast
  useEffect(() => {
    if (error) {
      showToast({ type: 'error', message: error });
    }
  }, [error, showToast]);

  // Schéma de validation
  const validationSchema = Yup.object({
    firstName: Yup.string()
      .required(t('validation.required'))
      .min(2, t('validation.minLength', { count: 2 }))
      .max(50, t('validation.maxLength', { count: 50 })),
    lastName: Yup.string()
      .required(t('validation.required'))
      .min(2, t('validation.minLength', { count: 2 }))
      .max(50, t('validation.maxLength', { count: 50 })),
    email: Yup.string()
      .email(t('validation.email'))
      .required(t('validation.required')),
    password: Yup.string()
      .required(t('validation.required'))
      .min(8, t('validation.passwordMinLength'))
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        t('validation.passwordPattern')
      ),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password'), null], t('validation.passwordMatch'))
      .required(t('validation.required')),
    language: Yup.string()
      .required(t('validation.required'))
  });

  // Valeurs initiales du formulaire
  const initialValues = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    language: 'fr'
  };

  // Gestion de la soumission du formulaire
  const handleSubmit = async (values, { setSubmitting }) => {
    const userData = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
      language: values.language
    };

    const success = await register(userData);
    if (success) {
      navigate('/dashboard');
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-container">
          <Card variant="elevated" padding="lg" className="auth-card">
            <div className="text-center mb-4">
              <h2 className="auth-title">{t('auth.register')}</h2>
              <p className="text-muted">{t('auth.registerSubtitle')}</p>
            </div>

            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting }) => (
                <Form>
                  <div className="form-row">
                    <div>
                      <div className="mb-3">
                        <label htmlFor="firstName" className="form-label">{t('auth.firstName')}</label>
                        <Field
                          type="text"
                          name="firstName"
                          id="firstName"
                          className="form-control"
                          placeholder={t('auth.firstNamePlaceholder')}
                        />
                        <ErrorMessage name="firstName" component="div" className="text-danger mt-1" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-3">
                        <label htmlFor="lastName" className="form-label">{t('auth.lastName')}</label>
                        <Field
                          type="text"
                          name="lastName"
                          id="lastName"
                          className="form-control"
                          placeholder={t('auth.lastNamePlaceholder')}
                        />
                        <ErrorMessage name="lastName" component="div" className="text-danger mt-1" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">{t('auth.email')}</label>
                    <Field
                      type="email"
                      name="email"
                      id="email"
                      className="form-control"
                      placeholder={t('auth.emailPlaceholder')}
                    />
                    <ErrorMessage name="email" component="div" className="text-danger mt-1" />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">{t('auth.password')}</label>
                    <div className="input-group">
                      <Field
                        type={showPassword ? "text" : "password"}
                        name="password"
                        id="password"
                        className="form-control"
                        placeholder={t('auth.passwordPlaceholder')}
                      />
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                      </Button>
                    </div>
                    <ErrorMessage name="password" component="div" className="text-danger mt-1" />
                    <small className="form-text text-muted">
                      {t('auth.passwordRequirements')}
                    </small>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">{t('auth.confirmPassword')}</label>
                    <div className="input-group">
                      <Field
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        id="confirmPassword"
                        className="form-control"
                        placeholder={t('auth.confirmPasswordPlaceholder')}
                      />
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <i className={`bi bi-eye${showConfirmPassword ? '-slash' : ''}`}></i>
                      </Button>
                    </div>
                    <ErrorMessage name="confirmPassword" component="div" className="text-danger mt-1" />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="language" className="form-label">{t('auth.language')}</label>
                    <Field
                      as="select"
                      name="language"
                      id="language"
                      className="form-select"
                    >
                      <option value="fr">{t('languages.french')}</option>
                      <option value="en">{t('languages.english')}</option>
                      <option value="ar">{t('languages.arabic')}</option>
                    </Field>
                    <ErrorMessage name="language" component="div" className="text-danger mt-1" />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={isSubmitting}
                  >
                    {t('auth.registerButton')}
                  </Button>
                </Form>
              )}
            </Formik>

            <div className="text-center mt-4">
              <p className="mb-0">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link to="/login" className="text-primary">
                  {t('auth.loginLink')}
                </Link>
              </p>
            </div>
          </Card>
    </div>
  );
};

export default Register;
