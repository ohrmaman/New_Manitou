const books = [
    {
        id: 1,
        title: "ספרים מקוונים",
        category: "other",
        categoryLabel: "כללי",
        description: "אוסף מאמרים וכתבים מקוונים.",
        link: "https://manitou.org.il/joomlatools-files/docman-images/mamarim1%20%281%29.jpg",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/mamarim1%20%281%29.jpg",
        design: "cover-design-1"
    },
    {
        id: 2,
        title: "מספד למשיח",
        category: "lessons",
        categoryLabel: "שיעורים",
        description: "שיעורים מאת הרב יהודא לאון אשכנזי (מניטו) זצ\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/masped-1",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/masped2.jpg",
        design: "cover-design-2"
    },
    {
        id: 3,
        title: "סוד מדרש התולדות 1",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק ראשון מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot1",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot1.jpg",
        design: "cover-design-3"
    },
    {
        id: 4,
        title: "סוד מדרש התולדות 2",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק שני מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot2",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladotb.jpg",
        design: "cover-design-1"
    },
    {
        id: 5,
        title: "סוד מדרש התולדות 3",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק שלישי מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot3",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot3.jpg",
        design: "cover-design-2"
    },
    {
        id: 6,
        title: "סוד מדרש התולדות 4",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק רביעי מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot4",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot4.jpg",
        design: "cover-design-3"
    },
    {
        id: 7,
        title: "סוד מדרש התולדות 5",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק חמישי מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot5",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot5.jpg",
        design: "cover-design-1"
    },
    {
        id: 8,
        title: "סוד מדרש התולדות 6",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק שישי מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot6",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot6.jpg",
        design: "cover-design-2"
    },
    {
        id: 9,
        title: "סוד מדרש התולדות 7",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק שביעי מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot7",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot7.jpg",
        design: "cover-design-3"
    },
    {
        id: 10,
        title: "סוד מדרש התולדות 8",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק שמיני מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/leshemshamaim-sod8",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot8.jpg",
        design: "cover-design-1"
    },
    {
        id: 11,
        title: "סוד מדרש התולדות 9",
        category: "history",
        categoryLabel: "היסטוריה ומדרש",
        description: "חלק תשיעי מתוך הסדרה המעמיקה על מדרשי חז\"ל.",
        link: "https://manitou.org.il/arcive/sfarim/sodtoladot9",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodtoladot9.jpg",
        design: "cover-design-2"
    },
    {
        id: 12,
        title: "שערי דמעה 1",
        category: "philosophy",
        categoryLabel: "פילוסופיה",
        description: "ספר מעמיק מאת הרב מניטו.",
        link: "https://manitou.org.il/arcive/sfarim/sheareidima1",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/dima1.jpg",
        design: "cover-design-3"
    },
    {
        id: 13,
        title: "שערי דמעה 2",
        category: "philosophy",
        categoryLabel: "פילוסופיה",
        description: "חלק שני בסדרת שערי דמעה.",
        link: "https://manitou.org.il/arcive/sfarim/sheareidima2",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/dima2.jpg",
        design: "cover-design-1"
    },
    {
        id: 14,
        title: "שערי דמעה 3",
        category: "philosophy",
        categoryLabel: "פילוסופיה",
        description: "חלק שלישי בסדרת שערי דמעה.",
        link: "https://manitou.org.il/arcive/sfarim/sheareidima-c",
        imgUrl: "",
        design: "cover-design-2"
    },
    {
        id: 15,
        title: "סוד לשון הקודש 1",
        category: "philosophy",
        categoryLabel: "שפה וקבלה",
        description: "גילוי סודות השפה העברית.",
        link: "https://manitou.org.il/arcive/sfarim/sodleshonkodesh1",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodlashon1.jpg",
        design: "cover-design-3"
    },
    {
        id: 16,
        title: "סוד לשון הקודש 2",
        category: "philosophy",
        categoryLabel: "שפה וקבלה",
        description: "חלק שני - גילוי סודות השפה העברית.",
        link: "https://manitou.org.il/arcive/sfarim/sodleshonkodesh2",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodlashon2.jpg",
        design: "cover-design-1"
    },
    {
        id: 17,
        title: "סוד העברי 1",
        category: "history",
        categoryLabel: "זהות והיסטוריה",
        description: "משמעותה של העבריות לאורך הדורות.",
        link: "https://manitou.org.il/arcive/sfarim/sodivri1",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodivri1.jpg",
        design: "cover-design-2"
    },
    {
        id: 18,
        title: "סוד העברי 2",
        category: "history",
        categoryLabel: "זהות והיסטוריה",
        description: "חלק שני - משמעותה של העבריות.",
        link: "https://manitou.org.il/arcive/sfarim/sodivri2",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/sodivri2.jpg",
        design: "cover-design-3"
    },
    {
        id: 19,
        title: "כי מציון (FR)",
        category: "lessons",
        categoryLabel: "שיעורים (צרפתית)",
        description: "ספר בשפה הצרפתית המבוסס על משנתו של מניטו.",
        link: "https://manitou.org.il/arcive/sfarim/kimitzionfr",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/kitvayad4.jpg",
        design: "cover-design-1"
    },
    {
        id: 20,
        title: "הדיבור והכתב",
        category: "philosophy",
        categoryLabel: "פילוסופיה",
        description: "עיון ביחס שבין התורה שבעל פה לתורה שבכתב.",
        link: "https://manitou.org.il/arcive/sfarim/diburktav",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/diburktavtmuna.jpg",
        design: "cover-design-2"
    },
    {
        id: 21,
        title: "Un Hébreu d’origine juive Hommage à Manitou - עברי ממקור יהודי",
        category: "other",
        categoryLabel: "ספרות",
        description: "ספר מחווה למניטו בשפה הצרפתית והעברית.",
        link: "https://manitou.org.il/arcive/sfarim/kojinsky",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/kojinsky.JPG",
        design: "cover-design-3"
    },
    {
        id: 22,
        title: "מעיינות (FR)",
        category: "lessons",
        categoryLabel: "שיעורים (צרפתית)",
        description: "שיעורים על פרשת השבוע בצרפתית.",
        link: "https://manitou.org.il/arcive/sfarim/mayanot-1",
        imgUrl: "https://manitou.org.il/joomlatools-files/docman-images/kitvayad4.jpg",
        design: "cover-design-1"
    },
    {
        id: 23,
        title: "מניטו על המועדים",
        category: "lessons",
        categoryLabel: "שיעורים",
        description: "משנתו של הרב מניטו על חגי ומועדי ישראל.",
        link: "https://manitou.org.il/arcive/sfarim/moaadim-sefer",
        imgUrl: "",
        design: "cover-design-2"
    },
    {
        id: 24,
        title: "קול המועד",
        category: "lessons",
        categoryLabel: "שיעורים",
        description: "שיחות על המועדים.",
        link: "https://manitou.org.il/arcive/sfarim/kolhamoed",
        imgUrl: "",
        design: "cover-design-3"
    }
];

