import { useEffect, useRef } from "react";

import type { Skin } from "../bindings";

const WIDTH = 96;
const HEIGHT = 192;
const SCALE = 6;

export function SkinPreview({ skin }: { skin: Skin | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.imageSmoothingEnabled = false;

    if (!skin?.url) {
      drawPlaceholder(context);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        drawSkin(context, image, skin.variant);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        drawPlaceholder(context);
      }
    };
    image.src = skin.url;

    return () => {
      cancelled = true;
    };
  }, [skin?.url, skin?.variant]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="h-[192px] w-[96px] [image-rendering:pixelated]"
    />
  );
}

function drawSkin(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  variant: string,
) {
  const armWidth = variant === "SLIM" ? 3 : 4;
  const totalWidth = 8 + armWidth * 2;
  const offsetX = (16 - totalWidth) / 2;
  const headX = offsetX + armWidth;

  // Голова
  context.drawImage(
    image,
    8,
    8,
    8,
    8,
    headX * SCALE,
    0,
    8 * SCALE,
    8 * SCALE,
  );
  // Тело
  context.drawImage(
    image,
    20,
    20,
    8,
    12,
    headX * SCALE,
    8 * SCALE,
    8 * SCALE,
    12 * SCALE,
  );
  // Правая рука
  context.drawImage(
    image,
    44,
    20,
    armWidth,
    12,
    offsetX * SCALE,
    8 * SCALE,
    armWidth * SCALE,
    12 * SCALE,
  );
  // Левая рука
  context.drawImage(
    image,
    36,
    52,
    armWidth,
    12,
    (headX + 8) * SCALE,
    8 * SCALE,
    armWidth * SCALE,
    12 * SCALE,
  );
  // Правая нога
  context.drawImage(
    image,
    4,
    20,
    4,
    12,
    headX * SCALE,
    20 * SCALE,
    4 * SCALE,
    12 * SCALE,
  );
  // Левая нога
  context.drawImage(
    image,
    20,
    52,
    4,
    12,
    (headX + 4) * SCALE,
    20 * SCALE,
    4 * SCALE,
    12 * SCALE,
  );
}

function drawPlaceholder(context: CanvasRenderingContext2D) {
  context.fillStyle = "#161616";
  context.fillRect(24, 0, 48, 48);
  context.fillRect(24, 48, 48, 72);
  context.fillRect(0, 48, 24, 72);
  context.fillRect(72, 48, 24, 72);
  context.fillRect(24, 120, 24, 72);
  context.fillRect(48, 120, 24, 72);
}
