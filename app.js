

const SCREEN_WIDTH = 1000; // Bredde på spill-viewport
const SCREEN_HEIGHT = 1000; // Høyde på spill-viewport
const TILE_SIZE = 50; // Størrelse på hver block 

// Hent canvas og 2D-kontekst fra DOM
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Referanser til UI-elementer (knapper osv.) som finnes i HTML
const startBtn = document.getElementById("startBtn");
const themeToggle = document.getElementById("themeToggle");

// Spilltilstand-variabler
let state = "menu"; // Kan være meny spiller, vunnet osv
let gameOver = false; // Om spilleren har tapt
let score = 0; // Poeng i nåværende nivå
let totalScore = 0; // Akkumulert poengsum over nivåene
let currentLevel = 0; // Indeks på aktivt nivå
let levels = []; // Lister med nivådata fra levels.json
let world = null; // Instance av World-klassen for aktivt nivå
let player = null; // Instance av Player-klassen

// Grupper/arrayer som inneholder spillobjekter (fiender, lava, mynter osv.)
const blobGroup = []; // Vanlige fiender
const lavaGroup = []; // Lava-tiles som dreper
const coinGroup = []; // Mynter å samle
const exitGroup = []; // Portaler/kister som avslutter nivået
const finalTileGroup = []; // Spesielle tiles som blir synlige etter visse betingelser

// Objekt som sporer hvilke taster som er trykket
const keys = Object.create(null);

// Forhåndslastede bilder/sprites i et objekt for enkel tilgang
const images = {
  bg: loadImage('8bit-pixel-graphic-blue-sky-background-with-clouds-vector.jpg'),
  player: loadImage('Goldie.png'),
  slime: loadImage('Slime.png'),
  fast: loadImage('Fastslime.png'),
  yellow: loadImage('Superfast.png'),
  king: loadImage('Kingslime.png'),
  lava: loadImage('lava.png'),
  goldblock: loadImage('Goldblock.png'),
  coin: loadImage('Coin.png'),
  portal: loadImage('Portal.png'),
  chest: loadImage('Chest.png'),
  dirt: loadImage('DirtBlock2D.png'),
  grass: loadImage('GrassBlock2D.png'),
  stone: loadImage('Sigmastone.png'),
};

// Hjelpefunksjon for å laste bilder. Returnerer et Image-objekt.
function loadImage(src) {
  const img = new Image();
  img.src = src; // Start asynkron lasting
  return img; // Returner objektet umiddelbart (kan være ikke ferdig lastet)
}

// Viser om spiller treffen en block eller fiendene 
function rectsCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Funksjon for å tegne et bilde på canvas.
// Hvis bildet ikke er ferdig lastet, tegnes en placeholder-firkant i stedet.
function drawImage(img, x, y, w, h) {
  
  // Sjekk om bildet er ferdig lastet inn i minnet
  if (img.complete) {
    // Hvis ja: tegn selve bildet på canvas ved posisjon (x,y) med bredde w og høyde h
    ctx.drawImage(img, x, y, w, h);
  } else {
    // Hvis nei: bruk en mørk grå farge som "reserve"
    ctx.fillStyle = "#333";
    // Tegn en rektangel på samme posisjon og størrelse som bildet ville hatt
    ctx.fillRect(x, y, w, h);
  }
}


// clamp: sørger for at en verdi v alltid ligger mellom min og max
function clamp(v, min, max) {
  // Math.min(max, v) gir den minste av v og max (aldri over max)
  // Math.max(min, ...) sørger for at resultatet aldri går under min
  return Math.max(min, Math.min(max, v));
}

// randInt: returnerer et tilfeldig heltall mellom min og max (inkludert begge)
function randInt(min, max) {
  // Math.random() gir et tall mellom 0 og 1
  // Multipliser med (max - min + 1) for å få riktig intervallstørrelse
  // Math.floor(...) runder ned til nærmeste heltall
  // + min flytter intervallet opp slik at det starter på min
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


// ---------------- Classes ---------------- //
// Player-klassen håndterer spillerens posisjon, fysikk, input og tegning
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; // Startposisjon
    this.w = 35; this.h = 45; // Størrelse på spilleren
    this.velY = 0; // Vertikal hastighet
    this.jumped = false; // Om hoppeknapp er holdt
    this.inAir = true; // Om spilleren befinner seg i luften
  }
  // Rektangelrepresentasjon for kollisjonssjekk
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

