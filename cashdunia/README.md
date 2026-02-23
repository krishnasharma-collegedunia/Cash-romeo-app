# Cash Dunia — React Native + Expo App

## Quick Start

### Install dependencies (run once)
```bash
cd cashdunia
npm install
```

### For Android (Expo Go QR code)
```bash
npx expo start
```
Then scan the QR code with **Expo Go** app on Android.

### For Web (browser testing)
```bash
npx expo start --web
# OR build static web:
npx expo export --platform web && npx serve dist
```

### Build Android APK
```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

---

## Fixes Applied (what was wrong)

1. **`react-native-worklets` missing** — reanimated v4 needs it as peer dep
2. **`react-dom` version mismatch** — must match `react` (19.1.0)
3. **`babel-preset-expo` missing** — needed at root level
4. **Duplicate babel plugin** — reanimated's plugin already includes worklets
5. **Web platform not in app.json** — added `"web"` section
6. **`pointerEvents` prop** — moved to style for web compat

## Corrected babel.config.js
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

## Required package.json dependencies (key ones)
```json
{
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "react-native-web": "^0.21.2",
  "react-native-worklets": "^0.5.1",
  "react-native-reanimated": "~4.1.1",
  "@expo/metro-runtime": "^6.1.2",
  "babel-preset-expo": "latest"
}
```

## Supabase Setup
- Project: qhjcmyszufmbcvdpsdjk (Mumbai, ap-south-1)
- Email confirmation: **disabled** (for dev)
- Tables deployed: users, user_streaks, offer_history, withdrawals, referrals, tasks
