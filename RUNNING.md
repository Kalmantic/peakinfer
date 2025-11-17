# Running Peakinfer - Complete Guide

## 🎯 Quick Start (60 seconds)

```bash
# 1. Install & build
npm install

# 2. Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Run discover
node dist/cli.js discover --output discovered.yaml

# Done! Check discovered.yaml
```

## 📋 What Was Fixed

- ✅ **SDK Issue**: Replaced wrong package (`@anthropic-ai/claude-code`) with correct one (`@anthropic-ai/sdk`)
- ✅ **Build Issue**: Fixed TypeScript config to exclude test files
- ✅ **API Integration**: Rewrote all 5 agent files to use proper Anthropic SDK
- ✅ **Error Handling**: Graceful fallback when API unavailable

See **FIX_SUMMARY.md** for details.

## 🚀 Installation

### Option 1: Automatic Setup (Recommended)
```bash
chmod +x setup.sh
./setup.sh
```

The script will:
- ✅ Check Node.js installation
- ✅ Install dependencies
- ✅ Build the project
- ✅ Prompt for API key
- ✅ Verify everything works

### Option 2: Manual Setup
```bash
# Install dependencies
npm install

# Build
npm run build

# Get API key from https://console.anthropic.com/
export ANTHROPIC_API_KEY="sk-ant-..."

# Verify
node dist/cli.js --version
```

## 🔑 API Key Setup

### Get Your API Key

1. Go to https://console.anthropic.com/
2. Click "API Keys" in the left sidebar
3. Click "Create Key"
4. Copy the key (starts with `sk-ant-`)

### Set Environment Variable

**Bash/Zsh (macOS/Linux):**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Windows PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

**Permanent (Bash/Zsh):**
Add to `~/.bashrc` or `~/.zshrc`:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Permanent (Windows):**
- Open Settings → Environment Variables
- Add new user variable: `ANTHROPIC_API_KEY` = `sk-ant-...`

### Verify It Works
```bash
echo $ANTHROPIC_API_KEY
# Should show: sk-ant-...
```

## 📖 Using Peakinfer

### View All Commands
```bash
node dist/cli.js --help
```

Output:
```
Commands:
  orchestrate                 🤖 Full multi-agent orchestration
  discover                    🔍 Multi-agent discovery
  profile                     📊 Profile workload and cluster prompts
  plan                        🎯 Generate optimization plan
  run                         🚀 Execute optimization plan
  report                      📝 Generate comprehensive report
  execute <template-id>       🚀 Execute specific template
  templates                   📋 List all templates
  template-apply <id>         🔧 Apply a template
  ... and more
```

### Full Workflow Example

#### 1️⃣ Create Sample Data
```bash
# Create events.jsonl with inference data
cat > events.jsonl << 'EOF'
{"id":"evt-001","ts":"2025-11-14T10:00:00Z","intent":"extract_email","provider":"openai","model":"gpt-4o","input_tokens":500,"output_tokens":100,"latency_ms":150,"cost_usd":0.015,"endpoint":"api.openai.com","region":"us-east-1","tenant":"team_analytics"}
{"id":"evt-002","ts":"2025-11-14T10:01:00Z","intent":"summarize_doc","provider":"anthropic","model":"claude-3-sonnet","input_tokens":2000,"output_tokens":200,"latency_ms":300,"cost_usd":0.008,"endpoint":"api.anthropic.com","region":"us-west-2","tenant":"team_analytics"}
EOF
```

#### 2️⃣ Discover Infrastructure
```bash
node dist/cli.js discover \
  --input-dir . \
  --output discovered.yaml
```

**Output:**
- `discovered.yaml` - Your infrastructure configuration
- Console output showing detected runtimes, frameworks, GPU count, costs

#### 3️⃣ Profile Workload
```bash
node dist/cli.js profile \
  --events events.jsonl \
  --output profiles.yaml
```

**Output:**
- `profiles.yaml` - Clustered workload patterns
- Intent grouping and representative samples

#### 4️⃣ Generate Plan
```bash
node dist/cli.js plan \
  --discovered discovered.yaml \
  --output plan.yaml
```

**Output:**
- `plan.yaml` - Recommended optimizations with estimated savings
- ROI and implementation effort for each optimization

#### 5️⃣ Execute Plan
```bash
node dist/cli.js run \
  --plan plan.yaml \
  --output results.yaml
```

**Output:**
- `results.yaml` - Actual savings and metrics
- Baseline vs optimized cost comparison

#### 6️⃣ Generate Report
```bash
node dist/cli.js report \
  --results results.yaml \
  --output-dir ./reports \
  --format html,csv
```

**Output:**
- `reports/report.html` - Beautiful visual report
- `reports/report.csv` - Data export

### Run Full Orchestration

All steps in one command:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
node dist/cli.js orchestrate \
  --workload events.jsonl \
  --policy policy.yaml \
  --output orchestration-report.json