update() {
  let dx = 0, dy = 0;

  // Horisontal bevegelse
  if (keys["ArrowLeft"] || keys["KeyA"]) dx -= 4;
  if (keys["ArrowRight"] || keys["KeyD"]) dx += 4;
// Hopp
if ((keys["Space"] || keys["ArrowUp"] || keys["KeyW"]) && !this.jumped && !this.inAir) {
    this.velY = -7.5;  // Moderat hopp
    this.jumped = true;
}

// Gravity
const gravity = 0.9;   // Litt sterkere enn før
const maxFall = 9;      // Maks fallhastighet
this.velY += gravity;
this.velY = Math.min(this.velY, maxFall); 



  this.inAir = true; // Antar vi er i luften

  // Kollisjon med alle tiles i verden
  for (const [, tileRect] of world.tileList) {
    // Horisontal kollisjon
    if (rectsCollide({ x: this.x + dx, y: this.y, w: this.w, h: this.h }, tileRect)) dx = 0;

    // Vertikal kollisjon
    if (rectsCollide({ x: this.x, y: this.y + dy, w: this.w, h: this.h }, tileRect)) {
      if (this.velY > 0) {
        // Land på toppen av tile
        dy = tileRect.y - (this.y + this.h);
        this.velY = 0;
        this.inAir = false;
      } else if (this.velY < 0) {
        // Stopp ved tak
        dy = tileRect.y + tileRect.h - this.y;
        this.velY = 0;
      }
    }
  }

  // Anvend forskyvninger
  this.x += dx;
  this.y += dy;

  // Begrens posisjon
  this.x = clamp(this.x, -1000, 5000);
  this.y = clamp(this.y, -1000, SCREEN_HEIGHT - this.h);
}

// Tegner spilleren med sprite
draw() {
  // Bruker drawImage til å tegne spillerens sprite på canvas
  // med posisjon (x,y) og størrelse (w,h)
  drawImage(images.player, this.x, this.y, this.w, this.h);
}

}

// Enkel fiende som patruljerer frem og tilbake
class Enemy {
  constructor(x, y, img, w = 40, h = 50, speed = 1, counterInc = 1) {
    this.x = x; this.y = y; this.w = w; this.h = h; // Posisjon og størrelse
    this.img = img; // Bilde/sprite
    this.moveDir = speed; // Beginner med en hastighet i x-retning
    this.moveCounter = 0; // Teller som brukes for å snu ved grense
    this.counterInc = counterInc; // Hvor mye counteren øker per oppdatering
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  // Enkel bevegelseslogikk: flytt mot moveDir og snu når moveCounter overstiger terskel
  update() {
    this.x += this.moveDir;
    this.moveCounter += this.counterInc;
    if (Math.abs(this.moveCounter) > 50) {
      this.moveDir *= -1; // Snur retning
      this.moveCounter *= -1; // Resett/flip counter
    }
  }
  draw() { drawImage(this.img, this.x, this.y, this.w, this.h); }
}

// Mer avansert fiende (boss) med dash/jump/patterns, helse og enraged-mode
class KingEnemy {
  constructor(x, y, worldRef) {
    this.x = x; this.y = y; this.w = 85; this.h = 85; // Størrelse typisk større som boss
    this.world = worldRef; // Referanse til verden for kollisjoner

    // Bevegelses- og fysikkparametre
    this.moveDirection = 1; this.speed = 3; this.gravity = 2.5; this.velY = 0;
    this.moveCounter = 0; this.maxMoveCounter = randInt(150, 250);

    // Enkelt mønster for handlinger (dash, dash, jump)
    this.pattern = ['dash', 'dash', 'jump']; this.patternIndex = 0;
    this.jumpTimer = 0; this.jumpInterval = randInt(50, 100);
    this.lastJumpTime = 0; this.jumpCooldown = 100;

    // Dash-egenskaper
    this.isDashing = false; this.dashSpeed = 14; this.dashDuration = 18; this.dashTimer = 0; this.dashCooldownTimer = 0;

    // Helse og visuelle effekter
    this.health = 4; this.maxHealth = 4; this.alive = true; this.flashTimer = 0; this.enraged = false; this.tintColor = null;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  // Hovedoppdatering for bossen — styrer alle sub-funksjoner
  update() {
    if (!this.alive) return; // Hvis bossen er død gjør ingenting

    // Countdown på dash cooldown
    this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - 1);

    // Hvis helsen er lav nok, gå inn i enraged-mode
    if (!this.enraged && this.health <= 2) this.enterEnragedMode();

    // Bevegelse og handlinger
    this.horizontalMovement();
    this.processActionPattern();
    this.applyGravity();
    this.updateFlash();
  }

