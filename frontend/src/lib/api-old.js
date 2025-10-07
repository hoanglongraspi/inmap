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

    // Insert customer data into customers table
    const { data: customerRecord, error: customerError } = await supabase
      .from('customers')
      .insert([{
        id: authData.user.id,
        email: customerData.email,
        name: customerData.name,
        company: customerData.company,
        phone: customerData.phone,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (customerError) throw new Error(customerError.message)

    return {
      user: authData.user,
      customer: customerRecord
    }
  } catch (error) {
    throw new Error(error.message || "Failed to register customer")
  }
}

export async function apiAcceptInvite({ token, password }) {
  try {
    // First, verify the invite token exists and get the email
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invite) {
      throw new Error("Invalid or expired invite token")
    }

    // Check if invite is still valid (not expired)
    const now = new Date()
    const expiresAt = new Date(invite.expires_at)
    if (now > expiresAt) {
      throw new Error("Invite token has expired")
    }

    // Create user account with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password: password,
      options: {
        data: {
          invited_by: invite.invited_by
        }
      }
    })

    if (authError) throw new Error(authError.message)

    // Update invite status to accepted
    const { error: updateError } = await supabase
      .from('invites')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        user_id: authData.user.id
      })
      .eq('token', token)

    if (updateError) throw new Error(updateError.message)

    return {
      user: authData.user,
      session: authData.session
    }
  } catch (error) {
    throw new Error(error.message || "Failed to accept invite")
  }
}

