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

function showDetails(type, data) {
    const detailsDiv = document.getElementById('details');
    if (!detailsDiv) return;
    if (!type || !data) {
        detailsDiv.style.display = 'none';
        return;
    }
    let html = '';
    html += `<button class="details-close" id="details-close-btn" title="Close">&times;</button>`;
    if (type === 'node') {
        html += `<h3>Entity: ${data.name}</h3>`;
        html += '<ul>';
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                html += `<li><strong>${key}:</strong> ${JSON.stringify(data[key])}</li>`;
            }
        }
        html += '</ul>';
    } else if (type === 'link') {
        html += `<h3>Relationship</h3>`;
        html += '<ul>';
        for (const key in data.original) {
            if (data.original.hasOwnProperty(key)) {
                 html += `<li><strong>${key}:</strong> ${JSON.stringify(data.original[key])}</li>`;
            }
        }
        html += '</ul>';
    } else if (type === 'error') {
         html += `<h3>Error</h3><p>${data.message}</p>`;
    }
    detailsDiv.innerHTML = html;
    detailsDiv.style.display = 'block';
    const closeBtn = document.getElementById('details-close-btn');
    if (closeBtn) {
        closeBtn.onclick = function() {
            detailsDiv.style.display = 'none';
        };
    }
}

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
            if (entitiesExt === 'json') {
                try {
                    entities = JSON.parse(entitiesText);
                    if (!Array.isArray(entities) && typeof entities === 'object') {
                        const arrKey = Object.keys(entities).find(k => Array.isArray(entities[k]));
                        if (arrKey) entities = entities[arrKey];
                    }
                } catch (e) {
                    showDetails('error', { message: 'Entities file is not valid JSON.' });
                    return;
                }
            } else if (entitiesExt === 'csv') {
                entities = parseCSV(entitiesText);
            } else {
                showDetails('error', { message: 'Entities file must be .json or .csv' });
                return;
            }
            const relationshipsExt = getFileExtension(relationshipsFile.name);
            if (relationshipsExt === 'json') {
                try {
                    relationships = JSON.parse(relationshipsText);
                    if (!Array.isArray(relationships) && typeof relationships === 'object') {
                        const arrKey = Object.keys(relationships).find(k => Array.isArray(relationships[k]));
                        if (arrKey) relationships = relationships[arrKey];
                    }
                } catch (e) {
                    showDetails('error', { message: 'Relationships file is not valid JSON.' });
                    return;
                }
            } else if (relationshipsExt === 'csv') {
                relationships = parseCSV(relationshipsText);
            } else {
                showDetails('error', { message: 'Relationships file must be .json or .csv' });
                return;
            }

            const graph = createGraphData(entities, relationships);
            renderGraph(graph);
        }).catch(error => {
             showDetails('error', { message: `Error reading files: ${error.message}` });
        });
    } else {
         showDetails('error', { message: 'Please select both entities and relationships JSON or CSV files.' });
    }
});

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