  // Horisontal bevegelse og kollisjon
  horizontalMovement() {
    const speed = this.isDashing ? this.dashSpeed : this.speed; // Bruk dashspeed når dashing
    this.x += this.moveDirection * speed; // Flytt i valgt retning
    this.horizontalCollision(); // Håndter kollisjoner mot tiles

    if (this.isDashing) {
      // Hvis vi dashes, reduser dash-timer og stopp når slutt
      this.dashTimer -= 1; if (this.dashTimer <= 0) this.isDashing = false;
    } else {
      // Ellers øk moveCounter og snu om vi har nådd maks
      this.moveCounter += 1;
      if (this.moveCounter >= this.maxMoveCounter) {
        this.moveDirection *= -1; this.moveCounter = 0; this.maxMoveCounter = randInt(150, 250);
      }
    }
  }

  // Bestem handling i henhold til mønster (dash/jump)
  processActionPattern() {
    this.jumpTimer += 1;
    if (this.jumpTimer < this.jumpInterval || this.velY !== 0) return; // Vent til intervallet er nådd og vi står på bakken

    const action = this.pattern[this.patternIndex];
    this.patternIndex = (this.patternIndex + 1) % this.pattern.length; // Syklisk indeks
    this.jumpTimer = 0; // Reset timer
    this.jumpInterval = randInt(this.enraged ? 20 : 50, this.enraged ? 50 : 100); // Kortere intervall hvis enraged

    const now = performance.now();
    const cooldownMs = (this.jumpCooldown * 100) / 60; // Konvertering til ms-lignende verdi

    if (action === 'jump') {
      // Hopp hvis cooldown tillater
      if (now - this.lastJumpTime >= cooldownMs) {
        this.velY = randInt(-40, -30);
        this.lastJumpTime = now;
      }
    } else if (action === 'dash' && this.dashCooldownTimer === 0 && this.canDash()) {
      // Start dash hvis mulig
      this.startDash();
      this.dashCooldownTimer = this.enraged ? 30 : 60; // Kortere cooldown ved enraged
    }
  }

  // Applisere tyngdekraft og håndtere vertikal kollisjon
  applyGravity() {
    this.velY = Math.min(this.velY + this.gravity, 8); // Øk hastighet med tyngdekraft, begrens
    this.y += this.velY; // Flytt i y-retning

    for (const [, tile] of this.world.tileList) {
      if (rectsCollide(this.rect, tile)) {
        if (this.velY > 0) {
          // Hvis vi faller og treffer en tile, sett y slik at vi står på toppen
          this.y = tile.y - this.h; this.velY = 0;
        }
        return; // Returner tidlig hvis kollisjon fant sted
      }
    }
    // Sikre at bossen ikke faller gjennom bunnen av skjermen
    if (this.y + this.h > SCREEN_HEIGHT) {
      this.y = SCREEN_HEIGHT - this.h; this.velY = 0;
    }
  }

  // Håndter horisontal kollisjon mot tiles
  horizontalCollision() {
    for (const [, tile] of this.world.tileList) {
      if (rectsCollide(this.rect, tile)) {
        if (this.moveDirection > 0) this.x = tile.x - this.w; // Plasser til venstre for tile hvis vi kom fra venstre
        else this.x = tile.x + tile.w; // Plasser til høyre for tile hvis vi kom fra høyre
        this.isDashing = false; this.moveDirection *= -1; this.moveCounter = 0; // Stopp dash og snu
        return;
      }
    }
  }

  // Forutse om dash vil treffe en tile (brukes for å unngå at bossen dasher inn i vegg)
  canDash() {
    const future = {
      x: this.x + this.moveDirection * Math.floor(this.dashSpeed * this.dashDuration / 2),
      y: this.y, w: this.w, h: this.h
    };
    for (const [, tile] of this.world.tileList) {
      if (rectsCollide(future, tile)) return false; // Hvis fremtidsposisjon kolliderer, kan vi ikke dash
    }
    return true; // Annars er det trygt
  }

