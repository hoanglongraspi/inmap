import { supabase, getCurrentUser } from './supabase'

export async function apiMe() {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Not authenticated")
    
    return {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      },
      csrfToken: null // Not needed with Supabase
    }
  } catch (error) {
    throw new Error("Failed to get user info")
  }
}

export async function apiLogin({email, password}) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw new Error(error.message)
    
    return {
      user: data.user,
      session: data.session
    }
  } catch (error) {
    throw new Error(error.message || "Login failed")
  }
}

export async function apiRegisterCustomer(customerData) {
  try {
    // Register user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: customerData.email,
      password: customerData.password,
      options: {
        data: {
          name: customerData.name,
          company: customerData.company,
          phone: customerData.phone
        }
      }
    })

    if (authError) throw new Error(authError.message)

    // Customer record will be automatically created by the trigger
    // Just return the auth data
    return {
      user: authData.user,
      session: authData.session
    }
  } catch (error) {
    throw new Error(error.message || "Registration failed")
  }
}

// ============================================================================
// CRM API Functions - Updated for 2-table schema
// ============================================================================

// Get all customers (any type)
export async function apiGetCustomers() {
  try {
    // Fetch all customers using pagination to avoid Supabase's 1000 row limit
    let allCustomers = []
    let from = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) throw new Error(error.message)
      
      if (data && data.length > 0) {
        allCustomers = [...allCustomers, ...data]
        from += pageSize
        hasMore = data.length === pageSize // Continue if we got a full page
      } else {
        hasMore = false
      }
    }

    console.log(`Fetched ${allCustomers.length} total customers from Supabase`)
    return allCustomers
  } catch (error) {
    throw new Error(error.message || "Failed to fetch customers")
  }
}

// Sites API - now gets from customers table where customer_type = 'site'
export async function apiGetSites() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_type', 'site')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch sites")
  }
}

export async function apiCreateSite(siteData) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        customer_type: 'site',
        name: siteData.name,
        email: siteData.email,
        phone: siteData.phone,
        address: siteData.address,
        city: siteData.city,
        state: siteData.state,
        postal_code: siteData.postal_code,
        country: siteData.country || 'USA',
        latitude: siteData.latitude,
        longitude: siteData.longitude,
        claimed_by: user.id,
        status: 'new',
        source_system: 'crm'
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to create site")
  }
}

export async function apiUpdateSite(siteId, siteData) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: siteData.name,
        email: siteData.email,
        phone: siteData.phone,
        address: siteData.address,
        city: siteData.city,
        state: siteData.state,
        postal_code: siteData.postal_code,
        country: siteData.country,
        latitude: siteData.latitude,
        longitude: siteData.longitude,
        status: siteData.status,
        notes: siteData.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', siteId)
      .eq('customer_type', 'site')
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to update site")
  }
}

export async function apiDeleteSite(siteId) {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', siteId)
      .eq('customer_type', 'site')

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    throw new Error(error.message || "Failed to delete site")
  }
}

// Contacts API - now gets from customers table where customer_type = 'contact'
export async function apiGetContacts() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_type', 'contact')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch contacts")
  }
}

export async function apiCreateContact(contactData) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        customer_type: 'contact',
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        role_background: contactData.position,
        parent_lead_id: contactData.customer_id,
        claimed_by: user.id,
        status: 'new',
        source_system: 'crm'
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to create contact")
  }
}

export async function apiUpdateContact(contactId, contactData) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        role_background: contactData.position,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .eq('customer_type', 'contact')
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to update contact")
  }
}

export async function apiDeleteContact(contactId) {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', contactId)
      .eq('customer_type', 'contact')

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    throw new Error(error.message || "Failed to delete contact")
  }
}

// Research Participants API - now gets from customers table where customer_type = 'participant'
export async function apiGetResearchParticipants() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_type', 'participant')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch research participants")
  }
}

export async function apiClaimResearchParticipant(participantId) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('customers')
      .update({
        claimed_by: user.id,
        status: 'qualified',
        updated_at: new Date().toISOString()
      })
      .eq('id', participantId)
      .eq('customer_type', 'participant')
      .is('claimed_by', null)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to claim research participant")
  }
}

