
// Start-knapp: åpner det bygde spillet i en ny fane
document.getElementById("start-button").addEventListener("click", function() {
    // Åpner den web-buildede versjonen (antatt plassert i build/web/)
    window.open("build/web/index.html", "_blank");
});

// Enkel og lett å lese carousel: bruk viewport scrollBy
// Enkel karusellkontroll: bruk scrollIntoView for å flytte til neste/forrige slide
(function(){
    const viewport = document.querySelector('.carousel__viewport');
    if (!viewport) return; // hvis ingen karusell på siden, gjør ingenting

    const prev = document.querySelector('.carousel__btn--prev');
    const next = document.querySelector('.carousel__btn--next');
    const slides = Array.from(document.querySelectorAll('.carousel__slide'));
    let i = 0; // indeks for gjeldende slide

    // Vis slide med sikkerhetsklammer mellom 0 og siste indeks
    function show(idx){
        i = Math.max(0, Math.min(slides.length-1, idx));
        slides[i].scrollIntoView({behavior:'smooth', inline:'center'});
    }

    // Koble knappene (hvis de finnes)
    if (prev) prev.addEventListener('click', ()=> show(i-1));
    if (next) next.addEventListener('click', ()=> show(i+1));
})();

// Theme toggle: veksle mellom lys/mørk og lagre preferanse i localStorage
(function(){
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return; // ingen toggle på siden

    const root = document.documentElement;
    let stored = null;
    try { stored = localStorage.getItem('goldies-theme'); } catch(e){ /* localStorage kan feile i noen miljøer */ }

    // Hvis bruker tidligere valgte mørk modus, bruk det
    if (stored === 'dark') root.classList.add('dark');

    toggle.addEventListener('click', ()=>{
        const dark = root.classList.toggle('dark');
        try { localStorage.setItem('goldies-theme', dark ? 'dark' : 'light'); } catch(e){ /* ignore */ }
    });
})();