  // Start dash med tilfeldige dash-verdier for variasjon
  startDash() {
    this.isDashing = true;
    this.dashSpeed = randInt(12, 18);
    this.dashDuration = randInt(10, 20);
    this.dashTimer = this.dashDuration;
  }

  // Ta skade — reduser helse og sett flashTimer
  takeDamage() {
    this.health -= 1; this.flashTimer = 20;
    if (this.health <= 0) this.alive = false; // Dø hvis helse = 0
  }

  // Oppdater visuell flash-effekt for skadet sinnstilstand/enrage-blink
  updateFlash() {
    if (this.flashTimer > 0) {
      this.flashTimer -= 1; 
      this.tintColor = { r: 255, g: 0, b: 0 }; // Rød tint når skadet
    } else {
      this.tintColor = null;
    }
    // Hvis enraged, gi en periodisk fargeendring når ikke flashTimer er aktiv
    if (this.enraged && this.flashTimer === 0) {
      if ((performance.now() % 400) < 200) this.tintColor = { r: 150, g: 30, b: 30 };
    }
  }

  // Endre til enraged-mode (mer aggressiv)
  enterEnragedMode() {
    this.enraged = true; this.speed = 3; this.dashSpeed = 16; this.dashDuration = 15;
    this.maxMoveCounter = randInt(60, 120);
  }

  // Tegn en liten helsebar over bossen
  drawHealthBar() {
    if (!this.alive) return;
    const barW = 100, barH = 10;
    const fill = Math.floor((this.health / this.maxHealth) * barW);
    ctx.fillStyle = "red"; ctx.fillRect(this.x, this.y - 20, barW, barH);
    ctx.fillStyle = "lime"; ctx.fillRect(this.x, this.y - 20, fill, barH);
  }

  // Tegn boss-spriten og eventuell tint
  draw() {
    drawImage(images.king, this.x, this.y, this.w, this.h);
    if (this.tintColor) {
      ctx.fillStyle = `rgba(${this.tintColor.r}, ${this.tintColor.g}, ${this.tintColor.b}, 0.25)`;
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  }
}

// Lava er et dødelig objekt. Tegnes og kollisjonssjekkes.
class Lava {
  constructor(x, y) { this.x = x; this.y = y; this.w = TILE_SIZE; this.h = TILE_SIZE / 2; }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  draw() { drawImage(images.lava, this.x, this.y, this.w, this.h); }
}

// FinalTile er en tile som først er usynlig og deretter fades inn etter en trigger
class FinalTile {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = TILE_SIZE; this.h = TILE_SIZE / 2;
    this.visible = false; // Om den er fullt synlig
    this.alpha = 0; // Alpha-verdi for fading
    this.fadeDuration = 2000; // Tid i ms for å fullføre fade
    this.fadeStartTime = null; // Når fade startet
    this.shouldAppear = false; // Om den skal begynne å dukke opp
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  // Trigger for å starte fremvisningen/fade-in
  triggerAppearance() {
    if (!this.shouldAppear) { this.shouldAppear = true; this.fadeStartTime = performance.now(); }
  }

  update() {
    if (this.shouldAppear && !this.visible) {
      const elapsed = performance.now() - this.fadeStartTime;
      const progress = Math.min(elapsed / this.fadeDuration, 1.0);
      this.alpha = Math.floor(progress * 255);
      if (this.alpha >= 255) this.visible = true; // Når alpha er fullstendig blir den synlig
    }
  }

