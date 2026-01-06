# MemoryLoadDesklet

Linux Mint Cinnamon desklet that displays RAM/Swap usage with a circular gauge.

## Project Structure

```
memload@spekks/
├── desklet.js           # Main desklet logic (GJS/Clutter/Cairo)
├── metadata.json        # Desklet metadata (name, uuid, version)
├── settings-schema.json # Configuration options for desklet settings
├── stylesheet.css       # CSS styling for labels
├── icon.png             # Desklet icon (128x128)
└── po/                  # Translations folder
```

## Installation

Copy or symlink to `~/.local/share/cinnamon/desklets/memload@spekks/`

```bash
ln -s ~/Documents/GitHub/MemoryLoadDesklet ~/.local/share/cinnamon/desklets/memload@spekks
```

## Development

- **Language**: GJS (GNOME JavaScript)
- **APIs**: Cinnamon Desklet API, Clutter, Cairo, Gio, St (Shell Toolkit)
- **Data Source**: `/proc/meminfo` for RAM/Swap stats

### Key Components

- `Desklet.Desklet.prototype` - Base class for desklets
- `Settings.DeskletSettings` - Binds UI settings to properties
- `Clutter.Canvas` + Cairo - Custom circular gauge drawing
- `Mainloop.timeout_add_seconds` - Periodic refresh loop

### Testing Changes

After modifying code, restart Cinnamon: `Alt+F2` → `r` → Enter

Or use Looking Glass (`Alt+F2` → `lg`) to inspect errors.

## References

- Style based on `diskspace@schorschii` and `cpuload@kimse`
- [Cinnamon Desklet Tutorial](https://projects.linuxmint.com/reference/git/cinnamon-tutorials/write-desklet.html)