// Public Sites API - now gets from customers table where customer_type = 'site' and source_system = 'public_sites'
export async function apiGetPublicSites() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_type', 'site')
      .eq('source_system', 'public_sites')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch public sites")
  }
}

export async function apiClaimPublicSite(siteId) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('customers')
      .update({
        claimed_by: user.id,
        status: 'qualified',
        updated_at: new Date().toISOString()
      })
      .eq('id', siteId)
      .eq('customer_type', 'site')
      .eq('source_system', 'public_sites')
      .is('claimed_by', null)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to claim public site")
  }
}

// Dashboard Stats - simplified for 2-table schema
export async function apiGetDashboardStats() {
  try {
    const [
      totalCustomers,
      totalSites,
      totalParticipants,
      unclaimedSites,
      unclaimedParticipants
    ] = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('customer_type', 'customer'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('customer_type', 'site'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('customer_type', 'participant'),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('customer_type', 'site').is('claimed_by', null),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('customer_type', 'participant').is('claimed_by', null)
    ])

    return {
      totalCustomers: totalCustomers.count || 0,
      totalSites: totalSites.count || 0,
      totalContacts: 0, // Simplified - contacts are now part of customers
      totalInteractions: 0, // Simplified - no separate interactions table
      totalPublicSites: totalSites.count || 0,
      unclaimedPublicSites: unclaimedSites.count || 0,
      totalResearchParticipants: totalParticipants.count || 0,
      unclaimedResearchParticipants: unclaimedParticipants.count || 0
    }
  } catch (error) {
    throw new Error(error.message || "Failed to fetch dashboard stats")
  }
}

// Products API (unchanged - still uses products table)
export async function apiGetProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch products")
  }
}

export async function apiCreateProduct(productData) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('products')
      .insert([{
        name: productData.name,
        description: productData.description || null,
        price: productData.price || null,
        unit: productData.unit || null,
        notes: productData.notes || null
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to create product")
  }
}

// CSV Import functions - simplified (no separate csv_imports table)
export async function apiImportCSV(file, columnMapping, importType) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    // For now, just return success - actual CSV processing would happen here
    return {
      success: true,
      message: `CSV import initiated for ${importType}`,
      filename: file.name
    }
  } catch (error) {
    throw new Error(error.message || "Failed to import CSV")
  }
}

// Simplified customer management functions
export async function apiCreateCustomer(customerData) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('customers')
      .insert([{
        customer_type: 'customer',
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        company: customerData.company,
        address: customerData.address,
        city: customerData.city,
        state: customerData.state,
        postal_code: customerData.postal_code,
        country: customerData.country || 'USA',
        status: customerData.status || 'new',
        claimed_by: user.id,
        source_system: 'crm',
        notes: customerData.notes
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to create customer")
  }
}

export async function apiUpdateCustomer(customerId, customerData) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        company: customerData.company,
        address: customerData.address,
        city: customerData.city,
        state: customerData.state,
        postal_code: customerData.postal_code,
        country: customerData.country,
        status: customerData.status,
        notes: customerData.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to update customer")
  }
}

export async function apiDeleteCustomer(customerId) {
  try {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    throw new Error(error.message || "Failed to delete customer")
  }
}

// Missing functions that the frontend components need

export async function apiAcceptInvite({ token, password }) {
  try {
    // Since we removed the invites table, we'll create a simplified version
    // In a real app, you'd want to implement proper invite functionality
    
    // For now, just create a user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `user-${token}@example.com`, // Simplified - would normally get from invite
      password: password
    })

    if (authError) throw new Error(authError.message)

    return {
      user: authData.user,
      session: authData.session
    }
  } catch (error) {
    throw new Error(error.message || "Failed to accept invite")
  }
}

