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
} from "react-icons/fa";
import "./Sidebar.css";

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();

  const menuItems = [
    { path: "/", name: "Dashboard", icon: <FaHome /> },
    { path: "/farmers", name: "Farmers", icon: <FaUserFriends /> },
    { path: "/milk-logs", name: "Milk Logs", icon: <FaTint /> },
    { path: "/payments", name: "Payments", icon: <FaMoneyBillWave /> },
  ];

  return (
    <>
      {/* 🔹 Toggle Button stays always visible */}
      <button className="toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* 🔹 Sidebar slides in/out */}
      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        <nav>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={location.pathname === item.path ? "active" : ""}
            >
              <span className="icon">{item.icon}</span>
              {isOpen && <span className="label">{item.name}</span>}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

export default Sidebar;
