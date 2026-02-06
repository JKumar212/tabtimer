# 💊 Medicine Reminder Web App

A modern, production-ready healthcare application for elderly patients to manage medicine schedules with voice reminders.

## 🚀 Features

### For Caregivers
- ✅ Create and manage patient accounts
- ✅ Add medicines with schedules
- ✅ Record voice instructions in any language
- ✅ Track medicine intake with weekly reports
- ✅ Low stock notifications
- ✅ Free plan (3 medicines) & Paid plan (unlimited)

### For Patients
- ✅ Simple, elder-friendly interface
- ✅ Automatic medicine reminders
- ✅ Voice playback of instructions
- ✅ One-tap "Taken" button
- ✅ Stock tracking

## 📦 Technology Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Storage**: LocalStorage + IndexedDB
- **Authentication**: SHA-256 password hashing
- **Hosting**: GitHub Pages (static hosting)

## 🛠️ Setup Instructions

### 1. Clone or Download
```bash
git clone https://github.com/YOUR_USERNAME/medicine-reminder-app.git
cd medicine-reminder-app
```

### 2. Project Structure
```
medicine-reminder-app/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── database.js
│   ├── auth.js
│   ├── caregiver.js
│   └── patient.js
└── README.md
```

### 3. Deploy to GitHub Pages

1. Create a new repository on GitHub
2. Push your code:
```bash
git init
git add .
git commit -m "Initial commit - Medicine Reminder App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/medicine-reminder-app.git
git push -u origin main
```

3. Enable GitHub Pages:
   - Go to repository **Settings**
   - Click **Pages** in the sidebar
   - Source: Select **main** branch
   - Folder: **/ (root)**
   - Click **Save**

4. Your app will be live at:
   `https://YOUR_USERNAME.github.io/medicine-reminder-app/`

## 🎯 Usage Guide

### For Caregivers

1. **Sign Up**: Create a caregiver account with email and password
2. **Add Patient**: Create patient accounts for elderly family members
3. **Add Medicines**: 
   - Select patient
   - Enter medicine name
   - Set time (24-hour format)
   - Set stock quantity
   - Choose text or voice instructions
4. **Monitor**: View weekly reports of taken/missed medicines

### For Patients

1. **Login**: Use credentials provided by caregiver
2. **Keep Page Open**: The app checks for reminders every minute
3. **Take Medicine**: When alert appears, click "I Took My Medicine"

## 🔒 Security Features

- ✅ SHA-256 password hashing
- ✅ Session management with localStorage
- ✅ Client-side data encryption
- ✅ No server-side dependencies

## 📱 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Note**: Microphone access required for voice recording features.

## 🔧 Local Development

To test locally:

1. Simply open `index.html` in your browser, or
2. Use a local server:
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```

Then visit `http://localhost:8000`

## 📊 Data Storage

- **Users**: Stored in `localStorage` as JSON
- **Medicines**: Stored in `localStorage` as JSON
- **Voice Files**: Stored in `IndexedDB` as Blobs
- **Sessions**: Stored in `localStorage`

## 🔄 Reset Data

To clear all data (for testing):

Open browser console and run:
```javascript
DB.clearAllData();
```

## 🎨 Customization

### Change Colors

Edit `css/styles.css` and modify gradient colors:
```css
/* Primary gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Alert gradient */
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
```

### Change Free Plan Limit

Edit `js/database.js`:
```javascript
// Free plan limit (line ~137)
if (caregiverMedicines.length >= 3) {
  // Change 3 to your desired limit
}
```

## 📝 License

MIT License - feel free to use for personal or commercial projects.

## 🤝 Contributing

Contributions welcome! Please open an issue or submit a pull request.

## 📧 Support

For issues or questions, please open a GitHub issue.

---

**Built with ❤️ for elderly healthcare**