// Geocoding function for CSV import
async function geocodeForImport(address, city, state, zipCode) {
  try {
    // Priority 1: Try Zippopotam API for US zipcodes
    if (zipCode && zipCode !== '00000') {
      const cleanZip = zipCode.toString().replace(/\D/g, '').slice(0, 5);
      if (cleanZip.length === 5) {
        const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.places && data.places.length > 0) {
            const place = data.places[0];
            return {
              latitude: parseFloat(place.latitude),
              longitude: parseFloat(place.longitude),
              city: place['place name'],
              state: place['state abbreviation']
            };
          }
        }
      }
    }
    
    // Priority 2: Try full address with MapTiler
    if (address && city && state) {
      const fullAddress = `${address}, ${city}, ${state} ${zipCode || ''}`.trim();
      const encodedAddress = encodeURIComponent(fullAddress);
      const response = await fetch(`https://api.maptiler.com/geocoding/${encodedAddress}.json?key=b9c8lYjfkzHCjixZoLqo`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const [longitude, latitude] = data.features[0].center;
          return { latitude, longitude };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Geocoding failed during import:', error);
    return null;
  }
}

export async function apiImportCSVData(csvData, selectedProduct = 'Unknown') {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    // Helper function to validate email format
    const isValidEmail = (email) => {
      if (!email || typeof email !== 'string') return false;
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      return emailRegex.test(email.trim());
    };

    // Helper function to clean phone number
    const cleanPhone = (phone) => {
      if (!phone) return null;
      // Remove all non-numeric characters except + at the beginning
      const cleaned = phone.toString().replace(/[^\d+]/g, '');
      return cleaned.length > 0 ? cleaned : null;
    };

    // Convert selected product to array format (match database casing)
    const productsInterestedArray = selectedProduct === 'Both' ? ['AudioSight', 'SATE'] : [selectedProduct];

    console.log('Starting CSV import with geocoding for', csvData.length, 'rows...');
    
    // Process each row and geocode if needed
    const customersToInsert = [];
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      // Get coordinates from CSV or geocode
      let latitude = row.latitude ? parseFloat(row.latitude) : null;
      let longitude = row.longitude ? parseFloat(row.longitude) : null;
      
      // If no coordinates in CSV, geocode now
      if (!latitude || !longitude) {
        const zipCode = row.zip_code || row.postal_code || row.zipcode || '';
        const geocoded = await geocodeForImport(
          row.address || '',
          row.city || '',
          row.state || '',
          zipCode
        );
        
        if (geocoded) {
          latitude = geocoded.latitude;
          longitude = geocoded.longitude;
          console.log(`✅ Geocoded row ${i + 1}/${csvData.length}: ${zipCode || row.city} → ${latitude}, ${longitude}`);
        } else {
          console.warn(`⚠️ Could not geocode row ${i + 1}: ${row.city}, ${row.state} ${zipCode}`);
        }
        
        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      customersToInsert.push({
        customer_type: 'site', // Import as 'site' so they show up on the map
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.company || 'Imported Customer',
        email: isValidEmail(row.email) ? row.email.trim() : null,
        phone: cleanPhone(row.phone),
        company: row.company || null,
        address: row.address || null,
        city: row.city || 'Unknown',
        state: row.state || 'XX',
        postal_code: row.zip_code || row.postal_code || row.zipcode || '00000',
        country: 'USA',
        latitude: latitude,
        longitude: longitude,
        'product(s)_interested': productsInterestedArray,
        status: row.status || 'lead',
        claimed_by: user.id,
        source_system: 'csv_import',
        registered_at: row.registered_at ? row.registered_at.split('T')[0] : new Date().toISOString().split('T')[0],
        notes: `Imported from CSV. Product Interest: ${selectedProduct}. ${row.certification ? `Certification: ${row.certification}` : ''} ${!isValidEmail(row.email) && row.email ? `Invalid email: ${row.email}` : ''}`.trim()
      });
    }

    console.log('Inserting', customersToInsert.length, 'customers into database...');

    // Insert all customers at once
    const { data: insertedCustomers, error: customerError } = await supabase
      .from('customers')
      .insert(customersToInsert)
      .select();

    if (customerError) throw new Error(`Import error: ${customerError.message}`);

    const geocodedCount = insertedCustomers.filter(c => c.latitude && c.longitude).length;
    console.log(`✅ Import complete: ${insertedCustomers.length} customers, ${geocodedCount} geocoded`);

    return {
      success: true,
      imported_count: insertedCustomers.length,
      geocoded_count: geocodedCount,
      customers: insertedCustomers,
      warnings: csvData.filter(row => !isValidEmail(row.email) && row.email).map(row => 
        `Invalid email format for ${row.first_name || ''} ${row.last_name || ''}: ${row.email}`
      )
    };
  } catch (error) {
    throw new Error(error.message || "Failed to import CSV data")
  }
}

