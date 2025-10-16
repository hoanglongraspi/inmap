/**
 * QUICK DIAGNOSTIC SCRIPT FOR AUDIOSIGHT CUSTOMERS
 * 
 * INSTRUCTIONS:
 * 1. Open your app in the browser
 * 2. Press F12 to open Developer Console
 * 3. Paste this ENTIRE file into the console
 * 4. Press Enter
 * 5. Read the results!
 */

(async function diagnoseAudiosight() {
  console.log('%c🔍 AUDIOSIGHT DIAGNOSTIC TOOL', 'font-size: 20px; font-weight: bold; color: #3b82f6;');
  console.log('═'.repeat(80));
  
  // Check if supabase is available
  if (typeof supabase === 'undefined') {
    console.error('❌ Supabase client not found! Are you on the correct page?');
    return;
  }

  console.log('\n📊 Step 1: Checking ALL customers in database...\n');
  
  try {
    const { data: allCustomers, error } = await supabase
      .from('customers')
      .select('*');

    if (error) {
      console.error('❌ Error fetching customers:', error);
      return;
    }

    const withCoords = allCustomers.filter(c => c.latitude && c.longitude);
    const withoutCoords = allCustomers.filter(c => !c.latitude || !c.longitude);

    console.log(`✅ Total customers: ${allCustomers.length}`);
    console.log(`📍 With coordinates: ${withCoords.length}`);
    console.log(`⚠️  Without coordinates: ${withoutCoords.length}`);

    // Step 2: Find Audiosight customers
    console.log('\n📊 Step 2: Finding Audiosight customers...\n');

    const audiosightCustomers = allCustomers.filter(c => {
      let products = [];
      
      if (Array.isArray(c.products_interested)) {
        products = c.products_interested;
      } else if (typeof c.products_interested === 'string') {
        try {
          products = JSON.parse(c.products_interested);
        } catch (e) {
          products = [c.products_interested];
        }
      } else if (c.products_interested) {
        products = [String(c.products_interested)];
      }
      
      // Case-insensitive search for Audiosight
      return products.some(p => 
        String(p).toLowerCase().includes('audiosight')
      );
    });

    console.log(`🎯 Found ${audiosightCustomers.length} Audiosight customers`);

    if (audiosightCustomers.length === 0) {
      console.log('\n%c⚠️  NO AUDIOSIGHT CUSTOMERS FOUND!', 'font-size: 16px; font-weight: bold; color: #f59e0b; background: #fef3c7; padding: 8px;');
      console.log('\nPossible reasons:');
      console.log('1. The product name is spelled differently');
      console.log('2. The customers haven\'t been imported yet');
      console.log('3. Check what products actually exist (see Step 3 below)');
    } else {
      const audiosightWithCoords = audiosightCustomers.filter(c => c.latitude && c.longitude);
      const audiosightWithoutCoords = audiosightCustomers.filter(c => !c.latitude || !c.longitude);

      console.log(`📍 With coordinates: ${audiosightWithCoords.length}`);
      console.log(`❌ Missing coordinates: ${audiosightWithoutCoords.length}`);

      if (audiosightWithoutCoords.length > 0) {
        console.log('\n%c⚠️  ISSUE FOUND: Audiosight customers missing coordinates!', 'font-size: 16px; font-weight: bold; color: #ef4444; background: #fee2e2; padding: 8px;');
        console.log('\n🔧 SOLUTION: Go to Customer Management page and click "Geocode Missing" button');
        
        console.log('\n📋 Customers missing coordinates:');
        console.table(audiosightWithoutCoords.map(c => ({
          name: c.name || c.company || 'N/A',
          city: c.city || 'N/A',
          state: c.state || 'N/A',
          zip: c.postal_code || 'N/A',
          latitude: c.latitude || '❌ Missing',
          longitude: c.longitude || '❌ Missing'
        })));
      } else {
        console.log('\n%c✅ All Audiosight customers have coordinates!', 'font-size: 16px; font-weight: bold; color: #10b981; background: #d1fae5; padding: 8px;');
        console.log('\nIf they still don\'t show on the map, the issue is likely with the product FILTER.');
        console.log('Check the map filter to ensure "Audiosight" is selected or "Select All" is clicked.');
        
        console.log('\n📋 Audiosight customers with coordinates:');
        console.table(audiosightWithCoords.slice(0, 10).map(c => ({
          name: c.name || c.company || 'N/A',
          city: c.city,
          state: c.state,
          zip: c.postal_code,
          lat: c.latitude.toFixed(4),
          lng: c.longitude.toFixed(4)
        })));
      }
    }

    // Step 3: Check what products actually exist
    console.log('\n📊 Step 3: Analyzing all product names...\n');

    const allProducts = new Set();
    const productStats = {};

    allCustomers.forEach(c => {
      let products = [];
      
      if (Array.isArray(c.products_interested)) {
        products = c.products_interested;
      } else if (typeof c.products_interested === 'string') {
        try {
          products = JSON.parse(c.products_interested);
        } catch (e) {
          products = [c.products_interested];
        }
      } else if (c.products_interested) {
        products = [String(c.products_interested)];
      }
      
      products.forEach(p => {
        const productName = String(p);
        allProducts.add(productName);
        
        if (!productStats[productName]) {
          productStats[productName] = {
            total: 0,
            withCoords: 0,
            withoutCoords: 0
          };
        }
        
        productStats[productName].total++;
        if (c.latitude && c.longitude) {
          productStats[productName].withCoords++;
        } else {
          productStats[productName].withoutCoords++;
        }
      });
    });

    console.log(`🏷️  Found ${allProducts.size} unique product names:`);
    console.log(Array.from(allProducts).join(', '));

    console.log('\n📊 Product statistics:');
    console.table(productStats);

    // Step 4: Check if there's a case mismatch
    const audiosightVariations = Array.from(allProducts).filter(p => 
      p.toLowerCase().includes('audio')
    );

    if (audiosightVariations.length > 0) {
      console.log('\n🔍 Found these audio-related products:');
      console.log(audiosightVariations);
      
      if (audiosightVariations.length > 1 || !audiosightVariations.includes('Audiosight')) {
        console.log('\n%c⚠️  POSSIBLE ISSUE: Product name spelling/case mismatch!', 'font-size: 14px; font-weight: bold; color: #f59e0b;');
        console.log('The product might be stored as:', audiosightVariations[0]);
        console.log('But the filter might be looking for: Audiosight');
      }
    }

    // Final recommendations
    console.log('\n═'.repeat(80));
    console.log('%c📋 DIAGNOSTIC SUMMARY', 'font-size: 18px; font-weight: bold; color: #3b82f6;');
    console.log('═'.repeat(80));

    if (audiosightCustomers.length === 0) {
      console.log('\n%c❌ PROBLEM: No Audiosight customers found', 'font-weight: bold; color: #ef4444;');
      console.log('\n✅ SOLUTIONS:');
      console.log('1. Import your Audiosight customers via CSV Import');
      console.log('2. Check that the product name matches exactly:', Array.from(allProducts));
    } else if (audiosightWithoutCoords.length > 0) {
      console.log('\n%c❌ PROBLEM: Audiosight customers missing coordinates', 'font-weight: bold; color: #ef4444;');
      console.log(`   ${audiosightWithoutCoords.length} of ${audiosightCustomers.length} customers have no lat/lng`);
      console.log('\n✅ SOLUTION:');
      console.log('1. Go to: /customers (Customer Management page)');
      console.log('2. Click the orange "Geocode Missing" button');
      console.log('3. Wait for geocoding to complete');
      console.log('4. Refresh the map page');
    } else {
      console.log('\n%c✅ ALL GOOD: Audiosight customers have coordinates', 'font-weight: bold; color: #10b981;');
      console.log('\n🔍 If they still don\'t appear on the map:');
      console.log('1. Check the product filter on the map page');
      console.log('2. Make sure "Audiosight" is selected or click "Select All"');
      console.log('3. Check browser console for filter warnings');
      console.log('4. Try refreshing the page (Cmd+R or Ctrl+R)');
    }

    console.log('\n═'.repeat(80));
    console.log('✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    console.error('Full error details:', error);
  }
})();


