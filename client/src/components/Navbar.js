import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const MainNavbar = () => {
  const { t } = useTranslation();
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Vérifier si le lien est actif
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <Navbar bg="primary" variant="dark" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand as={Link} to="/dashboard">
          <i className="bi bi-kanban me-2"></i>
          POTool
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link 
              as={Link} 
              to="/dashboard" 
              active={isActive('/dashboard')}
            >
              <i className="bi bi-speedometer2 me-1"></i>
              {t('nav.dashboard', 'Tableau de bord')}
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/team-members" 
              active={isActive('/team-members')}
            >
              <i className="bi bi-people me-1"></i>
              {t('nav.teamMembers', 'Équipe')}
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/sprints" 
              active={isActive('/sprints')}
            >
              <i className="bi bi-kanban me-1"></i>
              {t('nav.sprints', 'Sprints')}
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/calendar" 
              active={isActive('/calendar')}
            >
              <i className="bi bi-calendar3 me-1"></i>
              {t('nav.calendar', 'Calendrier')}
            </Nav.Link>
          </Nav>
          <Nav>
            <NavDropdown 
              title={
                <span>
                  <i className="bi bi-person-circle me-1"></i>
                  {currentUser?.firstName} {currentUser?.lastName}
                </span>
              } 
              id="user-dropdown"
              align="end"
            >
              <NavDropdown.Item as={Link} to="/profile">
                <i className="bi bi-person me-2"></i>
                {t('nav.profile', 'Profil')}
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-2"></i>
                {t('nav.logout', 'Déconnexion')}
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default MainNavbar;
