# DeskFlow - MERN Support Ticket Triage Board

DeskFlow is a real-time support ticket triage and SLA monitoring board built with the MERN stack (MongoDB, Express, React, Node.js).

## 🚀 Live Deployment Links

- **Frontend (Netlify)**: [https://velvety-gnome-61b21f.netlify.app](https://velvety-gnome-61b21f.netlify.app)
- **GitHub Repository**: [https://github.com/mayankacro/Bajaj.git](https://github.com/mayankacro/Bajaj.git)

---

## 🛠️ Deploying the Backend on Render (Quick Steps)

Follow these simple steps to deploy the backend to Render in under 2 minutes:

1. **Go to Render**: Log in to [dashboard.render.com](https://dashboard.render.com/) and click **New > Web Service**.
2. **Connect GitHub**: Search and select the repository: `https://github.com/mayankacro/Bajaj.git`.
3. **Configure Settings**:
   - **Name**: `deskflow-backend` (or any custom name)
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. **Add Environment Variables**:
   - Scroll down to the **Environment Variables** section and click **Add Environment Variable**.
   - **Key**: `MONGO_URI`
   - **Value**: `mongodb+srv://babariyamayank07:test12345@<your_cluster_address>/deskflow?retryWrites=true&w=majority` (Make sure to replace `<your_cluster_address>` with your actual MongoDB Atlas cluster host!)
5. **Deploy**: Click **Deploy Web Service**.

Once deployed, copy the assigned backend URL (e.g. `https://deskflow-backend-mayank.onrender.com`) and update it in your Netlify settings or build setup!

---

## 📖 Short Assessment Summary

### 1. SLA Logic (Priority-based Thresholds)
- **Urgent**: 1 hour (60 minutes)
- **High**: 4 hours (240 minutes)
- **Medium**: 24 hours (1440 minutes)
- **Low**: 72 hours (4320 minutes)

### 2. Status Transitions (Kanban Columns)
- Moving tickets backwards is restricted to **only one step at a time** (e.g., `resolved` → `in_progress`).
- Moving tickets backwards **automatically clears `resolvedAt`** so the ticket starts aging again.
- Transitioning forward to `resolved` **automatically sets `resolvedAt`**.
- When transitioned forward to `closed` from `resolved`, **`resolvedAt` is preserved** (fixed critical bug where `resolvedAt` was cleared when closed).