```

## 🛠️ Development

### Build
```bash
npm run build
```

### Development Mode (with ts-node)
```bash
yarn dev discover --help
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
npm run lint:fix
```

### Tests
```bash
npm test
npm run test:watch
npm run test:coverage
```

## 📊 Command Reference

### discover
Analyze your infrastructure using Claude AI
```bash
node dist/cli.js discover \
  --input-dir ./data \              # Input data directory
  --collectors snowflake,databricks  # External collectors
  --output discovered.yaml           # Output file
```

### profile
Profile and cluster workload patterns
```bash
node dist/cli.js profile \
  --events events.jsonl \            # Event data
  --cluster-method semantic \        # Clustering strategy
  --output profiles.yaml
```

### plan
Generate optimization plan using templates
```bash
node dist/cli.js plan \
  --discovered discovered.yaml \     # Discovery results
  --constraints policy.yaml \        # Policy constraints
  --templates-dir ./templates \      # Template directory
  --output plan.yaml
```

### run
Execute plan with baseline comparison
```bash
node dist/cli.js run \
  --plan plan.yaml \                 # Optimization plan
  --sample-size 100 \                # Sample size for testing
  --early-stopping \                 # Stop on convergence
  --output results.yaml
```

### report
Generate comprehensive ROI analysis
```bash
node dist/cli.js report \
  --results results.yaml \           # Execution results
  --output-dir ./reports \           # Output directory
  --format html,csv                  # Output formats
```

### orchestrate
Full multi-agent optimization
```bash
node dist/cli.js orchestrate \
  --workload events.jsonl \          # Workload data
  --policy policy.yaml \             # Policy constraints
  --dry-run \                        # Don't actually optimize
  --output report.json
```

## ⚙️ Configuration Files

### events.jsonl
Canonical inference event format:
```json
{
  "id": "evt-001",
  "ts": "2025-11-14T10:00:00Z",
  "intent": "extract_email",
  "provider": "openai",
  "model": "gpt-4o",
  "input_tokens": 500,
  "output_tokens": 100,
  "latency_ms": 150,
  "cost_usd": 0.015,
  "endpoint": "api.openai.com",
  "region": "us-east-1",
  "tenant": "team_analytics"
}
```

### policy.yaml
Organization constraints:
```yaml
max_latency_ms: 500
max_cost_increase: 0.05  # 5%
allowed_risk_levels:
  - low
  - medium
quality_threshold: 0.95  # 95% minimum
```

## 🔍 Troubleshooting

### Issue: "Cannot find module '@anthropic-ai/sdk'"
```bash
npm install @anthropic-ai/sdk@^0.20.4
npm run build
```

### Issue: "invalid x-api-key"
```bash
# Check if API key is set
echo $ANTHROPIC_API_KEY

# If empty, set it
export ANTHROPIC_API_KEY="sk-ant-..."

# Verify key format (starts with sk-ant-)
```

### Issue: "Module not found: ... (ESM)"
```bash
# Clear dependencies and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run build
```

### Issue: "Build failed"
```bash
# Check TypeScript errors
npm run typecheck

# Rebuild
npm run build --verbose
```

### Issue: "Command not found"
```bash
# Make sure dist folder exists
ls -la dist/cli.js

# If missing, rebuild
npm run build

# Run with node explicitly
node dist/cli.js --help
```

## 📚 Additional Resources

- **SDK_SETUP.md** - Detailed Anthropic SDK integration
- **FIX_SUMMARY.md** - What was fixed and why
- **QUICKSTART.md** - Quick command reference
- **design/PRD** - Full product architecture
- **design/templates/** - Optimization templates

## 🐛 Debug Mode

Enable debug output:
```bash
DEBUG=* node dist/cli.js discover
```

Check logs:
```bash
node dist/cli.js discover > peakinfer.log 2>&1
cat peakinfer.log
```

## 💡 Tips

1. **Test without API key**: Peakinfer has smart fallback - it still works!
   ```bash
   unset ANTHROPIC_API_KEY
   node dist/cli.js discover  # Uses heuristics
   ```

2. **Use templates**: Find ready-made optimizations
   ```bash
   node dist/cli.js templates list
   node dist/cli.js templates search --category "serving-layer"
   ```

3. **Dry run first**: Test before optimizing
   ```bash
   node dist/cli.js orchestrate --dry-run
   ```

4. **Monitor costs**: Track before/after
   ```bash
   node dist/cli.js report --format csv  # Easy to analyze
   ```

## 🎓 Learning Path

1. **Start**: Read this file (RUNNING.md) ✅
2. **Understand**: Read FIX_SUMMARY.md (what changed)
3. **Setup**: Run `./setup.sh`
4. **Try**: Run `node dist/cli.js discover`
5. **Learn**: Check SDK_SETUP.md for SDK details
6. **Explore**: Try all commands with `--help`
7. **Integrate**: Build custom agents using the framework
8. **Contribute**: Add optimization templates to the community

## 🤝 Contributing

Want to add optimization templates or improve agents?

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-optimization`
3. Add your optimization in `design/templates/`
4. Test with `node dist/cli.js orchestrate`
5. Submit a pull request

## 📞 Support

- 📖 Check documentation files in this directory
- 🐛 Report issues on GitHub
- 💬 Join our community discussions
- 📧 Contact: support@kalmantic.ai

---

**Happy optimizing! 🚀**
