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
  onSnapshot,
  addDoc,
  writeBatch,
  setDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../services/firebase";
import { format } from "date-fns";
import "./Payments.css";

function Payments() {
  const [logs, setLogs] = useState([]);
  const [feedDeductions, setFeedDeductions] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [paymentType, setPaymentType] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pricePerLiter, setPricePerLiter] = useState(45);
  const [showPriceInput, setShowPriceInput] = useState(false);

  // 🔹 Load milk price from system configuration
  useEffect(() => {
    const loadMilkPrice = async () => {
      try {
        const priceDoc = await getDoc(doc(db, "system_config", "milk_price"));
        if (priceDoc.exists()) {
          const data = priceDoc.data();
          setPricePerLiter(data.pricePerLiter || 45);
          console.log(`✅ Loaded milk price from config: KES ${data.pricePerLiter}`);
        }
      } catch (error) {
        console.error("Error loading milk price:", error);
      }
    };
    loadMilkPrice();
  }, []);

  // 🔹 Save milk price to system configuration
  const saveMilkPriceToConfig = async (price) => {
    try {
      await setDoc(doc(db, "system_config", "milk_price"), {
        pricePerLiter: price,
        updatedAt: new Date(),
        updatedBy: "admin"
      });
      console.log(`✅ Milk price saved to system config: KES ${price}`);
    } catch (error) {
      console.error("❌ Error saving milk price:", error);
      throw error;
    }
  };

  // 🔹 Update milk price and save to config
  const updateMilkPrice = async (newPrice) => {
    if (newPrice <= 0) {
      alert('Price must be greater than 0');
      return;
    }
    
    try {
      setPricePerLiter(newPrice);
      await saveMilkPriceToConfig(newPrice);
      alert(`✅ Milk price updated to KES ${newPrice} per liter`);
      fetchMilkPayments(); // Refresh data with new price
    } catch (error) {
      alert('❌ Failed to save milk price: ' + error.message);
      // Revert to previous price on error
      const priceDoc = await getDoc(doc(db, "system_config", "milk_price"));
      if (priceDoc.exists()) {
        const data = priceDoc.data();
        setPricePerLiter(data.pricePerLiter || 45);
      }
    }
  };

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

  // 🔹 Fetch milk logs
  const fetchMilkPayments = async () => {
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
    const milkLogs = snapshot.docs.map((doc) => ({ 
      id: doc.id, 
      ...doc.data(),
      type: 'milk_payment',
      amount: (doc.data().quantity ?? 0) * pricePerLiter
    }));
    
    setLogs(milkLogs);
  };

  // 🔹 Fetch feed deductions
  const fetchFeedDeductions = () => {
    let q = query(collection(db, "payments"), 
      where("type", "==", "feed_deduction"),
      orderBy("createdAt", "desc")
    );

    if (selectedFarmer) {
      q = query(q, where("farmerId", "==", selectedFarmer));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deductions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        type: 'feed_deduction'
      }));
      setFeedDeductions(deductions);
    });

    return unsubscribe;
  };

  useEffect(() => {
    fetchMilkPayments();
    const unsubscribe = fetchFeedDeductions();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedFarmer, statusFilter, month, year, pricePerLiter]);

  // 🔹 PROCESS PAYMENT: Mark milk as paid and clear balance
  const processPayment = async (farmerId) => {
    setIsProcessing(true);
    try {
      const farmer = farmers.find(f => f.id === farmerId);
      if (!farmer) {
        alert('Farmer not found');
        return;
      }

      // Get farmer's pending milk logs
      const pendingMilkQuery = query(
        collection(db, "milk_logs"),
        where("farmerId", "==", farmerId),
        where("status", "==", "pending")
      );
      
      const pendingMilkSnapshot = await getDocs(pendingMilkQuery);
      const pendingMilkLogs = pendingMilkSnapshot.docs;

      if (pendingMilkLogs.length === 0) {
        alert(`No pending milk payments found for ${farmer.name}`);
        return;
      }

      // Calculate total pending amount
      const totalPendingAmount = pendingMilkLogs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + ((data.quantity || 0) * pricePerLiter);
      }, 0);

      // Get farmer's feed deductions
      const farmerDeductions = feedDeductions.filter(ded => ded.farmerId === farmerId);
      const totalFeedDeductions = farmerDeductions.reduce((sum, ded) => 
        sum + Math.abs(ded.amount || 0), 0
      );

      // Calculate net amount to pay
      const netAmount = totalPendingAmount - totalFeedDeductions;

      if (netAmount <= 0) {
        alert(`No payment needed. Feed deductions (KES ${totalFeedDeductions}) exceed pending milk (KES ${totalPendingAmount})`);
        return;
      }

      // Use batch write for atomic operations
      const batch = writeBatch(db);

      // 1. Mark all pending milk logs as paid
      pendingMilkLogs.forEach(milkDoc => {
        const milkRef = doc(db, "milk_logs", milkDoc.id);
        batch.update(milkRef, {
          status: "paid",
          paidDate: new Date(),
          paidAmount: netAmount > 0 ? netAmount : 0,
          pricePerLiter: pricePerLiter // ✅ Store price with each milk log
        });
      });

      // 2. Create payment record
      const paymentRef = doc(collection(db, "payments"));
      batch.set(paymentRef, {
        farmerId: farmerId,
        type: 'milk_payment',
        amount: netAmount,
        description: `Milk payment for ${pendingMilkLogs.length} deliveries @ KES ${pricePerLiter}/L`,
        status: 'completed',
        pendingMilkAmount: totalPendingAmount,
        feedDeductions: totalFeedDeductions,
        netAmount: netAmount,
        pricePerLiter: pricePerLiter, // ✅ Store price with payment
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // 3. Mark feed deductions as processed
      farmerDeductions.forEach(deduction => {
        const deductionRef = doc(db, "payments", deduction.id);
        batch.update(deductionRef, {
          status: 'processed',
          processedDate: new Date(),
          appliedToPayment: paymentRef.id
        });
      });

      // Commit the batch
      await batch.commit();

      alert(`✅ Payment processed successfully!\n\n` +
            `📊 Pending Milk: KES ${totalPendingAmount}\n` +
            `🌾 Feed Deductions: KES ${totalFeedDeductions}\n` +
            `💰 Net Paid: KES ${netAmount}\n` +
            `📈 Price per Liter: KES ${pricePerLiter}\n\n` +
            `${pendingMilkLogs.length} milk deliveries marked as paid.`);

      // Refresh data
      fetchMilkPayments();

    } catch (error) {
      console.error("Error processing payment:", error);
      alert('❌ Error processing payment: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔹 AUTO-DEDUCT: Apply feed deductions to pending milk
  const autoDeductFeedCosts = async () => {
    setIsProcessing(true);
    try {
      let totalDeducted = 0;
      let farmersProcessed = 0;

      // Process each farmer
      for (const farmer of farmers) {
        const farmerDeductions = feedDeductions.filter(ded => 
          ded.farmerId === farmer.id && ded.status !== 'processed'
        );
        
        if (farmerDeductions.length === 0) continue;

        const totalDeductions = farmerDeductions.reduce((sum, ded) => 
          sum + Math.abs(ded.amount || 0), 0
        );

        // Get pending milk logs for this farmer
        const pendingMilkQuery = query(
          collection(db, "milk_logs"),
          where("farmerId", "==", farmer.id),
          where("status", "==", "pending")
        );
        
        const pendingMilkSnapshot = await getDocs(pendingMilkQuery);
        const pendingMilkLogs = pendingMilkSnapshot.docs;

        if (pendingMilkLogs.length === 0) continue;

        const totalPending = pendingMilkLogs.reduce((sum, doc) => {
          const data = doc.data();
          return sum + ((data.quantity || 0) * pricePerLiter);
        }, 0);

        // Calculate deduction amount (can't deduct more than pending)
        const deductionAmount = Math.min(totalDeductions, totalPending);
        
        if (deductionAmount > 0) {
          const batch = writeBatch(db);

          // Create deduction application record
          const deductionAppRef = doc(collection(db, "deduction_applications"));
          batch.set(deductionAppRef, {
            farmerId: farmer.id,
            amount: -deductionAmount,
            description: `Feed cost deduction applied to pending milk @ KES ${pricePerLiter}/L`,
            originalPending: totalPending,
            deductedAmount: deductionAmount,
            remainingPending: totalPending - deductionAmount,
            pricePerLiter: pricePerLiter,
            createdAt: new Date()
          });

          // Mark deductions as processed
          farmerDeductions.forEach(deduction => {
            const deductionRef = doc(db, "payments", deduction.id);
            batch.update(deductionRef, {
              status: 'processed',
              processedDate: new Date()
            });
          });

          await batch.commit();

          totalDeducted += deductionAmount;
          farmersProcessed++;
          console.log(`✅ Deducted KES ${deductionAmount} from ${farmer.name}`);
        }
      }

      if (totalDeducted > 0) {
        alert(`✅ Successfully applied KES ${totalDeducted} in feed deductions across ${farmersProcessed} farmers`);
      } else {
        alert('ℹ️ No deductions were applied (no matching pending payments)');
      }

      fetchMilkPayments();

    } catch (error) {
      console.error("Error auto-deducting feed costs:", error);
      alert('❌ Error auto-deducting feed costs: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔹 MARK INDIVIDUAL MILK AS PAID (for single payments)
  const markAsPaid = async (milkLogId) => {
    try {
      const milkLog = logs.find(log => log.id === milkLogId);
      if (!milkLog) return;

      await updateDoc(doc(db, "milk_logs", milkLogId), {
        status: "paid",
        paidDate: new Date(),
        pricePerLiter: pricePerLiter
      });

      alert(`✅ Milk delivery marked as paid: ${milkLog.quantity}L @ KES ${pricePerLiter}/L = KES ${milkLog.amount}`);
      fetchMilkPayments();

    } catch (error) {
      console.error("Error marking as paid:", error);
      alert('❌ Error marking as paid: ' + error.message);
    }
  };

  // 🔹 CALCULATE FARMER BALANCE
  const calculateFarmerBalance = (farmerId) => {
    const farmerMilkPending = logs.filter(log => 
      log.farmerId === farmerId && log.status === "pending"
    );
    const farmerMilkPaid = logs.filter(log => 
      log.farmerId === farmerId && log.status === "paid"
    );
    const farmerDeductions = feedDeductions.filter(ded => 
      ded.farmerId === farmerId && ded.status !== 'processed'
    );

    const totalPending = farmerMilkPending.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalPaid = farmerMilkPaid.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalDeductions = farmerDeductions.reduce((sum, ded) => sum + Math.abs(ded.amount || 0), 0);

    const netPayable = totalPending - totalDeductions;

    return {
      totalPending,
      totalPaid,
      totalDeductions,
      netPayable,
      hasPending: totalPending > 0,
      hasDeductions: totalDeductions > 0
    };
  };

  // 🔹 CALCULATE TOTALS
  const calculateTotals = () => {
    const milkPaid = logs.filter(log => log.status === "paid");
    const milkPending = logs.filter(log => log.status === "pending");
    const activeDeductions = feedDeductions.filter(ded => ded.status !== 'processed');

    const totalMilkPaid = milkPaid.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalMilkPending = milkPending.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalFeedDeductions = activeDeductions.reduce((sum, deduction) => 
      sum + Math.abs(deduction.amount || 0), 0
    );

    const totalMilkValue = totalMilkPaid + totalMilkPending;
    const netPayable = totalMilkPending - totalFeedDeductions;

    return {
      totalMilkPaid,
      totalMilkPending,
      totalFeedDeductions,
      totalMilkValue,
      netPayable
    };
  };

  const {
    totalMilkPaid,
    totalMilkPending,
    totalFeedDeductions,
    totalMilkValue,
    netPayable
  } = calculateTotals();

  const filteredTransactions = [
    ...logs.map(log => ({ ...log, transactionType: 'milk' })),
    ...feedDeductions.filter(ded => ded.status !== 'processed')
      .map(deduction => ({ ...deduction, transactionType: 'feed' }))
  ].filter(transaction => {
    if (paymentType === "milk") return transaction.type === 'milk_payment';
    if (paymentType === "feed") return transaction.type === 'feed_deduction';
    return true;
  });

  return (
    <div className="payments">
      <h1>💰 Payments & Deductions</h1>

      {/* 🔹 Milk Price Configuration */}
      <div className="price-configuration">
        <div className="price-header">
          <h3>📈 Milk Price Configuration</h3>
          <button 
            className="btn-toggle-price"
            onClick={() => setShowPriceInput(!showPriceInput)}
          >
            {showPriceInput ? '▼ Hide' : '⚙️ Configure Price'}
          </button>
        </div>
        
        {showPriceInput && (
          <div className="price-input-section">
            <div className="price-input-group">
              <label htmlFor="pricePerLiter">Price per Liter (KES):</label>
              <input
                id="pricePerLiter"
                type="number"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(Number(e.target.value))}
                min="1"
                step="0.5"
                placeholder="Enter price per liter"
              />
              <span className="price-info">Current: KES {pricePerLiter} per liter</span>
            </div>
            <div className="price-actions">
              <button 
                className="btn-apply-price"
                onClick={() => updateMilkPrice(pricePerLiter)}
              >
                Save Price
              </button>
              <button 
                className="btn-reset-price"
                onClick={() => updateMilkPrice(45)}
              >
                Reset to Default
              </button>
            </div>
            <div className="price-save-info">
              <small>Price will be saved to system configuration and used across all calculations</small>
            </div>
          </div>
        )}
      </div>

      {/* 🔹 Payment Processing Section */}
      <div className="payment-processing-section">
        <h3>💳 Payment Processing</h3>
        
        <div className="processing-buttons">
          <button 
            className="btn-auto-deduct"
            onClick={autoDeductFeedCosts}
            disabled={feedDeductions.length === 0 || isProcessing}
          >
            {isProcessing ? '⏳ Processing...' : '🔄 Apply Feed Deductions to Pending Milk'}
          </button>

          {selectedFarmer && (() => {
            const balance = calculateFarmerBalance(selectedFarmer);
            return (
              <button 
                className="btn-process-payment"
                onClick={() => processPayment(selectedFarmer)}
                disabled={!balance.hasPending || isProcessing}
              >
                {isProcessing ? '⏳ Processing...' : `💰 Pay ${farmers.find(f => f.id === selectedFarmer)?.name} - KES ${balance.netPayable}`}
              </button>
            );
          })()}
        </div>

        <div className="processing-info">
          <p>
            <strong>Current Price:</strong> KES {pricePerLiter} per liter
          </p>
          <p>
            <strong>Feed Deductions:</strong> Apply feed costs to pending milk payments
          </p>
          <p>
            <strong>Process Payment:</strong> Pay farmer after deductions (select farmer first)
          </p>
        </div>
      </div>

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

        <select
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
        >
          <option value="all">All Transactions</option>
          <option value="milk">Milk Payments Only</option>
          <option value="feed">Feed Deductions Only</option>
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

        <button onClick={fetchMilkPayments}>Apply</button>
      </div>

      {/* 🔹 Financial Summary */}
      <div className="financial-summary">
        <div className="summary-card total-milk">
          <h3>🥛 Total Milk Value</h3>
          <div className="amount positive">KES {totalMilkValue}</div>
          <div className="subtext">
            Paid: KES {totalMilkPaid} | Pending: KES {totalMilkPending}
          </div>
          <div className="price-subtext">@ KES {pricePerLiter}/L</div>
        </div>

        <div className="summary-card feed-deductions">
          <h3>🌾 Feed Deductions</h3>
          <div className="amount negative">- KES {totalFeedDeductions}</div>
          <div className="subtext">
            To be deducted from pending milk
          </div>
        </div>

        <div className="summary-card net-payable">
          <h3>💰 Net Payable</h3>
          <div className={`amount ${netPayable >= 0 ? 'positive' : 'negative'}`}>
            KES {netPayable}
          </div>
          <div className="subtext">
            Pending milk after deductions
          </div>
          <div className="price-subtext">@ KES {pricePerLiter}/L</div>
        </div>
      </div>

      {/* 🔹 Transactions Table */}
      <div className="payments-table-container">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Farmer</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id} className={transaction.type === 'feed_deduction' ? 'deduction-row' : ''}>
                <td>
                  {transaction.type === 'feed_deduction' ? (
                    <span className="transaction-type feed">🌾 Feed</span>
                  ) : (
                    <span className="transaction-type milk">🥛 Milk</span>
                  )}
                </td>
                <td className="farmer-name">
                  {farmers.find(f => f.id === transaction.farmerId)?.name || transaction.farmerId}
                </td>
                <td className="description">
                  {transaction.type === 'feed_deduction' 
                    ? transaction.description || `Feed Purchase`
                    : `Milk Delivery: ${transaction.quantity}L @ KES ${pricePerLiter}/L`}
                </td>
                <td className={`amount-cell ${transaction.type === 'feed_deduction' ? 'deduction-amount' : 'payment-amount'}`}>
                  {transaction.type === 'feed_deduction' 
                    ? `- KES ${Math.abs(transaction.amount || 0)}`
                    : `KES ${transaction.amount}`}
                </td>
                <td className={`status-${transaction.status}`}>
                  {transaction.status || 'pending'}
                </td>
                <td>
                  {transaction.date?.toDate
                    ? format(transaction.date.toDate(), "MMM dd, yyyy")
                    : transaction.createdAt?.toDate
                    ? format(transaction.createdAt.toDate(), "MMM dd, yyyy")
                    : "N/A"}
                </td>
                <td>
                  {transaction.type === 'milk_payment' && transaction.status === "pending" ? (
                    <button
                      onClick={() => markAsPaid(transaction.id)}
                      className="mark-paid"
                    >
                      Mark Paid
                    </button>
                  ) : (
                    <span className="no-action">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTransactions.length === 0 && (
          <div className="no-transactions">
            <p>No transactions found for the selected filters.</p>
          </div>
        )}
      </div>

      {/* 🔹 Farmer-wise Breakdown */}
      <div className="farmer-breakdown">
        <h3>📊 Farmer Balances</h3>
        <div className="breakdown-cards">
          {farmers.filter(f => !selectedFarmer || f.id === selectedFarmer).map(farmer => {
            const balance = calculateFarmerBalance(farmer.id);
            
            return (
              <div key={farmer.id} className="farmer-card">
                <h4>{farmer.name || farmer.id}</h4>
                <div className="farmer-stats">
                  <div>Pending Milk: <span className="pending">KES {balance.totalPending}</span></div>
                  <div>Feed Deductions: <span className="negative">- KES {balance.totalDeductions}</span></div>
                  <div className="net-amount">
                    Net Payable: <span className={balance.netPayable >= 0 ? 'positive' : 'negative'}>KES {balance.netPayable}</span>
                  </div>
                  <div className="price-info">Price: KES {pricePerLiter}/L</div>
                </div>
                <div className="farmer-actions">
                  <button 
                    onClick={() => processPayment(farmer.id)}
                    disabled={!balance.hasPending || isProcessing}
                    className="btn-pay-farmer"
                  >
                    {isProcessing ? 'Processing...' : `Pay KES ${balance.netPayable}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Payments;