// src/pages/Payments.js
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { format } from "date-fns";
import "./Payments.css";

function Payments() {
  const [logs, setLogs] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const pricePerLiter = 45;

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

  // 🔹 Fetch payments with filters
  const fetchPayments = async () => {
    let q = query(collection(db, "milk_logs"), orderBy("date", "desc"));

    if (selectedFarmer) {
      q = query(q, where("farmerId", "==", selectedFarmer));
    }
    if (statusFilter) {
      q = query(q, where("status", "==", statusFilter));
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

    const snapshot = await getDocs(q);
    setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmer, statusFilter, month, year]);

  // 🔹 Update Payment Status
  const updateStatus = async (logId, newStatus) => {
    const ref = doc(db, "milk_logs", logId);
    await updateDoc(ref, { status: newStatus });
    fetchPayments(); // refresh
  };

  // 🔹 Totals
  const totalPaid = logs
    .filter((log) => log.status === "paid")
    .reduce((sum, log) => sum + (log.quantity ?? 0) * pricePerLiter, 0);

  const totalPending = logs
    .filter((log) => log.status === "pending")
    .reduce((sum, log) => sum + (log.quantity ?? 0) * pricePerLiter, 0);

  return (
    <div className="payments">
      <h1>💰 Payments</h1>

      {/* 🔹 Filters */}
      <div className="filters">
        <select
          value={selectedFarmer}
          onChange={(e) => setSelectedFarmer(e.target.value)}
        >
          <option value="">All Farmers</option>
          {farmers.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name || f.id}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
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

        <button onClick={fetchPayments}>Apply</button>
      </div>

      {/* 🔹 Totals */}
      <div className="totals">
        <div className="total-card paid">
          ✅ Total Paid: <strong>KES {totalPaid}</strong>
        </div>
        <div className="total-card pending">
          ⏳ Pending Payments: <strong>KES {totalPending}</strong>
        </div>
      </div>

      {/* 🔹 Table */}
      <table className="payments-table">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Quantity (L)</th>
            <th>Amount (KES)</th>
            <th>Status</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.farmerName || log.farmerId}</td>
              <td>{log.quantity}</td>
              <td>{(log.quantity ?? 0) * pricePerLiter}</td>
              <td
                className={
                  log.status === "paid" ? "status-paid" : "status-pending"
                }
              >
                {log.status}
              </td>
              <td>
                {log.date?.toDate
                  ? format(log.date.toDate(), "MMM dd, yyyy HH:mm")
                  : "N/A"}
              </td>
              <td>
                {log.status === "pending" ? (
                  <button
                    onClick={() => updateStatus(log.id, "paid")}
                    className="mark-paid"
                  >
                    Mark as Paid
                  </button>
                ) : (
                  <button
                    onClick={() => updateStatus(log.id, "pending")}
                    className="mark-pending"
                  >
                    Mark as Pending
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Payments;
