import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Farmers from "./pages/Farmers";
import MilkLogs from "./pages/MilkLogs";
import Payments from "./pages/Payments";
import "./App.css";

function App() {
  const [isOpen, setIsOpen] = useState(true); // ✅ Sidebar state lives here

  return (
    <Router>
      {/* Sidebar + toggle */}
      <Sidebar isOpen={isOpen} setIsOpen={setIsOpen} />

      {/* Page Content */}
      <div className={`content ${isOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/farmers" element={<Farmers />} />
          <Route path="/milk-logs" element={<MilkLogs />} />
          <Route path="/payments" element={<Payments />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
