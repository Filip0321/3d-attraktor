// Verbindet die Seite mit Rechnen und Zeichnen.

import { LORENZ, berechnePunkte, vermesseAttraktor } from "./attraktor.js";
import { erstelleShader } from "./shader.js";

const MAX_PUNKTE = 10000000;
const BILDER_PRO_ANIMATION = 300; // in so vielen Bildern entsteht der Attraktor (60 pro Sekunde = 5 s)

const START_ABSTAND = 2.5;
const BRENNWEITE = 2;
const MIN_ABSTAND = 0.2;
const MAX_ABSTAND = 20;
const EMPFINDLICHKEIT = 0.01;
const START_WINKEL = 0.6;
const START_NEIGUNG = 0.35;

let punkte = 1000000;
// Helligkeit (staerke) ist jetzt ein Regler mit data-wert, steht also in einstellung.staerke

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

const punkteFeld = hole("punkte");

const abstandFeld = hole("abstand");

// Regler und Schalter
// alles mit data-wert im HTML landet hier unter seinem Namen:
// <input type="range" data-wert="laenge"> → einstellung.laenge
// Startwerte stehen dadurch nur im HTML
const einstellung = {};
const felder = {}; // die Felder selbst, damit der Code sie auch verstellen kann

// was außer zeichne() noch passieren soll, wenn sich ein bestimmter Wert ändert
const extra = {
  travel: schalteWandern,
};

// steht direkt hinter dem Feld ein <output>, zeigt es den Wert an
function zeigeWert(feld) {
  const anzeige = feld.nextElementSibling;
  if (anzeige?.tagName === "OUTPUT") anzeige.textContent = feld.value;
}

// Wert aus dem Feld lesen (Häkchen → true/false, alles andere → Zahl)
function lies(name) {
  const feld = felder[name];
  einstellung[name] = feld.type === "checkbox" ? feld.checked : Number(feld.value);
  zeigeWert(feld);
}

// umgekehrt: Wert aus dem Code ins Feld schreiben (z. B. den Kopf beim Wandern)
function setze(name, wert) {
  einstellung[name] = wert; // nicht zurücklesen, sonst schneidet das Feld an seinem max ab
  const feld = felder[name];
  if (feld.type === "checkbox") feld.checked = wert;
  else feld.value = wert;
  zeigeWert(feld);
}

// ein einziger Listener-Bauplan für alle Felder
document.querySelectorAll("[data-wert]").forEach((feld) => {
  const name = feld.dataset.wert; // data-wert="laenge" → "laenge"
  felder[name] = feld;
  lies(name);

  // "input" statt "change": feuert schon beim Ziehen, nicht erst beim Loslassen
  // (bei Häkchen kommt "input" genauso beim Anklicken)
  feld.addEventListener("input", () => {
    lies(name);
    extra[name]?.(); // gibt es eine Extra-Aufgabe für diesen Namen? dann ausführen
    zeichne();
  });
});

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
    winkel, neigung, abstand, versatz, brennweite, sichtbar,
    ...einstellung, // staerke, invertiert, travel, laenge, kopf, rest, glanz, farbig, red, blue … alle auf einmal
  });
}

function ansichtZurueck() {
  winkel = START_WINKEL;
  neigung = START_NEIGUNG;
  abstand = START_ABSTAND;
  abstandFeld.value = abstand;
  versatz = { x: 0, y: 0};
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

let wanderId = null;
let letzteZeit = null; // Zeitpunkt des letzten Bildes in ms, null = gerade erst gestartet

function wandere(zeit) {
  // zeit kommt von requestAnimationFrame: Millisekunden seit dem Laden der Seite
  if (letzteZeit === null) letzteZeit = zeit; // erstes Bild: noch keine Zeit vergangen
  const sekunden = Math.min((zeit - letzteZeit) / 1000, 0.1);
  // höchstens 0.1 s: war der Tab im Hintergrund, pausiert der Browser die Kette,
  // und beim Zurückkommen wären sonst viele Sekunden auf einmal vergangen → Sprung
  letzteZeit = zeit;

  let kopf = einstellung.kopf + einstellung.tempo * sekunden; // tempo = Punkte pro Sekunde

  if (kopf >= punkte) {
    if (!einstellung.endlos) {
      // einmal durch: Wandern aus, danach wieder alles normal zeigen
      setze("travel", false);
      stoppeWandern();
      zeichne();
      return;
    }
    kopf %= punkte; // endlos: von vorn
  }

  setze("kopf", kopf);
  zeichne();
  wanderId = requestAnimationFrame(wandere); // immer verabreden, sonst stirbt die Kette
}

function stoppeWandern() {
  if (wanderId !== null) cancelAnimationFrame(wanderId);
  wanderId = null;
  letzteZeit = null; // beim nächsten Start wieder mit "keine Zeit vergangen" beginnen
  setze("kopf", Number(felder.kopf.min));
}

// startet oder stoppt das Wandern, je nach Häkchen
function schalteWandern() {
  if (!einstellung.travel) {
    stoppeWandern();
  } else if (wanderId === null) {
    // nur starten, wenn es nicht schon läuft, sonst wären es zwei Ketten
    wanderId = requestAnimationFrame(wandere);
  }
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
    // statt dem könnte man auch:
    // animationsId = sichtbar < punkt ? requestAnimationFrame(bildSchritt) : null
    // aber das würde dann nicht "stoppeAnimation" aufrufen
    } else {
      stoppeAnimation(); // fertig: Knopf zurücksetzen
    }
  }

  animationsId = requestAnimationFrame(bildSchritt);
  // da bildSchritt auch nur eine Funktion ist, muss diese einmal nach ihrer Definition aufgerufen werden
  // bis hier wurde sie lediglich definiert
  // läuft also nicht nach bildSchritt durch, sondern ist der erste Funktionsaufruf
  // und sagt was beim nächsten Frame gemacht werden soll
}

