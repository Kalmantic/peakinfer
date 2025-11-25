# PeakInfer Installation Guide

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher  
- **Anthropic API Key**: Get yours at [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

## Global Installation (Recommended)

Install PeakInfer globally to use it across any project:

```bash
npm install -g @kalmantic/peakinfer
```

After installation, verify it works:

```bash
peakinfer --version
```

## Local Installation

To install in a specific project:

```bash
npm install --save-dev @kalmantic/peakinfer
```

Then use it via npx:

```bash
npx peakinfer --version
```

## Configuration

### API Key Setup

PeakInfer will automatically prompt for your Anthropic API key on first run:

```bash
peakinfer discover
# You'll be prompted: "Enter your Anthropic API key:"
```

Alternatively, set it via environment variable:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
peakinfer discover
```

Or create a `.env` file in your project:

```bash
# .env
ANTHROPIC_API_KEY=your-api-key-here
```

### Configuration Management

View current configuration:

```bash
peakinfer config --show
```

Set a new API key:

```bash
peakinfer config --set-key
```

Clear saved API key:

```bash
peakinfer config --clear-key
```

### Configuration File Location

PeakInfer stores configuration in:
- **Config**: `~/.peakinfer/config.json`
- **Template Cache**: `~/.peakinfer/templates/`

## Verify Installation

Run a test with sample data:

```bash
# Navigate to any directory
cd ~/projects/my-app

# Run discovery with sample data (included in package)
peakinfer discover

# Check templates
peakinfer templates
```

You should see:
- ✅ Templates loaded successfully
- 📊 Discovery analysis from sample data
- 💡 Optimization opportunities identified

## Updating

Update to the latest version:

```bash
npm update -g @kalmantic/peakinfer
```

## Uninstallation

Remove PeakInfer:

```bash
npm uninstall -g @kalmantic/peakinfer
```

To also remove configuration and cache:

```bash
rm -rf ~/.peakinfer
```

## Troubleshooting

### Permission Issues (macOS/Linux)

If you get EACCES errors:

```bash
# Option 1: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then install again
npm install -g @kalmantic/peakinfer
```

### API Key Issues

If Claude SDK reports authentication errors:

1. Verify your key at [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Check key format (should start with `sk-ant-`)
3. Clear and reset:
   ```bash
   peakinfer config --clear-key
   peakinfer config --set-key
   ```

### Template Loading Issues

If templates fail to load:

```bash
# Sync templates from source
peakinfer sync-templates

# Check cache status
peakinfer config --show
```

### TypeScript/ESM Issues

If you see ES module errors:

1. Ensure Node.js >= 18.0.0
2. Check that `package.json` has `"type": "module"`
3. Try clearing node_modules and reinstalling

## Next Steps

- **[Usage Guide](./USAGE.md)** - Learn how to use PeakInfer
- **[Architecture](./ARCHITECTURE.md)** - Understand how it works
- **[Templates](./TEMPLATES.md)** - Browse optimization templates

## Support

- **Issues**: [GitHub Issues](https://github.com/kalmantic/peakinfer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kalmantic/peakinfer/discussions)
- **Documentation**: [docs/](https://github.com/kalmantic/peakinfer/tree/main/docs)

