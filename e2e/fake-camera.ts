import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// The video Chromium plays as its webcam (see playwright.config.ts). Generated, not committed:
// raw video is big (115 KB per frame here), and these few lines make it in milliseconds.
export const FAKE_CAMERA_FILE = resolve(__dirname, ".generated", "fake-camera.y4m");

const WIDTH = 320;   // 4:3 like many webcams, so the 16:9 crop is exercised too
const HEIGHT = 240;
const FPS = 15;
const FRAMES = 30;   // a 2-second loop
const SIZE = 48;

// Y4M ("YUV4MPEG2") is about the simplest video format there is: one text header line, then
// for each frame the word FRAME, a newline and the raw pixels. Pixels are YUV 4:2:0: a full-size
// plane of brightness (Y), then two quarter-size planes of colour (U, V), one byte per value.
export function writeFakeCamera(file = FAKE_CAMERA_FILE): string {
  const header = `YUV4MPEG2 W${WIDTH} H${HEIGHT} F${FPS}:1 Ip A1:1 C420jpeg\n`;
  const chunks: Buffer[] = [Buffer.from(header, "ascii")];

  for (let frame = 0; frame < FRAMES; frame++) {
    const left = Math.round(((WIDTH - SIZE) * frame) / (FRAMES - 1));   // a square sliding left to right
    const top = (HEIGHT - SIZE) / 2;
    const inSquare = (x: number, y: number) => x >= left && x < left + SIZE && y >= top && y < top + SIZE;

    const y = Buffer.alloc(WIDTH * HEIGHT);
    const u = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2));
    const v = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2));

    for (let row = 0; row < HEIGHT; row++) {
      for (let col = 0; col < WIDTH; col++) y[row * WIDTH + col] = inSquare(col, row) ? 235 : 145;   // white square, green field
    }
    for (let row = 0; row < HEIGHT / 2; row++) {
      for (let col = 0; col < WIDTH / 2; col++) {
        const white = inSquare(col * 2, row * 2);
        u[row * (WIDTH / 2) + col] = white ? 128 : 54;
        v[row * (WIDTH / 2) + col] = white ? 128 : 34;
      }
    }
    chunks.push(Buffer.from("FRAME\n", "ascii"), y, u, v);
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat(chunks));
  return file;
}

// Playwright's globalSetup: runs once before any browser starts.
export default function globalSetup(): void {
  writeFakeCamera();
}
