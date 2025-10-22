# CLAUDE.md

Your goal it to help user generate fastapi apps according their need, these apps are suppose to perform visualization, analysis on the dataset available under this directory.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Each app are suppose to be a single python file, self-contained, using a descriptive name. Once finished, the app should be executed with python (in the background), and the printed url should be returned to the user to visit the app.

Inside the app frontend, you can use tailwind.css to build nice website, if needed write the html / template file in the `static` folder, and read it when running to avoid quoting errors etc.

## CRITICAL: Common Mistakes to Avoid

### 1. Import Order and Duplicates
**WRONG:**
```python
from hypha_rpc import connect_to_server
from dotenv import load_dotenv
from hypha_rpc import connect_to_server  # Duplicate!
```

**CORRECT:**
```python
from dotenv import load_dotenv
from hypha_rpc import connect_to_server

load_dotenv()  # Must be called BEFORE using environment variables
```

### 2. FastAPI Query Parameter Validation
**WRONG (causes deprecation warning):**
```python
filter: str = Query('all', regex='^(all|high|annotated)$')
```

**CORRECT:**
```python
filter: str = Query('all', pattern='^(all|high|annotated)$')
```

### 3. Running the App
**IMPORTANT:** Always run the app from the `/mnt/disks/data/` directory to ensure `.env` file is loaded:
```bash
cd /mnt/disks/data
python -u your_app.py  # Use -u for unbuffered output to see print statements immediately
```

### 4. Hypha Connection and serve_fastapi Function
Always provide workspace from environment:
```python
server = await connect_to_server({
    "server_url": "https://hypha.aicell.io",
    "workspace": os.environ.get('HYPHA_WORKSPACE'),  # Don't add default here
    "token": os.environ.get("HYPHA_TOKEN", "")
})
```

**CRITICAL - Avoid BrokenPipeError:**
```python
# WRONG - This causes BrokenPipeError when running in background
async def serve_fastapi(args, context=None):
    scope = args["scope"]
    print(f'{context["user"]["id"]} - {scope["client"]}')  # This breaks!
    await app(args["scope"], args["receive"], args["send"])

# CORRECT - No print statements in serve_fastapi
async def serve_fastapi(args, context=None):
    # Don't print here to avoid BrokenPipeError
    # If logging needed, write to a file instead
    await app(args["scope"], args["receive"], args["send"])
```

### 5. App Output
The app should print the URL clearly when it starts. Always wait for this output before reporting to the user:
```python
print(f"✨ Your app is running!")
print(f"📸 Access your app at: {server.config.public_base_url}/{server.config.workspace}/apps/{svc_info['id'].split('/')[1]}")
```

### 6. JavaScript API Paths in HTML (CRITICAL for Hypha)
When your app serves HTML with JavaScript that calls your FastAPI endpoints:

**WRONG (will cause 404 errors):**
```javascript
// These won't work with Hypha's dynamic base URL
fetch('/api/samples')  // Absolute path - wrong!
fetch('api/samples')   // Relative path without base URL handling - wrong!
fetch(`/api/data/${id}`)  // Will fail when served through Hypha
```

**CORRECT - Use dynamic base URL detection:**
```javascript
// Helper function to construct proper API URLs
function getApiUrl(endpoint) {
    // Get current page URL without query params or hash
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    // Ensure it ends with a slash
    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    return base + endpoint;
}

// Use it for all API calls
async function fetchData() {
    try {
        const response = await fetch(getApiUrl('api/samples'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Handle undefined data gracefully
        const items = data.items || [];
        const count = (data.count || 0).toLocaleString();
    } catch (error) {
        console.error('Error:', error);
        // Show user-friendly error message
    }
}

// For dynamic paths, always encode parameters
const sampleId = 'BUS-114-1_2023-01-21_19-25-3.663354';
fetch(getApiUrl(`api/gallery/${encodeURIComponent(sampleId)}`));
```

**Why this works:** When served through Hypha at a URL like `https://hypha.aicell.io/ws-user-github|478667/apps/appid:malaria-gallery/`, the JavaScript needs to maintain this base path for all API calls. Using `window.location.href` ensures the API calls go to the correct Hypha-proxied endpoints.

### 7. Data Validation (IMPORTANT)
When working with paired data files (like `.npy` images and `.csv` predictions):

**WRONG - Assuming all files have pairs:**
```python
@app.get("/api/samples")
async def list_samples():
    npy_files = os.listdir('/mnt/disks/data/data/npy_v2/')
    samples = [f.replace('.npy', '') for f in npy_files if f.endswith('.npy')]
    return {"samples": sorted(samples)}  # May include samples without CSV files!
```

