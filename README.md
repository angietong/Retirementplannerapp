# Retirement Financial Planner — iPad Standalone Setup

This application is fully optimized for iPad and mobile devices, supporting offline running, touch gestures, responsive card layouts, and full-screen standalone mode.

## How to Run Standalone on iPad

1. **Transfer / Open Project Files**:
   - Open your iPad local Node runner app (such as **Play.js** or **Node.js Lab**).
   - Place the project folder containing `serve.cjs`, `standalone/` (or `dist/`), and `package.json` into your local workspace.

2. **Start the Local Server**:
   - Run the included zero-dependency server script in Node.js:
     ```bash
     node serve.cjs
     ```
   - Alternatively, you can directly open `standalone/index.html` or `dist/index.html` in Safari.

3. **Add to iPad Home Screen (Standalone App Mode)**:
   - Open Safari and navigate to `http://localhost:3000` (or open the local file).
   - Tap the **Share** button in Safari.
   - Select **"Add to Home Screen"**.
   - Launch **Retirement Planner** directly from your iPad home screen as a full-screen standalone app!
