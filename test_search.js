const fs = require('fs');
const code = fs.readFileSync('script.js', 'utf8');

const mockDOM = `
const document = {
    getElementById: (id) => {
        if(id === 'booksGrid') return { appendChild: ()=>{} };
        return { 
            addEventListener: () => {}, 
            style: {}, innerHTML: '', classList: { add: ()=>{}, remove: ()=>{} }, 
            dataset: {}, contains: ()=>false, focus: ()=>{} 
        };
    },
    createElement: (tag) => {
        if(tag === 'style') return { innerHTML: '' };
        return { 
            style: {}, classList: { add: ()=>{}, remove: ()=>{} }, 
            addEventListener: () => {}, appendChild: () => {}, 
            dataset: {}, setAttribute: ()=>{}, innerHTML: '' 
        };
    },
    querySelectorAll: (q) => [],
    querySelector: (q) => {
        if(q === '.tab.active') return { dataset: { filter: 'all' } };
        return null;
    },
    addEventListener: () => {},
    readyState: 'complete',
    head: { appendChild: ()=>{} }
};
const window = { 
    localStorage: { getItem: ()=>null, setItem: ()=>{} }, 
    getSelection: ()=>({ removeAllRanges: ()=>{} }), 
    scrollY: 0,
    toggleFavorite: ()=>{}
};
const localStorage = window.localStorage;
`;

fs.writeFileSync('temp.js', mockDOM + code + '\ninitApp();\nconsole.log("Success");');
