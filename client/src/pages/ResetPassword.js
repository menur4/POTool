import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Container, Row, Col, Card, Button, Alert } from 'react-bootstrap';
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

  // Schéma de validation
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

  // Valeurs initiales du formulaire
  const initialValues = {
    password: '',
    confirmPassword: ''
  };

  // Gestion de la soumission du formulaire
  const handleSubmit = async (values, { setSubmitting }) => {
    const result = await resetPassword(token, values.password, values.confirmPassword);
    if (result) {
      setSuccess(true);
      // Rediriger vers la page de connexion après 3 secondes
      setTimeout(() => {
        navigate('/login');
      }, 3000);
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
                <h2 className="auth-title">{t('auth.resetPassword')}</h2>
                <p className="text-muted">{t('auth.resetPasswordSubtitle')}</p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}
              {success && (
                <Alert variant="success">
                  {t('auth.resetPasswordSuccess')}
                </Alert>
              )}

              {!success ? (
                <Formik
                  initialValues={initialValues}
                  validationSchema={validationSchema}
                  onSubmit={handleSubmit}
                >
                  {({ isSubmitting }) => (
                    <Form>
                      <div className="mb-3">
                        <label htmlFor="password" className="form-label">{t('auth.newPassword')}</label>
                        <div className="input-group">
                          <Field
                            type={showPassword ? "text" : "password"}
                            name="password"
                            id="password"
                            className="form-control"
                            placeholder={t('auth.newPasswordPlaceholder')}
                          />
                          <Button 
                            variant="outline-secondary"
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

                      <div className="mb-4">
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
                            variant="outline-secondary"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            <i className={`bi bi-eye${showConfirmPassword ? '-slash' : ''}`}></i>
                          </Button>
                        </div>
                        <ErrorMessage name="confirmPassword" component="div" className="text-danger mt-1" />
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
                          t('auth.resetPasswordButton')
                        )}
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
                  <Link to="/login" className="text-primary">
                    {t('auth.backToLogin')}
                  </Link>
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ResetPassword;
