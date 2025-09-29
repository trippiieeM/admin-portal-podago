import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../services/firebase"; // Make sure auth is imported
import { getAuth, deleteUser, updateEmail, updateProfile } from "firebase/auth";
import "./Farmers.css";

function Farmers() {
  const [farmers, setFarmers] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [editingCollector, setEditingCollector] = useState(null);
  const [formData, setFormData] = useState({ name: "", pin: "", email: "" });
  const [collectorFormData, setCollectorFormData] = useState({ name: "", pin: "", email: "" });

  // 🔹 Fetch all farmers from Firestore
  const fetchFarmers = async () => {
    const q = query(collection(db, "users"), where("role", "==", "farmer"));
    const snapshot = await getDocs(q);
    setFarmers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // 🔹 Fetch all collectors from Firebase Authentication
  const fetchCollectors = async () => {
    try {
      const auth = getAuth();
      // Note: This approach requires you to have custom claims or another way to identify collectors
      // Since we can't directly query users by role in Firebase Auth, we'll use Firestore as a bridge
      
      // Option 1: If you store user data in Firestore with role information
      const q = query(collection(db, "users"), where("role", "==", "collector"));
      const snapshot = await getDocs(q);
      const collectorsData = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data(),
        // If you need auth-specific data, you might need to get it separately
        uid: doc.data().uid // assuming you store auth uid in Firestore
      }));
      setCollectors(collectorsData);
      
    } catch (error) {
      console.error("Error fetching collectors:", error);
    }
  };

  // 🔹 Alternative: If you want to get ALL users from Auth (requires Admin SDK on backend)
  // This would require a Cloud Function since client SDK doesn't allow listing users
  const fetchAllCollectorsFromAuth = async () => {
    try {
      // This is a placeholder - you would need to create a Cloud Function
      // that returns users with collector role
      const response = await fetch('/api/getCollectors'); // Your Cloud Function endpoint
      const collectors = await response.json();
      setCollectors(collectors);
    } catch (error) {
      console.error("Error fetching collectors from Auth:", error);
    }
  };

  useEffect(() => {
    fetchFarmers();
    fetchCollectors();
  }, []);

  // 🔹 Delete farmer
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this farmer?")) {
      try {
        await deleteDoc(doc(db, "users", id));
        fetchFarmers();
      } catch (error) {
        console.error("Error deleting farmer:", error);
        alert("Error deleting farmer: " + error.message);
      }
    }
  };

  // 🔹 Delete collector (both from Firestore and optionally from Auth)
  const handleDeleteCollector = async (collector) => {
    if (window.confirm("Are you sure you want to delete this collector?")) {
      try {
        // Delete from Firestore
        await deleteDoc(doc(db, "users", collector.id));
        
        // If you want to also delete from Auth, you would need:
        // 1. Cloud Function to delete auth user (client can't delete other users)
        // 2. Or the user must be currently signed in (which they won't be)
        
        fetchCollectors();
      } catch (error) {
        console.error("Error deleting collector:", error);
        alert("Error deleting collector: " + error.message);
      }
    }
  };

  // 🔹 Open edit farmer modal
  const handleEdit = (farmer) => {
    setEditingFarmer(farmer);
    setFormData({
      name: farmer.name || "",
      pin: farmer.pin || "",
      email: farmer.email || "",
    });
  };

  // 🔹 Open edit collector modal
  const handleEditCollector = (collector) => {
    setEditingCollector(collector);
    setCollectorFormData({
      name: collector.name || "",
      pin: collector.pin || "",
      email: collector.email || "",
    });
  };

  // 🔹 Handle input changes for farmer
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Handle input changes for collector
  const handleCollectorChange = (e) => {
    setCollectorFormData({ ...collectorFormData, [e.target.name]: e.target.value });
  };

  // 🔹 Save updated farmer
  const handleSave = async () => {
    if (!editingFarmer) return;
    try {
      const ref = doc(db, "users", editingFarmer.id);
      await updateDoc(ref, {
        name: formData.name,
        pin: formData.pin,
        email: formData.email,
      });
      setEditingFarmer(null);
      fetchFarmers();
    } catch (error) {
      console.error("Error updating farmer:", error);
      alert("Error updating farmer: " + error.message);
    }
  };

  // 🔹 Save updated collector
  const handleSaveCollector = async () => {
    if (!editingCollector) return;
    try {
      const ref = doc(db, "users", editingCollector.id);
      await updateDoc(ref, {
        name: collectorFormData.name,
        pin: collectorFormData.pin,
        email: collectorFormData.email,
      });
      
      // If you want to update Auth email as well, you would need:
      // - The user to be currently signed in (for updateEmail)
      // - Or a Cloud Function to update auth user
      
      setEditingCollector(null);
      fetchCollectors();
    } catch (error) {
      console.error("Error updating collector:", error);
      alert("Error updating collector: " + error.message);
    }
  };

  // 🔹 Mask PIN for display
  const maskPin = (pin) => {
    if (!pin) return "N/A";
    return "•".repeat(Math.min(pin.length, 8));
  };

  return (
    <div className="farmers-page">
      {/* 🔹 Farmers Section */}
      <div className="header">
        <h1>👨‍🌾 Farmers</h1>
        <p>Manage all registered farmers in the system</p>
      </div>

      <div className="table-container">
        <table className="farmers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>PIN</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {farmers.map((farmer) => (
              <tr key={farmer.id}>
                <td>{farmer.name || "Unnamed"}</td>
                <td>{maskPin(farmer.pin)}</td>
                <td>{farmer.email || "N/A"}</td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(farmer)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(farmer.id)}
                  >
                    ❌ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔹 Collectors Section */}
      <div className="header" style={{ marginTop: "40px" }}>
        <h1>🚛 Collectors</h1>
        <p>Manage all registered milk collectors in the system</p>
      </div>

      <div className="table-container">
        <table className="farmers-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>PIN</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {collectors.map((collector) => (
              <tr key={collector.id}>
                <td>{collector.name || "Unnamed"}</td>
                <td>{maskPin(collector.pin)}</td>
                <td>{collector.email || "N/A"}</td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => handleEditCollector(collector)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteCollector(collector)}
                  >
                    ❌ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔹 Edit Farmer Modal */}
      {editingFarmer && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Farmer</h2>
            <label>
              Name:
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter farmer name"
              />
            </label>
            <label>
              PIN:
              <input
                type="text"
                name="pin"
                value={formData.pin}
                onChange={handleChange}
                placeholder="Enter PIN"
              />
            </label>
            <label>
              Email:
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email"
              />
            </label>

            <div className="modal-actions">
              <button className="save-btn" onClick={handleSave}>
                💾 Save
              </button>
              <button
                className="cancel-btn"
                onClick={() => setEditingFarmer(null)}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 Edit Collector Modal */}
      {editingCollector && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Collector</h2>
            <label>
              Name:
              <input
                type="text"
                name="name"
                value={collectorFormData.name}
                onChange={handleCollectorChange}
                placeholder="Enter collector name"
              />
            </label>
            <label>
              PIN:
              <input
                type="text"
                name="pin"
                value={collectorFormData.pin}
                onChange={handleCollectorChange}
                placeholder="Enter PIN"
              />
            </label>
            <label>
              Email:
              <input
                type="email"
                name="email"
                value={collectorFormData.email}
                onChange={handleCollectorChange}
                placeholder="Enter email"
              />
            </label>

            <div className="modal-actions">
              <button className="save-btn" onClick={handleSaveCollector}>
                💾 Save
              </button>
              <button
                className="cancel-btn"
                onClick={() => setEditingCollector(null)}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Farmers;