import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
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
        'User-Agent': 'Customer-Atlas-CRM/1.0' // Nominatim requires a user agent
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
            zip: site.postal_code
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
      console.log('Loaded products:', products);
      setAvailableProducts(products);
    } catch (error) {
      console.error('Failed to load products:', error);
      // Fallback to default products if loading fails
      setAvailableProducts([
        { id: 'armrehab', name: 'ArmRehab', description: 'Arm rehabilitation equipment' },
        { id: 'audiosight', name: 'Audiosight', description: 'Audio and hearing assessment technology' }
      ]);
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
      // Normalize product names to match available products
      const productName = String(p);
      const matchedProduct = availableProducts.find(ap => 
        ap.name.toLowerCase() === productName.toLowerCase()
      );
      return matchedProduct ? matchedProduct.name : productName;
    });
    
    // Check if we have multiple products from our available list
    const matchedProducts = products.filter(p => 
      availableProducts.some(ap => ap.name === p)
    );
    
    if (matchedProducts.length > 1) return 'Multiple Products';
    if (matchedProducts.length === 1) return matchedProducts[0];
    return products.length > 0 ? products[0] : 'Other';
  }, [availableProducts]);

  // Helper function to get color based on product type
  const getProductColor = (productType) => {
    // Define a color palette for products
    const colorPalette = [
      '#ef4444', // Red
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Orange
      '#8b5cf6', // Purple
      '#ec4899', // Pink
      '#14b8a6', // Teal
      '#f97316'  // Orange-red
    ];
    
    if (productType === 'Multiple Products') return '#8b5cf6'; // Purple for multiple products
    
    // Find the product in our available products list
    const productIndex = availableProducts.findIndex(p => p.name === productType);
    if (productIndex >= 0) {
      return colorPalette[productIndex % colorPalette.length];
    }
    
    // Fallback for unknown products
    return '#6b7280'; // Gray
  };

  // Helper function to get size based on status
  const getStatusSize = (status) => {
    switch (status) {
      case 'customer': return 12; // Largest
      case 'prospect': return 10; // Medium
      case 'lead': return 8; // Smallest
      default: return 8;
    }
  };

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
  }, [getProductType, availableProducts]);

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
        const prods = normalizeProducts(site['product(s)_interested']).map(p => {
          const v = String(p).toLowerCase();
          return v === 'audiosight' ? 'Audiosight' : v === 'armrehab' ? 'ArmRehab' : String(p);
        });
        const prodsSet = new Set(prods);
        const hasAny = Array.from(prodSel).some(sel => prodsSet.has(sel));
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

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://api.maptiler.com/maps/openstreetmap/style.json?key=b9c8lYjfkzHCjixZoLqo",
      center: [-98.5, 39.8],
      zoom: 3
    });

    map.current.on('move', () => {
      if (map.current) setMapZoom(map.current.getZoom());
    });

    map.current.on("load", () => {
      setMapReady(true);

      map.current.addSource("favorites", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.current.addLayer({
        id: "clusters",
        type: "circle",
        source: "favorites",
        filter: ["has", "point_count"],
        paint: {
          // Color intensity based on point count - darker for more people
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,     "#dbeafe",  // Very light blue for 2 people
            5,     "#93c5fd",  // Light blue for 5 people
            10,    "#60a5fa",  // Medium light blue for 10 people
            25,    "#3b82f6",  // Medium blue for 25 people
            50,    "#2563eb",  // Medium dark blue for 50 people
            100,   "#1d4ed8",  // Dark blue for 100 people
            200,   "#1e40af"   // Very dark blue for 200+ people
          ],
          // Radius also scales with count
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "point_count"],
            2,   15,   // Small clusters
            10,  20,   // Medium clusters
            50,  25,   // Large clusters
            100, 30    // Very large clusters
          ],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
          // Add opacity for better visual effect
          "circle-opacity": 0.85
        }
      });

      map.current.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "favorites",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12
        },
        paint: {
          // Dynamic text color: black for light backgrounds, white for dark backgrounds
          "text-color": [
            "step",
            ["get", "point_count"],
            "#000000",  // Black text for very light clusters (default, < 10)
            10, "#000000",  // Black text for light clusters (10-24)
            25, "#ffffff",  // White text for medium clusters (25-49)
            50, "#ffffff"   // White text for dark clusters (50+)
          ]
        }
      });

      map.current.addLayer({
        id: "points",
        type: "circle",
        source: "favorites",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "size"],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1
        }
      });

      const popup = new maplibregl.Popup({ 
        closeButton: false, 
        closeOnClick: false,
        maxWidth: '500px',
        className: 'cluster-popup'
      });

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

      map.current.on("click", "points", (e) => {
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
          .map(p => {
            const v = String(p).toLowerCase();
            if (v === 'audiosight') return 'Audiosight';
            if (v === 'armrehab') return 'ArmRehab';
            return p;
          })
          .join(', ');

        const productType = feature.properties.productType;
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
      });

      clusterIndex.current = new Supercluster({ radius: 40, maxZoom: 16 });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      listenerAttached.current = false;
    };
  }, [sites, loading]);

  // Safe refresh function (guards against undefined)
  const refreshSafe = () => {
    if (!map.current) return;
    const src = map.current.getSource('favorites');
    if (!src) return;

    // If no cluster index, clear the map data
    if (!clusterIndex.current) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const b = map.current.getBounds?.();
    if (!b) return;

    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    if (!bbox.every(n => Number.isFinite(n))) return;

    const zoom = map.current.getZoom?.();
    if (!Number.isFinite(zoom)) return;

    let clusters = [];
    try {
      // Enhanced safety check: verify Supercluster is properly loaded
      // Check for both the function AND internal state (trees property)
      if (clusterIndex.current && 
          typeof clusterIndex.current.getClusters === 'function' &&
          clusterIndex.current.trees) {
        clusters = clusterIndex.current.getClusters(bbox, Math.floor(zoom));
      } else {
        // Index exists but not properly loaded - clear it
        console.warn('⚠️ Supercluster index not fully loaded, clearing...');
        clusterIndex.current = null;
      }
    } catch (e) {
      console.error('❌ supercluster.getClusters failed:', e.message);
      console.warn('Clearing invalid cluster index');
      clusterIndex.current = null;
      clusters = [];
    }

    src.setData({ type: 'FeatureCollection', features: clusters });
  };

  // Re-cluster & refresh when filtered features change, but ONLY after map is ready
  useEffect(() => {
    if (!mapReady || !map.current) return;

    if (!filteredFeatures.length) {
      clusterIndex.current = null; // no data -> clear index
      refreshSafe();
      return;
    }

    try {
      // Create new Supercluster instance
      const newIndex = new Supercluster({ radius: 40, maxZoom: 16 });
      
      // Load features into the index
      newIndex.load(filteredFeatures);
      
      // Verify the index was properly loaded by checking internal state
      if (!newIndex.trees || typeof newIndex.getClusters !== 'function') {
        throw new Error('Supercluster index not properly initialized');
      }
      
      // Only assign if successfully loaded
      clusterIndex.current = newIndex;
      console.log(`✅ Supercluster loaded with ${filteredFeatures.length} features`);
    } catch (e) {
      console.error('❌ Failed to create Supercluster index:', e.message);
      console.warn('filteredFeatures count:', filteredFeatures.length);
      clusterIndex.current = null;
      refreshSafe(); // Clear the map
      return;
    }

    if (!listenerAttached.current) {
      map.current.on('moveend', refreshSafe);
      listenerAttached.current = true;
    }

    refreshSafe();
  }, [filteredFeatures, mapReady]);

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

    return (
      <div style={{ padding: '20px', maxHeight: 'calc(100vh - 40px)', overflow: 'auto' }}>
        {/* Header with tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 10 }}>
          <button
            onClick={() => setActiveTab('map')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: activeTab === 'map' ? '#3b82f6' : '#f3f4f6',
              color: activeTab === 'map' ? '#fff' : '#374151',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Map View
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: activeTab === 'analytics' ? '#3b82f6' : '#f3f4f6',
              color: activeTab === 'analytics' ? '#fff' : '#374151',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Analytics
          </button>
        </div>

        {/* Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#f0f9ff', padding: 16, borderRadius: 8, border: '1px solid #e0f2fe' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0369a1' }}>{analytics.totalSites}</div>
            <div style={{ fontSize: 14, color: '#0369a1' }}>Total Sites</div>
          </div>
          <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, border: '1px solid #dcfce7' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>{analytics.statusStats.customer}</div>
            <div style={{ fontSize: 14, color: '#166534' }}>Customers</div>
          </div>
          <div style={{ background: '#fffbeb', padding: 16, borderRadius: 8, border: '1px solid #fef3c7' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#92400e' }}>{analytics.statusStats.prospect}</div>
            <div style={{ fontSize: 14, color: '#92400e' }}>Prospects</div>
          </div>
          <div style={{ background: '#fef2f2', padding: 16, borderRadius: 8, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#991b1b' }}>{analytics.statusStats.lead}</div>
            <div style={{ fontSize: 14, color: '#991b1b' }}>Leads</div>
          </div>
        </div>

        {/* Top Cities */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Top Cities by Interest</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {analytics.topCities.map((city, idx) => (
              <div key={city.city} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < analytics.topCities.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{idx + 1}. {city.city}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Products: {city.products.join(', ') || 'None'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>{city.count} sites</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {city.customers}C / {city.prospects}P / {city.leads}L
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Interest Distribution */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Product Interest Distribution</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(analytics.productStats).map(([product, count]) => {
              const percentage = ((count / analytics.totalSites) * 100).toFixed(1);
              const color = getProductColor(product);
              return (
                <div key={product} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: color, border: '1px solid #fff' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{product}</span>
                      <span style={{ color: '#6b7280' }}>{count} ({percentage}%)</span>
                    </div>
                    <div style={{ background: '#f3f4f6', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ background: color, height: '100%', width: `${percentage}%`, transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top States */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Top States by Activity</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {analytics.topStates.map((state, idx) => (
              <div key={state.state} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < analytics.topStates.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{idx + 1}. {state.state}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>{state.count} sites</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {state.customers}C / {state.prospects}P / {state.leads}L
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Registration Timeline */}
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Registration Timeline (Last 12 Months)</h3>
          <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 120 }}>
            {analytics.timelineData.map(([month, count]) => {
              const maxCount = Math.max(...analytics.timelineData.map(([, c]) => c));
              const height = (count / maxCount) * 100;
              return (
                <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6' }}>{count}</div>
                  <div style={{ background: '#3b82f6', width: '100%', height: `${height}%`, minHeight: '2px', borderRadius: '2px 2px 0 0' }}></div>
                  <div style={{ fontSize: 9, color: '#6b7280', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>
                    {month}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="App" style={{ position: 'relative' }}>
      {/* Customer Management Modal */}
      {showCustomerManagement && (
        <CustomerManagement
          onClose={() => setShowCustomerManagement(false)}
        />
      )}

      {/* Show analytics panel when analytics tab is active */}
      {activeTab === 'analytics' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#f9fafb', zIndex: 1000 }}>
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
              onClick={() => setActiveTab('analytics')} 
              className="btn ghost" 
              title="View Analytics"
              style={{ 
                padding: '6px 12px', 
                fontSize: '13px',
                background: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#e0f2fe'}
              onMouseOut={(e) => e.currentTarget.style.background = '#f0f9ff'}
            >
              Analytics
            </button>
            <button 
              onClick={() => navigate('/customers')} 
              className="btn ghost" 
              title="Manage Customers"
              style={{ 
                padding: '6px 12px', 
                fontSize: '13px',
                background: '#10b981',
                color: 'white',
                border: '1px solid #10b981',
                borderRadius: '8px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
            >
              Customer Manager
            </button>
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
