const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

let entitiesData = null;
let relationshipsData = null;

const [,, entitiesPath, relationshipsPath] = process.argv;

if (entitiesPath && relationshipsPath) {
    try {
        entitiesData = fs.readFileSync(path.resolve(entitiesPath), 'utf8');
    } catch (e) {
        console.error('Failed to read entities file:', e.message);
    }
    try {
        relationshipsData = fs.readFileSync(path.resolve(relationshipsPath), 'utf8');
    } catch (e) {
        console.error('Failed to read relationships file:', e.message);
    }
}

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (entitiesData && relationshipsData) {
        console.log('Entities and relationships data loaded from command line arguments.');
    } else {
        console.log('No data files provided. Use file upload in the browser.');
    }
}); 