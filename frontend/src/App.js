import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import zipcodes from 'zipcodes';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';
import CustomerManagement from './components/CustomerManagement';
import { apiGetCustomers, apiGetProducts } from './lib/api';

// Geocoding cache to avoid repeated API calls
const geocodeCache = new Map();

// State code -> full name map (50 states + DC) - moved outside component to avoid re-creation
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
};

/**
 * Geocode an address using Nominatim (OpenStreetMap) API
 * Free service with rate limiting (1 request/second recommended)
 */
const geocodeWithNominatim = async (address) => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MapPlot/1.0' // Nominatim requires a user agent
      }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Nominatim geocoding failed:', error);
    return null;
  }
};

/**
 * Geocode US zipcode using Zippopotam.us API
 * Free, no API key required, very reliable for US zipcodes
 */
const geocodeZipcode = async (zipCode, country = 'us') => {
  try {
    // Clean zipcode - remove any non-numeric characters and get first 5 digits
    const cleanZip = zipCode.toString().replace(/\D/g, '').slice(0, 5);
    if (cleanZip.length !== 5) {
      return null;
    }

    const url = `https://api.zippopotam.us/${country}/${cleanZip}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Zippopotam API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        latitude: parseFloat(place.latitude),
        longitude: parseFloat(place.longitude),
        displayName: `${place['place name']}, ${place['state abbreviation']} ${cleanZip}`,
        city: place['place name'],
        state: place['state abbreviation']
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Zippopotam geocoding failed:', error);
    return null;
  }
};

/**
 * Geocode using MapTiler API (requires API key)
 * More reliable and faster than Nominatim
 */
const geocodeWithMapTiler = async (address, apiKey = 'b9c8lYjfkzHCjixZoLqo') => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.maptiler.com/geocoding/${encodedAddress}.json?key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`MapTiler API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return {
        latitude,
        longitude,
        displayName: data.features[0].place_name
      };
    }
    
    return null;
  } catch (error) {
    console.warn('MapTiler geocoding failed:', error);
    return null;
  }
};

/**
 * Geocode an address or zip code with caching and multiple fallback strategies
 * Priority: US Zipcode API > Local Zipcode Library > MapTiler > Nominatim
 * Note: Not currently used in App.js, but kept for future use
 */
// eslint-disable-next-line no-unused-vars
const geocodeAddress = async (address, city = '', state = '', zipCode = '') => {
  // Create a full address string for better geocoding results
  const fullAddress = [address, city, state, zipCode]
    .filter(Boolean)
    .join(', ')
    .trim();
  
  if (!fullAddress && !zipCode) return null;
  
  // Check cache first
  const cacheKey = (zipCode || fullAddress).toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    console.log('✅ Using cached geocode for:', zipCode || fullAddress);
    return geocodeCache.get(cacheKey);
  }
  
  let result = null;
  
  // Strategy 1: If we have a zipcode, try Zippopotam API (most accurate for US zipcodes)
  if (zipCode) {
    result = await geocodeZipcode(zipCode);
    if (result) {
      console.log('✅ Geocoded with Zippopotam API:', zipCode, '→', result.displayName);
      geocodeCache.set(cacheKey, result);
      return result;
    }
  }
  
  // Strategy 2: Try local zipcodes library (fast, offline, but limited coverage)
  if (zipCode) {
    try {
      const zipData = zipcodes.lookup(zipCode);
      if (zipData && zipData.latitude && zipData.longitude) {
        result = {
          latitude: zipData.latitude,
          longitude: zipData.longitude,
          displayName: `${city || zipData.city}, ${state || zipData.state} ${zipCode}`
        };
        console.log('✅ Geocoded with local zipcodes library:', zipCode);
        geocodeCache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('⚠️ Local zipcode lookup failed:', e);
    }
  }
  
  // Strategy 3: Try city/state lookup with local library
  if (!result && city && state) {
    try {
      const cityStateData = zipcodes.lookupByName(city, state);
      if (cityStateData && cityStateData.length > 0) {
        result = {
          latitude: cityStateData[0].latitude,
          longitude: cityStateData[0].longitude,
          displayName: `${city}, ${state}`
        };
        console.log('✅ Geocoded with city/state lookup:', `${city}, ${state}`);
        geocodeCache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('⚠️ City/state lookup failed:', e);
    }
  }
  
  // Strategy 4: Try MapTiler API (reliable, requires API key)
  if (!result && fullAddress) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to avoid rate limiting
    result = await geocodeWithMapTiler(fullAddress);
    if (result) {
      console.log('✅ Geocoded with MapTiler:', fullAddress);
      geocodeCache.set(cacheKey, result);
      return result;
    }
  }
  
  // Strategy 5: Fallback to Nominatim (free but slower)
  if (!result && fullAddress) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Respect Nominatim rate limit
    result = await geocodeWithNominatim(fullAddress);
    if (result) {
      console.log('✅ Geocoded with Nominatim:', fullAddress);
      geocodeCache.set(cacheKey, result);
      return result;
    }
  }
  
  // If still no result, log warning
  if (!result) {
    console.warn('❌ Could not geocode:', { address, city, state, zipCode });
  }
  
  return result;
};

