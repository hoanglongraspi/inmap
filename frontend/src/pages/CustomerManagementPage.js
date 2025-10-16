import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './CustomerManagementPage.css';
import { apiGetCustomers, apiCreateCustomer, apiUpdateCustomer, apiDeleteCustomer, apiGeocodeCustomers } from '../lib/api';
import CSVImport from '../components/CSVImport';

const CustomerManagementPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [sortField, setSortField] = useState('registered_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [editFormData, setEditFormData] = useState(null);
  
  // Geocoding state
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(null);
  const [showGeocodeModal, setShowGeocodeModal] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState(null);

  // Fetch all customer data
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const customersData = await apiGetCustomers();
      console.log('Fetched customers:', customersData.length);
      
      const convertedCustomers = customersData.filter(customer => {
        if (!customer.name && !customer.company) {
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

      setCustomers(convertedCustomers);
      setError(null);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Get unique states and types for filters
  const availableStates = useMemo(() => {
    const states = [...new Set(customers.map(c => c.state))].filter(Boolean).sort();
    return states;
  }, [customers]);

  const availableTypes = useMemo(() => {
    const types = [...new Set(customers.map(c => c.type))].filter(Boolean).sort();
    return types;
  }, [customers]);

  const availableProjects = useMemo(() => {
    const projects = [...new Set(customers.flatMap(c => c.products_interested || []))].filter(Boolean).sort();
    return projects;
  }, [customers]);

  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customers.filter(customer => {
      const matchesSearch = searchTerm === '' || 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.city.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      const matchesState = stateFilter === 'all' || customer.state === stateFilter;
      const matchesType = typeFilter === 'all' || customer.type === typeFilter;
      const matchesProject = projectFilter === 'all' || (customer.products_interested || []).includes(projectFilter);
      
      return matchesSearch && matchesStatus && matchesState && matchesType && matchesProject;
    });

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
  }, [customers, searchTerm, statusFilter, stateFilter, typeFilter, projectFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredAndSortedCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle customer view
  const handleCustomerClick = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(true);
  };

  // Handle create customer
  const handleCreateCustomer = () => {
    setEditFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'USA',
      status: 'lead',
      type: 'customer',
      products_interested: [],
      notes: ''
    });
    setShowCreateModal(true);
  };

  // Handle edit customer
  const handleEditCustomer = (customer) => {
    setEditFormData({ ...customer });
    setSelectedCustomer(customer);
    setShowEditModal(true);
  };

  // Handle save customer (create or update)
  const handleSaveCustomer = async () => {
    try {
      setLoading(true);
      
      const customerData = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        company: editFormData.company,
        address: editFormData.address,
        city: editFormData.city,
        state: editFormData.state,
        postal_code: editFormData.zip_code,
        country: editFormData.country,
        status: editFormData.status,
        notes: editFormData.notes
      };

      if (showEditModal && selectedCustomer) {
        await apiUpdateCustomer(selectedCustomer.id, customerData);
      } else {
        await apiCreateCustomer(customerData);
      }

      await fetchCustomers();
      setShowEditModal(false);
      setShowCreateModal(false);
      setEditFormData(null);
    } catch (err) {
      console.error('Error saving customer:', err);
      alert('Error saving customer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete customer
  const handleDeleteCustomer = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await apiDeleteCustomer(customerId);
      await fetchCustomers();
      setShowCustomerModal(false);
      setShowEditModal(false);
    } catch (err) {
      console.error('Error deleting customer:', err);
      alert('Error deleting customer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV import completion
  const handleImportComplete = async () => {
    console.log('CSV import completed, refreshing customer list...');
    await fetchCustomers();
    setShowCSVImport(false);
  };

  // Handle geocoding missing customers
  const handleGeocodeCustomers = async () => {
    setGeocoding(true);
    setShowGeocodeModal(true);
    setGeocodeProgress({ current: 0, total: 0, status: 'starting' });
    setGeocodeResults(null);

    try {
      const results = await apiGeocodeCustomers((progress) => {
        setGeocodeProgress(progress);
      });

      setGeocodeResults(results);
      
      // Refresh customer list after geocoding
      await fetchCustomers();
    } catch (error) {
      console.error('Geocoding error:', error);
      setGeocodeResults({
        success: false,
        error: error.message
      });
    } finally {
      setGeocoding(false);
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
      case 'participant': return '#ef4444';
      case 'customer': return '#10b981';
      default: return '#6b7280';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && customers.length === 0) {
    return (
      <div className="customer-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error && customers.length === 0) {
    return (
      <div className="customer-page">
        <div className="error-container">
          <h3>Error Loading Customers</h3>
          <p>{error}</p>
          <button onClick={fetchCustomers} className="primary-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      {/* Header with Logo */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <img 
            src="/logo.png" 
            alt="Customer Atlas Logo" 
            style={{
              height: '48px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: '#111827',
              letterSpacing: '-0.5px'
            }}>
              Customer Atlas
            </h1>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#6b7280',
              fontWeight: 400
            }}>
              Customer Management
            </p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')} 
          style={{
            padding: '8px 16px',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            background: '#3b82f6',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#2563eb';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#3b82f6';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Map
        </button>
      </header>

      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>Customer Management</h1>
          <p className="header-subtitle">
            Total: {customers.length} | Showing: {filteredAndSortedCustomers.length} | Page {currentPage} of {totalPages}
          </p>
        </div>
        <div className="header-actions">
          <button onClick={handleGeocodeCustomers} className="btn-import" style={{ background: '#f59e0b', borderColor: '#f59e0b' }} disabled={geocoding}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2v20M2 12h20"/>
            </svg>
            {geocoding ? 'Geocoding...' : 'Geocode Missing'}
          </button>
          <button onClick={() => setShowCSVImport(true)} className="btn-import">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Import CSV
          </button>
          <button onClick={handleCreateCustomer} className="btn-create">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Create Customer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search customers by name, email, company, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-row">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="customer">Customer</option>
            <option value="prospect">Prospect</option>
            <option value="lead">Lead</option>
            <option value="new">New</option>
            <option value="qualified">Qualified</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            {availableTypes.map(type => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Projects</option>
            {availableProjects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
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

          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="filter-select"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
          </select>

          <button 
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setStateFilter('all');
              setTypeFilter('all');
              setProjectFilter('all');
            }}
            className="btn-reset"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="table-container">
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
              <th onClick={() => handleSort('type')} className="sortable">
                Type {sortField === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>Products</th>
              <th onClick={() => handleSort('registered_at')} className="sortable">
                Registered {sortField === 'registered_at' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.map((customer) => (
              <tr key={customer.id} className="customer-row">
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
                  <div className="action-buttons">
                    <button
                      onClick={() => handleCustomerClick(customer)}
                      className="btn-view"
                      title="View Details"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditCustomer(customer)}
                      className="btn-edit"
                      title="Edit Customer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(customer.id)}
                      className="btn-delete"
                      title="Delete Customer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paginatedCustomers.length === 0 && (
          <div className="no-results">
            <p>No customers found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="pagination-button"
          >
            First
          </button>
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
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="pagination-button"
          >
            Last
          </button>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showCustomerModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowCustomerModal(false)}>
          <div className="modal-content customer-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Customer Details</h3>
              <button onClick={() => setShowCustomerModal(false)} className="close-button">×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
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

              <div className="detail-section">
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
                </div>
              </div>

              <div className="detail-section">
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
                    <label>Registered:</label>
                    <span>{formatDate(selectedCustomer.registered_at)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Source:</label>
                    <span>{selectedCustomer.source_system || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Products of Interest</h4>
                <div className="products-detail">
                  {selectedCustomer.products_interested.map((product, idx) => (
                    <span key={idx} className="product-tag-large">{product}</span>
                  ))}
                </div>
              </div>

              {selectedCustomer.notes && (
                <div className="detail-section">
                  <h4>Notes</h4>
                  <p className="notes-text">{selectedCustomer.notes}</p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button onClick={() => handleEditCustomer(selectedCustomer)} className="btn-primary">
                Edit Customer
              </button>
              <button onClick={() => setShowCustomerModal(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Customer Modal */}
      {(showCreateModal || showEditModal) && editFormData && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{showEditModal ? 'Edit Customer' : 'Create New Customer'}</h3>
              <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="close-button">×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    placeholder="Customer Name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    placeholder="+1-555-0000"
                  />
                </div>

                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    value={editFormData.company}
                    onChange={(e) => setEditFormData({...editFormData, company: e.target.value})}
                    placeholder="Company Name"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Address</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                    placeholder="Street Address"
                  />
                </div>

                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                    placeholder="City"
                  />
                </div>

                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({...editFormData, state: e.target.value})}
                    placeholder="State"
                    maxLength={2}
                  />
                </div>

                <div className="form-group">
                  <label>Zip Code</label>
                  <input
                    type="text"
                    value={editFormData.zip_code}
                    onChange={(e) => setEditFormData({...editFormData, zip_code: e.target.value})}
                    placeholder="Zip Code"
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                  >
                    <option value="lead">Lead</option>
                    <option value="prospect">Prospect</option>
                    <option value="customer">Customer</option>
                    <option value="new">New</option>
                    <option value="qualified">Qualified</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    placeholder="Additional notes..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button onClick={handleSaveCustomer} className="btn-primary" disabled={!editFormData.name}>
                {showEditModal ? 'Update Customer' : 'Create Customer'}
              </button>
              <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal - Using CSVImport Component */}
      {showCSVImport && (
        <CSVImport 
          onImportComplete={handleImportComplete}
          onClose={() => setShowCSVImport(false)}
        />
      )}

      {/* Geocoding Progress Modal */}
      {showGeocodeModal && (
        <div className="modal-overlay" onClick={() => !geocoding && setShowGeocodeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>🌍 Geocoding Customers</h3>
              {!geocoding && (
                <button onClick={() => setShowGeocodeModal(false)} className="close-button">×</button>
              )}
            </div>
            
            <div className="modal-body" style={{ padding: '24px' }}>
              {geocoding && geocodeProgress && (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600 }}>Processing customers...</span>
                      <span style={{ color: '#6b7280' }}>
                        {geocodeProgress.current} / {geocodeProgress.total}
                      </span>
                    </div>
                    <div style={{ background: '#e5e7eb', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          background: '#3b82f6', 
                          height: '100%', 
                          width: `${(geocodeProgress.current / geocodeProgress.total) * 100}%`,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                  
                  {geocodeProgress.customer && (
                    <div style={{ 
                      background: '#f9fafb', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      marginBottom: '12px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                        <strong>{geocodeProgress.customer}</strong>
                      </div>
                      {geocodeProgress.status === 'success' && (
                        <div style={{ fontSize: '12px', color: '#10b981' }}>
                          ✅ Geocoded: {geocodeProgress.coordinates}
                        </div>
                      )}
                      {geocodeProgress.status === 'failed' && (
                        <div style={{ fontSize: '12px', color: '#f59e0b' }}>
                          ⚠️ Could not geocode: {geocodeProgress.reason}
                        </div>
                      )}
                      {geocodeProgress.status === 'error' && (
                        <div style={{ fontSize: '12px', color: '#ef4444' }}>
                          ❌ Error: {geocodeProgress.error}
                        </div>
                      )}
                      {geocodeProgress.status === 'processing' && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          🔄 Processing...
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
                    Please wait, this may take a few minutes...
                  </div>
                </div>
              )}
              
              {!geocoding && geocodeResults && (
                <div>
                  {geocodeResults.success ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                      <h3 style={{ margin: '0 0 24px 0', color: '#10b981' }}>Geocoding Complete!</h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '32px', fontWeight: 700, color: '#16a34a' }}>
                            {geocodeResults.geocoded}
                          </div>
                          <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                            Successfully Geocoded
                          </div>
                        </div>
                        
                        <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                          <div style={{ fontSize: '32px', fontWeight: 700, color: '#d97706' }}>
                            {geocodeResults.failed}
                          </div>
                          <div style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>
                            Failed
                          </div>
                        </div>
                        
                        <div style={{ background: '#dbeafe', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '32px', fontWeight: 700, color: '#2563eb' }}>
                            {geocodeResults.processed}
                          </div>
                          <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '4px' }}>
                            Total Processed
                          </div>
                        </div>
                      </div>
                      
                      {geocodeResults.message && (
                        <div style={{ 
                          background: '#eff6ff', 
                          padding: '12px', 
                          borderRadius: '8px', 
                          fontSize: '14px',
                          color: '#1e40af',
                          marginBottom: '16px'
                        }}>
                          ℹ️ {geocodeResults.message}
                        </div>
                      )}
                      
                      <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
                        Your customers with coordinates will now appear on the map!
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
                      <h3 style={{ margin: '0 0 16px 0', color: '#ef4444' }}>Geocoding Failed</h3>
                      <p style={{ fontSize: '14px', color: '#6b7280' }}>
                        {geocodeResults.error}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {!geocoding && (
              <div className="modal-footer">
                <button onClick={() => setShowGeocodeModal(false)} className="btn-primary">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagementPage;

