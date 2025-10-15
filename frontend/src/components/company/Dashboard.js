import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { Container, Card, Alert, Button } from 'react-bootstrap';
import DashboardLayout from '../company/DashboardLayout';
import CompanyList from '../company/CompanyList';
import SearchBar from './SearchBar';
import Loader from '../Loader';
import { setCurrentCompany } from '../../auth/authSlice'; // Import the action

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch(); // Get the dispatch function
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdminOrSupervisor, setIsAdminOrSupervisor] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch user data - response contains { user: { ... } }
        const userRes = await axios.get('/api/auth/me');
        const userData = userRes.data.user;
        setUser(userData);
        setIsAdminOrSupervisor(userData.isAdmin || userData.role === 'Supervisor');

        // Fetch companies
        const companiesRes = await axios.get('/api/user-companies');
        setCompanies(companiesRes.data);
        setFilteredCompanies(companiesRes.data);

        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = (searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredCompanies(companies);
      return;
    }

    const filtered = companies.filter(company =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCompanies(filtered);
  };

  const handleCompanyClick = async (companyId) => {
    try {
        setLoading(true);
        setError('');

        const response = await axios.get(`/api/switch/${companyId}`, {
            withCredentials: true
        });

        if (response.data.success) {
            // Update Redux store with company info
            dispatch(setCurrentCompany({
                company: response.data.data.sessionData.company,
                fiscalYear: response.data.data.sessionData.fiscalYear
            }));

            // Store in localStorage for persistence
            localStorage.setItem('currentCompany', JSON.stringify(response.data.data.sessionData.company));
            localStorage.setItem('currentFiscalYear', JSON.stringify(response.data.data.sessionData.fiscalYear));

            // Show success message
            setSuccess(response.data.message);

            // Redirect to the appropriate dashboard
            navigate(response.data.data.redirectPath);
        } else {
            setError(response.data.message);
            if (response.data.redirect) {
                navigate(response.data.redirect);
            }
        }
    } catch (err) {
        setError(err.response?.data?.message || 'Failed to switch company');
        console.error('Switch company error:', err);
    } finally {
        setLoading(false);
    }
};



  if (loading) return <Loader />;

  return (
    <DashboardLayout user={user} isAdminOrSupervisor={isAdminOrSupervisor}>
      <Container className="dashboard-container">
        <Card className="dashboard-card">
          <Card.Header>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="welcome-title">Welcome, {user?.name}</h1>
                <h2 className="card-title">Your Companies</h2>
              </div>
              <SearchBar onSearch={handleSearch} />
            </div>
          </Card.Header>

          <Card.Body>
            {error && (
              <Alert variant="danger" dismissible onClose={() => setError('')}>
                <i className="fas fa-exclamation-circle me-2"></i>
                {error}
              </Alert>
            )}

            {success && (
              <Alert variant="success" dismissible onClose={() => setSuccess('')}>
                <i className="fas fa-check-circle me-2"></i>
                {success}
              </Alert>
            )}

            <CompanyList
              companies={filteredCompanies}
              onCompanyClick={handleCompanyClick}
              isAdminOrSupervisor={isAdminOrSupervisor}
            />
          </Card.Body>
        </Card>
      </Container>
    </DashboardLayout>
  );
};

export default Dashboard;