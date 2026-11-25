const express = require('express');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const configPath = path.join(__dirname, 'config.json');

function loadAppConfig() {
    const defaults = { port: 3090, host: 'localhost', version: 'v34', cachePrefix: 'manitou-library' };
    try {
        if (fs.existsSync(configPath)) {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return { ...defaults, ...parsed };
        }
    } catch (err) {
        console.warn('Warning: failed to parse config.json, using defaults:', err.message);
    }
    return defaults;
}

const initialConfig = loadAppConfig();
const PORT = Number(process.env.PORT) || Number(initialConfig.port) || 3090;

// Enable JSON bodies and CORS
app.use(express.json());
app.use(cors());

// Paths
const dataDir = path.join(__dirname, 'data');
const catalogPath = path.join(dataDir, 'catalog.json');

// Ensure data dir exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Ensure catalog exists
if (!fs.existsSync(catalogPath)) {
    fs.writeFileSync(catalogPath, JSON.stringify([], null, 2));
}

// Multer setup for PDF uploads
const upload = multer({ dest: 'uploads/' });

// Protect /admin routes with Basic Auth (challenge disabled to prevent browser popup)
const adminAuth = basicAuth({
    users: { 'admin': 'manitou2026' },
    challenge: false
});

// Serve the admin page statically (authentication verified in-page and on APIs)
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// 0. Verify credentials (client will check this on load/submit)
app.get('/api/auth/verify', adminAuth, (req, res) => {
    res.json({ success: true });
});

// --- API ROUTES ---

// Load local .env if present (gitignored)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = (match[2] || '').replace(/^['"]|['"]$/g, '');
        }
    });
}

// Health check & dynamic runtime config endpoints (single source of truth from config.json)
const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || '';

app.get('/config.js', (req, res) => {
    const cfg = loadAppConfig();
    const runtimeConfig = {
        port: PORT,
        host: cfg.host || 'localhost',
        version: cfg.version || 'v34',
        cacheName: `${cfg.cachePrefix || 'manitou-library'}-${cfg.version || 'v34'}`,
        hasServerAiKey: Boolean(DEFAULT_GEMINI_KEY)
    };
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(`window.__MANITOU_CONFIG__ = ${JSON.stringify(runtimeConfig)};\n`);
});

app.get('/api/ping', (req, res) => {
    const cfg = loadAppConfig();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
        status: 'ok',
        port: PORT,
        host: cfg.host || 'localhost',
        version: cfg.version || 'v34',
        cacheName: `${cfg.cachePrefix || 'manitou-library'}-${cfg.version || 'v34'}`,
        time: Date.now()
    });
});

// Proxy endpoint for Gemini AI synthesis (avoids browser CORS and supports both AIza... keys and AQ... tokens)
app.post('/api/ai-ask', async (req, res) => {
    try {
        const { key, systemPrompt, userPayload } = req.body || {};
        const activeKey = (key || DEFAULT_GEMINI_KEY || '').trim();
        if (!activeKey) {
            return res.status(400).json({ error: 'Missing Gemini API key' });
        }

        const payload = {
            system_instruction: { parts: [{ text: systemPrompt || '' }] },
            contents: [{ role: 'user', parts: [{ text: userPayload || '' }] }],
            generationConfig: { temperature: 0.25, maxOutputTokens: 900 }
        };

        // Try standard API key query parameter first
        let url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(activeKey)}`;
        let resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // If key starts with AQ. or query param returned 400/401/403, also try Bearer token / x-goog-api-key header
        if (!resp.ok && activeKey.startsWith('AQ.')) {
            const altUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
            resp = await fetch(altUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeKey}`
                },
                body: JSON.stringify(payload)
            });
        }

        if (!resp.ok) {
            const errBody = await resp.text().catch(() => '');
            return res.status(resp.status).json({ error: `Gemini API HTTP ${resp.status}`, details: errBody });
        }

        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ text: text.trim() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Get all books (Public - so main site can use it)
app.get('/api/books', (req, res) => {
    try {
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        res.json(catalog);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read catalog' });
    }
});

