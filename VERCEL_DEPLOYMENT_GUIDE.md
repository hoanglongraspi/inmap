# Vercel Deployment Guide

This guide will help you deploy the Customer Atlas CRM application to Vercel.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup) (free tier works fine)
2. Your Supabase credentials ready (URL and anon key)
3. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Repository

1. Make sure all your changes are committed to Git:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

## Step 2: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository
4. Vercel will auto-detect it as a React app

## Step 3: Configure Build Settings

Vercel should auto-detect the settings from `vercel.json`, but verify:

- **Framework Preset**: Create React App (or None if using custom config)
- **Root Directory**: `./` (leave as root)
- **Build Command**: `cd frontend && npm install && npm run build`
- **Output Directory**: `frontend/build`
- **Install Command**: `cd frontend && npm install`

## Step 4: Set Environment Variables

In the Vercel project settings, add these environment variables:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables (get values from your Supabase dashboard):

   | Name | Value | Environment |
   |------|-------|-------------|
   | `REACT_APP_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
   | `REACT_APP_SUPABASE_ANON_KEY` | `your_anon_key_here` | Production, Preview, Development |

   **To get your Supabase credentials:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to **Settings** → **API**
   - Copy "Project URL" and "anon/public key"

## Step 5: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (usually 2-5 minutes)
3. Once deployed, Vercel will provide you with a URL like `https://your-app.vercel.app`

## Step 6: Test Your Deployment

1. Visit your Vercel URL
2. Test the following routes:
   - `/login` - Login page
   - `/` - Main map view (after login)
   - `/customers` - Customer management page
   - `/accept-invite` - Invite acceptance page

## Troubleshooting

### Issue: Blank page or 404 errors on routes

**Solution**: This is fixed by the `vercel.json` configuration file which handles SPA routing. Make sure the file is in your repository root.

### Issue: "Failed to load data" errors

**Solution**: Check your environment variables in Vercel:
- Go to **Settings** → **Environment Variables**
- Verify `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are set correctly
- After changing environment variables, **redeploy** your app

### Issue: Build fails with "command not found"

**Solution**: Make sure your `vercel.json` has the correct build commands:
```json
"buildCommand": "cd frontend && npm install && npm run build"
```

### Issue: Map doesn't load or shows errors

**Solution**: 
- Check browser console for API key issues
- Verify MapTiler API key in `App.js` (line 604)
- The default key should work, but you may want to get your own from [MapTiler](https://www.maptiler.com/)

## Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Vercel will auto-provision SSL certificate

## Continuous Deployment

Once set up, Vercel automatically deploys:
- **Production**: Every push to `main` branch
- **Preview**: Every push to other branches or pull requests

## Performance Optimization

The `vercel.json` includes:
- SPA routing configuration
- Static asset caching (1 year for `/static/*` files)
- Automatic compression

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [Supabase Documentation](https://supabase.com/docs)

## Notes

- The app uses client-side routing (React Router), so the `vercel.json` rewrites all routes to `index.html`
- Environment variables prefixed with `REACT_APP_` are embedded at build time
- Static files are cached for optimal performance
- SSL is automatically configured by Vercel

