import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Alert, Spinner, Button } from 'react-bootstrap';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await axios.get(`/auth/verify-email/${token}`);
        
        if (response.data.success) {
          setMessage('Email successfully verified! You can now log in.');
          setIsVerified(true);
        } else {
          setError(response.data.message || 'Email verification failed');
        }
      } catch (err) {
        setError(err.response?.data?.message || 
                err.message || 
                'Error verifying email. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token]);

  const handleLoginRedirect = () => {
    navigate('/auth/login'); // Make sure this matches your login route
  };

  return (
    <Container className="mt-5">
      <div className="text-center">
        <h2>Email Verification</h2>
        
        {loading && (
          <div className="my-4">
            <Spinner animation="border" role="status" />
            <p className="mt-2">Verifying your email...</p>
          </div>
        )}

        {message && (
          <div className="mt-4">
            <Alert variant="success">
              {message}
            </Alert>
            {isVerified && (
              <Button 
                variant="primary" 
                onClick={handleLoginRedirect}
                className="mt-3"
              >
                Go to Login
              </Button>
            )}
          </div>
        )}

        {error && (
          <Alert variant="danger" className="mt-4">
            {error}
          </Alert>
        )}
      </div>
    </Container>
  );
};

export default VerifyEmail;