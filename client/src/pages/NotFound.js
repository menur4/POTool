import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Row, Col, Button } from 'react-bootstrap';

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Row className="text-center">
        <Col md={12}>
          <h1 style={{ fontSize: '6rem', fontWeight: 'bold', color: '#3498db' }}>404</h1>
          <h2 className="mb-4">{t('errors.pageNotFound')}</h2>
          <p className="mb-4 text-muted">{t('errors.pageNotFoundMessage')}</p>
          <Button as={Link} to="/" variant="primary" size="lg">
            {t('errors.backToHome')}
          </Button>
        </Col>
      </Row>
    </Container>
  );
};

export default NotFound;
