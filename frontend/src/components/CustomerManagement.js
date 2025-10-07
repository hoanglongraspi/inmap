import React, { useState, useEffect, useMemo } from 'react';
import './CustomerManagement.css';
import { apiCreateSampleData, apiGetCustomers } from '../lib/api';
import { supabase } from '../lib/supabase';

const CustomerManagement = ({ onClose }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [sortField, setSortField] = useState('registered_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Fetch all customer data
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        
        // Use the API function which handles pagination to get ALL customers
        const customersData = await apiGetCustomers();

        console.log('Fetched customers data:', customersData);
        console.log('Total customers fetched from database:', customersData?.length || 0);

        // Convert to consistent customer format (now much simpler!)
        const convertedCustomers = customersData.filter(customer => {
          // Check if customer has required fields
          if (!customer.name && !customer.company) {
            console.warn('Skipping customer without name or company:', customer);
            return false;
          }
          return true;
        }).map(customer => ({
          id: customer.id,
          type: customer.customer_type || 'customer',
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          company: customer.company || customer.name,
          address: customer.address || '',
          city: customer.city || 'Unknown',
          state: customer.state || 'XX',
          zip_code: customer.postal_code || '',
          country: customer.country || 'USA',
          status: customer.status,
          certification: customer.role_background || '',
          registered_at: customer.registered_at || customer.created_at,
          latitude: customer.latitude,
          longitude: customer.longitude,
          products_interested: customer.products_interested ? 
            (Array.isArray(customer.products_interested) ? 
              customer.products_interested : 
              JSON.parse(customer.products_interested || '[]')
            ) : ['Unknown'],
          notes: customer.notes || '',
          last_interaction_date: customer.last_interaction_date,
          last_interaction_type: customer.last_interaction_type,
          next_follow_up_date: customer.next_follow_up_date,
          claimed_by: customer.claimed_by,
          source_system: customer.source_system
        }));

        console.log('Converted customers:', convertedCustomers.length);
        setCustomers(convertedCustomers);
        setError(null);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  // Get unique states for filter
  const availableStates = useMemo(() => {
    const states = [...new Set(customers.map(c => c.state))].filter(Boolean).sort();
    return states;
  }, [customers]);

  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    console.log('Filtering customers:', {
      totalCustomers: customers.length,
      searchTerm,
      statusFilter,
      stateFilter
    });
    
    let filtered = customers.filter(customer => {
      const matchesSearch = searchTerm === '' || 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.city.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      const matchesState = stateFilter === 'all' || customer.state === stateFilter;
      
      return matchesSearch && matchesStatus && matchesState;
    });
    
    console.log('After filtering:', filtered.length);

    // Sort customers
    filtered.sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      if (sortField === 'registered_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [customers, searchTerm, statusFilter, stateFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredAndSortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  console.log('Pagination info:', {
    currentPage,
    totalPages,
    itemsPerPage,
    filteredTotal: filteredAndSortedCustomers.length,
    paginatedCount: paginatedCustomers.length
  });

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle customer selection
  const handleCustomerClick = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(true);
  };

  // Create sample data for testing
  const handleCreateSampleData = async () => {
    try {
      setLoading(true);
      await apiCreateSampleData();
      // Refresh data
      window.location.reload();
    } catch (err) {
      console.error('Error creating sample data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'customer': return '#10b981';
      case 'prospect': return '#f59e0b';
      case 'lead': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Get type badge color
  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'site': return '#3b82f6';
      case 'public_site': return '#8b5cf6';
      case 'research_participant': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="customer-management-overlay">
        <div className="customer-management-modal">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading customers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-management-overlay">
        <div className="customer-management-modal">
          <div className="error-container">
            <h3>Error Loading Customers</h3>
            <p>{error}</p>
            <button onClick={onClose} className="primary-button">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-management-overlay">
      <div className="customer-management-modal">
        {/* Header */}
        <div className="customer-management-header">
          <h2>Customer Management</h2>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            Page {currentPage} of {totalPages} | {customers.length} total records
          </div>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        {/* Filters and Search */}
        <div className="customer-management-filters">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-container">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="customer">Customer</option>
              <option value="prospect">Prospect</option>
              <option value="lead">Lead</option>
            </select>

            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All States</option>
              {availableStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <div className="results-info">
            Showing {paginatedCustomers.length} of {filteredAndSortedCustomers.length} customers (Total in DB: {customers.length})
          </div>

          {customers.length === 0 && !loading && (
            <button
              onClick={handleCreateSampleData}
              className="primary-button"
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Create Sample Data
            </button>
          )}
          
          {/* Debug button to show all customers */}
          <button
            onClick={() => {
              console.log('All customers:', customers);
              console.log('Filtered customers:', filteredAndSortedCustomers);
              alert(`Total: ${customers.length}, Filtered: ${filteredAndSortedCustomers.length}, Page: ${currentPage}/${totalPages}`);
            }}
            className="primary-button"
            style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#dc2626' }}
          >
            Debug Info
          </button>
          
          {/* Button to create more sample data */}
          <button
            onClick={async () => {
              try {
                await handleCreateSampleData();
                alert('Sample data created! Refreshing...');
                window.location.reload();
              } catch (err) {
                alert('Error creating sample data: ' + err.message);
              }
            }}
            className="primary-button"
            style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#059669' }}
          >
            Create More Sample Data
          </button>
          
          {/* Button to check other tables */}
          <button
            onClick={async () => {
              try {
                // Check if there are other tables with data
                const tables = ['sites', 'contacts', 'interactions', 'products'];
                const results = {};
                
                for (const table of tables) {
                  try {
                    const { data, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
                    results[table] = error ? `Error: ${error.message}` : `${data?.length || 0} records`;
                  } catch (e) {
                    results[table] = `Table doesn't exist or error: ${e.message}`;
                  }
                }
                
                console.log('Other tables check:', results);
                alert(`Other tables:\n${Object.entries(results).map(([table, count]) => `${table}: ${count}`).join('\n')}`);
              } catch (err) {
                alert('Error checking tables: ' + err.message);
              }
            }}
            className="primary-button"
            style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#7c3aed' }}
          >
            Check Other Tables
          </button>
          
          {/* Button to get all customer data from Supabase */}
          <button
            onClick={async () => {
              try {
                console.log('Fetching ALL customer data from Supabase...');
                
                // Get all customers with count
                const { data: allCustomers, error: customerError, count } = await supabase
                  .from('customers')
                  .select('*', { count: 'exact' });
                
                if (customerError) {
                  console.error('Error fetching customers:', customerError);
                  alert(`Error: ${customerError.message}`);
                  return;
                }
                
                console.log('=== SUPABASE CUSTOMER TABLE DATA ===');
                console.log(`Total records in customers table: ${count}`);
                console.log('All customer records:', allCustomers);
                
                // Show detailed info for each customer
                allCustomers.forEach((customer, index) => {
                  console.log(`\n--- Customer ${index + 1} ---`);
                  console.log(JSON.stringify(customer, null, 2));
                });
                
                // Show summary
                const summary = {
                  totalRecords: count,
                  recordsReturned: allCustomers.length,
                  customerTypes: [...new Set(allCustomers.map(c => c.customer_type))],
                  statuses: [...new Set(allCustomers.map(c => c.status))],
                  sourceSystems: [...new Set(allCustomers.map(c => c.source_system))]
                };
                
                console.log('\n=== SUMMARY ===');
                console.log(summary);
                
                alert(`Found ${count} records in customers table. Check console for full details.\n\nSummary:\n- Total: ${count}\n- Types: ${summary.customerTypes.join(', ')}\n- Statuses: ${summary.statuses.join(', ')}\n- Sources: ${summary.sourceSystems.join(', ')}`);
                
              } catch (err) {
                console.error('Error:', err);
                alert('Error fetching customer data: ' + err.message);
              }
            }}
            className="primary-button"
            style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#f59e0b' }}
          >
            Get All Customer Data
          </button>
        </div>

        {/* Customer Table */}
        <div className="customer-table-container">
          <table className="customer-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className="sortable">
                  Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('company')} className="sortable">
                  Company {sortField === 'company' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('city')} className="sortable">
                  Location {sortField === 'city' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('status')} className="sortable">
                  Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Type</th>
                <th>Products</th>
                <th onClick={() => handleSort('registered_at')} className="sortable">
                  Registered {sortField === 'registered_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer) => (
                <tr key={`${customer.type}-${customer.id}`} className="customer-row">
                  <td>
                    <div className="customer-name">
                      <strong>{customer.name}</strong>
                      {customer.email && <div className="customer-email">{customer.email}</div>}
                    </div>
                  </td>
                  <td>{customer.company || '-'}</td>
                  <td>
                    <div className="customer-location">
                      {customer.city}, {customer.state}
                      {customer.zip_code && <div className="customer-zip">{customer.zip_code}</div>}
                    </div>
                  </td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(customer.status) }}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td>
                    <span 
                      className="type-badge"
                      style={{ backgroundColor: getTypeBadgeColor(customer.type) }}
                    >
                      {customer.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="products-list">
                      {customer.products_interested.slice(0, 2).map((product, idx) => (
                        <span key={idx} className="product-tag">{product}</span>
                      ))}
                      {customer.products_interested.length > 2 && (
                        <span className="product-more">+{customer.products_interested.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(customer.registered_at)}</td>
                  <td>
                    <button
                      onClick={() => handleCustomerClick(customer)}
                      className="view-button"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="pagination-button"
            >
              Previous
            </button>
            
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        )}

        {/* Customer Detail Modal */}
        {showCustomerModal && selectedCustomer && (
          <div className="customer-modal-overlay">
            <div className="customer-detail-modal">
              <div className="customer-detail-header">
                <h3>Customer Details</h3>
                <button 
                  onClick={() => setShowCustomerModal(false)}
                  className="close-button"
                >
                  ×
                </button>
              </div>
              
              <div className="customer-detail-content">
                <div className="customer-detail-section">
                  <h4>Basic Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Name:</label>
                      <span>{selectedCustomer.name}</span>
                    </div>
                    <div className="detail-item">
                      <label>Email:</label>
                      <span>{selectedCustomer.email || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Phone:</label>
                      <span>{selectedCustomer.phone || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Company:</label>
                      <span>{selectedCustomer.company || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                <div className="customer-detail-section">
                  <h4>Location</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Address:</label>
                      <span>{selectedCustomer.address || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>City:</label>
                      <span>{selectedCustomer.city}</span>
                    </div>
                    <div className="detail-item">
                      <label>State:</label>
                      <span>{selectedCustomer.state}</span>
                    </div>
                    <div className="detail-item">
                      <label>Zip Code:</label>
                      <span>{selectedCustomer.zip_code || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Country:</label>
                      <span>{selectedCustomer.country || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                <div className="customer-detail-section">
                  <h4>Business Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Status:</label>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(selectedCustomer.status) }}
                      >
                        {selectedCustomer.status}
                      </span>
                    </div>
                    <div className="detail-item">
                      <label>Type:</label>
                      <span 
                        className="type-badge"
                        style={{ backgroundColor: getTypeBadgeColor(selectedCustomer.type) }}
                      >
                        {selectedCustomer.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="detail-item">
                      <label>Certification:</label>
                      <span>{selectedCustomer.certification || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Registered:</label>
                      <span>{formatDate(selectedCustomer.registered_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="customer-detail-section">
                  <h4>Products of Interest</h4>
                  <div className="products-detail">
                    {selectedCustomer.products_interested.map((product, idx) => (
                      <span key={idx} className="product-tag-large">{product}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="customer-detail-actions">
                <button 
                  onClick={() => setShowCustomerModal(false)}
                  className="secondary-button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerManagement;
