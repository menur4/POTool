import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Container, Row, Col, Card, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const { forgotPassword, error } = useAuth();
  const [success, setSuccess] = useState(false);

  // Schéma de validation
  const validationSchema = Yup.object({
    email: Yup.string()
      .email(t('validation.email'))
      .required(t('validation.required'))
  });

  // Valeurs initiales du formulaire
  const initialValues = {
    email: ''
  };

  // Gestion de la soumission du formulaire
  const handleSubmit = async (values, { setSubmitting }) => {
    const result = await forgotPassword(values.email);
    if (result) {
      setSuccess(true);
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
                <h2 className="auth-title">{t('auth.forgotPassword')}</h2>
                <p className="text-muted">{t('auth.forgotPasswordSubtitle')}</p>
              </div>

              {error && <Alert variant="danger">{error}</Alert>}
              {success && (
                <Alert variant="success">
                  {t('auth.forgotPasswordSuccess')}
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
                      <div className="mb-4">
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
                          t('auth.sendResetLink')
                        )}
                      </Button>
                    </Form>
                  )}
                </Formik>
              ) : (
                <div className="text-center">
                  <p>{t('auth.checkEmailInstructions')}</p>
                  <Button
                    variant="outline-primary"
                    as={Link}
                    to="/login"
                    className="mt-3"
                  >
                    {t('auth.backToLogin')}
                  </Button>
                </div>
              )}

              <div className="text-center mt-4">
                <p className="mb-0">
                  {t('auth.rememberPassword')}{' '}
                  <Link to="/login" className="text-primary">
                    {t('auth.loginLink')}
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

export default ForgotPassword;
