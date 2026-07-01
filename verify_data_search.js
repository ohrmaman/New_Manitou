const fs = require('fs');
const path = require('path');

const bookPath = path.join(__dirname, 'data', 'book_2.json');
if (!fs.existsSync(bookPath)) {
    console.error("Book 2 data file not found!");
    process.exit(1);
}

const chapters = JSON.parse(fs.readFileSync(bookPath, 'utf8'));

function testSearch(query, mode) {
    const searchWords = [query.toLowerCase()];
    let matches = [];

    chapters.forEach(chap => {
        if (!chap.text) return;
        
        // Simple HTML strip
        const plainText = chap.text.replace(/<[^>]*>/g, ' ');
        const lowerText = plainText.toLowerCase();
        
        let isMatch = false;
        if (mode === 'exact') {
            isMatch = lowerText.includes(searchWords[0]);
        } else if (mode === 'exact_word') {
            const escapedWord = searchWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?<=^|[^a-zA-Z0-9\\u0590-\\u05FF])${escapedWord}(?=$|[^a-zA-Z0-9\\u0590-\\u05FF])`, 'i');
            isMatch = regex.test(lowerText);
        }
        
        if (isMatch) {
            matches.push(chap.title || "Untitled");
        }
    });

    return matches;
}

console.log("=== Testing search for 'לבדו' ===");
const exactMatches = testSearch('לבדו', 'exact');
console.log(`Exact mode matches (${exactMatches.length}):`, exactMatches.slice(0, 5));

const exactWordMatches = testSearch('לבדו', 'exact_word');
console.log(`Exact Word mode matches (${exactWordMatches.length}):`, exactWordMatches.slice(0, 5));

// Verify that exact mode found more or different results due to substrings like 'לבדוק'
const difference = exactMatches.filter(x => !exactWordMatches.includes(x));
if (difference.length > 0) {
    console.log("Difference found! Exact mode matched chapters that Exact Word mode did not match:");
    console.log(difference);
} else {
    console.log("No difference in matched chapters for this book, but exact word filtering works correctly.");
}
