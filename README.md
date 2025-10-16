# MapPlot - A Map-Driven CRM for Outreach

This project develops a web application that centralizes customer maintenance in a map-first interface.

## Features

- **Interactive Map**: A U.S. map at the top displays customer sites as interactive markers, clustered and color-coded by product interest (e.g., ArmRehab, AudioSight).

- **Customer List**: A sortable list below includes registration date, location (state/ZIP), contacts, notes, and next steps.

- **Linked Views**: The map and list are connected, enabling fast filtering along with basic add/edit functionality.

- **Analytics Dashboard**: View insights about customer distribution, product interest, and registration trends.

- **🤖 AI Marketing Insights** (NEW): AI-powered marketing analysis using Google Gemini. Get actionable insights on geographic expansion, product opportunities, lead conversion strategies, and risk areas - all in real-time!

This design helps the team identify geographic patterns, prioritize outreach, and track follow-ups more reliably.

## Technology Stack

- **Frontend**: React 19, MapLibre GL, React Router
- **Backend**: Supabase (PostgreSQL database + Authentication)
- **AI/ML**: OpenRouter API + Google Gemini 2 27B (Free)
- **Deployment**: Vercel (recommended)
- **Mapping**: MapTiler, OpenStreetMap

## Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd MapPlot
   ```

2. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Set up environment variables**
   - Create `frontend/.env` file
   - Add your credentials:
     ```env
     # Supabase (Required)
     REACT_APP_SUPABASE_URL=https://your-project.supabase.co
     REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
     
     # OpenRouter for AI Insights (Optional)
     REACT_APP_OPENROUTER_API_KEY=sk-or-v1-your-key-here
     ```
   - See [AI Insights Setup Guide](./AI_INSIGHTS_QUICKSTART.md) for AI feature

4. **Run the development server**
   ```bash
   npm start
   ```
   
   The app will open at `http://localhost:3000`

### Vercel Deployment

For production deployment to Vercel, see the detailed guide:

📖 **[VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)**

Quick deploy:
1. Push code to Git repository
2. Import to Vercel
3. Set environment variables (REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)
4. Deploy!

## Available Routes

- `/` - Main map view (authentication required)
- `/login` - Login page
- `/customers` - Customer management page
- `/accept-invite` - Accept team invitation

## Project Structure

```
MapPlot/
├── frontend/
│   ├── public/           # Static assets
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── lib/          # API and utilities
│   │   ├── styles/       # CSS files
│   │   ├── App.js        # Main app component with map
│   │   └── index.js      # Entry point with routing
│   └── package.json      # Dependencies
├── vercel.json           # Vercel deployment config
└── VERCEL_DEPLOYMENT_GUIDE.md  # Deployment instructions

```

## Additional Guides

### Core Features
- [CSV Import Guide](./CSV_IMPORT_GUIDE.md)
- [Customer Management Guide](./CUSTOMER_MANAGEMENT_GUIDE.md)
- [Geocoding Guide](./GEOCODING_GUIDE.md)
- [Schema Fix Guide](./SCHEMA_FIX_GUIDE.md)

### AI Marketing Insights (NEW) 🤖
- [🚀 Quick Start (5 min)](./AI_INSIGHTS_QUICKSTART.md) - Get started fast
- [📚 Full Setup Guide](./AI_INSIGHTS_SETUP.md) - Detailed instructions
- [📝 Technical Docs](./CHANGELOG_AI_INSIGHTS.md) - For developers
- [✅ Summary](./AI_INSIGHTS_SUMMARY.md) - Feature overview

## Support

For questions or issues:
- Check the relevant guide in the project root
- Review the [Vercel Deployment Guide](./VERCEL_DEPLOYMENT_GUIDE.md) for deployment issues
- Check browser console for client-side errors
- Verify Supabase connection and credentials