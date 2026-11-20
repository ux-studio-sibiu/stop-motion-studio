# features/

The studio's features, one folder each, so a feature's code lives together:

- `camera/`: the Camera tab, and the capture sound on/off (step 29).
- `picture/`: the Picture tab (position, size, turn, flip, brightness and contrast) and moving the
  picture on the stage.
- `onion-skin/`: see-through, on the stage, and its button and options.
- `draw/`: the Draw tab (pencil, eraser, colour, width) and drawing on the stage (step 24b).
- `sounds/`: the Sounds tab: the sound library to add, the picked sound's volume and Delete (step 29b; the sound row itself is in `src/studio/timeline/`).
- `photo-import/`: adding photos from the computer (the Add photos button in the timeline, dropping photos on the studio, step 28).
- `objects/`: the Objects tab (speech bubbles, text, shapes), each kind's settings, and placing
  objects on the stage, on a picture or in time (the overlay track itself is in
  `src/studio/timeline/`).

There's no registry: `src/studio/Studio.tsx` imports each feature's components and places them
directly in its JSX, so moving a piece of UI is moving its line (step 22). A feature changes the
animation only through the commands the studio passes it, and reads it through the store.
