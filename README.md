# 🎓 StudySpace - File Sharer & Reminder Workspace

StudySpace is a premium, client-side lofi study dashboard designed to organize your learning materials and daily routines in one cozy workspace. Built with **React, TypeScript, and Vanilla CSS**, it features a fully persistent file explorer, a digital clock with notification alarms, and optional cloud sync using Supabase Storage.

You can preview the app locally at `http://localhost:5173` or deploy it directly to Vercel!

---

## 🖼️ UI Screenshots
<img width="1531" height="719" alt="image" src="https://github.com/user-attachments/assets/13edcde4-7e16-45eb-9d07-63d7d29e7d25" />

<img width="1238" height="694" alt="image" src="https://github.com/user-attachments/assets/cc03d6d4-0d63-4ca3-a497-c4d4d68f1254" />




## 🌟 Core Features

1. **📂 Local-First File Explorer:**
   * **Drag & Drop Uploads:** Upload PDFs, notes, photos, audios, and videos.
   * **Infinite Local Storage:** Saves files directly in the browser's persistent **IndexedDB database** (supporting files up to gigabytes, preserved forever even if you close the browser or restart your computer).
   * **In-App Previews:** Direct preview modals for images, audio playbacks, video streams, and text-based documents.
   * **Instant Filtering:** Filter files by category tabs (All, Documents, Photos, Videos, Audio, Others) and quick name search.

2. **⏰ Neo-Glowing Alarm Clock:**
   * **Web Audio Synthesis:** Triggers alarm clocks using custom electronic synthesizer chime sound-waves synthesized directly via the browser's **Web Audio API** (works 100% offline, requires zero external audio files!).
   * **System Notifications:** Integrates with the browser's native **Web Notifications API** to pop up desktop reminders even when the tab is running in the background.
   * **Reminders List:** Set specific study goals with custom priority levels (Low, Medium, High).

3. **🎨 3 Blended Color Palette Themes:**
   * **Warm Rose Quartz (Light):** Cozy rose-cream background (`#f6f0e5`) and white cards.
   * **Cozy Earth (Light):** Warm sand background (`#ECEBDE`) and white cards.
   * **Midnight Desert (Dark):** Immersive dark navy background (`#202940`) and charcoal-mocha cards (`#4a433e`).

4. **☁️ Optional Cloud Sync (Supabase):**
   * Link your free **Supabase Storage** bucket from the settings panel.
   * Files upload to both local browser storage and your secure cloud bucket, syncing your catalog across multiple devices!

---

## 🛠️ How to Run Locally

1. Clone or download the workspace directory.
2. Open your terminal in the project folder and install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

---

## 🚀 How to Deploy on Vercel (For Free)

Since the app is static and client-side (no complex backend servers required), it is extremely easy to host on Vercel:

### Step 1: Upload your Code to GitHub
1. Initialize a git repository in your project folder:
   ```bash
   git init
   git add .
   git commit -m "feat: complete study space project"
   ```
2. Create a new repository on your **GitHub** account.
3. Link your local project to GitHub and push your code:
   ```bash
   git remote add origin <your-github-repo-link>
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Vercel
1. Go to [Vercel](https://vercel.com) and log in (or sign up using GitHub).
2. Click **Add New** > **Project**.
3. Import your newly uploaded GitHub repository.
4. Vercel will automatically detect **Vite** as the framework.
5. Click **Deploy**! In under 60 seconds, your site will be live with a shareable Vercel URL (e.g. `https://your-project.vercel.app`).

*(Note: The pre-configured `vercel.json` file in the root directory ensures client-side routing works smoothly without 404 page errors.)*

---

## ☁️ Optional: Setting up Supabase Cloud Sync
If you want to access your uploaded study materials across different devices (like viewing your files on a phone):
1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project.
3. Navigate to **Storage** in the left sidebar, click **Create New Bucket**, and name it `files` (make sure to set the toggle to **Public**).
4. Go to **Storage > Policies**, select your `files` bucket, and add a policy for `Select`, `Insert`, and `Delete` allowing **all users** (anonymous) access.
5. Go to **Project Settings > API**, copy the `Project URL` and `anon public` API key.
6. Open your deployed Vercel website, go to the **Cloud Sync Settings** tab, paste the credentials, and hit **Connect**. Your files will immediately sync up to your secure cloud bucket!