  draw() {
    if (!this.shouldAppear) return; // Hvis ikke trigget, tegn ingenting
    ctx.globalAlpha = this.alpha / 255; // Sett global alpha for fading
    drawImage(images.goldblock, this.x, this.y, this.w, this.h);
    ctx.globalAlpha = 1.0; // Tilbakestill alpha etter tegning
  }
}

// Coin: samleobjekt
class Coin {
  constructor(x, y) {
    this.w = TILE_SIZE - 5; this.h = TILE_SIZE - 5;
    // Plasser mynten slik at den er sentrert i tile
    this.x = x + TILE_SIZE / 2 - this.w / 2;
    this.y = y + TILE_SIZE / 2 - this.h / 2;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  draw() { drawImage(images.coin, this.x, this.y, this.w, this.h); }
}

// Exit (portal eller kiste) som avslutter nivå
class Exit {
  constructor(x, y, img) { this.x = x; this.y = y; this.w = TILE_SIZE + 5; this.h = TILE_SIZE * 2; this.img = img; }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  draw() { drawImage(this.img, this.x, this.y, this.w, this.h); }
}

// World bygger tile-listen fra et 2D-array av tall
class World {
  constructor(data) {
    this.tileList = []; // Liste med [img, rect] elementer som representerer collidable tiles
    this.build(data); // Bygg verden direkte
  }
  build(data) {
    const dirt = images.dirt, grass = images.grass, stone = images.stone;
    let rowCount = 0;
    for (const row of data) {
      let colCount = 0;
      for (const tile of row) {
        const x = colCount * TILE_SIZE; const y = rowCount * TILE_SIZE;
        // Hvert tall representerer en tile-type eller objekt
        if (tile === 1) this.addTile(dirt, x, y); // Dirt tile
        if (tile === 2) this.addTile(grass, x, y); // Grass tile
        if (tile === 8) this.addTile(stone, x, y); // Stone tile
        if (tile === 3) blobGroup.push(new Enemy(x, y, images.slime)); // Vanlig slangefiende
        if (tile === 4) lavaGroup.push(new Lava(x, y + TILE_SIZE / 2)); // Lava-objekt (halv tile)
        if (tile === 5) coinGroup.push(new Coin(x, y)); // Mynt
        if (tile === 6) blobGroup.push(new Enemy(x, y, images.fast, 50, 50, 6, 3)); // Rask fiende
        if (tile === 11) blobGroup.push(new Enemy(x, y, images.yellow, 40, 50, 6, 4)); // Super-rask
        if (tile === 7) blobGroup.push(new KingEnemy(x, y, this)); // Boss
        if (tile === 9) exitGroup.push(new Exit(x, y, images.portal)); // Portal exit
        if (tile === 10) exitGroup.push(new Exit(x, y, images.chest)); // Chest exit
        if (tile === 12) finalTileGroup.push(new FinalTile(x, y)); // Final tile som dukker opp senere
        colCount += 1;
      }
      rowCount += 1;
    }
  }
  // Legg til en collidable tile i tileList
  addTile(img, x, y) { this.tileList.push([img, { x, y, w: TILE_SIZE, h: TILE_SIZE }]); }
  // Tegn alle tiles
  draw() { for (const [img, rect] of this.tileList) drawImage(img, rect.x, rect.y, rect.w, rect.h); }
}

// ---------------- Input ---------------- //
// Lytt etter tastetrykk/opp-release og oppdater keys-objektet
window.addEventListener("keydown", e => { keys[e.code] = true; });
window.addEventListener("keyup", e => { keys[e.code] = false; });

// ---------------- UI helpers ---------------- //
// Tegn sentrert tekst med ønsket font og farge
function drawCenteredText(text, cx, cy, font = "60px Arial", color = "white") {
  ctx.font = font; ctx.fillStyle = color;
  const m = ctx.measureText(text);
  ctx.fillText(text, cx - m.width / 2, cy);
}

// Tegn en knapp (runde hjørner) — brukes i meny og gameover screens
function drawButton(rect, color, label) {
  ctx.fillStyle = color;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 30);
  drawCenteredText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 10, "30px Arial", "black");
}

// Tegn et avrundet rektangel -- enklere helper
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

// Hjelpefunksjon for å sjekke om et punkt er inne i et rektangel (brukes for museklikk på UI)
function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

// ---------------- Menu and screens ---------------- //
function renderMenu() {
  // Tegn bakgrunn og tittel
  ctx.drawImage(images.bg, -125, -45, SCREEN_WIDTH + 250, SCREEN_HEIGHT + 90);
  drawCenteredText("GOLDIES ADVENTURE", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 200, "80px Arial", "yellow");

  // Definer knapp-rektangler og tegn dem
  const startRect = { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 - 40, w: 400, h: 80 };
  const quitRect =  { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 + 60, w: 400, h: 80 };

  drawButton(startRect, "rgb(0,255,0)", "START GAME");
  drawButton(quitRect, "rgb(255,0,0)", "RELOAD");
}

function renderLoading(levelNum) {
  // Enkel loading-skjerm som viser hvilket nivå som lastes
  ctx.fillStyle = "black"; ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawCenteredText(`Loading Level ${levelNum + 1}...`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, "60px Arial", "white");
}

function renderGameOver() {
  // Halvt transparent overlay med "GAME OVER" og knapper
  ctx.globalAlpha = 0.78; ctx.fillStyle = "black";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); ctx.globalAlpha = 1;

