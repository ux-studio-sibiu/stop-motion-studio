# studio/

React components of the studio screen and their SCSS. Talks to projects through commands; reads data from live queries and the store.

- `Studio.tsx` lays the screen out and places each feature (from `src/features/`) directly in its JSX.
- `timeline/`: the timeline under the stage (selection, zoom, the playhead and scrubbing, resizing, reordering, the object and sound rows) and its styles. Its pictures are memoised and the playhead draws on its own, so a long animation stays quick (step 31).
- `styles/`: the studio's SCSS by area; `_cardboard.scss` puts the cardboard look on the buttons beside the stage and Play / See.
- `remembered.ts`: everything the studio remembers between visits.
- The rest is the shell: the stage, the side panel, the playback bar, the Save menu, Help, the camera, undo, storage.
