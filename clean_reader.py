import sys
import re

js_path = '/Users/ormaman/New_Manitou/script.js'

with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

cleanup_logic = """
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
        
        // Aggressive removal based on Hebrew text for the comment form
        // We find elements that contain "מבוצע באמצעות Komento" or "הוספת תגובה" and remove their container
        const allDivs = Array.from(tempDiv.querySelectorAll('div'));
        allDivs.forEach(div => {
            if (div && div.parentNode) {
                const text = div.textContent || '';
                if (text.includes('מבוצע באמצעות Komento') || 
                    text.includes('הוספת תגובה') || 
                    text.includes('השאירו את תגובותיכם') ||
                    text.includes('טעינת Captcha מחדש')) {
                    div.remove();
                }
            }
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
"""

old_logic = """
    function loadChapter(chapter) {
        readerChapterTitle.textContent = chapter.title;
        textContent.innerHTML = chapter.text;
        textContent.parentElement.scrollTop = 0;
"""

js = js.replace(old_logic.strip(), cleanup_logic.strip())

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)

print("Injected cleanup logic into loadChapter.")