**CORRECT - Only return samples with complete data:**
```python
@app.get("/api/samples")
async def list_samples():
    # Get both npy and csv files
    npy_files = set(f.replace('.npy', '') for f in os.listdir('/mnt/disks/data/data/npy_v2/') if f.endswith('.npy'))
    csv_files = set(f.replace('.csv', '') for f in os.listdir('/mnt/disks/data/data/model_output/') if f.endswith('.csv'))
    
    # Only return samples that have both npy and csv files
    samples = list(npy_files.intersection(csv_files))
    
    return {"samples": sorted(samples)[:100], "count": len(samples)}
```

**Why this matters:** The malaria dataset has image files (`.npy`) and model predictions (`.csv`). Not all images have been processed through the model, so you must check for both files before listing a sample as available.
## Repository Structure

This repository contains three distinct projects:

2. **Data Science Dashboard** (`/mnt/disks/data/dash app/` and `/mnt/disks/data/`) - Python/Dash-based visualization dashboard for ML model outputs
3. **Root directory** - Currently minimal with empty package.json files

## Development Commands

### Python Dashboard (`/dash app/`)

```bash
# Run the dashboard
python main.py  # Starts Dash server on port 8050

# Authentication: username="cephla", password="octopi"
```

## High-Level Architecture

### Data Science Dashboard

Interactive dashboard for ML model outputs from microscopy data:

- **Framework**: Dash (Plotly) with Flask authentication
- **Data Format**: NumPy arrays (.npy) and CSV files with model predictions
- **Sample Types**: BUS, PAT (Patient), PBC/PCB (Cell culture), SBC (Control)
- **Visualization**: Real-time exploration of fluorescence + DPC microscopy data

Key files:
- `dash app/main.py` - Dashboard application entry point
- `data/model_outputs/` - Model prediction CSVs
- `data/`[sample_id]`/` - Sample-specific data directories

## Malaria Dataset Structure and Usage

### CRITICAL: Understanding Data Folders

**IMPORTANT**: Not all image files have corresponding model outputs! Always verify data availability before use.

### Data Organization

The malaria detection dataset consists of three interconnected data sources:

1. **Image Data** (`/mnt/disks/data/data/npy_v2/`)
   - Contains ~200+ NumPy array files
   - Shape: `(N, 4, 31, 31)` where N = number of cells
   - 4 channels: Red, Green, Blue fluorescence + DPC (Differential Phase Contrast)
   - Data type: uint8 (0-255 range)
   - File naming: `{sample_id}_{timestamp}.npy`
   - **WARNING**: Many of these DO NOT have model predictions

2. **Model Predictions** (`/mnt/disks/data/data/model_output/`)
   - Contains exactly 131 CSV files (verified)
   - CSV columns: `index`, `annotation`, `non-parasite output`, `parasite output`, `unsure output`
   - Each row corresponds to a cell in the matching .npy file
   - Sorted by `parasite output` score (highest probability first)
   - Annotation: -1 (unlabeled), 0 (negative), 1 (positive)
   - **USE THIS**: Only samples here have been processed through the ML model

3. **Threshold Analysis** (`/mnt/disks/data/dash app/count vs threshold/`)
   - Contains 39 CSV files (thresholds from 0.24 to 1.00, step 0.02)
   - Each file has exactly 131 samples (matches model_output perfectly)
   - CSV columns: `dataset ID`, `predicted positive`, `predicted negative`, `predicted unsure`, `Total Count`, `Number of FOVs`, `Positives per 5M RBC`
   - Critical metric: "Positives per 5M RBC" (>5 indicates infection)
   - **USE THIS**: For threshold-based analysis and infection detection

### Sample Types

- **BUS**: Bus/Transport samples (high volume screening)
- **PAT**: Patient samples with IDs (clinical diagnostics)
- **PBC/PCB**: Cell culture samples (research/validation)
- **SBC**: Control samples (baseline measurements)

### Code Examples for Data Access

You have access to a conda/mamba environement where you can install python packages.

#### Loading and Processing Image Data

