import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Container, Row, Col, Card, Button, Alert, Image } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const Login = () => {
  const { t } = useTranslation();
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  // Schéma de validation
  const validationSchema = Yup.object({
    email: Yup.string()
      .email(t('validation.email'))
      .required(t('validation.required')),
    password: Yup.string()
      .required(t('validation.required'))
  });

  // Valeurs initiales du formulaire
  const initialValues = {
    email: '',
    password: ''
  };

  // Gestion de la soumission du formulaire
  const handleSubmit = async (values, { setSubmitting }) => {
    const success = await login(values.email, values.password);
    if (success) {
      navigate('/dashboard');
    }
    setSubmitting(false);
  };

  return (
    <Container className="auth-container">
      <Row className="justify-content-center">
        <Col md={8} lg={6} xl={5}>
          <Card className="auth-card">
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                {/* Logo ou icône d'application */}
                <div className="mb-3">
                  <i className="bi bi-kanban text-primary" style={{ fontSize: '3rem' }}></i>
                </div>
                <h2 className="auth-title">{t('auth.login')}</h2>
                <p className="text-muted">{t('auth.loginSubtitle')}</p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}

              <Formik
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting }) => (
                  <Form>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">
                        <i className="bi bi-envelope me-2"></i>
                        {t('auth.email')}
                      </label>
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
                      <label htmlFor="password" className="form-label">
                        <i className="bi bi-lock me-2"></i>
                        {t('auth.password')}
                      </label>
                      <div className="input-group">
                        <Field
                          type={showPassword ? "text" : "password"}
                          name="password"
                          id="password"
                          className="form-control"
                          placeholder={t('auth.passwordPlaceholder')}
                        />
                        <Button 
                          variant="outline-secondary"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        >
                          <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                        </Button>
                      </div>
                      <ErrorMessage name="password" component="div" className="text-danger mt-1" />
                    </div>

                    <div className="d-flex justify-content-between mb-4">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="rememberMe"
                        />
                        <label className="form-check-label" htmlFor="rememberMe">
                          {t('auth.rememberMe')}
                        </label>
                      </div>
                      <Link to="/forgot-password" className="text-primary">
                        {t('auth.forgotPassword')}
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-100 mb-3"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          {t('common.loading')}
                        </>
                      ) : (
                        <>
                          <i className="bi bi-box-arrow-in-right me-2"></i>
                          {t('auth.loginButton')}
                        </>
                      )}
                    </Button>
                  </Form>
                )}
              </Formik>



              <div className="text-center mt-4">
                <p className="mb-0">
                  {t('auth.noAccount')}{' '}
                  <Link to="/register" className="text-primary">
                    <i className="bi bi-person-plus me-1"></i>
                    {t('auth.registerLink')}
                  </Link>
                </p>
              </div>
              
              <div className="text-center mt-3">
                <small className="text-muted">
                  <i className="bi bi-shield-lock me-1"></i>
                  {t('auth.secureConnection')}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
