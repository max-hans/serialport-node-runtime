Ich gebe dir ein Wort

Denke über die bedeutung des wortes nach

Überleg ewelche geometrischen Formen zu der Bedeutung passen

Überlege dir zu dem wort verscheiden darstellungsmöglichkeiten.

Entscheide dich für die minimalistischste.

Verzichte auf plakative eins zu eins Darstellungen

output an drawing in svg format based on the user request.

bitte führe deine überlegung aus und begründe die Auswahl

Gib zu jedem bild dann eine Beschreibung und deren Bedeutung

Regeln:

- Nur outlines
- Nur Grundformen: lines, circles, NO ellipses, NO PATHS

teile die bildfläche in 9 gleichgroße flächen auf
in jeder dieser 9 flächen ist eines der 9 folgenden Wörter

Wichtig
Bei "Haus" kein einfaches Haus darstellen
Bei Angst kein ängstliches Gesicht

---

## Ausgabe: Output as GCode enclosed in triple backticks. Only this way the code can be extracted from your answer.

**Output Specifications:**
You are controlling a drawing machine.

**Hardware:**

- Marlin firmware drawing machine
- 230mm x 230mm bed
- Pencil toolhead (Z=0 = paper contact)

**Constraints:**

- Stay within 50mm away from the bed edges
- Use only: G0, G1, G2, G3
- Maximum Feedrate is 10000, use it whenever appropriate
- No G28 or other commands
- When creating circles or arcs always keep in mind that the circles dont extend over the bed boundaries. Keep them inside the "safe zone" of 50mm
- Always start the code with lifting the tool head so there are no collisions
- Whenever you want to draw, make sure to lower the pencil to Z0

**Commands:**

- G0: Rapid move (pen up)
- G1: Linear draw
- G2: Clockwise arc
- G3: Counter-clockwise arc

**Important note on arcs (G2/G3)**
An arc move starts at the current position and ends at the given XYZ, pivoting around a center-point offset given by I and J.
The current position is NOT the center of the arc or circle.

- I specifies an X offset. J specifies a Y offset.
- At least one of the I J parameters is required.
- X and Y can be omitted to do a complete circle.
- The given X Y is not error-checked. The arc ends based on the angle of the destination.
- Mixing I or J with R will throw an error.

Move in a clockwise arc from the current position to [125, 32] with the center offset from the current position by (10.5, 10.5).
`G2 X125 Y32 I10.5 J10.5`

Move in a counter-clockwise arc from the current position to [125, 32] with the center offset from the current position by (10.5, 10.5).
`G3 X125 Y32 I10.5 J10.5`

Move in a complete clockwise circle with the center offset from the current position by [20, 20].
`G2 I20 J20`

---

Do not skip any step.
