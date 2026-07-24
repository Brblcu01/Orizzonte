import assert from "node:assert/strict";
import { access, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete cinematic experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Ogni scelta apre un universo\.<\/title>/i);
  assert.match(html, /OGNI VIAGGIO INIZIA DAL BUIO\./);
  assert.match(html, /La vita è una sfida continua\./);
  assert.match(html, /RICOMINCIA IL VIAGGIO/);
  assert.match(html, /<canvas class="sequence-canvas"/);
  assert.doesNotMatch(html, /mobile-story/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships complete image sequences and source video assets", async () => {
  const [confronto, orizzonti] = await Promise.all([
    readdir(new URL("../public/frames/confronto/", import.meta.url)),
    readdir(new URL("../public/frames/orizzonti/", import.meta.url)),
  ]);

  const confrontoFrames = confronto.filter((name) => name.endsWith(".jpg")).sort();
  const orizzontiFrames = orizzonti.filter((name) => name.endsWith(".jpg")).sort();
  assert.equal(confrontoFrames.length, 150);
  assert.equal(orizzontiFrames.length, 150);
  assert.equal(confrontoFrames[0], "frame_0001.jpg");
  assert.equal(confrontoFrames.at(-1), "frame_0150.jpg");
  assert.equal(orizzontiFrames[0], "frame_0001.jpg");
  assert.equal(orizzontiFrames.at(-1), "frame_0150.jpg");

  await Promise.all(
    ["sfida.mp4", "confronto.mp4", "orizzonti.mp4"].map((name) =>
      access(new URL(`../public/media/${name}`, import.meta.url)),
    ),
  );
});
