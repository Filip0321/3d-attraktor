// Verbindet die Seite mit Rechnen und Zeichnen.

import { LORENZ, berechnePunkte, vermesseAttraktor } from "./attraktor.js";
import { erstelleShader } from "./shader.js";

const MAX_PUNKTE = 10000000;
const MAX_STAERKE = 255;
const BILDER_PRO_ANIMATION = 300; // in so vielen Bildern entsteht der Attraktor (60 pro Sekunde = 5 s)

const START_ABSTAND = 2.5;
const BRENNWEITE = 2;
const MIN_ABSTAND = 0.2;
const MAX_ABSTAND = 20;
const EMPFINDLICHKEIT = 0.01;
const START_WINKEL = 0.6;
const START_NEIGUNG = 0.35;

let punkte = 100000;
let staerke = 10;

let abstand = START_ABSTAND;

// immer sinnvolle Hilfsfunktion
function hole(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Im HTML fehlt ein Element mit id="${id}"`);
  return element;
}

const canvas = hole("zeichenBild");

const sofortBtn = hole("sofortBtn");
const ansichtBtn = hole("ansichtBtn");

const staerkeFeld = hole("staerke");
const punkteFeld = hole("punkte");
// die beiden Eingabefelder

const abstandFeld = hole("abstand");

const farbigCheck = hole("farbigCheck");
const redRange = hole("red");
const blueRange = hole("blue");

// Startwerte aus dem HTML lesen, dann gibt es nur eine Stelle, wo sie stehen
let farbig = farbigCheck.checked;
let red = Number(redRange.value);
let blue = Number(blueRange.value);

const shader = erstelleShader(canvas);

// Der Attraktor ist jetzt in attraktor.js drin
const typ = LORENZ;
let werte = { ...typ.werte };

let groesse = null; // Ergebnis von vermesseAttraktor

let winkel = START_WINKEL;
let neigung = START_NEIGUNG;
let brennweite = BRENNWEITE;

let sichtbar = punkte; // wie viele Punkte gerade gezeichnet werden
let animationsId = null; // läuft gerade eine Animation? dann steht hier ihre Nummer

function passeGroesseAn() {
  // mindestens doppelt so fein rechnen, auch bei normalen Monitoren mit dpr 1
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}

// immer sinnvoll beim lesen von Zahlen
// Hilfsfunktion dass die Eingabe auch eine Zahl im Rahmen ist (und ganz, wenn sollGanz)
function leseZahl(feld, min, max, bisher, sollGanz = true) {
  const zahl = Number(feld.value.trim());
  if (feld.value.trim() === "" || !Number.isFinite(zahl)) {
    feld.value = bisher;
    // wenn leer oder nicht Finite dann mach den Wert was er davor war
    return bisher;
  }
  let jetzt = Math.min(Math.max(zahl, min), max);
  // soll größer min und kleiner max sein
  if (sollGanz) jetzt = Math.round(jetzt);
  feld.value = jetzt;
  return jetzt;
}

// rechnen nur wenn sich Werte oder Punktzahl ändern
function rechne() {
  // berechnen der Punkte in attraktor.js
  const daten = berechnePunkte(typ, werte, punkte);
  shader.ladePunkte(daten);
  groesse = daten ? vermesseAttraktor(daten) : null;
}

// zeichnen billig, geht bei jeder Drehung
function zeichne() {
  if (!groesse) return;
  shader.zeichne({ 
    mitteX: groesse.mitteX, 
    mitteY: groesse.mitteY, 
    mitteZ: groesse.mitteZ,
    mass: groesse.mass, 
    winkel, neigung, abstand, brennweite, staerke, farbig, red, blue, sichtbar});
}

function ansichtZurueck() {
  winkel = START_WINKEL;
  neigung = START_NEIGUNG;
  abstand = START_ABSTAND;
  abstandFeld.value = abstand;
  zeichne();
}

// Entstehen lassen: jedes Bild ein paar Punkte mehr zeichnen
// gerechnet ist schon alles, der Shader zeichnet nur die ersten "sichtbar" Punkte

function stoppeAnimation() {
  if (animationsId !== null) cancelAnimationFrame(animationsId);
  animationsId = null;
  sichtbar = punkte;
  sofortBtn.textContent = "Animieren";
}

function animiere() {
  stoppeAnimation();
  sichtbar = 0;
  sofortBtn.textContent = "Stoppen";
  const proBild = Math.ceil(punkte / BILDER_PRO_ANIMATION);

  function bildSchritt() {
    sichtbar += proBild;
    zeichne();
    if (sichtbar < punkte) {
      animationsId = requestAnimationFrame(bildSchritt);
    } else {
      stoppeAnimation(); // fertig: Knopf zurücksetzen
    }
  }

  animationsId = requestAnimationFrame(bildSchritt);
}

// Felder

punkteFeld.addEventListener("change", () => {
  punkte = leseZahl(punkteFeld, 1000, MAX_PUNKTE, punkte);
  stoppeAnimation();
  rechne();
  zeichne();
});

staerkeFeld.addEventListener("change", () => {
  staerke = leseZahl(staerkeFeld, 1, MAX_STAERKE, staerke);
  zeichne(); // nur zeichnen, die Punkte bleiben gleich
});

abstandFeld.addEventListener("change", () => {
  abstand = leseZahl(abstandFeld, MIN_ABSTAND, MAX_ABSTAND, abstand, false);
  zeichne(); // nur zeichnen
});

sofortBtn.addEventListener("click", () => {
  if (animationsId !== null) {
    stoppeAnimation();
    zeichne(); // sofort alles zeigen
  } else {
    animiere();
  }
});

ansichtBtn.addEventListener("click", ansichtZurueck);

farbigCheck.addEventListener("change", () => {
  farbig = farbigCheck.checked; // direkt vom Häkchen, dann kann es nie verkehrt herum sein
  zeichne();
});

// "input" statt "change": feuert schon beim Ziehen, nicht erst beim Loslassen
redRange.addEventListener("input", () => {
  red = Number(redRange.value);
  zeichne();
});

blueRange.addEventListener("input", () => {
  blue = Number(blueRange.value);
  zeichne();
});

// Mouse Listener
// Mausrad: Kamera fährt näher ran oder weiter weg

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();

  let delta = event.deltaY;
  if (event.deltaMode === 1) delta *= 16; // manche Mäuse melden Zeilen statt Pixel
  abstand *= Math.exp(+delta * 0.0015); // +delta weil Mausrad nach vorn bring Kamera näher
  abstand = Math.min(Math.max(abstand, MIN_ABSTAND), MAX_ABSTAND);

  abstandFeld.value = abstand.toFixed(2);
  zeichne();
}, { passive: false });

// Abstand der Maus zur Canvas-Mitte [Canvas-Pixel]
function mausAbstand(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    dx: event.clientX,
    dy: event.clientY,
    // zurück kommt der Punkt relativ zur Canvas-Mitte
  };
}

let griff = null; // wo die Maus aufgesetzt hat und wie der Attraktor da stand

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  griff = {
    x: event.clientX,
    y: event.clientY,
    winkel,   // Kurzform für winkel: winkel
    neigung,
  };
});

canvas.addEventListener("pointermove", (event) => {
  if (!griff) return; // Maus nur drüber, nicht gedrückt
  winkel = griff.winkel + (event.clientX - griff.x) * EMPFINDLICHKEIT;
  neigung = Math.min(Math.max(griff.neigung + (event.clientY - griff.y) * EMPFINDLICHKEIT, -Math.PI / 2), Math.PI / 2);
  zeichne();
});

function lassLos() {
  griff = null;
}

canvas.addEventListener("pointerup", lassLos);
canvas.addEventListener("pointercancel", lassLos);

// Start

punkteFeld.value = punkte;
staerkeFeld.value = staerke;

rechne(); // die Punkte brauchen keine Canvas-Größe

let ersteGroesse = true;

const beobachter = new ResizeObserver(() => {
  passeGroesseAn();
  if (ersteGroesse) {
    ersteGroesse = false;
    ansichtZurueck(); 
  } else {
    zeichne();
  }
});

beobachter.observe(canvas);
