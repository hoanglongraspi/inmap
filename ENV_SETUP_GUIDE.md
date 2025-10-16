# 🔧 Environment Variables Setup Guide

## Quick Setup

### Bước 1: Tạo file `.env`
```bash
cd frontend
touch .env
```

### Bước 2: Copy template này vào file `.env`

```env
# ============================================
# CUSTOMER ATLAS CRM - Environment Variables
# ============================================

# Supabase Configuration (REQUIRED)
# Get these from: https://supabase.com/dashboard/project/_/settings/api
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here

# OpenRouter AI Configuration (OPTIONAL - for AI Marketing Insights)
# Get free API key from: https://openrouter.ai/
# Model used: google/gemma-2-27b-it:free (100% FREE)
REACT_APP_OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

### Bước 3: Điền thông tin của bạn

#### Lấy Supabase Credentials (BẮT BUỘC)
1. Vào https://supabase.com/dashboard
2. Chọn project của bạn
3. Vào **Settings** → **API**
4. Copy:
   - **Project URL** → `REACT_APP_SUPABASE_URL`
   - **anon public** key → `REACT_APP_SUPABASE_ANON_KEY`

#### Lấy OpenRouter API Key (TÙY CHỌN - chỉ cho AI features)
1. Vào https://openrouter.ai/
2. Sign in với Google/GitHub
3. Vào **Keys** → **Create Key**
4. Copy key → `REACT_APP_OPENROUTER_API_KEY`

### Bước 4: Restart app
```bash
npm start
```

---

## ⚠️ Important Notes

### Security
- ✅ File `.env` đã tự động git-ignored
- ✅ KHÔNG commit file này lên Git
- ✅ KHÔNG share API keys công khai

### Troubleshooting

**Error: "Missing Supabase environment variables"**
```
→ Bạn chưa tạo .env hoặc thiếu keys
→ Check lại file frontend/.env
```

**AI Insights không hoạt động**
```
→ Thiếu REACT_APP_OPENROUTER_API_KEY
→ Thêm key vào .env và restart app
```

**Changes không apply**
```
→ Cần restart app sau khi sửa .env
→ Ctrl+C rồi npm start lại
```

---

## 📝 Example File Structure

```
frontend/
├── .env                  ← Your actual config (git-ignored)
├── .env.example          ← Template (nếu có)
├── src/
├── public/
└── package.json
```

---

## ✅ Verify Setup

Sau khi setup xong, test bằng cách:

1. **Start app**: `npm start`
2. **Check console**: Không có error về env variables
3. **Test Supabase**: Login/logout hoạt động
4. **Test AI** (optional): Generate insights in Analytics tab

---

## 🚀 One-Line Setup (Advanced)

Tạo file `.env` nhanh:

```bash
cd frontend
cat > .env << 'EOF'
REACT_APP_SUPABASE_URL=your-url-here
REACT_APP_SUPABASE_ANON_KEY=your-key-here
REACT_APP_OPENROUTER_API_KEY=your-openrouter-key-here
EOF
```

Sau đó edit file và điền thông tin thật.

---

## 📚 Related Guides

- [AI Insights Quick Start](./AI_INSIGHTS_QUICKSTART.md)
- [AI Insights Setup](./AI_INSIGHTS_SETUP.md)
- [Main README](./README.md)

---

**Last Updated**: October 16, 2025

