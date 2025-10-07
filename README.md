# LitRPG Writer

A specialized word processor for writing LitRPG novels with character state tracking.

## Getting Started

### Prerequisites

Make sure you have installed:
- Rust (from https://rustup.rs/)
- Node.js (from https://nodejs.org/)
- Visual Studio Build Tools (Windows only)

### Initial Setup

1. **Create the project structure:**

```bash
mkdir litrpg-writer
cd litrpg-writer
```

2. **Copy all the files from the artifacts into your project directory:**

```
litrpg-writer/
├── src/
│   ├── components/
│   │   ├── Editor.jsx
│   │   └── Sidebar.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── state.rs
│   ├── build.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

3. **Install dependencies:**

```bash
npm install
```

This will install all the JavaScript/React dependencies.

4. **Install Tauri CLI globally (if you haven't already):**

```bash
npm install -g @tauri-apps/cli
```

### Running the Application

To run the app in development mode with hot reload:

```bash
npm run dev
```

The first time you run this, it will take several minutes because:
- Rust needs to compile all dependencies
- Tauri needs to build the native application

Subsequent runs will be much faster (30-60 seconds).

### What You'll See

When the app starts, you'll see:
- A text editor (using ProseMirror) in the main area
- A sidebar on the right showing "Character State"
- A toolbar at the top with buttons (not all functional yet)
- A reference character called "Example Hero (Reference)" in the dropdown

You can:
- Type in the editor
- See the cursor position update in the sidebar
- Switch between characters (once you create more)

### Current Features (Phase 1)

✅ Basic Tauri + React + Rust setup
✅ ProseMirror text editor with undo/redo
✅ Sidebar panel for character state
✅ Entity (character) system in Rust backend
✅ Communication between frontend and backend

### Not Yet Implemented

The following features are planned but not yet built:
- Marker creation and insertion
- Marker visualization in the editor
- State change tracking
- Icon and color customization
- Saving/loading documents
- RTF export

### Building for Production

To create a distributable application:

```bash
npm run build
```

This will create installers in `src-tauri/target/release/bundle/`:
- Windows: `.msi` installer and `.exe` portable
- The build process takes 5-10 minutes

## Project Structure

### Frontend (JavaScript/React)
- **src/App.jsx**: Main application component, manages state
- **src/components/Editor.jsx**: ProseMirror text editor
- **src/components/Sidebar.jsx**: Character state display panel
- **src/styles.css**: All styling

### Backend (Rust)
- **src-tauri/src/main.rs**: Tauri application entry point, command handlers
- **src-tauri/src/state.rs**: Data structures (Entity, Marker, StateValue, etc.)

### Communication
Frontend calls Rust functions using:
```javascript
import { invoke } from '@tauri-apps/api/tauri'
const result = await invoke('command_name', { param: value })
```

## Troubleshooting

### "error: linker `link.exe` not found"
You need to install Visual Studio Build Tools with "Desktop development with C++" workload.

### "Failed to resolve entry for package"
Run `npm install` to ensure all dependencies are installed.

### Port 1420 already in use
Another dev server is running. Close it or change the port in `vite.config.js`.

### Slow first compilation
This is normal! Rust compiles everything from scratch the first time. Subsequent builds are much faster.

### Hot reload not working
Stop the dev server (Ctrl+C) and run `npm run dev` again.

## Next Steps

Now that the foundation is working, you can start implementing:

1. **Marker insertion UI** - Dialog for creating state changes
2. **Marker rendering** - Show colored icons in the editor
3. **State computation** - Implement the backwards search algorithm
4. **Marker editing** - Click markers to edit them
5. **Document save/load** - Persist projects to disk

## Development Tips

- Changes to `.jsx` files hot reload automatically
- Changes to `.rs` files require recompiling (takes ~30 seconds)
- Use browser dev tools (F12) to debug the frontend
- Use `println!()` in Rust code to debug the backend (output appears in terminal)
- The ProseMirror editor has excellent documentation at https://prosemirror.net/

## Contributing

This is an open-source project. Contributions welcome!

## License

TBD