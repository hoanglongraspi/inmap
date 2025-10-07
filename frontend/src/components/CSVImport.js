import React, { useState, useRef, useEffect } from 'react';
import './CSVImport.css';
import { apiImportCSVData, apiGetProducts, apiCreateProduct } from '../lib/api';

const CSVImport = ({ onImportComplete, onClose }) => {
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [step, setStep] = useState(1); // 1: Select Product, 2: Upload, 3: Map Fields, 4: Import, 5: Results
  const [selectedProduct, setSelectedProduct] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProductData, setNewProductData] = useState({
    name: '',
    description: ''
  });
  const [creatingProduct, setCreatingProduct] = useState(false);
  const fileInputRef = useRef(null);
  
  // Google Sheets import states
  const [importMethod, setImportMethod] = useState('file'); // 'file' or 'googlesheet'
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [loadingGoogleSheet, setLoadingGoogleSheet] = useState(false);
  const [googleSheetError, setGoogleSheetError] = useState(null);

  // Load available products on component mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const products = await apiGetProducts();
        const productOptions = products.map(product => ({
          value: product.name,
          label: product.name,
          id: product.id
        }));
        
        // Add "Both Products" option if we have multiple products
        if (productOptions.length >= 2) {
          productOptions.push({
            value: 'Both',
            label: 'Both Products',
            id: 'both'
          });
        }
        
        setAvailableProducts(productOptions);
      } catch (error) {
        console.error('Failed to load products:', error);
        // Fallback to default products
        setAvailableProducts([
          { value: 'ArmRehab', label: 'ArmRehab', id: 'armrehab' },
          { value: 'Audiosight', label: 'Audiosight', id: 'audiosight' },
          { value: 'Both', label: 'Both Products', id: 'both' }
        ]);
      }
    };

    loadProducts();
  }, []);

  // Handle creating new product
  const handleCreateProduct = async () => {
    if (!newProductData.name.trim()) return;

    try {
      setCreatingProduct(true);
      const newProduct = await apiCreateProduct({
        name: newProductData.name.trim(),
        description: newProductData.description.trim() || null
      });

      // Add the new product to available products
      const newProductOption = {
        value: newProduct.name,
        label: newProduct.name,
        id: newProduct.id
      };
      
      setAvailableProducts(prev => [...prev.filter(p => p.id !== 'both'), newProductOption, 
        prev.find(p => p.id === 'both')].filter(Boolean));
      
      // Select the newly created product
      setSelectedProduct(newProduct.name);
      
      // Reset form and hide it
      setNewProductData({ name: '', description: '' });
      setShowNewProductForm(false);
    } catch (error) {
      console.error('Failed to create product:', error);
      alert('Failed to create product: ' + error.message);
    } finally {
      setCreatingProduct(false);
    }
  };

  // Available database fields for mapping
  const availableFields = [
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'last_name', label: 'Last Name', required: true },
    { key: 'company', label: 'Company', required: false },
    { key: 'address', label: 'Address', required: false },
    { key: 'city', label: 'City', required: false },
    { key: 'state', label: 'State', required: false },
    { key: 'zip_code', label: 'Zip Code', required: false },
    { key: 'country', label: 'Country', required: false },
    { key: 'certification', label: 'Certification', required: false },
    { key: 'other_certification', label: 'Other Certification', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: false }
  ];

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], data: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      return values;
    });

    return { headers, data };
  };

  // Parse Google Sheets HTML response to extract data
  const parseGoogleSheetsHTML = (html) => {
    try {
      console.log('📊 Parsing Google Sheets HTML...');
      
      // Method 1: Extract from HTML table (most reliable)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const table = doc.querySelector('table.waffle');
      
      if (table) {
        console.log('✅ Found Google Sheets table, extracting data...');
        const rows = [];
        const tableRows = table.querySelectorAll('tbody tr');
        
        for (const tr of tableRows) {
          // Skip row headers (th elements with row numbers)
          const cells = tr.querySelectorAll('td');
          if (cells.length === 0) continue;
          
          const rowData = [];
          for (const cell of cells) {
            // Get the text content, handling merged cells and special formatting
            let cellText = cell.textContent.trim();
            
            // Handle cells with nested divs (common in Google Sheets)
            const innerDiv = cell.querySelector('.softmerge-inner');
            if (innerDiv) {
              cellText = innerDiv.textContent.trim();
            }
            
            rowData.push(cellText);
          }
          
          // Only add rows that have at least one non-empty cell
          if (rowData.some(cell => cell && cell.length > 0)) {
            rows.push(rowData);
          }
        }
        
        console.log(`✅ Extracted ${rows.length} rows from table`);
        if (rows.length > 0) {
          console.log('First row (headers):', rows[0]);
          console.log('Second row (sample data):', rows[1]);
          return rows;
        }
      }
      
      // Method 2: Try to extract from embedded JSON data
      console.log('⚠️ Table not found, trying JSON extraction...');
      const jsonMatch = html.match(/"data":(\[\[.*?\]\])/);
      if (jsonMatch) {
        try {
          const rawData = JSON.parse(jsonMatch[1]);
          console.log('✅ Found grid data in JSON, parsing...');
          
          const rows = [];
          for (const row of rawData) {
            const rowData = [];
            for (const cell of row) {
              // Each cell is an array with complex structure
              let cellValue = '';
              
              if (cell && cell[0]) {
                // Text cell: {"2": 3, "3": [2, "value"]}
                if (cell[0]['2'] === 3 && cell[0]['3']) {
                  cellValue = cell[0]['3'][2] || cell[0]['3'][0] || '';
                }
                // Number cell: {"1": 3, "3": number}
                else if (cell[0]['1'] === 3 && cell[0]['3'] !== undefined) {
                  cellValue = String(cell[0]['3']);
                }
              }
              
              rowData.push(cellValue);
            }
            
            if (rowData.some(cell => cell)) {
              rows.push(rowData);
            }
          }
          
          if (rows.length > 0) {
            console.log(`✅ Extracted ${rows.length} rows from JSON`);
            return rows;
          }
        } catch (e) {
          console.log('⚠️ Failed to parse JSON data:', e.message);
        }
      }
      
      throw new Error('Could not extract data from Google Sheets HTML. Please try downloading as CSV instead.');
    } catch (error) {
      throw new Error('Failed to parse Google Sheets HTML: ' + error.message);
    }
  };

  // Convert parsed rows to CSV-like format
  const rowsToCSVFormat = (rows) => {
    if (!rows || rows.length === 0) {
      return { headers: [], data: [] };
    }
    
    const headers = rows[0];
    const data = rows.slice(1);
    
    return { headers, data };
  };

  // Fetch data from Google Sheets URL with CORS handling
  const fetchGoogleSheetData = async () => {
    setLoadingGoogleSheet(true);
    setGoogleSheetError(null);
    
    try {
      // Clean up the URL - just use it directly
      let fetchUrl = googleSheetUrl.trim();
      
      // Make sure it's a valid Google Sheets URL
      if (!fetchUrl.includes('docs.google.com/spreadsheets')) {
        throw new Error('Invalid Google Sheets URL. Please paste a valid Google Sheets link.');
      }
      
      let html = null;
      let fetchError = null;
      
      // Method 1: Try direct fetch first (this will get HTML)
      try {
        console.log('📥 Fetching Google Sheet HTML from:', fetchUrl);
        const response = await fetch(fetchUrl, {
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (response.ok) {
          html = await response.text();
          console.log('✅ Direct fetch successful, got HTML (' + html.length + ' bytes)');
        } else {
          fetchError = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (directError) {
        console.log('❌ Direct fetch failed (CORS):', directError.message);
        fetchError = directError.message;
      }
      
      // Method 2: If direct fetch failed, try CORS proxy
      if (!html) {
        console.log('Trying CORS proxy method...');
        try {
          // Use AllOrigins CORS proxy service
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(fetchUrl)}`;
          const response = await fetch(proxyUrl);
          
          if (response.ok) {
            html = await response.text();
            console.log('✅ CORS proxy fetch successful');
          } else {
            throw new Error(`Proxy failed: ${response.status}`);
          }
        } catch (proxyError) {
          console.log('❌ CORS proxy failed:', proxyError.message);
          // Try another proxy
          try {
            const corsAnywhereUrl = `https://corsproxy.io/?${encodeURIComponent(fetchUrl)}`;
            const response = await fetch(corsAnywhereUrl);
            
            if (response.ok) {
              html = await response.text();
              console.log('✅ Alternative CORS proxy successful');
            }
          } catch (altProxyError) {
            console.log('❌ Alternative proxy also failed:', altProxyError.message);
          }
        }
      }
      
      // If all methods failed
      if (!html || html.trim().length === 0) {
        throw new Error(
          'Unable to fetch Google Sheet data. Please make sure:\n\n' +
          '1. The Google Sheet link is set to "Anyone with the link can view"\n' +
          '2. You have a stable internet connection\n\n' +
          'Alternatively, download as CSV and use the file upload option instead.\n\n' +
          'Technical details: ' + (fetchError || 'No data received')
        );
      }
      
      console.log('📊 Received HTML, length:', html.length, 'bytes');
      
      // Parse the HTML to extract spreadsheet data
      const rows = parseGoogleSheetsHTML(html);
      
      if (!rows || rows.length === 0) {
        throw new Error(
          'No data found in the Google Sheet.\n\n' +
          '✅ ALTERNATIVE: Download as CSV and upload instead:\n' +
          '   1. File → Download → Comma Separated Values (.csv)\n' +
          '   2. Use "Upload CSV File" option\n\n' +
          'Make sure your sheet has headers in the first row and data in subsequent rows.'
        );
      }
      
      // Convert rows to headers/data format
      const { headers, data } = rowsToCSVFormat(rows);
      
      if (headers.length === 0 || data.length === 0) {
        throw new Error(
          'No data found in the Google Sheet.\n\n' +
          'Make sure your sheet has:\n' +
          '   • Headers in the first row\n' +
          '   • Data in subsequent rows\n\n' +
          'Found ' + rows.length + ' rows total.'
        );
      }
      
      console.log(`✅ Successfully parsed ${headers.length} columns and ${data.length} rows`);
      
      setHeaders(headers);
      setCsvData(data);
      
      // Auto-map common fields with smart matching (same logic as file upload)
      const autoMapping = {};
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        
        // Try exact match first
        let matchedField = availableFields.find(field => 
          field.key === lowerHeader || 
          field.label.toLowerCase().replace(/\s+/g, '_') === lowerHeader
        );
        
        // If no exact match, try smart pattern matching
        if (!matchedField) {
          matchedField = availableFields.find(field => {
            // First name variations
            if (field.key === 'first_name') {
              return lowerHeader.match(/^(first|fname|f_name|firstname)(_name)?$/);
            }
            // Last name variations
            if (field.key === 'last_name') {
              return lowerHeader.match(/^(last|lname|l_name|lastname|surname)(_name)?$/);
            }
            // Email variations
            if (field.key === 'email') {
              return lowerHeader.match(/^(email|e_mail|mail|email_address)$/);
            }
            // Phone variations
            if (field.key === 'phone') {
              return lowerHeader.match(/^(phone|tel|telephone|mobile|cell|phone_number)$/);
            }
            // Zip code variations
            if (field.key === 'zip_code') {
              return lowerHeader.match(/^(zip|zipcode|zip_code|postal|postal_code|postcode)$/);
            }
            // Address variations
            if (field.key === 'address') {
              return lowerHeader.match(/^(address|addr|street|street_address|address_1|address1)$/);
            }
            // City variations
            if (field.key === 'city') {
              return lowerHeader.match(/^(city|town|municipality)$/);
            }
            // State variations
            if (field.key === 'state') {
              return lowerHeader.match(/^(state|province|region|st)$/);
            }
            // Country variations
            if (field.key === 'country') {
              return lowerHeader.match(/^(country|nation)$/);
            }
            // Company variations
            if (field.key === 'company') {
              return lowerHeader.match(/^(company|organization|organisation|business|employer|firm)$/);
            }
            return false;
          });
        }
        
        if (matchedField) {
          autoMapping[index] = matchedField.key;
          console.log(`✅ Auto-mapped "${header}" → "${matchedField.label}"`);
        } else {
          console.log(`⚠️ No auto-mapping for "${header}"`);
        }
      });
      setFieldMapping(autoMapping);
      setStep(3);
      
    } catch (error) {
      console.error('Error fetching Google Sheet:', error);
      setGoogleSheetError(error.message);
    } finally {
      setLoadingGoogleSheet(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, data } = parseCSV(text);
      setHeaders(headers);
      setCsvData(data);
      
      // Auto-map common fields with smart matching
      const autoMapping = {};
      headers.forEach((header, index) => {
        const lowerHeader = header.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        
        // Try exact match first
        let matchedField = availableFields.find(field => 
          field.key === lowerHeader || 
          field.label.toLowerCase().replace(/\s+/g, '_') === lowerHeader
        );
        
        // If no exact match, try smart pattern matching
        if (!matchedField) {
          matchedField = availableFields.find(field => {
            // First name variations
            if (field.key === 'first_name') {
              return lowerHeader.match(/^(first|fname|f_name|firstname)(_name)?$/);
            }
            // Last name variations
            if (field.key === 'last_name') {
              return lowerHeader.match(/^(last|lname|l_name|lastname|surname)(_name)?$/);
            }
            // Email variations
            if (field.key === 'email') {
              return lowerHeader.match(/^(email|e_mail|mail|email_address)$/);
            }
            // Phone variations
            if (field.key === 'phone') {
              return lowerHeader.match(/^(phone|tel|telephone|mobile|cell|phone_number)$/);
            }
            // Zip code variations
            if (field.key === 'zip_code') {
              return lowerHeader.match(/^(zip|zipcode|zip_code|postal|postal_code|postcode)$/);
            }
            // Address variations
            if (field.key === 'address') {
              return lowerHeader.match(/^(address|addr|street|street_address|address_1|address1)$/);
            }
            // City variations
            if (field.key === 'city') {
              return lowerHeader.match(/^(city|town|municipality)$/);
            }
            // State variations
            if (field.key === 'state') {
              return lowerHeader.match(/^(state|province|region|st)$/);
            }
            // Country variations
            if (field.key === 'country') {
              return lowerHeader.match(/^(country|nation)$/);
            }
            // Company variations
            if (field.key === 'company') {
              return lowerHeader.match(/^(company|organization|organisation|business|employer|firm)$/);
            }
            return false;
          });
        }
        
        if (matchedField) {
          autoMapping[index] = matchedField.key;
          console.log(`✅ Auto-mapped "${header}" → "${matchedField.label}"`);
        } else {
          console.log(`⚠️ No auto-mapping for "${header}"`);
        }
      });
      setFieldMapping(autoMapping);
      setStep(3);
    };
    reader.readAsText(selectedFile);
  };

  // Update field mapping
  const updateFieldMapping = (columnIndex, fieldKey) => {
    setFieldMapping(prev => ({
      ...prev,
      [columnIndex]: fieldKey
    }));
  };

  // Convert CSV data to format for API import
  const convertToSiteData = (rowData) => {
    const siteData = {};
    
    headers.forEach((header, index) => {
      const fieldKey = fieldMapping[index];
      if (fieldKey && rowData[index]) {
        siteData[fieldKey] = rowData[index];
      }
    });
    
    // Return data WITHOUT coordinates - let the API geocode it!
    return {
      first_name: siteData.first_name || '',
      last_name: siteData.last_name || '',
      company: siteData.company || '',
      address: siteData.address || '',
      city: siteData.city || 'Unknown',
      state: siteData.state || 'XX',
      zip_code: siteData.zip_code || siteData.postal_code || siteData.zipcode || '00000',
      postal_code: siteData.zip_code || siteData.postal_code || siteData.zipcode || '00000',
      zipcode: siteData.zip_code || siteData.postal_code || siteData.zipcode || '00000',
      country: siteData.country || 'USA',
      email: siteData.email || '',
      phone: siteData.phone || '',
      certification: siteData.certification || '',
      other_certification: siteData.other_certification || '',
      status: siteData.status || 'lead',
      registered_at: siteData.registered_at || new Date().toISOString().split('T')[0],
      // Only include lat/lng if they exist in the CSV
      latitude: siteData.latitude ? parseFloat(siteData.latitude) : null,
      longitude: siteData.longitude ? parseFloat(siteData.longitude) : null
    };
  };

  // Start import process
  const startImport = async () => {
    setImporting(true);
    setStep(4);
    setImportProgress(0);

    try {
      const convertedData = [];
      const errors = [];
      
      // Convert CSV data to site format
      for (let i = 0; i < csvData.length; i++) {
        try {
          const siteData = convertToSiteData(csvData[i]);
          convertedData.push(siteData);
          setImportProgress(((i + 1) / csvData.length) * 50); // 50% for conversion
          
          // Add small delay to show progress
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          errors.push({ row: i + 2, error: error.message }); // +2 for header and 0-based index
        }
      }

      // Save to Supabase database
      let importResponse = null;
      if (convertedData.length > 0) {
        try {
          importResponse = await apiImportCSVData(convertedData, selectedProduct);
          setImportProgress(100); // 100% when saved to database
        } catch (dbError) {
          throw new Error(`Database error: ${dbError.message}`);
        }
      }

      setImportResults({
        success: true,
        imported: importResponse?.imported_count || convertedData.length,
        geocoded: importResponse?.geocoded_count || 0,
        errors: errors.length,
        errorDetails: errors,
        warnings: importResponse?.warnings || []
      });
      
      setStep(5);
      
      // Call completion callback
      if (onImportComplete) {
        onImportComplete(convertedData);
      }
    } catch (error) {
      setImportResults({
        success: false,
        error: error.message
      });
      setStep(5);
    } finally {
      setImporting(false);
    }
  };

  // Reset import
  const resetImport = () => {
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setFieldMapping({});
    setImporting(false);
    setImportProgress(0);
    setImportResults(null);
    setStep(1);
    setImportMethod('file');
    setGoogleSheetUrl('');
    setGoogleSheetError(null);
    setLoadingGoogleSheet(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="csv-import-overlay">
      <div className="csv-import-modal">
        <div className="csv-import-header">
          <h2>Import CSV Data</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="csv-import-content">
          {/* Step 1: Product Selection */}
          {step === 1 && (
            <div className="product-selection-step">
              <div className="product-selection-area">
                <div className="selection-icon">🎯</div>
                <h3>Select Product Interest</h3>
                <p>Choose which product(s) the imported customers will be interested in:</p>
                
                <div className="product-options">
                  {availableProducts.map(product => (
                    <label key={product.value} className="product-option">
                      <input
                        type="radio"
                        name="product"
                        value={product.value}
                        checked={selectedProduct === product.value}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                      />
                      <span className="product-label">{product.label}</span>
                    </label>
                  ))}
                  
                  {/* Add New Product Option */}
                  <div className="add-product-section">
                    <button
                      type="button"
                      onClick={() => setShowNewProductForm(!showNewProductForm)}
                      className="add-product-button"
                    >
                      ➕ Add New Product
                    </button>
                    
                    {showNewProductForm && (
                      <div className="new-product-form">
                        <h4>Create New Product</h4>
                        <div className="form-group">
                          <label>Product Name *</label>
                          <input
                            type="text"
                            value={newProductData.name}
                            onChange={(e) => setNewProductData(prev => ({
                              ...prev,
                              name: e.target.value
                            }))}
                            placeholder="Enter product name"
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Description</label>
                          <textarea
                            value={newProductData.description}
                            onChange={(e) => setNewProductData(prev => ({
                              ...prev,
                              description: e.target.value
                            }))}
                            placeholder="Enter product description (optional)"
                            className="form-textarea"
                            rows="3"
                          />
                        </div>
                        <div className="form-actions">
                          <button
                            type="button"
                            onClick={handleCreateProduct}
                            disabled={!newProductData.name.trim() || creatingProduct}
                            className="primary-button small"
                          >
                            {creatingProduct ? 'Creating...' : 'Create Product'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewProductForm(false);
                              setNewProductData({ name: '', description: '' });
                            }}
                            className="secondary-button small"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="step-actions">
                  <button 
                    onClick={() => setStep(2)}
                    disabled={!selectedProduct}
                    className="primary-button"
                  >
                    Continue to File Upload
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: File Upload or Google Sheets */}
          {step === 2 && (
            <div className="upload-step">
              {/* Import Method Toggle */}
              <div className="import-method-toggle">
                <button
                  className={`toggle-button ${importMethod === 'file' ? 'active' : ''}`}
                  onClick={() => {
                    setImportMethod('file');
                    setGoogleSheetError(null);
                  }}
                >
                  📁 Upload CSV File
                </button>
                <button
                  className={`toggle-button ${importMethod === 'googlesheet' ? 'active' : ''}`}
                  onClick={() => {
                    setImportMethod('googlesheet');
                    setGoogleSheetError(null);
                  }}
                >
                  📊 Import from Google Sheets
                </button>
              </div>

              {/* File Upload Option */}
              {importMethod === 'file' && (
                <div className="upload-area">
                  <div className="upload-icon">📁</div>
                  <h3>Select CSV File</h3>
                  <p>Choose a CSV file to import customer data</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="file-input"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="upload-button"
                  >
                    Choose File
                  </button>
                </div>
              )}

              {/* Google Sheets Import Option */}
              {importMethod === 'googlesheet' && (
                <div className="google-sheets-area">
                  <div className="upload-icon">📊</div>
                  <h3>Import from Google Sheets</h3>
                  <p>Paste your Google Sheets share link below</p>
                  
                  <div className="google-sheet-input-container">
                    <input
                      type="text"
                      value={googleSheetUrl}
                      onChange={(e) => {
                        setGoogleSheetUrl(e.target.value);
                        setGoogleSheetError(null);
                      }}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="google-sheet-input"
                    />
                    <button
                      onClick={fetchGoogleSheetData}
                      disabled={!googleSheetUrl.trim() || loadingGoogleSheet}
                      className="primary-button"
                    >
                      {loadingGoogleSheet ? '⏳ Loading...' : '📥 Import Sheet'}
                    </button>
                  </div>

                  {googleSheetError && (
                    <div className="error-message">
                      ❌ {googleSheetError}
                    </div>
                  )}

                  <div className="google-sheets-instructions">
                    <h4>📝 How to import your Google Sheet data:</h4>
                    <div className="instruction-method highlight-method">
                      <strong>✅ EASIEST: Direct Link Import</strong>
                      <ol>
                        <li>Open your Google Sheet</li>
                        <li>Click <strong>Share</strong> button (top-right)</li>
                        <li>Change to <strong>"Anyone with the link"</strong> can view</li>
                        <li>Click <strong>"Copy link"</strong></li>
                        <li>Paste the link above and click "Import Sheet"</li>
                      </ol>
                      <p className="method-note">✨ We'll automatically extract the data from your Google Sheet!</p>
                    </div>
                    <div className="instruction-divider">OR</div>
                    <div className="instruction-method">
                      <strong>📥 Download as CSV (Always Works)</strong>
                      <ol>
                        <li>Open your Google Sheet</li>
                        <li>Click <strong>File</strong> → <strong>Download</strong> → <strong>Comma Separated Values (.csv)</strong></li>
                        <li>Save the CSV file to your computer</li>
                        <li>Switch to "Upload CSV File" tab above</li>
                        <li>Upload the downloaded file</li>
                      </ol>
                      <p className="method-note">⚠️ Use this if the direct link import doesn't work.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="format-info">
                <h4>Expected Format:</h4>
                <p>Data with columns like: First Name, Last Name, Company, Address, City, State, Zip, Country, Certification</p>
              </div>

              <div className="step-actions">
                <button onClick={() => setStep(1)} className="secondary-button">
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Field Mapping */}
          {step === 3 && (
            <div className="mapping-step">
              <h3>Map CSV Columns to Database Fields</h3>
              <p>Map your CSV columns to the appropriate database fields:</p>
              
              <div className="mapping-table">
                <div className="mapping-header">
                  <div>CSV Column</div>
                  <div>Sample Data</div>
                  <div>Map to Field</div>
                </div>
                
                {headers.map((header, index) => (
                  <div key={index} className="mapping-row">
                    <div className="csv-column">
                      <strong>{header}</strong>
                    </div>
                    <div className="sample-data">
                      {csvData[0]?.[index] || 'N/A'}
                    </div>
                    <div className="field-select">
                      <select
                        value={fieldMapping[index] || ''}
                        onChange={(e) => updateFieldMapping(index, e.target.value)}
                      >
                        <option value="">-- Skip Column --</option>
                        {availableFields.map(field => (
                          <option key={field.key} value={field.key}>
                            {field.label} {field.required ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mapping-actions">
                <button onClick={resetImport} className="secondary-button">
                  Back
                </button>
                <button onClick={startImport} className="primary-button">
                  Import {csvData.length} Records
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Import Progress */}
          {step === 4 && (
            <div className="progress-step">
              <h3>Importing Data...</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p>{Math.round(importProgress)}% Complete</p>
            </div>
          )}

          {/* Step 5: Results */}
          {step === 5 && importResults && (
            <div className="results-step">
              {importResults.success ? (
                <div className="success-results">
                  <div className="success-icon">✅</div>
                  <h3>Import Successful!</h3>
                  <div className="results-stats">
                    <div className="stat">
                      <span className="stat-number">{importResults.imported}</span>
                      <span className="stat-label">Records Imported</span>
                    </div>
                    {importResults.geocoded > 0 && (
                      <div className="stat success">
                        <span className="stat-number">{importResults.geocoded}</span>
                        <span className="stat-label">📍 Geocoded (with coordinates)</span>
                      </div>
                    )}
                    {importResults.errors > 0 && (
                      <div className="stat error">
                        <span className="stat-number">{importResults.errors}</span>
                        <span className="stat-label">Errors</span>
                      </div>
                    )}
                  </div>
                  
                  {importResults.errorDetails && importResults.errorDetails.length > 0 && (
                    <div className="error-details">
                      <h4>Errors:</h4>
                      <ul>
                        {importResults.errorDetails.map((error, index) => (
                          <li key={index}>Row {error.row}: {error.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {importResults.warnings && importResults.warnings.length > 0 && (
                    <div className="warning-details">
                      <h4>⚠️ Warnings:</h4>
                      <ul>
                        {importResults.warnings.map((warning, index) => (
                          <li key={index} style={{color: '#f59e0b'}}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="error-results">
                  <div className="error-icon">❌</div>
                  <h3>Import Failed</h3>
                  <p>{importResults.error}</p>
                </div>
              )}
              
              <div className="results-actions">
                <button onClick={resetImport} className="secondary-button">
                  Import Another File
                </button>
                <button onClick={onClose} className="primary-button">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImport;