```python
import numpy as np
import pandas as pd
from PIL import Image

def load_sample_data(sample_id):
    """Load image and prediction data for a sample."""
    # Load image array
    npy_path = f'/mnt/disks/data/data/npy_v2/{sample_id}.npy'
    images = np.load(npy_path)  # Shape: (N, 4, 31, 31)
    
    # Load predictions
    csv_path = f'/mnt/disks/data/data/model_output/{sample_id}.csv'
    predictions = pd.read_csv(csv_path)
    
    return images, predictions

def convert_to_display_image(cell_image):
    """Convert 4-channel cell image to RGB for display."""
    # cell_image shape: (4, 31, 31)
    cell_image = cell_image.transpose(1, 2, 0)  # (31, 31, 4)
    
    # Extract channels
    img_fluorescence = cell_image[:, :, [2, 1, 0]]  # BGR to RGB
    img_dpc = cell_image[:, :, 3]
    img_dpc = np.stack([img_dpc] * 3, axis=2)  # Grayscale to RGB
    
    # Weighted overlay
    img_overlay = 0.64 * img_fluorescence + 0.36 * img_dpc
    return img_overlay.astype('uint8')

# Example usage
sample_id = 'PAT-070-3_2023-01-22_15-24-28.812821'
images, predictions = load_sample_data(sample_id)

# Get top parasitic cells
top_parasites = predictions.nlargest(10, 'parasite output')
for _, row in top_parasites.iterrows():
    idx = int(row['index'])
    cell_img = convert_to_display_image(images[idx])
    # cell_img is now a 31x31x3 RGB image
```

#### Analyzing Threshold Data

```python
def load_threshold_analysis(threshold=0.80):
    """Load count analysis at specific threshold."""
    df = pd.read_csv(f'/mnt/disks/data/dash app/count vs threshold/all_dataset_prediction_counts_{threshold:.2f}.csv')
    
    # Filter infected samples (>5 parasites per 5M RBC)
    infected = df[df['Positives per 5M RBC'] > 5]
    
    return df, infected

def get_sample_trend(sample_id):
    """Get parasite count trend across all thresholds."""
    thresholds = np.arange(0.24, 1.01, 0.02)
    trends = []
    
    for t in thresholds:
        df = pd.read_csv(f'/mnt/disks/data/dash app/count vs threshold/all_dataset_prediction_counts_{t:.2f}.csv')
        sample_data = df[df['dataset ID'] == sample_id]
        if not sample_data.empty:
            trends.append({
                'threshold': t,
                'positives_per_5m': sample_data['Positives per 5M RBC'].values[0],
                'positive_count': sample_data['predicted positive'].values[0]
            })
    
    return pd.DataFrame(trends)
```

#### Batch Processing for API

```python
def get_sample_statistics(sample_id):
    """Generate comprehensive statistics for a sample."""
    images, predictions = load_sample_data(sample_id)
    
    stats = {
        'sample_id': sample_id,
        'total_cells': len(predictions),
        'high_confidence_parasites': len(predictions[predictions['parasite output'] > 0.80]),
        'mean_parasite_score': predictions['parasite output'].mean(),
        'max_parasite_score': predictions['parasite output'].max(),
        'annotated_count': len(predictions[predictions['annotation'] != -1])
    }
    
    # Add threshold analysis
    threshold_data = get_sample_trend(sample_id)
    if not threshold_data.empty:
        stats['positives_at_080'] = threshold_data[threshold_data['threshold'] == 0.80]['positives_per_5m'].values[0]
    
    return stats
```

## Complete Checklist for Successful App Development

### Before You Start Coding
1. **Verify Data Availability**
   - Check that required files exist in both folders (e.g., `.npy` AND `.csv`)
   - Use set intersection to find valid samples: `npy_files.intersection(csv_files)`
   - Never assume all files have corresponding pairs

2. **Test Data Loading First**
   - Load a sample file manually to verify format
   - Check column names and data types
   - Ensure file paths are correct

### During Development
1. **Import Management**
   - Place `load_dotenv()` BEFORE using any environment variables
   - Never duplicate imports
   - Follow correct import order

2. **API Path Construction** 
   - Use `window.location.href` for dynamic base URL in JavaScript
   - Never use absolute paths like `/api/...`
   - Always encode URL parameters: `encodeURIComponent(param)`

3. **Error Handling**
   - Check `response.ok` before parsing JSON
   - Use default values for undefined data: `data.value || 0`
   - Add try-catch blocks around fetch calls
   - Provide user-friendly error messages

4. **Query Parameters**
   - Use `pattern` not `regex` for FastAPI validation (avoid deprecation warnings)
   - Validate parameter ranges with `Query(default, ge=min, le=max)`

### Testing Your App
1. **Run from correct directory**: `/mnt/disks/data/`
2. **Use unbuffered output**: `python -u app_name.py`
3. **Wait for URL to print** (10-30 seconds for Hypha connection)
4. **Test with sample data first** before loading all data

