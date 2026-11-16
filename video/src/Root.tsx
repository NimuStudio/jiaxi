import { Composition } from "remotion";
import { Film, FILM_FRAMES } from "./film/Film";
import { Cover } from "./film/Cover";
import { Opening } from "./scenes/Opening";
import { Pipeline } from "./scenes/Pipeline";
import { RiskDrop } from "./scenes/RiskDrop";
import { Outro } from "./scenes/Outro";
import { FPS, HEIGHT, WIDTH, sec } from "./theme";

export const RemotionRoot = () => (
  <>
    {/* 成片：时长由配音决定（见 src/timing.json） */}
    <Composition id="Film" component={Film} durationInFrames={FILM_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* 封面：单帧，用于提交页 */}
    <Composition id="Cover" component={Cover} durationInFrames={1} fps={FPS} width={WIDTH} height={HEIGHT} />

    {/* 旧的独立动画段，保留备用 */}
    <Composition id="Opening" component={Opening} durationInFrames={sec(38)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Pipeline" component={Pipeline} durationInFrames={sec(62.5)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="RiskDrop" component={RiskDrop} durationInFrames={sec(50)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Outro" component={Outro} durationInFrames={sec(20)} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
