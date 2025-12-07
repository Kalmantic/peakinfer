# PeakInfer Integration Test Setup Guide

Complete guide for testing all collectors with real accounts and data.

## Overview

This guide covers setting up real accounts for:
1. **Snowflake** - Free 30-day trial ($400 credits)
2. **Databricks** - Free trial with API access (NOT Community Edition)
3. **Terraform** - Local state file testing
4. **Hardware Detection** - Sample codebases with GPU patterns

---

## 1. Snowflake Setup

### Step 1: Create Free Trial Account

1. Go to: https://signup.snowflake.com/
2. Fill in: First Name, Last Name, Email, Company
3. Select:
   - **Cloud Provider**: AWS (recommended for testing)
   - **Region**: US West 2 (Oregon) or closest to you
   - **Edition**: Standard (sufficient for testing)
4. Check email and click "Activate Account"
5. Create username and password

### Step 2: Get Connection Details

After login, note these from the Snowflake UI:

```
Account: Your account identifier (shown in URL, e.g., "abc12345.us-west-2")
Username: Your username
Database: Create one called "PEAKINFER_TEST"
Warehouse: Create one called "PEAKINFER_WH" (X-Small is fine)
Schema: PUBLIC (default)
```

### Step 3: Create Test Data

Run this SQL in Snowflake Worksheets:

```sql
-- Create database and warehouse
CREATE DATABASE IF NOT EXISTS PEAKINFER_TEST;
CREATE WAREHOUSE IF NOT EXISTS PEAKINFER_WH WITH WAREHOUSE_SIZE = 'XSMALL';

USE DATABASE PEAKINFER_TEST;
USE WAREHOUSE PEAKINFER_WH;

-- Create inference usage table
CREATE TABLE IF NOT EXISTS inference_usage (
    request_id VARCHAR(36) DEFAULT UUID_STRING(),
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    intent VARCHAR(255),
    provider VARCHAR(50),
    model VARCHAR(100),
    input_tokens NUMBER,
    output_tokens NUMBER,
    latency_ms NUMBER,
    cost_usd FLOAT,
    endpoint VARCHAR(255),
    region VARCHAR(50),
    tenant VARCHAR(100)
);

-- Insert sample inference data (simulating 7 days of LLM usage)
INSERT INTO inference_usage (timestamp, intent, provider, model, input_tokens, output_tokens, latency_ms, cost_usd, endpoint, region, tenant)
SELECT
    DATEADD(minute, -UNIFORM(0, 10080, RANDOM()), CURRENT_TIMESTAMP()) as timestamp,
    CASE UNIFORM(1, 5, RANDOM())
        WHEN 1 THEN 'sql_generation'
        WHEN 2 THEN 'data_analysis'
        WHEN 3 THEN 'report_summarization'
        WHEN 4 THEN 'code_review'
        ELSE 'chat_completion'
    END as intent,
    CASE UNIFORM(1, 4, RANDOM())
        WHEN 1 THEN 'openai'
        WHEN 2 THEN 'anthropic'
        WHEN 3 THEN 'together'
        ELSE 'groq'
    END as provider,
    CASE UNIFORM(1, 6, RANDOM())
        WHEN 1 THEN 'gpt-4o'
        WHEN 2 THEN 'gpt-4o-mini'
        WHEN 3 THEN 'claude-3-5-sonnet'
        WHEN 4 THEN 'claude-3-haiku'
        WHEN 5 THEN 'llama-3.1-70b'
        ELSE 'mixtral-8x7b'
    END as model,
    UNIFORM(100, 4000, RANDOM()) as input_tokens,
    UNIFORM(50, 2000, RANDOM()) as output_tokens,
    UNIFORM(200, 5000, RANDOM()) as latency_ms,
    ROUND(UNIFORM(1, 100, RANDOM()) / 100.0, 4) as cost_usd,
    'api.openai.com' as endpoint,
    'us-west-2' as region,
    CASE UNIFORM(1, 3, RANDOM())
        WHEN 1 THEN 'team_analytics'
        WHEN 2 THEN 'team_engineering'
        ELSE 'team_product'
    END as tenant
FROM TABLE(GENERATOR(ROWCOUNT => 500));

-- Verify data
SELECT COUNT(*) as total_events,
       COUNT(DISTINCT provider) as providers,
       COUNT(DISTINCT model) as models,
       SUM(cost_usd) as total_cost
FROM inference_usage;
```

