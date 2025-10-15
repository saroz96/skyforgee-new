import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  FaUser,
  FaEnvelope,
  FaUserTag,
  FaToggleOn,
  FaUserShield,
  FaArrowLeft,
  FaCalendarAlt,
  FaBuilding,
  FaInfoCircle
} from 'react-icons/fa';
import NotificationToast from '../NotificationToast';
import Header from '../retailer/Header';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const ViewAdmin = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [fiscalYear, setFiscalYear] = useState(null);
  const [currentCompanyName, setCurrentCompanyName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    withCredentials: true,
  });

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await api.get(`/api/auth/admin/users/view/${id}`);
        if (response.data.success) {
          setUser(response.data.data.user);
          setCompany(response.data.data.company);
          setFiscalYear(response.data.data.currentFiscalYear);
          setCurrentCompanyName(response.data.data.currentCompanyName);
          setCurrentUser({
            isAdminOrSupervisor: response.data.data.isAdminOrSupervisor
          });
        } else {
          setError(response.data.error);
          if (response.status === 403) {
            navigate('/dashboard');
          }
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load user details');
        if (err.response?.status === 403) {
          navigate('/dashboard');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [id]);

  if (loading) {
    return (
      <div className='Container-fluid'>
        <Header />
        <div className="container mt-5">
          <div className="card mt-4 shadow-lg p-4">
            <div className="row justify-content-center">
              <div className="col-lg-8">
                <div className="card shadow-sm border-0">
                  <div className="card-header bg-primary text-white">
                    <Skeleton height={30} width={200} />
                  </div>
                  <div className="card-body p-4">
                    <div className="mb-4">
                      <Skeleton height={20} width={150} />
                      <Skeleton height={15} width={250} className="mt-2" />
                    </div>

                    <div className="mb-4">
                      <Skeleton height={20} width={150} />
                      <Skeleton height={25} width={80} className="mt-2" />
                    </div>

                    <div className="mb-4">
                      <Skeleton height={20} width={150} />
                      <Skeleton height={25} width={80} className="mt-2" />
                    </div>

                    <div className="mb-4">
                      <Skeleton height={20} width={150} />
                      <Skeleton height={25} width={80} className="mt-2" />
                    </div>
                  </div>
                  <div className="card-footer text-end">
                    <Skeleton height={40} width={150} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='Container-fluid'>
        <Header />
        <div className="container mt-4">
          <div className="alert alert-danger">
            <div className="d-flex align-items-center">
              <i className="fas fa-exclamation-circle me-2"></i>
              <div>{error}</div>
            </div>
            <button
              className="btn btn-sm btn-outline-danger mt-2"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='Container-fluid'>
      <Header />
      <div className="container mt-5">
        <div className="card mt-4 shadow-lg p-4 animate__animated animate__fadeInUp expanded-card">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="card shadow-sm border-0">
                <div className="card-header bg-primary text-white">
                  <h2 className="mb-0">
                    <FaUser className="me-2" />
                    {user.name}
                  </h2>
                </div>
                <div className="card-body p-4">

                  <div className="mb-4">
                    <h5><FaEnvelope className="me-2" /> Email</h5>
                    <p className="text-muted">
                      {user.email}
                    </p>
                  </div>

                  <div className="mb-4">
                    <h5><FaUserTag className="me-2" /> Role</h5>
                    <span className={`badge ${user.role === 'Admin' ? 'bg-danger' : 'bg-info'} text-dark`}>
                      {user.role}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h5><FaToggleOn className="me-2" /> Status</h5>
                    {user.isActive ? (
                      <span className="badge bg-success">Active</span>
                    ) : (
                      <span className="badge bg-danger">Inactive</span>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-muted">
                      <small>Created At: {new Date(user.createdAt).toLocaleString()}</small>
                    </p>
                    <p className="text-muted">
                      <small>Updated At: {new Date(user.updatedAt).toLocaleString()}</small>
                    </p>
                  </div>
                </div>
                {currentUser?.isAdminOrSupervisor && !user.isOwner && (
                  <div className="card-footer text-end">
                    <Link to="/auth/admin/users/list" className="btn btn-outline-primary">
                      <FaArrowLeft className="me-2" /> Back to User List
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <NotificationToast
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, show: false })}
      />
    </div>
  );
};

export default ViewAdmin;