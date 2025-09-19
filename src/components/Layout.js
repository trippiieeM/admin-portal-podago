// src/components/Layout.js
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import "./Layout.css";

function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="layout">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <main className={`content ${isSidebarOpen ? "shifted" : ""}`}>
        {children}
      </main>
    </div>
  );
}

export default Layout;