// 2. Add a new book (Protected)
app.post('/api/books', adminAuth, (req, res) => {
    try {
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        const newBook = req.body;
        
        // Generate new ID
        const maxId = catalog.reduce((max, book) => Math.max(max, book.id || 0), 0);
        newBook.id = maxId + 1;
        
        // Default cover design if no image provided
        if (!newBook.imgUrl) {
            newBook.design = `cover-design-${Math.floor(Math.random() * 4) + 1}`;
        }
        
        catalog.push(newBook);
        fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
        
        // Create an empty chapter file for this book
        const bookFile = path.join(dataDir, `book_${newBook.id}.json`);
        fs.writeFileSync(bookFile, JSON.stringify([], null, 2));
        
        res.json({ success: true, book: newBook });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Delete a book (Protected)
app.delete('/api/books/:id', adminAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        catalog = catalog.filter(b => b.id !== id);
        fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
        
        // Also delete the book data file
        const bookFile = path.join(dataDir, `book_${id}.json`);
        if (fs.existsSync(bookFile)) {
            fs.unlinkSync(bookFile);
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Update a book's details (Protected)
app.put('/api/books/:id', adminAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const updatedBook = req.body;
        let catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        
        const index = catalog.findIndex(b => b.id === id);
        if (index !== -1) {
            catalog[index] = { ...catalog[index], ...updatedBook };
            fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
            res.json({ success: true, book: catalog[index] });
        } else {
            res.status(404).json({ error: 'Book not found' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. Get chapters for a book (Protected)
app.get('/api/books/:id/chapters', adminAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const bookFile = path.join(dataDir, `book_${id}.json`);
        if (fs.existsSync(bookFile)) {
            const chapters = JSON.parse(fs.readFileSync(bookFile, 'utf8'));
            res.json(chapters);
        } else {
            res.json([]);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. Update chapters for a book (Protected)
app.put('/api/books/:id/chapters', adminAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const chapters = req.body;
        const bookFile = path.join(dataDir, `book_${id}.json`);
        fs.writeFileSync(bookFile, JSON.stringify(chapters, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 7. Upload PDF and process it (Protected)
app.post('/api/upload-pdf/:bookId', adminAuth, upload.single('pdf'), async (req, res) => {
    try {
        const bookId = parseInt(req.params.bookId);
        if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

        const dataBuffer = fs.readFileSync(req.file.path);
        
        // Parse PDF (compatible with both pdf-parse v1 function and v2 PDFParse class)
        let fullText = '';
        if (typeof pdfParse === 'function') {
            const data = await pdfParse(dataBuffer);
            fullText = data.text || '';
        } else if (pdfParse && pdfParse.PDFParse) {
            const parser = new pdfParse.PDFParse({ data: dataBuffer });
            const resData = await parser.getText();
            fullText = resData.text || '';
            if (typeof parser.destroy === 'function') await parser.destroy().catch(() => {});
        }
        
        const newChapter = {
            title: "פרק מצורף (מ-PDF)",
            text: fullText.replace(/\n/g, '<br>')
        };
        
        const bookFile = path.join(dataDir, `book_${bookId}.json`);
        let currentChapters = [];
        if (fs.existsSync(bookFile)) {
            currentChapters = JSON.parse(fs.readFileSync(bookFile, 'utf8'));
        }
        
        currentChapters.push(newChapter);
        fs.writeFileSync(bookFile, JSON.stringify(currentChapters, null, 2));
        
        // Clean up temp file
        fs.unlinkSync(req.file.path);
        
        res.json({ success: true, message: 'PDF processed successfully' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 5b. Public endpoint to get chapters for a book (fallback for reader)
app.get('/api/books/:id/public-chapters', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const bookFile = path.join(dataDir, `book_${id}.json`);
        if (fs.existsSync(bookFile)) {
            const chapters = JSON.parse(fs.readFileSync(bookFile, 'utf8'));
            res.json(chapters);
        } else {
            res.status(404).json({ error: 'Book file not found' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 8. Get scraped transcripts archive from library.manitou.org.il & manitou.org.il
const transcriptsArchivePath = path.join(dataDir, 'transcripts_archive.json');
app.get('/api/transcripts', (req, res) => {
    try {
        if (fs.existsSync(transcriptsArchivePath)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.sendFile(transcriptsArchivePath);
        }
        res.json({ updatedAt: null, totalCount: 0, libraryCount: 0, manitouOrgCount: 0, items: [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 9. Trigger live sync/scrape of transcripts from library.manitou.org.il & manitou.org.il
const { execFile } = require('child_process');
let isTranscriptSyncRunning = false;
app.post('/api/transcripts/sync', (req, res) => {
    if (isTranscriptSyncRunning) {
        return res.json({ status: 'running', message: 'סנכרון תמלולים כבר פועל ברקע...' });
    }
    isTranscriptSyncRunning = true;
    const scriptPath = path.join(__dirname, 'fetch_transcripts.py');
    execFile('python3', [scriptPath], { timeout: 300000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
        isTranscriptSyncRunning = false;
        if (err) {
            console.error('Transcripts sync error:', err, stderr);
            // Still return existing archive if available
            if (fs.existsSync(transcriptsArchivePath)) {
                try {
                    const existing = JSON.parse(fs.readFileSync(transcriptsArchivePath, 'utf8'));
                    return res.json({ status: 'cached', warning: err.message, data: existing });
                } catch (_) {}
            }
            return res.status(500).json({ error: err.message, details: stderr });
        }
        try {
            const updated = JSON.parse(fs.readFileSync(transcriptsArchivePath, 'utf8'));
            res.json({ status: 'ok', log: stdout, data: updated });
        } catch (readErr) {
            res.status(500).json({ error: readErr.message });
        }
    });
});

// Serve the main website statically (Public) with fresh headers for HTML, JS, CSS, and JSON
app.use(express.static(__dirname, {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
        if (/\.(html|js|css|json)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

app.listen(PORT, () => {
    console.log(`Server running!`);
    console.log(`- Main site: http://localhost:${PORT}`);
    console.log(`- Admin panel: http://localhost:${PORT}/admin`);
});
