import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./services/firebase";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Farmers from "./pages/Farmers";
import MilkLogs from "./pages/MilkLogs";
import Payments from "./pages/Payments";
import Analytics from "./pages/Analytics";
import Login from "./components/Login";
import "./App.css";

function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setUser(user);
        localStorage.setItem('isAuthenticated', 'true');
      } else {
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('isAuthenticated');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (status) => {
    setIsAuthenticated(status);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Protected Route Component
  const ProtectedRoute = ({ children }) => {
    return isAuthenticated ? children : <Navigate to="/login" />;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      {isAuthenticated ? (
        <>
          <Sidebar 
            isOpen={isOpen} 
            setIsOpen={setIsOpen} 
            onLogout={handleLogout}
            user={user}
          />
          <div className={`content ${isOpen ? "sidebar-open" : "sidebar-closed"}`}>
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard user={user} />
                </ProtectedRoute>
              } />
              <Route path="/farmers" element={
                <ProtectedRoute>
                  <Farmers />
                </ProtectedRoute>
              } />
              <Route path="/milk-logs" element={
                <ProtectedRoute>
                  <MilkLogs />
                </ProtectedRoute>
              } />
              <Route path="/payments" element={
                <ProtectedRoute>
                  <Payments />
                </ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              } />
              <Route path="/login" element={<Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </Router>
  );
}

export default App;