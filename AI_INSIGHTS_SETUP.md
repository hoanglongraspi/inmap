# 🤖 AI Marketing Insights Setup Guide

## Tổng quan

Tính năng AI Marketing Insights đã được tích hợp vào tab **Analysis** của Customer Atlas CRM. Tính năng này sử dụng **Google Gemini 2 27B** (model miễn phí) thông qua **OpenRouter API** để phân tích dữ liệu khách hàng và cung cấp các insights marketing chuyên sâu.

---

## 🎯 Tính năng

AI sẽ phân tích dữ liệu CRM của bạn và cung cấp:

1. **Key Insights** - Các insight quan trọng từ dữ liệu
2. **Geographic Strategy** - Chiến lược marketing theo vùng địa lý
3. **Product Opportunities** - Cơ hội marketing cho từng sản phẩm
4. **Lead Conversion Tips** - Gợi ý tăng tỷ lệ chuyển đổi
5. **Risk Areas** - Các vấn đề cần chú ý

---

## 🔧 Cách setup

### Bước 1: Đăng ký OpenRouter (MIỄN PHÍ)

1. Truy cập: https://openrouter.ai/
2. Click **"Sign In"** (có thể đăng nhập bằng Google/GitHub)
3. Sau khi đăng nhập, vào **"Keys"** trong menu
4. Click **"Create Key"** để tạo API key mới
5. Copy API key (dạng: `sk-or-v1-xxxxxxxxxxxxx`)

💡 **Lưu ý**: Model `google/gemma-2-27b-it:free` là HOÀN TOÀN MIỄN PHÍ, không mất tiền!

### Bước 2: Thêm API key vào project

**Có 2 cách (khuyến nghị cách 1):**

#### **Cách 1: Sử dụng Environment Variable (BẢO MẬT)**

1. Tạo file `.env` trong folder `frontend/`:
```bash
cd frontend
touch .env
```

2. Thêm API key vào file `.env`:
```env
REACT_APP_OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
```

3. ✅ Done! App sẽ tự động đọc từ environment variable

#### **Cách 2: Hard-code vào App.js (NHANH nhưng kém bảo mật)**

1. Mở file: `frontend/src/App.js`
2. Tìm dòng **432** (hoặc search `YOUR_API_KEY_HERE`)
3. Thay thế:

```javascript
// TỪ:
const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY || 'sk-or-v1-YOUR_API_KEY_HERE';

// THÀNH:
const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY || 'sk-or-v1-your-actual-key';
```

⚠️ **Lưu ý**: Nếu dùng cách 2, KHÔNG commit file này lên Git!

### Bước 3: Restart app

```bash
cd frontend
npm start
```

---

## 📊 Cách sử dụng

1. Mở ứng dụng Customer Atlas
2. Click tab **"Analytics"** ở header
3. Scroll xuống phần **"🤖 AI Marketing Insights"** (có background gradient tím)
4. Click nút **"Generate Insights"**
5. Đợi 5-10 giây để AI phân tích
6. Xem kết quả!

---

## 🎨 Giao diện

- **Header gradient tím** - Dễ nhận biết
- **Loading animation** - Spinner quay khi đang phân tích
- **Beautiful card design** - UI hiện đại, dễ đọc
- **Success indicator** - Hiển thị thời gian generate
- **Error handling** - Thông báo rõ ràng nếu có lỗi

---

## 🔍 Dữ liệu được phân tích

AI sẽ phân tích:
- ✅ Tổng số khách hàng
- ✅ Phân bố theo status (Lead/Prospect/Customer)
- ✅ Top 5 states có nhiều khách hàng nhất
- ✅ Sản phẩm được quan tâm
- ✅ Phân bố địa lý (số state, số city)
- ✅ Xu hướng đăng ký theo tháng

---

## ⚠️ Xử lý lỗi

### Lỗi: "OpenRouter API error: 401"
- **Nguyên nhân**: API key không đúng
- **Giải quyết**: Kiểm tra lại API key ở dòng 435

### Lỗi: "No customer data available"
- **Nguyên nhân**: Chưa có dữ liệu khách hàng
- **Giải quyết**: Import CSV hoặc thêm khách hàng mới

### Lỗi: "Failed to fetch"
- **Nguyên nhân**: Không có internet hoặc OpenRouter down
- **Giải quyết**: Kiểm tra kết nối internet

---

## 🎯 Tips sử dụng hiệu quả

1. **Generate lại khi có data mới** - Click lại nút để cập nhật insights
2. **So sánh theo thời gian** - Generate định kỳ để track tiến độ
3. **Screenshot insights** - Lưu lại để báo cáo hoặc meeting
4. **Đọc kỹ Risk Areas** - Phần này giúp phát hiện vấn đề sớm

---

## 💰 Chi phí

- **Model**: `google/gemma-2-27b-it:free`
- **Cost**: **MIỄN PHÍ 100%**
- **Rate limit**: ~200 requests/day (quá đủ)
- **Max tokens**: 1500 tokens/request

---

## 🚀 Nâng cao (Optional)

Nếu muốn dùng model mạnh hơn (có phí), có thể thay đổi ở dòng 440:

```javascript
// GPT-4 Turbo (tốt nhất, ~$0.01/request)
model: 'openai/gpt-4-turbo',

// Claude 3.5 Sonnet (cân bằng, ~$0.015/request)
model: 'anthropic/claude-3.5-sonnet',

// GPT-4o mini (rẻ, ~$0.0005/request)
model: 'openai/gpt-4o-mini',
```

Xem thêm models: https://openrouter.ai/models

---

## 📧 Hỗ trợ

Nếu gặp vấn đề:
1. Check console log (F12 → Console tab)
2. Verify API key ở OpenRouter dashboard
3. Test API key bằng cURL:

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "google/gemma-2-27b-it:free",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## ✨ Kết luận

Bạn đã sẵn sàng sử dụng AI Marketing Insights! 

**Next steps:**
1. Lấy API key từ OpenRouter
2. Thêm vào code (dòng 435)
3. Restart app
4. Enjoy! 🎉

Happy analyzing! 📊🤖