function App() {
  const navigate = useNavigate();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const clusterIndex = useRef(null);
  // Separate cluster indexes for each product type (currently unused)
  // const clusterIndexAudioSight = useRef(null);
  // const clusterIndexSATE = useRef(null);
  // const clusterIndexOther = useRef(null);
  const listenerAttached = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapZoom, setMapZoom] = useState(3);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Collapsible filter panel
  const [panelOpen, setPanelOpen] = useState(true);
  
  // Analytics tab state
  const [activeTab, setActiveTab] = useState('map'); // 'map' or 'analytics'
  
  // AI Insights state
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  
  // Customer Management state
  const [showCustomerManagement, setShowCustomerManagement] = useState(false);

  // ------- Filters state -------
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [statuses, setStatuses] = useState(new Set()); // lead/prospect/customer
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [zipQuery, setZipQuery] = useState(''); // <-- NEW: zip code filter

  // Refs to keep scroll position of multi-selects
  const stateSelectRef = useRef(null);
  const productSelectRef = useRef(null);

  // Fetch sites data from Supabase
  // Function to fetch and refresh sites data
  const fetchSites = async () => {
    try {
      setLoading(true);
      
      // Fetch ALL customer data from Supabase (not just sites)
      const sitesData = await apiGetCustomers().catch(() => []);
      
      console.log('Fetched sites data:', sitesData.length, 'total customers');
      
      // Convert data to consistent format for the map
      // Note: Geocoding happens during CSV import, not here!
      const convertedSites = sitesData.map(site => {
        const latitude = site.latitude;
        const longitude = site.longitude;
        
        // Log warning for sites without coordinates (but don't geocode them here)
        if (!latitude || !longitude) {
          console.warn('⚠️ Site missing coordinates (will not appear on map):', {
            id: site.id,
            name: site.name || site.company,
            city: site.city,
            state: site.state,
            zip: site.postal_code,
            products: site.products_interested
          });
        }
        
        // Log AudioSight customers specifically for debugging
        if (site.products_interested && Array.isArray(site.products_interested) && 
            site.products_interested.some(p => p.toLowerCase() === 'audiosight')) {
          console.log('🔴 AudioSight customer:', {
            name: site.name || site.company,
            city: site.city,
            state: site.state,
            coords: [latitude, longitude]
          });
        }
        
        return {
          id: site.id,
          customer_id: site.claimed_by || site.id,
          name: site.name || site.company || 'Unknown Customer',
          address: site.address || 'Unknown Address',
          city: site.city || 'Unknown',
          state: site.state || 'XX',
          zip_code: site.postal_code || '00000',
          latitude: latitude,
          longitude: longitude,
          'product(s)_interested': site.products_interested || ['Unknown'],
          registered_at: site.registered_at || site.created_at ? 
            (site.registered_at || site.created_at).split('T')[0] : 
            new Date().toISOString().split('T')[0],
          status: site.status || 'new',
          customer_type: site.customer_type || 'customer',
          source_system: site.source_system || 'unknown'
        };
      });
      
      const sitesWithCoords = convertedSites.filter(s => s.latitude && s.longitude).length;
      console.log(`✅ Loaded ${convertedSites.length} sites (${sitesWithCoords} with coordinates)`);
      
      setSites(convertedSites);
      setError(null);
    } catch (err) {
      console.error('Error fetching sites:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to load available products from Supabase
  const loadProducts = async () => {
    try {
      const products = await apiGetProducts();
      console.log('✅ Loaded products from database:', products);
      setAvailableProducts(products);
      
      // Log color assignments for debugging
      products.forEach(p => {
        const productLower = p.name.toLowerCase();
        const colorMap = {
          'audiosight': '#ef4444', // RED
          'sate': '#3b82f6',       // BLUE
          'armrehab': '#10b981',   // GREEN
        };
        console.log(`  → ${p.name}: ${colorMap[productLower] || 'default'}`);
      });
    } catch (error) {
      console.error('Failed to load products:', error);
      // Fallback to default products if loading fails (match database casing)
      const fallbackProducts = [
        { id: 'audiosight', name: 'AudioSight', description: 'Audio and hearing assessment technology' },
        { id: 'sate', name: 'SATE', description: 'Speech and auditory training equipment' }
      ];
      console.log('⚠️ Using fallback products:', fallbackProducts);
      setAvailableProducts(fallbackProducts);
    }
  };

  // Function to parse and render markdown with beautiful styling
  const renderMarkdown = (text) => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements = [];
    let key = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines
      if (line.trim() === '') {
        elements.push(<div key={key++} style={{ height: 12 }} />);
        i++;
        continue;
      }

      // Tables (detect by pipes and separator line)
      if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].match(/^[\s|:-]+$/)) {
        const tableLines = [line];
        let j = i + 1;
        
        // Collect all table lines
        while (j < lines.length && lines[j].includes('|')) {
          tableLines.push(lines[j]);
          j++;
        }
        
        // Parse header
        const headers = line.split('|').map(h => h.trim()).filter(h => h);
        
        // Parse rows (skip separator line at index 1)
        const rows = [];
        for (let k = 2; k < tableLines.length; k++) {
          const cells = tableLines[k].split('|').map(c => c.trim()).filter(c => c);
          if (cells.length > 0) {
            rows.push(cells);
          }
        }
        
        elements.push(
          <div key={key++} style={{
            overflowX: 'auto',
            margin: '20px 0',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14
            }}>
              <thead>
                <tr style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                }}>
                  {headers.map((header, idx) => (
                    <th key={idx} style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#ffffff',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderRight: idx < headers.length - 1 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none'
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} style={{
                    background: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    {row.map((cell, cellIdx) => {
                      // Format cell content with inline markdown
                      const formatted = cell
                        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #1e40af; font-weight: 700;">$1</strong>')
                        .replace(/`([^`]+)`/g, '<code style="background: #eff6ff; padding: 2px 5px; border-radius: 3px; font-size: 12px; color: #1e40af; font-family: monospace;">$1</code>');
                      
                      return (
                        <td key={cellIdx} style={{
                          padding: '12px 16px',
                          color: '#374151',
                          lineHeight: 1.6,
                          borderRight: cellIdx < row.length - 1 ? '1px solid #f3f4f6' : 'none',
                          verticalAlign: 'top'
                        }}
                        dangerouslySetInnerHTML={{ __html: formatted }}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
        i = j;
        continue;
      }

      // Headers with ### (Subsections)
      if (line.startsWith('###')) {
        const text = line.replace(/^###\s*/, '').replace(/^\d+\.\s*/, '');
        const number = line.match(/^###\s*(\d+)\./)?.[1];
        
        elements.push(
          <div key={key++} style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            padding: '14px 20px',
            borderRadius: 8,
            marginTop: 24,
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
          }}>
            <h4 style={{ 
              fontSize: 16, 
              fontWeight: 700, 
              color: '#ffffff',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              {number && (
                <span style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 700
                }}>
                  {number}
                </span>
              )}
              {text}
            </h4>
          </div>
        );
        i++;
        continue;
      }

      // Headers with ## (Main sections)
      if (line.startsWith('##')) {
        const text = line.replace(/^##\s*/, '');
        elements.push(
          <div key={key++} style={{
            marginTop: 32,
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: '3px solid #3b82f6'
          }}>
            <h3 style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: '#111827',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <span style={{
                width: 6,
                height: 28,
                background: 'linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)',
                borderRadius: 3
              }}></span>
              {text}
            </h3>
          </div>
        );
        i++;
        continue;
      }

      // Bullet points (- or * at start)
      if (line.trim().match(/^[-*]\s/)) {
        const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
        const isNested = indent >= 2;
        const content = line.trim().replace(/^[-*]\s*/, '');
        const formatted = content
          .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #1e40af; font-weight: 700;">$1</strong>')
          .replace(/`([^`]+)`/g, '<code style="background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #1e40af; font-family: monospace;">$1</code>');
        
        elements.push(
          <div key={key++} style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: 12, 
            marginBottom: 10,
            marginLeft: isNested ? 32 : 0,
            padding: '10px 14px',
            background: isNested ? '#f9fafb' : '#ffffff',
            borderLeft: `3px solid ${isNested ? '#93c5fd' : '#3b82f6'}`,
            borderRadius: 6,
            transition: 'all 0.2s'
          }}>
            <span style={{ 
              background: isNested ? '#93c5fd' : '#3b82f6',
              width: 20,
              height: 20,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700
            }}>✓</span>
            <span 
              style={{ flex: 1, color: '#374151', lineHeight: 1.7, fontSize: 14 }}
              dangerouslySetInnerHTML={{ __html: formatted }}
            />
          </div>
        );
        i++;
        continue;
      }

      // Numbered lists
      if (line.trim().match(/^\d+\.\s/)) {
        const number = line.trim().match(/^(\d+)\./)?.[1];
        const content = line.trim().replace(/^\d+\.\s*/, '');
        const formatted = content
          .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #1e40af; font-weight: 700;">$1</strong>')
          .replace(/`([^`]+)`/g, '<code style="background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #1e40af; font-family: monospace;">$1</code>');
        
        elements.push(
          <div key={key++} style={{ 
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            marginBottom: 14,
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)'
            }}>
              {number}
            </span>
            <span 
              style={{ flex: 1, color: '#374151', lineHeight: 1.7, fontSize: 14 }}
              dangerouslySetInnerHTML={{ __html: formatted }}
            />
          </div>
        );
        i++;
        continue;
      }

      // Bold title lines (**Title Text**)
      if (line.trim().match(/^\*\*[^*]+\*\*$/)) {
        const title = line.trim().replace(/^\*\*|\*\*$/g, '');
        elements.push(
          <div key={key++} style={{
            margin: '20px 0 14px 0',
            padding: '12px 18px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
          }}>
            <h5 style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.03em'
            }}>
              {title}
            </h5>
          </div>
        );
        i++;
        continue;
      }

      // Regular paragraphs with inline formatting
      const formatted = line
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #1e40af; font-weight: 700; background: #eff6ff; padding: 1px 5px; border-radius: 3px;">$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em style="color: #6b7280; font-style: italic;">$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #374151; border: 1px solid #e5e7eb; font-family: monospace;">$1</code>');
      
      elements.push(
        <p 
          key={key++} 
          style={{ 
            margin: '10px 0',
            color: '#4b5563', 
            lineHeight: 1.8,
            fontSize: 14
          }}
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
      i++;
    }

    return elements;
  };

  // Function to generate AI marketing insights using OpenRouter
  const generateAIInsights = async () => {
    if (!sites || sites.length === 0) {
      setAiError('No customer data available for analysis');
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      // Prepare data summary for AI analysis
      const dataSummary = {
        totalCustomers: sites.length,
        statuses: sites.reduce((acc, site) => {
          acc[site.status] = (acc[site.status] || 0) + 1;
          return acc;
        }, {}),
        topStates: Object.entries(
          sites.reduce((acc, site) => {
            acc[site.state] = (acc[site.state] || 0) + 1;
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        products: sites.reduce((acc, site) => {
          const products = normalizeProducts(site['product(s)_interested']);
          products.forEach(p => {
            acc[p] = (acc[p] || 0) + 1;
          });
          return acc;
        }, {}),
        geographicSpread: {
          uniqueStates: new Set(sites.map(s => s.state)).size,
          uniqueCities: new Set(sites.map(s => `${s.city}, ${s.state}`)).size
        },
        timelineData: sites
          .filter(s => s.registered_at)
          .reduce((acc, site) => {
            const month = site.registered_at.substring(0, 7); // YYYY-MM
            acc[month] = (acc[month] || 0) + 1;
            return acc;
          }, {})
      };

      // Call OpenRouter API with Gemini model
      // Get API key from environment variable or use placeholder
      const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY || 'sk-or-v1-YOUR_API_KEY_HERE';
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Customer Atlas CRM'
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b:free',
          messages: [
            {
              role: 'system',
              content: 'You are a marketing analytics expert. Analyze CRM data and provide actionable marketing insights in a structured format. Be concise and data-driven.'
            },
            {
              role: 'user',
              content: `Analyze this CRM data and provide marketing insights:

Data Summary:
- Total Customers: ${dataSummary.totalCustomers}
- Status Breakdown: ${JSON.stringify(dataSummary.statuses)}
- Top 5 States: ${dataSummary.topStates.map(([state, count]) => `${state} (${count})`).join(', ')}
- Products Interest: ${JSON.stringify(dataSummary.products)}
- Geographic Spread: ${dataSummary.geographicSpread.uniqueStates} states, ${dataSummary.geographicSpread.uniqueCities} cities
- Monthly Registration Trend: ${JSON.stringify(dataSummary.timelineData)}

Please provide:
1. Key Insights (3-4 bullet points)
2. Geographic Strategy Recommendations
3. Product Marketing Opportunities
4. Lead Conversion Recommendations
5. Risk Areas to Address

Format your response with clear sections and bullet points.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const insights = data.choices[0]?.message?.content;

      if (insights) {
        setAiInsights(insights);
      } else {
        throw new Error('No insights generated');
      }
    } catch (error) {
      console.error('AI Insights Error:', error);
      setAiError(error.message || 'Failed to generate insights. Please check your API key.');
    } finally {
      setAiLoading(false);
    }
  };

  // Fetch sites data and products on component mount
  useEffect(() => {
    fetchSites();
    loadProducts();
  }, []);

  // Options (derived)
  const stateOptions = useMemo(
    () => Array.from(new Set(sites.map(s => s.state))).sort(),
    [sites]
  );
  const productOptions = useMemo(
    () => availableProducts.map(p => p.name),
    [availableProducts]
  );

  // >>> NEW: make "Select all" button blue when all products are selected
  const allProductsSelected = useMemo(
    () => productOptions.every(p => selectedProducts.includes(p)) && selectedProducts.length > 0,
    [selectedProducts, productOptions]
  );
  // <<<

  // Helpers
  const normalizeProducts = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const maybeArr = JSON.parse(raw);
        return Array.isArray(maybeArr) ? maybeArr : [raw];
      } catch {
        return [raw];
      }
    }
    if (raw != null) return [String(raw)];
    return [];
  };

  // STRICT date parser: allow ONLY "yyyy" or "mm-dd-yyyy"
  const parseFlexibleDate = (str, isEnd) => {
    if (!str || !str.trim()) return null;
    const s = str.trim();

    // yyyy
    if (/^\d{4}$/.test(s)) {
      const y = parseInt(s, 10);
      return isEnd
        ? new Date(y, 11, 31, 23, 59, 59, 999).getTime()
        : new Date(y, 0, 1, 0, 0, 0, 0).getTime();
    }

    // mm-dd-yyyy
    const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const mm = Math.max(1, Math.min(12, parseInt(m[1], 10))) - 1;
      const dd = Math.max(1, Math.min(31, parseInt(m[2], 10)));
      const yy = parseInt(m[3], 10);
      return new Date(yy, mm, dd, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0).getTime();
    }

    // anything else is invalid -> don't apply a date filter
    return null;
  };

  // Helper function to determine product type for coloring
  const getProductType = React.useCallback((productsRaw) => {
    const products = normalizeProducts(productsRaw).map(p => {
      // Normalize product names to match available products (case-insensitive)
      const productName = String(p);
      const matchedProduct = availableProducts.find(ap => 
        ap.name.toLowerCase() === productName.toLowerCase()
      );
      return matchedProduct ? matchedProduct.name : productName;
    });
    
    // Check if we have multiple products from our available list (case-insensitive)
    const matchedProducts = products.filter(p => 
      availableProducts.some(ap => ap.name.toLowerCase() === p.toLowerCase())
    );
    
    if (matchedProducts.length > 1) return 'Multiple Products';
    if (matchedProducts.length === 1) return matchedProducts[0];
    return products.length > 0 ? products[0] : 'Other';
  }, [availableProducts]);

  // Helper function to get color based on product type
  const getProductColor = React.useCallback((productType) => {
    // Special handling for Multiple Products
    if (productType === 'Multiple Products') return '#8b5cf6'; // Purple
    
    // Assign specific colors to known products (case-insensitive)
    const productLower = productType.toLowerCase();
    
    // Map specific products to specific colors
    const productColorMap = {
      'audiosight': '#ef4444', // RED for AudioSight
      'sate': '#3b82f6',       // BLUE for SATE
      'armrehab': '#10b981',   // GREEN for ArmRehab
    };
    
    // Check if we have a specific color mapping
    if (productColorMap[productLower]) {
      console.log(`Assigning color to ${productType}: ${productColorMap[productLower]}`);
      return productColorMap[productLower];
    }
    
    // Fallback: use index-based color assignment for other products
    const colorPalette = [
      '#f59e0b', // Orange
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f97316'  // Orange-red
    ];
    
    const productIndex = availableProducts.findIndex(p => 
      p.name.toLowerCase() === productLower
    );
    if (productIndex >= 0) {
      return colorPalette[productIndex % colorPalette.length];
    }
    
    // Fallback for unknown products
    console.warn('Unknown product type:', productType);
    return '#6b7280'; // Gray
  }, [availableProducts]);

  // Helper function to get size based on status
  const getStatusSize = React.useCallback((status) => {
    switch (status) {
      case 'customer': return 12; // Largest
      case 'prospect': return 10; // Medium
      case 'lead': return 8; // Smallest
      default: return 8;
    }
  }, []);

  // Convert sites data to GeoJSON features (filter out invalid coordinates)
  const toFeatures = React.useCallback((sitesData) => {
    if (!Array.isArray(sitesData)) {
      console.warn('toFeatures received non-array data:', sitesData);
      return [];
    }

    const features = sitesData
      .filter(site => {
        // Only include sites with valid coordinates
        const lat = parseFloat(site.latitude);
        const lng = parseFloat(site.longitude);
        const isValid = !isNaN(lat) && !isNaN(lng) && 
               lat >= -90 && lat <= 90 && 
               lng >= -180 && lng <= 180;
        
        if (!isValid) {
          console.warn('Filtering out site with invalid coordinates:', {
            id: site.id,
            name: site.name,
            lat: site.latitude,
            lng: site.longitude
          });
        }
        
        return isValid;
      })
      .map(site => {
        const productType = getProductType(site["product(s)_interested"]);
        const color = getProductColor(productType);
        const size = getStatusSize(site.status);
        
        // Debug log for AudioSight features
        if (productType.toLowerCase() === 'audiosight') {
          console.log('🔴 Creating AudioSight feature:', {
            name: site.name,
            city: site.city,
            productType,
            color,
            products: site["product(s)_interested"]
          });
        }
        
        const feature = {
          type: "Feature",
          properties: {
            id: site.id,
            customer_id: site.customer_id,
            name: site.name,
            address: site.address,
            city: site.city,
            state: site.state,
            zip_code: site.zip_code,
            "product(s)_interested": site["product(s)_interested"],
            registered_at: site.registered_at,
            status: site.status,
            customer_type: site.customer_type,
            source_system: site.source_system,
            productType: productType,
            color: color,
            size: size
          },
          geometry: {
            type: "Point",
            coordinates: [parseFloat(site.longitude), parseFloat(site.latitude)]
          }
        };

        // Validate the feature structure
        if (!feature.geometry || !feature.geometry.coordinates || 
            feature.geometry.coordinates.length !== 2 ||
            !Number.isFinite(feature.geometry.coordinates[0]) ||
            !Number.isFinite(feature.geometry.coordinates[1])) {
          console.error('Invalid feature created:', feature);
          return null;
        }

        return feature;
      })
      .filter(feature => feature !== null); // Remove any invalid features

    console.log(`Created ${features.length} valid GeoJSON features from ${sitesData.length} sites`);
    return features;
  }, [getProductType, getProductColor, getStatusSize]);

  // Apply filters (show ALL when nothing selected)
  const filteredSites = useMemo(() => {
    if (!sites.length) return [];

    let fromTs = parseFlexibleDate(dateFrom, false);
    let toTs   = parseFlexibleDate(dateTo, true);

    if (fromTs && toTs && fromTs > toTs) {
      const tmp = fromTs; fromTs = toTs; toTs = tmp; // swap if reversed
    }

    // cleaned zip entered (digits only, 5 max)
    const zipClean = (zipQuery || '').replace(/\D/g, '').slice(0, 5);
    const applyZip = zipClean.length === 5;

    const prodSel = new Set(selectedProducts);

    return sites.filter(site => {
      if (selectedStates.length && !selectedStates.includes(site.state)) return false;

      if (statuses.size && !statuses.has(site.status)) return false;

      if (fromTs || toTs) {
        const ts = site.registered_at ? Date.parse(site.registered_at) : NaN;
        if (!Number.isFinite(ts)) return false;
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }

      if (applyZip) {
        const z = String(site.zip_code ?? '');
        // normalize to 5-digit string for comparison
        const z5 = z.padStart(5, '0').slice(-5);
        if (z5 !== zipClean) return false;
      }

      // --- Product filter (checkboxes: match ANY selected product) ---
      if (prodSel.size) {
        const prods = normalizeProducts(site['product(s)_interested']).map(p => String(p));
        // Case-insensitive matching
        const prodsLower = new Set(prods.map(p => p.toLowerCase()));
        const selLower = Array.from(prodSel).map(p => p.toLowerCase());
        const hasAny = selLower.some(sel => prodsLower.has(sel));
        if (!hasAny) return false;
      }

      return true;
    });
  }, [sites, selectedStates, selectedProducts, statuses, dateFrom, dateTo, zipQuery]);

  // Keep a memoized FeatureCollection for filtered sites
  const filteredFeatures = useMemo(() => toFeatures(filteredSites), [filteredSites, toFeatures]);

  // Setup map once
  useEffect(() => {
    if (map.current || loading || sites.length === 0) return;

    console.log('🗺️ Initializing map with', sites.length, 'sites');

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          sources: {
            'carto-light': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors © CARTO',
              maxzoom: 19
            }
          },
          layers: [{
            id: 'carto-light-layer',
            type: 'raster',
            source: 'carto-light',
            minzoom: 0,
            maxzoom: 19
          }]
        },
        center: [-98.5, 39.8],
        zoom: 3
      });

      console.log('✅ Map instance created');

      // Add error handler to suppress non-critical tile errors
      map.current.on('error', (e) => {
        // Only log non-tile errors (tile errors are usually just 404s for tiles outside view)
        if (e && !e.tile) {
          console.warn('Map error (non-tile):', e.error?.message || e);
        }
        // Silently ignore tile loading errors - they don't affect functionality
      });
    } catch (error) {
      console.error('❌ Failed to initialize map:', error);
      return;
    }

    map.current.on('move', () => {
      if (map.current) setMapZoom(map.current.getZoom());
    });

    map.current.on("load", () => {
      setMapReady(true);

      // Create 3 separate sources for each product type
      // Source 1: SATE (Blue clusters)
      map.current.addSource("favorites-sate", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 25,
        clusterMaxZoom: 16
      });

      // Source 2: AudioSight (Red clusters)
      map.current.addSource("favorites-audiosight", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 25,
        clusterMaxZoom: 16
      });

      // Source 3: Other products (default color clusters)
      map.current.addSource("favorites-other", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 25,
        clusterMaxZoom: 16
      });

      // === SATE BLUE CLUSTERS ===
      map.current.addLayer({
        id: "clusters-sate",
        type: "circle",
        source: "favorites-sate",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,     "#dbeafe",  // Very light blue
            5,     "#93c5fd",  // Light blue
            10,    "#60a5fa",  // Medium light blue
            25,    "#3b82f6",  // Blue (SATE color)
            50,    "#2563eb",  // Medium dark blue
            100,   "#1d4ed8",  // Dark blue
            200,   "#1e40af"   // Very dark blue
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,   15,
            10,  20,
            50,  25,
            100, 30
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.85
        }
      });

      map.current.addLayer({
        id: "cluster-count-sate",
        type: "symbol",
        source: "favorites-sate",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
          "text-font": ["Noto Sans Regular"]
        },
        paint: {
          "text-color": "#ffffff"
        }
      });

      // === AUDIOSIGHT RED CLUSTERS ===
      map.current.addLayer({
        id: "clusters-audiosight",
        type: "circle",
        source: "favorites-audiosight",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,     "#fee2e2",  // Very light red
            5,     "#fca5a5",  // Light red
            10,    "#f87171",  // Medium light red
            25,    "#ef4444",  // Red (AudioSight color)
            50,    "#dc2626",  // Medium dark red
            100,   "#b91c1c",  // Dark red
            200,   "#991b1b"   // Very dark red
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,   15,
            10,  20,
            50,  25,
            100, 30
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.9
        }
      });

      map.current.addLayer({
        id: "cluster-count-audiosight",
        type: "symbol",
        source: "favorites-audiosight",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
          "text-font": ["Noto Sans Regular"]
        },
        paint: {
          "text-color": "#ffffff"
        }
      });

      // === OTHER PRODUCTS CLUSTERS (Green/other colors) ===
      map.current.addLayer({
        id: "clusters-other",
        type: "circle",
        source: "favorites-other",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,     "#d1fae5",  // Very light green
            5,     "#6ee7b7",  // Light green
            10,    "#34d399",  // Medium light green
            25,    "#10b981",  // Green
            50,    "#059669",  // Medium dark green
            100,   "#047857",  // Dark green
            200,   "#065f46"   // Very dark green
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,   15,
            10,  20,
            50,  25,
            100, 30
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.85
        }
      });

      map.current.addLayer({
        id: "cluster-count-other",
        type: "symbol",
        source: "favorites-other",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
          "text-font": ["Noto Sans Regular"]
        },
        paint: {
          "text-color": "#ffffff"
        }
      });

      // Individual point layers for each product type
      // SATE blue points
      map.current.addLayer({
        id: "points-sate",
        type: "circle",
        source: "favorites-sate",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#3b82f6",
          "circle-radius": ["get", "size"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.9
        }
      });

      // AudioSight red points (render on top, larger)
      map.current.addLayer({
        id: "points-audiosight",
        type: "circle",
        source: "favorites-audiosight",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": ["+", ["get", "size"], 2],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2.5,
          "circle-opacity": 1
        }
      });

      // Other products points
      map.current.addLayer({
        id: "points-other",
        type: "circle",
        source: "favorites-other",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "size"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5
        }
      });

      const popup = new maplibregl.Popup({ 
        closeButton: false, 
        closeOnClick: false,
        maxWidth: '500px',
        className: 'cluster-popup'
      });

      // Cluster click handlers for each product type
      const handleClusterClick = (e, layerId, sourceName) => {
        const features = map.current.queryRenderedFeatures(e.point, { layers: [layerId] });
        if (!features || !features.length) return;
        const clId = features[0]?.properties?.cluster_id;
        if (clId == null) return;
        
        const [lng, lat] = features[0].geometry.coordinates;
        const source = map.current.getSource(sourceName);
        
        // Get cluster expansion zoom
        source.getClusterExpansionZoom(clId, (err, zoom) => {
          if (err) return;
          map.current.easeTo({
            center: [lng, lat],
            zoom: zoom
          });
        });
      };

      // Attach cluster click handlers
      map.current.on("click", "clusters-sate", (e) => handleClusterClick(e, "clusters-sate", "favorites-sate"));
      map.current.on("click", "clusters-audiosight", (e) => handleClusterClick(e, "clusters-audiosight", "favorites-audiosight"));
      map.current.on("click", "clusters-other", (e) => handleClusterClick(e, "clusters-other", "favorites-other"));

      // Old cluster handler for backward compatibility (not used anymore)
      map.current.on("click", "clusters", (e) => {
        if (!clusterIndex.current) return;
        const features = map.current.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        if (!features || !features.length) return;
        const clId = features[0]?.properties?.cluster_id;
        if (clId == null) return;
        
        // Get the sites in this cluster
        const clusterSites = clusterIndex.current.getLeaves(clId, Infinity);
        const [lng, lat] = features[0].geometry.coordinates;
        
        // Create table HTML for cluster sites
        const tableRows = clusterSites.map((site, idx) => {
          const props = site.properties;
          const productType = props.productType || 'Unknown';
          const statusColor = props.status === 'customer' ? '#10b981' : 
                             props.status === 'prospect' ? '#f59e0b' : '#6b7280';
          
          return `
            <tr style="border-bottom: 1px solid #f3f4f6; transition: background-color 0.2s;"
                onmouseover="this.style.backgroundColor='#f8fafc'"
                onmouseout="this.style.backgroundColor='transparent'">
              <td style="padding: 12px 6px; font-weight: 600; font-size: 12px; color: #6b7280;">${idx + 1}</td>
              <td style="padding: 12px 8px; font-size: 12px;">
                <div style="font-weight: 600; color: #1f2937; margin-bottom: 2px;">${props.address}</div>
                <div style="color: #6b7280; font-size: 10px;">${props.city}, ${props.state}</div>
              </td>
              <td style="padding: 12px 6px; font-size: 11px;">
                <span style="background: ${props.color}; color: white; padding: 3px 8px; border-radius: 12px; font-weight: 600; font-size: 10px; white-space: nowrap;">
                  ${productType}
                </span>
              </td>
              <td style="padding: 12px 6px; font-size: 11px;">
                <span style="color: ${statusColor}; font-weight: 600; font-size: 11px;">
                  ${(props.status || 'Unknown').charAt(0).toUpperCase() + (props.status || 'Unknown').slice(1)}
                </span>
              </td>
              <td style="padding: 12px 6px; font-size: 10px; color: #6b7280;">
                ${props.registered_at ? new Date(props.registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'N/A'}
              </td>
            </tr>
          `;
        }).join('');

          const popupContent = `
           <div style="font-family: system-ui, sans-serif; max-width: 500px; padding: 16px;">
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
               <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1f2937;">
                 Cluster Details
               </h3>
               <div style="display: flex; align-items: center; gap: 8px;">
                 <span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">
                   ${clusterSites.length} sites
                 </span>
                 <button onclick="this.closest('.maplibregl-popup').remove()" 
                         style="background: #f3f4f6; border: none; font-size: 16px; cursor: pointer; color: #6b7280; padding: 4px 8px; border-radius: 6px; line-height: 1; transition: background 0.2s;"
                         onmouseover="this.style.background='#e5e7eb'"
                         onmouseout="this.style.background='#f3f4f6'">
                   ✕
                 </button>
               </div>
             </div>
             <div style="max-height: 320px; overflow-y: auto; margin: -4px; padding: 4px;">
               <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                 <thead style="position: sticky; top: 0; z-index: 1;">
                   <tr style="background: #f8fafc; border-bottom: 2px solid #e5e7eb;">
                     <th style="padding: 10px 6px; text-align: left; font-weight: 600; color: #374151; font-size: 11px;">#</th>
                     <th style="padding: 10px 8px; text-align: left; font-weight: 600; color: #374151; font-size: 11px;">Location</th>
                     <th style="padding: 10px 6px; text-align: left; font-weight: 600; color: #374151; font-size: 11px;">Product</th>
                     <th style="padding: 10px 6px; text-align: left; font-weight: 600; color: #374151; font-size: 11px;">Status</th>
                     <th style="padding: 10px 6px; text-align: left; font-weight: 600; color: #374151; font-size: 11px;">Date</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${tableRows}
                 </tbody>
               </table>
             </div>
             <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
               <div style="font-size: 11px; color: #6b7280; flex: 1;">
                 Click individual markers for detailed info
               </div>
               <button onclick="
                 const map = window.mapInstance;
                 if (map) {
                   const expansionZoom = ${clusterIndex.current.getClusterExpansionZoom(clId)};
                   map.easeTo({
                     center: [${lng}, ${lat}],
                     zoom: expansionZoom
                   });
                   this.closest('.maplibregl-popup').remove();
                 }
               " style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; transition: background 0.2s;"
                  onmouseover="this.style.background='#2563eb'"
                  onmouseout="this.style.background='#3b82f6'">
                 Zoom In
               </button>
             </div>
           </div>
         `;

        // Store map reference globally for the zoom button
        window.mapInstance = map.current;

        popup.setLngLat([lng, lat])
             .setHTML(popupContent)
             .addTo(map.current);
      });

      // Click handler for all point layers
      const handlePointClick = (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const { address, city, state, zip_code, customer_id } = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;

        const productsInterestedRaw = feature.properties['product(s)_interested'];
        const registered_at = feature.properties.registered_at;
        const status = feature.properties.status;

        let productsArr;
        if (Array.isArray(productsInterestedRaw)) {
          productsArr = productsInterestedRaw;
        } else if (typeof productsInterestedRaw === 'string') {
          try {
            productsArr = productsInterestedRaw.trim().startsWith('[')
              ? JSON.parse(productsInterestedRaw)
              : [productsInterestedRaw];
          } catch {
            productsArr = [productsInterestedRaw];
          }
        } else if (productsInterestedRaw != null) {
          productsArr = [String(productsInterestedRaw)];
        } else {
          productsArr = [];
        }

        const productText = productsArr
          .map(p => String(p))
          .join(', ');

        const productType = feature.properties.productType;
        console.log('🔴 Clicked point:', { name: feature.properties.name, productType, color: feature.properties.color });
        const statusColor = status === 'customer' ? '#10b981' : status === 'prospect' ? '#f59e0b' : '#6b7280';
        const statusBgColor = status === 'customer' ? '#d1fae5' : status === 'prospect' ? '#fef3c7' : '#f3f4f6';
        const name = feature.properties.name || 'Customer';
        
        const customerPopupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 400px; min-width: 320px; padding: 20px;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
              <div style="flex: 1; margin-right: 16px;">
                <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">
                  ${name}
                </h3>
                <div style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-bottom: 6px;">
                  ${address}
                </div>
                <div style="font-size: 13px; color: #9ca3af;">
                  ${city}, ${state} ${zip_code}
                </div>
              </div>
              <button onclick="this.closest('.maplibregl-popup').remove()" 
                      style="background: #f3f4f6; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; color: #6b7280; font-size: 18px; line-height: 1; transition: all 0.2s; flex-shrink: 0; display: flex; align-items: center; justify-content: center;"
                      onmouseover="this.style.background='#fee2e2'; this.style.color='#dc2626'"
                      onmouseout="this.style.background='#f3f4f6'; this.style.color='#6b7280'"
                      title="Close">
                ✕
              </button>
            </div>
            
            <!-- Details Grid -->
            <div style="display: grid; gap: 20px;">
              <!-- Customer ID -->
              <div style="background: #f9fafb; padding: 16px 20px; border-radius: 10px; border: 1px solid #e5e7eb;">
                <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                  Customer ID
                </div>
                <div style="font-size: 13px; color: #374151; font-family: 'Monaco', 'Courier New', monospace; word-break: break-all; line-height: 1.5;">
                  ${customer_id}
                </div>
              </div>
              
              <!-- Status and Registration Row -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div style="background: ${statusBgColor}; padding: 16px 20px; border-radius: 10px; border: 1px solid ${statusColor}20;">
                  <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                    Status
                  </div>
                  <div style="font-size: 15px; color: ${statusColor}; font-weight: 700; text-transform: capitalize;">
                    ${status || 'Unknown'}
                  </div>
                </div>
                
                <div style="background: #f9fafb; padding: 16px 20px; border-radius: 10px; border: 1px solid #e5e7eb;">
                  <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                    Registered
                  </div>
                  <div style="font-size: 15px; color: #374151; font-weight: 600;">
                    ${registered_at ? new Date(registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </div>
                </div>
              </div>
              
              <!-- Product Type -->
              <div style="background: #f9fafb; padding: 16px 20px; border-radius: 10px; border: 1px solid #e5e7eb;">
                <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                  Product Type
                </div>
                <div style="display: inline-block; background: ${feature.properties.color}; color: white; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                  ${productType}
                </div>
              </div>
              
              <!-- Products List -->
              <div style="background: #f9fafb; padding: 16px 20px; border-radius: 10px; border: 1px solid #e5e7eb;">
                <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                  Products of Interest
                </div>
                <div style="font-size: 14px; color: #374151; line-height: 1.6;">
                  ${productText || 'None specified'}
                </div>
              </div>
            </div>
          </div>
        `;
        
        popup.setLngLat([lng, lat])
             .setHTML(customerPopupContent)
             .addTo(map.current);
      };

      // Attach click handlers to all point layers
      map.current.on("click", "points-sate", handlePointClick);
      map.current.on("click", "points-audiosight", handlePointClick);
      map.current.on("click", "points-other", handlePointClick);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      listenerAttached.current = false;
    };
  }, [sites, loading]);

  // Update map data - split features by product type into separate sources
  const refreshSafe = useCallback((features) => {
    if (!map.current || !mapReady) return;
    
    // Split features into 3 groups by color/product
    const sateFeatures = features.filter(f => f.properties.color === '#3b82f6'); // Blue - SATE
    const audiosightFeatures = features.filter(f => f.properties.color === '#ef4444'); // Red - AudioSight
    const otherFeatures = features.filter(f => 
      f.properties.color !== '#3b82f6' && f.properties.color !== '#ef4444'
    );

    console.log(`🗺️ Updating map: ${sateFeatures.length} SATE (blue), ${audiosightFeatures.length} AudioSight (red), ${otherFeatures.length} other`);

    try {
      // Update SATE source (blue clusters)
      const srcSATE = map.current.getSource('favorites-sate');
      if (srcSATE) {
        srcSATE.setData({ type: 'FeatureCollection', features: sateFeatures });
      }

      // Update AudioSight source (red clusters)
      const srcAudioSight = map.current.getSource('favorites-audiosight');
      if (srcAudioSight) {
        srcAudioSight.setData({ type: 'FeatureCollection', features: audiosightFeatures });
      }

      // Update Other source (green/other clusters)
      const srcOther = map.current.getSource('favorites-other');
      if (srcOther) {
        srcOther.setData({ type: 'FeatureCollection', features: otherFeatures });
      }
    } catch (e) {
      console.error('❌ Error updating map sources:', e);
    }
  }, [mapReady]);

  // Update map when filtered features change
  useEffect(() => {
    if (!mapReady || !map.current) {
      console.log('⏳ Waiting for map to be ready...');
      return;
    }

    if (!filteredFeatures.length) {
      console.log('📍 No features to display');
      refreshSafe([]);
      return;
    }

    // Validate features
    const validFeatures = filteredFeatures.filter(f => {
      if (!f || !f.geometry || !f.geometry.coordinates) return false;
      const [lng, lat] = f.geometry.coordinates;
      return Number.isFinite(lng) && Number.isFinite(lat) &&
             lng >= -180 && lng <= 180 &&
             lat >= -90 && lat <= 90;
    });

    if (validFeatures.length === 0) {
      console.warn('⚠️ No valid features to display');
      refreshSafe([]);
      return;
    }

    if (validFeatures.length < filteredFeatures.length) {
      console.warn(`⚠️ Filtered out ${filteredFeatures.length - validFeatures.length} invalid features`);
    }

    console.log(`✅ Displaying ${validFeatures.length} valid features on map`);
    
    // Update map with features - clustering is now handled by MapLibre automatically
    refreshSafe(validFeatures);
    
  }, [filteredFeatures, mapReady, refreshSafe]);

  // ------- UI: Filter panel (floats above the map and subtly scales with zoom) -------
  const panelScale = Math.min(1.08, Math.max(0.92, 0.92 + (mapZoom - 3) * 0.04));

  const resetFilters = () => {
    setSelectedStates([]);
    setSelectedProducts([]);
    setStatuses(new Set());
    setDateFrom('');
    setDateTo('');
    setZipQuery('');
  };

  // Toggle helpers that preserve scroll position to avoid jumping to top
  const toggleSelectValue = (refEl, updater, value) => {
    const el = refEl.current;
    const scroll = el ? el.scrollTop : 0;
    updater(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]));
    requestAnimationFrame(() => {
      if (refEl.current) refEl.current.scrollTop = scroll;
    });
  };

  // Select-all handler for products
  const selectAllProducts = () => {
    setSelectedProducts(productOptions);
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!sites.length) return null;

    // City analysis
    const cityStats = {};
    sites.forEach(site => {
      const city = `${site.city}, ${site.state}`;
      if (!cityStats[city]) {
        cityStats[city] = { count: 0, customers: 0, prospects: 0, leads: 0, products: new Set() };
      }
      cityStats[city].count++;
      cityStats[city][site.status]++;
      
      const products = normalizeProducts(site["product(s)_interested"]);
      products.forEach(p => cityStats[city].products.add(p));
    });

    const topCities = Object.entries(cityStats)
      .map(([city, stats]) => ({ city, ...stats, products: Array.from(stats.products) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Product analysis - dynamically create stats for all available products
    const productStats = {};
    // Initialize stats for all available products
    availableProducts.forEach(product => {
      productStats[product.name] = 0;
    });
    // Add "Multiple Products" if we have multiple products
    if (availableProducts.length >= 2) {
      productStats['Multiple Products'] = 0;
    }
    
    sites.forEach(site => {
      const productType = getProductType(site["product(s)_interested"]);
      if (productStats.hasOwnProperty(productType)) {
        productStats[productType]++;
      }
    });

    // Status analysis
    const statusStats = { customer: 0, prospect: 0, lead: 0 };
    sites.forEach(site => {
      if (statusStats.hasOwnProperty(site.status)) {
        statusStats[site.status]++;
      }
    });

    // State analysis
    const stateStats = {};
    sites.forEach(site => {
      if (!stateStats[site.state]) {
        stateStats[site.state] = { count: 0, customers: 0, prospects: 0, leads: 0 };
      }
      stateStats[site.state].count++;
      stateStats[site.state][site.status]++;
    });

    const topStates = Object.entries(stateStats)
      .map(([state, stats]) => ({ state: `${state} - ${STATE_NAMES[state]}`, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Registration timeline
    const registrationByMonth = {};
    sites.forEach(site => {
      if (site.registered_at) {
        const date = new Date(site.registered_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!registrationByMonth[monthKey]) {
          registrationByMonth[monthKey] = 0;
        }
        registrationByMonth[monthKey]++;
      }
    });

    const timelineData = Object.entries(registrationByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12); // Last 12 months

    return {
      topCities,
      productStats,
      statusStats,
      topStates,
      timelineData,
      totalSites: sites.length
    };
  }, [sites, availableProducts, getProductType]);

  if (loading) {
    return (
      <div className="App">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px'
        }}>
          Loading sites data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: 'red'
        }}>
          Error loading sites: {error}
        </div>
      </div>
    );
  }

  // Analytics component
  const AnalyticsPanel = () => {
    if (!analytics) return <div>Loading analytics...</div>;

    // Calculate conversion rate
    const conversionRate = analytics.totalSites > 0 
      ? ((analytics.statusStats.customer / analytics.totalSites) * 100).toFixed(1)
      : '0.0';

    return (
      <div style={{ 
        padding: '32px', 
        maxHeight: 'calc(100vh - 70px)', 
        overflow: 'auto',
        background: '#f9fafb'
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: 28, 
            fontWeight: 700, 
            color: '#111827',
            marginBottom: 8
          }}>
            Analytics Dashboard
          </h2>
          <p style={{ 
            margin: 0, 
            fontSize: 14, 
            color: '#6b7280' 
          }}>
            Comprehensive overview of customer data and insights
          </p>
        </div>

        {/* KPI Cards - No gradients, solid white with borders */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: 20, 
          marginBottom: 32 
        }}>
          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              color: '#6b7280', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12
            }}>
              Total Sites
            </div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700, 
              color: '#111827',
              marginBottom: 8
            }}>
              {analytics.totalSites}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: '#3b82f6',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              All tracked locations
            </div>
          </div>
          
          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #10b981',
            boxShadow: '0 1px 3px rgba(16,185,129,0.1)'
          }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              color: '#6b7280', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12
            }}>
              Customers
            </div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700, 
              color: '#10b981',
              marginBottom: 8
            }}>
              {analytics.statusStats.customer}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: '#6b7280',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Active paying customers
            </div>
          </div>

          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #f59e0b',
            boxShadow: '0 1px 3px rgba(245,158,11,0.1)'
          }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              color: '#6b7280', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12
            }}>
              Prospects
            </div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700, 
              color: '#f59e0b',
              marginBottom: 8
            }}>
              {analytics.statusStats.prospect}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: '#6b7280',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
              High-potential leads
            </div>
          </div>

          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              color: '#6b7280', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12
            }}>
              Conversion Rate
            </div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700, 
              color: '#8b5cf6',
              marginBottom: 8
            }}>
              {conversionRate}%
            </div>
            <div style={{ 
              fontSize: 12, 
              color: '#6b7280',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
              Leads to customers
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Product Distribution Chart */}
          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 20
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 18, 
                fontWeight: 700,
                color: '#111827'
              }}>
                Product Distribution
              </h3>
              <span style={{ 
                fontSize: 12, 
                color: '#6b7280',
                background: '#f3f4f6',
                padding: '4px 8px',
                borderRadius: 6,
                fontWeight: 600
              }}>
                {Object.keys(analytics.productStats).length} Products
              </span>
            </div>
            
            <div style={{ display: 'grid', gap: 16 }}>
              {Object.entries(analytics.productStats)
                .sort(([, a], [, b]) => b - a)
                .map(([product, count]) => {
                const percentage = ((count / analytics.totalSites) * 100).toFixed(1);
                const color = getProductColor(product);
                return (
                  <div key={product}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: 8,
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ 
                          width: 14, 
                          height: 14, 
                          borderRadius: 4, 
                          background: color,
                          border: '2px solid #fff',
                          boxShadow: '0 0 0 1px #e5e7eb'
                        }}></div>
                        <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                          {product}
                        </span>
                      </div>
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: 14,
                        color: '#6b7280'
                      }}>
                        {count} <span style={{ fontWeight: 500, fontSize: 12 }}>({percentage}%)</span>
                      </span>
                    </div>
                    <div style={{ 
                      background: '#f3f4f6', 
                      height: 8, 
                      borderRadius: 6, 
                      overflow: 'hidden',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ 
                        background: color, 
                        height: '100%', 
                        width: `${percentage}%`,
                        transition: 'width 0.5s ease',
                        boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.1)`
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Breakdown Chart */}
          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 20
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 18, 
                fontWeight: 700,
                color: '#111827'
              }}>
                Status Breakdown
              </h3>
              <span style={{ 
                fontSize: 12, 
                color: '#6b7280',
                background: '#f3f4f6',
                padding: '4px 8px',
                borderRadius: 6,
                fontWeight: 600
              }}>
                Pipeline View
              </span>
            </div>

            {/* Status visualization */}
            <div style={{ display: 'grid', gap: 20 }}>
              {[
                { 
                  status: 'customer', 
                  count: analytics.statusStats.customer, 
                  color: '#10b981', 
                  icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                },
                { 
                  status: 'prospect', 
                  count: analytics.statusStats.prospect, 
                  color: '#f59e0b', 
                  icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                },
                { 
                  status: 'lead', 
                  count: analytics.statusStats.lead, 
                  color: '#6b7280', 
                  icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                }
              ].map(({ status, count, color, icon }) => {
                const percentage = ((count / analytics.totalSites) * 100).toFixed(1);
                return (
                  <div key={status} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 16,
                    padding: 16,
                    background: '#f9fafb',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: 12,
                      background: color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: 13, 
                        fontWeight: 600, 
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 4
                      }}>
                        {status}
                      </div>
                      <div style={{ 
                        fontSize: 24, 
                        fontWeight: 700, 
                        color: '#111827' 
                      }}>
                        {count}
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: 20, 
                      fontWeight: 700, 
                      color: color 
                    }}>
                      {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Registration Timeline - Full Width */}
        <div style={{ 
          background: '#fff', 
          padding: 24, 
          borderRadius: 12, 
          border: '2px solid #e5e7eb',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 24
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: 18, 
              fontWeight: 700,
              color: '#111827'
            }}>
              Registration Timeline
            </h3>
            <span style={{ 
              fontSize: 12, 
              color: '#6b7280',
              background: '#f3f4f6',
              padding: '4px 8px',
              borderRadius: 6,
              fontWeight: 600
            }}>
              Last 12 Months
            </span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-end', 
            gap: 8, 
            height: 180,
            padding: '0 8px'
          }}>
            {analytics.timelineData.map(([month, count]) => {
              const maxCount = Math.max(...analytics.timelineData.map(([, c]) => c));
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={month} style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: 8,
                  minWidth: 0
                }}>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: '#111827',
                    background: '#f3f4f6',
                    padding: '2px 6px',
                    borderRadius: 4,
                    minWidth: 24,
                    textAlign: 'center'
                  }}>
                    {count}
                  </div>
                  <div style={{ 
                    background: '#3b82f6', 
                    width: '100%', 
                    height: `${height}%`, 
                    minHeight: '4px', 
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease',
                    boxShadow: '0 -2px 8px rgba(59,130,246,0.3)',
                    position: 'relative'
                  }}>
                    {/* Highlight top of bar */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: 'rgba(255,255,255,0.5)',
                      borderRadius: '4px 4px 0 0'
                    }}></div>
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: '#6b7280', 
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                    textAlign: 'center'
                  }}>
                    {month.split('-')[1]}/{month.split('-')[0].slice(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Row: Top Cities and Top States */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Top Cities */}
          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 20
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 18, 
                fontWeight: 700,
                color: '#111827'
              }}>
                Top Cities
              </h3>
              <span style={{ 
                fontSize: 12, 
                color: '#6b7280',
                background: '#f3f4f6',
                padding: '4px 8px',
                borderRadius: 6,
                fontWeight: 600
              }}>
                Top 10
              </span>
            </div>
            
            <div style={{ display: 'grid', gap: 0 }}>
              {analytics.topCities.map((city, idx) => (
                <div 
                  key={city.city} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 8px', 
                    borderBottom: idx < analytics.topCities.length - 1 ? '1px solid #f3f4f6' : 'none',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 8,
                      background: idx < 3 ? '#3b82f6' : '#e5e7eb',
                      color: idx < 3 ? '#fff' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                        {city.city}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {city.customers}C · {city.prospects}P · {city.leads}L
                      </div>
                    </div>
                  </div>
                  <div style={{ 
                    fontWeight: 700, 
                    color: '#3b82f6',
                    fontSize: 16
                  }}>
                    {city.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top States */}
          <div style={{ 
            background: '#fff', 
            padding: 24, 
            borderRadius: 12, 
            border: '2px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 20
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: 18, 
                fontWeight: 700,
                color: '#111827'
              }}>
                Top States
              </h3>
              <span style={{ 
                fontSize: 12, 
                color: '#6b7280',
                background: '#f3f4f6',
                padding: '4px 8px',
                borderRadius: 6,
                fontWeight: 600
              }}>
                Top 10
              </span>
            </div>
            
            <div style={{ display: 'grid', gap: 0 }}>
              {analytics.topStates.map((state, idx) => (
                <div 
                  key={state.state} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px 8px', 
                    borderBottom: idx < analytics.topStates.length - 1 ? '1px solid #f3f4f6' : 'none',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                      width: 28, 
                      height: 28, 
                      borderRadius: 8,
                      background: idx < 3 ? '#10b981' : '#e5e7eb',
                      color: idx < 3 ? '#fff' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                        {state.state}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        {state.customers}C · {state.prospects}P · {state.leads}L
                      </div>
                    </div>
                  </div>
                  <div style={{ 
                    fontWeight: 700, 
                    color: '#10b981',
                    fontSize: 16
                  }}>
                    {state.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Marketing Insights Section - Full Width */}
        <div style={{ 
          background: '#fff', 
          padding: 24, 
          borderRadius: 12, 
          marginTop: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          border: '2px solid #e5e7eb'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 20
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: 18, 
              fontWeight: 700,
              color: '#111827'
            }}>
              🤖 AI Marketing Insights
            </h3>
            <button
              onClick={generateAIInsights}
              disabled={aiLoading}
              style={{
                padding: '10px 20px',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                background: aiLoading ? '#f3f4f6' : '#3b82f6',
                color: aiLoading ? '#6b7280' : '#ffffff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: aiLoading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseOver={(e) => {
                if (!aiLoading) {
                  e.currentTarget.style.background = '#2563eb';
                }
              }}
              onMouseOut={(e) => {
                if (!aiLoading) {
                  e.currentTarget.style.background = '#3b82f6';
                }
              }}
            >
              {aiLoading ? (
                <>
                  <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                  Generate Insights
                </>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div style={{
            background: '#f9fafb',
            borderRadius: 8,
            padding: 24,
            minHeight: 300,
            border: '1px solid #e5e7eb'
          }}>
            {aiLoading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 300,
                gap: 16
              }}>
                <div style={{
                  width: 60,
                  height: 60,
                  border: '4px solid #f3f4f6',
                  borderTop: '4px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ color: '#6b7280', fontSize: 16, fontWeight: 600 }}>
                  AI is analyzing your customer data...
                </p>
              </div>
            )}

            {aiError && !aiLoading && (
              <div style={{
                background: '#fef2f2',
                border: '2px solid #fecaca',
                borderRadius: 10,
                padding: 20,
                display: 'flex',
                alignItems: 'start',
                gap: 12
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#dc2626', fontSize: 16, fontWeight: 700 }}>
                    Error Generating Insights
                  </h4>
                  <p style={{ margin: 0, color: '#991b1b', fontSize: 14 }}>
                    {aiError}
                  </p>
                  <p style={{ margin: '12px 0 0 0', color: '#991b1b', fontSize: 13, fontStyle: 'italic' }}>
                    💡 Tip: Add REACT_APP_OPENROUTER_API_KEY to frontend/.env file. See AI_INSIGHTS_SETUP.md for details.
                  </p>
                </div>
              </div>
            )}

            {!aiInsights && !aiLoading && !aiError && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 300,
                gap: 16,
                textAlign: 'center'
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                    <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                    <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#111827', fontSize: 16, fontWeight: 600 }}>
                    Ready to Analyze Your Data
                  </h4>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: 14, maxWidth: 500 }}>
                    Click "Generate Insights" to get AI-powered marketing recommendations based on your customer data.
                  </p>
                </div>
                <div style={{
                  marginTop: 12,
                  padding: '12px 16px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  maxWidth: 600
                }}>
                  <p style={{ margin: 0, color: '#1e40af', fontSize: 13, fontWeight: 500 }}>
                    ✨ AI will analyze: Geographic trends, Product preferences, Conversion patterns, Lead quality, and Marketing opportunities
                  </p>
                </div>
              </div>
            )}

            {aiInsights && !aiLoading && (
              <div>
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span style={{ color: '#166534', fontSize: 13, fontWeight: 600 }}>
                    Insights generated successfully! Last updated: {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ 
                  padding: '20px',
                  background: '#fff',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb'
                }}>
                  {renderMarkdown(aiInsights)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App" style={{ position: 'relative' }}>
      {/* Header with Logo and App Name */}
      <header style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '70px',
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px'
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
              Map-Driven CRM for Outreach
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              padding: '8px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              background: activeTab === 'map' ? '#3b82f6' : '#ffffff',
              color: activeTab === 'map' ? '#ffffff' : '#374151',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (activeTab !== 'map') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'map') {
                e.currentTarget.style.background = '#ffffff';
              }
            }}
          >
            Map View
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '8px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              background: activeTab === 'analytics' ? '#3b82f6' : '#ffffff',
              color: activeTab === 'analytics' ? '#ffffff' : '#374151',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (activeTab !== 'analytics') {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
            onMouseOut={(e) => {
              if (activeTab !== 'analytics') {
                e.currentTarget.style.background = '#ffffff';
              }
            }}
          >
            Analytics
          </button>
          <button
            onClick={() => navigate('/customers')}
            style={{
              padding: '8px 16px',
              border: '2px solid #10b981',
              borderRadius: '8px',
              background: '#10b981',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#059669';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#10b981';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Customer Manager
          </button>
        </div>
      </header>

      {/* Customer Management Modal */}
      {showCustomerManagement && (
        <CustomerManagement
          onClose={() => setShowCustomerManagement(false)}
        />
      )}

      {/* Show analytics panel when analytics tab is active */}
      {activeTab === 'analytics' && (
        <div style={{ position: 'absolute', top: '70px', left: 0, right: 0, bottom: 0, background: '#f9fafb', zIndex: 1000 }}>
          <AnalyticsPanel />
        </div>
      )}

      {/* Floating FAB when panel is closed and on map view */}
      {!panelOpen && activeTab === 'map' && (
        <button
          aria-label="Open filters"
          onClick={() => setPanelOpen(true)}
          className="fab-open"
        >
          <span className="fab-dot" /> Filters
        </button>
      )}

      {/* Filter Panel with smooth transition - only show on map view */}
      {activeTab === 'map' && (
        <div
          className={`filter-panel ${panelOpen ? 'open' : 'closed'}`}
          style={{ '--scale': panelScale }}
          aria-hidden={!panelOpen}
        >
        <div className="panel-header">
          <strong className="panel-title">Filters</strong>
          <div className="panel-actions">
            <button 
              onClick={resetFilters} 
              className="btn ghost" 
              title="Reset all filters"
              style={{ 
                padding: '6px 12px', 
                fontSize: '13px',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              Reset
            </button>
            <button
              aria-label="Hide filters"
              onClick={() => setPanelOpen(false)}
              className="btn close-btn"
              title="Hide filters"
              style={{
                padding: '4px 8px',
                fontSize: '18px',
                background: '#f8fafc',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontWeight: 400,
                lineHeight: 1,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* States */}
        <label className="label">State(s)</label>
        <select
          ref={stateSelectRef}
          multiple
          value={selectedStates}
          onChange={() => {}}
          className="select"
        >
          {stateOptions.map(st => (
            <option
              key={st}
              value={st}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleSelectValue(stateSelectRef, setSelectedStates, st);
              }}
            >
              {`${st} - ${STATE_NAMES[st] || st}`}
            </option>
          ))}
        </select>

        {/* Products (checkboxes + Select all) */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <label className="label" style={{marginBottom: 0}}>Product(s)</label>
          <button
            type="button"
            onClick={selectAllProducts}
            className="btn ghost"
            style={{
              padding:'4px 10px',
              background: allProductsSelected ? '#2563eb' : '#fff',
              color: allProductsSelected ? '#fff' : '#111827',
              borderColor: allProductsSelected ? '#2563eb' : '#e5e7eb'
            }}
            title="Select all products"
          >
            Select all
          </button>
        </div>
        <div ref={productSelectRef} className="checkbox-list" style={{border: '1px solid #e5e7eb', borderRadius: 12, padding: 8, margin: '6px 0 12px'}}>
          {productOptions.map(p => {
            const checked = selectedProducts.includes(p);
            return (
              <label key={p} style={{display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px'}}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelectedProducts(prev =>
                      checked ? prev.filter(v => v !== p) : [...prev, p]
                    );
                  }}
                />
                {p}
              </label>
            );
          })}
        </div>

        {/* Zip code */}
        <label className="label">Zip code</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g., 10027"
          value={zipQuery}
          onChange={e => {
            // keep only digits, cap to 5
            const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
            setZipQuery(digits);
          }}
          className="input"
          style={{marginBottom: 12}}
          maxLength={5}
        />

        {/* Registration date range */}
        <div className="grid-2">
          <div>
            <label className="label">Reg. From</label>
            <input
              type="text"
              placeholder="mm-dd-yyyy or yyyy"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Reg. To</label>
            <input
              type="text"
              placeholder="mm-dd-yyyy or yyyy"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Status */}
        <label className="label">Account status</label>
        <div className="chips">
          {['lead', 'prospect', 'customer'].map(s => {
            const active = statuses.has(s);
            return (
              <button
                key={s}
                onClick={() => {
                  setStatuses(prev => {
                    const next = new Set(prev);
                    if (next.has(s)) next.delete(s);
                    else next.add(s);
                    return next;
                  });
                }}
                className={`chip ${active ? 'active' : ''}`}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0'}}>
          <div style={{fontWeight: 600, marginBottom: 8, fontSize: '14px'}}>Legend</div>
          
          {/* Product Colors */}
          <div style={{marginBottom: 8}}>
            <div style={{fontSize: '12px', fontWeight: 500, marginBottom: 4}}>Product Colors:</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '11px'}}>
              {/* Show all available products dynamically */}
              {availableProducts.map(product => (
                <div key={product.id} style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  <div style={{
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    background: getProductColor(product.name), 
                    border: '1px solid #fff'
                  }}></div>
                  <span>{product.name}</span>
                </div>
              ))}
              {/* Show "Multiple Products" option if we have 2 or more products */}
              {availableProducts.length >= 2 && (
                <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  <div style={{width: 12, height: 12, borderRadius: '50%', background: '#8b5cf6', border: '1px solid #fff'}}></div>
                  <span>Multiple Products</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Status Sizes */}
          <div>
            <div style={{fontSize: '12px', fontWeight: 500, marginBottom: 4}}>Status Sizes:</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '11px', alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                <div style={{width: 8, height: 8, borderRadius: '50%', background: '#6b7280', border: '1px solid #fff'}}></div>
                <span>Lead</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                <div style={{width: 10, height: 10, borderRadius: '50%', background: '#6b7280', border: '1px solid #fff'}}></div>
                <span>Prospect</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                <div style={{width: 12, height: 12, borderRadius: '50%', background: '#6b7280', border: '1px solid #fff'}}></div>
                <span>Customer</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footnote">
          Showing <b>{filteredSites.length}</b> of {sites.length}
        </div>
        </div>
      )}

      {/* Map - only show on map view */}
      {activeTab === 'map' && <div ref={mapContainer} className="map-container" />}
    </div>
  );
}

export default App;
