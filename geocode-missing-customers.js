#!/usr/bin/env node

/**
 * Script to check and geocode customers missing coordinates
 * 
 * This script will:
 * 1. Find all customers without valid coordinates
 * 2. Attempt to geocode them using their address/zip code
 * 3. Update the database with the geocoded coordinates
 * 
 * Usage: node geocode-missing-customers.js
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Geocoding function using Zippopotam API (free, no API key needed)
async function geocodeZipcode(zipCode) {
  try {
    const cleanZip = zipCode.toString().replace(/\D/g, '').slice(0, 5);
    if (cleanZip.length !== 5) {
      return null;
    }

    const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
    
    if (!response.ok) {
      console.warn(`  ⚠️  Zippopotam API error for ${cleanZip}: ${response.status}`);
      return null;
    }
    
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
    
    return null;
  } catch (error) {
    console.warn(`  ⚠️  Geocoding failed for ${zipCode}:`, error.message);
    return null;
  }
}

// Geocoding function using MapTiler API
async function geocodeWithMapTiler(address, city, state, zipCode) {
  try {
    const fullAddress = [address, city, state, zipCode].filter(Boolean).join(', ');
    const encodedAddress = encodeURIComponent(fullAddress);
    const apiKey = 'b9c8lYjfkzHCjixZoLqo'; // Your MapTiler API key
    
    const response = await fetch(`https://api.maptiler.com/geocoding/${encodedAddress}.json?key=${apiKey}`);
    
    if (!response.ok) {
      console.warn(`  ⚠️  MapTiler API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
    
    return null;
  } catch (error) {
    console.warn(`  ⚠️  MapTiler geocoding failed:`, error.message);
    return null;
  }
}

// Main function
async function main() {
  console.log('🔍 Checking for customers without coordinates...\n');

  try {
    // Fetch all customers
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching customers:', error.message);
      return;
    }

    console.log(`📊 Total customers in database: ${customers.length}\n`);

    // Filter customers without valid coordinates
    const customersWithoutCoords = customers.filter(c => {
      const hasValidCoords = c.latitude && c.longitude && 
                            !isNaN(parseFloat(c.latitude)) && 
                            !isNaN(parseFloat(c.longitude));
      return !hasValidCoords;
    });

    console.log(`⚠️  Customers without coordinates: ${customersWithoutCoords.length}\n`);

    if (customersWithoutCoords.length === 0) {
      console.log('✅ All customers have valid coordinates!');
      return;
    }

    // Group by products_interested for analysis
    const byProduct = {};
    customersWithoutCoords.forEach(c => {
      const products = Array.isArray(c.products_interested) 
        ? c.products_interested 
        : (c.products_interested ? JSON.parse(c.products_interested) : ['Unknown']);
      
      products.forEach(product => {
        if (!byProduct[product]) byProduct[product] = [];
        byProduct[product].push(c);
      });
    });

    console.log('📊 Customers without coordinates by product:');
    Object.entries(byProduct).forEach(([product, customers]) => {
      console.log(`   ${product}: ${customers.length} customers`);
    });
    console.log();

    // Ask user if they want to geocode
    console.log('🌍 Starting geocoding process...\n');

    let geocodedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < customersWithoutCoords.length; i++) {
      const customer = customersWithoutCoords[i];
      const progress = `[${i + 1}/${customersWithoutCoords.length}]`;
      
      console.log(`${progress} Processing: ${customer.name || customer.company}`);
      console.log(`   Location: ${customer.city}, ${customer.state} ${customer.postal_code}`);
      
      let geocoded = null;

      // Try geocoding by zip code first (most reliable)
      if (customer.postal_code && customer.postal_code !== '00000') {
        console.log(`   Trying Zippopotam API with zip: ${customer.postal_code}...`);
        geocoded = await geocodeZipcode(customer.postal_code);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      }

      // If zip failed, try full address with MapTiler
      if (!geocoded && customer.address && customer.city && customer.state) {
        console.log(`   Trying MapTiler API with full address...`);
        geocoded = await geocodeWithMapTiler(
          customer.address,
          customer.city,
          customer.state,
          customer.postal_code
        );
        await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
      }

      if (geocoded) {
        // Update customer in database
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id);

        if (updateError) {
          console.log(`   ❌ Failed to update database: ${updateError.message}`);
          failedCount++;
        } else {
          console.log(`   ✅ Geocoded: ${geocoded.latitude}, ${geocoded.longitude}`);
          geocodedCount++;
        }
      } else {
        console.log(`   ❌ Could not geocode`);
        failedCount++;
      }

      console.log();
    }

    console.log('═══════════════════════════════════════════════');
    console.log('📊 GEOCODING COMPLETE');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ Successfully geocoded: ${geocodedCount}`);
    console.log(`❌ Failed to geocode: ${failedCount}`);
    console.log(`📍 Total processed: ${customersWithoutCoords.length}`);
    console.log();
    console.log('🗺️  Your customers should now appear on the map!');
    console.log('   Refresh your browser to see the updated map.');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { geocodeZipcode, geocodeWithMapTiler };


