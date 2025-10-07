# Hướng Dẫn Sửa Lỗi Vercel - Map Không Hiển Thị Điểm

## ⚠️ Vấn đề
Map không hiển thị điểm khách hàng trên Vercel.

## ✅ Giải pháp

### 1. Cấu hình Environment Variables trên Vercel

**Bước 1:** Đăng nhập vào Vercel Dashboard (https://vercel.com/dashboard)

**Bước 2:** Chọn project của bạn

**Bước 3:** Vào Settings → Environment Variables

**Bước 4:** Thêm các biến sau:

```
REACT_APP_SUPABASE_URL=https://hptqahujdxybejturpgr.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdHFhaHVqZHh5YmVqdHVycGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MTY4NDMsImV4cCI6MjA3NTA5Mjg0M30.OqhvjzQ-8llp60Rq36nOGWnXQ9Tyurzjf6kF2HQJ11g
```

**Bước 5:** Chọn "All Environments" (Production, Preview, Development)

**Bước 6:** Click "Save"

**Bước 7:** Redeploy project (Deployments → ... → Redeploy)

### 2. Kiểm tra Database có dữ liệu

1. Đăng nhập Supabase: https://supabase.com/dashboard
2. Vào project: hptqahujdxybejturpgr
3. Vào Table Editor → `customers`
4. Kiểm tra các trường `latitude` và `longitude` có giá trị không null

**Quan trọng:** Các khách hàng phải có tọa độ (`latitude`, `longitude`) để hiển thị trên map!

### 3. Import dữ liệu có tọa độ

Nếu chưa có dữ liệu với tọa độ, bạn cần:

1. Vào trang Customer Management
2. Click "Import CSV"
3. Chọn file `demo-import.csv` (có sẵn trong folder public)
4. File này đã có lat/long cho tất cả khách hàng

### 4. Kiểm tra Console Log

Sau khi deploy, mở DevTools (F12) trên trang Vercel:

- Kiểm tra Console có lỗi gì không
- Tìm message: "✅ Loaded X sites (Y with coordinates)"
- Nếu Y = 0, nghĩa là không có khách hàng nào có tọa độ

### 5. Kiểm tra CORS

Nếu vẫn không load được:

1. Vào Supabase Dashboard → Settings → API
2. Kiểm tra "CORS Allowed Origins"
3. Thêm domain Vercel của bạn (ví dụ: https://your-app.vercel.app)

### 6. Rebuild và Clear Cache

```bash
# Trong Vercel Dashboard:
# Deployments → Latest → ... → Redeploy → Clear Build Cache + Redeploy
```

## 📊 Debug Checklist

✅ Environment variables đã được set trên Vercel
✅ Database có khách hàng với latitude/longitude
✅ Console không có lỗi Supabase connection
✅ Console hiển thị "Loaded X sites (Y with coordinates)" với Y > 0
✅ CORS được cấu hình đúng
✅ Đã rebuild với clear cache

## 🔍 Nếu vẫn không được

Hãy gửi cho tôi screenshot của:
1. Vercel Console (F12 → Console tab)
2. Network tab (F12 → Network) - filter "customers"
3. Supabase customers table (có bao nhiêu records với lat/long)

