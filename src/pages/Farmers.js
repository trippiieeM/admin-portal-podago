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
import { db } from "../services/firebase";
import "./Farmers.css";

function Farmers() {
  const [farmers, setFarmers] = useState([]);
  const [editingFarmer, setEditingFarmer] = useState(null); // store farmer being edited
  const [formData, setFormData] = useState({ name: "", pin: "", email: "" });

  // 🔹 Fetch all farmers
  const fetchFarmers = async () => {
    const q = query(collection(db, "users"), where("role", "==", "farmer"));
    const snapshot = await getDocs(q);
    setFarmers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchFarmers();
  }, []);

  // 🔹 Delete farmer
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this farmer?")) {
      await deleteDoc(doc(db, "users", id));
      fetchFarmers(); // refresh list
    }
  };

  // 🔹 Open edit modal
  const handleEdit = (farmer) => {
    setEditingFarmer(farmer);
    setFormData({
      name: farmer.name || "",
      pin: farmer.pin || "",
      email: farmer.email || "",
    });
  };

  // 🔹 Handle input changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Save updated farmer
  const handleSave = async () => {
    if (!editingFarmer) return;
    const ref = doc(db, "users", editingFarmer.id);
    await updateDoc(ref, {
      name: formData.name,
      pin: formData.pin,
      email: formData.email,
    });
    setEditingFarmer(null); // close modal
    fetchFarmers();
  };

  return (
    <div className="farmers-page">
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
                <td>{farmer.pin || "N/A"}</td>
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

      {/* 🔹 Edit Modal */}
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
              />
            </label>
            <label>
              PIN:
              <input
                type="text"
                name="pin"
                value={formData.pin}
                onChange={handleChange}
              />
            </label>
            <label>
              Email:
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
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
    </div>
  );
}

export default Farmers;
