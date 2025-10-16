# 🗺️ Vercel Map Display Debug Guide

## Vấn đề đã fix
✅ **Map initialization timing** - Map giờ sẽ khởi tạo ngay lập tức thay vì đợi data load
✅ **Source update logging** - Thêm chi tiết logging để debug dễ hơn  
✅ **Defensive checks** - Xử lý các edge cases khi sources chưa ready

---

## 🔍 Cách Debug trên Browser

### Bước 1: Mở Console trên Vercel
1. Mở app của bạn trên Vercel
2. Nhấn `F12` hoặc `Right-click → Inspect`
3. Chọn tab **Console**

### Bước 2: Kiểm tra các logs sau

#### ✅ Logs BẮT BUỘC phải xuất hiện (theo thứ tự):

```
✅ Loaded products from database: [...]
Fetched sites data: X total customers
✅ Loaded X sites (Y with coordinates)
🗺️ Initializing map (sites loaded: X)
✅ Map instance created
🎉 Map loaded event fired!
✅ All 3 map sources created: favorites-sate, favorites-audiosight, favorites-other
✅ All map layers and click handlers added successfully
🎊 Map initialization complete! Ready to display data.
Created X valid GeoJSON features from Y sites
🗺️ Updating map: X SATE (blue), Y AudioSight (red), Z other
✅ Updated SATE source
✅ Updated AudioSight source
✅ Updated Other source
✅ Displaying X valid features on map
```

#### ⚠️ Nếu thấy logs LỖI:

```
❌ SATE source not found - map may not be fully loaded
❌ AudioSight source not found - map may not be fully loaded
❌ Other source not found - map may not be fully loaded
⚠️ refreshSafe: map.current is null
⚠️ refreshSafe: map not ready yet
```

➡️ **Nguyên nhân**: Race condition giữa data loading và map initialization
➡️ **Giải pháp**: Refresh trang (Ctrl+R) - nếu vẫn lỗi, xem phần dưới

---

## 🐛 Debug từng bước

### Case 1: Không có log "Map instance created"
**Nguyên nhân**: Map container chưa render hoặc MapLibre GL JS không load

**Giải pháp**:
1. Check Network tab → tìm `maplibre-gl.css` và `maplibre-gl.js`
2. Nếu 404 → Add vào `index.html`:
```html
<link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
```

### Case 2: Log "Map instance created" nhưng không có "Map loaded event fired"
**Nguyên nhân**: Map style hoặc base tiles không load được

**Giải pháp**:
1. Check Network tab → xem requests đến `basemaps.cartocdn.com`
2. Nếu blocked → có thể Vercel server location bị chặn
3. Thử đổi map style sang Maptiler:
```javascript
// In App.js, replace CARTO tiles with:
tiles: [
  'https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=YOUR_MAPTILER_KEY'
]
```

### Case 3: Map load nhưng không có điểm
**Nguyên nhân**: Data không có coordinates hoặc features không valid

**Kiểm tra logs**:
```
⚠️ Site missing coordinates (will not appear on map): {...}
Created 0 valid GeoJSON features from X sites
```

**Giải pháp**: Geocode customers bằng tool có sẵn:
1. Vào **Customer Management**
2. Click **Geocode Missing Locations**
3. Đợi xử lý xong
4. Refresh map

### Case 4: Map và data đều load nhưng clusters rỗng
**Nguyên nhân**: Features có coordinates không hợp lệ hoặc filter loại bỏ hết

**Debug**:
```javascript
// Check trong Console:
validFeatures.length < filteredFeatures.length
```

**Giải pháp**: 
- Reset filters (click **Reset** trong sidebar)
- Check coordinates trong database:
  - Latitude: -90 đến 90
  - Longitude: -180 đến 180

---

## 🧪 Test Local trước khi Deploy

### 1. Build production locally
```bash
cd frontend
npm run build
```

### 2. Serve production build
```bash
npx serve -s build
```

### 3. Test trên `http://localhost:3000`
- Mở Console
- Verify tất cả logs xuất hiện đúng
- Test click vào clusters
- Test filters
- Test refresh data

### 4. Nếu local OK → Deploy lên Vercel
```bash
git add .
git commit -m "fix: map initialization timing and add debug logging"
git push origin main
```

---

## 📊 Verify Data trong Supabase

### Check customers có coordinates:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(latitude) as with_lat,
  COUNT(longitude) as with_lng
FROM customers;
```

### Check products:
```sql
SELECT 
  "product(s)_interested",
  COUNT(*) as count
FROM customers
WHERE latitude IS NOT NULL
GROUP BY "product(s)_interested";
```

### Lấy sample customers:
```sql
SELECT 
  name, city, state, 
  latitude, longitude,
  "product(s)_interested"
FROM customers
WHERE latitude IS NOT NULL
LIMIT 10;
```

---

## 🎯 Expected Results

### Sau khi fix, bạn sẽ thấy:
- ✅ Map hiển thị ngay sau khi page load
- ✅ Clusters (circles) xuất hiện với đúng màu:
  - 🔴 Red: AudioSight
  - 🔵 Blue: SATE
  - 🟣 Purple: Multiple Products
  - 🟢 Green: Other products
- ✅ Click cluster → hiển thị popup với list customers
- ✅ Zoom in → cluster tách thành điểm đơn lẻ
- ✅ Click điểm → hiển thị chi tiết customer

---

## 🆘 Vẫn không work?

### Share thông tin sau:
1. Screenshot Console logs (toàn bộ)
2. Screenshot Network tab (filter: `maplibre`, `carto`, `supabase`)
3. Sample data từ Supabase:
```sql
SELECT * FROM customers LIMIT 5;
```
4. Environment variables đã set trên Vercel:
   - ✅ `REACT_APP_SUPABASE_URL`
   - ✅ `REACT_APP_SUPABASE_ANON_KEY`

---

## 📝 Changelog
**Date**: October 16, 2025

**Fixed**:
- Map initialization no longer waits for sites data to load
- Added comprehensive logging throughout map lifecycle
- Added defensive checks in `refreshSafe()` function
- Empty dependency array for map init useEffect (only run once)
- Better error messages for debugging

**Testing**:
- ✅ Local development
- ⏳ Vercel production (pending user test)

---

**Last Updated**: October 16, 2025