### Debugging Checklist
- ✅ Environment variables loaded? Check `.env` exists and `load_dotenv()` called
- ✅ API paths working? Use browser developer tools to check 404s
- ✅ Data files exist? Verify both `.npy` and `.csv` files present
- ✅ JavaScript errors? Check browser console for undefined values
- ✅ Hypha connection established? Wait for URL to be printed

## Creating and Serving FastAPI Applications

### IMPORTANT: Complete Working Template

Use this template as a starting point for all new apps to avoid common mistakes:

```python
import asyncio
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from hypha_rpc import connect_to_server

# CRITICAL: Load environment variables FIRST
load_dotenv()

app = FastAPI(title="Your App Title")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Your endpoints here
@app.get("/")
async def root():
    return {"message": "App is running"}

# Hypha service handler
async def serve_fastapi(args, context=None):
    # Don't print here to avoid BrokenPipeError when running in background
    await app(args["scope"], args["receive"], args["send"])

async def main():
    server = await connect_to_server({
        "server_url": "https://hypha.aicell.io",
        "workspace": os.environ.get('HYPHA_WORKSPACE', 'default-workspace'),
        "token": os.environ.get("HYPHA_TOKEN", "")
    })

    svc_info = await server.register_service({
        "id": "your-app-id",
        "name": "Your App Name",
        "type": "asgi",
        "serve": serve_fastapi,
        "config": {"visibility": "public", "require_context": True}
    })

    print(f"✨ App is running!")
    print(f"📸 Access at: {server.config.public_base_url}/{server.config.workspace}/apps/{svc_info['id'].split('/')[1]}")
    
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())
```

### FastAPI with Hypha Server Integration

Instead of running FastAPI traditionally, we integrate it with Hypha server for distributed access:

```python
# fastapi_app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import pandas as pd
import asyncio
from hypha_rpc import connect_to_server

app = FastAPI(title="Malaria Detection API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/samples")
async def list_samples():
    """List all available samples."""
    import os
    npy_files = os.listdir('/mnt/disks/data/data/npy_v2/')
    samples = [f.replace('.npy', '') for f in npy_files if f.endswith('.npy')]
    return {"samples": sorted(samples), "count": len(samples)}

@app.get("/sample/{sample_id}")
async def get_sample_info(sample_id: str):
    """Get detailed information about a sample."""
    try:
        # Load data
        images = np.load(f'/mnt/disks/data/data/npy_v2/{sample_id}.npy')
        predictions = pd.read_csv(f'/mnt/disks/data/data/model_output/{sample_id}.csv')
        
        return {
            "sample_id": sample_id,
            "total_cells": len(predictions),
            "image_shape": images.shape,
            "high_confidence_parasites": int((predictions['parasite output'] > 0.80).sum()),
            "statistics": {
                "mean_parasite_score": float(predictions['parasite output'].mean()),
                "max_parasite_score": float(predictions['parasite output'].max()),
                "min_parasite_score": float(predictions['parasite output'].min())
            }
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Sample not found")

@app.get("/sample/{sample_id}/top_cells")
async def get_top_parasitic_cells(sample_id: str, limit: int = 10):
    """Get top parasitic cells for a sample."""
    try:
        predictions = pd.read_csv(f'/mnt/disks/data/data/model_output/{sample_id}.csv')
        top_cells = predictions.nlargest(limit, 'parasite output')
        
        return {
            "sample_id": sample_id,
            "cells": top_cells[['index', 'parasite output', 'annotation']].to_dict('records')
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Sample not found")

# To serve it you have to use hypha
async def serve_fastapi(args, context=None):
    # context can be used for authorization if needed
    # Don't print here to avoid BrokenPipeError
    await app(args["scope"], args["receive"], args["send"])

async def main():
    # Connect to Hypha server
    server = await connect_to_server({"server_url": "https://hypha.aicell.io", "workspace": os.environ['HYPHA_WORKSPACE'], "token": os.environ["HYPHA_TOKEN"]})

    svc_info = await server.register_service({
        "id": "malaria-detector",
        "name": "malaria-detector",
        "type": "asgi",
        "serve": serve_fastapi,
        "config": {"visibility": "public", "require_context": True}
    })

    print(f"Access your app at:  {server.config.public_base_url}/{server.config.workspace}/apps/{svc_info['id'].split('/')[1]}")
    await server.serve()

asyncio.run(main())
```

### Running the FastAPI Application

```bash
# Install dependencies
pip install fastapi uvicorn hypha-rpc numpy pandas

# Run with Hypha integration (creates public URL)
python fastapi_app.py
```