### Step 4: Set Environment Variables

```bash
export SNOWFLAKE_ACCOUNT="abc12345.us-west-2"  # Your account identifier
export SNOWFLAKE_USER="your_username"
export SNOWFLAKE_PASSWORD="your_password"
export SNOWFLAKE_DATABASE="PEAKINFER_TEST"
export SNOWFLAKE_WAREHOUSE="PEAKINFER_WH"
export SNOWFLAKE_SCHEMA="PUBLIC"
```

---

## 2. Databricks Setup

> **IMPORTANT**: Community Edition does NOT support REST API or tokens.
> You need a Databricks trial on AWS/Azure/GCP.

### Step 1: Create Databricks Trial

1. Go to: https://www.databricks.com/try-databricks
2. Select **AWS**, **Azure**, or **GCP** (NOT Community Edition)
3. Complete signup with work email
4. Follow cloud-specific setup wizard

### Step 2: Create a Serving Endpoint (Optional but recommended)

In Databricks workspace:
1. Go to **Machine Learning** → **Serving**
2. Create a new serving endpoint with a model
3. Or use Foundation Model APIs if available

### Step 3: Generate Personal Access Token

1. Click your username (top right) → **User Settings**
2. Go to **Developer** → **Access Tokens**
3. Click **Generate New Token**
4. Name it "peakinfer-test" and copy the token

### Step 4: Set Environment Variables

```bash
export DATABRICKS_HOST="https://your-workspace.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi..."
export DATABRICKS_WORKSPACE_ID="your-workspace-id"  # Optional
```

---

## 3. Terraform Setup (Local Testing)

No cloud account needed - we test with local state files.

### Step 1: Create Test Terraform Config

The test configs are in `test-setup/terraform/`. Initialize them:

```bash
cd test-setup/terraform
terraform init
terraform plan -out=tfplan
terraform show -json tfplan > plan.json
```

### Step 2: Set Environment Variables (Optional)

```bash
export TERRAFORM_CONFIG_DIR="./test-setup/terraform"
export TERRAFORM_STATE_FILE="./test-setup/terraform/terraform.tfstate"
```

---

## 4. Hardware Detection Testing

Sample codebases are in `test-setup/codebase-samples/`.

These contain real patterns for:
- vLLM configurations
- DeepSpeed ZeRO configs
- Modal GPU deployments
- Ray Serve endpoints
- Kubernetes GPU manifests

---

## 5. Running Tests

### Quick Validation

```bash
# Run the test script
./test-setup/scripts/run-tests.sh
```

### Individual Collector Tests

```bash
# Test Snowflake
node test-setup/scripts/test-snowflake.js

# Test Databricks
node test-setup/scripts/test-databricks.js

# Test Terraform
node test-setup/scripts/test-terraform.js

# Test Hardware Detection
node test-setup/scripts/test-hardware.js
```

### Full Integration Test

```bash
# Run peakinfer discover with all collectors
peakinfer discover --collectors snowflake,databricks,terraform,codebase
```

---

## Troubleshooting

### Snowflake Connection Issues
- Ensure account identifier format is correct (e.g., `abc12345.us-west-2`)
- Check warehouse is not suspended
- Verify IP is not blocked by network policies

### Databricks API Errors
- Token must have correct permissions
- Workspace URL must include `https://`
- Community Edition does NOT work - need full trial

### Terraform Parsing Issues
- Run `terraform validate` first
- Ensure state file is valid JSON
- Check terraform version >= 1.0

---

## Sources

- [Snowflake Free Trial](https://signup.snowflake.com/)
- [Snowflake Trial Documentation](https://docs.snowflake.com/en/user-guide/admin-trial-account)
- [Databricks Free Trial](https://www.databricks.com/try-databricks)
- [Databricks REST API](https://docs.databricks.com/api/workspace/introduction)
- [Terraform Testing](https://developer.hashicorp.com/terraform/tutorials/configuration-language/test)
