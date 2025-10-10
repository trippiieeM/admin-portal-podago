// src/components/Sidebar.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaUserFriends,
  FaTint,
  FaMoneyBillWave,
  FaBars,
  FaTimes,
  FaSign,
  FaSignOutAlt,
  FaUser,
  FaChartLine
} from "react-icons/fa";
import "./Sidebar.css";
import { FaBowlFood } from "react-icons/fa6";

function Sidebar({ isOpen, setIsOpen, onLogout, user }) {
  const location = useLocation();

  const menuItems = [
    { path: "/", name: "Dashboard", icon: <FaHome /> },
    { path: "/farmers", name: "Farmers", icon: <FaUserFriends /> },
    { path: "/milk-logs", name: "Milk Logs", icon: <FaTint /> },
    { path: "/payments", name: "Payments", icon: <FaMoneyBillWave /> },
    { path: "/analytics", name: "Analytics", icon: <FaChartLine /> },
    { path: "/feeds", name: "feeds", icon: <FaBowlFood /> },
  ];

  return (
    <>
      {/* 🔹 Toggle Button stays always visible */}
      <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* 🔹 Sidebar slides in/out */}
      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        {/* User Info Section */}
        {user && isOpen && (
          <div className="user-info">
            <div className="user-avatar">
              <FaUser />
            </div>
            <div className="user-details">
              <div className="user-email">{user.email}</div>
              <div className="user-role">Admin</div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => window.innerWidth <= 768 && setIsOpen(false)}
            >
              <span className="icon">{item.icon}</span>
              {isOpen && <span className="label">{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout Button */}
        {isOpen && (
          <div className="sidebar-footer">
            <button className="logout-btn" onClick={onLogout}>
              <span className="icon"><FaSignOutAlt /></span>
              <span className="label">Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
}

export default Sidebar;