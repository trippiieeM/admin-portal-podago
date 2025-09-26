// src/pages/Analytics.js
import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import "./Analytics.css";

function Analytics() {
  const [tips, setTips] = useState([]);
  const [newTip, setNewTip] = useState("");
  const [role, setRole] = useState("farmer");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, approved, pending

  useEffect(() => {
    const fetchTips = async () => {
      try {
        const snapshot = await getDocs(collection(db, "tips"));
        const tipsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setTips(tipsData.sort((a, b) => new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate())));
      } catch (error) {
        console.error("Error fetching tips:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTips();
  }, []);

  const addTip = async () => {
    if (!newTip.trim()) {
      alert("Please enter a tip!");
      return;
    }
    
    try {
      await addDoc(collection(db, "tips"), {
        content: newTip,
        role,
        createdAt: serverTimestamp(),
        approved: false,
      });
      setNewTip("");
      alert("Tip added, pending approval!");
      // Refresh the list
      const snapshot = await getDocs(collection(db, "tips"));
      setTips(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error adding tip:", error);
      alert("Error adding tip. Please try again.");
    }
  };

  const approveTip = async (id) => {
    try {
      await updateDoc(doc(db, "tips", id), { approved: true });
      setTips(tips.map(t => t.id === id ? { ...t, approved: true } : t));
    } catch (error) {
      console.error("Error approving tip:", error);
    }
  };

  const deleteTip = async (id) => {
    if (window.confirm("Are you sure you want to delete this tip?")) {
      try {
        await deleteDoc(doc(db, "tips", id));
        setTips(tips.filter(t => t.id !== id));
      } catch (error) {
        console.error("Error deleting tip:", error);
      }
    }
  };

  const filteredTips = tips.filter(tip => {
    if (filter === "approved") return tip.approved;
    if (filter === "pending") return !tip.approved;
    return true;
  });

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading tips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1 className="analytics-title">Analytics & Tips</h1>
      </div>

      {/* Add Tip Form */}
      <div className="add-tip-form">
        <h2 className="form-title">Add New Tip</h2>
        <textarea
          className="tip-textarea"
          placeholder="Enter helpful tip for farmers or collectors..."
          value={newTip}
          onChange={(e) => setNewTip(e.target.value)}
        />
        <select 
          className="role-select"
          value={role} 
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="farmer">For Farmers</option>
          <option value="collector">For Collectors</option>
        </select>
        <div className="form-actions">
          <button className="add-tip-btn" onClick={addTip}>
            Add Tip
          </button>
          <span style={{color: '#718096', fontSize: '0.9rem'}}>
            Tips will be reviewed before publishing
          </span>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="filter-buttons">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Tips ({tips.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
          onClick={() => setFilter('approved')}
        >
          Approved ({tips.filter(t => t.approved).length})
        </button>
        <button 
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({tips.filter(t => !t.approved).length})
        </button>
      </div>

      {/* Tips List */}
      <div className="tips-section">
        {filteredTips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💡</div>
            <p className="empty-state-text">No tips found</p>
            <p className="empty-state-subtext">
              {filter === 'all' 
                ? "Be the first to add a helpful tip!" 
                : `No ${filter} tips at the moment.`}
            </p>
          </div>
        ) : (
          <table className="tips-table">
            <thead>
              <tr>
                <th>Tip Content</th>
                <th>Target Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTips.map((t) => (
                <tr key={t.id}>
                  <td className="tip-content">{t.content}</td>
                  <td>
                    <span className={`role-badge role-${t.role}`}>
                      {t.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${t.approved ? 'status-approved' : 'status-pending'}`}>
                      {t.approved ? "✅ Approved" : "⏳ Pending"}
                    </span>
                  </td>
                  <td className="actions-cell">
                    {!t.approved && (
                      <button 
                        className="action-btn approve-btn"
                        onClick={() => approveTip(t.id)}
                      >
                        Approve
                      </button>
                    )}
                    <button 
                      className="action-btn delete-btn"
                      onClick={() => deleteTip(t.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Analytics;