function initApp() {
    const booksGrid = document.getElementById('booksGrid');
    const searchInput = document.getElementById('searchInput');
    const tabs = document.querySelectorAll('.tab');
    const modal = document.getElementById('bookModal');
    const closeModal = document.getElementById('closeModal');
    const modalBody = document.getElementById('modalBody');

    // Render Books
    function renderBooks(booksToRender) {
        booksGrid.innerHTML = '';
        
        if (booksToRender.length === 0) {
            booksGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <h3>לא נמצאו ספרים תואמים לחיפוש</h3>
                </div>
            `;
            return;
        }

        booksToRender.forEach((book, index) => {
            const delay = index * 0.05;
            const bookEl = document.createElement('div');
            bookEl.className = 'book-card';
            bookEl.style.animation = `fadeInUp 0.6s ease ${delay}s backwards`;
            
            // Generate inline style for book cover if imgUrl exists
            const bgStyle = book.imgUrl ? `style="background-image: url('${book.imgUrl}'); background-size: cover; background-position: center;"` : "";
            
            // Only show title overlay if there is no image
            const overlayContent = book.imgUrl ? '' : `
                <div class="book-title-overlay">
                    <h3>${book.title}</h3>
                    <div class="gold-line"></div>
                    <p>מכון מניטו</p>
                </div>
            `;

            bookEl.innerHTML = `
                <div class="book-cover ${book.design}" ${bgStyle}>
                    <div class="book-spine-effect"></div>
                    ${overlayContent}
                    <button class="read-btn">פתח ארכיון</button>
                </div>
                <div class="book-info">
                    <span class="book-category">${book.categoryLabel}</span>
                    <h4 class="book-name">${book.title}</h4>
                    <p class="book-desc">${book.description}</p>
                </div>
            `;

            bookEl.addEventListener('click', () => openModal(book));
            booksGrid.appendChild(bookEl);
        });
    }

    // Open Modal
    function openModal(book) {
        const bgStyle = book.imgUrl ? `style="background-image: url('${book.imgUrl}'); background-size: cover; background-position: center;"` : "";
        const overlayContent = book.imgUrl ? '' : `
            <div class="book-title-overlay" style="top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%;">
                <h3 style="font-size: 2.5rem;">${book.title}</h3>
                <div class="gold-line"></div>
            </div>
        `;

        modalBody.innerHTML = `
            <div class="modal-cover ${book.design}" ${bgStyle}>
                <div class="book-spine-effect"></div>
                ${overlayContent}
            </div>
            <div class="modal-info">
                <div class="modal-category">${book.categoryLabel}</div>
                <h2 class="modal-title">${book.title}</h2>
                <p class="modal-desc">${book.description}</p>
                
                <div style="margin-bottom: 2rem;">
                    <h4 style="color: var(--text-main); margin-bottom: 0.5rem; font-family: var(--font-sans);">פרטים נוספים</h4>
                    <ul style="color: var(--text-muted); list-style-position: inside; font-size: 0.95rem;">
                        <li>מקור: ארכיון מכון מניטו</li>
                        <li>גישה: מקוונת למורשים</li>
                    </ul>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-primary" id="openReaderBtn">קרא באתר המקומי (מצב קריאה)</button>
                    <a href="${book.link}" target="_blank" class="btn btn-secondary" style="text-decoration: none; display: inline-block;">המשך לספר באתר המקורי</a>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        // Add event listener for the new Read Locally button
        setTimeout(() => {
            const openReaderBtn = document.getElementById('openReaderBtn');
            if (openReaderBtn) {
                openReaderBtn.addEventListener('click', () => {
                    modal.classList.remove('active');
                    openReader(book);
                });
            }
        }, 100);
    }

    // Close Modal
    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Reader Mode Logic
    const readerMode = document.getElementById('readerMode');
    const backToLibrary = document.getElementById('backToLibrary');
    const readerBookTitle = document.getElementById('readerBookTitle');
    const readerChapterTitle = document.getElementById('readerChapterTitle');
    const chaptersList = document.getElementById('chaptersList');
    const textContent = document.getElementById('textContent');
    const toggleThemeBtn = document.getElementById('toggleTheme');
    const librarySection = document.getElementById('librarySection');

    async function openReader(book, targetChapterId = null) {
        // Show Reader
        readerMode.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        readerBookTitle.textContent = book.title;
        chaptersList.innerHTML = '<li style="text-align:center; padding: 1rem;">טוען נתונים...</li>';
        textContent.innerHTML = '<p style="text-align:center;">שואב את התוכן, אנא המתן...</p>';
        
        try {
            const response = await fetch(`data/book_${book.id}.json`);
            if (!response.ok) {
                throw new Error("File not found");
            }
            const chapters = await response.json();
            
            if (chapters && chapters.length > 0) {
                renderChaptersList(chapters);
                let targetChap = chapters[0];
                if (targetChapterId) {
                    const found = chapters.find(c => c.id === targetChapterId);
                    if (found) targetChap = found;
                }
                // also highlight it in sidebar
                document.querySelectorAll('.chapters-list li').forEach(el => {
                    el.classList.remove('active');
                    if(el.textContent === targetChap.title) el.classList.add('active');
                });
                loadChapter(targetChap);
            } else {
                chaptersList.innerHTML = '';
                textContent.innerHTML = '<p style="text-align:center;">לא נמצאו פרקים לספר זה.</p>';
            }
        } catch (e) {
            chaptersList.innerHTML = '';
            textContent.innerHTML = `
                <div style="text-align:center; margin-top:2rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5; color: var(--accent);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <h3>הספר עדיין לא נסרק למערכת</h3>
                    <p style="color: var(--text-muted); margin-top: 1rem;">תהליך השאיבה משרתי מניטו פועל עכשיו ברקע כדי להביא את כל מאות הפרקים. זה יכול לקחת מספר דקות.</p>
                    <p style="color: var(--text-muted);">נסה שוב מאוחר יותר.</p>
                </div>
            `;
            const downloadBtn = document.getElementById('downloadPdfBtn');
            if(downloadBtn) downloadBtn.style.display = 'none';
        }
    }

    function renderChaptersList(chapters) {
        chaptersList.innerHTML = '';
        chapters.forEach((chapter, index) => {
            const li = document.createElement('li');
            li.textContent = chapter.title;
            if (index === 0) li.classList.add('active');
            
            li.addEventListener('click', () => {
                document.querySelectorAll('.chapters-list li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                loadChapter(chapter);
            });
            
            chaptersList.appendChild(li);
        });
    }

    function loadChapter(chapter) {
        readerChapterTitle.textContent = chapter.title;
        
        // Clean up the text content (remove Joomla Komento comments, broken logos, etc.)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = chapter.text;
        
        // Remove known comment elements and broken plugins
        const junkSelectors = [
            '[id^="komento"]',
            '[class*="komento"]',
            '.buttonheading', // Joomla print/email buttons
            '.item-page-nav', // Next/prev links
            '.icons',
            'script',
            'style',
            '#comments',
            '.comments-area',
            '#kmt-form',
            '.kmt-wrap'
        ];
        
        junkSelectors.forEach(sel => {
            const els = tempDiv.querySelectorAll(sel);
            els.forEach(el => el.remove());
        });
        
        // Add extra safe selectors for Joomla comments and components
        const extraJunkSelectors = [
            '#section-kmt', 
            '.kmt-list',
            '.kmt-control-user',
            '.kmt-form-content',
            '.kmt-wrap',
            '.komento'
        ];
        extraJunkSelectors.forEach(sel => {
            const els = tempDiv.querySelectorAll(sel);
            els.forEach(el => el.remove());
        });
        
        // Remove empty images or broken logos
        const allImages = tempDiv.querySelectorAll('img');
        allImages.forEach(img => {
            const src = img.getAttribute('src');
            if (!src || src.includes('blank') || src.includes('komento') || src.trim() === '') {
                img.remove();
            }
        });

        textContent.innerHTML = tempDiv.innerHTML;
        textContent.parentElement.scrollTop = 0;
        
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (downloadBtn) {
            if (chapter.local_pdf) {
                downloadBtn.style.display = 'inline-flex';
                downloadBtn.onclick = () => window.open(chapter.local_pdf, '_blank');
            } else if (chapter.pdf_url) {
                downloadBtn.style.display = 'inline-flex';
                downloadBtn.onclick = () => window.open(chapter.pdf_url, '_blank');
            } else {
                downloadBtn.style.display = 'none';
            }
        }
    }

    // Close Reader Mode
    backToLibrary.addEventListener('click', () => {
        readerMode.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Toggle Light/Dark Theme in Reader
    toggleThemeBtn.addEventListener('click', () => {
        if (document.body.getAttribute('data-theme') === 'dark') {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
        updateThemeBtnText();
    });

    // Filtering
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const filter = tab.dataset.filter;
            const searchTerm = searchInput.value.toLowerCase();
            filterBooks(filter, searchTerm);
        });
    });

    // Searching
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const activeTab = document.querySelector('.tab.active').dataset.filter;
        filterBooks(activeTab, searchTerm);
    });

    function filterBooks(filter, searchTerm) {
        let filteredBooks = books;

        if (filter !== 'all') {
            filteredBooks = filteredBooks.filter(book => book.category === filter);
        }

        if (searchTerm) {
            filteredBooks = filteredBooks.filter(book => 
                book.title.toLowerCase().includes(searchTerm) || 
                book.description.toLowerCase().includes(searchTerm)
            );
        }

        renderBooks(filteredBooks);
    }

    // Add CSS Keyframes for animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    // Initial render
    renderBooks(books);

    // --- Deep Search Logic ---
    const openDeepSearchBtn = document.getElementById('openDeepSearchBtn');
    const deepSearchModal = document.getElementById('deepSearchModal');
    const closeDeepSearch = document.getElementById('closeDeepSearch');
    const executeDeepSearch = document.getElementById('executeDeepSearch');
    const deepSearchInput = document.getElementById('deepSearchInput');
    const deepSearchResults = document.getElementById('deepSearchResults');

    if(openDeepSearchBtn) {
        openDeepSearchBtn.addEventListener('click', () => {
            deepSearchModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            setTimeout(() => deepSearchInput.focus(), 100);
        });
    }

    if(closeDeepSearch) {
        closeDeepSearch.addEventListener('click', () => {
            deepSearchModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    }

    if (deepSearchInput) {
        deepSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeDeepSearch.click();
        });
    }

    if(executeDeepSearch) {
        executeDeepSearch.addEventListener('click', async () => {
            const query = deepSearchInput.value.trim().toLowerCase();
            if (!query) return;
            
            deepSearchResults.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>סורק את כל הספרים במאגר...</p></div>';
            
            let allResults = [];
            
            // Iterate all books to fetch their data
            for (const b of books) {
                try {
                    const res = await fetch(`data/book_${b.id}.json`);
                    if (res.ok) {
                        const chapters = await res.json();
                        chapters.forEach(chap => {
                            if (!chap.text) return;
                            
                            // Strip HTML tags for clean searching
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = chap.text;
                            const plainText = tempDiv.textContent || tempDiv.innerText || "";
                            
                            const lowerText = plainText.toLowerCase();
                            let index = lowerText.indexOf(query);
                            
                            // Find all occurrences in this chapter
                            let occurrences = 0;
                            while (index !== -1 && occurrences < 3) { // limit to 3 snippets per chapter
                                const start = Math.max(0, index - 60);
                                const end = Math.min(plainText.length, index + query.length + 60);
                                
                                let snippet = plainText.substring(start, end);
                                if (start > 0) snippet = '...' + snippet;
                                if (end < plainText.length) snippet = snippet + '...';
                                
                                // Highlight the query using Regex for case-insensitive exact replacement
                                const regex = new RegExp(`(${query})`, 'gi');
                                snippet = snippet.replace(regex, '<mark style="background: var(--accent); color: var(--primary-bg); padding: 0 4px; border-radius: 3px;">$1</mark>');
                                
                                allResults.push({
                                    book: b,
                                    chapter: chap,
                                    snippet: snippet
                                });
                                
                                index = lowerText.indexOf(query, index + query.length);
                                occurrences++;
                            }
                        });
                    }
                } catch (e) {
                    // Skip if not downloaded yet
                }
            }
            
            // Render results
            if (allResults.length === 0) {
                deepSearchResults.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); margin-top: 3rem;">
                        <h3>לא נמצאו תוצאות עבור "${query}"</h3>
                        <p>נסה לחפש מילה אחרת, או ודא שהספרים הרלוונטיים כבר נסרקו למערכת.</p>
                    </div>
                `;
                return;
            }
            
            let html = `<h3 style="margin-bottom: 1.5rem; color: var(--text-main);">נמצאו ${allResults.length} תוצאות:</h3><div style="display: flex; flex-direction: column; gap: 1rem;">`;
            
            allResults.forEach((res, i) => {
                html += `
                    <div class="search-result-card" data-index="${i}" style="background: var(--primary-bg); border: 1px solid var(--border); padding: 1.5rem; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                        <div style="font-size: 0.85rem; color: var(--accent); margin-bottom: 0.5rem; font-weight: bold;">
                            ${res.book.title} > ${res.chapter.title}
                        </div>
                        <p style="color: var(--text-main); font-size: 1.05rem; line-height: 1.6;">
                            ${res.snippet}
                        </p>
                    </div>
                `;
            });
            html += '</div>';
            
            deepSearchResults.innerHTML = html;
            
            // Add click listeners to cards
            document.querySelectorAll('.search-result-card').forEach(card => {
                card.addEventListener('mouseenter', () => card.style.borderColor = 'var(--accent)');
                card.addEventListener('mouseleave', () => card.style.borderColor = 'var(--border)');
                card.addEventListener('click', () => {
                    const res = allResults[card.dataset.index];
                    deepSearchModal.classList.remove('active');
                    openReader(res.book, res.chapter.id);
                    
                    // After a short delay, highlight the word in the reader!
                    setTimeout(() => {
                        const contentArea = document.getElementById('textContent');
                        if (contentArea) {
                            // Simple highlighting in the actual HTML content
                            // This is complex due to HTML tags, but a basic replace works for demonstration
                            // Since we have HTML, we must be careful not to break tags.
                            // We can use a TreeWalker or just basic innerHTML replacement with caution.
                            const regex = new RegExp(`(?![^<]+>)(${query})`, 'gi');
                            contentArea.innerHTML = contentArea.innerHTML.replace(regex, '<mark style="background: var(--accent); color: var(--primary-bg);">$1</mark>');
                            
                            // Scroll to first mark
                            const firstMark = contentArea.querySelector('mark');
                            if (firstMark) {
                                firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }, 500);
                });
            });
        });
    }

    
    // Nav Theme Toggle
    const navThemeToggle = document.getElementById('navThemeToggle');
    const navThemeText = document.getElementById('navThemeText');
    
    function updateThemeBtnText() {
        const text = document.body.getAttribute('data-theme') === 'dark' ? 'מצב יום' : 'מצב לילה';
        if (document.getElementById('navThemeText')) document.getElementById('navThemeText').textContent = text;
        if (document.getElementById('readerThemeText')) document.getElementById('readerThemeText').textContent = text;
    }
    
    if (navThemeToggle) {
        // Check for saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        }
        
        navThemeToggle.addEventListener('click', () => {
            if (document.body.getAttribute('data-theme') === 'dark') {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            updateThemeBtnText();
        });
        updateThemeBtnText(); // Init
    }

    // Nav Home (Scroll to top)
    const navHomeBtn = document.getElementById('navHomeBtn');
    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
