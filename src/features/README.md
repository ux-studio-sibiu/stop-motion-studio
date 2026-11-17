# features/

The studio's features, one folder each, so a feature's code lives together:

- `camera/`: the Camera tab.
- `picture/`: the Picture tab (position, size, turn, flip, brightness and contrast) and moving the
  picture on the stage.
- `onion-skin/`: see-through, on the stage, and its button and options.
- `draw/`: the Draw tab (pencil, eraser, colour, width) and drawing on the stage (step 24b).
- `objects/`: the Objects tab (speech bubbles, text, shapes), each kind's settings, and placing
  objects on the stage, on a picture or in time (the overlay track itself is in
  `src/studio/timeline/`).

There's no registry: `src/studio/Studio.tsx` imports each feature's components and places them
directly in its JSX, so moving a piece of UI is moving its line (step 22). A feature changes the
animation only through the commands the studio passes it, and reads it through the store.
