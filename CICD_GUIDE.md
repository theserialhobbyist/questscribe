# QuestScribe - CI/CD Guide

This guide explains how to use GitHub Actions to automatically build QuestScribe for Windows, macOS, and Linux.

## Overview

QuestScribe uses GitHub Actions to:
- ✅ Build for all three platforms simultaneously
- ✅ Run tests and linting
- ✅ Generate platform-specific installers
- ✅ Create releases automatically
- ✅ Upload build artifacts

**No need for a Mac, Windows, or Linux machine!** GitHub provides all the runners.

## Workflows

### 1. Build Workflow (`.github/workflows/build.yml`)

**Triggers:** Every push to `main` branch

**What it does:**
- Builds QuestScribe for Windows, macOS, and Linux in parallel
- Generates the macOS `.icns` icon automatically
- Runs the build process for each platform
- Uploads build artifacts for download

**Artifacts Generated:**
- **Windows**: `.exe` (NSIS installer), `.msi` (Windows Installer)
- **macOS**: `.dmg` (disk image), `.app` (application bundle)
- **Linux**: `.deb` (Debian/Ubuntu), `.AppImage` (universal)

**How to access artifacts:**
1. Go to the "Actions" tab in your GitHub repository
2. Click on the latest workflow run
3. Scroll down to "Artifacts"
4. Download `questscribe-windows`, `questscribe-macos`, or `questscribe-linux`

### 2. Release Workflow (`.github/workflows/release.yml`)

**Triggers:** When you push a version tag (e.g., `v0.1.0`)

**What it does:**
- Creates a GitHub Release
- Builds universal macOS binary (Intel + Apple Silicon)
- Builds for all platforms
- Uploads all installers to the release
- Sets the release as a draft for you to review

**How to create a release:**

```bash
# 1. Update version numbers
# Edit package.json and src-tauri/Cargo.toml

# 2. Commit the version bump
git add package.json src-tauri/Cargo.toml
git commit -m "Bump version to 0.1.0"

# 3. Create a version tag
git tag v0.1.0

# 4. Push the tag (this triggers the release workflow)
git push origin v0.1.0

# 5. Wait ~10-15 minutes for builds to complete
# 6. Check GitHub Releases page for your draft release
# 7. Edit release notes and publish!
```

**Release Artifacts:**
- `QuestScribe_0.1.0_x64_en-US.exe` - Windows installer
- `QuestScribe_0.1.0_x64.msi` - Windows MSI installer
- `QuestScribe_0.1.0_universal.dmg` - macOS disk image (Intel + ARM)
- `QuestScribe_0.1.0_amd64.deb` - Linux Debian/Ubuntu package
- `QuestScribe_0.1.0_amd64.AppImage` - Linux universal binary

### 3. Test Workflow (`.github/workflows/test.yml`)

**Triggers:** Every push and pull request

**What it does:**
- Runs quick sanity checks
- Verifies all icon files are present
- Builds the frontend
- Runs Rust linter (clippy) to catch code issues

**Prevents:**
- Missing icon files
- Broken builds
- Rust code quality issues

## Build Times

| Platform | Approximate Time |
|----------|-----------------|
| Windows | 5-8 minutes |
| macOS | 8-12 minutes |
| Linux | 4-6 minutes |

**Total parallel build time:** ~10-12 minutes (all platforms build simultaneously)

## Version Numbering

QuestScribe uses semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., `1.0.0` → `2.0.0`)
- **MINOR**: New features (e.g., `0.1.0` → `0.2.0`)
- **PATCH**: Bug fixes (e.g., `0.1.0` → `0.1.1`)

**Where to update versions:**
1. `package.json` - Line 3: `"version": "0.1.0"`
2. `src-tauri/Cargo.toml` - Line 3: `version = "0.1.0"`
3. `src-tauri/tauri.conf.json` - Line 10: `"version": "0.1.0"`

