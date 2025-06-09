class GraphVisualizer {
    constructor(svgSelector) {
        this.svg = d3.select(svgSelector);
        this.svgNode = this.svg.node();
        this.width = this.svgNode.clientWidth;
        this.height = this.svgNode.clientHeight;
        
        this.activeNodeId = null;
        this.dragged = false;
        this.onNodeClickCallback = () => {};

        this.initSimulation();
        this.initGraphElements();
        this.initZoom();

        this.svg.on("click", () => {
            this.handleNodeClick(null);
        });
    }

    onNodeClick(callback) {
        this.onNodeClickCallback = callback;
    }

    initSimulation() {
        this.linkForce = d3.forceLink().id(d => d.id).distance(60);
        this.chargeForce = d3.forceManyBody().strength(-80);
        this.simulation = d3.forceSimulation()
            .force("link", this.linkForce)
            .force("charge", this.chargeForce)
            .force("center", d3.forceCenter(this.width / 2, this.height / 2))
            .on("tick", () => this.ticked())
            .on("end", () => {
                if (this.activeNodeId === null) {
                    this.graph.nodes.forEach(node => {
                        if (!node.pinned) {
                            node.fx = node.x;
                            node.fy = node.y;
                        }
                    });
                }
            });
    }

    initGraphElements() {
        this.container = this.svg.append("g").attr("class", "graph-container");

        this.container.append("defs").append("marker")
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
        
        this.linkGroup = this.container.append("g").attr("class", "links");
        this.nodeGroup = this.container.append("g").attr("class", "nodes");
        this.labelGroup = this.container.append("g").attr("class", "labels");
    }

    initZoom() {
        this.svg.call(d3.zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", () => {
                this.container.attr("transform", d3.event.transform);
            })
        );
    }

    render(graph) {
        this.graph = graph;
        
        const clusterCount = d3.max(this.graph.nodes, d => d.cluster) + 1;
        this.color = d3.scaleOrdinal(d3.schemeCategory10).domain(d3.range(clusterCount));

        this.updateElements();

        this.simulation.nodes(this.graph.nodes);
        this.simulation.force("link").links(this.graph.links);
        this.simulation.alpha(1).restart();
    }

    updateElements() {
        // Links
        this.links = this.linkGroup.selectAll("line").data(this.graph.links, d => d.original.id);
        this.links.exit().remove();
        this.links = this.links.enter().append("line")
            .attr("class", "link")
            .attr("stroke-width", 2)
            .attr("marker-end", "url(#arrow)")
            .on("click", d => {
                this.onNodeClickCallback('link', d);
                d3.event.stopPropagation();
            })
            .merge(this.links);

        // Nodes
        this.nodes = this.nodeGroup.selectAll("circle").data(this.graph.nodes, d => d.id);
        this.nodes.exit().remove();
        this.nodes = this.nodes.enter().append("circle")
            .attr("class", "node")
            .attr("r", 10)
            .call(this.dragHandler())
            .on("click", d => {
                if (!this.dragged) {
                    this.handleNodeClick(d);
                }
                d3.event.stopPropagation();
            })
            .merge(this.nodes)
            .attr("fill", d => this.color(d.cluster));

        this.nodes.select("title").remove();
        this.nodes.append("title")
             .text(d => `Name: ${d.name}\nType: ${d.entity_type}`);

        // Labels
        this.labels = this.labelGroup.selectAll("text").data(this.graph.nodes, d => d.id);
        this.labels.exit().remove();
        this.labels = this.labels.enter().append("text")
            .attr("class", "node-label")
            .style("pointer-events", "none")
            .merge(this.labels)
            .text(d => d.name);

        this.updateView();
    }

    handleNodeClick(d) {
        if (!d && !this.activeNodeId) return;
        
        const previousActiveNodeId = this.activeNodeId;

        if (d && this.activeNodeId === d.id) {
            // Unset active node if clicking it again
            this.activeNodeId = null;
            // Unpin the node if it was not manually dragged
            if (!d.pinned) {
                d.fx = null;
                d.fy = null;
            }
        } else {
            this.activeNodeId = d ? d.id : null;
        }

        this.onNodeClickCallback(d ? 'node' : null, d);
        this.updateView(previousActiveNodeId);
        this.simulation.alpha(0.3).restart();
    }
    
    dragHandler() {
        return d3.drag()
            .on("start", d => {
                this.dragged = false;
                if (!d3.event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", d => {
                this.dragged = true;
                d.fx = d3.event.x;
                d.fy = d3.event.y;
            })
            .on("end", d => {
                if (!d3.event.active) this.simulation.alphaTarget(0);
                if (this.dragged) {
                    d.pinned = true; // Pin node after dragging
                }
            });
    }

    updateView(previousActiveNodeId = null) {
        const isSpotlight = this.activeNodeId !== null;
        const neighbors = new Set();
        if (isSpotlight) {
            neighbors.add(this.activeNodeId);
            this.graph.links.forEach(l => {
                if (l.source.id === this.activeNodeId) neighbors.add(l.target.id);
                if (l.target.id === this.activeNodeId) neighbors.add(l.source.id);
            });
        }

        // Adjust forces for spotlight effect
        this.linkForce.distance(link => {
            if (isSpotlight && (link.source.id === this.activeNodeId || link.target.id === this.activeNodeId)) {
                return 150;
            }
            return 60;
        });

        this.chargeForce.strength(d => {
            // Stronger repulsion for neighbors to spread them out
            if (isSpotlight && neighbors.has(d.id) && d.id !== this.activeNodeId) {
                return -250;
            }
            return -80;
        });

        const deselection = previousActiveNodeId && !isSpotlight;
        let previousNeighbors;
        if (deselection) {
            previousNeighbors = new Set([previousActiveNodeId]);
            this.graph.links.forEach(l => {
                if (l.source.id === previousActiveNodeId) previousNeighbors.add(l.target.id);
                if (l.target.id === previousActiveNodeId) previousNeighbors.add(l.source.id);
            });
        }

        // Fix positions and update styles
        this.graph.nodes.forEach(n => {
            if (isSpotlight) {
                if (n.id === this.activeNodeId) {
                    n.fx = n.x;
                    n.fy = n.y;
                } else if (!neighbors.has(n.id) && !n.pinned) {
                    n.fx = n.x; // Freeze non-neighbors
                    n.fy = n.y;
                } else if (neighbors.has(n.id) && !n.pinned) {
                    n.fx = null; // Let neighbors move
                    n.fy = null;
                }
            } else if (deselection) {
                if (previousNeighbors.has(n.id) && !n.pinned) {
                    n.fx = null;
                    n.fy = null;
                }
            }
            else if (!n.pinned) {
                n.fx = null; // Release all non-pinned nodes
                n.fy = null;
            }
        });

        this.nodes
            .style("stroke", n => {
                if (n.id === this.activeNodeId) return "black";
                if (isSpotlight && neighbors.has(n.id)) return "#555";
                return "white";
            })
            .style("stroke-width", n => (n.id === this.activeNodeId) ? 2.5 : 2)
            .style("opacity", n => (isSpotlight && !neighbors.has(n.id)) ? 0.5 : 1.0);

        this.links.style("opacity", l => (isSpotlight && l.source.id !== this.activeNodeId && l.target.id !== this.activeNodeId) ? 0.3 : 1.0);
        this.labels.style("opacity", n => (isSpotlight && !neighbors.has(n.id)) ? 0.5 : 1.0);
    }
    
    ticked() {
        if (!this.graph) return; // Don't tick if no data

        this.links
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        this.nodes
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        this.labels
            .attr("x", d => d.x + 12)
            .attr("y", d => d.y + 4);
    }
} 