# Knowledge Graph Visualizer

A powerful web-based interactive tool for visualizing knowledge graphs from entity and relationship data. Upload your data files and explore complex networks through an intuitive, force-directed graph visualization.

## 🌟 Features

### Interactive Visualization
- **Force-directed layout** using D3.js physics simulation
- **Interactive node exploration** with spotlight mode
- **Drag-and-drop positioning** with node pinning
- **Zoom and pan** capabilities for detailed exploration
- **Color-coded clusters** for better data organization

### User Interface
- **Dual file upload** for entities and relationships
- **Dark/Light mode toggle** with persistent preferences
- **Detailed information panel** showing node and edge properties
- **Responsive design** for various screen sizes
- **Clean, modern UI** with smooth transitions

### Data Support
- **Multiple file formats**: JSON and CSV
- **Flexible data structure** with automatic parsing
- **Error handling** with user-friendly feedback
- **Real-time graph generation** from uploaded data

## 🚀 Quick Start

1. **Start the application**:
   ```bash
   python -m http.server 8080
   ```
   Navigate to `http://localhost:8080` in your browser.

2. **Upload your data files**:
   - Click "Entities" to upload your entities file
   - Click "Relationships" to upload your relationships file
   - Both JSON and CSV formats are supported

3. **Generate the graph**:
   - Click "Generate Graph" to create the visualization
   - Interact with nodes and edges to explore your data
