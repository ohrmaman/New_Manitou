const express = require('express');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

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
        
        // Parse PDF
        const data = await pdfParse(dataBuffer);
        
        const fullText = data.text;
        
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

// Serve the main website statically (Public)
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`Server running!`);
    console.log(`- Main site: http://localhost:${PORT}`);
    console.log(`- Admin panel: http://localhost:${PORT}/admin`);
});