export async function apiCreateSampleData() {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    // Create sample customers in our new simplified format
    const sampleCustomers = [
      {
        customer_type: 'customer',
        name: 'John Smith - ABC Healthcare',
        email: 'john@abchealthcare.com',
        phone: '+1-555-0101',
        company: 'ABC Healthcare',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'USA',
        latitude: 40.7128,
        longitude: -74.0060,
        status: 'customer',
        claimed_by: user.id,
        source_system: 'sample_data',
        registered_at: '2024-01-15',
        notes: 'Sample customer for testing'
      },
      {
        customer_type: 'customer',
        name: 'Jane Doe - XYZ Medical',
        email: 'jane@xyzmedical.com',
        phone: '+1-555-0102',
        company: 'XYZ Medical',
        address: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        postal_code: '90210',
        country: 'USA',
        latitude: 34.0522,
        longitude: -118.2437,
        status: 'prospect',
        claimed_by: user.id,
        source_system: 'sample_data',
        registered_at: '2024-02-20',
        notes: 'Sample prospect for testing'
      },
      {
        customer_type: 'customer',
        name: 'Mike Johnson - City Hospital',
        email: 'mike@cityhospital.com',
        phone: '+1-555-0103',
        company: 'City Hospital',
        address: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        postal_code: '60601',
        country: 'USA',
        latitude: 41.8781,
        longitude: -87.6298,
        status: 'lead',
        claimed_by: user.id,
        source_system: 'sample_data',
        registered_at: '2024-03-10',
        notes: 'Sample lead for testing'
      }
    ];

    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .insert(sampleCustomers)
      .select();

    if (customerError) throw customerError;

    return {
      success: true,
      created_count: customers.length,
      customers: customers
    };
  } catch (error) {
    throw new Error(error.message || "Failed to create sample data")
  }
}

// Geocode customers that are missing coordinates
export async function apiGeocodeCustomers(onProgress) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    // Get all customers without coordinates
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .or('latitude.is.null,longitude.is.null')

    if (fetchError) throw new Error(fetchError.message)

    if (!customers || customers.length === 0) {
      return {
        success: true,
        message: 'All customers already have coordinates',
        processed: 0,
        geocoded: 0,
        failed: 0
      }
    }

    console.log(`Found ${customers.length} customers without coordinates`)
    
    let geocodedCount = 0
    let failedCount = 0

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i]
      
      // Report progress
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: customers.length,
          customer: customer.name || customer.company,
          status: 'processing'
        })
      }

      try {
        // Try to geocode
        const geocoded = await geocodeForImport(
          customer.address || '',
          customer.city || '',
          customer.state || '',
          customer.postal_code || ''
        )

        if (geocoded && geocoded.latitude && geocoded.longitude) {
          // Update customer with coordinates
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              latitude: geocoded.latitude,
              longitude: geocoded.longitude,
              updated_at: new Date().toISOString()
            })
            .eq('id', customer.id)

          if (updateError) {
            console.error('Failed to update customer:', updateError)
            failedCount++
          } else {
            console.log(`✅ Geocoded: ${customer.name} → ${geocoded.latitude}, ${geocoded.longitude}`)
            geocodedCount++
            
            if (onProgress) {
              onProgress({
                current: i + 1,
                total: customers.length,
                customer: customer.name || customer.company,
                status: 'success',
                coordinates: `${geocoded.latitude}, ${geocoded.longitude}`
              })
            }
          }
        } else {
          console.warn(`⚠️ Could not geocode: ${customer.name}`)
          failedCount++
          
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: customers.length,
              customer: customer.name || customer.company,
              status: 'failed',
              reason: 'No coordinates found'
            })
          }
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 150))

      } catch (error) {
        console.error(`Error geocoding customer ${customer.id}:`, error)
        failedCount++
        
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: customers.length,
            customer: customer.name || customer.company,
            status: 'error',
            error: error.message
          })
        }
      }
    }

    return {
      success: true,
      processed: customers.length,
      geocoded: geocodedCount,
      failed: failedCount
    }
  } catch (error) {
    throw new Error(error.message || "Failed to geocode customers")
  }
}
