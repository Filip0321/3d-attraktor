// Rechnet den 3D-Attraktor aus, das Zeichnen mach ich im Shader

const LIMIT_ABSTAND_PUNKTE = 1000000;
const EINPENDEL_ZEIT = 5; // Zeiteinheiten, nicht Schritte
// weil dt ein Bruchteil einer Zeiteinheit ist, und jeder Typ ein anderes dt hat
// (Lorenz dt = 0.005: 200 Schritte pro Zeiteinheit, Thomas dt = 0.05: nur 20)
// um sicherzugehen dass der Punkt schon auf der Laufbahn ist wenn man malt

export const LORENZ = {
  name: "Lorenz",
  werte: { a: 10, b: 28, c: 8/3},
  dt: 0.005, // 3D-Attraktoren werden mit Differentialgleichungen berechnet
  // es wird also nicht direkt der neue Punkt absolut bestimmt, sondern nur
  // der nächste in bezug zum alten (mal eine differenz, schrittgröße)
  start: [0.1, 0, 0],
  schritt(werte, pos, dt) {
    const dx = werte.a * (pos.y - pos.x);
    const dy = pos.x * (werte.b - pos.z) - pos.y;
    const dz = pos.x * pos.y - werte.c * pos.z;
    pos.x += dx * dt;
    pos.y += dy * dt;
    pos.z += dz * dt;
  },
};

// schauen ob der Punkt schon zu weit weg ist oder nicht mehr endlich
function punktNichtMehrDa(punkt) {
  return (
    !Number.isFinite(punkt.x + punkt.y + punkt.z) ||
    Math.abs(punkt.x) > LIMIT_ABSTAND_PUNKTE ||
    Math.abs(punkt.y) > LIMIT_ABSTAND_PUNKTE ||
    Math.abs(punkt.z) > LIMIT_ABSTAND_PUNKTE
  );
}

export function berechnePunkte(typ, werte, anzahl, start = typ.start) {
  const pos = { x: start[0], y: start[1], z: start[2] };
  const einpendeln = Math.ceil(EINPENDEL_ZEIT / typ.dt);

  for (let i = 0; i < einpendeln; i++) {
    typ.schritt(werte, pos, typ.dt);
  }

  // anzahl * 3 weil jeder Punkt 3 Koordinaten hat (x, y, z)
  const daten = new Float32Array(anzahl * 3);

  for (let i = 0; i < anzahl; i++) {
    typ.schritt(werte, pos, typ.dt);
    if (punktNichtMehrDa(pos)) return null;
    daten[i * 3] = pos.x;
    daten[i * 3 + 1] = pos.y;
    daten[i * 3 + 2] = pos.z;
  }
  return daten;
}


// Den fertigen Attraktor vermessen: wo ist seine Mitte und wie groß ist er
// mit dem Ergebnis rückt der Shader den Attraktor in die Mitte 
// und bringt ihn auf Größe −1 bis 1, damit er sich um sich selbst dreht.
export function vermesseAttraktor(punkte) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  // jetzt hat jeder punkt eine x, y und z Koordinate nacheinander geschrieben
  // im Array, also muss += 3
  for (let i = 0; i < punkte.length; i += 3) {
    if (punkte[i] < minX) minX = punkte[i];
    if (punkte[i] > maxX) maxX = punkte[i];
    if (punkte[i + 1] < minY) minY = punkte[i + 1];
    if (punkte[i + 1] > maxY) maxY = punkte[i + 1];    
    if (punkte[i + 2] < minZ) minZ = punkte[i + 2];
    if (punkte[i + 2] > maxZ) maxZ = punkte[i + 2];
  }

  return {
    mitteX: (minX + maxX) / 2,
    mitteY: (minY + maxY) / 2,
    mitteZ: (minZ + maxZ) / 2,
    mass: Math.max(
      maxX - minX, 
      maxY - minY,
      maxZ - minZ, 1e-9),
    // nie 0, sonst teilt der Shader (punkt - mitte) / mass durch 0
    // würde ich hier wieder breite, hoehe und tiefe nehmen, dann hätte ich kein uniformen 
    // Attraktor beim Drehen
  };
}

