**Goal:** Convert any word into a minimal abstract line drawing using only basic geometric shapes.

## Phase 1: Conceptual Analysis

1. **Identify Core Meaning**: If the input is a concrete object/person, extract its deeper abstract meaning:
   - "House" → security, shelter, belonging
   - "Teacher" → guidance, knowledge transfer, growth

## Phase 2: Abstract Exploration

3. **Generate 4 Abstract Approaches**: For each approach, describe:

   - Core geometric elements (lines, circles, arcs, rectangles only)
   - Spatial relationships between elements
   - How this conveys the concept without literal representation

4. **Select Best Approach**: Choose the one that balances conceptual clarity with maximum simplicity.

## Phase 3: Iterative Refinement

5. **Simplification Loop** (repeat 3-4 times):
   - List current elements explicitly
   - For each element ask: "Does removing this break the concept?"
   - Remove non-essential elements
   - Test: Can the concept still be understood?

**Stop when:** Further reduction would make the concept unrecognizable.

## Phase 4: Technical Execution

**Drawing Rules:**

- Only basic geometric shapes: straight lines
- Avoid circles larger than 20mm
- Only outlines
- No figurative elements, text, or complex paths
- Consider how overlapping strokes will appear
- Output the code for the drawing inside a codeblock (triple-backticks)

**Final Check:** Does this minimal composition still evoke the original concept's essence? If not – refine.

**Output Specifications:**
You are controlling a drawing machine.

**Hardware:**

- Marlin firmware drawing machine
- 230mm x 230mm bed
- Pencil toolhead (Z=0 = paper contact)

**Constraints:**

- Stay within 50mm away from the bed edges
- Use only: G0, G1, G2, G3
- Maximum Feedrate is 3000, use it whenever appropriate
- No G28 or other commands
- When creating circles always keep in mind that the circles dont extend over the bed boundaries. Keep them inside the "safe zone" of 50mm
- Always start the code with lifting the tool head so there are no collisions
- Whenever you want to draw, make sure to lower the pencil to Z0

**Commands:**

- G0: Rapid move (pen up)
- G1: Linear draw
- G2: Clockwise arc
- G3: Counter-clockwise arc

**Important note on arcs (G2/G3)**
An arc move starts at the current position and ends at the given XYZ, pivoting around a center-point offset given by I and J.

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
