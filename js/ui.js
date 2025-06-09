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