See working example in /mnt/disks/data/fastapi_example_app.py

## Proven Successful Patterns

### Data Loading Pattern
```python
def get_available_samples():
    """Only return samples that have complete data"""
    npy_files = set(f.replace('.npy', '') for f in os.listdir('/mnt/disks/data/data/npy_v2/') if f.endswith('.npy'))
    csv_files = set(f.replace('.csv', '') for f in os.listdir('/mnt/disks/data/data/model_output/') if f.endswith('.csv'))
    return sorted(list(npy_files.intersection(csv_files)))
```

### HTML with JavaScript API Calls Pattern
```javascript
// Always use this pattern for API calls in HTML
function getApiUrl(endpoint) {
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    return base + endpoint;
}

async function fetchWithErrorHandling(endpoint) {
    try {
        const response = await fetch(getApiUrl(endpoint));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}
```

### FastAPI Endpoint Pattern
```python
@app.get("/api/data/{item_id}")
async def get_data(item_id: str, limit: int = Query(50, ge=1, le=500)):
    try:
        # Always validate file existence
        if not os.path.exists(f'/path/to/{item_id}.ext'):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Load and process data
        data = load_data(item_id)
        return {"status": "success", "data": data[:limit]}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### App Startup Pattern
```python
if __name__ == "__main__":
    # Always check working directory
    print(f"Working directory: {os.getcwd()}")
    
    # Verify critical files exist
    if not os.path.exists('.env'):
        print("Warning: .env file not found!")
    
    # Run the app
    asyncio.run(main())
```

## Troubleshooting Guide

### Problem: Sample list not showing / App not responding
**Causes & Solutions:**
1. **Environment variables not loaded**: Ensure `.env` file exists and `load_dotenv()` is called
2. **App stuck connecting**: Check if Hypha token is valid and not expired
3. **Import errors**: Check for duplicate imports and correct import order
4. **Directory issue**: Always run from `/mnt/disks/data/` directory

### Problem: App starts but URL not printed
**Solution:** Use `-u` flag for unbuffered Python output:
```bash
python -u app_name.py
```

### Problem: "regex has been deprecated" warning
**Solution:** Use `pattern` instead of `regex` in FastAPI Query parameters

### Checking if App is Running
```bash
# Check running Python processes
ps aux | grep python | grep your_app_name

# Check app output (if using background process)
# Use BashOutput tool with the bash_id to check output
```

### Proper App Execution Steps
1. Navigate to correct directory: `cd /mnt/disks/data`
2. Run with unbuffered output: `python -u app_name.py`
3. Wait for URL to be printed (can take 10-30 seconds for Hypha connection)
4. Copy the complete URL and provide to user
5. If app doesn't start, check for import errors or missing dependencies

### Advanced API Endpoints Example

```python
@app.post("/analyze/batch")
async def batch_analysis(sample_ids: list[str], threshold: float = 0.80):
    """Analyze multiple samples at once."""
    results = []
    for sample_id in sample_ids:
        try:
            stats = get_sample_statistics(sample_id)
            results.append(stats)
        except Exception as e:
            results.append({"sample_id": sample_id, "error": str(e)})
    
    return {"results": results, "threshold": threshold}

@app.get("/threshold/{threshold}/infected")
async def get_infected_samples(threshold: float):
    """Get all infected samples at given threshold."""
    df = pd.read_csv(f'/mnt/disks/data/dash app/count vs threshold/all_dataset_prediction_counts_{threshold:.2f}.csv')
    infected = df[df['Positives per 5M RBC'] > 5]
    
    return {
        "threshold": threshold,
        "infected_count": len(infected),
        "samples": infected[['dataset ID', 'Positives per 5M RBC']].to_dict('records')
    }
```

## Working with the Codebase

### When working with the Python dashboard:
- Preserve authentication setup (HTTP Basic Auth)
- Maintain data processing pipeline for microscopy images
- Test with sample data files in `/mnt/disks/data/` directory
- Keep pagination at 80 items per page for performance

### When creating data APIs:
- Use FastAPI for modern async API development
- Integrate with Hypha for distributed access when needed
- Always validate sample IDs before file operations
- Cache frequently accessed data for performance
- Include proper error handling for missing files

### Security Considerations:
- Deno agents run in sandboxed subprocesses with configurable permissions
- Dashboard handles sensitive scientific/medical data - maintain authentication
- Never expose credentials or API keys in code
- Validate all inputs when creating APIs
- Use environment variables for sensitive configuration
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.