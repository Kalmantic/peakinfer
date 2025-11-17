#!/bin/bash

# Peakinfer Setup Script
# Helps you get started with Peakinfer quickly

echo "🚀 Peakinfer Setup"
echo "=================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ npm $(npm -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Build project
echo "🔨 Building project..."
npm run build > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    npm run build
    exit 1
fi

echo "✅ Project built successfully"
echo ""

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  Anthropic API key not set"
    echo ""
    echo "Get your API key from: https://console.anthropic.com/"
    echo ""
    read -p "Enter your Anthropic API key (sk-ant-...): " API_KEY

    if [ -z "$API_KEY" ]; then
        echo "❌ API key required"
        exit 1
    fi

    export ANTHROPIC_API_KEY="$API_KEY"
    echo "✅ API key set for this session"
else
    echo "✅ Anthropic API key found"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📖 Next steps:"
echo ""
echo "1. View available commands:"
echo "   node dist/cli.js --help"
echo ""
echo "2. Run discovery:"
echo "   node dist/cli.js discover --output discovered.yaml"
echo ""
echo "3. Create sample events (optional):"
echo "   cat > events.jsonl << 'EOF'"
echo '   {"id":"evt-001","ts":"2025-11-14T10:00:00Z","intent":"extract","provider":"openai","model":"gpt-4o","input_tokens":500,"output_tokens":100,"latency_ms":150,"cost_usd":0.015,"endpoint":"api.openai.com","region":"us-east-1","tenant":"team"}'
echo "   EOF"
echo ""
echo "4. Profile workload:"
echo "   node dist/cli.js profile --events events.jsonl"
echo ""
echo "📚 Documentation:"
echo "   - QUICKSTART.md - Running Peakinfer commands"
echo "   - SDK_SETUP.md - Anthropic SDK integration"
echo "   - FIX_SUMMARY.md - What was fixed"
echo ""
echo "🔑 Remember to set your API key before running:"
echo "   export ANTHROPIC_API_KEY=\"sk-ant-...\""
echo ""
