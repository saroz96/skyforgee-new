import React from 'react';
import { Nav } from 'react-bootstrap';

const Sidebar = ({ user, isAdminOrSupervisor }) => {
  return (
    <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
      <div className="sidebar-brand">
        <a href="./index.html" className="brand-link">
          <img src="/assets/img/AdminLTELogo.png" alt="Logo" className="brand-image opacity-75 shadow" />
          <span className="brand-text fw-light">Sarathi-A/c Software</span>
        </a>
      </div>
      
      <div className="sidebar-wrapper">
        <nav className="mt-2">
          <ul className="nav sidebar-menu flex-column">
            <li className="nav-item menu-open">
              <a href="#" className="nav-link active">
                <i className="nav-icon bi bi-speedometer"></i>
                <p>
                  Dashboard
                  <i className="nav-arrow bi bi-chevron-right"></i>
                </p>
              </a>
              <ul className="nav nav-treeview">
                <li className="nav-item">
                  <a href="/retailerDashboard/indexv1" className="nav-link active">
                    <i className="nav-icon bi bi-circle"></i>
                    <p>Dashboard v1</p>
                  </a>
                </li>
              </ul>
            </li>
            
            {/* Other menu items */}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;