import { Plugin, TFile, PluginSettingTab, Setting, App } from 'obsidian';

interface AutoInsertFolderSettings {
	insertPosition: 'top' | 'bottom';
	format: string; // Template for insertion, e.g., "Folder: {{folder}}"
	allowedFolders: string[]; // List of folder paths where auto-insert is enabled
	enableForAllFolders: boolean; // If true, enable for all folders
	insertMode: 'body' | 'frontmatter' | 'both'; // Where to insert the folder name
	frontmatterProperty: string; // Property name for frontmatter insertion
	frontmatterFormat: string; // Template for frontmatter value, e.g., "[[{{folder}}]]"
}

const DEFAULT_SETTINGS: AutoInsertFolderSettings = {
	insertPosition: 'top',
	format: 'Folder: {{folder}}',
	allowedFolders: [],
	enableForAllFolders: true,
	insertMode: 'body',
	frontmatterProperty: 'folder',
	frontmatterFormat: '{{folder}}'
}

export default class AutoInsertFolderPlugin extends Plugin {
	settings: AutoInsertFolderSettings;
	private processedFiles: Set<string> = new Set();

	async onload() {
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new AutoInsertFolderSettingTab(this.app, this));

		// Register event handler for file creation
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.handleNewFile(file);
				}
			})
		);
	}

	async handleNewFile(file: TFile) {
		try {
			// Prevent processing the same file multiple times
			if (this.processedFiles.has(file.path)) {
				return;
			}
			this.processedFiles.add(file.path);

			// Wait a bit to ensure the file is fully created
			await this.sleep(200);

			// Verify file still exists
			if (!this.app.vault.getAbstractFileByPath(file.path)) {
				this.processedFiles.delete(file.path);
				return;
			}

			// Get the parent folder
			const parent = file.parent;
			if (!parent) {
				this.processedFiles.delete(file.path);
				return; // File is in vault root
			}

			// Check if this folder is allowed
			if (!this.isFolderAllowed(parent.path)) {
				this.processedFiles.delete(file.path);
				return;
			}

			const folderName = parent.path === '/' ? 'Root' : parent.name;

			// Read current content
			const content = await this.app.vault.read(file);

			// Skip if file already has content (to avoid overwriting)
			if (content.trim().length > 0) {
				this.processedFiles.delete(file.path);
				return;
			}

			let newContent = '';

			// Handle frontmatter insertion
			if (this.settings.insertMode === 'frontmatter' || this.settings.insertMode === 'both') {
				newContent = this.insertFrontmatter(content, file);
			}

			// Handle body text insertion
			if (this.settings.insertMode === 'body' || this.settings.insertMode === 'both') {
				const folderText = this.replacePlaceholders(this.settings.format, file);

				if (this.settings.insertMode === 'both') {
					// If frontmatter was added, append body text after it
					newContent = this.settings.insertPosition === 'top'
						? `${newContent}\n${folderText}\n\n`
						: `${newContent}\n\n${folderText}`;
				} else {
					// Only body text
					newContent = this.settings.insertPosition === 'top'
						? `${folderText}\n\n`
						: `\n\n${folderText}`;
				}
			}

			await this.app.vault.modify(file, newContent);

			// Clean up processed files set after successful modification
			this.processedFiles.delete(file.path);
		} catch (error) {
			console.error('Auto Insert Folder: Error handling new file', error);
			// Remove from processed set on error so it can be retried
			this.processedFiles.delete(file.path);
		}
	}

	replacePlaceholders(template: string, file: TFile): string {
		const parent = file.parent;
		if (!parent) return template;

		const folderName = parent.path === '/' ? 'Root' : parent.name;
		const grandparent = parent.parent;
		const grandparentName = grandparent ? (grandparent.path === '/' ? 'Root' : grandparent.name) : '';

		// Replace all placeholders
		return template
			.replace(/\{\{folder\}\}/g, folderName)
			.replace(/\{\{parent\}\}/g, folderName)
			.replace(/\{\{grandparent\}\}/g, grandparentName);
	}

	insertFrontmatter(content: string, file: TFile): string {
		// Format the folder value using the template with all placeholders
		const formattedValue = this.replacePlaceholders(this.settings.frontmatterFormat, file);

		// Check if content already has frontmatter
		if (content.startsWith('---')) {
			// Parse existing frontmatter
			const endOfFrontmatter = content.indexOf('---', 3);
			if (endOfFrontmatter > 0) {
				// Insert property into existing frontmatter
				const frontmatterContent = content.substring(4, endOfFrontmatter).trim();
				const restOfContent = content.substring(endOfFrontmatter + 3);

				return `---\n${frontmatterContent}\n${this.settings.frontmatterProperty}: ${formattedValue}\n---${restOfContent}`;
			}
		}

		// Create new frontmatter
		return `---\n${this.settings.frontmatterProperty}: ${formattedValue}\n---\n`;
	}

	isFolderAllowed(folderPath: string): boolean {
		// If enabled for all folders, allow everything
		if (this.settings.enableForAllFolders) {
			return true;
		}

		// Check if the folder or any parent folder is in the allowed list
		const normalizedPath = folderPath.replace(/\\/g, '/');

		return this.settings.allowedFolders.some(allowedFolder => {
			const normalizedAllowed = allowedFolder.replace(/\\/g, '/');
			// Check if current folder matches or is a subfolder of an allowed folder
			return normalizedPath === normalizedAllowed ||
				   normalizedPath.startsWith(normalizedAllowed + '/');
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

class AutoInsertFolderSettingTab extends PluginSettingTab {
	plugin: AutoInsertFolderPlugin;

	constructor(app: App, plugin: AutoInsertFolderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Auto Insert Folder Settings' });

		// Enable for all folders toggle
		new Setting(containerEl)
			.setName('Enable for all folders')
			.setDesc('If enabled, the plugin will work in all folders. If disabled, only specific folders will be processed.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableForAllFolders)
				.onChange(async (value) => {
					this.plugin.settings.enableForAllFolders = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide folder list
				}));

		// Only show folder list if not enabled for all folders
		if (!this.plugin.settings.enableForAllFolders) {
			new Setting(containerEl)
				.setName('Allowed folders')
				.setDesc('Enter folder paths (one per line) where auto-insert should be enabled. Subfolders are automatically included.')
				.addTextArea(text => text
					.setPlaceholder('Projects\nWork/Notes\nPersonal')
					.setValue(this.plugin.settings.allowedFolders.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.allowedFolders = value
							.split('\n')
							.map(f => f.trim())
							.filter(f => f.length > 0);
						await this.plugin.saveSettings();
					})
					.then(textArea => {
						textArea.inputEl.rows = 8;
						textArea.inputEl.cols = 30;
					}));
		}

		// Insert mode
		new Setting(containerEl)
			.setName('Insert mode')
			.setDesc('Choose where to insert the folder name: in the note body, frontmatter, or both.')
			.addDropdown(dropdown => dropdown
				.addOption('body', 'Body text only')
				.addOption('frontmatter', 'Frontmatter only')
				.addOption('both', 'Both body and frontmatter')
				.setValue(this.plugin.settings.insertMode)
				.onChange(async (value) => {
					this.plugin.settings.insertMode = value as 'body' | 'frontmatter' | 'both';
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide relevant settings
				}));

		// Frontmatter property (only show if mode includes frontmatter)
		if (this.plugin.settings.insertMode === 'frontmatter' || this.plugin.settings.insertMode === 'both') {
			new Setting(containerEl)
				.setName('Frontmatter property')
				.setDesc('The property name to use in frontmatter (e.g., "folder", "location", "category").')
				.addText(text => text
					.setPlaceholder('folder')
					.setValue(this.plugin.settings.frontmatterProperty)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterProperty = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Frontmatter value format')
				.setDesc('Format for the frontmatter value. Available placeholders: {{folder}}/{{parent}} (folder name), {{grandparent}} (parent folder). Examples: "[[{{folder}}]]", "{{grandparent}}/{{folder}}"')
				.addText(text => text
					.setPlaceholder('{{folder}}')
					.setValue(this.plugin.settings.frontmatterFormat)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterFormat = value;
						await this.plugin.saveSettings();
					}));
		}

		// Format setting (only show if mode includes body)
		if (this.plugin.settings.insertMode === 'body' || this.plugin.settings.insertMode === 'both') {
			new Setting(containerEl)
				.setName('Insert format')
				.setDesc('Text to insert in body. Available placeholders: {{folder}}/{{parent}} (folder name), {{grandparent}} (parent folder).')
				.addText(text => text
					.setPlaceholder('Folder: {{folder}}')
					.setValue(this.plugin.settings.format)
					.onChange(async (value) => {
						this.plugin.settings.format = value;
						await this.plugin.saveSettings();
					}));

			// Insert position (only show if mode includes body)
			new Setting(containerEl)
				.setName('Insert position')
				.setDesc('Where to insert the folder text in the note body')
				.addDropdown(dropdown => dropdown
					.addOption('top', 'Top of note')
					.addOption('bottom', 'Bottom of note')
					.setValue(this.plugin.settings.insertPosition)
					.onChange(async (value) => {
						this.plugin.settings.insertPosition = value as 'top' | 'bottom';
						await this.plugin.saveSettings();
					}));
		}
	}
}
