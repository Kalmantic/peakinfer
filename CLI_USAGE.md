# TokenOp CLI Usage Guide

## Installation

### Local Development
```bash
# Clone the repository
git clone <your-repo-url>
cd tokenop

# Install dependencies
npm install

# Build the project
npm run build

# Link globally for development
npm link
```

### Global Installation (When Published)
```bash
npm install -g @kalmantic/tokenop
```

## Quick Start

Simply type `tokenop` to see the interactive welcome screen:

```bash
tokenop
```

This will show you:
- 🚀 Quick start commands
- 📊 Multi-step workflow
- 💡 Help resources

## Core Commands

### 1. Full Orchestration (Recommended for Beginners)
```bash
tokenop orchestrate
```
Runs the complete multi-agent optimization workflow powered by Claude Code SDK.

Options:
- `--workload <file>` - Path to workload data (events.jsonl)
- `--policy <file>` - Path to policy file (policy.yaml)
- `--dry-run` - Simulate without making changes
- `--templates-dir <dir>` - Custom templates directory
- `--output <file>` - Save full report to file

### 2. Step-by-Step Workflow

#### Step 1: Discover Environment
```bash
tokenop discover
```
Scans your infrastructure across Application, Serving, and Infrastructure layers.

#### Step 2: Profile Workload
```bash
tokenop profile --events events.jsonl
```
Analyzes workload patterns and clusters prompts semantically.

#### Step 3: Generate Plan
```bash
tokenop plan --constraints policy.yaml
```
Creates an optimization plan using community templates.

#### Step 4: Execute Plan
```bash
tokenop run --plan optimization-plan.yaml
```
Executes the optimization plan with baseline comparison.

#### Step 5: Generate Report
```bash
tokenop report --output-dir reports/
```
Generates comprehensive ROI analysis and audit reports.

## Template Management

### List All Templates
```bash
tokenop templates
```

### List Templates by Category
```bash
tokenop templates --category application-layer
```

### Show Detailed Template Info
```bash
tokenop templates --detailed
```

### Execute Specific Template
```bash
tokenop execute <template-id>
```

### Apply Template with Options
```bash
tokenop template-apply <template-id> --dry-run
```

## Community Features

### Review Template
```bash
tokenop review-template <template-id>
```

### Submit Implementation Results
```bash
tokenop submit-implementation <template-id> \
  --baseline-cost 10000 \
  --optimized-cost 7000 \
  --implementation-time 5
```

### Contribute to Community
```bash
tokenop contribute
```

## Help & Documentation

### Show All Commands
```bash
tokenop --help
```

### Show Command-Specific Help
```bash
tokenop <command> --help
```

Example:
```bash
tokenop discover --help
tokenop orchestrate --help
```

### Check Version
```bash
tokenop --version
```

## Examples

### Example 1: Quick Optimization
```bash
# Start with orchestration (easiest way)
tokenop orchestrate --workload ./events.jsonl --policy ./policy.yaml
```

### Example 2: Step-by-Step with Custom Templates
```bash
# 1. Discover
tokenop discover --output discovered.yaml

# 2. Profile
tokenop profile --events events.jsonl --cluster-method semantic

# 3. Plan with custom templates
tokenop plan --constraints policy.yaml --templates-dir ./my-templates

# 4. Execute
tokenop run --plan optimization-plan.yaml --sample-size 100

# 5. Report
tokenop report --output-dir ./reports --format html,json
```

### Example 3: Execute Specific Template
```bash
# List available templates
tokenop templates

# Execute a specific template
tokenop execute prompt-compression-001 --dry-run

# Review results and apply without dry-run
tokenop execute prompt-compression-001
```

## Development

### Run in Development Mode
```bash
npm run dev discover
```

### Build for Production
```bash
npm run build
npm start discover
```

### Run Tests
```bash
npm test
npm run test:watch
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Troubleshooting

### Command Not Found
If `tokenop` command is not found after installation:

1. Make sure you ran `npm link` in development
2. Check your npm global bin path: `npm bin -g`
3. Ensure the path is in your system PATH

### Permission Issues
```bash
# If you get permission errors on macOS/Linux:
sudo npm link
```

### Build Errors
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
npm link
```

## Next Steps

1. **Set up Claude API Key** - Required for multi-agent orchestration
   ```bash
   export ANTHROPIC_API_KEY=your-api-key
   ```

2. **Prepare Your Data** - Create `events.jsonl` with your inference logs

3. **Define Policy** - Create `policy.yaml` with your constraints

4. **Run Orchestration** - Execute `tokenop orchestrate` to start optimizing

## Support

- 📚 Documentation: Check the design/ folder for comprehensive docs
- 🐛 Issues: Report bugs on GitHub
- 💬 Community: Join discussions on GitHub Discussions

---

**Made with ❤️ by Kalmantic AI Labs**
**Powered by Claude Code SDK**