  drawCenteredText("GAME OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 120, "80px Arial", "red");

  const restartRect = { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 - 20, w: 400, h: 60 };
  const menuRect =    { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 + 80, w: 400, h: 60 };

  drawButton(restartRect, "rgb(0,200,0)", "RESTART (R)");
  drawButton(menuRect, "rgb(200,0,0)", "MAIN MENU (M)");
}

function renderWin() {
  // Skjerm som vises når alle nivåer er ferdig
  ctx.fillStyle = "black"; ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawCenteredText("YOU WIN!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 100, "80px Arial", "yellow");
  drawCenteredText(`Total Score: ${totalScore}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10, "30px Arial", "white");

  const menuRect = { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 + 100, w: 400, h: 60 };
  drawButton(menuRect, "rgb(0,200,0)", "MAIN MENU");
}

// ---------------- Game flow ---------------- //
function resetLevel(levelIndex) {
  // Tøm arrayer for å fjerne gamle objekter
  blobGroup.length = 0; lavaGroup.length = 0; coinGroup.length = 0; exitGroup.length = 0; finalTileGroup.length = 0;
  // Lag en ny World basert på nivådata
  world = new World(levels[levelIndex]);
  // Opprett spiller i en rimelig startposisjon
  player = new Player(50, SCREEN_HEIGHT - 300);
  // Nullstill score for nivået
  score = 0;
}

// Sjekk om alle KingEnemy-objekter er døde/ikke-levende
function allKingsDefeated() {
  return blobGroup.every(b => !(b instanceof KingEnemy) || !b.alive);
}

function startGame() {
  // Bytt state til loading og vis loading-screen før vi starter nivået
  state = "loading";
  renderLoading(currentLevel);
  setTimeout(() => {
    resetLevel(currentLevel); // Initialiser nivået
    state = "playing"; // Sett til spillmodus
  }, 600); // Vent litt for effekt
}

// ---------------- Input/UI ---------------- //
// Knytt start-knapp til startGame hvis den finnes i DOM
startBtn?.addEventListener("click", startGame);

// Theme toggle: endrer en klasse på documentElement (for eksempel for mørk/lys stil)
themeToggle?.addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
});

// Håndter museklikk på canvas for å klikke på UI-knapper
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  if (state === "menu") {
    const startRect = { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 - 40, w: 400, h: 80 };
    const quitRect =  { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 + 60, w: 400, h: 80 };
    if (inRect(pos, startRect)) startGame(); // Start hvis start-knapp trykkes
    if (inRect(pos, quitRect)) window.location.reload(); // Reload side hvis reload-trykket
  } else if (state === "gameover") {
    const restartRect = { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 - 20, w: 400, h: 60 };
    const menuRect =    { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 + 80, w: 400, h: 60 };
    if (inRect(pos, restartRect)) { resetLevel(currentLevel); gameOver = false; state = "playing"; }
    else if (inRect(pos, menuRect)) { state = "menu"; currentLevel = 0; resetLevel(currentLevel); gameOver = false; }
  } else if (state === "win") {
    const menuRect = { x: SCREEN_WIDTH / 2 - 200, y: SCREEN_HEIGHT / 2 + 100, w: 400, h: 60 };
    if (inRect(pos, menuRect)) { state = "menu"; currentLevel = 0; totalScore = 0; resetLevel(currentLevel); }
  }
});

// Redundant event-listeners (ble lagt til to ganger i opprinnelig kode). Holder dem for sikkerhets skyld.
window.addEventListener("keydown", e => { keys[e.code] = true; });
window.addEventListener("keyup", e => { keys[e.code] = false; });

// ---------------- Load levels ---------------- //
// Forsøk å hente levels.json (innholdet forventes å ha et "levels"-array)
fetch("levels.json")
  .then(r => r.json())
  .then(data => {
    levels = data.levels || []; // Lagre nivåene
    state = "menu"; // Gå til meny
    requestAnimationFrame(loop); // Start gameloopen
  })
  .catch(err => {
    // Hvis levels.json ikke kan lastes, gi en fallback og start allikevel
    console.error("Failed to load levels:", err);
    levels = [[[0]]];
    state = "menu";
    requestAnimationFrame(loop);
  });

// ---------------- Main loop ---------------- //
function loop() {
  // Rens skjermen før ny tegnerunde
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  if (state === "menu") {
    // Tegn hovedmeny
    renderMenu();
  } else if (state === "loading") {
    // Tegn lasteskjerm mens nivået initialiseres
    renderLoading(currentLevel);
  } else if (state === "playing") {
    // Spillet er i gang — tegn bakgrunn og verden først
    ctx.drawImage(images.bg, -125, -110, SCREEN_WIDTH + 250, SCREEN_HEIGHT + 220);
    world.draw(); // Tegn alle tile-objekter

    // Oppdater og tegn alle fiender i blobGroup
    for (const b of blobGroup) b.update();
    for (const b of blobGroup) {
      b.draw && b.draw();
      if (b instanceof KingEnemy) b.drawHealthBar(); // Hvis boss, tegn helsebar
    }

    // Hvis alle bossene er drept, trigge final tiles til å vises
    if (allKingsDefeated()) for (const t of finalTileGroup) t.triggerAppearance();

    // Tegn andre grupper (mynter, lava, exit osv.)
    for (const c of coinGroup) c.draw();
    for (const l of lavaGroup) l.draw();
    for (const e of exitGroup) e.draw();
    for (const f of finalTileGroup) { f.update(); f.draw(); }

    if (!gameOver) {
      // Oppdater og tegn spilleren hvis vi ikke er i game over-tilstand
      player.update();
      player.draw();

      // Sjekk mynter (samle og fjern fra array)
      for (let i = coinGroup.length - 1; i >= 0; i--) {
        if (rectsCollide(player.rect, coinGroup[i].rect)) { coinGroup.splice(i, 1); score += 1; }
      }

      // Tegn score på skjermen
      ctx.fillStyle = "yellow"; ctx.font = "35px Arial";
      ctx.fillText(`Score: ${score}/10`, 60, 150);

      // Kollisjon med KingEnemy (boss) — spesiallogikk for å sjekke "stomp"
      for (const b of blobGroup) {
        if (b instanceof KingEnemy && b.alive && rectsCollide(player.rect, b.rect)) {
          // Hvis spilleren faller ned på bossen (stomp) i en viss høyde-differanse
          const falling = player.velY > 0 && (player.y + player.h) - b.y < 30;
          if (falling) { b.takeDamage(); player.velY = -12; } // Spiller spretter opp etter stomp
          else { gameOver = true; state = "gameover"; } // Ellers dør spilleren
        }
      }

      // Kollisjon med lava -> game over
      for (const l of lavaGroup) {
        if (rectsCollide(player.rect, l.rect)) { gameOver = true; state = "gameover"; break; }
      }

      // Kollisjon med vanlige fiender -> game over
      if (!gameOver) {
        for (const e of blobGroup) {
          if (!(e instanceof KingEnemy) && rectsCollide(player.rect, e.rect)) { gameOver = true; state = "gameover"; break; }
        }
      }

      // Sjekk om spilleren går i exit (portal eller kiste) for å gå videre i nivåer
      for (const ex of exitGroup) {
        if (rectsCollide(player.rect, ex.rect)) {
          totalScore += score; // Akkumulere score
          currentLevel += 1; // Gå til neste nivå
          if (currentLevel < levels.length) {
            // Last neste nivå med liten loading-delay
            state = "loading";
            setTimeout(() => { resetLevel(currentLevel); state = "playing"; }, 600);
          }
          else { state = "win"; } // Hvis ingen flere nivåer -> vinn
          break;
        }
      }
    }
  } else if (state === "gameover") {
    // Tegn game over-skjerm og håndter keyboard-restart (R) eller gå til hovedmeny (M)
    renderGameOver();
    if (keys["KeyR"]) { resetLevel(currentLevel); gameOver = false; state = "playing"; }
    if (keys["KeyM"]) { state = "menu"; currentLevel = 0; resetLevel(currentLevel); gameOver = false; }
  } else if (state === "win") {
    // Tegn vinn-skjerm
    renderWin();
  }

  // Be nettleseren kjøre loop() igjen ved neste skjermoppdatering
  requestAnimationFrame(loop); // Holder spillet i gang med ~60 FPS
}