// Felder

punkteFeld.addEventListener("change", () => {
  punkte = leseZahl(punkteFeld, 1000, MAX_PUNKTE, punkte);
  felder.kopf.max = punkte;
  if (einstellung.kopf > punkte) setze("kopf", 0);
  stoppeAnimation();
  rechne();
  zeichne();
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

const finger = new Map(); // pointerId → { x, y } in CSS-Pixeln
let griff = null;         // Startwerte beim Aufsetzen
let versatz = { x: 0, y: 0 };

function alleFinger() {
  return [...finger.values()];
}

function greifeNeu(art = "drehen") {
  const liste = alleFinger();
  if (liste.length === 1) {
    const [a] = liste;
    griff = {
      art,
      x: a.x,
      y: a.y,
      winkel,
      neigung,
      abstand,
      versatz: { ...versatz },
    };
  } else if (liste.length === 2) {
    const [a, b] = liste;
    griff = {
      mitte: mitteFinger(a, b),
      fingerAbstand: Math.max(abstandZwischen(a, b), 1),
      abstand,                 // Kamera beim Aufsetzen
      versatz: { ...versatz }, // Kopie, nicht dasselbe Objekt!
    };
  } else {
    griff = null;
  }
}

function mitteFinger(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function abstandZwischen(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  finger.set(event.pointerId, { x: event.clientX, y: event.clientY });

  // Tasten werden nur beim Aufsetzen gelesen: loslassen mitten im Ziehen ändert nichts
  let art = "drehen";
  if (event.shiftKey) art = "schieben";
  else if (event.altKey || event.ctrlKey) art = "zoomen";

  greifeNeu(art);
  // erstellt griff Objekt
});

canvas.addEventListener("pointermove", (event) => {
  if (!griff) return;
  if (!finger.has(event.pointerId)) return;
  finger.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const liste = alleFinger();
  // liste hat für jeden Finger { x, y }: 
  // seine Position beim letzten pointermove (aus event.clientX/Y)
  if (liste.length === 1) {
    const dx = liste[0].x - griff.x; // Strecke seit dem Aufsetzen in Pixeln
    const dy = liste[0].y - griff.y;

    if (griff.art === "schieben") {
      versatz = {
        x: griff.versatz.x + dx * 2 / canvas.clientWidth,
        y: griff.versatz.y - dy * 2 / canvas.clientHeight,
      };
    } else if (griff.art === "zoomen") {
      // nach oben ziehen = näher ran; exp wie beim Mausrad, damit es sich gleich anfühlt
      abstand = griff.abstand * Math.exp(dy * 0.005);
      abstand = Math.min(Math.max(abstand, MIN_ABSTAND), MAX_ABSTAND);
      abstandFeld.value = abstand.toFixed(2);
    } else {
      // dein Drehen, jetzt mit dx und dy
      winkel = griff.winkel + dx * EMPFINDLICHKEIT;
      neigung = Math.min(Math.max(griff.neigung + dy * EMPFINDLICHKEIT, -Math.PI / 2), Math.PI / 2);
    }
  } else if (liste.length === 2) {
    // griff Objekt ist jetzt schon erstellt
    // durch die Funktion greifeNeu()
    const verhaeltnis = abstandZwischen(liste[0], liste[1]) / griff.fingerAbstand;
    abstand = griff.abstand / verhaeltnis;
    abstand = Math.min(Math.max(abstand, MIN_ABSTAND), MAX_ABSTAND);
    abstandFeld.value = abstand.toFixed(2);

    const mitte = mitteFinger(liste[0], liste[1]);
    // wo ist die mitte der beiden Finger
    const dx = mitte.x - griff.mitte.x;
    const dy = mitte.y - griff.mitte.y;

    versatz = {
      x: griff.versatz.x + dx * 2 / canvas.clientWidth,
      y: griff.versatz.y - dy * 2 / canvas.clientHeight,
      // Ein Pixel ist 2 / canvas.clientWidth Einheiten 
      // Bei y ist das Vorzeichen umgedreht, weil der Finger nach unten positive Pixel gibt, 
      // im Clip Space aber oben positiv ist
    };
  }
  zeichne();
});

function lassLos(event) {
  finger.delete(event.pointerId);
  greifeNeu(); // mit den übrigen Fingern weitermachen
}

canvas.addEventListener("pointerup", lassLos);
canvas.addEventListener("pointercancel", lassLos);

// Start

punkteFeld.value = punkte;
felder.kopf.max = punkte;

rechne(); // die Punkte brauchen keine Canvas-Größe
schalteWandern(); // falls der Browser das Häkchen beim Neuladen wiederhergestellt hat

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