function createGraphData(entities, relationships) {
    const nodes = entities.map(e => ({...e}));
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

let simulation = null;

function renderGraph(graph) {
    const svg = d3.select("#graph-svg");
    svg.selectAll("*").remove();
    const svgNode = svg.node();
    const width = svgNode.clientWidth;
    const height = svgNode.clientHeight;

    let activeNodeId = null;
    let currentNeighbors = new Set();
    let isGraphStable = false;

    svg.append("defs").append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");

    const clusterCount = d3.max(graph.nodes, d => d.cluster) + 1;
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(d3.range(clusterCount));

    const container = svg.append("g").attr("class", "graph-container");

    const linkForce = d3.forceLink()
        .id(d => d.id)
        .distance(60);

    const chargeForce = d3.forceManyBody().strength(-80);
    
    simulation = d3.forceSimulation()
        .force("link", linkForce)
        .force("charge", chargeForce)
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = container.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(graph.links)
        .enter().append("line")
        .attr("class", "link")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrow)")
        .on("click", function(d) {
            showDetails('link', d);
            d3.event.stopPropagation();
        });

    let dragged = false;
    const node = container.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(graph.nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", 10)
        .attr("fill", d => color(d.cluster))
        .style("stroke", "white")
        .style("stroke-width", 2)
        .call(d3.drag()
            .on("start", function(d) {
                if (!d3.event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
                dragged = false;
                
                if (!isGraphStable) {
                    graph.nodes.forEach(n => {
                        if (n !== d) {
                            n.fx = n.x;
                            n.fy = n.y;
                        }
                    });
                    isGraphStable = true;
                }
            })
            .on("drag", function(d) {
                d.fx = d3.event.x;
                d.fy = d3.event.y;
                dragged = true;
            })
            .on("end", function(d) {
                dragged = false;
                if (!d3.event.active) simulation.alphaTarget(0);

                if (d.id === activeNodeId) {
                    return;
                }

                if (activeNodeId && !currentNeighbors.has(d.id)) {
                    d.fx = d.x;
                    d.fy = d.y;
                } else {
                    d.fx = null;
                    d.fy = null;
                }
            })
        )
        .on("click", function(d) {
            if (!dragged && !d3.event.defaultPrevented) {
                activeNodeId = (activeNodeId === d.id) ? null : d.id;
                updateGraphState();
                if (activeNodeId) {
                    showDetails('node', d);
                } else {
                    showDetails(null, null);
                }
                d3.event.stopPropagation();
            }
        });

    const labels = container.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(graph.nodes)
        .enter().append("text")
        .attr("class", "node-label")
        .style("pointer-events", "none")
        .text(d => d.name);

    node.append("title")
        .text(d => `Name: ${d.name}\nType: ${d.entity_type}`);

    simulation.nodes(graph.nodes).on("tick", ticked);
    simulation.force("link").links(graph.links);

    function updateGraphState() {
        if (!isGraphStable) {
            isGraphStable = true;
        }
        const previousNeighbors = currentNeighbors;
        currentNeighbors = new Set();
        if (activeNodeId) {
            currentNeighbors.add(activeNodeId);
            graph.links.forEach(l => {
                if (l.source.id === activeNodeId) currentNeighbors.add(l.target.id);
                if (l.target.id === activeNodeId) currentNeighbors.add(l.source.id);
            });
        }
        
        linkForce.distance(link => {
            if (activeNodeId && (link.source.id === activeNodeId || link.target.id === activeNodeId)) {
                return 150;
            }
            return 60;
        });
        simulation.force("link", linkForce);
        
        chargeForce.strength(d => {
            if (activeNodeId && d.id === activeNodeId) {
                return 0;
            }
            if (activeNodeId && currentNeighbors.has(d.id)) {
                return -250;
            }
            return -80;
        });
        
        graph.nodes.forEach(n => {
            if (n.id === activeNodeId) {
                if (n.fx == null) {
                    n.fx = n.x;
                    n.fy = n.y;
                }
            } else {
                const isDynamic = currentNeighbors.has(n.id) || previousNeighbors.has(n.id);
                if (isDynamic) {
                    n.fx = null;
                    n.fy = null;
                } else {
                    n.fx = n.x;
                    n.fy = n.y;
                }
            }
        });

        node.style("stroke", n => {
                if (n.id === activeNodeId) return "black";
                if (currentNeighbors.has(n.id)) return "#555";
                return "white";
            })
            .style("opacity", n => (activeNodeId === null || currentNeighbors.has(n.id)) ? 1.0 : 0.5);

        link.style("opacity", l => (activeNodeId === null || l.source.id === activeNodeId || l.target.id === activeNodeId) ? 1.0 : 0.3);
        labels.style("opacity", n => (activeNodeId === null || currentNeighbors.has(n.id)) ? 1.0 : 0.5);

        simulation.alpha(1).restart();
    }

    function ticked() {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        labels
            .attr("x", d => d.x + 12)
            .attr("y", d => d.y + 4);
    }

    svg.on("click", function() {
        if (activeNodeId !== null) {
            activeNodeId = null;
            updateGraphState();
        }
        showDetails(null, null);
    });

    svg.call(d3.zoom()
        .scaleExtent([0.1, 10])
        .on("zoom", function() {
            container.attr("transform", d3.event.transform);
        })
    );
}