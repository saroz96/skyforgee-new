// DashboardLayout.js
import React from 'react';
import { Navbar, Nav } from 'react-bootstrap';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DashboardLayout = ({ children, user, isAdminOrSupervisor }) => {
  const { logout } = useAuth();

  return (
    <>
      <Navbar bg="light" expand="lg" className="mb-4">
        <Navbar.Brand as={Link} to="/dashboard">
          <i className="fas fa-tachometer-alt me-2"></i>
          Dashboard | {user?.name}
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav>
            {isAdminOrSupervisor && (
              <Nav.Link as={Link} to="/split/company">
                <i className="fas fa-plus-circle me-1"></i>Split Financial Year
              </Nav.Link>
            )}
            {isAdminOrSupervisor && (
              <Nav.Link as={Link} to="/company/new">
                <i className="fas fa-plus-circle me-1"></i>Create Company
              </Nav.Link>
            )}
            <Nav.Link onClick={logout}>
              <i className="fas fa-sign-out-alt me-1"></i>Logout
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Navbar>
      {children}
    </>
  );
};

export default DashboardLayout;