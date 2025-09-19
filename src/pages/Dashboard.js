// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./Dashboard.css";

function Dashboard() {
  const [farmers, setFarmers] = useState(0);
  const [collectors, setCollectors] = useState(0);
  const [milkTotal, setMilkTotal] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [filter, setFilter] = useState("week"); // default filter

  useEffect(() => {
    const fetchData = async () => {
      // ✅ Count farmers & collectors
      const usersSnap = await getDocs(collection(db, "users"));
      setFarmers(usersSnap.docs.filter((d) => d.data().role === "farmer").length);
      setCollectors(usersSnap.docs.filter((d) => d.data().role === "collector").length);

      // ✅ Fetch milk logs
      const logsSnap = await getDocs(collection(db, "milk_logs"));
      const allLogs = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // ✅ Date ranges
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      let rangeDays = 7;
      if (filter === "today") rangeDays = 1;
      if (filter === "month") rangeDays = 30;

      const startDate = new Date();
      startDate.setDate(now.getDate() - (rangeDays - 1));

      let totalMilk = 0;
      let pendingPay = 0;
      const pricePerLiter = 45;
      const dailyTotals = {};

      allLogs.forEach((log) => {
        if (!log.date) return;
        const logDate = log.date.toDate();
        const logDateStr = logDate.toISOString().split("T")[0];

        // Check if log is within selected filter range
        if (logDate >= startDate && logDate <= now) {
          totalMilk += log.quantity ?? 0;

          if (log.status === "pending") {
            pendingPay += (log.quantity ?? 0) * pricePerLiter;
          }

          const key =
            filter === "today"
              ? logDate.getHours() + ":00"
              : logDate.toLocaleDateString("en-US", { weekday: "short" });

          dailyTotals[key] = (dailyTotals[key] ?? 0) + (log.quantity ?? 0);
        }
      });

      setMilkTotal(totalMilk);
      setPendingPayments(pendingPay);

      // ✅ Prepare chart data
      const chartRange = [...Array(rangeDays)].map((_, i) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const label =
          filter === "today"
            ? date.getHours() + ":00"
            : date.toLocaleDateString("en-US", { weekday: "short" });

        return { day: label, liters: dailyTotals[label] ?? 0 };
      });

      setChartData(chartRange);

      // ✅ Save last 5 logs for recent activity
      setLogs(allLogs.slice(-5).reverse());
    };

    fetchData();
  }, [filter]);

  return (
    <div className="main-content">
      {/* ✅ Top Bar */}
      <div className="topbar">
        <h1>🌿 Admin Dashboard</h1>
        <div className="filters">
          <button
            className={filter === "today" ? "active" : ""}
            onClick={() => setFilter("today")}
          >
            Today
          </button>
          <button
            className={filter === "week" ? "active" : ""}
            onClick={() => setFilter("week")}
          >
            This Week
          </button>
          <button
            className={filter === "month" ? "active" : ""}
            onClick={() => setFilter("month")}
          >
            This Month
          </button>
        </div>
      </div>

      {/* ✅ Chart */}
      <div className="chart-section">
        <h2>📊 Milk Trends</h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="liters"
                stroke="#2d6a4f"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ✅ Cards */}
      <div className="cards-grid">
        <div className="card">
          <h3>👨‍🌾 Farmers</h3>
          <p>{farmers}</p>
        </div>
        <div className="card">
          <h3>🚛 Collectors</h3>
          <p>{collectors}</p>
        </div>
        <div className="card">
          <h3>🥛 Milk ({filter})</h3>
          <p>{milkTotal} L</p>
        </div>
        <div className="card">
          <h3>💰 Pending Payments</h3>
          <p>KES {pendingPayments}</p>
        </div>
      </div>

      {/* ✅ Recent Logs */}
      <div className="recent-logs">
        <h2>📝 Recent Milk Logs</h2>
        <table>
          <thead>
            <tr>
              <th>Farmer</th>
              <th>Quantity (L)</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.farmerName || "Unknown"}</td>
                <td>{log.quantity}</td>
                <td>
                  <span
                    className={`status ${
                      log.status === "paid" ? "paid" : "pending"
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
                <td>{log.date?.toDate().toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
