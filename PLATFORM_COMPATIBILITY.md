# QuestScribe - Platform Compatibility Guide

This document outlines the cross-platform compatibility status and requirements for building QuestScribe on Windows, macOS, and Linux.

## ✅ Platform Support Status

| Platform | Status | Tested |
|----------|--------|--------|
| **Windows 10/11** | ✅ Fully Supported | Yes |
| **macOS (10.15+)** | ✅ Fully Supported | Not yet |
| **Linux (Ubuntu, Fedora, Debian)** | ✅ Fully Supported | Not yet |

## Icon Files

All required icon files are now present:

- ✅ `icon.icns` - macOS bundle icon (329KB, generated)
- ✅ `icon.ico` - Windows executable icon
- ✅ `32x32.png` - Linux/Windows tray icon
- ✅ `128x128.png` - Standard resolution icon
- ✅ `128x128@2x.png` - Retina/HiDPI displays

### Regenerating Icons

If you need to regenerate the macOS icon file:

```bash
npm install --save-dev png2icons
node generate-icons.js
```

The script generates `icon.icns` from `128x128@2x.png`.

## Platform-Specific Build Requirements

### Windows

**Prerequisites:**
- Visual Studio Build Tools (C++ build tools)
- Rust toolchain (`rustup`)
- Node.js 16+

**Build Command:**
```bash
npm run build
npm run tauri build
```

**Output:**
- `.exe` installer in `src-tauri/target/release/bundle/nsis/`
- Portable `.exe` in `src-tauri/target/release/`

### macOS

**Prerequisites:**
- Xcode Command Line Tools
- Rust toolchain (`rustup`)
- Node.js 16+

**Build Command:**
```bash
npm run build
npm run tauri build
```

**Output:**
- `.dmg` installer in `src-tauri/target/release/bundle/dmg/`
- `.app` bundle in `src-tauri/target/release/bundle/macos/`

**Code Signing (Optional but Recommended):**
For distribution outside the App Store, you'll need to sign the app:
```bash
codesign --force --deep --sign "Developer ID Application: Your Name" ./QuestScribe.app
```

### Linux

**Prerequisites:**
- Rust toolchain (`rustup`)
- Node.js 16+
- System dependencies:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

  # Fedora
  sudo dnf install webkit2gtk3-devel openssl-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel

  # Arch
  sudo pacman -S webkit2gtk base-devel curl wget openssl gtk3 libappindicator-gtk3 librsvg
  ```

**Build Command:**
```bash
npm run build
npm run tauri build
```

**Output:**
- `.deb` package (Debian/Ubuntu) in `src-tauri/target/release/bundle/deb/`
- `.AppImage` (universal) in `src-tauri/target/release/bundle/appimage/`
- `.rpm` package (Fedora) in `src-tauri/target/release/bundle/rpm/`

## Cross-Platform Compatibility Features

### ✅ File Paths
- Uses Rust's `PathBuf` for platform-agnostic path handling
- No hardcoded path separators (`/` or `\`)
- Works correctly on all platforms

### ✅ File Dialogs
- Tauri's dialog API works consistently across platforms
- Native file picker on each OS
- Filters work correctly (`.qsd`, `.txt`, `.rtf`, `.docx`)

### ✅ Export Formats
- **TXT**: Plain text (universal)
- **RTF**: Rich Text Format (Windows, macOS, Linux)
- **DOCX**: Microsoft Word format (Windows, macOS, Linux)

All export formats are generated platform-independently.

### ✅ Window Management
- Native window decorations on each platform
- Respects OS-specific window behavior
- Minimum window size enforced: 800x600

### ✅ Keyboard Shortcuts
- `Ctrl` on Windows/Linux
- `Cmd` on macOS (automatically mapped by ProseMirror)

Common shortcuts:
- `Ctrl/Cmd + B` - Bold
- `Ctrl/Cmd + I` - Italic
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Ctrl/Cmd + S` - Save

## Known Platform Differences

### macOS
- App icon appears in dock
- Menu bar integration (native macOS menu)
- File association requires code signing for production

### Windows
- System tray icon supported
- Windows Defender may flag first run (submit to Microsoft for whitelisting)
- `.exe` installer creates Start Menu shortcuts

### Linux
- Desktop integration via `.desktop` file
- Icon themes may affect appearance
- Different distributions may have slightly different widget rendering

## Testing Checklist

Before releasing for a platform, verify:

- [ ] Application launches without errors
- [ ] File dialogs work (New, Open, Save, Export)
- [ ] Icons display correctly
- [ ] Text editing functions properly
- [ ] State change markers can be created and edited
- [ ] Documents can be saved and loaded
- [ ] Export to TXT, RTF, DOCX works
- [ ] Keyboard shortcuts work
- [ ] Window resizing works
- [ ] Dark mode toggle works

## Distribution Recommendations

### Windows
- Distribute `.exe` installer (NSIS)
- Consider code signing certificate for trusted installation

### macOS
- Distribute `.dmg` disk image
- **Required**: Code sign with Apple Developer certificate
- **Optional**: Notarize with Apple for Gatekeeper approval

### Linux
- Distribute `.AppImage` (universal, no installation required)
- Also provide `.deb` and/or `.rpm` for package managers
- Consider Flatpak or Snap for wider distribution

## Version Support

- **Windows**: Windows 10 (1809+) and Windows 11
- **macOS**: 10.15 Catalina and later
- **Linux**: Recent distributions with GTK 3.24+

## Building Multi-Platform with GitHub Actions

While you **cannot** cross-compile Tauri applications locally, **GitHub Actions can build for all platforms automatically** using their hosted runners!

### Automated Builds (Recommended)

The repository includes GitHub Actions workflows that build for all three platforms:

**`.github/workflows/build.yml`** - Builds on every push
- ✅ Runs on Windows, macOS, and Linux runners
- ✅ Automatically generates icons
- ✅ Uploads build artifacts
- ✅ Runs on every commit to main

**`.github/workflows/release.yml`** - Creates releases
- ✅ Triggered by version tags (e.g., `v0.1.0`)
- ✅ Creates universal macOS binary (Intel + Apple Silicon)
- ✅ Builds all installers (.exe, .dmg, .deb, .AppImage)
- ✅ Creates GitHub release with all artifacts

**`.github/workflows/test.yml`** - Runs tests
- ✅ Verifies build succeeds
- ✅ Checks icon files exist
- ✅ Runs Rust linter (clippy)

### How to Create a Release

1. **Update version** in `package.json` and `src-tauri/Cargo.toml`
2. **Commit changes**: `git commit -am "Bump version to 0.1.0"`
3. **Create and push tag**:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. **Wait for GitHub Actions** to build all platforms (~10-15 minutes)
5. **Check the Releases page** for the draft release with all installers
6. **Edit release notes** and publish

### Manual Local Builds (Alternative)

If you need to build locally, each platform must be built on its native OS:
- Build Windows binaries on Windows
- Build macOS binaries on macOS
- Build Linux binaries on Linux

## Troubleshooting

### "Icon not found" error during build
Run `node generate-icons.js` to regenerate the macOS icon.

### Build fails on Linux
Install all system dependencies listed above for your distribution.

### macOS Gatekeeper blocks app
The app needs to be code signed. For development, users can right-click → Open to bypass.

### Windows SmartScreen warning
Submit the signed binary to Microsoft for reputation building, or users can click "More info" → "Run anyway".

## Further Reading

- [Tauri Platform-Specific Configuration](https://tauri.app/v1/guides/building/platform-specifics)
- [Tauri Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-macos)
- [Tauri Updater (for auto-updates)](https://tauri.app/v1/guides/distribution/updater)
