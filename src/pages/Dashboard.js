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
      let startDate = new Date();
      let rangeDays = 7;
      
      switch (filter) {
        case "today":
          rangeDays = 1;
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          rangeDays = 7;
          startDate.setDate(now.getDate() - 6); // Last 7 days including today
          break;
        case "month":
          rangeDays = 30;
          startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
          break;
        case "year":
          rangeDays = 12;
          startDate = new Date(now.getFullYear(), 0, 1); // Start of year
          break;
        default:
          rangeDays = 7;
          startDate.setDate(now.getDate() - 6);
      }

      let totalMilk = 0;
      let pendingPay = 0;
      const pricePerLiter = 45;
      const timeTotals = {};

      allLogs.forEach((log) => {
        if (!log.date) return;
        const logDate = log.date.toDate();
        
        // Check if log is within selected filter range
        const isInRange = logDate >= startDate && logDate <= now;
        
        if (isInRange) {
          totalMilk += log.quantity ?? 0;

          if (log.status === "pending") {
            pendingPay += (log.quantity ?? 0) * pricePerLiter;
          }

          let key;
          if (filter === "today") {
            // Group by hour for today
            key = `${logDate.getHours().toString().padStart(2, '0')}:00`;
          } else if (filter === "year") {
            // Group by month for year
            key = logDate.toLocaleDateString("en-US", { month: "short" });
          } else if (filter === "month") {
            // Group by actual date for month view (e.g., "Jan 1", "Jan 2")
            key = logDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          } else {
            // Group by day name for week
            key = logDate.toLocaleDateString("en-US", { weekday: "short" });
          }

          timeTotals[key] = (timeTotals[key] ?? 0) + (log.quantity ?? 0);
        }
      });

      setMilkTotal(totalMilk);
      setPendingPayments(pendingPay);

      // ✅ Prepare chart data
      let chartRange = [];
      
      if (filter === "today") {
        // Generate 24 hours for today
        chartRange = [...Array(24)].map((_, i) => {
          const hour = i.toString().padStart(2, '0') + ':00';
          return { time: hour, liters: timeTotals[hour] ?? 0 };
        });
      } else if (filter === "year") {
        // Generate 12 months for year
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        chartRange = months.map(month => ({
          month: month,
          liters: timeTotals[month] ?? 0
        }));
      } else if (filter === "month") {
        // Generate actual dates for current month (e.g., "Jan 1", "Jan 2", etc.)
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentMonth = now.toLocaleDateString("en-US", { month: "short" });
        
        chartRange = [...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateKey = `${currentMonth} ${day}`;
          return { 
            date: dateKey, 
            liters: timeTotals[dateKey] ?? 0 
          };
        });
      } else {
        // Generate days for week
        chartRange = [...Array(rangeDays)].map((_, i) => {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          const label = date.toLocaleDateString("en-US", { weekday: "short" });
          return { day: label, liters: timeTotals[label] ?? 0 };
        });
      }

      setChartData(chartRange);

      // ✅ Save last 5 logs for recent activity
      setLogs(allLogs.slice(-5).reverse());
    };

    fetchData();
  }, [filter]);

  // Function to get chart label based on filter
  const getChartLabel = () => {
    switch (filter) {
      case "today": return "Time";
      case "year": return "Month";
      case "month": return "Date";
      default: return "Day";
    }
  };

  // Function to get data key based on filter
  const getDataKey = () => {
    switch (filter) {
      case "today": return "time";
      case "year": return "month";
      case "month": return "date";
      default: return "day";
    }
  };

  // Function to format tooltip label for month view
  const formatTooltipLabel = (label) => {
    if (filter === "month") {
      return `Date: ${label}`;
    }
    return `${getChartLabel()}: ${label}`;
  };

  // Function to get icon based on filter
  const getFilterIcon = (filterType) => {
    const icons = {
      today: "📅",
      week: "📊", 
      month: "🗓️",
      year: "📈"
    };
    return icons[filterType] || "📊";
  };

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
            <span className="filter-icon">{getFilterIcon("today")}</span>
            Today
          </button>
          <button
            className={filter === "week" ? "active" : ""}
            onClick={() => setFilter("week")}
          >
            <span className="filter-icon">{getFilterIcon("week")}</span>
            This Week
          </button>
          <button
            className={filter === "month" ? "active" : ""}
            onClick={() => setFilter("month")}
          >
            <span className="filter-icon">{getFilterIcon("month")}</span>
            This Month
          </button>
          <button
            className={filter === "year" ? "active" : ""}
            onClick={() => setFilter("year")}
          >
            <span className="filter-icon">{getFilterIcon("year")}</span>
            This Year
          </button>
        </div>
      </div>

      {/* ✅ Chart */}
      <div className="chart-section">
        <h2>
          <span className="chart-icon">📊</span>
          Milk Trends - {filter.charAt(0).toUpperCase() + filter.slice(1)}
        </h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={getDataKey()} 
                label={{ value: getChartLabel(), position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: 'Liters', angle: -90, position: 'insideLeft' }} />
              <Tooltip 
                formatter={(value) => [`${value} L`, 'Quantity']}
                labelFormatter={formatTooltipLabel}
              />
              <Line
                type="monotone"
                dataKey="liters"
                stroke="#0d9488"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6, stroke: '#0d9488', strokeWidth: 2 }}
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
          <p>KES {pendingPayments.toLocaleString()}</p>
        </div>
      </div>

      {/* ✅ Recent Logs */}
      <div className="recent-logs">
        <h2>📝 Recent Milk Logs</h2>
        {logs.length === 0 ? (
          <div className="no-data">
            <p>No milk logs found</p>
          </div>
        ) : (
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
                  <td>{log.farmerName || log.farmerId || "Unknown"}</td>
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
                  <td>{log.date?.toDate().toLocaleString() || "Invalid Date"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;