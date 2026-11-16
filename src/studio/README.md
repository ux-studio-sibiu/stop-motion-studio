# studio/

React components of the studio screen and their SCSS. Talks to projects through commands; reads data from live queries and the store.

- `Studio.tsx` lays the screen out and places each feature (from `src/features/`) directly in its JSX.
- `timeline/`: the timeline under the stage (selection, zoom, scrubbing, resizing, reordering) and its styles.
- The rest is the shell: the stage, the side panel, the playback bar, the camera, undo, storage.
