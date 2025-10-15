import React, { useState, useEffect } from 'react';
import { Row, Col } from 'react-bootstrap';
import PropTypes from 'prop-types';

const Footer = ({ currentCompanyName, user, currentFiscalYear, company }) => {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format renewal date if it exists
  const formatRenewalDate = () => {
    if (!company?.renewalDate) return 'Demo Version';
    
    const date = new Date(company.renewalDate);
    return `Valid Upto: ${date.toLocaleDateString()}`;
  };

  return (
    <footer className="footer" style={{
      textAlign: 'center',
      marginTop: '0px',
      padding: '10px 0',
      backgroundColor: '#f0f2f5',
      fontSize: '0.75rem'
    }}>
      <Row>
        <Col>{currentCompanyName || 'Company Name'}</Col>
        <Col>User: {user?.name || 'Guest'} ({user?.role || 'No role'})</Col>
        <Col>F.Y: {currentFiscalYear?.name || 'Not selected'}</Col>
        <Col>{formatRenewalDate()}</Col>
        <Col id="live-time">{currentTime}</Col>
      </Row>
    </footer>
  );
};

Footer.propTypes = {
  currentCompanyName: PropTypes.string,
  user: PropTypes.shape({
    name: PropTypes.string,
    role: PropTypes.string
  }),
  currentFiscalYear: PropTypes.shape({
    name: PropTypes.string
  }),
  company: PropTypes.shape({
    renewalDate: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date)
    ])
  })
};

Footer.defaultProps = {
  currentCompanyName: '',
  user: {
    name: 'Guest',
    role: 'No role'
  },
  currentFiscalYear: null,
  company: {
    renewalDate: null
  }
};

export default Footer;