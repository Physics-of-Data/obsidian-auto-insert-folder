# Auto Insert Folder Plugin

Automatically insert parent folder information into newly created notes in Obsidian.

## Features

- **Multiple Insertion Modes**: Body text, frontmatter, or both
- **Smart Folder Filtering**: Enable for all folders or specific ones
- **Template Placeholders**: Customize how folder names appear
- **Flexible Formatting**: Support for wiki links, plain text, and custom formats

## Installation

### Method 1: Clone into your vault

```bash
cd /path/to/your/vault/.obsidian/plugins/
git clone ~/obsidian-plugins/obsidian-auto-insert-folder auto-insert-folder
```

### Method 2: Manual installation

1. Download the plugin files
2. Create folder: `.obsidian/plugins/auto-insert-folder/`
3. Copy `main.js` and `manifest.json` into the folder
4. Enable the plugin in Obsidian Settings → Community plugins

## Usage

### Basic Setup

1. Open Settings → Community plugins → Auto Insert Folder
2. Choose your insertion mode:
   - **Body text only**: Insert formatted text into note content
   - **Frontmatter only**: Add folder as YAML property
   - **Both**: Combine both methods

### Available Placeholders

- `{{folder}}` or `{{parent}}` - Parent folder name
- `{{grandparent}}` - Parent's parent folder name

### Example Configurations

**Wiki links in frontmatter:**
- Property: `project`
- Format: `[[{{folder}}]]`
- Result: `project: "[[Projects]]"`

**Hierarchical path:**
- Property: `location`
- Format: `{{grandparent}}/{{folder}}`
- Result: `location: "Work/Projects"`

**Body text:**
- Format: `Project: {{folder}}`
- Result: `Project: Projects`

## Settings

### Folder Control
- **Enable for all folders**: Process notes in any folder
- **Allowed folders**: Specify which folders should trigger auto-insert (subfolders included)

### Frontmatter Settings
- **Frontmatter property**: Property name to use (e.g., `folder`, `project`, `location`)
- **Frontmatter value format**: Template for the value with placeholder support

### Body Text Settings
- **Insert format**: Template for body text with placeholder support
- **Insert position**: Top or bottom of note

## Development

### Building from source

```bash
cd obsidian-auto-insert-folder
npm install
npm run build
```

### Development mode

```bash
npm run dev
```

This will watch for changes and rebuild automatically.

## Technical Details

- Written in TypeScript
- Uses Obsidian Plugin API
- Event-based file creation detection
- Robust error handling to prevent crashes
- Content verification to avoid overwriting existing notes

## License

MIT

## Author

Created with Claude Code
