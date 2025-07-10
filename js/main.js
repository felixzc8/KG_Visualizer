document.addEventListener('DOMContentLoaded', () => {
    const visualizer = new GraphVisualizer('#graph-svg');
    visualizer.onNodeClick(showDetails);

    function showDetails(type, data) {
        const detailsDiv = document.getElementById('details');
        if (!type || !data) {
            detailsDiv.style.display = 'none';
            return;
        }
        
        let content = '';
        if (type === 'node') {
            content = `
                <h3>Node Details</h3>
                <p><strong>Name:</strong> ${data.name}</p>
                <p><strong>Type:</strong> ${data.entity_type}</p>
                <p><strong>ID:</strong> ${data.id}</p>
                ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
            `;
        } else if (type === 'link') {
            content = `
                <h3>Relationship Details</h3>
                <p><strong>Source:</strong> ${data.original.source_entity_id}</p>
                <p><strong>Target:</strong> ${data.original.target_entity_id}</p>
                <p><strong>Type:</strong> ${data.original.relationship_type || 'N/A'}</p>
                ${data.original.description ? `<p><strong>Description:</strong> ${data.original.description}</p>` : ''}
            `;
        } else if (type === 'error') {
            content = `
                <h3>Error</h3>
                <p style="color: red;">${data.message}</p>
            `;
        }
        
        detailsDiv.innerHTML = content;
        detailsDiv.style.display = 'block';
    }

    function setupFileInput(inputId, nameId) {
        const fileInput = document.getElementById(inputId);
        const fileNameSpan = document.getElementById(nameId);
        if (fileInput && fileNameSpan) {
            fileInput.addEventListener('change', () => {
                fileNameSpan.textContent = fileInput.files.length > 0 
                    ? fileInput.files[0].name 
                    : 'No file chosen';
            });
        }
    }

    setupFileInput('entities-file', 'entities-file-name');
    setupFileInput('relationships-file', 'relationships-file-name');

    document.getElementById('generate-button').addEventListener('click', () => {
        const entitiesFile = document.getElementById('entities-file').files[0];
        const relationshipsFile = document.getElementById('relationships-file').files[0];
        
        if (entitiesFile && relationshipsFile) {
            Promise.all([
                readFile(entitiesFile),
                readFile(relationshipsFile)
            ]).then(([entitiesText, relationshipsText]) => {
                let entities, relationships;
                const entitiesExt = getFileExtension(entitiesFile.name);
                try {
                    if (entitiesExt === 'json') {
                        entities = JSON.parse(entitiesText);
                        if (!Array.isArray(entities) && typeof entities === 'object') {
                            const arrKey = Object.keys(entities).find(k => Array.isArray(entities[k]));
                            if (arrKey) entities = entities[arrKey];
                        }
                    } else if (entitiesExt === 'csv') {
                        entities = parseCSV(entitiesText);
                    }
                } catch (e) {
                    showDetails('error', { message: `Error parsing entities file: ${e.message}` });
                    return;
                }

                const relationshipsExt = getFileExtension(relationshipsFile.name);
                 try {
                    if (relationshipsExt === 'json') {
                        relationships = JSON.parse(relationshipsText);
                        if (!Array.isArray(relationships) && typeof relationships === 'object') {
                            const arrKey = Object.keys(relationships).find(k => Array.isArray(relationships[k]));
                            if (arrKey) relationships = relationships[arrKey];
                        }
                    } else if (relationshipsExt === 'csv') {
                        relationships = parseCSV(relationshipsText);
                    }
                } catch (e) {
                    showDetails('error', { message: `Error parsing relationships file: ${e.message}` });
                    return;
                }
    
                const graph = createGraphData(entities, relationships);
                visualizer.render(graph);
            }).catch(error => {
                 showDetails('error', { message: `Error reading files: ${error.message}` });
            });
        } else {
             showDetails('error', { message: 'Please select both entities and relationships JSON or CSV files.' });
        }
    });
});

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const header = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const entry = {};
        header.forEach((h, i) => {
            entry[h] = values[i];
        });
        return entry;
    });
    return data;
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

function createGraphData(entities, relationships) {
    const nodes = entities.map(e => ({...e, pinned: false}));
    const links = relationships.map(r => ({
        source: r.source_entity_id,
        target: r.target_entity_id,
        original: r
    }));

    assignClusters(nodes, links);

    return { nodes, links };
}

function assignClusters(nodes, links) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let clusterId = 0;
    const visited = new Set();
    function dfs(node, cluster) {
        if(!node) return;
        node.cluster = cluster;
        visited.add(node.id);
        links.forEach(link => {
            const sourceNode = nodeMap.get(link.source);
            const targetNode = nodeMap.get(link.target);
            if (link.source === node.id && !visited.has(link.target)) {
                dfs(targetNode, cluster);
            } else if (link.target === node.id && !visited.has(link.source)) {
                dfs(sourceNode, cluster);
            }
        });
    }
    nodes.forEach(node => {
        if (!visited.has(node.id)) {
            dfs(node, clusterId);
            clusterId++;
        }
    });
} 