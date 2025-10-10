// src/pages/Feeds.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  onSnapshot,
  where 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import './Feeds.css';

const Feeds = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [feeds, setFeeds] = useState([]);
  const [feedRequests, setFeedRequests] = useState([]);
  const [farmers, setFarmers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [message, setMessage] = useState({ show: false, text: '', type: '' });

  // Use refs to track unsubscribe functions
  const unsubscribeRefs = useRef({
    feeds: null,
    requests: null
  });

  const [feedForm, setFeedForm] = useState({
    name: '',
    type: '',
    quantity: '',
    unit: 'kg',
    pricePerUnit: '',
    minStockLevel: '',
    description: ''
  });

  const feedTypes = ['Dairy Meal', 'Calf Feed', 'Mineral Supplement', 'Protein Concentrate'];
  const units = ['kg', 'bags', 'liters'];

  // Fetch farmers data
  const fetchFarmers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const farmersData = {};
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.role === 'farmer' && userData.name) {
          farmersData[doc.id] = {
            name: userData.name,
            phone: userData.phone || 'N/A',
            location: userData.location || 'N/A'
          };
        }
      });
      
      setFarmers(farmersData);
    } catch (error) {
      console.error('Error fetching farmers:', error);
      showMessage('Error loading farmer data', 'error');
    }
  };

  // Fetch feeds from Firestore
  const setupFeedsListener = () => {
    const q = query(collection(db, 'feeds'), orderBy('name'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const feedsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFeeds(feedsData);
      }, 
      (error) => {
        console.error('Error fetching feeds:', error);
        showMessage('Error fetching feeds data', 'error');
      }
    );

    unsubscribeRefs.current.feeds = unsubscribe;
    return unsubscribe;
  };

  // Fetch feed requests from Firestore
  const setupRequestsListener = () => {
    const q = query(collection(db, 'feed_requests'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFeedRequests(requestsData);
        setLoading(false);
      }, 
      (error) => {
        console.error('Error fetching feed requests:', error);
        showMessage('Error fetching feed requests', 'error');
        setLoading(false);
      }
    );

    unsubscribeRefs.current.requests = unsubscribe;
    return unsubscribe;
  };

  useEffect(() => {
    const initializeData = async () => {
      await fetchFarmers();
      setupFeedsListener();
      setupRequestsListener();
    };

    initializeData();

    // Cleanup function
    return () => {
      Object.values(unsubscribeRefs.current).forEach(unsubscribe => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      unsubscribeRefs.current = { feeds: null, requests: null };
    };
  }, []);

  // Get farmer info by ID
  const getFarmerInfo = (farmerId) => {
    return farmers[farmerId] || { name: `Farmer (${farmerId})`, phone: 'N/A', location: 'N/A' };
  };

  // Helper function to find matching feed in inventory
  const findMatchingFeed = (request) => {
    return feeds.find(feed => {
      // Try to match by feed type name first
      if (request.feedTypeName && feed.name?.toLowerCase().includes(request.feedTypeName.toLowerCase())) {
        return true;
      }
      // Then try by feed type
      if (request.feedType && feed.type?.toLowerCase().includes(request.feedType.toLowerCase())) {
        return true;
      }
      // Finally try by name
      if (feed.name?.toLowerCase().includes(request.feedType?.toLowerCase())) {
        return true;
      }
      return false;
    });
  };

  // Calculate total cost for a feed request
  const calculateFeedCost = (request) => {
    const feed = findMatchingFeed(request);
    
    if (feed && feed.pricePerUnit) {
      return (request.quantity || 0) * feed.pricePerUnit;
    }
    
    const defaultPrices = {
      'dairy_meal': 45, 'Dairy Meal': 45,
      'calf_feed': 60, 'Calf Feed': 60,
      'mineral_supplement': 80, 'Mineral Supplement': 80,
      'protein_concentrate': 70, 'Protein Concentrate': 70
    };
    
    const pricePerKg = defaultPrices[request.feedType] || defaultPrices[request.feedTypeName] || 50;
    return (request.quantity || 0) * pricePerKg;
  };

  // Calculate totals
  const calculateTotalPendingDeductions = () => {
    const pendingRequests = feedRequests.filter(request => 
      request.status === 'approved' || request.status === 'pending'
    );
    return pendingRequests.reduce((total, request) => total + calculateFeedCost(request), 0);
  };

  const calculateTotalDeliveredDeductions = () => {
    const deliveredRequests = feedRequests.filter(request => 
      request.status === 'delivered'
    );
    return deliveredRequests.reduce((total, request) => total + calculateFeedCost(request), 0);
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ show: true, text, type });
    setTimeout(() => setMessage({ show: false, text: '', type: '' }), 3000);
  };

  const openDialog = (feed = null) => {
    if (feed) {
      setSelectedFeed(feed);
      setFeedForm({
        name: feed.name || '',
        type: feed.type || '',
        quantity: feed.quantity || '',
        unit: feed.unit || 'kg',
        pricePerUnit: feed.pricePerUnit || '',
        minStockLevel: feed.minStockLevel || '',
        description: feed.description || ''
      });
    } else {
      setSelectedFeed(null);
      setFeedForm({
        name: '', type: '', quantity: '', unit: 'kg', pricePerUnit: '', minStockLevel: '', description: ''
      });
    }
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setSelectedFeed(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFeedForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!feedForm.name || !feedForm.type || !feedForm.quantity) {
      showMessage('Please fill in all required fields', 'error');
      return;
    }

    try {
      const feedData = {
        ...feedForm,
        quantity: parseFloat(feedForm.quantity) || 0,
        pricePerUnit: parseFloat(feedForm.pricePerUnit) || 0,
        minStockLevel: parseFloat(feedForm.minStockLevel) || 0,
        reservedQuantity: 0, // Initialize reserved quantity
        updatedAt: new Date()
      };

      if (selectedFeed) {
        await updateDoc(doc(db, 'feeds', selectedFeed.id), feedData);
        showMessage('Feed updated successfully');
      } else {
        await addDoc(collection(db, 'feeds'), { 
          ...feedData, 
          createdAt: new Date() 
        });
        showMessage('Feed added successfully');
      }
      closeDialog();
    } catch (error) {
      console.error('Error saving feed:', error);
      showMessage('Error saving feed data', 'error');
    }
  };

  const deleteFeed = async () => {
    if (!selectedFeed) return;
    
    try {
      await deleteDoc(doc(db, 'feeds', selectedFeed.id));
      showMessage('Feed deleted successfully');
      setShowDeleteDialog(false);
      setSelectedFeed(null);
    } catch (error) {
      console.error('Error deleting feed:', error);
      showMessage('Error deleting feed', 'error');
    }
  };

  // Update inventory when feed is delivered
  const updateInventoryOnDelivery = async (request) => {
    try {
      const matchingFeed = findMatchingFeed(request);
      
      if (matchingFeed) {
        const currentQuantity = matchingFeed.quantity || 0;
        const requestedQuantity = request.quantity || 0;
        const currentReserved = matchingFeed.reservedQuantity || 0;
        
        // Check if there's enough stock
        if (currentQuantity < requestedQuantity) {
          throw new Error(`Insufficient stock! Only ${currentQuantity} ${matchingFeed.unit} available, but ${requestedQuantity} ${matchingFeed.unit} requested.`);
        }
        
        // Calculate new quantities
        const newQuantity = currentQuantity - requestedQuantity;
        const newReserved = Math.max(0, currentReserved - requestedQuantity);
        
        // Update the feed inventory
        await updateDoc(doc(db, 'feeds', matchingFeed.id), {
          quantity: newQuantity,
          reservedQuantity: newReserved,
          lastUpdated: new Date(),
          lastDelivery: {
            requestId: request.id,
            farmerId: request.farmerId,
            quantity: requestedQuantity,
            date: new Date()
          }
        });
        
        console.log(`Inventory updated: ${matchingFeed.name} reduced by ${requestedQuantity} ${matchingFeed.unit}`);
      } else {
        console.warn(`No matching feed found in inventory for: ${request.feedTypeName || request.feedType}`);
      }
    } catch (error) {
      console.error('Error updating inventory on delivery:', error);
      throw error;
    }
  };

  // Restore inventory when delivery is reverted
  const restoreInventoryOnRevert = async (request) => {
    try {
      const matchingFeed = findMatchingFeed(request);
      
      if (matchingFeed) {
        const currentQuantity = matchingFeed.quantity || 0;
        const requestedQuantity = request.quantity || 0;
        const newQuantity = currentQuantity + requestedQuantity;
        
        await updateDoc(doc(db, 'feeds', matchingFeed.id), {
          quantity: newQuantity,
          lastUpdated: new Date(),
          lastRestoration: {
            requestId: request.id,
            farmerId: request.farmerId,
            quantity: requestedQuantity,
            date: new Date()
          }
        });
        
        console.log(`Inventory restored: ${matchingFeed.name} increased by ${requestedQuantity} ${matchingFeed.unit}`);
      }
    } catch (error) {
      console.error('Error restoring inventory:', error);
      throw error;
    }
  };

  // Reserve feed when request is approved
  const reserveFeedInInventory = async (request) => {
    try {
      const matchingFeed = findMatchingFeed(request);
      
      if (matchingFeed) {
        const currentQuantity = matchingFeed.quantity || 0;
        const requestedQuantity = request.quantity || 0;
        const currentReserved = matchingFeed.reservedQuantity || 0;
        
        // Check if there's enough stock to reserve
        const availableQuantity = currentQuantity - currentReserved;
        if (availableQuantity < requestedQuantity) {
          throw new Error(`Cannot approve request: Insufficient available stock! Only ${availableQuantity} ${matchingFeed.unit} available, but ${requestedQuantity} ${matchingFeed.unit} requested.`);
        }
        
        // Update the feed to show reserved quantity
        const newReserved = currentReserved + requestedQuantity;
        
        await updateDoc(doc(db, 'feeds', matchingFeed.id), {
          reservedQuantity: newReserved,
          lastUpdated: new Date()
        });
        
        console.log(`Feed reserved: ${requestedQuantity} ${matchingFeed.unit} of ${matchingFeed.name}`);
      }
    } catch (error) {
      console.error('Error reserving feed:', error);
      throw error;
    }
  };

  // Release reserved feed when request is rejected
  const releaseReservedFeed = async (request) => {
    try {
      const matchingFeed = findMatchingFeed(request);
      
      if (matchingFeed) {
        const currentReserved = matchingFeed.reservedQuantity || 0;
        const requestedQuantity = request.quantity || 0;
        const newReserved = Math.max(0, currentReserved - requestedQuantity);
        
        await updateDoc(doc(db, 'feeds', matchingFeed.id), {
          reservedQuantity: newReserved,
          lastUpdated: new Date()
        });
        
        console.log(`Reservation released: ${requestedQuantity} ${matchingFeed.unit} of ${matchingFeed.name}`);
      }
    } catch (error) {
      console.error('Error releasing reserved feed:', error);
      throw error;
    }
  };

  // Create automatic deduction record
  const createAutomaticDeduction = async (request, cost) => {
    try {
      const existingDeductionQuery = query(
        collection(db, 'payments'),
        where('feedRequestId', '==', request.id),
        where('type', '==', 'feed_deduction')
      );
      
      const existingSnapshot = await getDocs(existingDeductionQuery);
      
      if (existingSnapshot.empty) {
        await addDoc(collection(db, 'payments'), {
          farmerId: request.farmerId,
          type: 'feed_deduction',
          amount: -Math.abs(cost),
          description: `Feed: ${request.feedTypeName || request.feedType} - ${request.quantity}kg`,
          feedRequestId: request.id,
          status: 'completed',
          deductionDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`Deduction of KES ${cost} created for farmer ${request.farmerId}`);
      }
    } catch (error) {
      console.error('Error creating automatic deduction:', error);
      throw error;
    }
  };

  // Remove deduction when request is reverted
  const removeDeduction = async (feedRequestId) => {
    try {
      const deductionQuery = query(
        collection(db, 'payments'),
        where('feedRequestId', '==', feedRequestId),
        where('type', '==', 'feed_deduction')
      );
      
      const snapshot = await getDocs(deductionQuery);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`Deductions removed for request ${feedRequestId}`);
    } catch (error) {
      console.error('Error removing deduction:', error);
      throw error;
    }
  };

  const updateRequestStatus = async (requestId, newStatus) => {
    try {
      const requestRef = doc(db, 'feed_requests', requestId);
      const request = feedRequests.find(r => r.id === requestId);
      
      if (request) {
        const feedCost = calculateFeedCost(request);
        
        await updateDoc(requestRef, {
          status: newStatus,
          cost: feedCost,
          updatedAt: new Date()
        });

        // Handle inventory updates based on status change
        if (newStatus === 'delivered') {
          await updateInventoryOnDelivery(request);
          await createAutomaticDeduction(request, feedCost);
        }
        
        // Handle inventory restoration when reverting from delivered
        if (newStatus === 'pending' && request.status === 'delivered') {
          await restoreInventoryOnRevert(request);
          await removeDeduction(request.id);
        }

        // Handle approval - reserve the feed
        if (newStatus === 'approved') {
          await reserveFeedInInventory(request);
        }

        // Handle rejection - release reserved feed
        if (newStatus === 'rejected' && request.status === 'approved') {
          await releaseReservedFeed(request);
        }
      }

      showMessage(`Request ${newStatus} successfully`);
    } catch (error) {
      console.error('Error updating request:', error);
      showMessage(`Error: ${error.message}`, 'error');
    }
  };

  // Enhanced stock status calculation to include reserved quantities
  const getStockStatus = (feed) => {
    const quantity = feed.quantity || 0;
    const reserved = feed.reservedQuantity || 0;
    const minStock = feed.minStockLevel || 0;
    const available = quantity - reserved;
    
    if (available <= 0) return { 
      status: 'Out of Stock', 
      class: 'out-of-stock',
      available: available,
      reserved: reserved
    };
    if (available <= minStock) return { 
      status: 'Low Stock', 
      class: 'low-stock',
      available: available,
      reserved: reserved
    };
    return { 
      status: 'In Stock', 
      class: 'in-stock',
      available: available,
      reserved: reserved
    };
  };

  const getRequestStatus = (request) => {
    const status = request.status || 'pending';
    const statusClasses = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      delivered: 'status-delivered'
    };
    return {
      status: status.charAt(0).toUpperCase() + status.slice(1),
      class: statusClasses[status] || 'status-pending'
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount || 0);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading feed data...</div>
      </div>
    );
  }

  const totalPendingDeductions = calculateTotalPendingDeductions();
  const totalDeliveredDeductions = calculateTotalDeliveredDeductions();

  return (
    <div className="feeds-container">
      {/* Header */}
      <div className="feeds-header">
        <h1>🌾 Feed Management</h1>
        {activeTab === 0 && (
          <button className="btn btn-primary" onClick={() => openDialog()}>
            + Add New Feed
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 0 ? 'active' : ''}`}
          onClick={() => setActiveTab(0)}
        >
          📦 Feed Inventory ({feeds.length})
        </button>
        <button 
          className={`tab ${activeTab === 1 ? 'active' : ''}`}
          onClick={() => setActiveTab(1)}
        >
          📋 Feed Requests ({feedRequests.length})
        </button>
      </div>

      {/* Feed Inventory Tab */}
      {activeTab === 0 && (
        <div className="tab-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Feed Types</h3>
              <div className="stat-number">{feeds.length}</div>
            </div>
            <div className="stat-card">
              <h3>In Stock</h3>
              <div className="stat-number in-stock">
                {feeds.filter(f => {
                  const status = getStockStatus(f);
                  return status.available > (f.minStockLevel || 0);
                }).length}
              </div>
            </div>
            <div className="stat-card">
              <h3>Low Stock</h3>
              <div className="stat-number low-stock">
                {feeds.filter(f => {
                  const status = getStockStatus(f);
                  return status.available > 0 && status.available <= (f.minStockLevel || 0);
                }).length}
              </div>
            </div>
            <div className="stat-card">
              <h3>Out of Stock</h3>
              <div className="stat-number out-of-stock">
                {feeds.filter(f => {
                  const status = getStockStatus(f);
                  return status.available <= 0;
                }).length}
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="feeds-table">
              <thead>
                <tr>
                  <th>Feed Name</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Price/Unit</th>
                  <th>Stock Status</th>
                  <th>Min Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map(feed => {
                  const stockStatus = getStockStatus(feed);
                  return (
                    <tr key={feed.id}>
                      <td>
                        <strong>{feed.name}</strong>
                        {feed.description && <div className="feed-description">{feed.description}</div>}
                      </td>
                      <td>{feed.type}</td>
                      <td>
                        <div className="quantity-display">
                          <div className="total-quantity">{feed.quantity} {feed.unit}</div>
                          {stockStatus.reserved > 0 && (
                            <div className="reserved-quantity">
                              (Reserved: {stockStatus.reserved} {feed.unit})
                            </div>
                          )}
                          <div className={`available-quantity ${stockStatus.available <= 0 ? 'out-of-stock-warning' : stockStatus.available <= (feed.minStockLevel || 0) ? 'low-stock-warning' : ''}`}>
                            Available: {stockStatus.available} {feed.unit}
                          </div>
                        </div>
                      </td>
                      <td>{formatCurrency(feed.pricePerUnit)}</td>
                      <td>
                        <span className={`status-badge ${stockStatus.class} ${stockStatus.reserved > 0 ? 'with-reserved' : ''}`}>
                          {stockStatus.status}
                          {stockStatus.reserved > 0 && ` (${stockStatus.reserved} reserved)`}
                        </span>
                      </td>
                      <td>{feed.minStockLevel} {feed.unit}</td>
                      <td>
                        <button 
                          className="btn btn-edit"
                          onClick={() => openDialog(feed)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-delete"
                          onClick={() => {
                            setSelectedFeed(feed);
                            setShowDeleteDialog(true);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {feeds.length === 0 && (
              <div className="empty-state">
                <p>No feeds found. Add your first feed to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feed Requests Tab */}
      {activeTab === 1 && (
        <div className="tab-content">
          {/* Deduction Summary */}
          <div className="deduction-summary">
            <div className="deduction-card pending-deductions">
              <h3>⏳ Pending Deductions</h3>
              <div className="deduction-amount">
                {formatCurrency(totalPendingDeductions)}
              </div>
              <p>Amount to be deducted from pending/approved requests</p>
            </div>
            <div className="deduction-card delivered-deductions">
              <h3>✅ Already Deducted</h3>
              <div className="deduction-amount">
                {formatCurrency(totalDeliveredDeductions)}
              </div>
              <p>Amount already deducted from delivered requests</p>
            </div>
            <div className="deduction-card total-deductions">
              <h3>💰 Total Feed Costs</h3>
              <div className="deduction-amount">
                {formatCurrency(totalPendingDeductions + totalDeliveredDeductions)}
              </div>
              <p>Total feed costs across all requests</p>
            </div>
          </div>

          <div className="table-container">
            <table className="feeds-table">
              <thead>
                <tr>
                  <th>Farmer Details</th>
                  <th>Feed Type</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total Cost</th>
                  <th>Request Date</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feedRequests.map(request => {
                  const requestStatus = getRequestStatus(request);
                  const farmerInfo = getFarmerInfo(request.farmerId);
                  const feedCost = calculateFeedCost(request);
                  
                  const feed = findMatchingFeed(request);
                  const unitPrice = feed?.pricePerUnit || 
                    (request.feedType === 'dairy_meal' ? 45 : 
                     request.feedType === 'calf_feed' ? 60 : 
                     request.feedType === 'mineral_supplement' ? 80 : 50);

                  return (
                    <tr key={request.id}>
                      <td>
                        <div className="farmer-details">
                          <strong>{farmerInfo.name}</strong>
                          <div className="farmer-contact">
                            <span>📞 {farmerInfo.phone}</span>
                            <span>📍 {farmerInfo.location}</span>
                          </div>
                          <div className="farmer-id">ID: {request.farmerId}</div>
                        </div>
                      </td>
                      <td>{request.feedTypeName || request.feedType}</td>
                      <td>{request.quantity} kg</td>
                      <td>{formatCurrency(unitPrice)}</td>
                      <td>
                        <strong className={`cost-amount ${request.status === 'delivered' ? 'deducted' : 'pending'}`}>
                          {formatCurrency(feedCost)}
                        </strong>
                        {request.status === 'delivered' && (
                          <div className="deduction-badge">✅ Deducted</div>
                        )}
                        {request.status === 'approved' && (
                          <div className="pending-badge">⏳ To Deduct</div>
                        )}
                      </td>
                      <td>
                        {formatDate(request.createdAt)}
                      </td>
                      <td>
                        <span className={`status-badge ${requestStatus.class}`}>
                          {requestStatus.status}
                        </span>
                      </td>
                      <td>
                        {request.notes ? (
                          <div className="request-notes">
                            {request.notes}
                          </div>
                        ) : (
                          <span className="no-notes">No notes</span>
                        )}
                      </td>
                      <td>
                        {request.status === 'pending' && (
                          <div className="action-buttons">
                            <button 
                              className="btn btn-approve"
                              onClick={() => updateRequestStatus(request.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button 
                              className="btn btn-reject"
                              onClick={() => updateRequestStatus(request.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {request.status === 'approved' && (
                          <button 
                            className="btn btn-deliver"
                            onClick={() => updateRequestStatus(request.id, 'delivered')}
                          >
                            Mark Delivered
                          </button>
                        )}
                        {(request.status === 'rejected' || request.status === 'delivered') && (
                          <button 
                            className="btn btn-reset"
                            onClick={() => updateRequestStatus(request.id, 'pending')}
                          >
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {feedRequests.length === 0 && (
              <div className="empty-state">
                <p>No feed requests found. Farmers' requests will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Feed Dialog */}
      {showDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{selectedFeed ? 'Edit Feed' : 'Add New Feed'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Feed Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={feedForm.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Feed Type *</label>
                  <select
                    name="type"
                    value={feedForm.type}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Type</option>
                    {feedTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    name="quantity"
                    value={feedForm.quantity}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select
                    name="unit"
                    value={feedForm.unit}
                    onChange={handleInputChange}
                  >
                    {units.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Price Per Unit (KES) *</label>
                  <input
                    type="number"
                    name="pricePerUnit"
                    value={feedForm.pricePerUnit}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Min Stock Level</label>
                  <input
                    type="number"
                    name="minStockLevel"
                    value={feedForm.minStockLevel}
                    onChange={handleInputChange}
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  name="description"
                  value={feedForm.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Optional feed description..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {selectedFeed ? 'Update Feed' : 'Add Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirm Delete</h2>
            <p>Are you sure you want to delete "{selectedFeed?.name}"? This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </button>
              <button className="btn btn-delete" onClick={deleteFeed}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Alert */}
      {message.show && (
        <div className={`message-alert ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default Feeds;