**Quick update script:**
```bash
# Update version in all three files at once
VERSION="0.2.0"
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
```

## Viewing Build Logs

1. Go to the **Actions** tab in your repository
2. Click on the workflow run you want to inspect
3. Click on a specific job (e.g., "build (windows-latest)")
4. View the logs for each step
5. Look for errors marked with ❌

## Common Issues

### Build Fails on One Platform

**Solution:**
- Check the logs for that specific platform
- The other platforms will still complete successfully
- Fix the issue and push again

### Icon Generation Fails

**Error:** `icon.icns not found`

**Solution:**
- The workflow automatically runs `npm run generate-icons`
- Check that `png2icons` is in `devDependencies` in `package.json`
- Verify `generate-icons.js` script exists

### Release Not Creating

**Problem:** Pushed a tag but no release appeared

**Check:**
1. Tag format is correct: `v0.1.0` (must start with `v`)
2. Go to Actions tab and check if workflow is running
3. Look for errors in the workflow logs

### Artifacts Not Uploading

**Problem:** Workflow completes but no artifacts

**Solution:**
- Check that the build actually succeeded (green checkmark)
- Verify the file paths in the workflow YAML match the actual output locations
- Linux: Check that system dependencies installed correctly

## Customizing the Workflow

### Change Build Triggers

Edit `.github/workflows/build.yml`:

```yaml
on:
  push:
    branches: [ main, develop ]  # Add more branches
  pull_request:
    branches: [ main ]
```

### Skip Builds on Certain Commits

Add `[skip ci]` to your commit message:

```bash
git commit -m "Update README [skip ci]"
```

### Build Only for Specific Platform

Temporarily comment out platforms in the matrix:

```yaml
matrix:
  platform: [
    macos-latest,
    # ubuntu-22.04,  # Commented out
    windows-latest
  ]
```

## Code Signing (Advanced)

For production releases, you'll want to sign your applications:

### macOS Code Signing

1. Get an Apple Developer certificate
2. Add secrets to GitHub:
   - `APPLE_CERTIFICATE` - Base64 encoded .p12 file
   - `APPLE_CERTIFICATE_PASSWORD` - Certificate password
   - `APPLE_ID` - Your Apple ID
   - `APPLE_PASSWORD` - App-specific password

3. Update workflow to use Tauri's signing:
```yaml
env:
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
```

### Windows Code Signing

1. Get a code signing certificate
2. Add secrets:
   - `WINDOWS_CERTIFICATE` - Base64 encoded .pfx
   - `WINDOWS_CERTIFICATE_PASSWORD` - Certificate password

## Monitoring

### Enable Notifications

1. Go to repository **Settings** → **Notifications**
2. Configure email/Slack notifications for:
   - Failed builds
   - Successful releases
   - Pull request checks

### Status Badges

Add build status to your README:

```markdown
![Build Status](https://github.com/YOUR_USERNAME/questscribe/workflows/Build%20QuestScribe/badge.svg)
```

## Cost

GitHub Actions is **free** for public repositories with:
- 2,000 minutes/month of build time
- 500MB artifact storage

For QuestScribe:
- Each full build (all 3 platforms) ≈ 25 minutes
- You can do ~80 builds per month for free
- Private repos get 2,000 minutes on the free tier

## Best Practices

1. **Test locally first** before pushing (when possible)
2. **Use draft releases** to review before publishing
3. **Tag commits** only when ready for release
4. **Keep build logs** for debugging (download before they expire)
5. **Monitor build times** to optimize workflow performance

## Troubleshooting Commands

```bash
# Check workflow syntax locally (requires act)
act -n

# List all tags
git tag -l

# Delete a tag (if you made a mistake)
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# Create an annotated tag with message
git tag -a v0.1.0 -m "Release version 0.1.0"
```

## Further Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Tauri Action](https://github.com/tauri-apps/tauri-action)
- [Semantic Versioning](https://semver.org/)
- [Tauri Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-macos)
