# Diagnosing Missing Audiosight Customers on Map

## The Problem
Your 20 Audiosight customers exist in the database but **don't appear on the map** because they're missing latitude/longitude coordinates.

## Quick Diagnosis (In Browser Console)

Open your app and run these commands in the browser console (F12):

### 1. Check Audiosight customers in database:
```javascript
// Paste this in browser console
const { data, error } = await supabase
  .from('customers')
  .select('id, name, company, city, state, postal_code, latitude, longitude, products_interested')
  .contains('products_interested', ['Audiosight']);

console.log('Audiosight customers:', data.length);
console.log('With coordinates:', data.filter(c => c.latitude && c.longitude).length);
console.log('Without coordinates:', data.filter(c => !c.latitude || !c.longitude).length);
console.table(data.map(c => ({
  name: c.name,
  city: c.city,
  state: c.state,
  zip: c.postal_code,
  lat: c.latitude,
  lng: c.longitude,
  hasCoords: !!(c.latitude && c.longitude)
})));
```

### 2. Check what products are in the database:
```javascript
// Check products_interested format
const { data } = await supabase
  .from('customers')
  .select('products_interested')
  .limit(20);

const products = new Set();
data.forEach(c => {
  if (Array.isArray(c.products_interested)) {
    c.products_interested.forEach(p => products.add(p));
  } else if (typeof c.products_interested === 'string') {
    try {
      const parsed = JSON.parse(c.products_interested);
      parsed.forEach(p => products.add(p));
    } catch (e) {
      products.add(c.products_interested);
    }
  }
});

console.log('All products in database:', Array.from(products));
```

## Solutions

### Option 1: Run the Node.js Geocoding Script

If you have Node.js installed:

1. Install dependencies:
```bash
cd /Users/hoanglong/Downloads/Customer-Atlas-A-Map-Driven-CRM-for-Outreach-main\ 9
npm install @supabase/supabase-js node-fetch
```

2. Set environment variables:
```bash
export VITE_SUPABASE_URL="your_supabase_url"
export VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

3. Run the script:
```bash
node geocode-missing-customers.js
```

### Option 2: Re-import the CSV

The CSV import process includes automatic geocoding. If you still have the original CSV file:

1. Go to the Customer Management page
2. Click "Import CSV"
3. Select "Audiosight" product
4. Upload your CSV file
5. The import will automatically geocode addresses

**Note:** This might create duplicate entries if you don't delete the old ones first.

### Option 3: Manual SQL Update (If you have Supabase access)

Run this SQL in your Supabase SQL editor to geocode via zip codes:

```sql
-- This is a placeholder - you'll need to geocode externally and update
-- Check customers without coordinates for Audiosight
SELECT 
  id,
  name,
  city,
  state,
  postal_code,
  products_interested,
  latitude,
  longitude
FROM customers
WHERE 
  products_interested @> '["Audiosight"]'
  AND (latitude IS NULL OR longitude IS NULL);
```

## Why This Happened

Looking at your CSV import code (frontend/src/lib/api.js lines 627-654), the geocoding should happen automatically during import:

```javascript
// If no coordinates in CSV, geocode now
if (!latitude || !longitude) {
  const geocoded = await geocodeForImport(
    row.address || '',
    row.city || '',
    row.state || '',
    zipCode
  );
  
  if (geocoded) {
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
  }
}
```

Possible reasons geocoding failed:
1. ❌ **Invalid/missing zip codes** in the CSV
2. ❌ **API rate limiting** - too many requests too fast
3. ❌ **Invalid addresses** that couldn't be geocoded
4. ❌ **Network errors** during import

## Verify the Fix

After geocoding, check the map filter in your app:

1. Open the map view
2. Open browser console (F12)
3. Look for warnings like:
   ```
   ⚠️ Site missing coordinates (will not appear on map)
   ```
4. Count customers with coordinates:
   ```javascript
   // In console
   const { data } = await supabase
     .from('customers')
     .select('latitude, longitude, products_interested')
     .contains('products_interested', ['Audiosight']);
   
   console.log('Audiosight with coords:', 
     data.filter(c => c.latitude && c.longitude).length + '/' + data.length
   );
   ```

## Need Help?

If the script doesn't work, share:
1. How many customers have coordinates vs don't
2. Sample zip codes from your Audiosight customers
3. Any error messages from the console


