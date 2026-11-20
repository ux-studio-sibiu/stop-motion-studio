import { ALL_FORMATS, BlobSource, canEncodeAudio, canEncodeVideo, Input } from "mediabunny";
import { describe, expect, it } from "vitest";
import { exportVideo, VIDEO_FORMATS, videoFormat } from "@/adapters/export/videoExport";
import { videoFrames } from "@/core/export";
import { createFrame, createSoundClip } from "@/core/model";
import { mixSounds } from "@/adapters/sound/sound";
import { exportRect, type DrawableImage } from "@/core/render";

// The video pipeline in Chromium: the page draws, WebCodecs encodes, and the file is read back
// with Mediabunny's own reader: its length, its size, and one frame per change.

function solid(colour: string): DrawableImage {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 320, 180);
  return canvas;
}

function setup(holds: number[]) {
  const frames = holds.map((hold, i) => ({ ...createFrame("p", `image-${i}`), hold }));
  const scene = { width: 320, height: 180, frames };
  const rect = exportRect(scene, 10);
  const images = new Map(frames.map((frame, i) => [frame.imageId, solid(i % 2 ? "#1d4ed8" : "#d62828")]));
  return { scene, rect, frames: videoFrames(frames, [], 8), loadImage: async (id: string) => images.get(id) };
}

describe("videoFormat", () => {
  it("finds a format this browser can encode, MP4 first", async () => {
    const format = await videoFormat({ width: 300, height: 168 });
    expect(format).not.toBeNull();
    expect(["mp4", "webm"]).toContain(format!.container);
  });
});

describe("exportVideo", () => {
  it("makes a video as long as the animation, at the exported size, one frame per change", async () => {
    const options = setup([1, 8, 3]);   // 12 ticks at 8 per second: 1.5 s
    const format = (await videoFormat(options.rect))!;
    const progress: number[] = [];
    const blob = await exportVideo({ ...options, format, onProgress: (fraction) => progress.push(fraction) });
    expect(blob.type).toBe(format.type);

    using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const track = (await input.getPrimaryVideoTrack())!;
    expect([track.displayWidth, track.displayHeight]).toEqual([options.rect.width, options.rect.height]);
    expect(await input.computeDuration()).toBeCloseTo(1.5, 2);
    expect((await track.computePacketStats()).packetCount).toBe(3);   // the held picture is one frame
    expect(progress.at(-1)).toBe(1);
  });

  it("makes a file that reads back in every format this browser can encode (MP4, and WebM as the fallback)", async () => {
    const options = setup([2, 2]);
    let made = 0;
    for (const format of VIDEO_FORMATS) {
      if (!(await canEncodeVideo(format.codec, options.rect))) continue;
      const blob = await exportVideo({ ...options, format });
      using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
      expect((await input.getFormat()).name.toLowerCase()).toContain(format.container === "mp4" ? "mp4" : "webm");
      expect(await input.computeDuration()).toBeCloseTo(0.5, 2);
      made++;
    }
    expect(made).toBeGreaterThan(0);
  });

  it("carries the sound row as an audio track, where the browser can encode one, and stays as long", async () => {
    const options = setup([1, 8, 3]);   // 1.5 s
    const format = (await videoFormat(options.rect))!;
    const audio = await mixSounds([createSoundClip("cartoon/boing", 4)], 8, 12);
    expect(audio).not.toBeNull();
    const blob = await exportVideo({ ...options, format, audio });
    using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const track = await input.getPrimaryAudioTrack();
    if (await canEncodeAudio(format.audioCodec, { numberOfChannels: 2, sampleRate: audio!.sampleRate })) {
      expect(track?.codec).toBe(format.audioCodec);
      expect(await track!.computeDuration()).toBeCloseTo(1.5, 1);
    } else {
      expect(track).toBeNull();   // this browser can't: the video is made without sound
    }
    expect(await input.computeDuration()).toBeCloseTo(1.5, 1);
  });

  it("has no audio track when there's nothing to hear", async () => {
    const options = setup([2, 2]);
    const format = (await videoFormat(options.rect))!;
    using input = new Input({ formats: ALL_FORMATS, source: new BlobSource(await exportVideo({ ...options, format, audio: null })) });
    expect(await input.getPrimaryAudioTrack()).toBeNull();
  });

  it("stops when asked: it rejects with an AbortError", async () => {
    const stop = new AbortController();
    const options = setup(Array(20).fill(1));
    let loaded = 0;
    const making = exportVideo({ ...options, format: (await videoFormat(options.rect))!, loadImage: async (id) => { if (++loaded === 3) stop.abort(); return options.loadImage(id); }, signal: stop.signal });
    await expect(making).rejects.toMatchObject({ name: "AbortError" });
    expect(loaded).toBe(3);
  });
});
