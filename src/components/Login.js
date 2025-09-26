// components/Login.jsx
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import './Login.css';

const Login = ({ onLogin }) => {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isCreatingAccount) {
        // Create new account
        if (credentials.password !== credentials.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        if (credentials.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          credentials.email, 
          credentials.password
        );

        // Create user document in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: credentials.email,
          role: 'admin',
          createdAt: new Date(),
          isActive: true
        });

        onLogin(true);
        localStorage.setItem('isAuthenticated', 'true');
        
      } else {
        // Login to existing account
        await signInWithEmailAndPassword(
          auth, 
          credentials.email, 
          credentials.password
        );
        
        onLogin(true);
        localStorage.setItem('isAuthenticated', 'true');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError(getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'Email is already registered';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/weak-password':
        return 'Password is too weak';
      case 'auth/user-not-found':
        return 'No account found with this email';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later';
      default:
        return 'Authentication failed. Please try again';
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const toggleMode = () => {
    setIsCreatingAccount(!isCreatingAccount);
    setError('');
    setCredentials({
      email: '',
      password: '',
      confirmPassword: ''
    });
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>{isCreatingAccount ? 'Create Admin Account' : 'Farm Management Login'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={credentials.email}
            onChange={handleChange}
            required
            placeholder="Enter your email"
          />
        </div>
        
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
            minLength="6"
          />
        </div>

        {isCreatingAccount && (
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={credentials.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
              minLength="6"
            />
          </div>
        )}

        <button 
          type="submit" 
          className="login-btn"
          disabled={loading}
        >
          {loading ? 'Processing...' : (isCreatingAccount ? 'Create Account' : 'Login')}
        </button>

        <div className="toggle-mode">
          <p>
            {isCreatingAccount ? 'Already have an account?' : "Don't have an account?"}
            <button type="button" className="toggle-btn" onClick={toggleMode}>
              {isCreatingAccount ? 'Login' : 'Create Account'}
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;