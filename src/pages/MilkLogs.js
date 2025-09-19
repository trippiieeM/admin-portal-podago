// src/pages/MilkLogs.js
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { format } from "date-fns";
import "./MilkLogs.css";

function MilkLogs() {
  const [logs, setLogs] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // 🔹 Fetch farmers
  useEffect(() => {
    const fetchFarmers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const farmerList = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((u) => u.role === "farmer");
      setFarmers(farmerList);
    };
    fetchFarmers();
  }, []);

  // 🔹 Fetch logs with filters
  const fetchLogs = async () => {
    let q = query(collection(db, "milk_logs"), orderBy("date", "desc"));

    if (selectedFarmer) {
      q = query(q, where("farmerId", "==", selectedFarmer));
    }

    if (year) {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      q = query(q, where("date", ">=", start), where("date", "<=", end));
    }

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      q = query(q, where("date", ">=", start), where("date", "<=", end));
    }

    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      q = query(q, where("date", ">=", start), where("date", "<=", end));
    }

    const snapshot = await getDocs(q);
    setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmer, year, month, dateRange]);

  // 🔹 Export to CSV
  const exportCSV = () => {
    const header = ["Farmer", "Quantity", "Notes", "Status", "Date"];
    const rows = logs.map((log) => [
      log.farmerName || log.farmerId,
      log.quantity,
      log.notes || "—",
      log.status,
      log.date?.toDate
        ? format(log.date.toDate(), "MMM dd, yyyy HH:mm")
        : "N/A",
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [header, ...rows].map((row) => row.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "milk_logs.csv");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="milk-logs">
      <h1>🥛 Milk Logs</h1>

      {/* 🔹 Filters */}
      <div className="filters">
        <select
          value={selectedFarmer}
          onChange={(e) => setSelectedFarmer(e.target.value)}
        >
          <option value="">All Farmers</option>
          {farmers.map((farmer) => (
            <option key={farmer.id} value={farmer.id}>
              {farmer.name || farmer.id}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Year (e.g. 2025)"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />

        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All Months</option>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {format(new Date(2025, i), "MMMM")}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateRange.start}
          onChange={(e) =>
            setDateRange({ ...dateRange, start: e.target.value })
          }
        />
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
        />

        <button onClick={fetchLogs}>Apply</button>
        <button className="export-btn" onClick={exportCSV}>
          ⬇ Export CSV
        </button>
      </div>

      {/* 🔹 Logs Table */}
      <table className="logs-table">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Quantity (L)</th>
            <th>Notes</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.farmerName || log.farmerId}</td>
              <td>{log.quantity}</td>
              <td>{log.notes || "—"}</td>
              <td
                className={log.status === "paid" ? "status-paid" : "status-pending"}
              >
                {log.status}
              </td>
              <td>
                {log.date?.toDate
                  ? format(log.date.toDate(), "MMM dd, yyyy HH:mm")
                  : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MilkLogs;