export async function apiGenerateInvite(email) {
  try {
    // Check if user is authenticated to generate invites
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated to generate invites")

    // Generate a unique token
    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    // Insert invite record
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert([{
        email: email,
        token: token,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (inviteError) throw new Error(inviteError.message)

    return {
      token: token,
      email: email,
      expires_at: expiresAt.toISOString(),
      invite_url: `${window.location.origin}/accept-invite?token=${token}`
    }
  } catch (error) {
    throw new Error(error.message || "Failed to generate invite")
  }
}

// ============================================================================
// CRM API Functions
// ============================================================================

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
      .from('sites')
      .update(siteData)
      .eq('id', siteId)
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
      .from('sites')
      .delete()
      .eq('id', siteId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    throw new Error(error.message || "Failed to delete site")
  }
}

// Contacts API
export async function apiGetContacts(siteId = null) {
  try {
    let query = supabase
      .from('contacts')
      .select('*, sites(name)')
      .order('created_at', { ascending: false })

    if (siteId) {
      query = query.eq('site_id', siteId)
    }

    const { data, error } = await query

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
      .from('contacts')
      .insert([{
        customer_id: user.id,
        site_id: contactData.site_id,
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        position: contactData.position
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
      .from('contacts')
      .update(contactData)
      .eq('id', contactId)
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
      .from('contacts')
      .delete()
      .eq('id', contactId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    throw new Error(error.message || "Failed to delete contact")
  }
}

// Interactions API
export async function apiGetInteractions(contactId = null, siteId = null) {
  try {
    let query = supabase
      .from('interactions')
      .select('*, contacts(name), sites(name)')
      .order('interaction_date', { ascending: false })

    if (contactId) {
      query = query.eq('contact_id', contactId)
    }
    if (siteId) {
      query = query.eq('site_id', siteId)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch interactions")
  }
}

export async function apiCreateInteraction(interactionData) {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('interactions')
      .insert([{
        customer_id: user.id,
        contact_id: interactionData.contact_id,
        site_id: interactionData.site_id,
        type: interactionData.type,
        subject: interactionData.subject,
        notes: interactionData.notes,
        interaction_date: interactionData.interaction_date || new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to create interaction")
  }
}

export async function apiUpdateInteraction(interactionId, interactionData) {
  try {
    const { data, error } = await supabase
      .from('interactions')
      .update(interactionData)
      .eq('id', interactionId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to update interaction")
  }
}

export async function apiDeleteInteraction(interactionId) {
  try {
    const { error } = await supabase
      .from('interactions')
      .delete()
      .eq('id', interactionId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    throw new Error(error.message || "Failed to delete interaction")
  }
}

// Dashboard/Analytics API
export async function apiGetDashboardStats() {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    // Get counts for dashboard including real imported data
    const [sitesResult, contactsResult, interactionsResult, publicSitesResult, researchParticipantsResult] = await Promise.all([
      supabase.from('sites').select('id', { count: 'exact', head: true }),
      supabase.from('contacts').select('id', { count: 'exact', head: true }),
      supabase.from('interactions').select('id', { count: 'exact', head: true }),
      supabase.from('public_sites').select('id', { count: 'exact', head: true }).is('claimed_by', null),
      supabase.from('research_participants').select('id', { count: 'exact', head: true }).is('claimed_by', null)
    ])

    if (sitesResult.error) throw new Error(sitesResult.error.message)
    if (contactsResult.error) throw new Error(contactsResult.error.message)
    if (interactionsResult.error) throw new Error(interactionsResult.error.message)
    if (publicSitesResult.error) throw new Error(publicSitesResult.error.message)
    if (researchParticipantsResult.error) throw new Error(researchParticipantsResult.error.message)

    return {
      sites_count: sitesResult.count || 0,
      contacts_count: contactsResult.count || 0,
      interactions_count: interactionsResult.count || 0,
      available_sites_count: publicSitesResult.count || 0,
      research_participants_count: researchParticipantsResult.count || 0
    }
  } catch (error) {
    throw new Error(error.message || "Failed to fetch dashboard stats")
  }
}

// ============================================================================
// Real Data API Functions (for imported CSV data)
// ============================================================================

// Public Sites API (imported customer data)
export async function apiGetPublicSites(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('public_sites')
      .select('*')
      .is('claimed_by', null)
      .order('registered_at', { ascending: false })
      .limit(limit)

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
      .from('public_sites')
      .update({ claimed_by: user.id })
      .eq('id', siteId)
      .is('claimed_by', null)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to claim site")
  }
}

export async function apiGetClaimedSites() {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('public_sites')
      .select('*')
      .eq('claimed_by', user.id)
      .order('registered_at', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch claimed sites")
  }
}

// Research Participants API
export async function apiGetResearchParticipants(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('research_participants')
      .select('*')
      .is('claimed_by', null)
      .order('timestamp', { ascending: false })
      .limit(limit)

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
      .from('research_participants')
      .update({ claimed_by: user.id })
      .eq('id', participantId)
      .is('claimed_by', null)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to claim research participant")
  }
}

export async function apiGetClaimedResearchParticipants() {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error("Must be authenticated")

    const { data, error } = await supabase
      .from('research_participants')
      .select('*')
      .eq('claimed_by', user.id)
      .order('timestamp', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch claimed research participants")
  }
}

// Products API
export async function apiGetProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    throw new Error(error.message || "Failed to fetch products")
  }
}

// CSV Import API
export async function apiImportCSVData(csvData) {
  try {
    // First, create customers for each CSV row
    const customersToInsert = csvData.map(row => ({
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.company || 'Imported Customer',
      registered_at: row.registered_at ? row.registered_at.split('T')[0] : new Date().toISOString().split('T')[0],
      status: row.status || 'lead',
      notes: `Imported from CSV. Company: ${row.company || 'N/A'}, Certification: ${row.certification || 'N/A'}, Email: ${row.email || 'N/A'}, Phone: ${row.phone || 'N/A'}`
    }));

    // Insert customers
    const { data: insertedCustomers, error: customerError } = await supabase
      .from('customers')
      .insert(customersToInsert)
      .select();

    if (customerError) throw new Error(`Customer insert error: ${customerError.message}`);

    // Then create sites for each customer
    const sitesToInsert = csvData.map((row, index) => ({
      customer_id: insertedCustomers[index].id,
      address: row.address || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      city: row.city || 'Unknown',
      state: row.state || 'XX',
      zip: row.zip_code || '00000',
      lat: row.latitude,
      lng: row.longitude
    }));

    // Insert sites
    const { data: insertedSites, error: siteError } = await supabase
      .from('sites')
      .insert(sitesToInsert)
      .select();

    if (siteError) throw new Error(`Site insert error: ${siteError.message}`);

    // If there are products of interest, link them
    if (csvData.some(row => row['product(s)_interested'] && row['product(s)_interested'].length > 0)) {
      // Get existing products
      const { data: products } = await supabase
        .from('products')
        .select('*');

      const productInterests = [];
      csvData.forEach((row, index) => {
        if (row['product(s)_interested'] && row['product(s)_interested'].length > 0) {
          row['product(s)_interested'].forEach(productName => {
            const product = products?.find(p => p.name.toLowerCase() === productName.toLowerCase());
            if (product) {
              productInterests.push({
                customer_id: insertedCustomers[index].id,
                product_id: product.id
              });
            }
          });
        }
      });

      if (productInterests.length > 0) {
        await supabase
          .from('customer_product_interests')
          .insert(productInterests);
      }
    }

    return { customers: insertedCustomers, sites: insertedSites };
  } catch (error) {
    throw new Error(error.message || "Failed to import CSV data")
  }
}

// Create sample data for testing
export async function apiCreateSampleData() {
  try {
    // Create sample customers
    const sampleCustomers = [
      {
        name: 'John Smith - ABC Healthcare',
        registered_at: '2024-01-15',
        status: 'customer',
        notes: 'Sample customer for testing'
      },
      {
        name: 'Jane Doe - XYZ Medical',
        registered_at: '2024-02-20',
        status: 'prospect',
        notes: 'Sample prospect for testing'
      },
      {
        name: 'Mike Johnson - City Hospital',
        registered_at: '2024-03-10',
        status: 'lead',
        notes: 'Sample lead for testing'
      }
    ];

    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .insert(sampleCustomers)
      .select();

    if (customerError) throw customerError;

    // Create sample sites for each customer
    const sampleSites = [
      {
        customer_id: customers[0].id,
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        lat: 40.7128,
        lng: -74.0060
      },
      {
        customer_id: customers[1].id,
        address: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90210',
        lat: 34.0522,
        lng: -118.2437
      },
      {
        customer_id: customers[2].id,
        address: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        lat: 41.8781,
        lng: -87.6298
      }
    ];

    const { data: sites, error: siteError } = await supabase
      .from('sites')
      .insert(sampleSites)
      .select();

    if (siteError) throw siteError;

    return { customers, sites };
  } catch (error) {
    throw new Error(error.message || "Failed to create sample data")
  }
}
