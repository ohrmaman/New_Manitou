#!/usr/bin/env node
/**
 * Fast Hebrew/French PDF Free-Text & Clean HTML Extractor for Manitou Library
 * Modes:
 *   1. Single file:  node extract_pdf_text.js /path/to/file.pdf
 *      -> outputs JSON { plainText, html, wordCount, pageCount }
 *   2. Batch manifest: node extract_pdf_text.js --batch /path/to/manifest.json /path/to/output.json
 *      manifest.json = [{ id: "...", pdfPath: "/abs/path.pdf" }, ...]
 *      output.json   = { [id]: { plainText, html, wordCount, pageCount }, ... }
 */

const fs = require('fs');
const pdfParseModule = require('pdf-parse');

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function cleanExtractedPdfText(rawText) {
    if (!rawText) return { plainText: '', html: '', wordCount: 0 };

    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cleanedLines = [];

    for (const rawLine of lines) {
        // Fix legacy Hebrew PDF font mapping where 'נ' (Nun) was encoded as '\u00aa' ('ª')
        const normalizedRaw = rawLine.replace(/\u00aa/g, 'נ');
        const line = normalizedRaw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uF000-\uF8FF]/g, '').trim();
        if (!line) {
            cleanedLines.push('');
            continue;
        }
        // Skip page separator markers like "-- 1 of 24 --" or standalone page numbers
        if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue;
        if (/^\d{1,4}$/.test(line)) continue;

        // Skip short garbled legacy ASCII running headers (e.g. "xnze dcedi", "zecdid zyxen") when no Hebrew letters exist
        const hasHebrew = /[\u0590-\u05FF]/.test(line);
        if (!hasHebrew && line.length < 36 && /^[a-z0-9`'"/\\\s.,-]+$/i.test(line)) {
            continue;
        }

        cleanedLines.push(line);
    }

    // Group lines into logical paragraphs
    const paragraphs = [];
    let currentPara = [];

    const flushPara = () => {
        if (currentPara.length > 0) {
            const joined = currentPara.join(' ').replace(/\s+/g, ' ').trim();
            if (joined.length > 1) {
                paragraphs.push(joined);
            }
            currentPara = [];
        }
    };

    for (const line of cleanedLines) {
        if (!line) {
            flushPara();
            continue;
        }
        currentPara.push(line);
        // Heuristic paragraph break if line ends with sentence punctuation and is reasonably short or para is long
        if (/[.:?!]$/.test(line) && (line.length < 58 || currentPara.length >= 6)) {
            flushPara();
        }
    }
    flushPara();

    const plainText = paragraphs.join('\n\n').trim();
    const html = paragraphs
        .map((p) => {
            if (p.length < 75 && !/[.,;]$/.test(p)) {
                return `<h3>${escapeHtml(p)}</h3>`;
            }
            return `<p>${escapeHtml(p)}</p>`;
        })
        .join('\n');
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

    return { plainText, html, wordCount };
}

async function extractOnePdf(pdfPath) {
    const dataBuffer = fs.readFileSync(pdfPath);
    let rawText = '';
    let pageCount = 0;

    if (typeof pdfParseModule === 'function') {
        const res = await pdfParseModule(dataBuffer);
        rawText = res.text || '';
        pageCount = res.numpages || 0;
    } else if (pdfParseModule && pdfParseModule.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: dataBuffer });
        const res = await parser.getText();
        rawText = res.text || '';
        pageCount = res.total || (res.pages ? res.pages.length : 0);
        if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => {});
        }
    }

    const cleaned = cleanExtractedPdfText(rawText);
    return {
        plainText: cleaned.plainText,
        html: cleaned.html,
        wordCount: cleaned.wordCount,
        pageCount
    };
}

async function main() {
    const args = process.argv.slice(2);
    if (args[0] === '--batch') {
        const manifestPath = args[1];
        const outputPath = args[2];
        const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const results = {};

        for (const item of items) {
            try {
                if (item.pdfPath && fs.existsSync(item.pdfPath)) {
                    results[item.id] = await extractOnePdf(item.pdfPath);
                }
            } catch (e) {
                results[item.id] = { plainText: '', html: '', wordCount: 0, pageCount: 0, error: e.message };
            }
        }
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
        return;
    }

    if (args[0]) {
        const out = await extractOnePdf(args[0]);
        process.stdout.write(JSON.stringify(out));
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { extractOnePdf, cleanExtractedPdfText };
